import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, radius, shadow } from '../theme/theme';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './ui';
import { useReveal } from '../lib/useReveal';

/**
 * Reusable end-of-page promotional block (mirrors the web EndOfPagePromos):
 *   1. "Sponsored add-ons" (Ad) — a curated, cheapest-first subset of sponsored products.
 *   2. "Recommended Products" (For You) — a grid of popular products.
 * Used by the Contact and About pages.
 */

function ProductGrid({ items, sponsored }) {
  return (
    <View style={s.grid}>
      {items.map((p) => (
        <View key={p.id} style={s.cell}>
          <ProductCard product={p} isSponsored={sponsored} showShopName />
        </View>
      ))}
    </View>
  );
}

export function SponsoredAddOns() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.promotions.getActive({ limit: 40 })
      .then(({ data }) => {
        const list = (data?.products || []).slice();
        list.sort((a, b) => (a.discount_price || a.price || 0) - (b.discount_price || b.price || 0)); // cheapest first
        setItems(list.slice(0, 6));
      })
      .catch(() => {});
  }, []);
  if (!items.length) return null;
  return (
    <View style={s.section} testID="end-promos-sponsored-addons">
      <View style={s.head}>
        <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          <Ionicons name="megaphone" size={18} color={colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>Sponsored add-ons</Text>
            <View style={s.adBadge}><Ionicons name="megaphone" size={9} color="#b45309" /><Text style={s.adBadgeText}>Ad</Text></View>
          </View>
          <Text style={s.sub}>Popular extras you might want</Text>
        </View>
      </View>
      <ProductGrid items={items} sponsored />
    </View>
  );
}

// Just the "Recommended Products" section header — reused by RecommendedFeed (which owns
// the paginated grid) so the two render identically.
export function RecommendedHeader() {
  return (
    <View style={[s.head, s.section]} testID="recommended-with-sponsored-section">
      <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
        <Ionicons name="compass" size={18} color={colors.white} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={1}>Recommended Products</Text>
          <View style={s.forYouBadge}><Ionicons name="sparkles" size={9} color={colors.p800} /><Text style={s.forYouText}>For You</Text></View>
        </View>
        <Text style={s.sub}>Handpicked picks just for you</Text>
      </View>
    </View>
  );
}

function RecommendedProducts({ nearEndSignal = 0 }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.products.getAll({ is_active: true, page: 1, limit: 40, sort_by: 'popular' })
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.products || []))
      .catch(() => {});
  }, []);

  // Mount only a few cards up-front; reveal more as the parent scroll nears the bottom (with a
  // skeleton tail) instead of mounting the whole grid at once.
  const { visible, hasMore, revealMore } = useReveal(items, 6);
  useEffect(() => { if (nearEndSignal) revealMore(); }, [nearEndSignal]); // eslint-disable-line

  if (!items.length) return null;
  return (
    <View style={s.section} testID="recommended-with-sponsored-section">
      <RecommendedHeader />
      <View style={s.grid}>
        {visible.map((p) => (<View key={p.id} style={s.cell}><ProductCard product={p} showShopName /></View>))}
        {hasMore ? [0, 1].map((i) => <View key={`sk-${i}`} style={s.cell}><ProductCardSkeleton /></View>) : null}
      </View>
    </View>
  );
}

export default function EndOfPagePromos({ nearEndSignal = 0 }) {
  return (
    <>
      <SponsoredAddOns />
      <RecommendedProducts nearEndSignal={nearEndSignal} />
    </>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 22, paddingHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.p700 },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  adBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  adBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#b45309' },
  forYouBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.p50, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  forYouText: { fontFamily: fonts.bold, fontSize: 10, color: colors.p800 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
});
