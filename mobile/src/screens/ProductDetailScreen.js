import React, { useEffect, useState, useRef, useCallback } from 'react';
import useKeyboardHeight from '../lib/useKeyboardHeight';
import { View, Text, Image, ScrollView, FlatList, TouchableOpacity, TextInput, StyleSheet, Modal, Dimensions, Animated, Share, ActivityIndicator } from 'react-native';
import { Alert } from '../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { img } from '../lib/media';
import { tapLight, notifySuccess } from '../lib/haptics';
import { toast } from '../components/shop/ShopKit';
import ProductCard from '../components/ProductCard';
import AnimatedMoney from '../components/AnimatedMoney';
import BottomSheet from '../components/BottomSheet';
import { SkeletonBlock } from '../components/ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const W = Dimensions.get('window').width;
const SH = Dimensions.get('window').height;
const IMG_H = Math.round(W * 1.12);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const collectImages = (p) => {
  const v = [...(p.colors || []).map((c) => c.image_url), ...(p.shapes || []).map((s) => s.image_url), ...(p.sizes || []).map((s) => s.image_url), p.size_variant_image].filter(Boolean);
  return p.images?.length ? p.images : (v.length ? v : []);
};
const vname = (v) => (v == null ? '' : typeof v === 'string' ? v : (v.color_name || v.size_name || v.shape_name || v.name || v.label || ''));

