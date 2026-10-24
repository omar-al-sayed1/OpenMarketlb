import React, { useState, useEffect, useRef, useCallback } from 'react';
import useKeyboardHeight from '../lib/useKeyboardHeight';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, Platform, Linking, ActivityIndicator, Keyboard } from 'react-native';
import { Alert } from '../components/AppDialog';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { tapLight } from '../lib/haptics';
import AnimatedMoney from '../components/AnimatedMoney';
import CheckoutPromos from '../components/CheckoutPromos';
import BottomSheet from '../components/BottomSheet';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';
import { Input } from '../components/ui';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const STEPS = ['Details', 'Address', 'Payment'];
const DEFAULT_REGION = { latitude: 33.8938, longitude: 35.5018, latitudeDelta: 0.4, longitudeDelta: 0.4 };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Per-item pricing (variants → discount → base) matching the web. */
function lineOf(item) {
  const p = item.product || {};
  const sc = item.selected_color, ss = item.selected_size, sh = item.selected_shape;
  const cv = sc && p.colors ? p.colors.find((c) => c.color_name === sc) : null;
  const sv = ss && p.sizes ? p.sizes.find((x) => x.size_name === ss) : null;
  const shv = sh && p.shapes ? p.shapes.find((x) => x.shape_name === sh) : null;
  const price = (cv?.discount_price || cv?.price || sv?.discount_price || sv?.price || shv?.discount_price || shv?.price || null) || p.discount_price || p.price || 0;
  const orig = (cv?.price || sv?.price || shv?.price || null) || p.price || 0;
  const hasDiscount = orig > price;
  return {
    id: p.id, name: p.name || 'Item', price, orig, hasDiscount, qty: item.quantity || 1,
    image: cv?.image_url || shv?.image_url || sv?.image_url || p.images?.[0] || null,
    variantLabels: [sc && `Color: ${sc}`, ss && `Size: ${ss}`, sh && `Shape: ${sh}`].filter(Boolean),
    saleTitle: p.shop_sale_title, saleDiscount: p.shop_sale_discount, gift: item.has_free_gift, giftImage: item.gift_image,
  };
}

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { user, isLoggedIn } = useAuth();
  const { items, refresh } = useCart();

  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: '', address: '', city: '', state: '', zip: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [editShip, setEditShip] = useState(!isLoggedIn);
  const [loc, setLoc] = useState(null);
  const [payment, setPayment] = useState('cod');
  const [states, setStates] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  const [stateLocked, setStateLocked] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [settings, setSettings] = useState({ card_payment_enabled: true, otp_verification_enabled: true, available_delivery: true });
  const [firstBonus, setFirstBonus] = useState(null);
  const [nearEnd, setNearEnd] = useState(0); // bumps as the page nears the bottom → reveals more recommended cards
  const nearAt = useRef(0);

  // Throttled to ~2×/sec so scrolling near the bottom doesn't re-render on every frame.
  const onPageScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 700) {
      const now = Date.now();
      if (now - nearAt.current > 500) { nearAt.current = now; setNearEnd((n) => n + 1); }
    }
  };

  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [stateSheet, setStateSheet] = useState(false);
  const [redeemSheet, setRedeemSheet] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const [tosText, setTosText] = useState('');
  const [tosChecked, setTosChecked] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [locationRequired, setLocationRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false); // final order-details + points popup

  /* ---- data ---- */
  useEffect(() => {
    api.states.getAll().then(({ data }) => setStates(Array.isArray(data) ? data : data?.states || [])).catch(() => {});
    api.admin.getPlatformSettings().then(({ data }) => setSettings((s) => ({ ...s, ...(data || {}) }))).catch(() => {});
    if (isLoggedIn) {
      api.auth.me().then(({ data }) => { if (data) setF((p) => ({ ...p, name: data.name || p.name, email: data.email || p.email, phone: data.phone || p.phone })); }).catch(() => {});
      api.users.getWalletInfo().then(({ data }) => setWalletInfo(data)).catch(() => {});
      api.savedLocations.getAll().then(({ data }) => setSavedLocations(Array.isArray(data) ? data : data?.locations || [])).catch(() => {});
      api.loyalty.getStatus().then(({ data }) => { if (data?.enabled) setLoyalty(data); }).catch(() => {});
      Promise.allSettled([api.orders.getAll(), api.admin.getPlatformSettings()]).then(([o, s]) => {
        const orders = o.status === 'fulfilled' ? (o.value.data || []) : [];
        const st = s.status === 'fulfilled' ? (s.value.data || {}) : {};
        if ((Array.isArray(orders) ? orders.length : 0) === 0 && st.first_purchase_bonus_enabled) setFirstBonus(st.first_purchase_bonus_points || 100);
      });
    }
  }, [isLoggedIn]);

  /* ---- totals ---- */
  const total = items.reduce((s, it) => { const l = lineOf(it); return s + l.price * l.qty; }, 0);
  const totalNoDisc = items.reduce((s, it) => { const l = lineOf(it); return s + l.orig * l.qty; }, 0);
  const savings = totalNoDisc - total;
  const deliveryFee = settings.available_delivery === false ? 0 : (states.find((st) => st.name === f.state)?.delivery_fee || 0);
  const grandTotal = Math.max(0, total + deliveryFee - loyaltyDiscount);

  /* ---- loyalty points this order would earn ---- */
  const ppd = Number(settings.points_per_dollar ?? loyalty?.points_per_dollar ?? 0);
  const loyaltyOn = settings.loyalty_enabled !== false && (loyalty?.enabled || ppd > 0);
  const pointsEarned = (ppd > 0 ? Math.floor(ppd * grandTotal) : 0) + (firstBonus || 0);

  const done = [!!(f.name && (isLoggedIn || f.email) && f.phone), !!(f.address && f.state), !!payment];

  /* ---- saved location select (fills fields + locks state) ---- */
  const pickSaved = (locn) => {
    tapLight();
    setF((p) => ({ ...p, address: locn.address || p.address, city: locn.city || p.city, state: locn.state || p.state, zip: locn.zip || p.zip }));
    if (locn.latitude && locn.longitude) setLoc({ lat: locn.latitude, lng: locn.longitude });
    if (locn.state) setStateLocked(true);
    setLocationRequired(false);
  };

  /* ---- loyalty redeem ---- */
  const applyRedeem = async (pts) => {
    if (!pts) { setPointsToRedeem(0); setLoyaltyDiscount(0); return; }
    try {
      const { data } = await api.loyalty.redeemPreview(pts, total);
      setPointsToRedeem(pts);
      setLoyaltyDiscount(Number(data?.discount || data?.redeem_value || 0));
      setRedeemSheet(false);
    } catch (_) { Alert.alert('Could not apply points'); }
  };
  const removeRedeem = () => { setPointsToRedeem(0); setLoyaltyDiscount(0); };

  /* ---- place order flow: validate → (OTP) → ToS → create ---- */
  const requiresOtp = !isLoggedIn && settings.otp_verification_enabled !== false;

  const onPlacePress = () => {
    if (!done[0]) return Alert.alert('Missing details', 'Enter your name, email and phone.');
    if (!done[1]) { setLocationRequired(true); return Alert.alert('Delivery location required', 'Add your address and pick a delivery region.'); }
    if (requiresOtp && !phoneVerified) { sendOtp(); setOtpOpen(true); return; }
    openTos();
  };
  const fullGuestPhone = () => `+961${(f.phone || '').replace(/\D/g, '').replace(/^0/, '')}`;
  const sendOtp = async () => { try { await api.otp.send(fullGuestPhone()); } catch (_) {} };
  const onVerified = () => { setPhoneVerified(true); setOtpOpen(false); openTos(); };
  const openTos = async () => { try { const { data } = await api.tos.get(); setTosText(data?.content || data?.tos || ''); } catch (_) {} setTosChecked(false); setTosOpen(true); };

  const placeOrder = async () => {
    setTosOpen(false); setConfirmOpen(false); setBusy(true);
    try {
      const orderData = {
        guest_name: isLoggedIn ? undefined : f.name,
        guest_email: isLoggedIn ? undefined : f.email,
        guest_phone: isLoggedIn ? undefined : fullGuestPhone(),
        user_phone: isLoggedIn ? f.phone : undefined,
        shipping_address: { address: f.address, city: f.city, state: f.state, zip: f.zip },
        payment_method: payment,
        loyalty_points_to_redeem: isLoggedIn && pointsToRedeem > 0 ? pointsToRedeem : 0,
        customer_location: loc || undefined,
      };
      const { data } = await api.orders.create(orderData);
      const order = data?.order || data;
      if (payment === 'card') {
        const { data: pay } = await api.payment.createCheckout(order.id || order.order_id, 'https://openmarketlb.com');
        const url = pay?.url || pay?.checkout_url || pay?.session_url;
        if (url) { Linking.openURL(url); setBusy(false); Alert.alert('Complete payment', 'Finish your card payment in the browser, then return to the app.'); return; }
      }
      await refresh();
      navigation.replace('OrderSuccess', { orderId: order.id || order.order_id, order });
    } catch (e) {
      Alert.alert('Order failed', e?.response?.data?.detail || 'Could not place the order. Please try again.');
    } finally { setBusy(false); }
  };

  const excludeIds = items.map((i) => lineOf(i).id).filter(Boolean);
  const cartCatIds = [...new Set(items.flatMap((i) => { const p = i.product || {}; return [p.category_id, ...(p.category_ids || [])].filter(Boolean); }))];
  const paymentOpts = [
    { key: 'cod', label: 'Cash on Delivery', icon: 'cash-outline', desc: 'Pay when your order arrives', testID: 'payment-cod-radio' },
    // Shown when the admin enables it, but not yet selectable — card checkout isn't live.
    ...(settings.card_payment_enabled !== false ? [{ key: 'card', label: 'Card Payment', icon: 'card-outline', desc: 'Not available yet', soon: true, testID: 'payment-card-radio' }] : []),
    ...(isLoggedIn && walletInfo ? [{ key: 'wallet', label: 'Wallet', icon: 'wallet-outline', desc: `Balance ${money(walletInfo.balance)}`, testID: 'payment-wallet-radio', insufficient: (walletInfo.balance || 0) < grandTotal }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="checkout-page">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity testID="checkout-back-btn" onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="chevron-back" size={18} color={colors.textSecondary} /></TouchableOpacity>
        <Text style={styles.title} testID="checkout-page-title">Checkout</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: (insets.bottom || 12) + 96 }} keyboardShouldPersistTaps="handled" onScroll={onPageScroll} scrollEventThrottle={16}>
        <StepIndicator done={done} />

        {/* Identity */}
        {isLoggedIn ? (
          <Section delay={0} icon="person-outline" title="Your details" testID="user-info-summary"
            right={<TouchableOpacity testID="edit-shipping-btn" onPress={() => setEditShip((v) => !v)}><Text style={styles.editLink}>{editShip ? 'Done' : 'Edit'}</Text></TouchableOpacity>}>
            <View style={styles.summaryLine}><Ionicons name="person" size={13} color={colors.textMuted} /><Text style={styles.summaryVal} testID="user-summary-name">{f.name || '—'}</Text></View>
            <View style={styles.summaryLine}><Ionicons name="mail" size={13} color={colors.textMuted} /><Text style={styles.summaryVal} testID="user-summary-email">{f.email || '—'}</Text></View>
            <View style={styles.summaryLine}><Ionicons name="call" size={13} color={colors.textMuted} /><Text style={styles.summaryVal} testID="user-summary-phone">{f.phone || '—'}</Text></View>
          </Section>
        ) : (
          <Section delay={0} icon="person-outline" title="Contact details" testID="guest-info-section">
            <Field placeholder="Full name" value={f.name} onChangeText={(v) => set('name', v)} valid={!!f.name} testID="guest-name-input" />
            <Field placeholder="Email address" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" valid={/.+@.+\..+/.test(f.email)} testID="guest-email-input" />
            <Field placeholder="Phone number" value={f.phone} onChangeText={(v) => { set('phone', v); setPhoneVerified(false); }} keyboardType="phone-pad" prefix="+961" valid={f.phone.replace(/\D/g, '').length >= 7} testID="guest-phone-input" />
            {loyalty || settings.loyalty_enabled ? (
              <View style={styles.recommend} testID="guest-loyalty-recommendation">
                <Ionicons name="gift" size={15} color="#b45309" />
                <Text style={styles.recommendText}>Sign in to earn & redeem loyalty points on this order.</Text>
              </View>
            ) : null}
          </Section>
        )}

        {/* Saved locations */}
        {isLoggedIn && savedLocations.length > 0 ? (
          <Section delay={40} icon="bookmark-outline" title="Saved locations" testID="saved-locations">
            {savedLocations.slice(0, 4).map((locn, i) => (
              <TouchableOpacity key={i} style={styles.savedRow} onPress={() => pickSaved(locn)}>
                <Ionicons name="location" size={15} color={colors.violet} />
                <View style={{ flex: 1 }}><Text style={styles.savedName} numberOfLines={1}>{locn.label || locn.name || 'Saved location'}</Text><Text style={styles.savedAddr} numberOfLines={1}>{[locn.address, locn.city, locn.state].filter(Boolean).join(', ')}</Text></View>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Section>
        ) : null}

        {/* Shipping address */}
        {(editShip || !isLoggedIn) ? (
          <ShakeSection delay={80} icon="location-outline" title="Delivery address" testID="shipping-address-section" shake={locationRequired}>
            {/* Pin a location first — required; it auto-fills the address fields below and locks the region */}
            <View style={styles.locReqLabel}>
              <Ionicons name="alert-circle" size={11} color={colors.sale} />
              <Text style={styles.locReqLabelText}>REQUIRED</Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} style={[styles.locBtn, loc && styles.locBtnDone]} onPress={() => setPickerOpen(true)} testID="pin-location-btn">
              <LinearGradient colors={loc ? [colors.seller, '#0d9488'] : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.locBtnTile}>
                <Ionicons name={loc ? 'checkmark' : 'navigate'} size={17} color={colors.white} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.locBtnTitle} numberOfLines={1}>{loc ? 'Location pinned' : 'Pin your location on the map'}</Text>
                <Text style={styles.locBtnSub} numberOfLines={1}>{loc ? 'Tap to change your pin' : 'Auto-fills your delivery address'}</Text>
              </View>
              <Ionicons name={loc ? 'create-outline' : 'chevron-forward'} size={18} color={loc ? colors.sellerSoftText : colors.primarySoftText} />
            </TouchableOpacity>
            <Field placeholder="Street address" value={f.address} onChangeText={(v) => { set('address', v); setLocationRequired(false); }} valid={!!f.address} testID={isLoggedIn ? 'user-address-input' : 'address-input'} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field placeholder="City" value={f.city} onChangeText={(v) => set('city', v)} style={{ flex: 1 }} testID={isLoggedIn ? 'user-city-input' : 'city-input'} />
              <Field placeholder="ZIP" value={f.zip} onChangeText={(v) => set('zip', v)} keyboardType="number-pad" style={{ flex: 1 }} testID={isLoggedIn ? 'user-zip-input' : 'zip-input'} />
            </View>
            <TouchableOpacity testID={isLoggedIn ? 'user-state-select' : 'checkout-state-select'} disabled={stateLocked} style={[styles.select, stateLocked && { opacity: 0.7 }]} onPress={() => setStateSheet(true)}>
              <Ionicons name="map-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.selectText, !f.state && { color: colors.textMuted }]}>{f.state || 'Select delivery region'}</Text>
              {!stateLocked ? <Ionicons name="chevron-down" size={15} color={colors.textMuted} /> : <Ionicons name="lock-closed" size={13} color={colors.seller} />}
            </TouchableOpacity>
            {stateLocked ? <View style={styles.lockHint} testID={isLoggedIn ? 'user-state-locked-hint' : 'checkout-state-locked-hint'}><Ionicons name="checkmark-circle" size={12} color={colors.seller} /><Text style={styles.lockHintText}>Region set from your pinned location</Text></View> : null}
            {locationRequired ? <View style={styles.locReq} testID="location-required-msg"><Ionicons name="alert-circle" size={12} color={colors.red} /><Text style={styles.locReqText}>Please add your delivery location</Text></View> : null}
          </ShakeSection>
        ) : null}

        {/* Loyalty redeem */}
        {isLoggedIn && loyalty && loyalty.points_balance > 0 ? (
          <Section delay={120} icon="gift-outline" title="Loyalty points" testID="loyalty-redeem-section">
            {loyaltyDiscount > 0 ? (
              <View style={styles.redeemApplied} testID="loyalty-applied-preview">
                <Ionicons name="checkmark-circle" size={18} color="#b45309" />
                <View style={{ flex: 1 }}><Text style={styles.redeemAppliedTitle}>{pointsToRedeem.toLocaleString()} pts applied</Text><Text style={styles.redeemAppliedSub}>Discount on this order</Text></View>
                <AnimatedMoney value={loyaltyDiscount} style={styles.redeemDiscount} format={(v) => `-$${Number(v).toFixed(2)}`} testID="loyalty-discount" />
                <TouchableOpacity testID="loyalty-remove-btn" onPress={removeRedeem} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity testID="loyalty-redeem-select" style={styles.select} onPress={() => setRedeemSheet(true)}>
                  <Ionicons name="star" size={15} color={colors.amber} />
                  <Text style={styles.selectText}>Redeem points ({loyalty.points_balance.toLocaleString()} available)</Text>
                  <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </Section>
        ) : null}

        {/* Payment */}
        <Section delay={160} icon="card-outline" title="Payment method" testID="payment-method-section">
          <View testID="payment-method-group">
            {paymentOpts.map((p) => (
              <PayCard key={p.key} opt={p} selected={payment === p.key} onSelect={() => !p.insufficient && setPayment(p.key)} />
            ))}
          </View>
        </Section>

        {/* Order summary */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.summaryCard} testID="order-summary">
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.summaryHead}>
            <Text style={styles.summaryHeadText}>Order Summary</Text><Text style={styles.summaryCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
          </LinearGradient>
          <View style={{ padding: 16 }}>
            {items.map((it, i) => { const l = lineOf(it); return (
              <View key={i} style={styles.sumItem} testID="summary-item">
                <View style={{ flex: 1 }}>
                  <Text style={styles.sumName} numberOfLines={1}>{l.name} <Text style={styles.sumQty}>x{l.qty}</Text></Text>
                  {l.variantLabels.length ? <Text style={styles.sumVariant} numberOfLines={1}>{l.variantLabels.join(' · ')}</Text> : null}
                  {l.saleDiscount ? <View style={styles.sumSale} testID="checkout-sale-badge"><Text style={styles.sumSaleText}>{l.saleTitle || `${l.saleDiscount}% OFF`}</Text></View> : null}
                  {l.gift ? <View style={styles.sumGift} testID="checkout-gift-badge"><Ionicons name="gift" size={10} color="#db2777" /><Text style={styles.sumGiftText}>Free gift included</Text></View> : null}
                </View>
                <Text style={styles.sumPrice}>{money(l.price * l.qty)}</Text>
              </View>
            ); })}
            <View style={styles.divider} />
            {savings > 0 ? (
              <>
                <View style={styles.row}><Text style={styles.muted}>Original</Text><Text style={[styles.muted, styles.strike]} testID="checkout-total-no-discount">{money(totalNoDisc)}</Text></View>
                <View style={styles.row}><Text style={styles.saveLabel}>You Save</Text><AnimatedMoney value={savings} style={styles.saveVal} format={(v) => `-$${Number(v).toFixed(2)}`} testID="checkout-savings" /></View>
              </>
            ) : null}
            <View style={styles.row}><Text style={styles.rowLabel}>Subtotal</Text><AnimatedMoney value={total} style={styles.rowVal} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Delivery{f.state ? ` · ${f.state}` : ''}</Text>{f.state ? <AnimatedMoney value={deliveryFee} style={styles.rowVal} format={(v) => (v > 0 ? `$${Number(v).toFixed(2)}` : 'Free')} /> : <Text style={styles.muted}>Select region</Text>}</View>
            {loyaltyDiscount > 0 ? <View style={styles.row}><Text style={styles.saveLabel}>Loyalty</Text><AnimatedMoney value={loyaltyDiscount} style={styles.saveVal} format={(v) => `-$${Number(v).toFixed(2)}`} /></View> : null}
            <View style={styles.grandRow}><Text style={styles.grandLabel}>Total</Text><AnimatedMoney value={grandTotal} style={styles.grandVal} testID="checkout-total" /></View>
            {firstBonus ? <View style={styles.firstBonus} testID="first-purchase-bonus-checkout"><Ionicons name="sparkles" size={15} color="#059669" /><Text style={styles.firstBonusText}>Earn +{firstBonus} bonus points on your first order!</Text></View> : null}
          </View>
        </Animated.View>

        {/* End sections */}
        <CheckoutPromos excludeIds={excludeIds} categoryIds={cartCatIds} testIdKey="checkout" nearEndSignal={nearEnd} />
      </ScrollView>

      {/* Sticky place-order bar */}
      <View style={[styles.bottom, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={{ flex: 1 }}><Text style={styles.bottomLabel}>Total</Text><AnimatedMoney value={grandTotal} style={styles.bottomTotal} /></View>
        <PlaceOrderButton busy={busy} onPress={onPlacePress} />
      </View>

      {/* Location picker */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <LocationPicker onClose={() => setPickerOpen(false)} onConfirm={(coord, addr) => {
          setLoc(coord);
          if (addr) {
            // Match the geocoded region to a known delivery region (exact, then fuzzy).
            const geo = addr.state ? String(addr.state).toLowerCase() : '';
            const matched = geo
              ? (states.find((st) => st.name.toLowerCase() === geo)
                 || states.find((st) => geo.includes(st.name.toLowerCase()) || st.name.toLowerCase().includes(geo)))
              : null;
            // Auto-fill every address input from the pinned location (geocoded value wins).
            setF((p) => ({
              ...p,
              address: addr.address || p.address,
              city: addr.city || p.city,
              zip: addr.zip || p.zip,
              state: matched ? matched.name : p.state,
            }));
            setStateLocked(!!matched); // region comes from the pin → not changeable
          }
          setLocationRequired(false); setPickerOpen(false);
        }} />
      </Modal>

      {/* State picker */}
      <BottomSheet visible={stateSheet} onClose={() => setStateSheet(false)} maxHeight="70%">
        <Text style={styles.sheetTitle}>Select delivery region</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 6 }}>
          {states.map((st) => (
            <TouchableOpacity key={st.id || st.name} style={styles.sheetRow} onPress={() => { set('state', st.name); setStateSheet(false); }}>
              <Text style={[styles.sheetRowText, f.state === st.name && { color: colors.violet, fontFamily: fonts.bold }]}>{st.name}</Text>
              <Text style={styles.sheetRowFee}>{st.delivery_fee > 0 ? money(st.delivery_fee) : 'Free'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Loyalty redeem picker */}
      <BottomSheet visible={redeemSheet} onClose={() => setRedeemSheet(false)} maxHeight="60%">
        <Text style={styles.sheetTitle}>Redeem loyalty points</Text>
        <Text style={styles.sheetSub}>You have {loyalty?.points_balance?.toLocaleString?.() || 0} points</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {[loyalty?.points_balance, Math.floor((loyalty?.points_balance || 0) / 2), 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((pts) => (
            <TouchableOpacity key={pts} style={styles.redeemOpt} onPress={() => applyRedeem(pts)}>
              <Ionicons name="star" size={16} color={colors.amber} /><Text style={styles.redeemOptText}>Redeem {pts.toLocaleString()} points</Text><Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      {/* OTP dialog */}
      <BottomSheet visible={otpOpen} onClose={() => setOtpOpen(false)} maxHeight="70%">
        <OtpDialog phone={fullGuestPhone()} onResend={sendOtp} onVerify={async (code) => { await api.otp.verify(fullGuestPhone(), code); }} onVerified={onVerified} />
      </BottomSheet>

      {/* ToS dialog */}
      <BottomSheet visible={tosOpen} onClose={() => setTosOpen(false)} maxHeight="80%">
        <Text style={styles.sheetTitle}>Terms of Service</Text>
        <ScrollView style={{ maxHeight: 280, marginTop: 8 }} showsVerticalScrollIndicator={false}><Text style={styles.tosText}>{tosText || 'By placing this order you agree to our terms of service and buyer protection policy.'}</Text></ScrollView>
        <TouchableOpacity testID="tos-checkbox" style={styles.tosCheck} onPress={() => setTosChecked((v) => !v)}>
          <View style={[styles.checkbox, tosChecked && styles.checkboxOn]}>{tosChecked && <Ionicons name="checkmark" size={13} color={colors.white} />}</View>
          <Text style={styles.tosCheckText}>I agree to the Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tos-continue" disabled={!tosChecked} style={{ opacity: tosChecked ? 1 : 0.5, marginTop: 12 }} onPress={() => { setTosOpen(false); setConfirmOpen(true); }}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tosBtn}>
            <Ionicons name="arrow-forward" size={17} color={colors.white} /><Text style={styles.tosBtnText}>Review Order · {money(grandTotal)}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </BottomSheet>

      {/* Final confirmation — order details + points earned (or login-to-earn prompt) */}
      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} maxHeight="82%">
        <Text style={styles.sheetTitle}>Confirm your order</Text>
        <View style={styles.confirmSummary}>
          <View style={styles.confirmRow}><Text style={styles.confirmKey}>{items.length} item{items.length === 1 ? '' : 's'}</Text><Text style={styles.confirmVal}>{money(total)}</Text></View>
          {savings > 0 ? <View style={styles.confirmRow}><Text style={[styles.confirmKey, { color: '#059669' }]}>Discounts</Text><Text style={[styles.confirmVal, { color: '#059669' }]}>-{money(savings)}</Text></View> : null}
          {settings.available_delivery !== false ? <View style={styles.confirmRow}><Text style={styles.confirmKey}>Delivery</Text><Text style={styles.confirmVal}>{deliveryFee > 0 ? money(deliveryFee) : 'Free'}</Text></View> : null}
          {loyaltyDiscount > 0 ? <View style={styles.confirmRow}><Text style={[styles.confirmKey, { color: '#d97706' }]}>Points redeemed</Text><Text style={[styles.confirmVal, { color: '#d97706' }]}>-{money(loyaltyDiscount)}</Text></View> : null}
          <View style={[styles.confirmRow, styles.confirmTotalRow]}><Text style={styles.confirmTotalKey}>Total</Text><Text style={styles.confirmTotalVal}>{money(grandTotal)}</Text></View>
        </View>

        {isLoggedIn && loyaltyOn && pointsEarned > 0 ? (
          <LinearGradient colors={[colors.p50, colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pointsCard} testID="confirm-points-earned">
            <View style={styles.pointsIcon}><Ionicons name="sparkles" size={16} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointsTitle}>You'll earn {pointsEarned.toLocaleString()} points</Text>
              <Text style={styles.pointsSub}>{firstBonus ? `Includes ${firstBonus} first-purchase bonus · ` : ''}Redeem them on future orders</Text>
            </View>
          </LinearGradient>
        ) : !isLoggedIn ? (
          <View style={styles.loginCard} testID="confirm-login-to-earn">
            <View style={[styles.pointsIcon, { backgroundColor: colors.textMuted }]}><Ionicons name="gift-outline" size={16} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointsTitle}>Log in to earn loyalty points</Text>
              <Text style={styles.pointsSub}>Sign in to collect points on this order</Text>
            </View>
            <TouchableOpacity onPress={() => { setConfirmOpen(false); navigation.navigate('Auth'); }} style={styles.loginBtn} testID="confirm-login-btn"><Text style={styles.loginBtnText}>Log in</Text></TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity testID="confirm-place-order" disabled={busy} style={{ opacity: busy ? 0.6 : 1, marginTop: 14 }} onPress={placeOrder}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tosBtn}>
            {busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="bag-check" size={17} color={colors.white} /><Text style={styles.tosBtnText}>Place Order · {money(grandTotal)}</Text></>}
          </LinearGradient>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

/* ---------- progress ---------- */
function StepIndicator({ done }) {
  return (
    <View style={styles.stepper} testID="checkout-progress">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, done[i] && styles.stepCircleDone]}>{done[i] ? <Ionicons name="checkmark" size={15} color={colors.white} /> : <Text style={styles.stepNum}>{i + 1}</Text>}</View>
            <Text style={[styles.stepLabel, done[i] && { color: colors.violet }]}>{label}</Text>
          </View>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, done[i] && { backgroundColor: colors.violet }]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

/* ---------- payment card (springs in when selected) ---------- */
function PayCard({ opt, selected, onSelect }) {
  const off = opt.insufficient || opt.soon; // not selectable: no funds, or not launched yet
  const s = useSharedValue(selected ? 1 : 0);
  useEffect(() => { s.value = withSpring(selected ? 1 : 0, { damping: 15, stiffness: 200 }); }, [selected]); // eslint-disable-line
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.98 + s.value * 0.02 }] }));
  return (
    <Animated.View style={style}>
      <TouchableOpacity testID={opt.testID} activeOpacity={0.85} disabled={off} onPress={onSelect} style={[styles.payCard, selected && styles.payCardOn, off && { opacity: 0.55 }]}>
        <View style={[styles.payIcon, selected && { backgroundColor: colors.violet }]}><Ionicons name={opt.icon} size={18} color={selected ? colors.white : colors.violet} /></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.payLabel}>{opt.label}</Text>
            {opt.soon && <View style={styles.soonPill}><Text style={styles.soonPillText}>coming soon</Text></View>}
          </View>
          <Text style={[styles.payDesc, opt.insufficient && { color: colors.red }]} testID={opt.insufficient ? 'insufficient-funds' : undefined}>{opt.insufficient ? 'Insufficient balance' : opt.desc}</Text>
        </View>
        {!opt.soon && <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ---------- place-order button with charging ring ---------- */
function PlaceOrderButton({ busy, onPress }) {
  const rot = useSharedValue(0);
  useEffect(() => { if (busy) rot.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false); else rot.value = 0; }, [busy]); // eslint-disable-line
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));
  return (
    <TouchableOpacity testID="place-order-button" activeOpacity={0.9} onPress={onPress} disabled={busy} style={{ width: 190 }}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.placeBtn}>
        {busy ? (
          <Animated.View style={ring}>
            <Svg width={26} height={26}><Circle cx={13} cy={13} r={10} stroke="rgba(255,255,255,0.35)" strokeWidth={3} fill="none" /><AnimatedCircle cx={13} cy={13} r={10} stroke={colors.white} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 10 * 0.28} ${2 * Math.PI * 10}`} /></Svg>
          </Animated.View>
        ) : (
          <><Ionicons name="bag-check" size={18} color={colors.white} /><Text style={styles.placeBtnText}>Place Order</Text></>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ---------- OTP dialog ---------- */
function OtpDialog({ phone, onResend, onVerify, onVerified }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(false);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(30);
  const refs = useRef([]);
  const shake = useSharedValue(0);
  useEffect(() => { const t = count > 0 ? setInterval(() => setCount((c) => c - 1), 1000) : null; return () => t && clearInterval(t); }, [count]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...code]; next[i] = d; setCode(next); setError(false);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every((x) => x) && next.join('').length === 6) submit(next.join(''));
  };
  const submit = async (full) => {
    setBusy(true);
    try { await onVerify(full); setOk(true); setTimeout(onVerified, 550); }
    catch (_) { setError(true); shake.value = withSequence(withTiming(-8, { duration: 45 }), withTiming(8, { duration: 45 }), withTiming(-6, { duration: 45 }), withTiming(0, { duration: 45 })); }
    finally { setBusy(false); }
  };
  return (
    <View testID="otp-verification-dialog">
      <Text style={styles.sheetTitle}>Verify your phone</Text>
      <Text style={styles.sheetSub}>Enter the 6-digit code sent to {phone}</Text>
      <Animated.View style={[styles.otpRow, shakeStyle]} testID="dialog-otp-inputs">
        {code.map((d, i) => (
          <TextInput key={i} ref={(el) => (refs.current[i] = el)} value={d} onChangeText={(v) => setDigit(i, v)} keyboardType="number-pad" maxLength={1}
            onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
            style={[styles.otpBox, error && styles.otpBoxError, ok && styles.otpBoxOk]} />
        ))}
      </Animated.View>
      <TouchableOpacity testID="dialog-verify-otp-button" disabled={busy || code.join('').length < 6} style={{ opacity: code.join('').length < 6 ? 0.5 : 1, marginTop: 14 }} onPress={() => submit(code.join(''))}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tosBtn}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.tosBtnText}>Verify</Text>}</LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity testID="dialog-resend-otp-button" disabled={count > 0} onPress={() => { setCount(30); onResend(); }} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={[styles.resend, count > 0 && { color: colors.textMuted }]}>{count > 0 ? `Resend in ${count}s` : 'Resend code'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- shake wrapper ---------- */
function ShakeSection({ shake, ...props }) {
  const x = useSharedValue(0);
  useEffect(() => { if (shake) x.value = withSequence(withTiming(-8, { duration: 45 }), withTiming(8, { duration: 45 }), withTiming(-6, { duration: 45 }), withTiming(0, { duration: 45 })); }, [shake]); // eslint-disable-line
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={style}><Section {...props} /></Animated.View>;
}

/* ---------- location picker ---------- */
function LocationPicker({ onClose, onConfirm }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const mapRef = useRef(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (!query) return;
    Keyboard.dismiss();
    setSearching(true);
    try { const { data } = await api.geocode.search(query); setResults(Array.isArray(data) ? data.slice(0, 6) : []); }
    catch (_) { setResults([]); }
    setSearching(false);
  }, [q]);

  const goTo = useCallback((r) => {
    setResults([]);
    setQ((r.label || '').split(',').slice(0, 2).join(', '));
    const reg = { latitude: r.lat, longitude: r.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 };
    setRegion(reg);
    mapRef.current?.animateToRegion(reg, 550);
    Keyboard.dismiss();
  }, []);

  const confirm = useCallback(async () => {
    setBusy(true);
    const coord = { lat: region.latitude, lng: region.longitude };
    let addr = null;
    try {
      const { data } = await api.geocode.reverse(region.latitude, region.longitude);
      if (data) addr = { address: data.address || data.road || '', city: data.city || data.town || '', state: data.state || data.region || '', zip: data.postcode || data.postal_code || data.zip || '' };
    } catch (_) {
      try { const r = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude }); if (r?.[0]) addr = { address: [r[0].street, r[0].name].filter(Boolean).join(' '), city: r[0].city || r[0].subregion || '', state: r[0].region || '', zip: r[0].postalCode || '' }; } catch (__) {}
    }
    setBusy(false); onConfirm(coord, addr);
  }, [region, onConfirm]);
  const locateMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') return;
      const l = await Location.getCurrentPositionAsync({});
      const reg = { latitude: l.coords.latitude, longitude: l.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setRegion(reg); mapRef.current?.animateToRegion(reg, 550);
    } catch (_) {}
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} initialRegion={DEFAULT_REGION} onRegionChangeComplete={setRegion} />
      <View style={styles.centerPin} pointerEvents="none"><LinearGradient colors={gradients.primary} style={styles.centerPinHead}><Ionicons name="location" size={20} color={colors.white} /></LinearGradient><View style={styles.centerPinStick} /></View>
      <TouchableOpacity style={[styles.pickerClose, { top: insets.top + 8 }]} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></TouchableOpacity>

      {/* Thin search bar — find any location and drop the pin there */}
      <View style={[styles.searchWrap, { top: insets.top + 9 }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Search any location…" placeholderTextColor={colors.textMuted} returnKeyType="search" onSubmitEditing={runSearch} testID="location-search-input" />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : q ? <TouchableOpacity onPress={() => { setQ(''); setResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
      </View>
      {results.length > 0 ? (
        <View style={[styles.searchResults, { top: insets.top + 56 }]}>
          {results.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.searchRow, i === results.length - 1 && { borderBottomWidth: 0 }]} onPress={() => goTo(r)} testID={`location-search-result-${i}`}>
              <Ionicons name="location-outline" size={15} color={colors.violet} />
              <Text style={styles.searchRowText} numberOfLines={2}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <TouchableOpacity style={[styles.pickerLocate, { bottom: 130 }]} onPress={locateMe}><Ionicons name="locate" size={22} color={colors.text} /></TouchableOpacity>
      <View style={[styles.pickerBar, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}><Text style={styles.pickerHint}>Move the map to position the pin on your address</Text>
        <TouchableOpacity onPress={confirm} activeOpacity={0.9}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tosBtn}>{busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="checkmark" size={17} color={colors.white} /><Text style={styles.tosBtnText}>Confirm location</Text></>}</LinearGradient></TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- shared bits ---------- */
function Section({ title, icon, right, children, testID, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.section} testID={testID}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={colors.violet} /><Text style={styles.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />{right}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}
// Delegates to the shared Input (focus glow + prefix + valid ✓); `style` sizes the container.
function Field({ prefix, style, valid, ...props }) {
  return <Input prefix={prefix} valid={valid} containerStyle={style} {...props} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 6, marginBottom: 14 },
  stepItem: { alignItems: 'center', width: 66 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepCircleDone: { backgroundColor: colors.violet, borderColor: colors.violet },
  stepNum: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textMuted, marginTop: 4 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: -16 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  sectionBody: { padding: 14, gap: 10 },
  editLink: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 48 },
  prefix: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  recommend: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 10 },
  recommendText: { flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: '#b45309' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  savedName: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  savedAddr: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  select: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 48 },
  selectText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  lockHint: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockHintText: { fontFamily: fonts.medium, fontSize: 11, color: colors.seller },
  locReq: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locReqText: { fontFamily: fonts.medium, fontSize: 11, color: colors.red },
  locReqLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  locReqLabelText: { fontFamily: fonts.bold, fontSize: 10, color: colors.sale, letterSpacing: 0.8 },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primarySoft, backgroundColor: colors.surface, ...shadow.card },
  locBtnDone: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  locBtnTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locBtnTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  locBtnSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  redeemApplied: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 10 },
  redeemAppliedTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#92400e' },
  redeemAppliedSub: { fontFamily: fonts.body, fontSize: 10.5, color: '#b45309' },
  redeemDiscount: { fontFamily: fonts.extrabold, fontSize: 14, color: '#b45309' },
  redeemOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  redeemOptText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8 },
  payCardOn: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  payIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  payDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  soonPill: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.sm, backgroundColor: colors.secondarySoft },
  soonPillText: { fontFamily: fonts.bold, fontSize: 9, color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.violet },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.violet },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.xl, marginHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  summaryHeadText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16 },
  summaryCount: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 12 },
  sumItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  sumName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  sumQty: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  sumVariant: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.violet700, marginTop: 1 },
  sumSale: { alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  sumSaleText: { fontFamily: fonts.bold, fontSize: 9, color: '#c2410c' },
  sumGift: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: '#fdf2f8', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  sumGiftText: { fontFamily: fonts.semibold, fontSize: 9, color: '#db2777' },
  sumPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  divider: { height: 1, borderTopWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  rowLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  rowVal: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  strike: { textDecorationLine: 'line-through' },
  saveLabel: { fontFamily: fonts.semibold, fontSize: 12, color: '#059669' },
  saveVal: { fontFamily: fonts.bold, fontSize: 12, color: '#059669' },
  grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderColor: colors.borderLight },
  grandLabel: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  grandVal: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.violet },
  firstBonus: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 10, marginTop: 12 },
  firstBonusText: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: '#065f46' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, ...shadow.emphasis },
  bottomLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  bottomTotal: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.violet },
  placeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md, ...shadow.violetGlow },
  placeBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  sheetSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sheetRowText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  sheetRowFee: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 16 },
  otpBox: { flex: 1, height: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink },
  otpBoxError: { borderColor: colors.red, backgroundColor: '#fef2f2' },
  otpBoxOk: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  resend: { fontFamily: fonts.bold, fontSize: 13, color: colors.violet },
  tosText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 19 },
  tosCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  tosCheckText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  tosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md },
  tosBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  confirmSummary: { marginTop: 12, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, gap: 8 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmKey: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  confirmVal: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  confirmTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 1 },
  confirmTotalKey: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  confirmTotalVal: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.p600 },
  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.p100 },
  pointsIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.p500, alignItems: 'center', justifyContent: 'center' },
  pointsTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  pointsSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  loginCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12, padding: 13, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight },
  loginBtn: { backgroundColor: colors.p500, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  loginBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -46, alignItems: 'center' },
  centerPinHead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, ...shadow.violetGlow },
  centerPinStick: { width: 3, height: 14, backgroundColor: colors.indigo, marginTop: -1 },
  pickerClose: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  pickerLocate: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  searchWrap: { position: 'absolute', left: 64, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadow.emphasis },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink, paddingVertical: 0 },
  searchResults: { position: 'absolute', left: 14, right: 16, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.dropdown },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  searchRowText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  pickerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10, ...shadow.dropdown },
  pickerHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
