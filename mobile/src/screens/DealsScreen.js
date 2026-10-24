import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../lib/api';
import { colors, fonts, radius, shadow } from '../theme/theme';
import ProductCard from '../components/ProductCard';
import { Empty } from '../components/ui';
import RecommendedFeed from '../components/RecommendedFeed';

const isDeal = (p) => (p.discount_price && p.discount_price < p.price) || p.shop_sale_discount > 0;
const pctOf = (p) => p.shop_sale_discount || (p.discount_price ? Math.round(((p.price - p.discount_price) / p.price) * 100) : 0);

export default function DealsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState([]);
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [prodRes, saleRes] = await Promise.allSettled([
        api.products.getAll({ limit: 60, sort: 'discount' }),
        api.themeSale.get(),
      ]);
      const list = prodRes.status === 'fulfilled' ? (prodRes.value.data?.products || prodRes.value.data || []) : [];
      const onlyDeals = list.filter(isDeal).sort((a, b) => pctOf(b) - pctOf(a));
      setDeals(onlyDeals);
      if (saleRes.status === 'fulfilled' && saleRes.value.data?.active) setSale(saleRes.value.data);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const topPct = deals.length ? pctOf(deals[0]) : 0;

  const header = (
    <>
      {/* Hero */}
      <LinearGradient colors={['#f59e0b', '#f97316', '#e11d48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 8 }]}>
        <View style={s.heroGlow} />
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="arrow-back" size={20} color={colors.white} /></TouchableOpacity>
        <View style={s.flameRow}><Ionicons name="flame" size={22} color={colors.white} /><Text style={s.eyebrow}>HOT RIGHT NOW</Text></View>
        <Text style={s.h1}>Deals & Offers</Text>
        <Text style={s.heroSub}>{deals.length > 0 ? `${deals.length} deals${topPct ? ` · up to ${topPct}% off` : ''}` : 'Fresh discounts across the marketplace'}</Text>
      </LinearGradient>

      {/* Theme sale banner */}
      {sale ? (
        <LinearGradient colors={['#e11d48', '#be123c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saleBanner}>
          <Ionicons name="pricetags" size={20} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={s.saleTitle}>{sale.title || 'Storewide Sale'} — up to {sale.percent || sale.theme_sale_percent}% off</Text>
            <Text style={s.saleSub}>Limited-time savings across the platform</Text>
          </View>
        </LinearGradient>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : deals.length === 0 ? (
        <View style={{ paddingTop: 20 }}><Empty icon="pricetag-outline" title="No active deals" subtitle="Check back soon for fresh discounts." /></View>
      ) : (
        <View style={s.grid}>
          {deals.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 10) * 40).duration(300)} style={s.cell}>
              <ProductCard product={p} showShopName />
            </Animated.View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <RecommendedFeed header={header} bottomInset={30} />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 24, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4 },
  h1: { color: colors.white, fontFamily: fonts.heading, fontSize: 30, letterSpacing: -0.6, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.medium, fontSize: 12.5, marginTop: 8 },
  saleBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, marginBottom: 0, padding: 13, borderRadius: radius.md, ...shadow.card },
  saleTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  saleSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 10.5, marginTop: 1 },
  center: { paddingVertical: 60, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 9, paddingTop: 12 },
  cell: { width: '50%', paddingHorizontal: 1, marginBottom: 4 },
});
