import React, { useEffect, useState, useCallback, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, TextInput, Animated } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import AdminVerificationRequestsScreen from './AdminVerificationRequestsScreen';
import AdminAgentCashoutsScreen from './AdminAgentCashoutsScreen';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const timeAgo = (ts) => { if (!ts) return ''; const d = (Date.now() - new Date(ts).getTime()) / 1000; if (d < 60) return 'now'; if (d < 3600) return `${Math.floor(d / 60)}m ago`; if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return `${Math.floor(d / 86400)}d ago`; };

const CFG = {
  cancel: {
    title: 'Cancel Requests', hero: [colors.p450, colors.p600], emptyBg: [colors.p100, colors.p100], icon: 'close-circle',
    load: () => api.admin.getCancelRequests('pending'), key: 'cancel_requests',
    id: (r) => r.id, name: (r) => r.shop_name || r.customer_name || 'Order', excerpt: (r) => r.reason || `Order #${String(r.order_id || '').slice(0, 8)}`, amount: (r) => r.total_amount,
    approve: (r) => api.admin.approveCancelRequest(r.id), reject: (r, why) => api.admin.rejectCancelRequest(r.id, why),
  },
  credit: {
    title: 'Credit Requests', hero: [colors.p450, colors.p600], emptyBg: [colors.p100, colors.p100], icon: 'card',
    load: () => api.admin.getWalletRequests('pending'), key: 'wallet_requests',
    id: (r) => r.id, name: (r) => r.shop_name || 'Shop', excerpt: (r) => r.note || 'Wallet top-up request', amount: (r) => r.amount,
    approve: (r) => api.admin.addFunds(r.shop_id, r.amount, 'Approved credit request'), reject: null,
  },
  cashout: {
    title: 'Cash Out Requests', hero: ['#10b981', '#14b8a6'], emptyBg: ['#d1fae5', '#ccfbf1'], icon: 'cash',
    load: () => api.admin.getCashoutRequests('pending'), key: 'cashout_requests',
    id: (r) => r.id, name: (r) => r.shop_name || 'Shop', excerpt: (r) => r.method || 'Cash out request', amount: (r) => r.amount,
    approve: (r) => api.admin.approveCashout(r.id), reject: (r, why) => api.admin.rejectCashout(r.id, why),
  },
  agent_cashout: {
    title: 'Agent Cash-outs', hero: ['#f59e0b', '#f43f5e'], emptyBg: ['#fef3c7', '#ffe4e6'], icon: 'person-circle',
    load: () => api.admin.getAgentCashouts('pending'), key: 'agent_cashout_requests',
    id: (r) => r.id, name: (r) => r.agent_name || r.name || 'Agent', excerpt: (r) => r.method || 'Agent cash-out', amount: (r) => r.amount,
    approve: (r) => api.admin.approveAgentCashout(r.id), reject: (r, why) => api.admin.rejectAgentCashout(r.id, why),
  },
  verification: {
    title: 'Shops Verification', hero: ['#059669', '#0d9488'], emptyBg: ['#d1fae5', '#ccfbf1'], icon: 'shield-checkmark',
    load: () => api.admin.getVerificationRequests('pending'), key: 'verification_requests',
    id: (r) => r.shop_id || r.id, name: (r) => r.shop_name || r.name || 'Shop', excerpt: (r) => 'Verification request', amount: () => null,
    doc: (r) => r.id_document || r.document_url || r.documents?.[0],
    approve: (r) => api.admin.approveVerification(r.shop_id || r.id), reject: (r, why) => api.admin.rejectVerification(r.shop_id || r.id, why),
  },
  shop_requests: {
    title: 'Shop Requests', hero: [colors.p450, colors.s500], emptyBg: [colors.p100, colors.s100], icon: 'ribbon',
    load: async () => { const { data } = await api.admin.getShops(); return { data: (Array.isArray(data) ? data : data?.shops || []).filter((s) => (s.status || '').toLowerCase() === 'pending') }; }, key: 'subscription_requests',
    id: (r) => r.id, name: (r) => r.name || 'Shop', excerpt: (r) => r.email || r.state || 'New shop', amount: () => null,
    approve: (r) => api.admin.approveShop(r.id), reject: (r) => api.admin.suspendShop(r.id),
  },
};

