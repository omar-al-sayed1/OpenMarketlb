import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Animated as RNAnimated, Switch } from 'react-native';
import { Alert } from '../../components/AppDialog';
import Reanimated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { AdminScreen, StatusPill, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { useReveal } from '../../lib/useReveal';
import BottomSheet from '../../components/BottomSheet';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const ROLES = ['all', 'user', 'shop', 'agent', 'employee', 'admin'];
const ROLE_PILL = { user: 'slate', shop: 'violet', agent: 'emerald', employee: 'blue', admin: 'red', delivery: 'amber' };
const AV = [[colors.p450, colors.s600], ['#10b981', '#14b8a6'], ['#f59e0b', '#f97316'], ['#ec4899', '#f43f5e'], ['#3b82f6', colors.s500], ['#06b6d4', '#3b82f6']];
const TIER_META = { Bronze: { bg: '#fef3c7', fg: '#b45309' }, Silver: { bg: '#e2e8f0', fg: '#475569' }, Gold: { bg: '#fef9c3', fg: '#ca8a04' }, Platinum: { bg: colors.p100, fg: colors.p800 }, Diamond: { bg: colors.s100, fg: '#0e7490' } };
const tierMeta = (t) => TIER_META[t] || { bg: '#f1f5f9', fg: '#475569' };
const tierOf = (u) => u.loyalty_tier || 'Bronze';

const STATUS_OPTS = [['all', 'All Status'], ['online', 'Online'], ['offline', 'Offline']];
const PHONE_OPTS = [['all', 'All Phones'], ['verified', 'Verified'], ['unverified', 'Unverified']];
const MSG_OPTS = [['all', 'All Messaging'], ['blocked', 'Blocked'], ['allowed', 'Allowed']];
const SORTS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['name_asc', 'A → Z'], ['name_desc', 'Z → A']];

