import React, { useEffect, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, LayoutAnimation, Platform, UIManager, Modal } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);
const IDENTITY = ['#059669', '#0d9488']; // emerald-600 -> teal-600
const pageKey = (p) => (typeof p === 'string' ? p : p.key || p.id || p.path);
const pageLabel = (p) => (typeof p === 'string' ? p.replace(/[-_/]/g, ' ').trim() : p.label || p.name || pageKey(p));

export default function AdminEmployeesScreen() {
  const [employees, setEmployees] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const [e, p] = await Promise.allSettled([api.admin.listEmployees(), api.admin.getAvailableEmployeePages()]);
    if (e.status === 'fulfilled') setEmployees(Array.isArray(e.value.data) ? e.value.data : e.value.data?.employees || []);
    if (p.status === 'fulfilled') setPages(Array.isArray(p.value.data) ? p.value.data : p.value.data?.pages || []);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(expanded === id ? null : id); };
  const togglePage = async (emp, key) => {
    const cur = emp.allowed_pages || [];
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    setEmployees((prev) => prev.map((x) => (x.id === emp.id ? { ...x, allowed_pages: next } : x)));
    try { await api.admin.setEmployeePages(emp.id, next); } catch (_) { load(); }
  };
  const del = (emp) => Alert.alert('Delete employee', emp.name, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setEmployees((p) => p.filter((x) => x.id !== emp.id)); try { await api.admin.deleteEmployee(emp.id); } catch (_) { load(); } } }]);

  if (loading) return <AdminScreen>{[0, 1, 2].map((i) => <Shimmer key={i} height={72} radius={radius.lg} style={{ marginBottom: 10 }} />)}</AdminScreen>;

  return (
    <View style={{ flex: 1 }}>
      <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentStyle={{ paddingBottom: 90 }}>
        <LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="briefcase" size={24} color={colors.white} /></View>
          <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Employees</Text><Text style={styles.heroSub}>{employees.length} employees</Text></View>
        </LinearGradient>

        {employees.map((emp) => {
          const open = expanded === emp.id; const allowed = emp.allowed_pages || [];
          return (
            <View key={emp.id} style={styles.card}>
              <TouchableOpacity style={styles.cardTop} activeOpacity={0.85} onPress={() => toggle(emp.id)}>
                <LinearGradient colors={IDENTITY} style={styles.avatar}><Text style={styles.avatarText}>{(emp.name || 'E').charAt(0).toUpperCase()}</Text></LinearGradient>
                <View style={{ flex: 1 }}><Text style={styles.name} numberOfLines={1}>{emp.name}</Text><Text style={styles.email} numberOfLines={1}>{emp.email}</Text></View>
                <View style={styles.pagesChip}><Text style={styles.pagesText}>{allowed.length} pages</Text></View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {open && (
                <View style={styles.matrix}>
                  <Text style={styles.matrixTitle}>Page access</Text>
                  {pages.map((p) => { const k = pageKey(p); return (
                    <View key={k} style={styles.permRow}>
                      <Text style={styles.permLabel}>{pageLabel(p)}</Text>
                      <Switch value={allowed.includes(k)} onValueChange={() => togglePage(emp, k)} trackColor={{ true: colors.violet, false: colors.border }} thumbColor={colors.white} />
                    </View>
                  ); })}
                  <TouchableOpacity style={styles.delBtn} onPress={() => del(emp)}><Ionicons name="trash-outline" size={15} color={colors.sale} /><Text style={styles.delText}>Remove employee</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {employees.length === 0 && <Text style={styles.empty}>No employees yet.</Text>}
      </AdminScreen>
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setFormOpen(true)}>
        <LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}><Ionicons name="person-add" size={24} color={colors.white} /></LinearGradient>
      </TouchableOpacity>
      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} onDone={load} />
    </View>
  );
}

function EmployeeForm({ open, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.name || !f.email || !f.password) return Alert.alert('Missing info', 'All fields required.');
    setBusy(true);
    try { await api.admin.createEmployee(f); notifySuccess(); setF({ name: '', email: '', password: '' }); onClose(); onDone(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not create employee.'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>New employee</Text>
        <Input containerStyle={{ marginBottom: 10 }} icon="person-outline" placeholder="Full name" value={f.name} onChangeText={(v) => set('name', v)} />
        <Input containerStyle={{ marginBottom: 10 }} icon="mail-outline" placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={(v) => set('email', v)} />
        <Input containerStyle={{ marginBottom: 10 }} icon="lock-closed-outline" placeholder="Temporary password" secureToggle value={f.password} onChangeText={(v) => set('password', v)} />
        <TouchableOpacity onPress={submit} disabled={busy}><LinearGradient colors={IDENTITY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}><Text style={styles.submitText}>{busy ? 'Creating…' : 'Create employee'}</Text></LinearGradient></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xxl, padding: 18, ...shadow.card, marginBottom: 14, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  heroIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, marginBottom: 10, overflow: 'hidden', ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  pagesChip: { backgroundColor: colors.sellerSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  pagesText: { fontFamily: fonts.bold, fontSize: 10, color: colors.sellerSoftText },
  matrix: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 8 },
  matrixTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  permLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, textTransform: 'capitalize', flex: 1 },
  delBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.saleSoft },
  delText: { fontFamily: fonts.bold, fontSize: 12, color: colors.sale },
  empty: { textAlign: 'center', fontFamily: fonts.medium, color: colors.textMuted, marginTop: 20 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56 },
  fabInner: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 14 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.body, fontSize: 15, color: colors.ink, marginBottom: 10 },
  submit: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
