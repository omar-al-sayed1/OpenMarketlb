import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat, Easing } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { brandRefresh } from '../components/BrandRefresh';
import { tapLight } from '../lib/haptics';
import AnimatedMoney from '../components/AnimatedMoney';
import CheckoutPromos from '../components/CheckoutPromos';
import { SkeletonBlock, TAB_SPACE } from '../components/ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

/* Port of the web per-item pricing (variants → discount → base). */
function lineOf(item) {
  const p = item.product || {};
  const sc = item.selected_color, ss = item.selected_size, sh = item.selected_shape;
  const cv = sc && p.colors ? p.colors.find((c) => c.color_name === sc) : null;
  const sv = ss && p.sizes ? p.sizes.find((x) => x.size_name === ss) : null;
  const shv = sh && p.shapes ? p.shapes.find((x) => x.shape_name === sh) : null;
  const vPrice = cv?.discount_price || cv?.price || sv?.discount_price || sv?.price || shv?.discount_price || shv?.price || null;
  const price = vPrice || p.discount_price || p.price || 0;
  const orig = (cv?.price || sv?.price || shv?.price || null) || p.price || 0;
  const hasDiscount = !!((cv?.discount_price && cv.discount_price < cv.price) || (sv?.discount_price && sv.discount_price < sv.price) || (shv?.discount_price && shv.discount_price < shv.price) || (p.discount_price && p.discount_price < p.price));
  const pct = hasDiscount && orig > 0 ? Math.round(((orig - price) / orig) * 100) : 0;
  const stock = cv ? cv.stock : sv ? sv.stock : shv ? shv.stock : p.stock;
  return {
    id: p.id, name: p.name || 'Item', price, orig, hasDiscount, pct, stock,
    image: cv?.image_url || shv?.image_url || sv?.image_url || p.images?.[0] || null,
    qty: item.quantity || 1,
    variantLabels: [sc && `Color: ${sc}`, ss && `Size: ${ss}`, sh && `Shape: ${sh}`].filter(Boolean),
    shopName: p.shop_name, saleTitle: p.shop_sale_title, saleDiscount: p.shop_sale_discount,
    gift: item.has_free_gift, giftImage: item.gift_image, deliveryNote: item.delivery_note,
    product: p,
  };
}

/* Quantity stepper — pulses the number on change. */
function QtyStepper({ qty, max, onDec, onInc }) {
  const pulse = useSharedValue(1);
  const prev = useRef(qty);
  useEffect(() => {
    if (prev.current !== qty) { pulse.value = withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 220 })); prev.current = qty; }
  }, [qty]); // eslint-disable-line
  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const atMax = max != null && qty >= max;
  return (
    <View style={styles.stepper}>
      <TouchableOpacity testID="decrease-cart-quantity" onPress={() => { tapLight(); onDec(); }} style={styles.stepBtn}>
        <Ionicons name={qty > 1 ? 'remove' : 'trash-outline'} size={15} color={colors.violet} />
      </TouchableOpacity>
      <Animated.Text testID="cart-item-quantity" style={[styles.qty, numStyle]}>{qty}</Animated.Text>
      <TouchableOpacity testID="increase-cart-quantity" disabled={atMax} onPress={() => { tapLight(); onInc(); }} style={[styles.stepBtn, atMax && { opacity: 0.4 }]}>
        <Ionicons name="add" size={15} color={colors.violet} />
      </TouchableOpacity>
    </View>
  );
}

/* Gradient CTA with a looping shimmer sweep. */
function ShimmerCTA({ label, onPress, testID, style }) {
  const x = useSharedValue(-1);
  useEffect(() => { x.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.linear }), -1, false); }, []); // eslint-disable-line
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 260 }] }));
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} testID={testID} style={style}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
        <Animated.View style={[styles.shimmer, sweep]} pointerEvents="none">
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
        <Text style={styles.ctaText}>{label}</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.white} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* One swipe-to-delete cart row. */
