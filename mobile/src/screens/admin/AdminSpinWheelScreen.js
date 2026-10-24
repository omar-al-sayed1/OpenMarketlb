import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing, Switch } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { api } from '../../lib/api';
import { notifySuccess, tapMedium } from '../../lib/haptics';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import { GrowthHero, Stepper, Seg } from '../../components/admin/GrowthKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';

const OUTCOME_ICON = {
  free_sponsors_4: ['megaphone', '#f59e0b'], free_sponsor_10_days: ['megaphone', '#3b82f6'], free_theme: ['color-palette', '#ffc0cb'],
  free_subscription: ['star', '#f59e0b'], subscription_extension: ['calendar', '#d97706'], wallet_credit_small: ['wallet', '#10b981'],
  wallet_credit_large: ['cash', '#059669'], commission_reduction: ['pricetag', '#3b82f6'], another_spin: ['flash', colors.p500], try_again: ['refresh', '#94a3b8'],
};
const oIcon = (k) => OUTCOME_ICON[k] || ['gift', '#ec4899'];
const WHEEL_COLORS = ['#10b981', '#14b8a6', colors.p450, colors.s600, '#f59e0b', '#ec4899', '#0ea5e9', '#f43f5e'];

const polar = (cx, cy, r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; };
const arc = (cx, cy, r, start, end) => { const s = polar(cx, cy, r, end), e = polar(cx, cy, r, start); const large = end - start <= 180 ? 0 : 1; return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`; };

function MiniWheel({ outcomes }) {
  const rot = useRef(new Animated.Value(0)).current;
  const accum = useRef(0); // accumulated resting rotation (deg) so repeat spins don't snap back to 0
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const active = (outcomes || []).filter((o) => o.is_active !== false && (o.weight || 0) > 0);
  const total = active.reduce((s, o) => s + (o.weight || 0), 0) || 1;
  const R = 105, C = 120;
  let acc = 0;
  const segs = active.map((o, i) => { const start = (acc / total) * 360; acc += o.weight || 0; const end = (acc / total) * 360; return { o, start, end, mid: (start + end) / 2, color: WHEEL_COLORS[i % WHEEL_COLORS.length] }; });

  const spin = () => {
    if (spinning || !segs.length) return;
    setSpinning(true); setResult(null); tapMedium();
    // weighted pick
    let r = Math.random() * total, pickIdx = 0;
    for (let i = 0; i < segs.length; i++) { if (r < (segs[i].o.weight || 0)) { pickIdx = i; break; } r -= segs[i].o.weight || 0; }
    // land the picked segment's midpoint under the top pointer, continuing from the current rest angle (no snap-back)
    const currentMod = ((accum.current % 360) + 360) % 360;
    const desiredMod = ((360 - segs[pickIdx].mid) % 360 + 360) % 360;
    let delta = desiredMod - currentMod; if (delta < 0) delta += 360;
    const target = accum.current + 360 * 5 + delta;
    accum.current = target;
    Animated.timing(rot, { toValue: target, duration: 3600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => { setSpinning(false); setResult(segs[pickIdx].o.label); notifySuccess(); });
  };
  const spinDeg = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.wheelWrap}>
      <View style={styles.pointer} />
      <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
        <Svg width={240} height={240} viewBox="0 0 240 240">
          {segs.length === 0 ? <Circle cx={C} cy={C} r={R} fill={colors.bgAlt} /> : segs.map((s, i) => {
            const lp = polar(C, C, R * 0.62, s.mid);
            return (
              <G key={i}>
                <Path d={arc(C, C, R, s.start, s.end)} fill={s.color} stroke={colors.white} strokeWidth={2} />
                <SvgText x={lp.x} y={lp.y} fill="#fff" fontSize={9} fontWeight="bold" textAnchor="middle">{(s.o.label || '').slice(0, 8)}</SvgText>
              </G>
            );
          })}
          <Circle cx={C} cy={C} r={26} fill={colors.white} />
          <Circle cx={C} cy={C} r={26} fill="none" stroke="#10b981" strokeWidth={3} />
        </Svg>
      </Animated.View>
      <TouchableOpacity onPress={spin} disabled={spinning} activeOpacity={0.85} style={styles.spinBtnWrap}>
        <LinearGradient colors={gradients.seller} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.spinBtn}>
          <Ionicons name={spinning ? 'sync' : 'sparkles'} size={15} color={colors.white} />
          <Text style={styles.spinBtnText}>{spinning ? 'Spinning…' : 'Test Spin'}</Text>
        </LinearGradient>
      </TouchableOpacity>
      {result ? <Text style={styles.spinResult}>🎉 {result}</Text> : null}
    </View>
  );
}

export default function AdminSpinWheelScreen() {
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [shops, setShops] = useState([]);
  const [tab, setTab] = useState('settings');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // grant
  const [grantMode, setGrantMode] = useState('all');
  const [selectedShops, setSelectedShops] = useState([]);
  const [grantCount, setGrantCount] = useState(1);
  const [granting, setGranting] = useState(false);
  const [shopSearch, setShopSearch] = useState('');

  const load = useCallback(async () => {
    const [s, h, sh] = await Promise.allSettled([api.adminSpin.getSettings(), api.adminSpin.getHistory(), api.admin.getShops()]);
    if (s.status === 'fulfilled') setSettings(s.value.data);
    if (h.status === 'fulfilled') setHistory(h.value.data.history || []);
    if (sh.status === 'fulfilled') setShops(Array.isArray(sh.value.data) ? sh.value.data : (sh.value.data.shops || []));
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => { setSaving(true); try { await api.adminSpin.updateSettings(settings); notifySuccess(); load(); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not save.'); } finally { setSaving(false); } };
  const setOutcome = (i, field, value) => setSettings((s) => { const outcomes = [...s.outcomes]; if (field.includes('.')) { const [p, c] = field.split('.'); outcomes[i] = { ...outcomes[i], [p]: { ...outcomes[i][p], [c]: parseFloat(value) || 0 } }; } else { outcomes[i] = { ...outcomes[i], [field]: field === 'weight' ? (parseFloat(value) || 0) : value }; } return { ...s, outcomes }; });
  const toggleOutcome = (i) => setSettings((s) => { const outcomes = [...s.outcomes]; outcomes[i] = { ...outcomes[i], is_active: !(outcomes[i].is_active !== false) }; return { ...s, outcomes }; });
  const addOutcome = () => setSettings((s) => ({ ...s, outcomes: [...(s.outcomes || []), { key: `custom_${Date.now()}`, label: 'New Outcome', weight: 5, payload: {}, is_active: true }] }));

  const grant = async () => {
    const ids = grantMode === 'all' ? 'all' : selectedShops;
    if (grantMode === 'select' && !selectedShops.length) return Alert.alert('Pick shops', 'Select at least one shop.');
    setGranting(true);
    try { const { data } = await api.adminSpin.grantFreeSpins({ shop_ids: ids, count: grantCount }); Alert.alert('Done', data.message || 'Free spins granted!'); setSelectedShops([]); setGrantCount(1); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not grant.'); } finally { setGranting(false); }
  };

  if (!settings) return <AdminScreen><Shimmer height={90} radius={radius.xxl} /><Shimmer height={240} radius={radius.lg} style={{ marginTop: 12 }} /></AdminScreen>;

  const activeOutcomes = settings.outcomes?.filter((o) => o.is_active !== false) || [];
  const totalWeight = activeOutcomes.reduce((s, o) => s + (o.weight || 0), 0);
  const filteredShops = shops.filter((s) => !shopSearch.trim() || (s.name || '').toLowerCase().includes(shopSearch.toLowerCase()));

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <GrowthHero colors={[colors.p500, colors.s500]} icon="sparkles" title="Lucky Spin Wheel" subtitle="Configure the wheel and view history" />

      <Seg value={tab} onChange={setTab} items={[
        { key: 'settings', label: 'Settings', icon: 'settings' },
        { key: 'grant', label: 'Give Spin', icon: 'gift', grad: gradients.seller },
        { key: 'history', label: `History (${history.length})`, icon: 'time' },
      ]} />

      {tab === 'settings' && (
        <>
          <MiniWheel outcomes={settings.outcomes} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>General</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Spin Cost (USD)</Text><Stepper value={settings.spin_cost_usd || 7} step={0.5} decimals={1} min={0} prefix="$" onChange={(v) => setSettings((s) => ({ ...s, spin_cost_usd: v }))} /></View>
              <View style={styles.enableChip}><Switch value={settings.enabled !== false} onValueChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} trackColor={{ true: colors.violet, false: colors.border }} thumbColor={colors.white} /><Text style={styles.enableText}>Enabled</Text></View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.outHead}>
              <Text style={styles.cardTitle}>Spin Outcomes</Text>
              <View style={[styles.totalChip, { backgroundColor: totalWeight === 100 ? colors.sellerSoft : '#fef3c7' }]}><Text style={[styles.totalText, { color: totalWeight === 100 ? '#047857' : '#b45309' }]}>Total: {totalWeight}%</Text></View>
            </View>
            {settings.outcomes?.map((o, i) => {
              const active = o.is_active !== false; const [ic, col] = oIcon(o.key);
              return (
                <View key={i} style={[styles.outcome, !active && { opacity: 0.55, backgroundColor: colors.surfaceMuted }]}>
                  <View style={styles.outTop}>
                    <Ionicons name={ic} size={16} color={col} />
                    <Text style={[styles.outLabel, !active && { textDecorationLine: 'line-through', color: colors.textMuted }]} numberOfLines={1}>{o.label}</Text>
                    <Switch value={active} onValueChange={() => toggleOutcome(i)} trackColor={{ true: colors.seller, false: colors.border }} thumbColor={colors.white} />
                  </View>
                  {active ? (
                    <View style={styles.outFields}>
                      <View style={{ flex: 1 }}><Text style={styles.miniLabel}>Label</Text><TextInput style={styles.miniInput} value={o.label} onChangeText={(v) => setOutcome(i, 'label', v)} /></View>
                      <View style={{ width: 100 }}><Text style={styles.miniLabel}>Chance %</Text><Stepper value={o.weight} step={1} min={0} max={100} tint={colors.violet} onChange={(v) => setOutcome(i, 'weight', v)} /></View>
                    </View>
                  ) : null}
                  {active && o.key.includes('wallet_credit') ? <View style={{ marginTop: 8 }}><Text style={styles.miniLabel}>Amount ($)</Text><Stepper value={o.payload?.amount || 0} step={0.5} decimals={1} min={0} tint={colors.seller} prefix="$" onChange={(v) => setOutcome(i, 'payload.amount', v)} /></View> : null}
                  {active && (o.key === 'free_subscription' || o.key === 'subscription_extension') ? <View style={{ marginTop: 8 }}><Text style={styles.miniLabel}>Days to Add</Text><Stepper value={o.payload?.days || (o.key === 'subscription_extension' ? 15 : 30)} step={5} min={0} tint={colors.amber} onChange={(v) => setOutcome(i, 'payload.days', v)} /></View> : null}
                </View>
              );
            })}
            <TouchableOpacity onPress={addOutcome} style={styles.addOutcome}><Ionicons name="add" size={16} color={colors.violet} /><Text style={styles.addOutcomeText}>Add Outcome</Text></TouchableOpacity>
          </View>

          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.9}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}><Ionicons name={saving ? 'sync' : 'save'} size={16} color={colors.white} /><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Settings'}</Text></LinearGradient></TouchableOpacity>
        </>
      )}

      {tab === 'grant' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Give Free Spins to Shops</Text>
          <Text style={styles.sub}>Recipients get an in-app message + an email.</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity onPress={() => setGrantMode('all')} style={[styles.modeCard, grantMode === 'all' && styles.modeCardActive]}><Ionicons name="people" size={16} color={colors.seller} /><Text style={styles.modeCardTitle}>All Shops</Text><Text style={styles.modeCardSub}>Every approved shop ({shops.length})</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setGrantMode('select')} style={[styles.modeCard, grantMode === 'select' && styles.modeCardActive]}><Ionicons name="sparkles" size={16} color={colors.seller} /><Text style={styles.modeCardTitle}>Specific Shops</Text><Text style={styles.modeCardSub}>Pick which shops</Text></TouchableOpacity>
          </View>
          {grantMode === 'select' ? (
            <>
              <View style={styles.searchWrap}><Ionicons name="search" size={15} color={colors.textMuted} /><TextInput style={styles.searchInput} placeholder="Search shops…" placeholderTextColor={colors.textMuted} value={shopSearch} onChangeText={setShopSearch} /></View>
              <View style={styles.shopList}>
                {filteredShops.length === 0 ? <Text style={styles.none}>No shops match</Text> : filteredShops.map((s) => {
                  const on = selectedShops.includes(s.id);
                  return <TouchableOpacity key={s.id} onPress={() => setSelectedShops((a) => on ? a.filter((x) => x !== s.id) : [...a, s.id])} style={[styles.shopRow, on && { backgroundColor: colors.sellerSoft }]}><Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? colors.seller : colors.textMuted} /><Text style={styles.shopRowName} numberOfLines={1}>{s.name}</Text></TouchableOpacity>;
                })}
              </View>
              <Text style={styles.selCount}>{selectedShops.length} selected</Text>
            </>
          ) : null}
          <Text style={[styles.label, { marginTop: 12 }]}>Free spins per shop</Text>
          <View style={{ maxWidth: 160 }}><Stepper value={grantCount} step={1} min={1} max={20} tint={colors.seller} onChange={setGrantCount} /></View>
          <TouchableOpacity onPress={grant} disabled={granting} activeOpacity={0.9}><LinearGradient colors={gradients.seller} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.saveBtn, { marginTop: 16 }]}><Ionicons name={granting ? 'sync' : 'send'} size={16} color={colors.white} /><Text style={styles.saveText}>Grant {grantCount} Spin{grantCount !== 1 ? 's' : ''}</Text></LinearGradient></TouchableOpacity>
        </View>
      )}

      {tab === 'history' && (
        <View style={styles.card}>
          {history.length === 0 ? <Text style={styles.none}>No spin history yet</Text> : history.map((h) => {
            const [ic, col] = oIcon(h.outcome_key);
            return (
              <View key={h.id} style={styles.histRow}>
                <View style={[styles.histIcon, { backgroundColor: `${col}22` }]}><Ionicons name={ic} size={15} color={col} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.histShop} numberOfLines={1}>{h.shop_name || h.shop_id?.substring(0, 12)}</Text>
                  <Text style={styles.histResult} numberOfLines={1}>{h.outcome_label}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.histType, { backgroundColor: h.spin_type === 'monthly_free' ? colors.sellerSoft : h.spin_type === 'paid' ? '#dbeafe' : colors.primarySoft }]}><Text style={[styles.histTypeText, { color: h.spin_type === 'monthly_free' ? '#047857' : h.spin_type === 'paid' ? '#1d4ed8' : colors.primarySoftText }]}>{h.spin_type?.replace('_', ' ')}</Text></View>
                  <Text style={styles.histCost}>{h.cost > 0 ? `$${h.cost.toFixed(2)}` : 'Free'}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 18, marginBottom: 12, ...shadow.card },
  pointer: { position: 'absolute', top: 8, zIndex: 3, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#10b981' },
  spinBtnWrap: { marginTop: 6 },
  spinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 11, borderRadius: radius.pill, ...shadow.card },
  spinBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  spinResult: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink, marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 12, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  enableChip: { alignItems: 'center', gap: 4 },
  enableText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  outHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  totalChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  totalText: { fontFamily: fonts.bold, fontSize: 11 },
  outcome: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  outTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  outFields: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-end' },
  miniLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  miniInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 8, height: 34, paddingHorizontal: 8, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  addOutcome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, paddingVertical: 11, marginTop: 4 },
  addOutcomeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modeCard: { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  modeCardActive: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  modeCardTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, marginTop: 6 },
  modeCardSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 42, marginTop: 12 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  shopList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 6, marginTop: 8, maxHeight: 220 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 8 },
  shopRowName: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  selCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 6 },
  none: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  histIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  histShop: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  histResult: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  histType: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  histTypeText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize' },
  histCost: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, marginTop: 3 },
});
