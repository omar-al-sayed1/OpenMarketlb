import React, { useEffect, useState, useCallback, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing, Modal, ScrollView } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { GrowthHero, SavePill, Stepper, ToggleRow, GrowthCard } from '../../components/admin/GrowthKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';

const TIER_META = { Bronze: { icon: 'medal', fg: '#b45309', bg: '#fef3c7' }, Silver: { icon: 'ribbon', fg: '#475569', bg: '#e2e8f0' }, Gold: { icon: 'trophy', fg: '#a16207', bg: '#fef9c3' } };
const AMBER = ['#f59e0b', '#f97316'];

/* animated tier threshold ladder */
function TierLadder({ tiers }) {
  const max = Math.max(...tiers.map((t) => t.min_points || 0), 1);
  return (
    <View style={styles.ladder}>
      {tiers.map((t, i) => {
        const meta = TIER_META[t.name] || TIER_META.Bronze;
        return <LadderRung key={i} name={t.name} pts={t.min_points || 0} mult={t.multiplier} pct={(t.min_points || 0) / max} meta={meta} index={i} />;
      })}
    </View>
  );
}
function LadderRung({ name, pts, mult, pct, meta, index }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(w, { toValue: Math.max(0.08, pct), duration: 700, delay: index * 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]); // eslint-disable-line
  return (
    <View style={styles.rung}>
      <View style={[styles.rungIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={13} color={meta.fg} /></View>
      <View style={{ flex: 1 }}>
        <View style={styles.rungTop}><Text style={[styles.rungName, { color: meta.fg }]}>{name}</Text><Text style={styles.rungMeta}>{pts} pts · {mult}x</Text></View>
        <View style={styles.rungTrack}><Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: meta.fg, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} /></View>
      </View>
    </View>
  );
}

export default function AdminLoyaltyScreen() {
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  const load = useCallback(async () => {
    const [a, s] = await Promise.allSettled([api.adminLoyalty.getAnalytics(), api.adminLoyalty.getSettings()]);
    if (a.status === 'fulfilled') setAnalytics(a.value.data);
    if (s.status === 'fulfilled') setSettings(s.value.data);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try { await api.adminLoyalty.updateSettings(settings); notifySuccess(); load(); } catch (_) { Alert.alert('Failed', 'Could not save settings.'); } finally { setSaving(false); }
  };
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setTier = (idx, k, v) => setSettings((s) => { const tiers = [...(s.tiers || [])]; tiers[idx] = { ...tiers[idx], [k]: v }; return { ...s, tiers }; });
  const delEvent = async (id) => { try { await api.adminLoyalty.deleteBonusEvent(id); load(); } catch (_) {} };

  if (!analytics || !settings) return <AdminScreen><Shimmer height={90} radius={radius.xxl} />{[0, 1].map((i) => <Shimmer key={i} height={120} radius={radius.lg} style={{ marginTop: 12 }} />)}</AdminScreen>;

  const cards = [
    { label: 'Points Issued', value: analytics.total_points_issued || 0, icon: 'trending-up', grad: gradients.seller },
    { label: 'Points Redeemed', value: analytics.total_points_redeemed || 0, icon: 'gift', grad: [colors.p450, colors.s600] },
    { label: 'Outstanding', value: analytics.total_points_outstanding || 0, icon: 'star', grad: AMBER },
    { label: 'Discount Given', value: analytics.total_discount_given || 0, icon: 'flash', grad: ['#f43f5e', '#ec4899'], prefix: '$' },
  ];

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <GrowthHero colors={AMBER} icon="gift" title="Loyalty & Rewards" subtitle="Manage your customer loyalty program"
        right={<SavePill onPress={save} saving={saving} />} />

      <View style={styles.analyticsGrid}>
        {cards.map((c, i) => (
          <View key={i} style={styles.aCard}>
            <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aIcon}><Ionicons name={c.icon} size={15} color={colors.white} /></LinearGradient>
            <CountUp value={c.value} prefix={c.prefix || ''} style={styles.aValue} />
            <Text style={styles.aLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* members by tier */}
      <View style={styles.tierRow}>
        {Object.entries(analytics.tier_breakdown || {}).map(([tier, count]) => {
          const meta = TIER_META[tier] || TIER_META.Bronze;
          return (
            <View key={tier} style={styles.tierCard}>
              <View style={[styles.tierIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={17} color={meta.fg} /></View>
              <View><Text style={styles.tierName}>{tier}</Text><Text style={styles.tierCount}>{count} member{count !== 1 ? 's' : ''}</Text></View>
            </View>
          );
        })}
      </View>

      {/* program settings */}
      <GrowthCard title="Program Settings" icon="settings" iconColor={colors.textSecondary}>
        <ToggleRow title="Enable Loyalty Program" desc="Customers earn points on purchases" value={settings.loyalty_enabled !== false} onValueChange={(v) => set('loyalty_enabled', v)} bg="#fffbeb" border="#fde68a" trackTint={colors.amber} />
        <View style={styles.field}><Text style={styles.fieldLabel}>Points per $1 Spent</Text><Stepper value={settings.points_per_dollar || 1} step={0.5} decimals={1} min={0} tint={colors.amber} onChange={(v) => set('points_per_dollar', v)} /></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>Points per $1 Discount</Text><Stepper value={settings.redeem_points_per_dollar || 100} step={10} min={1} tint={colors.amber} onChange={(v) => set('redeem_points_per_dollar', v)} /><Text style={styles.hint}>{settings.redeem_points_per_dollar || 100} pts = $1 off</Text></View>
        <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Tier Thresholds</Text>
        <TierLadder tiers={settings.tiers || []} />
        {(settings.tiers || []).map((t, idx) => (
          <View key={idx} style={styles.tierEdit}>
            <Text style={[styles.tierEditName, { color: (TIER_META[t.name] || TIER_META.Bronze).fg }]}>{t.name}</Text>
            <View style={{ flex: 1 }}><Stepper value={t.min_points || 0} step={50} min={0} tint={colors.amber} suffix="pts" onChange={(v) => setTier(idx, 'min_points', v)} /></View>
            <View style={{ width: 108 }}><Stepper value={t.multiplier || 1} step={0.1} decimals={1} min={1} tint={colors.amber} suffix="x" onChange={(v) => setTier(idx, 'multiplier', v)} /></View>
          </View>
        ))}
      </GrowthCard>

      {/* bonuses & events */}
      <GrowthCard title="Bonuses & Events" icon="flash" iconColor={colors.amber}>
        <ToggleRow title="Double Points Weekends" desc="2x points on Saturday & Sunday" value={settings.double_points_weekend_enabled} onValueChange={(v) => set('double_points_weekend_enabled', v)} bg={colors.primarySoft} border={colors.p200} />
        <ToggleRow title="Birthday Bonus" value={settings.birthday_bonus_enabled} onValueChange={(v) => set('birthday_bonus_enabled', v)} bg="#fdf2f8" border="#fbcfe8" trackTint="#ec4899">
          <View style={styles.inlineStep}><Stepper value={settings.birthday_bonus_points || 50} step={10} min={0} tint="#ec4899" suffix="pts" onChange={(v) => set('birthday_bonus_points', v)} /></View>
        </ToggleRow>
        <ToggleRow title="First Purchase Bonus" value={settings.first_purchase_bonus_enabled} onValueChange={(v) => set('first_purchase_bonus_enabled', v)} bg="#ecfdf5" border="#a7f3d0" trackTint={colors.seller}>
          <View style={styles.inlineStep}><Stepper value={settings.first_purchase_bonus_points || 100} step={25} min={0} tint={colors.seller} suffix="pts" onChange={(v) => set('first_purchase_bonus_points', v)} /></View>
        </ToggleRow>

        <View style={styles.eventsHead}>
          <Text style={styles.sectionLabel}>Custom Bonus Events</Text>
          <TouchableOpacity onPress={() => setBonusOpen(true)} style={styles.addBtn}><Ionicons name="add" size={14} color={colors.violet} /><Text style={styles.addText}>Add Event</Text></TouchableOpacity>
        </View>
        {(settings.bonus_events || []).length === 0 ? <Text style={styles.none}>No custom bonus events yet</Text> : (settings.bonus_events || []).map((e) => (
          <View key={e.id} style={styles.eventRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.eventTop}>
                <Text style={styles.eventName} numberOfLines={1}>{e.name}</Text>
                <View style={[styles.eChip, { backgroundColor: e.type === 'added_points' ? '#fef3c7' : colors.primarySoft }]}><Text style={[styles.eChipText, { color: e.type === 'added_points' ? '#b45309' : colors.primarySoftText }]}>{e.type === 'added_points' ? `+${e.added_points} pts` : `${e.multiplier}x`}</Text></View>
              </View>
              <Text style={styles.eventDesc} numberOfLines={1}>{e.description}{e.start_date ? ` | ${e.start_date} - ${e.end_date}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => delEvent(e.id)} style={styles.trash}><Ionicons name="trash-outline" size={16} color={colors.red} /></TouchableOpacity>
          </View>
        ))}
      </GrowthCard>

      <BonusModal open={bonusOpen} onClose={() => setBonusOpen(false)} onDone={load} />
    </AdminScreen>
  );
}

function BonusModal({ open, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [f, setF] = useState({ name: '', description: '', type: 'multiplier', multiplier: 2, added_points: 100, display_mode: 'center', start_date: '', end_date: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.name.trim()) return Alert.alert('Name required', 'Enter an event name.');
    setBusy(true);
    try { await api.adminLoyalty.addBonusEvent({ ...f, is_active: true }); notifySuccess(); setF({ name: '', description: '', type: 'multiplier', multiplier: 2, added_points: 100, display_mode: 'center', start_date: '', end_date: '' }); onClose(); onDone(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not add event.'); } finally { setBusy(false); }
  };
  const modes = [{ k: 'center', l: 'Center' }, { k: 'side_fixed', l: 'Side Widget' }, { k: 'side', l: 'Toast' }];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Add Bonus Event</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
          <Input containerStyle={{ marginBottom: 10 }} icon="sparkles-outline" placeholder="Event name (e.g. Summer Sale)" value={f.name} onChangeText={(v) => set('name', v)} />
          <Input containerStyle={{ marginBottom: 10 }} icon="document-text-outline" placeholder="Description" value={f.description} onChangeText={(v) => set('description', v)} />
          <View style={styles.typeRow}>
            <TouchableOpacity onPress={() => set('type', 'multiplier')} style={[styles.typeBtn, f.type === 'multiplier' && { borderColor: colors.violet, backgroundColor: colors.primarySoft }]}><Ionicons name="flash" size={16} color={f.type === 'multiplier' ? colors.violet : colors.textMuted} /><Text style={[styles.typeText, f.type === 'multiplier' && { color: colors.primarySoftText }]}>Multiplier</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => set('type', 'added_points')} style={[styles.typeBtn, f.type === 'added_points' && { borderColor: colors.amber, backgroundColor: '#fef3c7' }]}><Ionicons name="gift" size={16} color={f.type === 'added_points' ? colors.amber : colors.textMuted} /><Text style={[styles.typeText, f.type === 'added_points' && { color: '#b45309' }]}>Added Points</Text></TouchableOpacity>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{f.type === 'multiplier' ? 'Points Multiplier' : 'Bonus Points to Give'}</Text>
            {f.type === 'multiplier'
              ? <Stepper value={f.multiplier} step={0.5} decimals={1} min={1} onChange={(v) => set('multiplier', v)} />
              : <Stepper value={f.added_points} step={25} min={1} onChange={(v) => set('added_points', v)} />}
          </View>
          <Text style={styles.fieldLabel}>Popup Display</Text>
          <View style={styles.typeRow}>
            {modes.map((m) => <TouchableOpacity key={m.k} onPress={() => set('display_mode', m.k)} style={[styles.modeBtn, f.display_mode === m.k && { borderColor: colors.violet, backgroundColor: colors.primarySoft }]}><Text style={[styles.modeText, f.display_mode === m.k && { color: colors.primarySoftText }]}>{m.l}</Text></TouchableOpacity>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input containerStyle={{ flex: 1 }} icon="calendar-outline" placeholder="Start (YYYY-MM-DD)" value={f.start_date} onChangeText={(v) => set('start_date', v)} />
            <Input containerStyle={{ flex: 1 }} placeholder="End (YYYY-MM-DD)" value={f.end_date} onChangeText={(v) => set('end_date', v)} />
          </View>
        </ScrollView>
        <TouchableOpacity onPress={submit} disabled={busy} activeOpacity={0.9}><LinearGradient colors={AMBER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}><Text style={styles.submitText}>{busy ? 'Adding…' : 'Add Event'}</Text></LinearGradient></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  aCard: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  aIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  aValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  aLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  tierRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  tierCard: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, ...shadow.card },
  tierIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  tierCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  field: { marginTop: 12 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 4 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  ladder: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginBottom: 12, gap: 12 },
  rung: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rungIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rungTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rungName: { fontFamily: fonts.bold, fontSize: 12 },
  rungMeta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  rungTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  tierEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  tierEditName: { width: 52, fontFamily: fonts.bold, fontSize: 12 },
  inlineStep: { marginTop: 8, width: 150 },
  eventsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  addText: { fontFamily: fonts.bold, fontSize: 11, color: colors.violet },
  none: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 8 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  eChip: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  eChipText: { fontFamily: fonts.bold, fontSize: 10 },
  eventDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  trash: { padding: 6 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 12 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  typeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  modeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  submit: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