function CartRow({ item, index, onDec, onInc, onRemove }) {
  const l = lineOf(item);
  const swipeRef = useRef(null);
  const renderRight = () => (
    <View style={styles.swipeDelete}>
      <Ionicons name="trash" size={22} color={colors.white} />
      <Text style={styles.swipeText}>Remove</Text>
    </View>
  );
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40)}>
      <Swipeable ref={swipeRef} renderRightActions={renderRight} onSwipeableOpen={() => { onRemove(l); swipeRef.current?.close(); }} overshootRight={false} rightThreshold={44}>
        <View style={[styles.card, l.gift && styles.cardGift]} testID={`cart-item-${l.id}`}>
          <View style={styles.row}>
            <View>
              {l.image ? <Image source={{ uri: img(l.image) }} style={styles.img} testID="cart-item-image" /> : <View style={[styles.img, styles.imgFallback]}><Ionicons name="image-outline" size={22} color={colors.textMuted} /></View>}
              {l.hasDiscount && l.pct > 0 ? <View style={styles.discBadge}><Text style={styles.discText}>-{l.pct}%</Text></View> : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1} testID="cart-item-name">{l.name}</Text>
                <TouchableOpacity testID="remove-cart-item" onPress={() => onRemove(l)} style={styles.trash} hitSlop={8}><Ionicons name="trash-outline" size={17} color={colors.textMuted} /></TouchableOpacity>
              </View>
              {l.variantLabels.length ? (
                <View style={styles.variantWrap}>{l.variantLabels.map((v, i) => <View key={i} style={styles.variant}><Text style={styles.variantText}>{v}</Text></View>)}</View>
              ) : null}
              {l.saleDiscount ? <View style={styles.saleBadge} testID="cart-sale-badge"><Ionicons name="pricetag" size={10} color="#c2410c" /><Text style={styles.saleText}>{l.saleTitle || `${l.saleDiscount}% OFF Sale`}</Text></View> : null}
              {l.shopName ? <View style={styles.shopRow}><Ionicons name="storefront-outline" size={10} color={colors.textMuted} /><Text style={styles.shop} numberOfLines={1}>{l.shopName}</Text></View> : null}

              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(l.price)}</Text>
                {l.hasDiscount ? <Text style={styles.strike}>{money(l.orig)}</Text> : null}
              </View>

              <View style={styles.qtyRow}>
                <QtyStepper qty={l.qty} max={l.stock} onDec={() => (l.qty > 1 ? onDec(l) : onRemove(l))} onInc={() => onInc(l)} />
                <View style={{ alignItems: 'flex-end' }}>
                  <AnimatedMoney value={l.price * l.qty} style={styles.lineTotal} testID="cart-item-price" />
                  {l.hasDiscount ? <Text style={styles.lineSave}>Saved {money((l.orig - l.price) * l.qty)}</Text> : null}
                </View>
              </View>
            </View>
          </View>

          {l.gift ? (
            <LinearGradient colors={['#fdf2f8', '#ffe4e6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.notice} testID="cart-gift-badge">
              {l.giftImage ? <Image source={{ uri: img(l.giftImage) }} style={styles.giftImg} /> : <Ionicons name="gift" size={14} color={colors.gift} />}
              <View style={{ flex: 1 }}><Text style={styles.giftTitle}>FREE GIFT INCLUDED</Text><Text style={styles.giftSub}>Mystery gift revealed after purchase!</Text></View>
              <Text style={styles.giftPrice}>$0.00</Text>
            </LinearGradient>
          ) : null}
          {l.deliveryNote ? <View style={styles.deliveryNote} testID="cart-delivery-note"><Ionicons name="car-outline" size={12} color={colors.textMuted} /><Text style={styles.deliveryText}>{l.deliveryNote}</Text></View> : null}
        </View>
      </Swipeable>
    </Animated.View>
  );
}

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { items, loading, updateQty, remove, add, refresh } = useCart();
  const { isLoggedIn, user } = useAuth();
  const [loyalty, setLoyalty] = useState(null);
  const [firstBonus, setFirstBonus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [undo, setUndo] = useState(null);
  const [nearEnd, setNearEnd] = useState(0); // bumps as the page scrolls near the bottom → reveals more recommended cards
  const undoTimer = useRef(null);
  const nearAt = useRef(0); // throttle: last time we bumped nearEnd

  // Throttled to ~2×/sec so scrolling near the bottom doesn't re-render the page on every frame.
  const onPageScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 700) {
      const now = Date.now();
      if (now - nearAt.current > 500) { nearAt.current = now; setNearEnd((n) => n + 1); }
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    api.loyalty.getStatus().then(({ data }) => { if (data?.enabled) setLoyalty(data); }).catch(() => {});
    Promise.allSettled([api.orders.getAll(), api.admin.getPlatformSettings()]).then(([o, s]) => {
      const orders = o.status === 'fulfilled' ? (o.value.data || []) : [];
      const settings = s.status === 'fulfilled' ? (s.value.data || {}) : {};
      if ((Array.isArray(orders) ? orders.length : 0) === 0 && settings.first_purchase_bonus_enabled) setFirstBonus(settings.first_purchase_bonus_points || 100);
    });
  }, [isLoggedIn]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const doRemove = (l) => {
    tapLight();
    remove(l.id);
    clearTimeout(undoTimer.current);
    setUndo({ product: l.product, qty: l.qty });
    undoTimer.current = setTimeout(() => setUndo(null), 4200);
  };
  const doUndo = () => { if (undo?.product) { add(undo.product, undo.qty); } setUndo(null); clearTimeout(undoTimer.current); };

  const total = items.reduce((sum, it) => { const l = lineOf(it); return sum + l.price * l.qty; }, 0);
  const totalNoDisc = items.reduce((sum, it) => { const l = lineOf(it); return sum + l.orig * l.qty; }, 0);
  const savings = totalNoDisc - total;
  // Categories of what's in the cart → drives "similar" recommended picks.
  const cartCatIds = [...new Set(items.flatMap((it) => { const p = it.product || {}; return [p.category_id, ...(p.category_ids || [])].filter(Boolean); }))];

  /* ---- loading skeleton ---- */
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 12 }}>
        <SkeletonBlock height={30} width="45%" radius={8} style={{ marginBottom: 14 }} />
        {[0, 1, 2].map((i) => <SkeletonBlock key={i} height={112} radius={radius.md} style={{ marginBottom: 10 }} />)}
        <SkeletonBlock height={200} radius={radius.lg} style={{ marginTop: 6 }} />
      </View>
    );
  }

  /* ---- empty state ---- */
  if (!items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header navigation={navigation} />
        <View style={styles.emptyWrap} testID="empty-cart">
          <FloatingEmpty />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Looks like you haven't added anything to your cart yet.</Text>
          <ShimmerCTA label="Start Shopping" onPress={() => navigation.navigate('Shop')} testID="continue-shopping-button" style={{ width: 230, marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="cart-page">
      {/* Fixed top bar */}
      <Header navigation={navigation} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
        refreshControl={brandRefresh(refreshing, onRefresh)}
        onScroll={onPageScroll}
        scrollEventThrottle={16}
      >
        {/* Cart items */}
        <View style={{ paddingHorizontal: 12 }} testID="cart-items">
          {items.map((it, i) => (
            <CartRow key={`${lineOf(it).id}-${it.selected_color || 'd'}-${i}`} item={it} index={i}
              onDec={(l) => updateQty(l.id, l.qty - 1)} onInc={(l) => updateQty(l.id, l.qty + 1)} onRemove={doRemove} />
          ))}
        </View>

        {/* Order Summary card */}
        <Animated.View entering={FadeInDown.delay(120)} style={styles.summaryCard} testID="cart-summary">
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.summaryHead}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <Text style={styles.summaryCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
          </LinearGradient>
          <View style={{ padding: 16 }}>
            {items.map((it, i) => { const l = lineOf(it); return (
              <View key={i} style={styles.sumItem} testID="cart-summary-item">
                {l.image ? <Image source={{ uri: img(l.image) }} style={styles.sumImg} /> : <View style={[styles.sumImg, styles.imgFallback]}><Ionicons name="image-outline" size={14} color={colors.textMuted} /></View>}
                <View style={{ flex: 1 }}><Text style={styles.sumName} numberOfLines={1}>{l.name}</Text><Text style={styles.sumQty}>x{l.qty}</Text></View>
                <Text style={styles.sumPrice}>{money(l.price * l.qty)}</Text>
              </View>
            ); })}

            <View style={styles.sumDivider} />
            {savings > 0 ? (
              <>
                <View style={styles.sumRow}><Text style={styles.sumMuted}>Original Total</Text><Text style={[styles.sumMuted, styles.strike]} testID="cart-total-no-discount">{money(totalNoDisc)}</Text></View>
                <View style={styles.sumRow}><Text style={styles.sumSaveLabel}>You Save</Text><AnimatedMoney value={savings} style={styles.sumSave} format={(v) => `-$${Number(v).toFixed(2)}`} testID="cart-savings" /></View>
              </>
            ) : null}
            <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><AnimatedMoney value={total} style={styles.sumSubtotal} testID="cart-subtotal" /></View>
            <View style={styles.sumRow}><Text style={styles.sumMuted}>Delivery</Text><Text style={styles.sumDeliveryNote} testID="cart-delivery-note">At checkout</Text></View>

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total</Text>
              <AnimatedMoney value={total} style={styles.grandValue} testID="cart-total" />
            </View>

            {isLoggedIn && loyalty && loyalty.points_balance > 0 ? (
              <View style={styles.loyalty} testID="cart-loyalty-balance">
                <View style={styles.loyaltyIcon}><Ionicons name="gift" size={16} color="#b45309" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loyaltyLabel}>Your loyalty points</Text>
                  <Text style={styles.loyaltyValue}>{loyalty.points_balance.toLocaleString()} pts{typeof loyalty.redeem_value === 'number' ? <Text style={styles.loyaltyWorth}> · worth {money(loyalty.redeem_value)}</Text> : null}</Text>
                </View>
                <Text style={styles.loyaltyRedeem}>Redeem at checkout</Text>
              </View>
            ) : null}

            {firstBonus ? (
              <View style={styles.firstBonus} testID="first-purchase-bonus-banner">
                <Ionicons name="sparkles" size={16} color="#059669" />
                <View style={{ flex: 1 }}><Text style={styles.firstBonusTitle}>First Order Bonus!</Text><Text style={styles.firstBonusSub}>Earn +{firstBonus} bonus points on your first purchase!</Text></View>
              </View>
            ) : null}

            <View style={[styles.trustRow, { marginTop: 14 }]}>
              <View style={styles.trust}><Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} /><Text style={styles.trustText}>Secure</Text></View>
              <View style={styles.trust}><Ionicons name="car-outline" size={12} color={colors.textMuted} /><Text style={styles.trustText}>Fast Delivery</Text></View>
            </View>
          </View>
        </Animated.View>

        {/* End-of-page promos */}
        <CheckoutPromos excludeIds={items.map((i) => lineOf(i).id).filter(Boolean)} categoryIds={cartCatIds} testIdKey="cart" nearEndSignal={nearEnd} />
      </ScrollView>

      {/* Sticky collapsed summary pill (morphs from the full card above) */}
      <View style={[styles.stickyBar, { bottom: insets.bottom + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyLabel}>Total · {items.length} item{items.length !== 1 ? 's' : ''}</Text>
          <AnimatedMoney value={total} style={styles.stickyTotal} />
        </View>
        <ShimmerCTA label="Checkout" onPress={() => navigation.navigate('Checkout')} style={{ width: 160 }} />
      </View>

      {/* Undo snackbar */}
      {undo ? (
        <Animated.View entering={FadeInDown} style={[styles.snackbar, { bottom: insets.bottom + 84 }]}>
          <Ionicons name="trash-outline" size={15} color={colors.white} />
          <Text style={styles.snackText}>Item removed</Text>
          <TouchableOpacity onPress={doUndo}><Text style={styles.snackUndo}>UNDO</Text></TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Header({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity testID="cart-back-btn" onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.title} testID="cart-page-title">Cart</Text>
      <View style={{ width: 34 }} />
    </View>
  );
}

/* Gently floating empty-cart illustration. */
function FloatingEmpty() {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withRepeat(withSequence(withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1, false); }, []); // eslint-disable-line
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={style}>
      <LinearGradient colors={[colors.p100, colors.s100]} style={styles.emptyCircle}><Ionicons name="cart-outline" size={44} color={colors.violet} /></LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  cardGift: { borderColor: '#fbcfe8' },
  row: { flexDirection: 'row', gap: 12 },
  img: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  imgFallback: { alignItems: 'center', justifyContent: 'center' },
  discBadge: { position: 'absolute', top: -5, left: -5, backgroundColor: colors.sale, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  discText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 9 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  trash: { padding: 2 },
  variantWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  variant: { backgroundColor: colors.p50, borderWidth: 1, borderColor: colors.p100, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill },
  variantText: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.violet },
  saleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1.5, marginTop: 4 },
  saleText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#c2410c' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shop: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  price: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  strike: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 2 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, minWidth: 30, textAlign: 'center' },
  lineTotal: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  lineSave: { fontFamily: fonts.medium, fontSize: 10, color: '#059669', marginTop: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: '#fbcfe8' },
  giftImg: { width: 30, height: 30, borderRadius: 8 },
  giftTitle: { fontFamily: fonts.extrabold, fontSize: 9.5, color: '#db2777', letterSpacing: 0.5 },
  giftSub: { fontFamily: fonts.body, fontSize: 9.5, color: '#ec4899' },
  giftPrice: { fontFamily: fonts.bold, fontSize: 12, color: '#ec4899' },
  deliveryNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  deliveryText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  swipeDelete: { backgroundColor: colors.sale, justifyContent: 'center', alignItems: 'center', width: 92, marginBottom: 10, borderRadius: radius.lg, gap: 3 },
  swipeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },

  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.xl, marginHorizontal: 12, marginTop: 8, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  summaryTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  summaryCount: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 12 },
  sumItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sumImg: { width: 38, height: 38, borderRadius: 9, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight },
  sumName: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  sumQty: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  sumPrice: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  sumDivider: { height: 1, borderTopWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: 10 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  sumMuted: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  sumLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  sumSubtotal: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  sumSaveLabel: { fontFamily: fonts.semibold, fontSize: 12, color: '#059669' },
  sumSave: { fontFamily: fonts.bold, fontSize: 12, color: '#059669' },
  sumDeliveryNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderColor: colors.borderLight },
  grandLabel: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  grandValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.violet },
  loyalty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 10, marginTop: 14 },
  loyaltyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  loyaltyLabel: { fontFamily: fonts.body, fontSize: 11, color: '#b45309' },
  loyaltyValue: { fontFamily: fonts.bold, fontSize: 13, color: '#92400e', marginTop: 1 },
  loyaltyWorth: { fontFamily: fonts.medium, color: '#047857' },
  loyaltyRedeem: { fontFamily: fonts.medium, fontSize: 9.5, color: '#d97706' },
  firstBonus: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 10, marginTop: 12 },
  firstBonusTitle: { fontFamily: fonts.bold, fontSize: 12, color: '#065f46' },
  firstBonusSub: { fontFamily: fonts.body, fontSize: 10.5, color: '#059669' },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.borderLight },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md, overflow: 'hidden', ...shadow.violetGlow },
  ctaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 90 },

  stickyBar: { position: 'absolute', left: 12, right: 12, bottom: TAB_SPACE - 22, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 16, paddingVertical: 10, ...shadow.dropdown },
  stickyLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  stickyTotal: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.violet },

  snackbar: { position: 'absolute', left: 16, right: 16, bottom: TAB_SPACE + 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12, ...shadow.dropdown },
  snackText: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  snackUndo: { color: colors.p300, fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 0.5 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyCircle: { width: 96, height: 96, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, maxWidth: 300 },
});
