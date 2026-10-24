import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, ScrollView } from 'react-native';
import { Image } from 'expo-image'; // native caching + faster decode + list recycling (smooth scroll)
// The image pager is a native ScrollView registered with RNGH (Gesture.Native) so it can
// BLOCK the page-level pan (Shop screen's category swipe) — swiping photos never flips pages.
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from './ui';
import { useCart } from '../context/CartContext';
import { useFlyToCart } from '../context/FlyToCartContext';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { tapLight } from '../lib/haptics';
import { colors, gradients, radius, font, fonts, shadow } from '../theme/theme';

const collectImages = (p) => {
  const variant = [
    ...(p.colors || []).map((c) => c.image_url),
    ...(p.shapes || []).map((s) => s.image_url),
    ...(p.sizes || []).map((s) => s.image_url),
    p.size_variant_image,
  ].filter(Boolean);
  if (p.images?.length) return p.images;
  if (variant.length) return variant;
  return [];
};

function ProductCard({ product, isSponsored = false, showShopName = false, compact = false, carousel = false, style, pageGesture }) {
  const navigation = useNavigation();
  const { add } = useCart();
  const { flyToCart } = useFlyToCart();
  const [idx, setIdx] = useState(0);
  const [wish, setWish] = useState(false);
  const [w, setW] = useState(0);
  const [pressCart, setPressCart] = useState(false);
  const imgWrapRef = useRef(null);

  const price = product.discount_price || product.price;
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const discountPct = hasDiscount ? Math.round(((product.price - product.discount_price) / product.price) * 100) : 0;
  const images = useMemo(() => collectImages(product), [product]);
  const multi = images.length > 1;
  // Which variant types force a selection (mirrors ProductDetailScreen's rules): color / size / shape.
  const hasVariants = (product.colors?.length > 0)
    || (product.has_size_variants && product.sizes?.length > 0)
    || (product.has_shape_variants && product.shapes?.length > 0);

  const open = useCallback(() => navigation.navigate('ProductDetail', { product, id: product.id }), [navigation, product]);

  // The pager is a plain horizontal ScrollView (the most reliable way to swipe photos).
  // Tap-to-open lives on each image (a TouchableOpacity) so it never competes with the scroll.
  // ONLY inside the Shop category pager do we register the scroll with RNGH so it can BLOCK
  // the page-swipe — everywhere else it's a bare ScrollView with no gesture wrapper at all.
  const imgNative = useMemo(() => (pageGesture ? Gesture.Native().blocksExternalGesture(pageGesture) : null), [pageGesture]);

  const onScroll = useCallback((e) => {
    if (!w) return;
    setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  }, [w]);

  const toggleWish = async () => {
    tapLight();
    const next = !wish; setWish(next);
    try { next ? await api.wishlist?.add(product.id) : await api.wishlist?.remove(product.id); } catch (_) {}
  };
  const share = () => Share.share({ message: `${product.name} — OpenMarketlb` }).catch(() => {});
  const addToCart = () => {
    tapLight();
    // Products with variants can't be added blindly — send the user to the detail screen and
    // prompt them to pick the variant there.
    if (hasVariants) {
      navigation.navigate('ProductDetail', { product, id: product.id, promptVariant: true });
      return;
    }
    // No variants → animate the product image flying into the top-bar cart, then add it.
    setPressCart(true); setTimeout(() => setPressCart(false), 400);
    const uri = images[idx] || images[0];
    if (uri && imgWrapRef.current?.measureInWindow) {
      imgWrapRef.current.measureInWindow((x, y, wd, ht) => flyToCart({ x, y, size: wd || ht, uri }));
    }
    Promise.resolve(add(product, 1)).catch(() => {});
  };

  const showShop = (showShopName || isSponsored) && product.shop_name;

  return (
    <View style={[styles.card, isSponsored && styles.sponsored, style]}>
      {/* Image */}
      <View ref={imgWrapRef} style={styles.imageWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {images.length ? (
          multi && w ? (() => {
            const pager = (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} scrollEventThrottle={16} nestedScrollEnabled directionalLockEnabled decelerationRate="fast">
                {images.map((uri, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.95} onPress={open} style={{ width: w, height: w }}>
                    <Image source={{ uri: img(uri) }} style={{ width: w, height: w }} contentFit="cover" cachePolicy="memory-disk" transition={120} recyclingKey={product.id} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
            return imgNative ? <GestureDetector gesture={imgNative}>{pager}</GestureDetector> : pager;
          })() : (
            <TouchableOpacity activeOpacity={0.92} onPress={open} style={{ width: '100%', height: '100%' }}>
              <Image source={{ uri: img(images[0]) }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" transition={120} recyclingKey={product.id} />
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={open} style={styles.fallback}><Ionicons name="image-outline" size={30} color={colors.textMuted} /></TouchableOpacity>
        )}

        {/* Discount / shop-sale badge (top-left) */}
        {product.shop_sale_discount ? (
          <View style={styles.badgeTL}><Badge variant="sale" label={`-${product.shop_sale_discount}%`} /></View>
        ) : hasDiscount ? (
          <View style={styles.badgeTL}><Badge variant="discount" label={`-${discountPct}%`} /></View>
        ) : null}

        {/* Free gift badge (drops when a discount badge exists) */}
        {product.has_free_gift && (
          <View style={[styles.badgeTL, (hasDiscount || product.shop_sale_discount) && { top: 22 }]}>
            <Badge variant="gift" label="Gift" />
          </View>
        )}

        {/* Sponsored AD pill (bottom-left) */}
        {isSponsored && (
          <View style={styles.adPill}><Badge variant="sponsored" label="AD" /></View>
        )}

        {/* Image counter */}
        {multi && (
          <View style={styles.counter}><Text style={styles.counterText}>{idx + 1}/{images.length}</Text></View>
        )}

        {/* Dots */}
        {multi && (
          <View style={styles.dots}>
            {images.slice(0, 5).map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>
        )}

        {/* Wishlist */}
        <TouchableOpacity onPress={toggleWish} style={[styles.circleBtn, styles.wish, wish && { backgroundColor: colors.sale }]} activeOpacity={0.8}>
          <Ionicons name={wish ? 'heart' : 'heart-outline'} size={16} color={wish ? colors.white : colors.textMuted} />
        </TouchableOpacity>

        {/* Share (not on sponsored) */}
        {!isSponsored && (
          <TouchableOpacity onPress={share} style={[styles.circleBtn, styles.shareBtn]} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Floating add to cart */}
        <TouchableOpacity onPress={addToCart} activeOpacity={0.85} style={[styles.circleBtn, styles.cartBtn, pressCart && { backgroundColor: colors.violet, transform: [{ scale: 1.05 }] }]}>
          <Ionicons name="cart" size={16} color={pressCart ? colors.white : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <TouchableOpacity activeOpacity={0.92} onPress={open} style={styles.body}>
        {showShop && (
          <TouchableOpacity
            style={styles.shopRow}
            activeOpacity={0.7}
            onPress={() => product.shop_id && navigation.navigate('ShopPublic', { id: product.shop_id, name: product.shop_name })}
          >
            <Ionicons name="storefront-outline" size={11} color={colors.textMuted} />
            <Text style={styles.shopName} numberOfLines={1}>{product.shop_name}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {!compact && !isSponsored && !carousel && product.description ? (
          <Text style={styles.desc} numberOfLines={1}>{product.description}</Text>
        ) : null}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.price}>${Number(price).toFixed(2)}</Text>
            {hasDiscount && <Text style={styles.strike}>${Number(product.price).toFixed(2)}</Text>}
          </View>
          {!compact && !isSponsored && product.colors?.length > 0 && (
            <View style={styles.variant}><Text style={styles.variantText}>{product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'}</Text></View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  sponsored: { borderColor: '#fcd34d', ...shadow.amberGlow },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceMuted, position: 'relative' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeTL: { position: 'absolute', top: 4, left: 4, zIndex: 10 },
  adPill: { position: 'absolute', bottom: 6, left: 6, zIndex: 10 },
  counter: { position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.pill },
  counterText: { color: colors.white, fontSize: 10, fontFamily: fonts.medium },
  dots: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 12, backgroundColor: colors.white },
  circleBtn: { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  wish: { top: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.9)' },
  shareBtn: { top: 35, right: 5, backgroundColor: 'rgba(255,255,255,0.9)' },
  cartBtn: { bottom: 5, right: 5, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.95)', ...shadow.emphasis },
  body: { padding: 7 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  shopName: { flex: 1, fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  name: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text, lineHeight: 15 },
  desc: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  priceLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink },
  strike: { fontFamily: fonts.body, fontSize: 8.5, color: colors.saleAlt, textDecorationLine: 'line-through' },
  variant: { backgroundColor: colors.primarySoft, paddingHorizontal: 3, paddingVertical: 0.5, borderRadius: radius.badge },
  variantText: { fontFamily: fonts.medium, fontSize: 6.5, color: colors.violet700 },
});

export default React.memo(ProductCard);
