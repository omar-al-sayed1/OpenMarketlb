import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const STATUS = {
  active: { fg: '#047857', bg: '#d1fae5', dot: '#10b981' },
  expired: { fg: '#475569', bg: '#f1f5f9', dot: '#94a3b8' },
  cancelled: { fg: '#b91c1c', bg: '#fee2e2', dot: '#ef4444' },
  pending: { fg: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
};
const daysLeft = (end) => Math.max(0, Math.ceil((new Date(end) - new Date()) / 86400000));

function Dot({ color }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([
    Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
    Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
  ])).start(); }, []); // eslint-disable-line
  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

function RemainingBar({ days }) {
  const w = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, days / 30);
  useEffect(() => { Animated.timing(w, { toValue: pct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]); // eslint-disable-line
  const color = days <= 3 ? colors.red : days <= 7 ? colors.amber : colors.seller;
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export default function AdminPromotionsScreen() {
  const [promos, setPromos] = useState([]);
  const [stats, setStats] = useState({ total_revenue: 0, active_count: 0, total_count: 0 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminPromotions.getAll(filter === 'all' ? null : filter)
      .then(({ data }) => { setPromos(data.promotions || []); setStats({ total_revenue: data.total_revenue || 0, active_count: data.active_count || 0, total_count: data.total_count || 0 }); })
      .catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: 'all', label: 'All', count: stats.total_count },
    { key: 'active', label: 'Active', count: stats.active_count },
    { key: 'expired', label: 'Expired' },
    { key: 'cancelled', label: 'Cancelled' },
  ];
  const filtered = useMemo(() => promos.filter((p) => {
    if (!search) return true; const t = search.toLowerCase();
    return (p.product_name || '').toLowerCase().includes(t) || (p.shop_name || '').toLowerCase().includes(t);
  }), [promos, search]);

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={styles.title}>Product Promotions</Text>
      <Text style={styles.subtitle}>Manage all sponsored product promotions</Text>

      <View style={styles.statRow}>
        <StatCard icon="cash" bg="#d1fae5" fg="#059669" label="Total Revenue" value={<CountUp value={stats.total_revenue} prefix="$" decimals={2} style={styles.statVal} />} />
        <StatCard icon="trending-up" bg={colors.primarySoft} fg={colors.violet} label="Active" value={<CountUp value={stats.active_count} style={styles.statVal} />} />
        <StatCard icon="megaphone" bg="#dbeafe" fg="#2563eb" label="Total" value={<CountUp value={stats.total_count} style={styles.statVal} />} />
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <Text key={t.key} onPress={() => { setLoading(true); setFilter(t.key); }} style={[styles.tab, active && styles.tabActive]}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </Text>
          );
        })}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search products or shops…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>

      {loading ? [0, 1, 2].map((i) => <Shimmer key={i} height={78} radius={radius.lg} style={{ marginBottom: 10 }} />)
        : filtered.length === 0 ? (
          <View style={styles.empty}><Ionicons name="megaphone-outline" size={38} color={colors.textMuted} /><Text style={styles.emptyText}>No promotions found</Text></View>
        ) : filtered.map((p) => {
          const cfg = STATUS[p.status] || STATUS.pending;
          const rem = p.status === 'active' ? daysLeft(p.end_date) : null;
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.prodName} numberOfLines={1}>{p.product_name}</Text>
                  <Text style={styles.shopName} numberOfLines={1}>{p.shop_name}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Dot color={cfg.dot} />
                  <Text style={[styles.statusText, { color: cfg.fg }]}>{p.status}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Meta icon="calendar-outline" text={`${p.duration_days}d`} />
                <Meta icon="pricetag-outline" text={p.total_cost === 0 ? 'Free' : `$${(p.total_cost || 0).toFixed(2)}`} accent={p.total_cost === 0} />
                <Meta icon="eye-outline" text={`${p.views || 0}`} />
                <Meta icon="cart-outline" text={`${p.orders || 0}`} />
                {rem !== null ? <Text style={[styles.remText, { color: rem <= 3 ? colors.red : rem <= 7 ? colors.amber : colors.textSecondary }]}>{rem}d left</Text> : null}
              </View>
              {rem !== null ? <RemainingBar days={rem} /> : null}
            </View>
          );
        })}
    </AdminScreen>
  );
}

const StatCard = ({ icon, bg, fg, label, value }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={16} color={fg} /></View>
    {value}
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);
const Meta = ({ icon, text, accent }) => (
  <View style={styles.meta}><Ionicons name={icon} size={13} color={accent ? colors.seller : colors.textMuted} /><Text style={[styles.metaText, accent && { color: colors.seller, fontFamily: fonts.bold }]}>{text}</Text></View>
);

const styles = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, ...shadow.card },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: 4, marginBottom: 10 },
  tab: { flex: 1, textAlign: 'center', paddingVertical: 7, borderRadius: radius.sm || 8, fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, overflow: 'hidden' },
  tabActive: { backgroundColor: colors.surface, color: colors.ink, ...shadow.card },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12, height: 42, marginBottom: 12 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 10, ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prodName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  shopName: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  remText: { marginLeft: 'auto', fontFamily: fonts.bold, fontSize: 12 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.bgAlt, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
});