export default function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);

  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState('all');
  const [messagingFilter, setMessagingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const panelAnim = useRef(new RNAnimated.Value(0)).current;

  const load = useCallback(() => {
    api.admin.getUsers().then(({ data }) => setUsers(Array.isArray(data) ? data : data?.users || [])).catch(() => setUsers([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { RNAnimated.timing(panelAnim, { toValue: showFilters ? 1 : 0, duration: 240, useNativeDriver: false }).start(); }, [showFilters, panelAnim]);

  const stateOpts = useMemo(() => [['all', 'All Regions'], ...Array.from(new Set(users.map((u) => u.state).filter(Boolean))).sort().map((s) => [s, s])], [users]);
  const tierOpts = useMemo(() => {
    const set = new Set(users.map((u) => u.loyalty_tier).filter(Boolean));
    ['Bronze', 'Silver', 'Gold'].forEach((t) => set.add(t));
    return [['all', 'All Tiers'], ...Array.from(set).map((t) => [t, t])];
  }, [users]);

  const list = useMemo(() => {
    let f = users;
    if (role !== 'all') f = f.filter((u) => (u.role || 'user') === role);
    if (statusFilter === 'online') f = f.filter((u) => u.is_online);
    else if (statusFilter === 'offline') f = f.filter((u) => !u.is_online);
    if (stateFilter !== 'all') f = f.filter((u) => (u.state || '') === stateFilter);
    if (tierFilter !== 'all') f = f.filter((u) => tierOf(u) === tierFilter);
    if (messagingFilter === 'blocked') f = f.filter((u) => u.messaging_blocked);
    else if (messagingFilter === 'allowed') f = f.filter((u) => !u.messaging_blocked);
    if (phoneFilter === 'verified') f = f.filter((u) => u.phone_verified);
    else if (phoneFilter === 'unverified') f = f.filter((u) => !u.phone_verified);
    if (q) { const query = q.toLowerCase(); f = f.filter((u) => (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query) || (u.phone || '').toLowerCase().includes(query) || (u.city || '').toLowerCase().includes(query)); }
    f = [...f];
    if (sortBy === 'newest') f.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    else if (sortBy === 'oldest') f.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    else if (sortBy === 'name_asc') f.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'name_desc') f.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    return f;
  }, [users, role, statusFilter, stateFilter, tierFilter, messagingFilter, phoneFilter, q, sortBy]);

  const { visible: visibleUsers, hasMore: moreUsers, revealing: revealingUsers, revealMore: revealUsers } = useReveal(list, 12);

  const stats = useMemo(() => ({
    total: users.length,
    online: users.filter((u) => u.is_online).length,
    verified: users.filter((u) => u.phone_verified).length,
    blocked: users.filter((u) => u.messaging_blocked).length,
  }), [users]);

  const activeFilters = [statusFilter, stateFilter, tierFilter, phoneFilter, messagingFilter].filter((v) => v !== 'all').length;
  const clearFilters = () => { setStatusFilter('all'); setStateFilter('all'); setTierFilter('all'); setPhoneFilter('all'); setMessagingFilter('all'); setSortBy('newest'); setRole('all'); };

  if (loading) return <AdminScreen>{[0, 1, 2, 3, 4].map((i) => <Shimmer key={i} height={78} radius={radius.lg} style={{ marginBottom: 10 }} />)}</AdminScreen>;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onEndReached={() => moreUsers && revealUsers()}>
      {/* ===== Gradient hero with live stats ===== */}
      <LinearGradient colors={[colors.p500, colors.s600, '#f06a92']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroBlob} />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><Ionicons name="people" size={22} color={colors.white} /></View>
          <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Users</Text><Text style={styles.heroSub}>Community directory & access control</Text></View>
        </View>
        <View style={styles.heroStats}>
          <HeroStat icon="people" label="Total" value={stats.total} />
          <HeroStat icon="ellipse" label="Online" value={stats.online} dot />
          <HeroStat icon="checkmark-circle" label="Verified" value={stats.verified} />
          <HeroStat icon="ban" label="Blocked" value={stats.blocked} />
        </View>
      </LinearGradient>

      {/* ===== Search ===== */}
      <View style={styles.search}><Ionicons name="search" size={17} color={colors.textMuted} /><TextInput style={styles.searchInput} placeholder="Search name, email, phone, city…" placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />{q ? <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={17} color={colors.textMuted} /></TouchableOpacity> : null}</View>

      {/* ===== Role chips + Filters toggle ===== */}
      <View style={styles.roleBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flex: 1 }}>
          {ROLES.map((r) => <TouchableOpacity key={r} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipOn]}><Text style={[styles.chipText, role === r && { color: colors.white }]}>{r === 'all' ? 'All' : r}</Text></TouchableOpacity>)}
        </ScrollView>
        <TouchableOpacity onPress={() => setShowFilters((v) => !v)} style={[styles.filterBtn, (activeFilters > 0 || showFilters) && styles.filterBtnOn]}>
          <Ionicons name="options" size={16} color={activeFilters > 0 || showFilters ? colors.white : colors.violet} />
          {activeFilters > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilters}</Text></View>}
        </TouchableOpacity>
      </View>

      {/* ===== Filter panel ===== */}
      <RNAnimated.View style={{ opacity: panelAnim, maxHeight: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }), overflow: 'hidden' }}>
        <View style={styles.filterPanel}>
          <View style={styles.pickGrid}>
            <Picker label="Status" icon="pulse-outline" value={statusFilter} options={STATUS_OPTS} onChange={setStatusFilter} />
            <Picker label="Region" icon="location-outline" value={stateFilter} options={stateOpts} onChange={setStateFilter} />
            <Picker label="Tier" icon="ribbon-outline" value={tierFilter} options={tierOpts} onChange={setTierFilter} />
            <Picker label="Phone" icon="call-outline" value={phoneFilter} options={PHONE_OPTS} onChange={setPhoneFilter} />
            <Picker label="Messaging" icon="chatbubble-outline" value={messagingFilter} options={MSG_OPTS} onChange={setMessagingFilter} />
          </View>
          <Text style={styles.sortLabel}>SORT BY</Text>
          <View style={styles.sortRow}>
            {SORTS.map(([v, l]) => <TouchableOpacity key={v} onPress={() => setSortBy(v)} style={[styles.sortChip, sortBy === v && styles.sortChipOn]}><Text style={[styles.sortChipText, sortBy === v && { color: colors.white }]}>{l}</Text></TouchableOpacity>)}
          </View>
          {(activeFilters > 0 || sortBy !== 'newest' || role !== 'all') && <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}><Ionicons name="close" size={13} color={colors.sale} /><Text style={styles.clearText}>Clear all filters</Text></TouchableOpacity>}
        </View>
      </RNAnimated.View>

      <Text style={styles.resultCount}>{list.length} of {users.length} users</Text>

      {/* ===== User cards ===== */}
      {visibleUsers.map((u, i) => <UserCard key={u.id} user={u} index={i} grad={AV[i % AV.length]} onPress={() => setDetail(u)} />)}
      {revealingUsers && [0, 1, 2].map((i) => <Shimmer key={`sk${i}`} height={78} radius={radius.lg} style={{ marginTop: 10 }} />)}
      {list.length === 0 && <View style={styles.empty}><Ionicons name="people-outline" size={40} color={colors.border} /><Text style={styles.emptyText}>No users match your filters</Text></View>}

      <UserDetail user={detail} onClose={() => setDetail(null)} onDone={load} />
    </AdminScreen>
  );
}

function HeroStat({ icon, label, value, dot }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatTop}>{dot ? <View style={styles.onlineDot} /> : <Ionicons name={icon} size={12} color="rgba(255,255,255,0.85)" />}<CountUp value={value} style={styles.heroStatValue} /></View>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

