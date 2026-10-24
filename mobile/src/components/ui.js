import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, font, fonts, shadow, getScheme } from '../theme/theme';

// Space so scroll content clears the floating bottom tab bar.
export const TAB_SPACE = 108;

/* ---------- Text ---------- */
export function Txt({ style, weight, children, ...rest }) {
  const fam = weight ? fonts[weight] || fonts.body : fonts.body;
  return <Text style={[{ fontFamily: fam, color: colors.text }, style]} {...rest}>{children}</Text>;
}

/* ---------- Eyebrow (tiny uppercase violet label) ---------- */
export function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/* ---------- SectionHeader (eyebrow + extrabold title + View All ->) ---------- */
export function SectionHeader({ eyebrow, title, actionLabel = 'View All', onAction, style }) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
      </View>
      {onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} style={styles.viewAll}>
          <Text style={styles.viewAllText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.secondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ---------- GradientButton (primary violet->indigo / seller emerald->teal) ---------- */
export function GradientButton({ label, icon, onPress, variant = 'primary', colorsArr, loading, disabled, style, height = 50 }) {
  const grad = colorsArr || (variant === 'seller' ? gradients.seller : gradients.primary);
  const glow = variant === 'seller' ? shadow.card : shadow.violetGlow;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={loading || disabled} style={[glow, style]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, { height, opacity: disabled ? 0.6 : 1 }]}>
        {loading ? <ActivityIndicator color={colors.white} /> : (
          <>
            {icon ? <Ionicons name={icon} size={17} color={colors.white} /> : null}
            <Text style={styles.btnText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ---------- Badge (discount / sale / gift / sponsored) ---------- */
const BADGE = {
  discount: { grad: gradients.sale, color: colors.white },
  sale: { grad: gradients.shopSale, color: colors.white },
  gift: { grad: gradients.gift, color: colors.white, icon: 'gift' },
  sponsored: { grad: gradients.sponsored, color: colors.sponsoredText, icon: 'star', pill: true },
};
export function Badge({ variant = 'discount', label, style }) {
  const b = BADGE[variant] || BADGE.discount;
  return (
    <LinearGradient
      colors={b.grad}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={[styles.badge, b.pill && styles.badgePill, style]}
    >
      {b.icon ? <Ionicons name={b.icon} size={9} color={b.color} /> : null}
      <Text style={[styles.badgeText, { color: b.color }, variant === 'sponsored' && styles.badgeSponsoredText]}>{label}</Text>
    </LinearGradient>
  );
}

/* ---------- Pill (category / quick filter chip) ---------- */
export function Pill({ label, icon, active, onPress, accentBg, accentText, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        active ? { backgroundColor: accentBg || colors.primarySoft } : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={active ? (accentText || colors.violet700) : colors.textSecondary} /> : null}
      <Text style={[styles.pillText, { color: active ? (accentText || colors.violet700) : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, onPress }) {
  const Comp = onPress ? TouchableOpacity : View;
  return <Comp activeOpacity={0.9} onPress={onPress} style={[styles.card, style]}>{children}</Comp>;
}

/* ---------- SkeletonBlock (pulsing slate-200) ---------- */
/* Skeleton placeholder with a light shimmer sweeping across (scheme-aware). */
export function SkeletonBlock({ width = '100%', height = 16, radius: r = radius.sm, style }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const dark = getScheme() === 'dark';
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1150, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View
      onLayout={(e) => { const bw = e.nativeEvent.layout.width; if (bw && bw !== w) setW(bw); }}
      style={[{ width, height, borderRadius: r, backgroundColor: colors.border, overflow: 'hidden' }, style]}
    >
      {w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['transparent', dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* Product-card-shaped skeleton (image + 2 title lines + price), used in grids. */
export function ProductCardSkeleton({ style }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card }, style]}>
      <SkeletonBlock height={150} radius={0} />
      <View style={{ padding: 9, gap: 6 }}>
        <SkeletonBlock width="82%" height={11} radius={4} />
        <SkeletonBlock width="55%" height={11} radius={4} />
        <SkeletonBlock width="42%" height={15} radius={4} style={{ marginTop: 3 }} />
      </View>
    </View>
  );
}

/* ---------- Reveal / infinite-scroll skeletons ---------- */
/* A 2-col grid of product-card skeletons — use as the ListFooterComponent while
 * the next batch reveals, or as the initial loading state for product grids. */
export function SkeletonGrid({ count = 4, columns = 2, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 4 }, style]}>
      {[...Array(count)].map((_, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingHorizontal: 5, marginBottom: 10 }}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/* A vertical stack of full-width block skeletons — use for row/card lists
 * (orders, shops, users, messages) as a footer while revealing or as initial load. */
export function SkeletonRows({ count = 4, height = 92, gap = 12, radius: r = radius.md, style }) {
  return (
    <View style={[{ paddingHorizontal: 16, gap }, style]}>
      {[...Array(count)].map((_, i) => <SkeletonBlock key={i} height={height} radius={r} />)}
    </View>
  );
}

/* Small centered spinner-free footer used when revealing more rows in a list. */
export function ListFooterSkeleton({ variant = 'rows', count = 2, height = 92 }) {
  return variant === 'grid'
    ? <SkeletonGrid count={count} style={{ marginTop: 0 }} />
    : <SkeletonRows count={count} height={height} style={{ marginTop: 12, marginBottom: 4 }} />;
}

/* ---------- Loading / Empty / StackHeader ---------- */
export function Loading({ text }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={styles.muted}>{text}</Text> : null}
    </View>
  );
}

export function Empty({ icon = 'sad-outline', title = 'Nothing here yet', subtitle }) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={34} color={colors.violet} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function StackHeader({ navigation, title, subtitle, right, gradient = true }) {
  const insets = useSafeAreaInsets();
  const Bg = gradient ? LinearGradient : View;
  const bgProps = gradient
    ? { colors: gradients.primary, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
    : { style: { backgroundColor: colors.surface } };
  return (
    <Bg {...bgProps} style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={gradient ? colors.white : colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.hTitle, { color: gradient ? colors.white : colors.ink }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.hSub, { color: gradient ? 'rgba(255,255,255,0.85)' : colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </Bg>
  );
}

/* ---------- Logo wordmark: Open(green) Market(purple) lb ---------- */
// Wordmark lives in its own module (see Wordmark.js) so App.js's splash can use it
// without eagerly importing this file (whose StyleSheet would bake brand colors early).
export { Wordmark } from './Wordmark';

/**
 * Input — the app's shared text field. Compact + simple, with a live focus glow
 * (animated border, soft fill, halo ring) that's fully token-driven, so it re-skins
 * with the admin palette. Supports label, leading icon, prefix (e.g. "+961"), a right
 * node, a built-in secure toggle, a valid ✓, an error message, and multiline.
 * Works with the global <TextInput> patch (smaller text + branded caret).
 */
export const Input = React.forwardRef(function Input(
  { label, icon, prefix, right, valid, error, highlight, multiline, secureToggle, containerStyle, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const [hide, setHide] = React.useState(true);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: focused ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [focused, a]);

  const bad = !!error;
  // Focus is one quiet signal: the border tints to the brand primary. The halo ring
  // and the fill swap that used to fire alongside it made selecting a field feel busy.
  const borderColor = bad ? colors.sale : highlight ? colors.seller : a.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.inLabel}>{label}</Text> : null}
      <View>
        <Animated.View style={[styles.inWrap, multiline && styles.inWrapMulti, { borderColor }]}>
          {icon ? <Ionicons name={icon} size={17} color={focused ? colors.primary : colors.textMuted} style={multiline && { marginTop: 2 }} /> : null}
          {prefix ? <Text style={styles.inPrefix}>{prefix}</Text> : null}
          <TextInput
            ref={ref}
            {...props}
            style={[styles.inField, multiline && styles.inFieldMulti, style]}
            placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
            multiline={multiline}
            secureTextEntry={secureToggle ? hide : props.secureTextEntry}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          />
          {secureToggle ? (
            <TouchableOpacity onPress={() => setHide((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={hide ? 'eye-outline' : 'eye-off-outline'} size={17} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          {valid ? <Ionicons name="checkmark-circle" size={16} color={colors.seller} /> : null}
          {right}
        </Animated.View>
      </View>
      {bad && typeof error === 'string' ? <Text style={styles.inError}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  inLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary, marginBottom: 6, marginLeft: 2 },
  inWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.surfaceMuted },
  // A pill-shaped multiline box looks wrong once it grows — square it off a little.
  inWrapMulti: { alignItems: 'flex-start', paddingVertical: 8, minHeight: 68, borderRadius: radius.lg },
  inField: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink, paddingVertical: 0 },
  inFieldMulti: { textAlignVertical: 'top', minHeight: 58, paddingTop: 1 },
  inPrefix: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  inError: { fontFamily: fonts.medium, fontSize: 11, color: colors.sale, marginTop: 5, marginLeft: 2 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.secondary, marginBottom: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.5, color: colors.ink },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 10 },
  viewAllText: { fontFamily: fonts.semibold, color: colors.secondary, fontSize: 13 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 18 },
  btnText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: radius.badge },
  badgePill: { borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.2 },
  badgeSponsoredText: { fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.medium, fontSize: 12, maxWidth: 130 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  muted: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, ...shadow.card },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  hTitle: { fontFamily: fonts.extrabold, fontSize: 18 },
  hSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
