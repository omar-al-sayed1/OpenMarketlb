import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { SkeletonBlock } from './ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const W = Dimensions.get('window').width;
const CARD_W = W - 28;
const CARD_H = Math.round(CARD_W * 0.64);
const GAP = 12;
const SNAP = CARD_W + GAP;
const AUTOPLAY = 5200;

/* One immersive banner — parallax Ken-Burns image, brand-tinted bottom scrim (no dark
   wash), a floating glass content panel with a modern gradient CTA. */
function BannerCard({ item, index, scrollX, onPress }) {
  const input = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollX.value, input, [0.93, 1, 0.93], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollX.value, input, [10, 0, 10], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollX.value, input, [0.6, 1, 0.6], Extrapolation.CLAMP),
  }));
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scrollX.value, input, [50, 0, -50], Extrapolation.CLAMP) }, { scale: 1.18 }],
  }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, input, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, input, [16, 0, 16], Extrapolation.CLAMP) }],
  }));
  const subtitle = item.subtitle || item.banner_subtitle;
  return (
    <Animated.View style={[{ width: CARD_W, height: CARD_H, marginRight: GAP }, cardStyle]}>
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={styles.card}>
        {item.image_url
          ? <Animated.Image source={{ uri: img(item.image_url) }} style={[StyleSheet.absoluteFill, imgStyle]} resizeMode="cover" />
          : <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        {/* top gloss only — no dark/black scrim on the photo (text stays legible via its shadow) */}
        <LinearGradient colors={['rgba(255,255,255,0.18)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.5 }} style={styles.sheenTop} pointerEvents="none" />

        <View style={styles.badge}>
          <Ionicons name="sparkles" size={9} color={colors.white} />
          <Text style={styles.badgeText}>Featured</Text>
        </View>

        <Animated.View style={[styles.panel, panelStyle]}>
          {item.title ? <Text style={styles.title} numberOfLines={2}>{item.title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          <View style={styles.ctaRow}>
            <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Text style={styles.ctaText}>Explore</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.white} />
            </LinearGradient>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Segmented progress pagination — the active segment fills over the autoplay interval. */
function Progress({ count, active }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.segTrack}>
          {i === active ? <FillBar /> : <View style={[styles.segFill, { width: i < active ? '100%' : '0%' }]} />}
        </View>
      ))}
    </View>
  );
}
function FillBar() {
  const p = useSharedValue(0);
  useEffect(() => { p.value = 0; const id = setInterval(() => { p.value = Math.min(1, p.value + 0.02); }, AUTOPLAY / 50); return () => clearInterval(id); }, []); // eslint-disable-line
  const s = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return <Animated.View style={[styles.segFillActive, s]} />;
}

export default function HomeBannerCarousel() {
  const navigation = useNavigation();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollX.value = e.contentOffset.x; });

  useEffect(() => {
    api.banners.getHome()
      .then(({ data }) => setBanners(Array.isArray(data) ? data : data?.banners || []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const t = setInterval(() => {
      setActive((i) => {
        const next = (i + 1) % banners.length;
        ref.current?.scrollToOffset({ offset: next * SNAP, animated: true });
        return next;
      });
    }, AUTOPLAY);
    return () => clearInterval(t);
  }, [banners.length]);

  if (loading) return <View style={{ paddingHorizontal: 14, paddingTop: 12 }}><SkeletonBlock height={CARD_H} radius={radius.xl} /></View>;
  if (!banners.length) return null;

  return (
    <View style={{ paddingTop: 12 }}>
      <Animated.FlatList
        ref={ref}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 14 }}
        keyExtractor={(b, i) => b.id || String(i)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / SNAP))}
        renderItem={({ item, index }) => (
          <BannerCard item={item} index={index} scrollX={scrollX} onPress={() => navigation.navigate('Shop')} />
        )}
      />
      {banners.length > 1 && <Progress count={banners.length} active={active} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceMuted, ...shadow.emphasis },
  sheenTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  badge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.4 },
  panel: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  title: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } },
  subtitle: { color: '#fff', fontFamily: fonts.medium, fontSize: 12.5, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  ctaRow: { flexDirection: 'row', marginTop: 11 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 15, paddingVertical: 8, borderRadius: radius.pill, ...shadow.violetGlow },
  ctaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 13, paddingHorizontal: 14 },
  segTrack: { flex: 1, maxWidth: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  segFill: { height: '100%', borderRadius: 2, backgroundColor: colors.p500 },
  segFillActive: { height: '100%', borderRadius: 2, backgroundColor: colors.p500 },
});