/* ---------- modern user card ---------- */
function UserCard({ user, index, grad, onPress }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tier = tierOf(user);
  const tm = tierMeta(tier);
  return (
    <Reanimated.View entering={FadeInDown.delay(Math.min(index, 12) * 40)} layout={undefined}>
      <Reanimated.View style={aStyle}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={() => { scale.value = withSpring(0.97); }} onPressOut={() => { scale.value = withSpring(1); }} style={styles.card}>
          <View>
            <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}><Text style={styles.avatarText}>{(user.name || 'U').charAt(0).toUpperCase()}</Text></LinearGradient>
            {user.is_online ? <View style={styles.onlineBadge} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.name} numberOfLines={1}>{user.name || 'User'}</Text>
              {user.phone_verified ? <Ionicons name="checkmark-circle" size={13} color="#2563eb" /> : null}
            </View>
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            <View style={styles.chipRow}>
              <StatusPill label={user.role || 'user'} variant={ROLE_PILL[user.role] || 'slate'} />
              <View style={[styles.tierChip, { backgroundColor: tm.bg }]}><Ionicons name="ribbon" size={9} color={tm.fg} /><Text style={[styles.tierText, { color: tm.fg }]}>{tier}</Text></View>
              {user.messaging_blocked ? <View style={styles.blockChip}><Ionicons name="ban" size={9} color="#b91c1c" /><Text style={styles.blockText}>Blocked</Text></View> : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {user.state ? <View style={styles.stateChip}><Ionicons name="location" size={10} color={colors.textMuted} /><Text style={styles.stateText} numberOfLines={1}>{user.state}</Text></View> : null}
            <Text style={styles.joined}>{user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}</Text>
            {user.is_banned ? <StatusPill label="banned" variant="red" /> : null}
          </View>
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

/* ---------- bottom-sheet picker ---------- */
function Picker({ label, icon, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const current = (options.find(([v]) => v === value) || options[0])?.[1] || 'All';
  const isDefault = value === 'all';
  return (
    <>
      <TouchableOpacity style={[styles.pick, !isDefault && styles.pickOn]} onPress={() => setOpen(true)}>
        <Ionicons name={icon} size={13} color={isDefault ? colors.textMuted : colors.violet} />
        <View style={{ flex: 1 }}><Text style={styles.pickLabel}>{label}</Text><Text style={[styles.pickValue, !isDefault && { color: colors.violet }]} numberOfLines={1}>{current}</Text></View>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="70%">
        <Text style={styles.sheetTitle}>{label}</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
          {options.map(([v, l]) => (
            <TouchableOpacity key={String(v)} style={styles.opt} onPress={() => { onChange(v); setOpen(false); }}>
              <Text style={[styles.optText, v === value && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>
              {v === value && <Ionicons name="checkmark" size={17} color={colors.violet} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

/* ---------- user detail sheet ---------- */
function UserDetail({ user, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [points, setPoints] = useState(0);
  const [orders, setOrders] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const shake = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (user) { setPoints(user.points ?? user.points_balance ?? 0); setBlocked(!!user.messaging_blocked); api.admin.getUserOrders(user.id).then(({ data }) => setOrders((Array.isArray(data) ? data : data?.orders || []).slice(0, 5))).catch(() => setOrders([])); }
  }, [user]);
  if (!user) return null;
  const tier = tierOf(user); const tm = tierMeta(tier);

  const adjust = (d) => setPoints((p) => Math.max(0, p + d));
  const savePoints = async () => { try { await api.admin.updateUserPoints(user.id, { points }); notifySuccess(); } catch (_) { notifyError(); } };
  const toggleBlock = async (v) => { setBlocked(v); try { await api.admin.updateUser(user.id, { messaging_blocked: v }); notifySuccess(); } catch (_) { setBlocked(!v); notifyError(); } };
  const ban = () => {
    RNAnimated.sequence([RNAnimated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }), RNAnimated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }), RNAnimated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true })]).start();
    Alert.alert(user.is_banned ? 'Unban user' : 'Ban user', user.name, [{ text: 'Cancel' }, { text: user.is_banned ? 'Unban' : 'Ban', style: 'destructive', onPress: async () => { setBusy(true); try { await api.admin.updateUser(user.id, { is_banned: !user.is_banned }); notifySuccess(); onClose(); onDone(); } catch (_) {} finally { setBusy(false); } } }]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <RNAnimated.View style={[styles.detailSheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, transform: [{ translateX: shake }] }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.dHead}>
            <View>
              <LinearGradient colors={[colors.p450, colors.s600]} style={styles.dAvatar}><Text style={styles.dAvatarText}>{(user.name || 'U').charAt(0).toUpperCase()}</Text></LinearGradient>
              {user.is_online ? <View style={styles.dOnline} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.dName}>{user.name}</Text>{user.phone_verified ? <Ionicons name="checkmark-circle" size={16} color="#2563eb" /> : null}</View>
              <Text style={styles.dEmail}>{user.email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                <StatusPill label={user.is_online ? 'online' : 'offline'} variant={user.is_online ? 'emerald' : 'slate'} />
                <View style={[styles.tierChip, { backgroundColor: tm.bg }]}><Ionicons name="ribbon" size={9} color={tm.fg} /><Text style={[styles.tierText, { color: tm.fg }]}>{tier}</Text></View>
              </View>
            </View>
          </View>
          <View style={styles.dStats}><Stat label="Role" value={user.role || 'user'} /><Stat label="Wallet" value={money(user.wallet_balance)} /><Stat label="Region" value={user.state || '—'} /></View>

          <Text style={styles.secTitle}>Loyalty points</Text>
          <View style={styles.pointsRow}>
            <TouchableOpacity style={styles.pBtn} onPress={() => adjust(-10)}><Ionicons name="remove" size={20} color={colors.sale} /></TouchableOpacity>
            <Text style={styles.pointsVal}>{points}</Text>
            <TouchableOpacity style={styles.pBtn} onPress={() => adjust(10)}><Ionicons name="add" size={20} color={colors.seller} /></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={savePoints}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
          </View>

          <View style={styles.blockRow}>
            <View style={{ flex: 1 }}><Text style={styles.blockRowTitle}>Block messaging</Text><Text style={styles.blockRowHint}>Prevent this user from sending messages</Text></View>
            <Switch value={blocked} onValueChange={toggleBlock} trackColor={{ true: colors.sale, false: colors.border }} thumbColor={colors.white} />
          </View>

          {orders.length > 0 && <>
            <Text style={styles.secTitle}>Recent orders</Text>
            {orders.map((o) => <View key={o.id} style={styles.orderRow}><Text style={styles.orderId}>#{String(o.id).slice(0, 8).toUpperCase()}</Text><Text style={styles.orderTotal}>{money(o.total_amount || o.total)}</Text></View>)}
          </>}

          <TouchableOpacity style={[styles.banBtn, user.is_banned && styles.unbanBtn]} onPress={ban} disabled={busy}>
            <Ionicons name={user.is_banned ? 'checkmark-circle' : 'ban'} size={17} color={user.is_banned ? colors.seller : colors.sale} />
            <Text style={[styles.banText, user.is_banned && { color: colors.seller }]}>{user.is_banned ? 'Unban user' : 'Ban user'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </RNAnimated.View>
    </Modal>
  );
}
const Stat = ({ label, value }) => <View style={styles.stat}><Text style={styles.statVal} numberOfLines={1}>{value}</Text><Text style={styles.statLbl}>{label}</Text></View>;

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 18, overflow: 'hidden', marginBottom: 14, ...shadow.violetGlow },
  heroBlob: { position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: 74, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: 10 },
  heroStatTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  heroStatValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, fontSize: 9.5, marginTop: 2 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  roleBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  filterBtn: { width: 44, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  filterBtnOn: { backgroundColor: colors.violet },
  filterCount: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.sale, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9 },

  filterPanel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginTop: 10, ...shadow.card },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9 },
  pickOn: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  pickLabel: { fontFamily: fonts.bold, fontSize: 8.5, color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  pickValue: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginTop: 1 },
  sortLabel: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.6, marginTop: 12, marginBottom: 6 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  sortChipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  sortChipText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 12 },
  clearText: { fontFamily: fonts.bold, fontSize: 12, color: colors.sale },
  resultCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 12, marginBottom: 6 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 10, ...shadow.card },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: colors.surface },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  email: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  tierText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize' },
  blockChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fee2e2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  blockText: { fontFamily: fonts.bold, fontSize: 9, color: '#b91c1c' },
  stateChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, maxWidth: 110 },
  stateText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary },
  joined: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  detailSheet: { maxHeight: '86%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  dHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dAvatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  dAvatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24 },
  dOnline: { position: 'absolute', bottom: 1, right: 1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#22c55e', borderWidth: 3, borderColor: colors.surface },
  dName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  dEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  dStats: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: 12, marginTop: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink, textTransform: 'capitalize' },
  statLbl: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  secTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: 18, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pointsVal: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, minWidth: 60, textAlign: 'center' },
  saveBtn: { marginLeft: 'auto', backgroundColor: colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginTop: 16 },
  blockRowTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  blockRowHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  orderId: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  orderTotal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  banBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, backgroundColor: colors.saleSoft, marginTop: 20 },
  unbanBtn: { backgroundColor: colors.sellerSoft },
  banText: { fontFamily: fonts.bold, fontSize: 14, color: colors.sale },
});