export default function AdminRequestsScreen({ route, navigation }) {
  const kind = route.params?.kind || 'cancel';
  // Dedicated, web-faithful screens for these two request kinds
  if (kind === 'verification') return <AdminVerificationRequestsScreen />;
  if (kind === 'agent_cashout') return <AdminAgentCashoutsScreen />;
  return <RequestsHub kind={kind} navigation={navigation} />;
}

function RequestsHub({ kind, navigation }) {
  const cfg = CFG[kind] || CFG.cancel;
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    cfg.load().then(({ data }) => setItems((data?.requests || data?.cashouts || data || []))).catch(() => setItems([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, [kind]); // eslint-disable-line

  useEffect(() => { setLoading(true); load(); }, [load]);

  const doApprove = async (r) => {
    setItems((prev) => prev.filter((x) => cfg.id(x) !== cfg.id(r))); notifySuccess();
    try { await cfg.approve(r); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not approve.'); load(); }
  };
  const doReject = async () => {
    const r = rejectFor; setRejectFor(null);
    setItems((prev) => prev.filter((x) => cfg.id(x) !== cfg.id(r)));
    try { if (cfg.reject) await cfg.reject(r, reason.trim()); } catch (e) { Alert.alert('Failed', 'Could not reject.'); load(); }
    setReason('');
  };

  if (loading) return <AdminScreen>{[0, 1, 2, 3].map((i) => <Shimmer key={i} height={84} radius={radius.lg} style={{ marginBottom: 10 }} />)}</AdminScreen>;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <LinearGradient colors={cfg.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name={cfg.icon} size={24} color={colors.white} /></View>
        <View style={{ flex: 1 }}><Text style={styles.heroTitle}>{cfg.title}</Text><Text style={styles.heroSub}>{items.length} pending</Text></View>
      </LinearGradient>

      {items.length === 0 ? (
        <LinearGradient colors={cfg.emptyBg} style={styles.empty}>
          <Ionicons name="checkmark-done-circle" size={40} color={cfg.hero[1]} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>No pending {cfg.title.toLowerCase()}.</Text>
        </LinearGradient>
      ) : items.map((r, i) => (
        <RequestCard key={cfg.id(r) || i} r={r} cfg={cfg} onApprove={() => doApprove(r)} onReject={() => (cfg.reject ? setRejectFor(r) : doApprove(r))} onDoc={cfg.doc ? () => navigation.navigate('AdminPage', { title: 'Document' }) : null} />
      ))}

      <Modal visible={!!rejectFor} transparent animationType="slide" onRequestClose={() => setRejectFor(null)}>
        <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setRejectFor(null)} /></View>
        <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Reject request</Text>
          <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={colors.textMuted} multiline value={reason} onChangeText={setReason} />
          <TouchableOpacity onPress={doReject}><LinearGradient colors={['#fb7185', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rejectBtn}><Text style={styles.rejectText}>Reject</Text></LinearGradient></TouchableOpacity>
        </View>
      </Modal>
    </AdminScreen>
  );
}

function RequestCard({ r, cfg, onApprove, onReject, onDoc }) {
  const amount = cfg.amount(r);
  const renderRight = () => (<View style={[styles.swipeAction, { backgroundColor: colors.seller }]}><Ionicons name="checkmark-circle" size={26} color={colors.white} /><Text style={styles.swipeText}>Approve</Text></View>);
  const renderLeft = () => (<View style={[styles.swipeAction, styles.swipeLeft, { backgroundColor: colors.sale }]}><Ionicons name="close-circle" size={26} color={colors.white} /><Text style={styles.swipeText}>Reject</Text></View>);
  return (
    <Swipeable renderRightActions={renderRight} renderLeftActions={renderLeft} onSwipeableOpen={(dir) => (dir === 'right' ? onApprove() : onReject())} overshootFriction={8}>
      <View style={styles.card}>
        <View style={styles.avatar}><Ionicons name={cfg.icon} size={18} color={colors.violet} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{cfg.name(r)}</Text>
          <Text style={styles.excerpt} numberOfLines={1}>{cfg.excerpt(r)}</Text>
          <Text style={styles.time}>{timeAgo(r.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          {amount != null && <Text style={styles.amount}>{money(amount)}</Text>}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onDoc && <TouchableOpacity onPress={onDoc} style={styles.docBtn}><Ionicons name="document-text" size={15} color={colors.violet} /></TouchableOpacity>}
            <TouchableOpacity onPress={onReject} style={styles.rejBtn}><Ionicons name="close" size={16} color={colors.sale} /></TouchableOpacity>
            <TouchableOpacity onPress={onApprove} style={styles.appBtn}><Ionicons name="checkmark" size={16} color={colors.white} /></TouchableOpacity>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

export function ShopSalesView() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(() => { api.admin.getShopSales().then(({ data }) => setSales(Array.isArray(data) ? data : data?.sales || [])).catch(() => setSales([])).finally(() => { setLoading(false); setRefreshing(false); }); }, []);
  useEffect(() => { load(); }, [load]);
  const del = (s) => Alert.alert('Delete sale', 'Remove this sale?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setSales((p) => p.filter((x) => x.id !== s.id)); try { await api.admin.deleteShopSale(s.id); } catch (_) { load(); } } }]);
  const countdown = (end) => { if (!end) return null; const d = (new Date(end).getTime() - Date.now()) / 1000; if (d <= 0) return 'Ended'; const days = Math.floor(d / 86400); const hrs = Math.floor((d % 86400) / 3600); return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h left`; };
  if (loading) return <AdminScreen>{[0, 1, 2].map((i) => <Shimmer key={i} height={96} radius={radius.lg} style={{ marginBottom: 10 }} />)}</AdminScreen>;
  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <LinearGradient colors={[colors.p450, '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="pricetag" size={24} color={colors.white} /></View>
        <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Shop Sales</Text><Text style={styles.heroSub}>{sales.length} sales</Text></View>
      </LinearGradient>
      {sales.length === 0 ? <Text style={styles.emptyText}>No shop sales.</Text> : sales.map((s) => {
        const cd = countdown(s.end_date || s.ends_at);
        const active = cd && cd !== 'Ended';
        return (
          <View key={s.id} style={styles.saleCard}>
            <LinearGradient colors={[colors.p450, '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dial}><Text style={styles.dialText}>-{s.discount_percent || s.percent || 0}%</Text></LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.saleName} numberOfLines={1}>{s.shop_name || s.title || 'Sale'}</Text>
              {cd && <View style={[styles.cd, active ? styles.cdActive : styles.cdEnded]}><Ionicons name="time" size={11} color={active ? '#065f46' : colors.textMuted} /><Text style={[styles.cdText, { color: active ? '#065f46' : colors.textMuted }]}>{cd}</Text></View>}
            </View>
            <TouchableOpacity onPress={() => del(s)} style={styles.rejBtn}><Ionicons name="trash-outline" size={16} color={colors.sale} /></TouchableOpacity>
          </View>
        );
      })}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xxl, padding: 18, ...shadow.violetGlow, marginBottom: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, borderRadius: radius.lg, gap: 6 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  emptyText: { textAlign: 'center', fontFamily: fonts.medium, color: colors.textMuted, marginTop: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 10, ...shadow.card },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  excerpt: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  amount: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  docBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rejBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.saleSoft, alignItems: 'center', justifyContent: 'center' },
  appBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.seller, alignItems: 'center', justifyContent: 'center' },
  swipeAction: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 22, borderRadius: radius.lg, marginBottom: 10, flexDirection: 'row', gap: 6 },
  swipeLeft: { alignItems: 'flex-start' },
  swipeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 14 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, height: 80, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 12 },
  rejectBtn: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  saleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 10, ...shadow.card },
  dial: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  dialText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 14 },
  saleName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  cd: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  cdActive: { backgroundColor: '#d1fae5' },
  cdEnded: { backgroundColor: colors.bgAlt },
  cdText: { fontFamily: fonts.bold, fontSize: 10 },
});
