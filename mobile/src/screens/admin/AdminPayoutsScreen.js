import React, { useEffect, useState, useCallback, useMemo } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '—');

export default function AdminPayoutsScreen({ route }) {
  const kind = route?.params?.kind || 'shop';
  return kind === 'agent' ? <AgentPayouts /> : <ShopPayouts />;
}

/* ==================== SHOP PAYOUTS ==================== */
function ShopPayouts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingShop, setProcessingShop] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [confirmShop, setConfirmShop] = useState(null);

  const fetchPayouts = useCallback(async () => {
    try { const { data: d } = await api.admin.getPendingPayouts(); setData(d); }
    catch { toast.error('Failed to load payout data'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const pending = data?.pending_payouts || [];
  const totalAdminOwes = data?.total_admin_owes || 0;
  const totalOrders = data?.total_orders || 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((p) => (p.shop_name || '').toLowerCase().includes(q) || (p.shop_id || '').toLowerCase().includes(q));
  }, [pending, search]);

  const markPaid = async (shop) => {
    setConfirmShop(null);
    setProcessingShop(shop.shop_id);
    try { await api.admin.markPayoutPaid(shop.shop_id); notifySuccess(); toast.success(`Payout marked as paid for ${shop.shop_name}`); await fetchPayouts(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to mark payout as paid'); }
    finally { setProcessingShop(null); }
  };
  const toggle = (id) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded((x) => (x === id ? null : id)); };

  if (loading) {
    return <AdminScreen testID="admin-payouts-content"><View style={{ flexDirection: 'row', gap: 10 }}>{[0, 1, 2].map((i) => <Shimmer key={i} width="31%" height={96} radius={radius.md} />)}</View>{[0, 1, 2].map((i) => <Shimmer key={i} height={120} radius={radius.lg} style={{ marginTop: 12 }} />)}</AdminScreen>;
  }

  return (
    <AdminScreen testID="admin-payouts-content" refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayouts(); }}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle} testID="admin-payouts-title">Shop Payouts</Text>
          <Text style={s.pageSub}>Pay shops for loyalty point deductions on their orders</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={() => { setLoading(true); fetchPayouts(); }} testID="refresh-payouts-btn"><Ionicons name="refresh" size={16} color={colors.textSecondary} /><Text style={s.refreshText}>Refresh</Text></TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={s.summaryRow}>
        <SummaryCard testID="admin-owes-card" grad={['#ef4444', '#e11d48']} icon="cash" label="Total You Owe Shops" value={<CountUp value={totalAdminOwes} prefix="$" decimals={2} style={s.sumValue} />} note="Deducted from shops due to points" />
        <SummaryCard testID="pending-orders-card" grad={['#3b82f6', colors.s500]} icon="cube" label="Orders With Payouts" value={<CountUp value={totalOrders} style={s.sumValue} />} />
        <SummaryCard testID="shops-pending-card" grad={['#10b981', '#0d9488']} icon="storefront" label="Shops Pending Payout" value={<CountUp value={pending.length} style={s.sumValue} />} />
      </View>

      {/* Info banner */}
      <View style={s.infoBanner} testID="info-banner">
        <Ionicons name="card" size={18} color="#2563eb" />
        <View style={{ flex: 1 }}>
          <Text style={s.infoTitle}>How it works</Text>
          <Text style={s.infoBody}>When customers use loyalty points, the discount is split between commission reduction and shop revenue reduction. If the discount exceeds commission, you owe the shop the difference.</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.search}><Ionicons name="search" size={16} color={colors.textMuted} /><TextInput style={s.searchInput} placeholder="Search shops..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} testID="payout-search-input" />{search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}</View>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={s.noPayouts} testID="no-payouts"><Ionicons name="checkmark-circle" size={54} color="#10b981" /><Text style={s.noPayoutsTitle}>All Caught Up!</Text><Text style={s.noPayoutsBody}>No pending payouts. All shops have been paid.</Text></View>
      ) : (
        <View testID="payouts-list" style={{ gap: 12 }}>
          {filtered.map((p) => {
            const open = expanded === p.shop_id;
            const busy = processingShop === p.shop_id;
            return (
              <View key={p.shop_id} style={s.payoutCard} testID={`payout-row-${p.shop_id}`}>
                <View style={s.payoutHead}>
                  <LinearGradient colors={[colors.p450, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}><Text style={s.avatarText}>{(p.shop_name || '?').charAt(0).toUpperCase()}</Text></LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.shopName} numberOfLines={1} testID="payout-shop-name">{p.shop_name}</Text>
                    <Text style={s.orderCount}>{p.order_count} order(s)</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.oweLabel}>You Owe Shop</Text>
                    <Text style={s.oweAmount} testID="payout-owe-amount">{money(p.admin_owes_shop)}</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.markPaidBtn} onPress={() => setConfirmShop(p)} disabled={busy} testID="mark-paid-btn">
                  {busy ? <Spinner size={15} color={colors.white} /> : <Ionicons name="checkmark-circle" size={15} color={colors.white} />}
                  <Text style={s.markPaidText}>Mark Paid</Text>
                </TouchableOpacity>

                {/* Breakdown */}
                <View style={s.breakdownRow}>
                  <View style={[s.bdCell, { backgroundColor: '#fffbeb' }]}><Text style={[s.bdLabel, { color: '#d97706' }]}>Points Discount</Text><Text style={[s.bdValue, { color: '#b45309' }]}>{money(p.loyalty_discount)}</Text></View>
                  <View style={[s.bdCell, { backgroundColor: colors.surfaceMuted }]}><Text style={[s.bdLabel, { color: colors.textMuted }]}>Covered by Commission</Text><Text style={[s.bdValue, { color: colors.textSecondary }]}>-{money(p.commission_deducted)}</Text></View>
                  <View style={[s.bdCell, { backgroundColor: '#fef2f2' }]}><Text style={[s.bdLabel, { color: '#ef4444' }]}>You Owe Shop</Text><Text style={[s.bdValue, { color: '#dc2626' }]}>{money(p.admin_owes_shop)}</Text></View>
                </View>

                <TouchableOpacity style={s.toggleOrders} onPress={() => toggle(p.shop_id)} testID={`toggle-orders-${p.shop_id}`}>
                  <Ionicons name="eye-outline" size={14} color={colors.textMuted} /><Text style={s.toggleOrdersText}>{open ? 'Hide' : 'Show'} Orders</Text><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textMuted} />
                </TouchableOpacity>

                {open && p.orders && (
                  <View style={s.ordersTableWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={s.tHead}>
                          <Text style={[s.tHeadCell, { width: 74 }]}>Order ID</Text>
                          <Text style={[s.tHeadCell, { width: 78 }]}>Points</Text>
                          <Text style={[s.tHeadCell, { width: 74, textAlign: 'right' }]}>Discount</Text>
                          <Text style={[s.tHeadCell, { width: 74, textAlign: 'right' }]}>You Owe</Text>
                          <Text style={[s.tHeadCell, { width: 84 }]}>Date</Text>
                        </View>
                        {p.orders.map((o) => (
                          <View key={o.id} style={s.tRow}>
                            <Text style={[s.tMono, { width: 74 }]}>{String(o.id).slice(0, 8)}</Text>
                            <View style={{ width: 78 }}>{o.loyalty_points_redeemed > 0 ? <View style={s.ptsBadge}><Text style={s.ptsText}>{o.loyalty_points_redeemed} pts</Text></View> : <Text style={s.tMuted}>-</Text>}</View>
                            <Text style={[s.tCell, { width: 74, textAlign: 'right', color: '#d97706' }]}>{money(o.loyalty_discount_amount)}</Text>
                            <Text style={[s.tCell, { width: 74, textAlign: 'right', color: o.admin_owes_shop_amount > 0 ? '#dc2626' : colors.textMuted }]}>{money(o.admin_owes_shop_amount)}</Text>
                            <Text style={[s.tMuted, { width: 84 }]}>{fmtDate(o.created_at)}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <ConfirmPayoutSheet shop={confirmShop} onClose={() => setConfirmShop(null)} onConfirm={() => markPaid(confirmShop)} />
    </AdminScreen>
  );
}

function ConfirmPayoutSheet({ shop, onClose, onConfirm }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  return (
    <Modal visible={!!shop} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[s.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={s.grabber} />
        {shop && (
          <>
            <View style={s.sheetTitleRow}><Ionicons name="cash" size={18} color="#059669" /><Text style={s.sheetTitle}>Confirm Payout to {shop.shop_name}</Text></View>
            <Text style={s.confirmIntro}>Confirm you have paid the shop:</Text>
            <View style={s.confirmBox}>
              <View style={s.confirmLine}><Text style={s.confirmKey}>Loyalty Discount (from orders):</Text><Text style={[s.confirmVal, { color: '#d97706' }]}>{money(shop.loyalty_discount)}</Text></View>
              <View style={s.confirmLine}><Text style={s.confirmKey}>Covered by Commission:</Text><Text style={[s.confirmVal, { color: colors.textMuted }]}>-{money(shop.commission_deducted)}</Text></View>
              <View style={[s.confirmLine, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 }]}><Text style={[s.confirmKey, { fontFamily: fonts.bold, color: colors.ink }]}>Amount to Pay Shop:</Text><Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: '#dc2626' }}>{money(shop.admin_owes_shop)}</Text></View>
            </View>
            <View style={s.warnBox}><Ionicons name="alert-circle" size={16} color="#d97706" /><Text style={s.warnText}>Make sure you have transferred {money(shop.admin_owes_shop)} to the shop.</Text></View>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={onConfirm}><LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtn}><Text style={s.confirmBtnText}>Confirm Paid</Text></LinearGradient></TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

/* ==================== AGENT PAYOUTS ==================== */
function AgentPayouts() {
  const [data, setData] = useState({ payouts: [], total_agent_paid: 0, total_admin_owed: 0, total_funded_from_loyalty: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyOwed, setOnlyOwed] = useState(false);

  const fetchData = useCallback(async () => {
    try { const { data: d } = await api.admin.getAgentPayouts(); setData(d || { payouts: [] }); }
    catch { toast.error('Failed to load agent payouts'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => (data.payouts || []).filter((r) => {
    if (onlyOwed && !(Number(r.admin_owed) > 0)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.agent_name || '').toLowerCase().includes(q) || (r.shop_name || '').toLowerCase().includes(q) || (r.order_id || '').toLowerCase().includes(q);
  }), [data.payouts, onlyOwed, query]);

  return (
    <AdminScreen testID="admin-agent-payouts" refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }}>
      {/* Hero */}
      <LinearGradient colors={['#f06a92', colors.p600, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.agentHero}>
        <View style={s.agentBlob} />
        <View style={s.agentPill}><Ionicons name="wallet" size={13} color={colors.white} /><Text style={s.agentPillText}>Agent Payouts</Text></View>
        <Text style={s.agentTitle}>Agent Commission Payouts</Text>
        <Text style={s.agentSub}>What each agent earned from referred-shop orders — and what admin funded when loyalty points reduced the order's commission.</Text>
        <TouchableOpacity style={s.agentRefresh} onPress={() => { setLoading(true); fetchData(); }}><Ionicons name="refresh" size={15} color={colors.white} /><Text style={s.agentRefreshText}>Refresh</Text></TouchableOpacity>
      </LinearGradient>

      {/* Summary cards */}
      <View style={s.summaryRow}>
        <AgentSummary icon="cash" tint="#10b981" bg="#d1fae5" label="Total Paid to Agents" value={data.total_agent_paid} />
        <AgentSummary icon="trending-down" tint="#e11d48" bg="#ffe4e6" label="Admin Owed (from profit)" value={data.total_admin_owed} />
        <AgentSummary icon="gift" tint="#d97706" bg="#fef3c7" label="Funded due to Loyalty" value={data.total_funded_from_loyalty} />
      </View>

      {/* Filters */}
      <View style={s.agentFilters}>
        <View style={[s.search, { flex: 1 }]}><Ionicons name="search" size={16} color={colors.textMuted} /><TextInput style={s.searchInput} placeholder="Search agent, shop, or order…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} /></View>
        <TouchableOpacity style={[s.owedToggle, onlyOwed && { backgroundColor: '#e11d48', borderColor: '#e11d48' }]} onPress={() => setOnlyOwed((v) => !v)}><Text style={[s.owedToggleText, onlyOwed && { color: colors.white }]}>{onlyOwed ? 'Owed only ✓' : 'Admin-owed only'}</Text></TouchableOpacity>
      </View>

      {/* Table */}
      <View style={s.agentTableCard}>
        {loading ? <View style={{ padding: 30, alignItems: 'center' }}><Spinner size={26} color={colors.violet} /></View>
          : rows.length === 0 ? <View style={{ padding: 40, alignItems: 'center' }}><Ionicons name="wallet-outline" size={34} color={colors.border} /><Text style={s.emptyText}>No agent payouts yet</Text></View>
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View testID="agent-payouts-table">
                  <View style={s.tHead}>
                    <Text style={[s.tHeadCell, { width: 110 }]}>Agent</Text>
                    <Text style={[s.tHeadCell, { width: 110 }]}>Shop</Text>
                    <Text style={[s.tHeadCell, { width: 74 }]}>Order</Text>
                    <Text style={[s.tHeadCell, { width: 56, textAlign: 'right' }]}>Share</Text>
                    <Text style={[s.tHeadCell, { width: 84, textAlign: 'right' }]}>Earned</Text>
                    <Text style={[s.tHeadCell, { width: 80, textAlign: 'right' }]}>From Order</Text>
                    <Text style={[s.tHeadCell, { width: 100, textAlign: 'right' }]}>Admin Owed</Text>
                    <Text style={[s.tHeadCell, { width: 84 }]}>Date</Text>
                  </View>
                  {rows.map((r) => (
                    <View key={r.id} style={s.tRow} testID={`agent-payout-row-${r.id}`}>
                      <Text style={[s.tCell, { width: 110 }]} numberOfLines={1}>{r.agent_name || '—'}</Text>
                      <Text style={[s.tMuted, { width: 110 }]} numberOfLines={1}>{r.shop_name || '—'}</Text>
                      <Text style={[s.tMono, { width: 74 }]}>#{String(r.order_id || '').slice(0, 8)}</Text>
                      <Text style={[s.tMuted, { width: 56, textAlign: 'right' }]}>{Math.round(r.share_percent || 0)}%</Text>
                      <Text style={[s.tCell, { width: 84, textAlign: 'right', color: '#059669' }]}>{money(r.agent_amount)}</Text>
                      <Text style={[s.tMuted, { width: 80, textAlign: 'right' }]}>{money(r.covered_by_order)}</Text>
                      <View style={{ width: 100, alignItems: 'flex-end', justifyContent: 'center' }}>
                        {Number(r.admin_owed) > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#e11d48' }}>{money(r.admin_owed)}</Text>
                            {r.loyalty_redeemed && <View style={s.loyaltyBadge}><Text style={s.loyaltyText}>LOYALTY</Text></View>}
                          </View>
                        ) : <Text style={s.tMuted}>—</Text>}
                      </View>
                      <Text style={[s.tMuted, { width: 84 }]}>{fmtDate(r.created_at)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
      </View>

      <Text style={s.agentFoot}>Agents are credited their share to their wallet automatically. Admin Owed is the part admin funded from profit because loyalty points reduced the order's collected commission.</Text>
    </AdminScreen>
  );
}

function SummaryCard({ grad, icon, label, value, note, testID }) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sumCard} testID={testID}>
      <View style={s.sumIcon}><Ionicons name={icon} size={16} color={colors.white} /></View>
      <Text style={s.sumLabel} numberOfLines={2}>{label}</Text>
      {value}
      {note ? <Text style={s.sumNote} numberOfLines={2}>{note}</Text> : null}
    </LinearGradient>
  );
}
function AgentSummary({ icon, tint, bg, label, value }) {
  return (
    <View style={s.agentSumCard}>
      <View style={s.agentSumHead}><View style={[s.agentSumIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={15} color={tint} /></View></View>
      <Text style={s.agentSumLabel} numberOfLines={2}>{label}</Text>
      <CountUp value={value} prefix="$" decimals={2} style={[s.agentSumValue, { color: tint }]} />
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  pageSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  refreshText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sumCard: { flex: 1, borderRadius: radius.md, padding: 12, overflow: 'hidden', ...shadow.card },
  sumIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  sumLabel: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 10, minHeight: 26 },
  sumValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  sumNote: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.body, fontSize: 8.5, marginTop: 3 },

  infoBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: radius.md, padding: 12, marginBottom: 14 },
  infoTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: '#1e3a8a' },
  infoBody: { fontFamily: fonts.body, fontSize: 11, color: '#2563eb', marginTop: 2, lineHeight: 15 },

  searchWrap: { marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },

  noPayouts: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 46, ...shadow.card },
  noPayoutsTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginTop: 12 },
  noPayoutsBody: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  payoutCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  payoutHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  shopName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  orderCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  oweLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  oweAmount: { fontFamily: fonts.extrabold, fontSize: 20, color: '#dc2626', marginTop: 1 },
  markPaidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: radius.md, paddingVertical: 11, marginTop: 12 },
  markPaidText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
  breakdownRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bdCell: { flex: 1, borderRadius: radius.sm, padding: 9 },
  bdLabel: { fontFamily: fonts.medium, fontSize: 9, minHeight: 22 },
  bdValue: { fontFamily: fonts.bold, fontSize: 13.5, marginTop: 2 },
  toggleOrders: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
  toggleOrdersText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  ordersTableWrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10 },

  tHead: { flexDirection: 'row', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  tHeadCell: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.textMuted },
  tRow: { flexDirection: 'row', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center' },
  tCell: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  tMuted: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  tMono: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  ptsBadge: { alignSelf: 'flex-start', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  ptsText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#b45309' },

  /* agent */
  agentHero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', marginBottom: 14, ...shadow.emphasis },
  agentBlob: { position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  agentPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  agentPillText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11 },
  agentTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5 },
  agentSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 6, lineHeight: 17 },
  agentRefresh: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9, marginTop: 14 },
  agentRefreshText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  agentSumCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, ...shadow.card },
  agentSumHead: { marginBottom: 8 },
  agentSumIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  agentSumLabel: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, minHeight: 26 },
  agentSumValue: { fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.5, marginTop: 2 },
  agentFilters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  owedToggle: { justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  owedToggleText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary },
  agentTableCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, ...shadow.card },
  loyaltyBadge: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1 },
  loyaltyText: { fontFamily: fonts.bold, fontSize: 7.5, color: '#b45309' },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 8 },
  agentFoot: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 12, lineHeight: 16 },

  /* confirm sheet */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, flex: 1 },
  confirmIntro: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  confirmBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, gap: 8 },
  confirmLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, flex: 1 },
  confirmVal: { fontFamily: fonts.bold, fontSize: 13 },
  warnBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 12, marginTop: 12 },
  warnText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: '#92400e', lineHeight: 16 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 13 },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  confirmBtn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  confirmBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
