import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, radius, shadow } from '../theme/theme';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './ui';
import { useReveal } from '../lib/useReveal';

/**
 * End-of-page promo sections for the checkout flow (Cart + Checkout).
 *   1. "Sponsored add-ons" (Ad) — cheapest-first sponsored subset, excluding cart items.
 *   2. "Recommended Picks" (For You) — popular products, excluding cart items.
 * On mobile both render as horizontal snap carousels of ProductCards.
 */

/* ---- "Sponsored add-ons" ---- */
function SponsoredAddOns({ excludeIds = [], testIdKey = 'cart' }) {
  const [items, setItems] = useState([]);
  const key = excludeIds.join(',');
  useEffect(() => {
    let cancelled = false;
    api.promotions.getActive({ limit: 40 })
      .then(({ data }) => {
        if (cancelled) return;
        const ex = new Set(excludeIds);
        const list = (data?.products || []).filter((p) => !ex.has(p.id));
        list.sort((a, b) => (a.discount_price || a.price || 0) - (b.discount_price || b.price || 0)); // lowPriceFirst
        setItems(list.slice(0, 6));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line
  if (!items.length) return null;
  return (
    <Animated.View entering={FadeInDown.delay(40)} style={s.section} testID={`sponsored-addons-${testIdKey}`}>
      <View style={s.head}>
        <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}><Ionicons name="megaphone" size={16} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.title}>Sponsored add-ons</Text>
            <View style={s.adBadge}><Ionicons name="megaphone" size={9} color="#b45309" /><Text style={s.adText}>Ad</Text></View>
          </View>
          <Text style={s.sub}>Popular extras you might want</Text>
        </View>
      </View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p, i) => p.id || String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        snapToInterval={160}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item }) => <ProductCard product={item} isSponsored showShopName style={{ width: 150 }} />}
      />
    </Animated.View>
  );
}

/* ---- "Recommended Picks" ----
   Products similar to what's in the cart (share a category) come first, then all other
   products in recommended order. Rendered as a vertical 2-column grid (not a carousel). */
function RecommendedPicks({ excludeIds = [], categoryIds = [], nearEndSignal = 0 }) {
  const [items, setItems] = useState([]);
  const key = `${excludeIds.join(',')}|${categoryIds.join(',')}`;
  useEffect(() => {
    let cancelled = false;
    api.products.getAll({ is_active: true, page: 1, limit: 40 }) // no sort_by → recommended order
      .then(({ data }) => {
        if (cancelled) return;
        const ex = new Set(excludeIds);
        const catSet = new Set(categoryIds);
        const isSimilar = (p) => [p.category_id, ...(p.category_ids || [])].filter(Boolean).some((c) => catSet.has(c));
        const pool = (Array.isArray(data) ? data : data?.products || []).filter((p) => p.id && !ex.has(p.id));
        const similar = pool.filter(isSimilar);
        const others = pool.filter((p) => !isSimilar(p));
        setItems([...similar, ...others].slice(0, 20)); // similar first, then the rest (recommended)
      })
      .catch(() => {});
    api.wishlist.get().catch(() => {}); // warm heart state
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line

  // Only mount a few cards up-front; reveal more each time the parent scroll nears the bottom.
  // Keeps the checkout page smooth instead of mounting ~20 heavy ProductCards at once.
  const { visible, hasMore, revealMore } = useReveal(items, 6);
  useEffect(() => { if (nearEndSignal) revealMore(); }, [nearEndSignal]); // eslint-disable-line

  if (!items.length) return null;
  return (
    <Animated.View entering={FadeInDown.delay(80)} style={s.section} testID="recommended-picks">
      <View style={s.head}>
        <View style={s.accent} />
        <LinearGradient colors={[colors.p500, '#a855f7', colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileLg}><Ionicons name="sparkles" size={18} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.titleLg}>Recommended Picks</Text>
            <View style={s.forYou}><Ionicons name="sparkles" size={9} color={colors.p800} /><Text style={s.forYouText}>For You</Text></View>
          </View>
          <Text style={s.sub}>Similar to your cart, and more you may like</Text>
        </View>
      </View>
      {/* Vertical grid (plain views — this lives inside a ScrollView, so no nested list).
          Reveals in batches; a skeleton row sits at the bottom until everything is shown. */}
      <View style={s.grid}>
        {visible.map((p, i) => (
          <View key={p.id || i} style={s.cell}><ProductCard product={p} showShopName /></View>
        ))}
        {hasMore ? [0, 1].map((i) => <View key={`sk-${i}`} style={s.cell}><ProductCardSkeleton /></View>) : null}
      </View>
    </Animated.View>
  );
}

export default function CheckoutPromos({ excludeIds = [], categoryIds = [], testIdKey = 'cart', nearEndSignal = 0 }) {
  return (
    <>
      <SponsoredAddOns excludeIds={excludeIds} testIdKey={testIdKey} />
      <RecommendedPicks excludeIds={excludeIds} categoryIds={categoryIds} nearEndSignal={nearEndSignal} />
    </>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 14 },
  accent: { position: 'absolute', left: 8, top: 2, bottom: 2, width: 3, borderRadius: 2, backgroundColor: colors.p400 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  tileLg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.p700 },
  titleLg: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.p700 },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  adBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  adText: { fontFamily: fonts.bold, fontSize: 10, color: '#b45309' },
  forYou: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.p50, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  forYouText: { fontFamily: fonts.bold, fontSize: 10, color: colors.p800 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11 },
  cell: { width: '50%', paddingHorizontal: 1, marginBottom: 3 },
});
