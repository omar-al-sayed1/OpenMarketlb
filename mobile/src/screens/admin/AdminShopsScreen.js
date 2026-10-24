import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TextInput, TouchableOpacity, Pressable, StyleSheet, Modal, ScrollView, Switch, useWindowDimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import Animated, { FadeInDown, FadeIn, LinearTransition, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { AdminScreen, AdminHeroCard, AdminStatCard, AdminCard, StatusPill, Shimmer, CountUp } from '../../components/admin/AdminKit';
import { useReveal } from '../../lib/useReveal';
import AdminShopDetail from '../../components/admin/AdminShopDetail';
import { colors, admin, radius, fonts, shadow } from '../../theme/theme';

const GRID_KEY = 'admin_shops_grid';
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const STATUS_META = {
  active: { variant: 'emerald', icon: 'checkmark-circle', label: 'Active' },
  trial: { variant: 'blue', icon: 'flash', label: 'Trial' },
  pending: { variant: 'amber', icon: 'time', label: 'Pending' },
  expired: { variant: 'red', icon: 'warning', label: 'Expired' },
  suspended: { variant: 'slate', icon: 'close-circle', label: 'Suspended' },
};
const statusMeta = (s) => STATUS_META[s] || STATUS_META.pending;
const isSubscribed = (shop) => shop?.subscription_required !== false && ['active', 'trial'].includes(shop?.subscription_status);

const STATUS_OPTS = [['all', 'All Statuses'], ['active', 'Active'], ['trial', 'Trial'], ['pending', 'Pending'], ['expired', 'Expired'], ['suspended', 'Suspended']];
const SUB_OPTS = [['all', 'All Shops'], ['subscribed', 'Subscribed'], ['not_subscribed', 'Not Subscribed']];
const REF_OPTS = [['all', 'All Shops'], ['referred', 'Referred by agent'], ['direct', 'Direct (no agent)']];
const PAY_OPTS = [['all', 'All Payments'], ['card', 'Card'], ['manual', 'Manual']];
const GRID_ICONS = [['reorder-four', 1], ['grid', 2], ['apps', 3]];

/* ---------- press-scale + layout card wrapper ---------- */
function PressCard({ onPress, onLongPress, style, children, index = 0 }) {
  const s = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Simple: a plain quick fade on show, a short linear settle on reorder/filter —
  // no staggered slide-in, no spring bounce.
  return (
    <Animated.View layout={LinearTransition.duration(180)} entering={FadeIn.duration(180)} style={style}>
      <Pressable onPress={onPress} onLongPress={onLongPress} onPressIn={() => { s.value = withTiming(0.98, { duration: 90 }); }} onPressOut={() => { s.value = withTiming(1, { duration: 90 }); }}>
        <Animated.View style={aStyle}>{children}</Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- shop logo ---------- */
function Logo({ uri, size = 48, radiusV = 14 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radiusV, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri: img(uri) }} style={{ width: '100%', height: '100%' }} />
        : <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={size * 0.45} color={colors.white} /></LinearGradient>}
    </View>
  );
}