export default function ProductDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { add, count: cartCount } = useCart();
  const { isLoggedIn, user } = useAuth();
  const [product, setProduct] = useState(route.params?.product || null);
  const [loading, setLoading] = useState(!route.params?.product);
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [shape, setShape] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [wished, setWished] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [recs, setRecs] = useState([]);
  const [spRecs, setSpRecs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const mainRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const qPulse = useRef(new Animated.Value(1)).current;
  const heart = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const [flying, setFlying] = useState(false);
  const id = route.params?.id || route.params?.product?.id;

  useEffect(() => {
    if (!product && id) api.products.getById(id).then(({ data }) => setProduct(data?.product || data)).catch(() => {}).finally(() => setLoading(false));
    if (id) api.tracking.view(id).catch(() => {}); // fire once
  }, [id]); // eslint-disable-line

  useEffect(() => { if (product) Animated.timing(enter, { toValue: 1, duration: 650, useNativeDriver: true }).start(); }, [product, enter]);

  useEffect(() => {
    if (!product) return;
    const cat = product.category_id;
    api.products.getAll({ limit: 12, category_id: cat }).then(({ data }) => setRecs((Array.isArray(data) ? data : data?.products || []).filter((p) => p.id !== product.id).slice(0, 10))).catch(() => {});
    api.promotions.getActive({ limit: 12, category_id: cat }).then(({ data }) => setSpRecs((data?.products || []).filter((p) => p.id !== product.id && p.shop_id !== product.shop_id).slice(0, 8))).catch(() => {});
    api.reviews.getByProduct(product.id).then(({ data }) => setReviews(data?.reviews || [])).catch(() => {});
    if (isLoggedIn) api.wishlist.get().then(({ data }) => setWished((data?.products || []).some((p) => p.id === product.id))).catch(() => {});
  }, [product, isLoggedIn]);

  // Arriving from a product card's "add to cart" on a product that HAS variants: prompt the
  // shopper to pick the variant here (the card couldn't add it blindly).
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!product || !route.params?.promptVariant || promptedRef.current) return;
    const types = [
      ...(product.colors?.length > 0 ? ['color'] : []),
      ...(product.has_size_variants && product.sizes?.length > 0 ? ['size'] : []),
      ...(product.has_shape_variants && product.shapes?.length > 0 ? ['shape'] : []),
    ];
    if (!types.length) return;
    promptedRef.current = true;
    const timer = setTimeout(() => toast.error(`Please select ${types.join(' / ')} to add to cart`), 450);
    return () => clearTimeout(timer);
  }, [product, route.params?.promptVariant]);

  const scrollMain = useCallback((i) => { mainRef.current?.scrollTo({ x: i * W, animated: true }); setIdx(i); }, []);

  if (loading || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SkeletonBlock height={IMG_H} radius={0} />
        <View style={{ padding: 18, gap: 12 }}><SkeletonBlock height={26} width="70%" /><SkeletonBlock height={30} width="40%" /><SkeletonBlock height={80} /><SkeletonBlock height={48} /></View>
      </View>
    );
  }

  const images = collectImages(product);
  const effPrice = color?.discount_price || color?.price || size?.discount_price || size?.price || shape?.discount_price || shape?.price || product.discount_price || product.price || 0;
  const effOrig = (color?.price || size?.price || shape?.price || null) || product.price || 0;
  const hasDiscount = effOrig > effPrice;
  const discountPct = hasDiscount ? Math.round(((effOrig - effPrice) / effOrig) * 100) : 0;
  const stock = (color ? color.stock : size ? size.stock : shape ? shape.stock : product.stock) ?? product.stock ?? 0;
  const soldOut = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const ownShop = isLoggedIn && user?.shop_id && user.shop_id === product.shop_id;

  const selectVariant = (setter, v, imgUrl) => { tapLight(); setter(v); if (imgUrl) { const ci = images.indexOf(imgUrl); if (ci >= 0) scrollMain(ci); } };
  const bumpQty = (d) => { setQty((q) => Math.max(1, Math.min(stock || 99, q + d))); Animated.sequence([Animated.timing(qPulse, { toValue: 1.3, duration: 90, useNativeDriver: true }), Animated.spring(qPulse, { toValue: 1, useNativeDriver: true })]).start(); };

  const doFly = () => { setFlying(true); fly.setValue(0); Animated.timing(fly, { toValue: 1, duration: 620, useNativeDriver: true }).start(() => setFlying(false)); };

  // Variant rules (mirrors the web): which variant types exist on this product…
  const variantTypesAvailable = [
    ...(product.colors?.length > 0 ? ['color'] : []),
    ...(product.has_size_variants && product.sizes?.length > 0 ? ['size'] : []),
    ...(product.has_shape_variants && product.shapes?.length > 0 ? ['shape'] : []),
  ];
  // …and the shop's Variant Selection Mode: 'multi' = must pick EVERY type (e.g. color + size),
  // 'single' (default) = must pick at least one.
  const selectionMode = product.variant_selection_mode || 'single';
  const validateVariants = () => {
    if (!variantTypesAvailable.length) return true;
    if (selectionMode === 'multi') {
      const missing = [];
      if (variantTypesAvailable.includes('color') && !color) missing.push('color');
      if (variantTypesAvailable.includes('size') && !size) missing.push('size');
      if (variantTypesAvailable.includes('shape') && !shape) missing.push('shape');
      if (missing.length) { toast.error(`Please select: ${missing.join(' and ')}`); return false; }
      return true;
    }
    if (!color && !size && !shape) { toast.error(`Please select at least one: ${variantTypesAvailable.join(' / ')}`); return false; }
    return true;
  };

  const onAdd = async (buyNow) => {
    if (soldOut) return;
    if (!validateVariants()) { tapLight(); return; }
    if (stock && qty > stock) { toast.error(`Only ${stock} available in stock`); return; }
    notifySuccess(); doFly();
    try { await add(product, qty, { color: vname(color), size: vname(size), shape: vname(shape) }); } catch (_) {}
    if (buyNow) navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Cart' } });
  };
  const toggleWish = async () => {
    tapLight();
    Animated.sequence([Animated.timing(heart, { toValue: 1, duration: 220, useNativeDriver: true }), Animated.timing(heart, { toValue: 0, duration: 160, useNativeDriver: true })]).start();
    if (!isLoggedIn) return navigation.navigate('Auth');
    const next = !wished; setWished(next);
    try { next ? await api.wishlist.add(product.id) : await api.wishlist.remove(product.id); } catch (_) { setWished(!next); }
  };
  const doShare = () => Share.share({ message: `${product.name} — ${money(effPrice)} on OpenMarketlb`, title: product.name }).catch(() => {});

  const StockPill = () => (
    <View style={[styles.stockPill, soldOut ? styles.stockOut : lowStock ? styles.stockLow : styles.stockOk]} testID={soldOut ? 'out-of-stock-status' : 'stock-status'}>
      {soldOut ? <PulseDot color={colors.red} /> : lowStock ? <PulseDot color="#d97706" /> : <Ionicons name="checkmark-circle" size={12} color={colors.seller} />}
      <Text style={[styles.stockText, { color: soldOut ? colors.red : lowStock ? '#b45309' : colors.sellerSoftText }]}>{soldOut ? 'Out of stock' : lowStock ? `Only ${stock} left` : 'In stock'}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="product-detail-page">
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Gallery */}
        <View style={{ height: IMG_H, overflow: 'hidden', backgroundColor: colors.surfaceMuted }} testID="product-images">
          <Animated.View style={{ opacity: enter, transform: [{ translateY: scrollY.interpolate({ inputRange: [0, IMG_H], outputRange: [0, IMG_H * 0.4], extrapolate: 'clamp' }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] }) }] }}>
            <ScrollView ref={mainRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}>
              {(images.length ? images : [null]).map((uri, i) => (
                <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => uri && setLightbox(true)}>
                  {uri ? <Image source={{ uri: img(uri) }} style={{ width: W, height: IMG_H }} resizeMode="cover" /> : <View style={[styles.fallback, { width: W, height: IMG_H }]}><Ionicons name="image-outline" size={48} color={colors.textMuted} /></View>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {images.length > 1 && (
            <>
              <TouchableOpacity testID="prev-image-btn" style={[styles.navBtn, { left: 10 }]} onPress={() => scrollMain(Math.max(0, idx - 1))}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
              <TouchableOpacity testID="next-image-btn" style={[styles.navBtn, { right: 10 }]} onPress={() => scrollMain(Math.min(images.length - 1, idx + 1))}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></TouchableOpacity>
              <View style={styles.dots}>{images.map((_, i) => <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />)}</View>
            </>
          )}
          {hasDiscount && <LinearGradient colors={gradients.sale} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saleBadge} testID="product-detail-sale-badge"><Text style={styles.saleBadgeText}>-{discountPct}%</Text></LinearGradient>}
        </View>

        {/* Thumbnails */}
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} testID="image-thumbnails">
            {images.map((uri, i) => (
              <TouchableOpacity key={i} onPress={() => scrollMain(i)} style={[styles.thumb, i === idx && styles.thumbOn]}>
                <Image source={{ uri: img(uri) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.sheet} testID="product-details">
          <View style={styles.nameRow}>
            <Text style={styles.name} testID="product-detail-name">{product.name}</Text>
            <StockPill />
          </View>

          <View style={styles.priceRow} testID="product-detail-price">
            <AnimatedMoney value={effPrice} style={styles.price} />
            {hasDiscount && <Text style={styles.strike}>{money(effOrig)}</Text>}
            {hasDiscount && <View style={styles.pctChip}><Text style={styles.pctChipText}>-{discountPct}%</Text></View>}
          </View>

          {product.has_free_gift && (
            <LinearGradient colors={gradients.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gift} testID="product-gift-banner">
              <View style={styles.giftIcon}><Ionicons name="gift" size={18} color={colors.white} /></View>
              <View style={{ flex: 1 }}><Text style={styles.giftTitle}>Free Gift</Text><Text style={styles.giftSub}>{product.free_gift_name || 'A complimentary gift with this purchase'}</Text></View>
            </LinearGradient>
          )}

          {product.colors?.length > 0 && (
            <View style={styles.variantBlock} testID="color-selection">
              <Text style={styles.variantLabel}>Color{color ? `: ${vname(color)}` : ''}</Text>
              <View style={styles.swatchRow}>
                {product.colors.map((c, i) => {
                  const on = vname(color) === vname(c); const out = (c.stock ?? 1) <= 0;
                  return (
                    <TouchableOpacity key={i} disabled={out} onPress={() => selectVariant(setColor, c, c.image_url)} style={[styles.swatch, on && styles.swatchOn, out && styles.dim]}>
                      {c.image_url ? <Image source={{ uri: img(c.image_url) }} style={styles.swatchImg} /> : <View style={[styles.swatchImg, { backgroundColor: c.hex || c.color_code || colors.border }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {product.sizes?.length > 0 && (
            <View style={styles.variantBlock} testID="size-selection">
              <Text style={styles.variantLabel}>Size</Text>
              <View style={styles.chipRow}>
                {product.sizes.map((s, i) => { const on = vname(size) === vname(s); const out = (s.stock ?? 1) <= 0; return (
                  <TouchableOpacity key={i} disabled={out} onPress={() => selectVariant(setSize, s, s.image_url)} style={[styles.chip, on && styles.chipOn, out && styles.dim]}>
                    <Text style={[styles.chipText, on && { color: colors.onPrimary }, out && styles.strikeText]}>{vname(s)}</Text>
                  </TouchableOpacity>
                ); })}
              </View>
            </View>
          )}

          {product.shapes?.length > 0 && (
            <View style={styles.variantBlock} testID="shape-selection">
              <Text style={styles.variantLabel}>Shape</Text>
              <View style={styles.chipRow}>
                {product.shapes.map((s, i) => { const on = vname(shape) === vname(s); const out = (s.stock ?? 1) <= 0; return (
                  <TouchableOpacity key={i} disabled={out} onPress={() => selectVariant(setShape, s, s.image_url)} style={[styles.chip, on && styles.chipOn, out && styles.dim]}>
                    <Text style={[styles.chipText, on && { color: colors.onPrimary }, out && styles.strikeText]}>{vname(s)}</Text>
                  </TouchableOpacity>
                ); })}
              </View>
            </View>
          )}

          <View style={styles.variantBlock}>
            <Text style={styles.variantLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <TouchableOpacity testID="decrease-quantity" style={styles.stepBtn} onPress={() => bumpQty(-1)}><Ionicons name="remove" size={18} color={colors.violet} /></TouchableOpacity>
              <Animated.Text testID="quantity-value" style={[styles.qty, { transform: [{ scale: qPulse }] }]}>{qty}</Animated.Text>
              <TouchableOpacity testID="increase-quantity" disabled={qty >= stock} style={[styles.stepBtn, qty >= stock && styles.dim]} onPress={() => bumpQty(1)}><Ionicons name="add" size={18} color={colors.violet} /></TouchableOpacity>
            </View>
          </View>

          {product.description ? (
            <View style={styles.variantBlock}>
              <Text style={styles.variantLabel}>Description</Text>
              <Text style={styles.desc} numberOfLines={descOpen ? undefined : 4} testID="product-detail-description">{product.description}</Text>
              {product.description.length > 160 ? <TouchableOpacity onPress={() => { tapLight(); setDescOpen((v) => !v); }}><Text style={styles.readMore}>{descOpen ? 'Read less' : 'Read more'}</Text></TouchableOpacity> : null}
            </View>
          ) : null}

          {/* Cart / Buy live ONLY in the fixed bottom bar */}
          <View style={styles.iconActions}>
            <TouchableOpacity testID="wishlist-detail-button" style={styles.iconAction} onPress={toggleWish}>
              <Animated.View style={{ transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }] }}><Ionicons name={wished ? 'heart' : 'heart-outline'} size={20} color={wished ? colors.sale : colors.textSecondary} /></Animated.View>
              <Text style={styles.iconActionText}>Wishlist</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="share-detail-button" style={styles.iconAction} onPress={doShare}><Ionicons name="share-social-outline" size={20} color={colors.textSecondary} /><Text style={styles.iconActionText}>Share</Text></TouchableOpacity>
          </View>

          {/* Shop row + message */}
          {product.shop_id && (
            <View style={styles.shopRow} testID="product-shop-link">
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} activeOpacity={0.9} onPress={() => navigation.navigate('ShopPublic', { id: product.shop_id, name: product.shop_name })}>
                <View style={styles.shopLogo}>{product.shop_logo ? <Image source={{ uri: img(product.shop_logo) }} style={{ width: '100%', height: '100%', borderRadius: 12 }} /> : <Ionicons name="storefront" size={20} color={colors.violet} />}</View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.shopName} numberOfLines={1}>{product.shop_name || 'Shop'}</Text>{product.shop_verified && <Ionicons name="checkmark-circle" size={14} color={colors.seller} />}</View>
                  <Text style={styles.shopVisit}>Visit shop</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                testID="message-shop-button"
                style={styles.msgBtn}
                onPress={() => (isLoggedIn
                  ? navigation.navigate('Chat', {
                      conversation: { shop_id: product.shop_id, recipient_type: 'shop', shop_name: product.shop_name, logo: product.shop_logo },
                      name: product.shop_name || 'Shop',
                      initialText: `Regarding product: ${product.name}\n\n`,
                    })
                  : navigation.navigate('Auth'))}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.violet} />
                <Text style={styles.msgBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sponsored */}
        {spRecs.length > 0 && (
          <View style={styles.spWrap} testID="sponsored-you-may-like">
            <View style={styles.spHead}><View style={styles.spPill}><Ionicons name="megaphone" size={12} color="#b45309" /><Text style={styles.spPillText}>Sponsored · You may like</Text><View style={styles.adTag}><Text style={styles.adTagText}>Ad</Text></View></View></View>
            <FlatList data={spRecs} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(p, i) => p.id || String(i)} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }} renderItem={({ item }) => <ProductCard product={item} isSponsored showShopName style={{ width: 150 }} />} testID="sponsored-promoted-category" />
          </View>
        )}

        {/* Reviews */}
        <ReviewsSection reviews={reviews} setReviews={setReviews} product={product} isLoggedIn={isLoggedIn} ownShop={ownShop} onWrite={() => (isLoggedIn ? setReviewOpen(true) : navigation.navigate('Auth'))} />

        {/* Similar */}
        {recs.length > 0 && (
          <View style={{ marginTop: 6 }} testID="similar-products">
            <View style={styles.simHead}><Text style={styles.simTitle}>Customers also bought</Text></View>
            <FlatList data={recs} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(p, i) => p.id || String(i)} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} renderItem={({ item }) => <ProductCard product={item} showShopName carousel style={{ width: 150 }} />} />
          </View>
        )}
      </Animated.ScrollView>

      {/* Back */}
      <TouchableOpacity style={[styles.floatBtn, { top: insets.top + 6, left: 14 }]} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.ink} /></TouchableOpacity>

      {/* Fly-to-cart ghost */}
      {flying && images[idx] ? (
        <Animated.Image source={{ uri: img(images[idx]) }} style={[styles.ghost, { opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.9, 0.9, 0] }), transform: [
          // fly INTO the bottom bar's cart button (bottom-left)
          { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [W / 2 - 40, -5] }) },
          { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [IMG_H / 2, SH - (insets.bottom || 12) - 82] }) },
          { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) },
        ] }]} />
      ) : null}

      {/* Fixed bottom bar — the ONLY place to add/buy. Cart button is the fly-to target. */}
      <View style={[styles.sticky, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]} testID="mobile-sticky-bar">
        <TouchableOpacity testID="sticky-cart-btn" style={styles.stickyIcon} onPress={() => navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Cart' } })} accessibilityLabel="Open cart">
          <Ionicons name="cart" size={20} color={colors.violet} />
          {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text></View> : null}
        </TouchableOpacity>
        <TouchableOpacity testID="add-to-cart-detail-button" activeOpacity={0.9} disabled={soldOut} onPress={() => onAdd(false)} style={[styles.stickyAdd, soldOut && styles.dim]}>
          <Ionicons name="cart-outline" size={18} color={colors.violet} /><Text style={styles.stickyAddText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="buy-now-button" activeOpacity={0.9} disabled={soldOut} onPress={() => onAdd(true)} style={{ flex: 1 }}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.stickyBuy, soldOut && styles.dim]}><Text style={[styles.stickyBuyText, { color: colors.onPrimary }]}>Buy · {money(effPrice * qty)}</Text></LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Lightbox */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <View style={styles.lightbox} testID="image-lightbox">
          <TouchableOpacity style={[styles.lbClose, { top: insets.top + 10 }]} onPress={() => setLightbox(false)}><Ionicons name="close" size={26} color={colors.white} /></TouchableOpacity>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: idx * W, y: 0 }}>
            {images.map((uri, i) => (
              <ScrollView key={i} maximumZoomScale={3} minimumZoomScale={1} centerContent style={{ width: W }} contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri: img(uri) }} style={{ width: W, height: W }} resizeMode="contain" />
              </ScrollView>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Review sheet */}
      <BottomSheet visible={reviewOpen} onClose={() => setReviewOpen(false)} maxHeight="80%">
        <ReviewForm product={product} onDone={(rev) => { setReviews((r) => [rev, ...r]); setReviewOpen(false); }} />
      </BottomSheet>

      {/* Message composer */}
      <BottomSheet visible={msgOpen} onClose={() => setMsgOpen(false)} maxHeight="60%">
        <MessageComposer product={product} onSent={() => setMsgOpen(false)} />
      </BottomSheet>
    </View>
  );
}

