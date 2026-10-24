import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radius, shadow } from '../theme/theme';
import RecommendedFeed from '../components/RecommendedFeed';

const CARD_GRADS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#06b6d4'], ['#f43f5e', '#ec4899'],
  ['#10b981', '#14b8a6'], ['#f59e0b', '#f97316'], ['#8b5cf6', '#d946ef'],
];

export default function CategoriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.categories.getTopLevelWithPreview()
      .then(({ data }) => { if (alive) setCats(Array.isArray(data) ? data : data?.categories || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const openCat = useCallback((c) => {
    tapLight();
    navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Shop', params: { categoryId: c.id, categoryName: c.name } } });
  }, [navigation]);

  const totalProducts = cats.reduce((n, c) => n + (c.product_count || 0), 0);

  const header = (
    <>
      {/* Hero header */}
      <LinearGradient colors={[colors.p600, colors.s600, colors.p900]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 8 }]}>
        <View style={s.heroGlow} />
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="arrow-back" size={20} color={colors.white} /></TouchableOpacity>
        <Text style={s.eyebrow}>EXPLORE</Text>
        <Text style={s.h1}>Categories</Text>
        <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.underline} />
        <Text style={s.heroSub}>{cats.length} categories · {totalProducts.toLocaleString()} products</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <View style={s.grid}>
          {cats.map((c, i) => {
            const grad = CARD_GRADS[i % CARD_GRADS.length];
            return (
              <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 10) * 45).duration(320)} style={s.cell}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => openCat(c)} style={s.card}>
                  {c.preview_image
                    ? <Image source={{ uri: img(c.preview_image) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
                  {c.product_count > 0 ? <View style={s.countPill}><Text style={s.countText}>{c.product_count}</Text></View> : null}
                  <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={2}>{c.name}</Text>
                    <View style={s.cardCta}>
                      <Text style={s.cardCtaText}>Browse</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.white} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
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
  hero: { paddingHorizontal: 18, paddingBottom: 26, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5 },
  h1: { color: colors.white, fontFamily: fonts.heading, fontSize: 30, letterSpacing: -0.6, marginTop: 2 },
  underline: { width: 54, height: 4, borderRadius: 2, marginTop: 8 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 12.5, marginTop: 10 },
  center: { paddingVertical: 60, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 14 },
  cell: { width: '50%', padding: 5 },
  card: { height: 150, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceMuted, ...shadow.card },
  countPill: { position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  countText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  cardBody: { padding: 12 },
  cardName: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.3 },
  cardCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  cardCtaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
});
