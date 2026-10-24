import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { GrowthHero, Stepper, ToggleRow, GrowthCard, CheckRow } from '../../components/admin/GrowthKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';

const PRICE_MIN = 15, PRICE_MAX = 25;
const DEFAULT_FEATURES = ['1 free Lucky Spin every month', '2 free product sponsor credits every month', 'Lower commission on your sales', 'Full storefront theme customisation', 'Marketing & boost tools + advanced analytics', 'Priority customer support'];

/* pulsing SALE badge */
function SaleBadge({ percent }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([
    Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(a, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ])).start(); }, []); // eslint-disable-line
  return (
    <Animated.View style={[styles.saleBadge, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
      <Ionicons name="pricetag" size={11} color="#7f1d1d" />
      <Text style={styles.saleBadgeText}>{percent}% OFF</Text>
    </Animated.View>
  );
}

export default function AdminSubscriptionTiersScreen() {
  const [sub, setSub] = useState(null);
  const [stats, setStats] = useState({});
  const [promo, setPromo] = useState({ promotion_daily_price: 2, promotion_enabled: true, promotion_max_slots_per_page: 4 });
  const [payments, setPayments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.adminSubscriptionTiers.get();
      const pro = data?.subscription || data?.tiers?.pro || {};
      setSub({
        name: pro.name || 'Subscription', description: pro.description || 'Unlock the full seller experience for your shop.',
        monthly_price: Math.max(PRICE_MIN, Math.min(PRICE_MAX, parseFloat(pro.monthly_price) || 19)),
        yearly_price: parseFloat(pro.yearly_price) || 190, monthly_wallet_credit: parseFloat(pro.monthly_wallet_credit) || 0,
        features: Array.isArray(pro.features) && pro.features.length ? pro.features : DEFAULT_FEATURES,
        sale_active: !!pro.sale_active, sale_percentage: parseFloat(pro.sale_percentage) || 0,
      });
      setStats(data?.stats || {}); setPayments(data?.recent_payments || []);
      setPromo({ promotion_daily_price: data?.promotion_daily_price ?? 2, promotion_enabled: data?.promotion_enabled !== false, promotion_max_slots_per_page: data?.promotion_max_slots_per_page ?? 4 });
    } catch (_) {} finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setSub((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const clamped = Math.max(PRICE_MIN, Math.min(PRICE_MAX, parseFloat(sub.monthly_price) || 19));
      await api.adminSubscriptionTiers.update({ subscription: { ...sub, monthly_price: clamped, yearly_price: parseFloat(sub.yearly_price) || clamped * 10 }, ...promo });
      notifySuccess(); load();
    } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not save.'); } finally { setSaving(false); }
  };
  const monthlyCredit = async () => {
    setCrediting(true);
    try { const { data } = await api.adminWallet.runMonthlyCredit(); Alert.alert('Done', data.message || 'Monthly credit applied.'); load(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not run credit.'); } finally { setCrediting(false); }
  };
  const addFeature = () => { const f = newFeature.trim(); if (!f) return; set('features', [...(sub.features || []), f]); setNewFeature(''); };
  const editFeature = (i, v) => set('features', sub.features.map((x, idx) => (idx === i ? v : x)));
  const rmFeature = (i) => set('features', sub.features.filter((_, idx) => idx !== i));

  if (!sub) return <AdminScreen><Shimmer height={110} radius={radius.xxl} /><Shimmer height={220} radius={radius.lg} style={{ marginTop: 12 }} /></AdminScreen>;

  const salePrice = sub.sale_active && sub.sale_percentage > 0 ? sub.monthly_price * (1 - sub.sale_percentage / 100) : null;
  const monthlyRevenue = (sub.monthly_price || 0) * (stats?.active_subscribed || 0);
  const pricePct = (sub.monthly_price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  const statCards = [
    { label: 'Total Shops', value: stats?.total_shops ?? 0, icon: 'bag-handle', fg: colors.violet, bg: colors.primarySoft },
    { label: 'Subscribed', value: stats?.active_subscribed ?? 0, icon: 'ribbon', fg: colors.seller, bg: colors.sellerSoft },
    { label: 'No Subscription', value: stats?.free ?? 0, icon: 'people', fg: colors.textSecondary, bg: colors.bgAlt },
    { label: 'Est. Monthly', value: monthlyRevenue, prefix: '$', icon: 'cash', fg: '#e11d48', bg: '#ffe4e6' },
  ];

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <GrowthHero colors={[colors.p500, colors.s500]} icon="star" title="Subscription Plan" subtitle="Shops decide whether to subscribe"
        right={(
          <View style={{ gap: 6 }}>
            <TouchableOpacity onPress={monthlyCredit} disabled={crediting} style={styles.heroBtn}><Ionicons name={crediting ? 'sync' : 'refresh'} size={13} color={colors.white} /><Text style={styles.heroBtnText}>Credit</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} style={[styles.heroBtn, { backgroundColor: colors.white }]}><Ionicons name="save" size={13} color={colors.violet} /><Text style={[styles.heroBtnText, { color: colors.violet }]}>{saving ? '…' : 'Save'}</Text></TouchableOpacity>
          </View>
        )} />

      <View style={styles.statGrid}>
        {statCards.map((c, i) => (
          <View key={i} style={styles.stat}>
            <View style={styles.statHead}><Text style={styles.statLabel}>{c.label}</Text><View style={[styles.statIcon, { backgroundColor: c.bg }]}><Ionicons name={c.icon} size={13} color={c.fg} /></View></View>
            <CountUp value={typeof c.value === 'number' ? c.value : 0} prefix={c.prefix || ''} style={styles.statValue} />
          </View>
        ))}
      </View>

      {/* live preview */}
      <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
      <LinearGradient colors={[colors.p500, colors.p600, colors.s700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
        <View style={[styles.blob, { top: -20, right: -20 }]} />
        <View style={styles.previewTop}>
          <View style={styles.featuredChip}><Ionicons name="sparkles" size={11} color="#78350f" /><Text style={styles.featuredText}>Featured</Text></View>
          {salePrice !== null ? <SaleBadge percent={sub.sale_percentage} /> : null}
        </View>
        <Text style={styles.previewName}>{sub.name || 'Subscription'}</Text>
        <Text style={styles.previewDesc} numberOfLines={3}>{sub.description}</Text>
        <View style={styles.priceRow}>
          {salePrice !== null ? <Text style={styles.priceStrike}>${sub.monthly_price.toFixed(2)}</Text> : null}
          <Text style={styles.priceBig}>${(salePrice ?? sub.monthly_price).toFixed(2)}</Text>
          <Text style={styles.priceMo}>/mo</Text>
        </View>
        <Text style={styles.priceYear}>or ${sub.yearly_price.toFixed(0)}/year</Text>
        <View style={{ marginTop: 12 }}>{(sub.features || []).slice(0, 6).map((f, i) => <CheckRow key={i} label={f} index={i} />)}</View>
      </LinearGradient>

      {/* config */}
      <GrowthCard title="Subscription Configuration" icon="star" headColors={[colors.p50, colors.s50]}>
        <Input label="Plan Name" containerStyle={{ marginBottom: 10 }} icon="star-outline" value={sub.name} onChangeText={(v) => set('name', v)} />
        <Input label="Description" containerStyle={{ marginBottom: 10 }} icon="document-text-outline" multiline value={sub.description} onChangeText={(v) => set('description', v)} />

        <View style={styles.priceBox}>
          <Text style={styles.priceBoxLabel}>PRICING (${PRICE_MIN}–${PRICE_MAX} RANGE)</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Text style={styles.subLabel}>Monthly</Text><Stepper value={sub.monthly_price} step={0.5} decimals={1} min={PRICE_MIN} max={PRICE_MAX} prefix="$" tint="#e11d48" onChange={(v) => set('monthly_price', v)} /></View>
            <View style={{ flex: 1 }}><Text style={styles.subLabel}>Yearly</Text><Stepper value={sub.yearly_price} step={5} min={0} prefix="$" tint="#e11d48" onChange={(v) => set('yearly_price', v)} /></View>
          </View>
          <View style={styles.rangeTrack}><View style={[styles.rangeFill, { width: `${Math.max(0, Math.min(1, pricePct)) * 100}%` }]} /><View style={[styles.rangeThumb, { left: `${Math.max(0, Math.min(1, pricePct)) * 100}%` }]} /></View>
          <View style={styles.rangeLabels}><Text style={styles.rangeEnd}>${PRICE_MIN}</Text><Text style={styles.rangeMid}>${sub.monthly_price.toFixed(1)}/mo</Text><Text style={styles.rangeEnd}>${PRICE_MAX}</Text></View>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Monthly Wallet Credit ($)</Text>
        <Stepper value={sub.monthly_wallet_credit} step={0.5} decimals={1} min={0} prefix="$" onChange={(v) => set('monthly_wallet_credit', v)} />

        <View style={{ marginTop: 12 }}>
          <ToggleRow title="Subscription Sale" desc="Offer a temporary discount" value={sub.sale_active} onValueChange={(v) => set('sale_active', v)} bg="#fffbeb" border="#fde68a" trackTint={colors.amber} />
          {sub.sale_active ? <View style={{ marginTop: -2, marginBottom: 8 }}><Text style={styles.subLabel}>Discount %</Text><Stepper value={sub.sale_percentage} step={5} min={0} max={90} suffix="%" tint={colors.amber} onChange={(v) => set('sale_percentage', v)} /></View> : null}
        </View>
      </GrowthCard>

      {/* features */}
      <GrowthCard title="Features Included" icon="checkmark-circle" iconColor={colors.seller} headColors={['#ecfdf5', '#f0fdfa']}>
        {(sub.features || []).map((f, i) => (
          <View key={i} style={styles.featRow}>
            <View style={styles.featDot}><Ionicons name="checkmark" size={11} color={colors.seller} /></View>
            <TextInput style={styles.featInput} value={f} onChangeText={(v) => editFeature(i, v)} />
            <TouchableOpacity onPress={() => rmFeature(i)} style={styles.featX}><Ionicons name="close" size={15} color={colors.red} /></TouchableOpacity>
          </View>
        ))}
        <View style={styles.addFeatRow}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Add a new feature…" placeholderTextColor={colors.textMuted} value={newFeature} onChangeText={setNewFeature} onSubmitEditing={addFeature} />
          <TouchableOpacity onPress={addFeature} style={styles.addFeatBtn}><Ionicons name="add" size={18} color={colors.white} /></TouchableOpacity>
        </View>
      </GrowthCard>

      {/* promo settings */}
      <GrowthCard title="Boost / Promotion Settings" icon="megaphone" iconColor="#2563eb" headColors={['#eff6ff', colors.s50]}>
        <Text style={styles.fieldLabel}>Daily Boost Price ($)</Text>
        <Stepper value={promo.promotion_daily_price} step={0.5} decimals={1} min={0} prefix="$" tint="#2563eb" onChange={(v) => setPromo((p) => ({ ...p, promotion_daily_price: v }))} />
        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Max Slots Per Page</Text>
        <Stepper value={promo.promotion_max_slots_per_page} step={1} min={1} max={20} tint="#2563eb" onChange={(v) => setPromo((p) => ({ ...p, promotion_max_slots_per_page: v }))} />
        <View style={{ marginTop: 12 }}><ToggleRow title="Promotion Enabled" value={promo.promotion_enabled} onValueChange={(v) => setPromo((p) => ({ ...p, promotion_enabled: v }))} bg="#eff6ff" border="#bfdbfe" trackTint="#2563eb" /></View>
      </GrowthCard>

      {payments.length > 0 ? (
        <GrowthCard title="Recent Subscription Payments" icon="trending-up" iconColor={colors.seller} headColors={['#ecfdf5', '#f0fdf4']}>
          {payments.slice(0, 10).map((p, i) => (
            <View key={i} style={styles.payRow}>
              <Text style={styles.payShop} numberOfLines={1}>{p.shop_name || '—'}</Text>
              <Text style={styles.payAmount}>${(p.amount || 0).toFixed(2)}</Text>
              <View style={[styles.payStatus, { backgroundColor: p.status === 'completed' ? colors.sellerSoft : '#fef3c7' }]}><Text style={[styles.payStatusText, { color: p.status === 'completed' ? '#047857' : '#b45309' }]}>{p.status || 'pending'}</Text></View>
            </View>
          ))}
        </GrowthCard>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  heroBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  stat: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  statIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  previewLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  preview: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', marginBottom: 14, ...shadow.violetGlow },
  blob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  featuredChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fce883', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  featuredText: { fontFamily: fonts.bold, fontSize: 10, color: '#78350f', textTransform: 'uppercase', letterSpacing: 0.5 },
  saleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fecaca', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  saleBadgeText: { fontFamily: fonts.extrabold, fontSize: 10, color: '#7f1d1d' },
  previewName: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5 },
  previewDesc: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12, marginTop: 4, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 },
  priceStrike: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.bold, fontSize: 16, textDecorationLine: 'line-through', marginBottom: 6 },
  priceBig: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -2 },
  priceMo: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.medium, fontSize: 13, marginBottom: 8 },
  priceYear: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  subLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 5 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 12 },
  priceBox: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: radius.md, padding: 12, marginTop: 4 },
  priceBoxLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#c2410c', letterSpacing: 0.5 },
  rangeTrack: { height: 6, borderRadius: 3, backgroundColor: '#fecdd3', marginTop: 14, justifyContent: 'center' },
  rangeFill: { height: 6, borderRadius: 3, backgroundColor: '#f43f5e' },
  rangeThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#f43f5e', borderWidth: 2, borderColor: colors.white, marginLeft: -7 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rangeEnd: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  rangeMid: { fontFamily: fonts.bold, fontSize: 11, color: '#e11d48' },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  featDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.sellerSoft, alignItems: 'center', justifyContent: 'center' },
  featInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 42, fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  featX: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  addFeatRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addFeatBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.seller, alignItems: 'center', justifyContent: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  payShop: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  payAmount: { fontFamily: fonts.bold, fontSize: 13, color: colors.seller },
  payStatus: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  payStatusText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'uppercase' },
});
