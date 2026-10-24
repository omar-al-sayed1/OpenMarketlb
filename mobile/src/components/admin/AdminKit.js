import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, admin, radius, fonts, shadow } from '../../theme/theme';

/* ---------- Screen wrapper: diagonal wash + violet pull-to-refresh ---------- */
export function AdminScreen({ children, refreshing, onRefresh, contentStyle, testID, onEndReached, onScroll }) {
  // Fires onEndReached near the bottom so a screen can reveal its next batch of rows.
  const handleScroll = onEndReached || onScroll ? (e) => {
    onScroll?.(e);
    if (onEndReached) {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) onEndReached();
    }
  } : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: admin.bg }} testID={testID}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={[{ padding: 14, paddingBottom: 40 }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.violet} colors={[colors.violet]} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/* ---------- Admin top bar (sticky gradient) ---------- */
export function AdminTopBar({ title, onMenu, right }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={admin.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 6 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenu} style={styles.topBtn} activeOpacity={0.8}><Ionicons name="menu" size={22} color={colors.white} /></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
    </LinearGradient>
  );
}

/* ---------- Floating particle ---------- */
function Particle({ style, delay = 0, dur = 4000 }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a, delay, dur]);
  return <Animated.View style={[style, { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]} />;
}

/* ---------- Hero card ---------- */
export function AdminHeroCard({ title, subtitle, icon = 'shield-checkmark', actions, titleTestID }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, [fade]);
  return (
    <Animated.View style={[styles.hero, { opacity: fade }]}>
      <View style={[styles.blob, { top: -30, right: -30, backgroundColor: 'rgba(99,102,241,0.10)' }]} />
      <View style={[styles.blob, { bottom: -40, left: -20, width: 90, height: 90, backgroundColor: 'rgba(139,92,246,0.08)' }]} />
      <Particle style={[styles.particle, { top: 24, right: 90 }]} />
      <Particle style={[styles.particle, { bottom: 20, right: 40 }]} delay={1000} dur={3000} />
      <View style={styles.heroRow}>
        <LinearGradient colors={admin.heroTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroTile}>
          <Ionicons name={icon} size={26} color={colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle} testID={titleTestID}>{title}</Text>
          {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {actions ? <View style={styles.heroActions}>{actions}</View> : null}
    </Animated.View>
  );
}

/* pill action button for the hero */
export function PillButton({ label, icon, onPress, variant = 'outline', loading, busyLabel, testID }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40 }).start();
  if (variant === 'primary') {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={() => press(0.97)} onPressOut={() => press(1)} disabled={loading} testID={testID}>
          <LinearGradient colors={admin.heroTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillPrimary}>
            <Ionicons name={loading ? 'sync' : icon} size={14} color={colors.white} />
            <Text style={styles.pillPrimaryText}>{loading ? (busyLabel || 'Working…') : label}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.pillOutline} activeOpacity={0.8} onPress={onPress} onPressIn={() => press(0.97)} onPressOut={() => press(1)} testID={testID}>
        <Ionicons name={icon} size={14} color={colors.violet} />
        <Text style={styles.pillOutlineText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ---------- Count-up text ---------- */
export function CountUp({ value = 0, prefix = '', suffix = '', decimals = 0, style, testID }) {
  const a = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState(prefix + (0).toFixed(decimals) + suffix);
  useEffect(() => {
    a.setValue(0);
    const id = a.addListener(({ value: v }) => setTxt(prefix + (v * value).toFixed(decimals) + suffix));
    Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]); // eslint-disable-line
  return <Text style={style} testID={testID}>{txt}</Text>;
}

/* ---------- Stat card ---------- */
export function AdminStatCard({ label, value, prefix, suffix, decimals, icon, variant = 'blue', index = 0, testID, subtext }) {
  const tile = admin.tiles[variant] || admin.tiles.blue;
  const slide = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 400, delay: 100 + index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide, index]);
  const onIn = () => Animated.spring(orb, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  const onOut = () => Animated.spring(orb, { toValue: 0, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ flex: 1, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <TouchableOpacity activeOpacity={0.9} onPressIn={onIn} onPressOut={onOut} style={styles.stat} testID={testID}>
        <Animated.View style={[styles.orb, { backgroundColor: tile.grad[1], opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.14] }), transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }]} />
        <Animated.View style={{ transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}>
          <LinearGradient colors={tile.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.statTile, { shadowColor: tile.shadow }]}>
            <Ionicons name={icon} size={19} color={colors.white} />
          </LinearGradient>
        </Animated.View>
        <CountUp value={Number(value) || 0} prefix={prefix} suffix={suffix} decimals={decimals} style={styles.statValue} />
        <Text style={styles.statLabel}>{label}</Text>
        {subtext ? <Text style={styles.statSub} numberOfLines={2}>{subtext}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ---------- Status pill ---------- */
export function StatusPill({ label, variant = 'slate' }) {
  const [bg, fg] = admin.pills[variant] || admin.pills.slate;
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]}>{label}</Text></View>;
}

/* ---------- Section card ---------- */
export function AdminCard({ title, icon, right, children, style, testID }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {title ? (
        <View style={styles.cardHead}>
          {icon ? <Ionicons name={icon} size={16} color={colors.violet} /> : null}
          <Text style={styles.cardTitle}>{title}</Text>
          <View style={{ flex: 1 }} />
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/* ---------- Shimmer skeleton ---------- */
export function Shimmer({ width = '100%', height = 16, radius: r = 8, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false })).start(); }, [a]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['#e2e8f0', '#eef2f7', '#e2e8f0'] }) }, style]} />;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12 },
  topBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.3 },
  hero: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: 18, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card, marginBottom: 14 },
  blob: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  particle: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(139,92,246,0.4)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTile: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  heroSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  pillOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillOutlineText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  pillPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  pillPrimaryText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  orb: { position: 'absolute', top: -18, right: -18, width: 56, height: 56, borderRadius: 28 },
  statTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  statSub: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 3 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card, marginTop: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
});