function PulseDot({ color }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 0, duration: 700, useNativeDriver: true })])).start(); }, [a]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }} />;
}

function Stars({ value = 0, size = 13, onPick }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={!onPick} onPress={() => onPick?.(n)} hitSlop={4}>
          <Ionicons name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={colors.amber} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewsSection({ reviews, setReviews, product, isLoggedIn, ownShop, onWrite }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => Math.round(r.rating) === n).length);
  const help = async (rv, i) => { try { await api.reviews.markHelpful(rv.id); setReviews((rs) => rs.map((x, k) => (k === i ? { ...x, helpful_count: (x.helpful_count || 0) + 1 } : x))); } catch (_) {} };
  return (
    <View style={styles.reviews} testID="reviews-section">
      <View style={styles.reviewHead}>
        <Text style={styles.reviewTitle}>Reviews</Text>
        {ownShop ? <View testID="own-shop-review-disabled" style={styles.ownShop}><Text style={styles.ownShopText}>You can't review your own shop</Text></View>
          : <TouchableOpacity testID="write-review-btn" style={styles.writeBtn} onPress={onWrite}><Ionicons name="create-outline" size={14} color={colors.violet} /><Text style={styles.writeBtnText}>Write a review</Text></TouchableOpacity>}
      </View>
      {reviews.length === 0 ? (
        <View style={styles.noReviews}><Ionicons name="chatbubbles-outline" size={30} color={colors.textMuted} /><Text style={styles.noReviewsTitle}>No reviews yet</Text><Text style={styles.noReviewsSub}>Be the first to share your thoughts.</Text></View>
      ) : (
        <>
          <View style={styles.reviewSummary}>
            <View style={{ alignItems: 'center' }}><Text style={styles.reviewAvg}>{avg.toFixed(1)}</Text><Stars value={avg} size={14} /><Text style={styles.reviewCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text></View>
            <View style={{ flex: 1, gap: 4 }}>
              {[5, 4, 3, 2, 1].map((n, i) => (
                <View key={n} style={styles.barRow}><Text style={styles.barNum}>{n}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${reviews.length ? (dist[i] / reviews.length) * 100 : 0}%` }]} /></View></View>
              ))}
            </View>
          </View>
          {reviews.slice(0, 6).map((r, i) => (
            <View key={r.id || i} style={styles.reviewItem}>
              <View style={styles.reviewTop}>
                <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{(r.user_name || r.name || 'U').charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.reviewName}>{r.user_name || r.name || 'Customer'}</Text><Stars value={r.rating} /></View>
              </View>
              {r.title ? <Text style={styles.reviewItemTitle}>{r.title}</Text> : null}
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              <TouchableOpacity style={styles.helpful} onPress={() => help(r, i)}><Ionicons name="thumbs-up-outline" size={13} color={colors.textMuted} /><Text style={styles.helpfulText}>Helpful{r.helpful_count ? ` · ${r.helpful_count}` : ''}</Text></TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function ReviewForm({ product, onDone }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!comment.trim()) return Alert.alert('Add a comment');
    setBusy(true);
    try { const { data } = await api.reviews.create(product.id, { rating, title, comment }); notifySuccess(); onDone(data?.review || { rating, title, comment, user_name: 'You' }); }
    catch (e) { Alert.alert('Could not post review', e?.response?.data?.detail || 'Try again.'); } finally { setBusy(false); }
  };
  return (
    <View testID="review-form">
      <Text style={styles.sheetTitle}>Write a review</Text>
      <View style={{ alignItems: 'center', marginVertical: 14 }}><Stars value={rating} size={34} onPick={(n) => { tapLight(); setRating(n); }} /></View>
      <TextInput style={styles.input} placeholder="Title (optional)" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
      <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Share your experience…" placeholderTextColor={colors.textMuted} value={comment} onChangeText={setComment} multiline />
      <TouchableOpacity onPress={submit} disabled={busy} style={{ marginTop: 12 }}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetBtn}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.sheetBtnText, { color: colors.onPrimary }]}>Post review</Text>}</LinearGradient></TouchableOpacity>
    </View>
  );
}

function MessageComposer({ product, onSent }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await api.messages.send({ shop_id: product.shop_id, product_id: product.id, content: text }); notifySuccess(); onSent(); }
    catch (e) { Alert.alert('Could not send', e?.response?.data?.detail || 'Try again.'); } finally { setBusy(false); }
  };
  return (
    <View>
      <Text style={styles.sheetTitle}>Message {product.shop_name || 'the shop'}</Text>
      <Text style={styles.sheetSub}>About: {product.name}</Text>
      <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12, marginTop: 10 }]} placeholder="Ask about this product…" placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} multiline />
      <TouchableOpacity onPress={send} disabled={busy} style={{ marginTop: 12 }}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetBtn}>{busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="send" size={16} color={colors.onPrimary} /><Text style={[styles.sheetBtnText, { color: colors.onPrimary }]}>Send message</Text></>}</LinearGradient></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  navBtn: { position: 'absolute', top: '46%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 18, backgroundColor: colors.white },
  saleBadge: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  saleBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 12 },
  thumbs: { paddingHorizontal: 12, paddingVertical: 5, gap: 5 },
  thumb: { width: 32, height: 32, borderRadius: 7, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.violet },
  sheet: { backgroundColor: colors.bg, padding: 14, paddingTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  stockOk: { backgroundColor: colors.sellerSoft, borderColor: '#a7f3d0' },
  stockLow: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  stockOut: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  stockText: { fontFamily: fonts.bold, fontSize: 10.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  price: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.violet },
  strike: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  pctChip: { backgroundColor: colors.saleSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  pctChipText: { fontFamily: fonts.bold, fontSize: 11, color: colors.sale },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, marginTop: 16 },
  giftIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  giftTitle: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.white },
  giftSub: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 1 },
  variantBlock: { marginTop: 10 },
  variantLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, marginBottom: 5 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: 2 },
  swatchOn: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  swatchImg: { width: '100%', height: '100%', borderRadius: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.violet, backgroundColor: colors.violet },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  strikeText: { textDecorationLine: 'line-through', color: colors.textMuted },
  dim: { opacity: 0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, minWidth: 30, textAlign: 'center' },
  desc: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  readMore: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.violet, marginTop: 6 },
  inlineActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md },
  ctaText: { fontFamily: fonts.bold, fontSize: 15 },
  buyNow: { paddingHorizontal: 20, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  buyNowText: { fontFamily: fonts.bold, fontSize: 15, color: colors.violet },
  iconActions: { flexDirection: 'row', gap: 24, marginTop: 14, justifyContent: 'center' },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconActionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  shopLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shopName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  shopVisit: { fontFamily: fonts.medium, fontSize: 12, color: colors.violet, marginTop: 1 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  msgBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.violet700 },
  spWrap: { marginTop: 8, paddingVertical: 12, backgroundColor: '#fffbeb' },
  spHead: { paddingHorizontal: 12, marginBottom: 8 },
  spPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  spPillText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#b45309' },
  adTag: { backgroundColor: '#f59e0b', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 },
  adTagText: { fontFamily: fonts.extrabold, fontSize: 8, color: colors.white },
  simHead: { paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
  simTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  reviews: { paddingHorizontal: 16, marginTop: 10 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  reviewTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  writeBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  ownShop: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  ownShopText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  noReviews: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  noReviewsTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  noReviewsSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 14 },
  reviewAvg: { fontFamily: fonts.extrabold, fontSize: 38, color: colors.ink },
  reviewCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barNum: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, width: 10 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.amber },
  reviewItem: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontFamily: fonts.bold, color: colors.violet700, fontSize: 15 },
  reviewName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, marginBottom: 2 },
  reviewItemTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginTop: 8 },
  reviewComment: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start' },
  helpfulText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  floatBtn: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  ghost: { position: 'absolute', width: 80, height: 80, borderRadius: 16, top: 0, left: 0, zIndex: 20 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, ...shadow.emphasis },
  stickyIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.badge, borderWidth: 1.5, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: colors.onBadge, fontFamily: fonts.bold, fontSize: 9 },
  stickyAdd: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 48, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.violet },
  stickyAddText: { fontFamily: fonts.bold, fontSize: 13, color: colors.violet },
  stickyBuy: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stickyBuyText: { fontFamily: fonts.bold, fontSize: 14 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  lbClose: { position: 'absolute', right: 16, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  sheetSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginTop: 8 },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md },
  sheetBtnText: { fontFamily: fonts.bold, fontSize: 15 },
});
