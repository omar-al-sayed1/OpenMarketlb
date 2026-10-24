import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl, Easing, PanResponder, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { TAB_SPACE } from '../ui';

/* ---------- Screen wrapper: per-page wash + emerald pull-to-refresh ---------- */
export function ShopScreenWrap({ children, wash = shop.wash, refreshing, onRefresh, contentStyle, scrollRef, onEndReached, onScroll, ...rest }) {
  // Fires onEndReached once the user scrolls within `threshold`px of the bottom —
  // lets a screen reveal its next batch of rows (incremental infinite scroll).
  const handleScroll = onEndReached || onScroll ? (e) => {
    onScroll?.(e);
    if (onEndReached) {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) onEndReached();
    }
  } : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: shop.bg }} {...rest}>
      <LinearGradient colors={wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={[{ padding: 14, paddingBottom: TAB_SPACE + 20 }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.seller} colors={[colors.seller]} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/* ---------- Shop top bar (emerald-600 -> teal-600 -> cyan-600, frosted buttons) ---------- */
export function ShopTopBar({ title, onMenu, right }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={shop.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 6 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenu} style={styles.topBtn} activeOpacity={0.8}><Ionicons name="menu" size={21} color={colors.white} /></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        {right}
      </View>
    </LinearGradient>
  );
}

/* ---------- Entrance: fadeIn / slideUp cascade (web keyframes) ---------- */
export function Rise({ delay = 0, duration = 500, distance = 18, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay, duration]);
  return (
    <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ---------- ScaleIn (revenue number pop) ---------- */
export function ScaleIn({ delay = 0, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [a, delay]);
  return <Animated.View style={[{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }, style]}>{children}</Animated.View>;
}

/* ---------- Floating particle (float keyframe) ---------- */
export function Float({ style, delay = 0, dur = 4000, amplitude = 6, children }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a, delay, dur]);
  return (
    <Animated.View style={[style, { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* ---------- Pulse (low-stock rows, badges) ---------- */
export function Pulse({ children, style, min = 0.55, dur = 900 }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: min, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, [a, min, dur]);
  return <Animated.View style={[style, { opacity: a }]}>{children}</Animated.View>;
}

/* ---------- Count-up money / numbers ---------- */
export function CountUp({ value = 0, prefix = '', suffix = '', decimals = 0, style, ...rest }) {
  const a = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState(prefix + (0).toFixed(decimals) + suffix);
  useEffect(() => {
    a.setValue(0);
    const id = a.addListener(({ value: v }) => setTxt(prefix + (v * value).toFixed(decimals) + suffix));
    Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]); // eslint-disable-line
  return <Text style={style} {...rest}>{txt}</Text>;
}

/* ---------- Press feedback 0.97 spring wrapper ---------- */
export function PressScale({ onPress, disabled, children, style, activeOpacity = 0.9 }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: s }] }, style]}>
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} disabled={disabled}
        onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ---------- Gradient pill button with spinner->checkmark morph ---------- */
export function MorphButton({ label, icon, grad = shop.activePill, onPress, loading, success, disabled, small, style, textColor = colors.white }) {
  return (
    <PressScale onPress={onPress} disabled={loading || disabled} style={style}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.morphBtn, small && styles.morphBtnSm, disabled && { opacity: 0.6 }]}>
        {loading ? <Spinner size={small ? 13 : 15} color={textColor} />
          : success ? <Ionicons name="checkmark" size={small ? 14 : 16} color={textColor} />
          : icon ? <Ionicons name={icon} size={small ? 13 : 15} color={textColor} /> : null}
        <Text style={[styles.morphBtnText, small && { fontSize: 11 }, { color: textColor }]}>{label}</Text>
      </LinearGradient>
    </PressScale>
  );
}

/* solid/outline variant */
export function SoftButton({ label, icon, onPress, color = colors.seller, bg = colors.surface, border = colors.border, loading, small, style }) {
  return (
    <PressScale onPress={onPress} disabled={loading} style={style}>
      <View style={[styles.morphBtn, small && styles.morphBtnSm, { backgroundColor: bg, borderWidth: 1, borderColor: border }]}>
        {loading ? <Spinner size={small ? 13 : 15} color={color} /> : icon ? <Ionicons name={icon} size={small ? 13 : 15} color={color} /> : null}
        <Text style={[styles.morphBtnText, small && { fontSize: 11 }, { color }]}>{label}</Text>
      </View>
    </PressScale>
  );
}

/* ---------- Spinner (rotating loader glyph) ---------- */
export function Spinner({ size = 16, color = colors.white }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })).start();
  }, [a]);
  return (
    <Animated.View style={{ transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Ionicons name="sync" size={size} color={color} />
    </Animated.View>
  );
}

/* ---------- Section card ---------- */
export function ShopCard({ children, style, ...rest }) {
  return <View style={[styles.card, style]} {...rest}>{children}</View>;
}

/* card header: gradient icon tile + title + sub + right */
export function CardHead({ icon, grad = shop.activePill, title, sub, right, float }) {
  const Tile = (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headTile}>
      <Ionicons name={icon} size={16} color={colors.white} />
    </LinearGradient>
  );
  return (
    <View style={styles.cardHead}>
      {float ? <Float dur={3000}>{Tile}</Float> : Tile}
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- Status pill ---------- */
export function ShopPill({ label, variant = 'slate', pulse }) {
  const [bg, fg] = shop.pills[variant] || shop.pills.slate;
  const inner = <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]}>{label}</Text></View>;
  return pulse ? <Pulse>{inner}</Pulse> : inner;
}

