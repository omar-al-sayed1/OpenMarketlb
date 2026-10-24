import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, fonts, shadow } from '../../theme/theme';

/* gradient hero header with icon + title + optional right action */
export function GrowthHero({ colors: grad, icon, title, subtitle, right }) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={[styles.blob, { top: -24, right: -24 }]} />
      <View style={styles.heroIcon}><Ionicons name={icon} size={24} color={colors.white} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </LinearGradient>
  );
}

/* pill save button (used inside heroes) */
export function SavePill({ onPress, saving, label = 'Save', tint = 'rgba(255,255,255,0.25)' }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={saving} activeOpacity={0.85} style={[styles.savePill, { backgroundColor: tint }]}>
      <Ionicons name={saving ? 'sync' : 'save'} size={14} color={colors.white} />
      <Text style={styles.savePillText}>{saving ? 'Saving…' : label}</Text>
    </TouchableOpacity>
  );
}

/* number stepper with − / + and editable field */
export function Stepper({ value, onChange, step = 1, min = 0, max = 999999, prefix = '', suffix = '', decimals = 0, tint = colors.violet }) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  const fmt = (n) => (decimals ? Number(n).toFixed(decimals) : String(n));
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={() => onChange(clamp(Number(value) - step))} style={[styles.stepBtn, { borderColor: tint }]}><Ionicons name="remove" size={16} color={tint} /></TouchableOpacity>
      <View style={styles.stepValWrap}>
        {prefix ? <Text style={styles.stepAffix}>{prefix}</Text> : null}
        <TextInput style={styles.stepInput} value={fmt(value)} onChangeText={(t) => onChange(clamp(parseFloat(t) || 0))} keyboardType="numeric" />
        {suffix ? <Text style={styles.stepAffix}>{suffix}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => onChange(clamp(Number(value) + step))} style={[styles.stepBtn, { borderColor: tint }]}><Ionicons name="add" size={16} color={tint} /></TouchableOpacity>
    </View>
  );
}

/* labeled toggle row inside a soft tinted card */
export function ToggleRow({ title, desc, value, onValueChange, bg = colors.surfaceMuted, border = colors.borderLight, trackTint = colors.violet, children }) {
  return (
    <View style={[styles.toggleRow, { backgroundColor: bg, borderColor: border }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {desc ? <Text style={styles.toggleDesc}>{desc}</Text> : null}
        {children}
      </View>
      <Switch value={!!value} onValueChange={onValueChange} trackColor={{ true: trackTint, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

/* section card with soft gradient header */
export function GrowthCard({ title, icon, iconColor = colors.violet, headColors, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        headColors ? (
          <LinearGradient colors={headColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardHeadGrad}>
            <Ionicons name={icon} size={15} color={iconColor} /><Text style={styles.cardTitle}>{title}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.cardHead}><Ionicons name={icon} size={15} color={iconColor} /><Text style={styles.cardTitle}>{title}</Text></View>
        )
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/* animated staggered checkmark row */
export function CheckRow({ label, index = 0, tint = '#34d399' }) {
  const a = useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(a, { toValue: 1, duration: 300, delay: 120 + index * 70, useNativeDriver: true }).start(); }, []); // eslint-disable-line
  return (
    <Animated.View style={[styles.checkRow, { opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
      <View style={[styles.checkDot, { backgroundColor: tint }]}><Ionicons name="checkmark" size={11} color="#065f46" /></View>
      <Text style={styles.checkText}>{label}</Text>
    </Animated.View>
  );
}

export const Seg = ({ items, value, onChange }) => (
  <View style={styles.seg}>
    {items.map((it) => {
      const active = value === it.key;
      return (
        <TouchableOpacity key={it.key} onPress={() => onChange(it.key)} activeOpacity={0.85} style={[styles.segBtn, active && (it.grad ? null : styles.segActive)]}>
          {active && it.grad ? <LinearGradient colors={it.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
          {it.icon ? <Ionicons name={it.icon} size={14} color={active ? colors.white : colors.textMuted} /> : null}
          <Text style={[styles.segText, active && { color: colors.white }]}>{it.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xxl, padding: 18, overflow: 'hidden', marginBottom: 14, ...shadow.card },
  blob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  savePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  savePillText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepValWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: colors.border, height: 34 },
  stepAffix: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  stepInput: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', minWidth: 40, paddingVertical: 0 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, padding: 12, marginBottom: 8 },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  toggleDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: 12, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, paddingBottom: 0 },
  cardHeadGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  cardBody: { padding: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, overflow: 'hidden' },
  segActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  segText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
});
