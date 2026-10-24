import React, { useEffect, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';

const money = (n) => `$${Number(n || 0).toFixed(0)}`;
const IDENTITY = [colors.p500, '#f06a92']; // violet-600 -> fuchsia-600

export default function AdminAgentsScreen() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    api.admin.listReferralAgents().then(({ data }) => setAgents(Array.isArray(data) ? data : data?.agents || [])).catch(() => setAgents([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = (a) => Alert.alert('Delete agent', a.name, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setAgents((p) => p.filter((x) => x.id !== a.id)); try { await api.admin.deleteReferralAgent(a.id); } catch (_) { load(); } } }]);

  if (loading) return <AdminScreen>{[0, 1, 2].map((i) => <Shimmer key={i} height={110} radius={radius.lg} style={{ marginBottom: 10 }} />)}</AdminScreen>;

  return (
    <View style={{ flex: 1 }}>
      <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentStyle={{ paddingBottom: 90 }}>
        <LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="person-circle" size={24} color={colors.white} /></View>
          <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Referral Agents</Text><Text style={styles.heroSub}>{agents.length} agents</Text></View>
        </LinearGradient>

        {agents.map((a) => {
          const shops = a.referred_shops_count ?? a.shops_count ?? 0;
          const spark = a.performance || [3, 5, 4, 7, 6, 9, 8];
          const max = Math.max(...spark, 1);
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardTop}>
                <LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}><Text style={styles.avatarText}>{(a.name || 'A').charAt(0).toUpperCase()}</Text></LinearGradient>
                <View style={{ flex: 1 }}><Text style={styles.name} numberOfLines={1}>{a.name}</Text><Text style={styles.email} numberOfLines={1}>{a.email}</Text></View>
                <TouchableOpacity onPress={() => del(a)} style={styles.del}><Ionicons name="trash-outline" size={17} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={styles.statVal}>{shops}</Text><Text style={styles.statLbl}>Referred shops</Text></View>
                <View style={styles.divider} />
                <View style={styles.stat}><CountUp value={a.total_commissions || a.commission_total || 0} prefix="$" style={styles.statVal} /><Text style={styles.statLbl}>Commissions</Text></View>
                <View style={styles.divider} />
                <View style={styles.stat}><Text style={styles.statVal}>{a.commission_share_percent ?? 30}%</Text><Text style={styles.statLbl}>Share</Text></View>
              </View>
              {/* sparkline */}
              <View style={styles.spark}>{spark.map((v, i) => <View key={i} style={[styles.sparkBar, { height: 6 + (v / max) * 22, backgroundColor: i === spark.length - 1 ? '#f06a92' : '#e9d5ff' }]} />)}</View>
            </View>
          );
        })}
        {agents.length === 0 && <Text style={styles.empty}>No agents yet.</Text>}
      </AdminScreen>
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setFormOpen(true)}>
        <LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}><Ionicons name="person-add" size={24} color={colors.white} /></LinearGradient>
      </TouchableOpacity>
      <AgentForm open={formOpen} onClose={() => setFormOpen(false)} onDone={load} />
    </View>
  );
}

function AgentForm({ open, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.name || !f.email || !f.password) return Alert.alert('Missing info', 'Name, email and password are required.');
    setBusy(true);
    try { await api.admin.createReferralAgent(f); notifySuccess(); setF({ name: '', email: '', phone: '', password: '' }); onClose(); onDone(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not create agent.'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>New referral agent</Text>
        <Input containerStyle={{ marginBottom: 10 }} icon="person-outline" placeholder="Full name" value={f.name} onChangeText={(v) => set('name', v)} />
        <Input containerStyle={{ marginBottom: 10 }} icon="mail-outline" placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={(v) => set('email', v)} />
        <Input containerStyle={{ marginBottom: 10 }} icon="call-outline" placeholder="Phone (optional)" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => set('phone', v)} />
        <Input containerStyle={{ marginBottom: 10 }} icon="lock-closed-outline" placeholder="Temporary password" secureToggle value={f.password} onChangeText={(v) => set('password', v)} />
        <TouchableOpacity onPress={submit} disabled={busy}><LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}><Text style={styles.submitText}>{busy ? 'Creating…' : 'Create agent'}</Text></LinearGradient></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xxl, padding: 18, ...shadow.violetGlow, marginBottom: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 12, ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  del: { padding: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: 12, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  statLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: colors.border },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12, height: 30 },
  sparkBar: { flex: 1, borderRadius: 3 },
  empty: { textAlign: 'center', fontFamily: fonts.medium, color: colors.textMuted, marginTop: 20 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56 },
  fabInner: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 14 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.body, fontSize: 15, color: colors.ink, marginBottom: 10 },
  submit: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