/* ---------- Shimmer skeleton ---------- */
export function Shimmer({ width = '100%', height = 16, radius: r = 8, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false })).start(); }, [a]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['#e2e8f0', '#eef2f7', '#e2e8f0'] }) }, style]} />;
}

/* ---------- Single-thumb slider (native stand-in for the web <Slider>) ---------- */
export function SingleSlider({ min = 0, max = 100, step = 1, value = 0, onChange, disabled, tint = '#10b981', testID }) {
  const [width, setWidth] = useState(0);
  const stateRef = useRef({});
  stateRef.current = { min, max, step, width, onChange, disabled, value };

  const pan = useRef(null);
  if (!pan.current) {
    pan.current = PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.disabled,
      onMoveShouldSetPanResponder: () => !stateRef.current.disabled,
      onPanResponderGrant: (e) => {
        const { min: mn, max: mx, step: stp, width: w, onChange: emit, disabled: dis } = stateRef.current;
        if (dis || !w) return;
        const x = e.nativeEvent.locationX;
        const raw = mn + (Math.min(Math.max(x, 0), w) / w) * (mx - mn);
        emit(Math.min(mx, Math.max(mn, Math.round(raw / stp) * stp)));
        stateRef.current.startValue = stateRef.current.value;
        stateRef.current.grabX = x;
      },
      onPanResponderMove: (e, g) => {
        const { min: mn, max: mx, step: stp, width: w, onChange: emit, disabled: dis, grabX } = stateRef.current;
        if (dis || !w) return;
        const x = (grabX ?? 0) + g.dx;
        const raw = mn + (Math.min(Math.max(x, 0), w) / w) * (mx - mn);
        emit(Math.min(mx, Math.max(mn, Math.round(raw / stp) * stp)));
      },
    });
  }

  const pct = max > min ? ((value - min) / (max - min)) : 0;
  return (
    <View style={[sliderSt.wrap, disabled && { opacity: 0.5 }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID={testID}
      {...pan.current.panHandlers}>
      <View style={sliderSt.track} />
      <View style={[sliderSt.fill, { width: `${pct * 100}%`, backgroundColor: tint }]} />
      <View style={[sliderSt.thumb, { left: Math.max(0, pct * width - 11), borderColor: tint }]} />
    </View>
  );
}
const sliderSt = StyleSheet.create({
  wrap: { height: 34, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border },
  fill: { position: 'absolute', height: 5, borderRadius: 3 },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 2.5, ...shadow.card },
});

/* ---------- Toast (sonner stand-in): host stack + toast() ----------
   Hosts register on mount; the most-recently-mounted one shows the toast, and
   unmounting restores the previous host (nested navigators don't break it). */
const toastHosts = [];
const emitToast = (msg, type) => { const fn = toastHosts[toastHosts.length - 1]; if (fn) fn(msg, type); };
export const toast = {
  success: (msg) => emitToast(msg, 'success'),
  error: (msg) => emitToast(msg, 'error'),
  info: (msg) => emitToast(msg, 'info'),
};
export function ToastHost() {
  const [item, setItem] = useState(null);
  const a = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const fn = (msg, type) => {
      if (timer.current) clearTimeout(timer.current);
      setItem({ msg, type });
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setItem(null));
      }, 2600);
    };
    toastHosts.push(fn);
    return () => { const i = toastHosts.indexOf(fn); if (i >= 0) toastHosts.splice(i, 1); if (timer.current) clearTimeout(timer.current); };
  }, [a]);
  if (!item) return null;
  const tone = item.type === 'success'
    ? { border: '#a7f3d0', dot: colors.seller, icon: 'checkmark' }
    : item.type === 'info'
    ? { border: colors.p200, dot: colors.violet, icon: 'information' }
    : { border: '#fecdd3', dot: colors.sale, icon: 'close' };
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + 60, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
      <View style={[styles.toastInner, { borderColor: tone.border }]}>
        <View style={[styles.toastDot, { backgroundColor: tone.dot }]}>
          <Ionicons name={tone.icon} size={11} color={colors.white} />
        </View>
        <Text style={styles.toastText} numberOfLines={2}>{item.msg}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingBottom: 12 },
  topBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: colors.white, fontFamily: fonts.heading, fontSize: 16.5, letterSpacing: -0.3 },
  morphBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  morphBtnSm: { paddingHorizontal: 12, paddingVertical: 7 },
  morphBtnText: { fontFamily: fonts.bold, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  headTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize', letterSpacing: 0.2 },
  toast: { position: 'absolute', left: 20, right: 20, zIndex: 999, alignItems: 'center' },
  toastInner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, ...shadow.emphasis, maxWidth: '100%' },
  toastDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toastText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, flexShrink: 1 },
});
