import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing, Switch, useWindowDimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, tapLight } from '../../lib/haptics';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { GrowthHero } from '../../components/admin/GrowthKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

/* pulsing OFF badge */
function PulseBadge({ text }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([
    Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
    Animated.timing(a, { toValue: 0, duration: 700, useNativeDriver: true }),
  ])).start(); }, []); // eslint-disable-line
  return <Animated.View style={[styles.saleBadge, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}><Text style={styles.saleBadgeText}>{text}</Text></Animated.View>;
}

function ThemeCard({ theme, usage, onToggle, onSave, onProOnly, onPrice }) {
  const flip = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  const doFlip = () => { tapLight(); const to = flipped ? 0 : 1; setFlipped(!flipped); Animated.spring(flip, { toValue: to, useNativeDriver: true, friction: 8, tension: 60 }).start(); };
  const paintSweep = () => { sweep.setValue(0); Animated.timing(sweep, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); };
  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View style={[styles.themeCard, !theme.enabled && { opacity: 0.55 }]}>
      {/* sweep overlay */}
      <Animated.View pointerEvents="none" style={[styles.sweep, { backgroundColor: theme.preview_color, opacity: sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0] }), transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] }) }] }]} />
      <TouchableOpacity activeOpacity={0.9} onPress={doFlip} style={styles.flipArea}>
        <Animated.View style={[styles.face, { transform: [{ perspective: 800 }, { rotateY: frontRot }], backfaceVisibility: 'hidden' }]}>
          <LinearGradient colors={[`${theme.preview_color}22`, `${theme.preview_color}66`]} style={styles.themeHeader}>
            <View style={[styles.themeSwatch, { backgroundColor: theme.preview_color }]}><Ionicons name="color-palette" size={22} color={colors.white} /></View>
            {theme.is_default ? <View style={styles.defaultChip}><Text style={styles.defaultText}>DEFAULT</Text></View> : null}
            {usage > 0 ? <View style={styles.usageChip}><Ionicons name="bag" size={9} color={colors.white} /><Text style={styles.usageText}>{usage}</Text></View> : null}
          </LinearGradient>
          <Text style={styles.themeName} numberOfLines={1}>{theme.name}</Text>
          <Text style={styles.themeBest} numberOfLines={1}>{theme.best_for}</Text>
          <Text style={styles.tapHint}>tap to flip →</Text>
        </Animated.View>
        <Animated.View style={[styles.face, styles.faceBack, { transform: [{ perspective: 800 }, { rotateY: backRot }], backfaceVisibility: 'hidden' }]}>
          <Text style={styles.backTitle}>{theme.name}</Text>
          <Text style={styles.backDesc} numberOfLines={4}>{theme.description}</Text>
          <View style={styles.paletteRow}>
            <View style={[styles.paletteDot, { backgroundColor: theme.preview_color }]} />
            <Text style={styles.paletteHex}>{theme.preview_color}</Text>
            <View style={styles.catChip}><Text style={styles.catText}>{theme.category || 'general'}</Text></View>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* controls */}
      <View style={styles.controls}>
        <View style={styles.ctrlRow}>
          <Text style={styles.ctrlLabel}>Enabled</Text>
          <Switch value={!!theme.enabled} onValueChange={(v) => onToggle(v)} trackColor={{ true: colors.violet, false: colors.border }} thumbColor={colors.white} />
        </View>
        {!theme.is_default ? (
          <>
            <View style={styles.priceRow}>
              <Ionicons name="cash-outline" size={15} color={colors.textMuted} />
              <TextInput style={styles.priceInput} value={String(theme.price_usd ?? 0)} onChangeText={(t) => onPrice(parseFloat(t) || 0)} keyboardType="numeric" />
              <TouchableOpacity onPress={() => { onSave(); paintSweep(); }} style={styles.saveBtn}><Ionicons name="save-outline" size={13} color={colors.violet} /><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
            <View style={styles.proRow}>
              <Text style={styles.proLabel}>👑 Pro Only</Text>
              <Switch value={!!theme.pro_only} onValueChange={(v) => { onProOnly(v); paintSweep(); }} trackColor={{ true: colors.amber, false: colors.border }} thumbColor={colors.white} />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function AdminThemesScreen() {
  const { width } = useWindowDimensions();
  const cardW = (width - 28 - 12) / 2; // AdminScreen padding 14×2, gap 12 → 2 per row
  const [themes, setThemes] = useState([]);
  const [usage, setUsage] = useState({});
  const [salePercent, setSalePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSale, setSavingSale] = useState(false);

  const load = useCallback(async () => {
    const [t, s, sale] = await Promise.allSettled([api.admin.getStorefrontThemes(), api.admin.getShops(), api.themeSale.get()]);
    if (t.status === 'fulfilled') setThemes(t.value.data.themes || []);
    if (s.status === 'fulfilled') { const u = {}; (s.value.data.shops || s.value.data || []).forEach((sh) => { const k = sh.theme || 'classic'; u[k] = (u[k] || 0) + 1; }); setUsage(u); }
    if (sale.status === 'fulfilled') setSalePercent(sale.value.data.theme_sale_percent || 0);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setTheme = (key, patch) => setThemes((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const saveTheme = async (theme, updates) => { try { await api.admin.updateStorefrontTheme(theme.key, updates); notifySuccess(); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not update.'); load(); } };
  const saveSale = async () => { setSavingSale(true); try { await api.admin.setThemeSalePercent(salePercent); notifySuccess(); } catch (_) { Alert.alert('Failed', 'Could not set sale.'); } finally { setSavingSale(false); } };

  const enabledCount = themes.filter((t) => t.enabled).length;
  const totalUsing = Object.values(usage).reduce((a, b) => a + b, 0);

  if (loading) return <AdminScreen><Shimmer height={90} radius={radius.xxl} /><View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}><Shimmer height={200} radius={radius.lg} style={{ flex: 1 }} /><Shimmer height={200} radius={radius.lg} style={{ flex: 1 }} /></View></AdminScreen>;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <GrowthHero colors={[colors.p450, colors.p600]} icon="color-palette" title="Storefront Themes" subtitle="Manage, review, and price shop themes" />

      <View style={styles.statRow}>
        <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="color-palette" size={15} color={colors.violet} /></View><CountUp value={themes.length} style={styles.statVal} /><Text style={styles.statLabel}>Total Themes</Text></View>
        <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: colors.sellerSoft }]}><Ionicons name="checkmark" size={15} color={colors.seller} /></View><Text style={styles.statVal}>{enabledCount}/{themes.length}</Text><Text style={styles.statLabel}>Enabled</Text></View>
        <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}><Ionicons name="bag" size={15} color="#2563eb" /></View><CountUp value={totalUsing} style={styles.statVal} /><Text style={styles.statLabel}>Shops Using</Text></View>
      </View>

      {/* global sale */}
      <LinearGradient colors={['#fff1f2', '#fff7ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.saleTitle}>💲 Global Theme Sale</Text>
          <Text style={styles.saleDesc}>Discount % applied to all theme prices</Text>
          {salePercent > 0 ? <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><PulseBadge text={`${salePercent}% OFF ALL THEMES`} /></View> : null}
        </View>
        <View style={styles.saleControls}>
          <TextInput style={styles.saleInput} value={String(salePercent)} onChangeText={(t) => setSalePercent(Math.min(100, Math.max(0, parseInt(t) || 0)))} keyboardType="numeric" />
          <Text style={styles.salePct}>%</Text>
          <TouchableOpacity onPress={saveSale} disabled={savingSale} style={styles.saleSaveBtn}><Ionicons name="save" size={13} color={colors.white} /><Text style={styles.saleSaveText}>{savingSale ? '…' : 'Save'}</Text></TouchableOpacity>
        </View>
      </LinearGradient>

      {/* theme grid — 2 per row */}
      <View style={styles.grid}>
        {themes.map((theme) => (
          <View key={theme.key} style={{ width: cardW }}>
            <ThemeCard theme={theme} usage={usage[theme.key] || 0}
              onToggle={(v) => { setTheme(theme.key, { enabled: v }); saveTheme(theme, { enabled: v }); }}
              onPrice={(v) => setTheme(theme.key, { price_usd: v })}
              onSave={() => saveTheme(theme, { price_usd: theme.price_usd, pro_only: theme.pro_only })}
              onProOnly={(v) => { setTheme(theme.key, { pro_only: v }); saveTheme(theme, { pro_only: v }); }} />
          </View>
        ))}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, ...shadow.card },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  saleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: '#fecdd3', padding: 14, marginBottom: 14 },
  saleTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: '#9f1239' },
  saleDesc: { fontFamily: fonts.body, fontSize: 11, color: '#e11d48', marginTop: 2 },
  saleControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saleInput: { width: 52, height: 38, backgroundColor: colors.white, borderWidth: 1, borderColor: '#fecdd3', borderRadius: 10, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  salePct: { fontFamily: fonts.bold, fontSize: 14, color: '#e11d48' },
  saleSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e11d48', paddingHorizontal: 12, height: 38, borderRadius: 10 },
  saleSaveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  saleBadge: { backgroundColor: '#f43f5e', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  saleBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 80, zIndex: 5, transform: [{ skewX: '-20deg' }] },
  flipArea: { height: 150 },
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 0 },
  faceBack: { padding: 12, justifyContent: 'center' },
  themeHeader: { height: 84, alignItems: 'center', justifyContent: 'center' },
  themeSwatch: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  defaultChip: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.seller, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  defaultText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8 },
  usageChip: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2563eb', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  usageText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9 },
  themeName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 8, marginHorizontal: 12 },
  themeBest: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginHorizontal: 12, marginTop: 1 },
  tapHint: { fontFamily: fonts.medium, fontSize: 9, color: colors.violet, marginHorizontal: 12, marginTop: 4 },
  backTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  backDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 6, lineHeight: 16 },
  paletteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  paletteDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  paletteHex: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  catChip: { marginLeft: 'auto', backgroundColor: colors.bgAlt, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  catText: { fontFamily: fonts.semibold, fontSize: 9, color: colors.textSecondary, textTransform: 'capitalize' },
  controls: { padding: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctrlLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  priceInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, height: 34, paddingHorizontal: 8, fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, height: 34 },
  saveText: { fontFamily: fonts.bold, fontSize: 11, color: colors.violet },
  proRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  proLabel: { fontFamily: fonts.semibold, fontSize: 11, color: '#92400e' },
});
