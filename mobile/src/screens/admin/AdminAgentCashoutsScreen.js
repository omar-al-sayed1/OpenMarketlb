import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import BottomSheet from '../../components/BottomSheet';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const METHOD_LABELS = { cash: 'Cash', whish: 'Wish Money', omt: 'OMT' };
const methodLabel = (m) => METHOD_LABELS[m] || m || 'Cash';
const FILTERS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];
const STATUS_META = { pending: ['#fffbeb', '#b45309', 'Pending'], approved: ['#ecfdf5', '#047857', 'Approved'], rejected: ['#fef2f2', '#b91c1c', 'Rejected'] };

export default function AdminAgentCashoutsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirm, setConfirm] = useState(null); // { action, req }
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try { const { data } = await api.admin.getAgentCashouts(statusFilter === 'all' ? undefined : statusFilter); setRequests(Array.isArray(data) ? data : data?.requests || data?.cashouts || []); }
    catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter]);
  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);

  const doAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === 'approve') { await api.admin.approveAgentCashout(confirm.req.id); notifySuccess(); toast.success('Cash-out approved & paid'); }
      else { await api.admin.rejectAgentCashout(confirm.req.id, ''); notifySuccess(); toast.success('Cash-out rejected'); }
      setConfirm(null); await fetchAll();
    } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }}>
      {/* Hero */}
      <LinearGradient colors={['#f59e0b', '#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroBlob} />
        <View style={styles.heroPill}><Ionicons name="wallet" size={13} color={colors.white} /><Text style={styles.heroPillText}>Agent Cash-outs</Text></View>
        <Text style={styles.heroTitle}>Agent Cash-out Requests</Text>
        <Text style={styles.heroSub}>Review and approve agents' cash-out requests.</Text>
      </LinearGradient>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {FILTERS.map(([v, l]) => (
          <TouchableOpacity key={v} onPress={() => setStatusFilter(v)} style={[styles.fchip, statusFilter === v && styles.fchipOn]}>
            <Text style={[styles.fchipText, statusFilter === v && { color: colors.white }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? [0, 1, 2].map((i) => <Shimmer key={i} height={110} radius={radius.lg} style={{ marginBottom: 12 }} />)
        : requests.length === 0 ? <View style={styles.empty}><Ionicons name="wallet-outline" size={40} color={colors.border} /><Text style={styles.emptyText}>No requests.</Text></View>
          : requests.map((r) => {
            const [bg, fg, label] = STATUS_META[r.status] || STATUS_META.pending;
            return (
              <View key={r.id} style={styles.card} testID={`agent-cashout-${r.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.rowLeft}>
                    <LinearGradient colors={['#f59e0b', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}><Text style={styles.avatarText}>{(r.agent_name || '?').charAt(0).toUpperCase()}</Text></LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.agentName} numberOfLines={1}>{r.agent_name}</Text>
                      <View style={styles.metaRow}><Ionicons name="mail-outline" size={11} color={colors.textMuted} /><Text style={styles.metaText} numberOfLines={1}>{r.agent_email}</Text></View>
                      {r.agent_phone ? <View style={styles.metaRow}><Ionicons name="call-outline" size={11} color={colors.textMuted} /><Text style={styles.metaText}>{r.agent_phone}</Text></View> : null}
                      {r.method ? <Text style={styles.method}>Method: <Text style={styles.methodBold}>{methodLabel(r.method)}</Text>{r.method_number ? <Text> · <Text style={styles.methodBold}>{r.method_number}</Text></Text> : null}</Text> : null}
                      {r.note ? <Text style={styles.note} numberOfLines={2}>Note: {r.note}</Text> : null}
                      <Text style={styles.date}>{r.created_at ? String(r.created_at).slice(0, 19).replace('T', ' ') : ''}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>${Number(r.amount || 0).toFixed(2)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: bg }]}><Text style={[styles.statusText, { color: fg }]}>{label}</Text></View>
                  </View>
                </View>
                {r.status === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => setConfirm({ action: 'approve', req: r })}><Ionicons name="checkmark" size={15} color={colors.white} /><Text style={styles.approveText}>Approve & Pay</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => setConfirm({ action: 'reject', req: r })}><Ionicons name="close" size={15} color={colors.sale} /><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

      {/* Confirm */}
      <ConfirmSheet confirm={confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={doAction} />
    </AdminScreen>
  );
}

function ConfirmSheet({ confirm, busy, onClose, onConfirm }) {
  const insets = useSafeAreaInsets();
  const approve = confirm?.action === 'approve';
  return (
    <BottomSheet visible={!!confirm} onClose={onClose}>
      {confirm && (
        <>
          <Text style={styles.sheetTitle}>{approve ? 'Approve cash-out?' : 'Reject cash-out?'}</Text>
          <Text style={styles.sheetBody}>{approve
            ? `This will deduct $${Number(confirm.req.amount || 0).toFixed(2)} from ${confirm.req.agent_name}'s wallet. Confirm only after the payment is sent.`
            : "This will reject the request. The agent's wallet will be unchanged."}</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={onConfirm} disabled={busy}>
              <LinearGradient colors={approve ? ['#10b981', '#059669'] : ['#ef4444', '#dc2626']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                {busy ? <Spinner size={16} color={colors.white} /> : <Text style={styles.confirmText}>{approve ? 'Approve' : 'Reject'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', marginBottom: 14, ...shadow.emphasis },
  heroBlob: { position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  heroPillText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11 },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  fchip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  fchipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  fchipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 46, gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12, ...shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  agentName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, flex: 1 },
  method: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 4 },
  methodBold: { fontFamily: fonts.bold, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  date: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 4 },
  amount: { fontFamily: fonts.extrabold, fontSize: 22, color: '#d97706', letterSpacing: -0.5 },
  statusPill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  statusText: { fontFamily: fonts.bold, fontSize: 10.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#059669', borderRadius: radius.md, paddingVertical: 11 },
  approveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#fecaca', borderRadius: radius.md, paddingVertical: 11 },
  rejectText: { color: colors.sale, fontFamily: fonts.bold, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  sheetBody: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 13 },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  confirmBtn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  confirmText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