export default function AdminShopsScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shops, setShops] = useState([]);
  const [states, setStates] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [agents, setAgents] = useState([]);
  const [platformSettings, setPlatformSettings] = useState({ subscription_price: 29, commission_percentage: 0 });
  const [guestApps, setGuestApps] = useState([]);
  const [tierRequests, setTierRequests] = useState([]);

  const [activeTab, setActiveTab] = useState('shops');
  const [gridCols, setGridCols] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [referredFilter, setReferredFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const [detail, setDetail] = useState(null);
  const [menuShop, setMenuShop] = useState(null);
  const [guestEdit, setGuestEdit] = useState(null);
  const [guestApprove, setGuestApprove] = useState(null);

  useEffect(() => { AsyncStorage.getItem(GRID_KEY).then((v) => { if (v) setGridCols(parseInt(v, 10) || 1); }); }, []);
  const setGrid = (n) => { setGridCols(n); AsyncStorage.setItem(GRID_KEY, String(n)); };

  const load = useCallback(async () => {
    const [s, st, cat, ag, ps, ga, tr] = await Promise.allSettled([
      api.admin.getShops(), api.states.getAll(), api.categories.getAll(),
      api.admin.listReferralAgents(), api.admin.getPlatformSettings(),
      api.guestApplications.getAll('pending'), api.adminTier.getUpgradeRequests(),
    ]);
    if (s.status === 'fulfilled') setShops(Array.isArray(s.value.data) ? s.value.data : s.value.data?.shops || []);
    if (st.status === 'fulfilled') setStates(st.value.data || []);
    if (cat.status === 'fulfilled') setAllCategories(cat.value.data || []);
    if (ag.status === 'fulfilled') setAgents(Array.isArray(ag.value.data) ? ag.value.data : ag.value.data?.agents || []);
    if (ps.status === 'fulfilled') setPlatformSettings(ps.value.data || {});
    if (ga.status === 'fulfilled') setGuestApps(ga.value.data || []);
    if (tr.status === 'fulfilled') setTierRequests(tr.value.data?.requests || []);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep-link from the map's "Open shop details"
  useEffect(() => {
    const id = route?.params?.openShopId;
    if (id && shops.length) {
      const s = shops.find((x) => x.id === id);
      if (s) { setDetail(s); navigation.setParams({ openShopId: undefined }); }
    }
  }, [route?.params?.openShopId, shops]); // eslint-disable-line

  const stateOpts = useMemo(() => [['all', 'All Regions'], ...Array.from(new Set(shops.map((s) => s.state).filter(Boolean))).sort().map((st) => [st, st])], [shops]);
  const agentOpts = useMemo(() => [['all', 'All Agents'], ...agents.map((a) => [a.id, a.name || a.email || 'Agent'])], [agents]);

  const filtered = useMemo(() => {
    let f = [...shops];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter((s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q) || s.referred_by_agent_name?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') f = f.filter((s) => s.subscription_status === statusFilter);
    if (paymentFilter !== 'all') f = f.filter((s) => s.payment_method === paymentFilter);
    if (subscriptionFilter === 'subscribed') f = f.filter(isSubscribed);
    else if (subscriptionFilter === 'not_subscribed') f = f.filter((s) => !isSubscribed(s));
    if (referredFilter === 'referred') f = f.filter((s) => !!s.referred_by_agent_id);
    else if (referredFilter === 'direct') f = f.filter((s) => !s.referred_by_agent_id);
    if (stateFilter !== 'all') f = f.filter((s) => (s.state || '') === stateFilter);
    if (agentFilter !== 'all') f = f.filter((s) => s.referred_by_agent_id === agentFilter);
    const prio = { pending: 0, trial: 1, active: 2, expired: 3, suspended: 4 };
    f.sort((a, b) => { const pa = prio[a.subscription_status] ?? 5, pb = prio[b.subscription_status] ?? 5; return pa !== pb ? pa - pb : (a.name || '').localeCompare(b.name || ''); });
    return f;
  }, [shops, searchQuery, statusFilter, paymentFilter, subscriptionFilter, referredFilter, stateFilter, agentFilter]);

  const { visible: visibleShops, hasMore: moreShops, revealing: revealingShops, revealMore: revealShops } = useReveal(filtered, 10);

  const anyFilter = searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || subscriptionFilter !== 'all' || referredFilter !== 'all' || stateFilter !== 'all' || agentFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); setSubscriptionFilter('all'); setReferredFilter('all'); setStateFilter('all'); setAgentFilter('all'); };

  const stats = {
    total: shops.length,
    active: shops.filter((s) => s.subscription_status === 'active').length,
    pending: shops.filter((s) => s.subscription_status === 'pending').length,
    guest: guestApps.length,
  };

  const gap = 10;
  const avail = width - 28;
  const cardW = gridCols === 1 ? avail : (avail - gap * (gridCols - 1)) / gridCols;

  /* ---- shop actions (list scope) ---- */
  const runAction = async (fn, id, okMsg) => {
    try { await fn(id); notifySuccess(); if (okMsg) toast.success(okMsg); setMenuShop(null); setDetail(null); load(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Action failed'); }
  };
  const approveShop = (s) => runAction(api.admin.approveShop, s.id, 'Shop approved');
  const suspendShop = (s) => runAction(api.admin.suspendShop, s.id, 'Shop suspended');
  const doVerify = (s) => runAction(s.is_verified ? api.admin.unverifyShop : api.admin.verifyShop, s.id, s.is_verified ? 'Verification removed' : 'Shop verified');
  const toggleVerify = (s) => {
    if (s.is_verified) {
      Alert.alert('Remove verification', `Remove the verified badge from "${s.name}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => doVerify(s) }]);
    } else {
      Alert.alert('Verify shop', `Verify "${s.name}"? A verified badge will be shown on this shop across the platform.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Verify', onPress: () => doVerify(s) }]);
    }
  };
  const deleteShop = (s) => Alert.alert('Delete shop', `Delete "${s.name}"? This cannot be undone.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => runAction(api.admin.deleteShop, s.id, 'Shop deleted') }]);

  const rejectGuest = (app) => Alert.alert('Reject application', 'Reject this guest application?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reject', style: 'destructive', onPress: async () => { try { await api.guestApplications.reject(app.id); toast.success('Application rejected'); load(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } } }]);
  const approveTier = async (req) => { try { await api.adminTier.approveUpgrade(req.id, ''); toast.success('Tier upgrade approved'); load(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } };
  const rejectTier = (req) => Alert.alert('Reject request', 'Reject this tier upgrade request?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reject', style: 'destructive', onPress: async () => { try { await api.adminTier.rejectUpgrade(req.id, ''); toast.success('Tier upgrade rejected'); load(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } } }]);

  if (loading) {
    return (
      <AdminScreen testID="admin-shops-page">
        <Shimmer height={80} radius={radius.lg} />
        <View style={styles.statRow}>{[0, 1].map((i) => <Shimmer key={i} width="48%" height={92} radius={radius.lg} />)}</View>
        <View style={[styles.statRow, { marginTop: 10 }]}>{[2, 3].map((i) => <Shimmer key={i} width="48%" height={92} radius={radius.lg} />)}</View>
        {[0, 1, 2].map((i) => <Shimmer key={i} height={96} radius={radius.lg} style={{ marginTop: 12 }} />)}
      </AdminScreen>
    );
  }

  return (
    <AdminScreen testID="admin-shops-page" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onEndReached={() => activeTab === 'shops' && moreShops && revealShops()}>
      <AdminHeroCard icon="storefront" title="Shops Management" titleTestID="admin-shops-title" subtitle="Manage shops, subscriptions & commissions" />

      {/* ===== Section switcher ===== */}
      <SectionTabs active={activeTab} onChange={setActiveTab} guestCount={stats.guest} tierCount={tierRequests.filter((r) => r.status === 'pending').length} />

      {activeTab === 'shops' && (
        <Animated.View entering={FadeIn.duration(260)}>
          {/* Stat tiles */}
          <View style={styles.statRow}>
            <AdminStatCard label="Total Shops" value={stats.total} icon="storefront" variant="violet" index={0} />
            <AdminStatCard label="Active" value={stats.active} icon="checkmark-circle" variant="emerald" index={1} />
          </View>
          <View style={[styles.statRow, { marginTop: 10 }]}>
            <AdminStatCard label="Pending" value={stats.pending} icon="time" variant="amber" index={2} />
            <AdminStatCard label="Guest Apps" value={stats.guest} icon="people" variant="blue" index={3} />
          </View>

          {/* Filters */}
          <View style={styles.filters} testID="admin-shops-filters">
            <View style={styles.search}>
              <Ionicons name="search" size={17} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Search by name, email, phone, or agent…" placeholderTextColor={colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} testID="admin-shops-search" />
              {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={17} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              <Picker testID="admin-shops-status-filter" icon="ellipse" value={statusFilter} options={STATUS_OPTS} onChange={setStatusFilter} />
              <Picker testID="admin-shops-subscription-filter" icon="ribbon-outline" value={subscriptionFilter} options={SUB_OPTS} onChange={setSubscriptionFilter} />
              <Picker testID="admin-shops-referred-filter" icon="gift-outline" value={referredFilter} options={REF_OPTS} onChange={setReferredFilter} />
              <Picker testID="admin-shops-agent-filter" icon="person-outline" value={agentFilter} options={agentOpts} onChange={setAgentFilter} />
              <Picker testID="admin-shops-state-filter" icon="location-outline" value={stateFilter} options={stateOpts} onChange={setStateFilter} />
              <Picker testID="admin-shops-payment-filter" icon="card-outline" value={paymentFilter} options={PAY_OPTS} onChange={setPaymentFilter} />
            </ScrollView>
            <View style={styles.filterFoot}>
              <Text style={styles.resultCount} testID="admin-shops-result-count">
                Showing <Text style={styles.resultCountBold}>{filtered.length}</Text> of {shops.length} shops
              </Text>
              <View style={styles.gridToggle}>
                {GRID_ICONS.map(([ic, n]) => (
                  <TouchableOpacity key={n} onPress={() => setGrid(n)} style={[styles.gridBtn, gridCols === n && styles.gridBtnOn]}>
                    <Ionicons name={ic} size={15} color={gridCols === n ? colors.white : colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {anyFilter && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} testID="admin-shops-clear-filters">
                <Ionicons name="close" size={13} color={colors.violet} /><Text style={styles.clearText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Shop grid */}
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}><Ionicons name="storefront-outline" size={40} color={colors.border} /><Text style={styles.emptyText}>No shops found</Text></View>
          ) : (
            <View style={styles.grid}>
              {visibleShops.map((shop, i) => (
                <PressCard key={shop.id} index={i} style={{ width: cardW }} onPress={() => setDetail(shop)} onLongPress={() => setMenuShop(shop)}>
                  <ShopCard shop={shop} cols={gridCols} platformSettings={platformSettings} onApprove={() => approveShop(shop)} onVerify={() => toggleVerify(shop)} onMenu={() => setMenuShop(shop)} />
                </PressCard>
              ))}
              {revealingShops && [0, 1].map((i) => <Shimmer key={`sk${i}`} width={cardW} height={96} radius={radius.lg} />)}
            </View>
          )}
        </Animated.View>
      )}

      {activeTab === 'guest' && (
        <Animated.View entering={FadeIn.duration(260)} testID="guest-applications-section">
          {guestApps.length === 0 ? <View style={styles.emptyBox}><Ionicons name="people-outline" size={40} color={colors.border} /><Text style={styles.emptyText}>No pending applications</Text></View>
            : guestApps.map((app, i) => (
              <Animated.View key={app.id} entering={FadeInDown.delay(i * 50)} testID={`guest-app-${app.id}`}>
                <GuestCard app={app} onApprove={() => setGuestApprove(app)} onEdit={() => setGuestEdit(app)} onReject={() => rejectGuest(app)} />
              </Animated.View>
            ))}
        </Animated.View>
      )}

      {activeTab === 'tier' && (
        <Animated.View entering={FadeIn.duration(260)} testID="tier-requests-section">
          {tierRequests.filter((r) => r.status === 'pending').length === 0 ? <View style={styles.emptyBox}><Ionicons name="star-outline" size={40} color={colors.border} /><Text style={styles.emptyText}>No tier requests</Text></View>
            : tierRequests.filter((r) => r.status === 'pending').map((req, i) => (
              <Animated.View key={req.id} entering={FadeInDown.delay(i * 50)} testID={`tier-request-${req.id}`}>
                <TierCard req={req} onApprove={() => approveTier(req)} onReject={() => rejectTier(req)} />
              </Animated.View>
            ))}
        </Animated.View>
      )}

      {/* ===== Sheets ===== */}
      <ShopMenu shop={menuShop} onClose={() => setMenuShop(null)} onView={(s) => { setMenuShop(null); setDetail(s); }} onApprove={approveShop} onVerify={toggleVerify} onSuspend={suspendShop} onDelete={deleteShop} />
      {detail && (
        <AdminShopDetail
          shop={detail} agents={agents} categories={allCategories} platformSettings={platformSettings}
          onClose={() => setDetail(null)} onChanged={load}
          onMap={() => { setDetail(null); navigation.navigate('AdminMap', { focusShopId: detail.id }); }}
        />
      )}
      <GuestEditSheet app={guestEdit} states={states} categories={allCategories} onClose={() => setGuestEdit(null)} onSaved={() => { setGuestEdit(null); load(); }} />
      <GuestApproveSheet app={guestApprove} agents={agents} onClose={() => setGuestApprove(null)} onDone={() => { setGuestApprove(null); load(); }} />
    </AdminScreen>
  );
}

/* ================= Section tabs ================= */
function SectionTabs({ active, onChange, guestCount, tierCount }) {
  const TABS = [{ key: 'shops', label: 'Shops', icon: 'storefront' }, { key: 'guest', label: 'Guest Apps', icon: 'people', badge: guestCount }, { key: 'tier', label: 'Tier', icon: 'star', badge: tierCount }];
  return (
    <View style={styles.tabs}>
      {TABS.map((t) => {
        const on = active === t.key;
        const Inner = (
          <View style={styles.tabInner}>
            <Ionicons name={t.icon} size={15} color={on ? colors.white : colors.textSecondary} />
            <Text style={[styles.tabText, on && { color: colors.white }]}>{t.label}</Text>
            {t.badge > 0 && <View style={[styles.tabBadge, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={[styles.tabBadgeText, on && { color: colors.white }]}>{t.badge}</Text></View>}
          </View>
        );
        return (
          <TouchableOpacity key={t.key} style={{ flex: 1 }} activeOpacity={0.85} onPress={() => onChange(t.key)}>
            {on ? <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabPill}>{Inner}</LinearGradient> : <View style={styles.tabPillIdle}>{Inner}</View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ================= Shop card (density-adaptive) ================= */
function ShopCard({ shop, cols, platformSettings, onApprove, onVerify, onMenu }) {
  const meta = statusMeta(shop.subscription_status);
  const premium = shop.subscription_status === 'active' || shop.tier === 'pro';

  if (cols === 3) {
    return (
      <View style={[styles.card, styles.card3]}>
        <Logo uri={shop.logo} size={44} radiusV={12} />
        <Text style={styles.card3Name} numberOfLines={1}>{shop.name}</Text>
        <View style={[styles.statusDot, { backgroundColor: (admin.pills[meta.variant] || admin.pills.slate)[1] }]} />
      </View>
    );
  }
  if (cols === 2) {
    return (
      <View style={[styles.card, { padding: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Logo uri={shop.logo} size={42} radiusV={12} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>{shop.name}</Text>
            <Text style={styles.cardEmail} numberOfLines={1}>{shop.email || shop.state || '—'}</Text>
          </View>
        </View>
        <View style={styles.card2Foot}>
          <StatusPill label={meta.label} variant={meta.variant} />
          {premium && <PremiumChip />}
        </View>
        {shop.subscription_status === 'pending' && <TouchableOpacity style={styles.miniApprove} onPress={onApprove}><Ionicons name="checkmark" size={13} color={colors.white} /><Text style={styles.miniApproveText}>Approve</Text></TouchableOpacity>}
      </View>
    );
  }
  // 1-col full card
  const rate = shop.commission_percentage ?? platformSettings?.commission_percentage ?? 10;
  const type = shop.commission_type || 'on_customer';
  const typeLabel = type === 'on_shop' ? 'On Shop' : type === 'half_half' ? 'Half/Half' : 'On Customer';
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Logo uri={shop.logo} size={48} radiusV={14} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.cardName} numberOfLines={1}>{shop.name}</Text>
            <LinearGradient colors={[colors.p450, '#ffc0cb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.walletChip} testID={`shop-wallet-chip-${shop.id}`}><Ionicons name="wallet" size={10} color={colors.white} /><Text style={styles.walletChipText}>{money(shop.wallet_balance)}</Text></LinearGradient>
            {shop.referred_by_agent_id ? <View style={styles.refBadge} testID={`shop-referred-badge-${shop.id}`}><Ionicons name="person-add" size={10} color={colors.p800} /><Text style={styles.refBadgeText}>Referred</Text></View> : null}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{shop.email || '—'}</Text>
        </View>
        <TouchableOpacity onPress={onMenu} hitSlop={8}><Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} /></TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Row label="Status">{(() => { const m = statusMeta(shop.subscription_status); return <StatusPill label={m.label} variant={m.variant} />; })()}</Row>
        <Row label="Verified">{shop.is_verified ? <View style={styles.vBadge} testID={`shop-verified-badge-${shop.id}`}><Ionicons name="checkmark-circle" size={13} color="#1d4ed8" /><Text style={styles.vBadgeText}>Verified</Text></View> : <Text style={styles.rowMuted}>Not verified</Text>}</Row>
        <Row label="Revenue"><Text style={styles.rowEmerald}>{money(shop.total_revenue)}</Text></Row>
        <Row label="Commission"><Text style={styles.rowVal}>{rate}% · {typeLabel}</Text></Row>
        <Row label="Subscription"><View style={[styles.subBadge, { backgroundColor: isSubscribed(shop) ? '#d1fae5' : '#f1f5f9' }]} testID={`shop-subscription-badge-${shop.id}`}><Ionicons name={isSubscribed(shop) ? 'checkmark-circle' : 'close-circle'} size={12} color={isSubscribed(shop) ? '#047857' : '#64748b'} /><Text style={[styles.subBadgeText, { color: isSubscribed(shop) ? '#047857' : '#64748b' }]}>{isSubscribed(shop) ? 'Subscribed' : 'Not Subscribed'}</Text></View></Row>
        <Row label="State"><Text style={styles.rowVal}>{shop.state || '—'}</Text></Row>
      </View>
      <View style={styles.cardFoot}>
        {!shop.is_verified && <TouchableOpacity style={styles.verifyBtn} onPress={onVerify} testID={`verify-shop-btn-${shop.id}`}><Ionicons name="checkmark-circle-outline" size={15} color="#2563eb" /><Text style={styles.verifyBtnText}>Verify Shop</Text></TouchableOpacity>}
        {shop.subscription_status === 'pending' && <TouchableOpacity style={styles.approveBtn} onPress={onApprove}><Ionicons name="checkmark" size={15} color={colors.white} /><Text style={styles.approveBtnText}>Approve</Text></TouchableOpacity>}
      </View>
    </View>
  );
}
function Row({ label, children }) { return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text>{children}</View>; }
function PremiumChip() { return <LinearGradient colors={[colors.p450, '#ffc0cb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premium}><Text style={styles.premiumText}>PREMIUM</Text></LinearGradient>; }

/* ================= Guest & Tier cards ================= */
function GuestCard({ app, onApprove, onEdit, onReject }) {
  const loggedIn = !!(app.is_logged_in_user || app.user_id);
  return (
    <View style={[styles.gCard, { borderColor: '#a7f3d0' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Logo uri={app.logo} size={44} radiusV={12} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.cardName} numberOfLines={1}>{app.shop_name}</Text>
            {loggedIn ? <View style={[styles.tinyBadge, { backgroundColor: colors.p100 }]} testID={`logged-in-badge-${app.id}`}><Ionicons name="person" size={9} color={colors.p800} /><Text style={[styles.tinyBadgeText, { color: colors.p800 }]}>Logged-in</Text></View> : null}
            {app.referred_by_agent_id ? <View style={[styles.tinyBadge, { backgroundColor: '#d1fae5' }]} testID={`referred-badge-${app.id}`}><Ionicons name="gift" size={9} color="#047857" /><Text style={[styles.tinyBadgeText, { color: '#047857' }]}>Referred</Text></View> : null}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{app.email}</Text>
        </View>
      </View>
      <View style={styles.gMeta}>
        <MetaRow icon="person-outline" text={app.guest_name || 'Guest'} />
        <MetaRow icon="call-outline" text={app.phone || '—'} />
        <MetaRow icon="location-outline" text={`${app.address || ''}${app.state ? `, ${app.state}` : ''}` || '—'} />
      </View>
      <View style={styles.gActions}>
        <TouchableOpacity style={styles.gApprove} onPress={onApprove} testID={`approve-guest-${app.id}`}><Ionicons name="checkmark" size={14} color={colors.white} /><Text style={styles.gApproveText}>Approve</Text></TouchableOpacity>
        <TouchableOpacity style={styles.gIconBtn} onPress={onEdit} testID={`edit-guest-${app.id}`}><Ionicons name="create-outline" size={16} color="#2563eb" /></TouchableOpacity>
        <TouchableOpacity style={styles.gIconBtn} onPress={onReject} testID={`reject-guest-${app.id}`}><Ionicons name="close" size={16} color={colors.sale} /></TouchableOpacity>
      </View>
    </View>
  );
}
function TierCard({ req, onApprove, onReject }) {
  return (
    <View style={[styles.gCard, { borderColor: '#fde68a' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><Text style={styles.cardName}>{req.shop_name}</Text><Text style={styles.cardEmail}>{req.requested_at ? new Date(req.requested_at).toLocaleDateString() : ''}</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={styles.tierFrom}><Text style={styles.tierFromText}>{req.from_tier}</Text></View>
          <Ionicons name="arrow-forward" size={13} color="#f59e0b" />
          <View style={styles.tierTo}><Text style={styles.tierToText}>{req.to_tier}</Text></View>
        </View>
      </View>
      <View style={styles.gActions}>
        <TouchableOpacity style={styles.gApprove} onPress={onApprove}><Ionicons name="checkmark" size={14} color={colors.white} /><Text style={styles.gApproveText}>Approve</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.gIconBtn, { flex: 1, flexDirection: 'row', gap: 5 }]} onPress={onReject}><Ionicons name="close" size={15} color={colors.sale} /><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.sale }}>Reject</Text></TouchableOpacity>
      </View>
    </View>
  );
}
function MetaRow({ icon, text }) { return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name={icon} size={12} color={colors.textMuted} /><Text style={styles.metaText} numberOfLines={1}>{text}</Text></View>; }

/* ================= Bottom-sheet picker ================= */
function Picker({ value, options, onChange, testID, icon }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const label = (options.find(([v]) => v === value) || options[0])?.[1] || 'All';
  const isDefault = value === 'all';
  return (
    <>
      <TouchableOpacity style={[styles.pickPill, !isDefault && styles.pickPillOn]} activeOpacity={0.8} onPress={() => setOpen(true)} testID={testID}>
        <Ionicons name={icon} size={13} color={isDefault ? colors.textMuted : colors.violet} />
        <Text style={[styles.pickPillText, !isDefault && { color: colors.violet }]} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} /></View>
        <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '70%' }]}>
          <View style={styles.grabber} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(([v, l]) => (
              <TouchableOpacity key={String(v)} style={styles.pickOpt} onPress={() => { onChange(v); setOpen(false); }}>
                <Text style={[styles.pickOptText, v === value && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>
                {v === value && <Ionicons name="checkmark" size={17} color={colors.violet} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/* ================= Shop actions menu ================= */
function ShopMenu({ shop, onClose, onView, onApprove, onVerify, onSuspend, onDelete }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  if (!shop) return null;
  const items = [
    { icon: 'eye-outline', label: 'View Details', fn: () => onView(shop) },
    ...(shop.subscription_status === 'pending' ? [{ icon: 'checkmark-circle-outline', label: 'Approve', color: '#059669', fn: () => onApprove(shop) }] : []),
    { icon: 'shield-checkmark-outline', label: shop.is_verified ? 'Remove Verification' : 'Verify Shop', color: '#2563eb', fn: () => onVerify(shop) },
    ...(shop.subscription_status !== 'suspended' ? [{ icon: 'close-circle-outline', label: 'Suspend', color: '#d97706', fn: () => onSuspend(shop) }] : []),
    { icon: 'trash-outline', label: 'Delete', color: colors.sale, fn: () => onDelete(shop) },
  ];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle} numberOfLines={1}>{shop.name}</Text>
        <View style={{ marginTop: 10 }}>
          {items.map((it) => (
            <TouchableOpacity key={it.label} style={styles.menuRow} onPress={() => { onClose(); it.fn(); }}>
              <Ionicons name={it.icon} size={19} color={it.color || colors.textSecondary} />
              <Text style={[styles.menuText, it.color && { color: it.color }]}>{it.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

/* ================= Shop detail (compact — full actions land in SM2) ================= */
function ShopDetailSheet({ shop, platformSettings, onClose, onApprove, onVerify, onSuspend, onDelete, onMap }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  if (!shop) return null;
  const meta = statusMeta(shop.subscription_status);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '86%' }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.dHead}>
            <Logo uri={shop.logo} size={60} radiusV={16} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.dName} numberOfLines={1}>{shop.name}</Text>{shop.is_verified && <Ionicons name="shield-checkmark" size={16} color={colors.seller} />}</View>
              <Text style={styles.dEmail}>{shop.email}</Text>
              <View style={{ marginTop: 4 }}><StatusPill label={meta.label} variant={meta.variant} /></View>
            </View>
          </View>
          <View style={styles.dStats}>
            <DStat label="Wallet" value={money(shop.wallet_balance)} />
            <DStat label="Revenue" value={money(shop.total_revenue)} />
            <DStat label="State" value={shop.state || '—'} />
          </View>
          <View style={{ marginTop: 6 }}>
            <DInfo label="Subscription" value={isSubscribed(shop) ? 'Subscribed' : 'Not subscribed'} />
            <DInfo label="Tier" value={shop.tier || 'starter'} />
            <DInfo label="Commission" value={`${shop.commission_percentage ?? platformSettings?.commission_percentage ?? 10}%`} />
            <DInfo label="Phone" value={shop.phone || '—'} />
          </View>
          <View style={{ gap: 10, marginTop: 16 }}>
            {shop.subscription_status !== 'active' && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => onApprove(shop)}>
                <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actBtn}><Ionicons name="checkmark-circle" size={18} color={colors.white} /><Text style={styles.actText}>Approve shop</Text></LinearGradient>
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.actOutline, { flex: 1 }]} onPress={() => onVerify(shop)}><Ionicons name="shield-checkmark-outline" size={16} color="#2563eb" /><Text style={[styles.actOutlineText, { color: '#2563eb' }]}>{shop.is_verified ? 'Unverify' : 'Verify'}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actOutline, { flex: 1 }]} onPress={onMap}><Ionicons name="map-outline" size={16} color={colors.s500} /><Text style={[styles.actOutlineText, { color: colors.s500 }]}>View on map</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {shop.subscription_status !== 'suspended' && <TouchableOpacity style={[styles.actOutline, { flex: 1, borderColor: '#fde68a' }]} onPress={() => onSuspend(shop)}><Ionicons name="ban-outline" size={16} color="#d97706" /><Text style={[styles.actOutlineText, { color: '#d97706' }]}>Suspend</Text></TouchableOpacity>}
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(shop)}><Ionicons name="trash-outline" size={16} color={colors.sale} /><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
            </View>
            <Text style={styles.sm2Note}>Full actions (edit shop, subscription, wallet, tier, products/orders/analytics) arrive in SM2.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
function DStat({ label, value }) { return <View style={styles.dStat}><Text style={styles.dStatVal} numberOfLines={1}>{value}</Text><Text style={styles.dStatLbl}>{label}</Text></View>; }
function DInfo({ label, value }) { return <View style={styles.dInfoRow}><Text style={styles.dInfoLbl}>{label}</Text><Text style={styles.dInfoVal}>{value}</Text></View>; }

/* ================= Guest edit sheet ================= */
function GuestEditSheet({ app, states, categories, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (app) setForm({ shop_name: app.shop_name || '', guest_name: app.guest_name || '', email: app.email || '', phone: app.phone || '', address: app.address || '', state: app.state || '', description: app.description || '', category_ids: app.category_ids || [] }); }, [app]);
  if (!app) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => { setBusy(true); try { await api.guestApplications.update(app.id, form); toast.success('Application updated'); onSaved(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to update'); } finally { setBusy(false); } };
  const stateOptions = [['', 'Select region'], ...(states || []).map((s) => [s.name || s, s.name || s])];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '88%' }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Edit Application</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Field label="Shop name"><TextInput style={styles.input} value={form.shop_name} onChangeText={(v) => set('shop_name', v)} testID="guest-edit-shop-name" /></Field>
          <Field label="Contact name"><TextInput style={styles.input} value={form.guest_name} onChangeText={(v) => set('guest_name', v)} testID="guest-edit-name" /></Field>
          <Field label="Email"><TextInput style={styles.input} value={form.email} onChangeText={(v) => set('email', v)} autoCapitalize="none" keyboardType="email-address" testID="guest-edit-email" /></Field>
          <Field label="Phone"><TextInput style={styles.input} value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" testID="guest-edit-phone" /></Field>
          <Field label="Address"><TextInput style={styles.input} value={form.address} onChangeText={(v) => set('address', v)} testID="guest-edit-address" /></Field>
          <Field label="Region"><InlinePicker value={form.state} options={stateOptions} onChange={(v) => set('state', v)} testID="guest-edit-state-select" /></Field>
          <Field label="Description"><TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} multiline value={form.description} onChangeText={(v) => set('description', v)} testID="guest-edit-description" /></Field>
          <Field label="Categories"><View style={styles.chips} testID="guest-edit-categories">
            {(categories || []).slice(0, 20).map((c) => { const on = (form.category_ids || []).includes(c.id); return (
              <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => set('category_ids', on ? form.category_ids.filter((x) => x !== c.id) : [...(form.category_ids || []), c.id])}>
                <Text style={[styles.chipText, on && { color: colors.white }]}>{c.name}</Text>
              </TouchableOpacity>); })}
          </View></Field>
          <TouchableOpacity activeOpacity={0.9} onPress={save} disabled={busy} testID="save-guest-edit" style={{ marginTop: 6 }}>
            <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Save changes</Text>}</LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ================= Guest approve sheet ================= */
function GuestApproveSheet({ app, agents, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const loggedIn = !!(app && (app.is_logged_in_user || app.user_id));
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!app) return;
    const detected = agents.find((a) => a.id === (app.referred_by_agent_id || ''));
    setForm({ password: '', commission_percentage: '10', commission_type: 'on_customer', subscription_required: false, subscription_fee: '19', months: '1', referred_by_agent_id: app.referred_by_agent_id || '', agent_commission_share_percent: detected ? String(detected.commission_share_percent ?? 30) : '30' });
  }, [app]); // eslint-disable-line
  if (!app) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!loggedIn && (!form.password || form.password.length < 6)) { toast.error('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      const payload = { commission_percentage: parseFloat(form.commission_percentage) || 10, commission_type: form.commission_type, subscription_required: form.subscription_required };
      if (form.referred_by_agent_id) { payload.referred_by_agent_id = form.referred_by_agent_id; if (form.agent_commission_share_percent !== '') payload.agent_commission_share_percent = parseFloat(form.agent_commission_share_percent); }
      if (!loggedIn) payload.password = form.password;
      if (form.subscription_required) { payload.subscription_fee = parseFloat(form.subscription_fee || 19) || 19; payload.months = parseInt(form.months || 1, 10) || 1; }
      const { data } = await api.guestApplications.approve(app.id, payload);
      notifySuccess(); toast.success(`Approved! Account ready for ${data.email || app.email}`); onDone();
    } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to approve'); }
    finally { setBusy(false); }
  };
  const agentOptions = [['', 'No agent'], ...agents.map((a) => [a.id, a.name || a.email || 'Agent'])];
  const typeOptions = [['on_customer', 'On Customer'], ['on_shop', 'On Shop'], ['half_half', 'Half / Half']];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '90%' }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Approve — {app.shop_name}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!loggedIn && <Field label="Password (min 6 chars)"><TextInput style={styles.input} secureTextEntry value={form.password} onChangeText={(v) => set('password', v)} placeholder="Set account password" placeholderTextColor={colors.textMuted} testID="guest-approve-password" /></Field>}
          <Field label="Commission %"><TextInput style={styles.input} keyboardType="numeric" value={String(form.commission_percentage)} onChangeText={(v) => set('commission_percentage', v)} testID="guest-approve-commission" /></Field>
          <Field label="Commission type"><InlinePicker value={form.commission_type} options={typeOptions} onChange={(v) => set('commission_type', v)} /></Field>
          <View testID="guest-approve-agent-section">
            <Field label="Referral agent"><InlinePicker value={form.referred_by_agent_id} options={agentOptions} onChange={(v) => set('referred_by_agent_id', v)} testID="guest-approve-agent-select" /></Field>
            {form.referred_by_agent_id ? <Field label="Agent commission share %"><TextInput style={styles.input} keyboardType="numeric" value={String(form.agent_commission_share_percent)} onChangeText={(v) => set('agent_commission_share_percent', v)} testID="guest-approve-agent-share" /></Field> : null}
          </View>
          <View style={styles.toggleRow} testID="guest-approve-sub-toggle">
            <View><Text style={styles.toggleLabel}>Require subscription</Text><Text style={styles.toggleHint}>Charge a monthly subscription fee</Text></View>
            <Switch value={form.subscription_required} onValueChange={(v) => set('subscription_required', v)} trackColor={{ true: colors.violet }} />
          </View>
          {form.subscription_required && (
            <View testID="guest-subscription-fields">
              <Field label="Subscription fee ($)"><TextInput style={styles.input} keyboardType="numeric" value={String(form.subscription_fee)} onChangeText={(v) => set('subscription_fee', v)} testID="guest-approve-sub-fee" /></Field>
              <Field label="Months"><TextInput style={styles.input} keyboardType="numeric" value={String(form.months)} onChangeText={(v) => set('months', v)} testID="guest-approve-months" /></Field>
              <Text style={styles.benefits} testID="guest-approve-subscription-benefits">The shop gains subscriber benefits for the selected duration.</Text>
            </View>
          )}
          <Text style={styles.benefits} testID="guest-approve-welcome-note">A welcome bonus is applied on approval per platform settings.</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} testID="confirm-guest-approve" style={{ marginTop: 6 }}>
            <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Approve application</Text>}</LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, children }) { return <View style={{ marginBottom: 12 }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function InlinePicker({ value, options, onChange, testID }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const label = (options.find(([v]) => v === value) || options[0])?.[1] || '';
  return (
    <>
      <TouchableOpacity style={styles.inlinePick} onPress={() => setOpen(true)} testID={testID}><Text style={styles.inlinePickText} numberOfLines={1}>{label}</Text><Ionicons name="chevron-down" size={15} color={colors.textMuted} /></TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} /></View>
        <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '70%' }]}>
          <View style={styles.grabber} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(([v, l]) => (
              <TouchableOpacity key={String(v)} style={styles.pickOpt} onPress={() => { onChange(v); setOpen(false); }}><Text style={[styles.pickOptText, v === value && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>{v === value && <Ionicons name="checkmark" size={17} color={colors.violet} />}</TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 10 },
  /* section tabs */
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  tabPill: { borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  tabPillIdle: { borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.violet },

  /* filters */
  filters: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginTop: 14, ...shadow.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 44, marginBottom: 10 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  pickPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, maxWidth: 170 },
  pickPillOn: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  pickPillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  filterFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  resultCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, flex: 1 },
  resultCountBold: { fontFamily: fonts.extrabold, color: colors.ink },
  gridToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 3 },
  gridBtn: { width: 30, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  gridBtnOn: { backgroundColor: colors.violet },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  clearText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },

  /* grid + cards */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  card3: { alignItems: 'center', padding: 12, gap: 8 },
  card3Name: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink, textAlign: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardHead: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  cardName: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink, flexShrink: 1 },
  cardEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  walletChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  walletChipText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  refBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.p100, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  refBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: colors.p800 },
  cardBody: { paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  rowVal: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  rowMuted: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  rowEmerald: { fontFamily: fonts.bold, fontSize: 13, color: '#059669' },
  vBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dbeafe', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  vBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#1d4ed8' },
  subBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  subBadgeText: { fontFamily: fonts.bold, fontSize: 10.5 },
  cardFoot: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: colors.surfaceMuted },
  verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: radius.md, paddingVertical: 9 },
  verifyBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#2563eb' },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#10b981', borderRadius: radius.md, paddingVertical: 9 },
  approveBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  card2Foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  miniApprove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#10b981', borderRadius: radius.sm, paddingVertical: 7, marginTop: 8 },
  miniApproveText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  premium: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  premiumText: { fontFamily: fonts.bold, fontSize: 8.5, color: colors.white, letterSpacing: 0.5 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10, marginTop: 12 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  /* guest / tier cards */
  gCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, padding: 14, marginBottom: 12, ...shadow.card },
  gMeta: { gap: 5, marginTop: 10 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, flex: 1 },
  tinyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  tinyBadgeText: { fontFamily: fonts.bold, fontSize: 8.5 },
  gActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  gApprove: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#10b981', borderRadius: radius.md, paddingVertical: 10 },
  gApproveText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  gIconBtn: { width: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  tierFrom: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierFromText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary, textTransform: 'capitalize' },
  tierTo: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierToText: { fontFamily: fonts.bold, fontSize: 10, color: '#b45309', textTransform: 'capitalize' },

  /* sheets */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  pickOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickOptText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },

  /* detail */
  dHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, flexShrink: 1 },
  dEmail: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  dStats: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: 12, marginTop: 16 },
  dStat: { flex: 1, alignItems: 'center' },
  dStatVal: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  dStatLbl: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  dInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dInfoLbl: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  dInfoVal: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textTransform: 'capitalize' },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md },
  actText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  actOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  actOutlineText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.violet },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.md, backgroundColor: colors.saleSoft },
  deleteText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.sale },
  sm2Note: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 },

  /* forms */
  fieldLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  inlinePick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  inlinePickText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  toggleLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  toggleHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  benefits: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  submit: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
