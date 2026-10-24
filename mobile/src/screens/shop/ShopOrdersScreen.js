import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Modal, ScrollView, Animated as RNAnimated, Easing, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn, SlideInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { useReveal } from '../../lib/useReveal';
import { SkeletonRows } from '../../components/ui';
import OrderDetailTabs from '../../components/OrderDetailTabs';

/* status colors — ported from getStatusColor + the filter buttons */
const STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#b45309', label: 'Pending' },
  processing: { bg: colors.s100, fg: colors.s700, label: 'Processing' },
  shipped: { bg: colors.s100, fg: '#0e7490', label: 'Shipped' },
  delivered: { bg: '#d1fae5', fg: '#047857', label: 'Delivered' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled' },
  paid: { bg: colors.p100, fg: colors.p800, label: 'Paid' },
};
const statusMeta = (s) => STATUS_META[s] || { bg: '#f1f5f9', fg: '#475569', label: s || 'unknown' };
/* the morph gradients from the batch brief */
const STATUS_GRADS = {
  delivered: ['#22c55e', '#10b981'],   // green-500 -> emerald-500 (done)
  processing: [colors.p450, '#ffc0cb'],  // violet-500 -> fuchsia-500 (active)
  paid: [colors.p450, '#ffc0cb'],
  shipped: ['#06b6d4', '#3b82f6'],
  pending: ['#f59e0b', '#f97316'],
  cancelled: ['#ef4444', '#f43f5e'],
};

/* ---------- dual-thumb price range slider (native stand-in for the web <Slider>) ---------- */
function RangeSlider({ min = 0, max = 2000, value, onChange, testID }) {
  const [width, setWidth] = useState(0);
  const range = Math.max(1, max - min);
  const toX = (v) => ((v - min) / range) * width;
  // refs so the pan handlers (created once) always see fresh values
  const stateRef = useRef({ value, min, max, width, onChange });
  stateRef.current = { value, min, max, width, onChange };

  const makeResponder = (thumb) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      stateRef.current.startValue = stateRef.current.value;
    },
    onPanResponderMove: (_, g) => {
      const { startValue, min: mn, max: mx, width: w, onChange: emit, value: cur } = stateRef.current;
      if (!w) return;
      const rg = Math.max(1, mx - mn);
      const [sLo, sHi] = startValue || cur;
      const startX = thumb === 'lo' ? ((sLo - mn) / rg) * w : ((sHi - mn) / rg) * w;
      const x = Math.min(Math.max(startX + g.dx, 0), w);
      const v = Math.round(mn + (x / w) * rg);
      const [lo, hi] = cur;
      if (thumb === 'lo') emit([Math.min(v, hi), hi]);
      else emit([lo, Math.max(v, lo)]);
    },
  });
  const loPan = useRef(null); const hiPan = useRef(null);
  if (!loPan.current) loPan.current = makeResponder('lo');
  if (!hiPan.current) hiPan.current = makeResponder('hi');

  const [lo, hi] = value;
  return (
    <View style={rs.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID={testID}>
      <View style={rs.track} />
      {width > 0 && (
        <>
          <View style={[rs.fill, { left: toX(lo), width: Math.max(0, toX(hi) - toX(lo)) }]} />
          <View {...loPan.current.panHandlers} style={[rs.thumb, { left: toX(lo) - 12 }]}><View style={rs.thumbInner} /></View>
          <View {...hiPan.current.panHandlers} style={[rs.thumb, { left: toX(hi) - 12 }]}><View style={rs.thumbInner} /></View>
        </>
      )}
    </View>
  );
}
const rs = StyleSheet.create({
  wrap: { height: 32, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border },
  fill: { position: 'absolute', height: 5, borderRadius: 3, backgroundColor: '#10b981' },
  thumb: { position: 'absolute', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  thumbInner: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, borderWidth: 2.5, borderColor: '#10b981', ...shadow.card },
});

/* emerald flash wrapper for freshly arrived orders */
function NewOrderFlash({ children }) {
  const a = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.sequence([
      RNAnimated.timing(a, { toValue: 1, duration: 350, useNativeDriver: false }),
      RNAnimated.delay(900),
      RNAnimated.timing(a, { toValue: 0, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, [a]);
  return (
    <RNAnimated.View style={{ borderRadius: radius.lg, backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['rgba(16,185,129,0)', 'rgba(16,185,129,0.18)'] }) }}>
      {children}
    </RNAnimated.View>
  );
}

/* ripple pulse for a card whose status just changed */
function useRipple() {
  const a = useRef(new RNAnimated.Value(0)).current;
  const trigger = () => {
    a.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      RNAnimated.timing(a, { toValue: 0, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  };
  const style = { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] };
  return [style, trigger];
}

function OrderCard({ order, availableDelivery, onView, isNew, justChanged }) {
  const m = statusMeta(order.order_status);
  const [rippleStyle, ripple] = useRipple();
  useEffect(() => { if (justChanged) { ripple(); } }, [justChanged]); // eslint-disable-line
  const card = (
    <RNAnimated.View style={[st.orderCard, rippleStyle]} testID={`order-row-${order.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={st.orderId}>#{order.id.slice(0, 8)}</Text>
        {order.cancel_request_status && (
          <View style={[st.cancelPill, {
            backgroundColor: order.cancel_request_status === 'pending' ? '#ffedd5' : order.cancel_request_status === 'approved' ? '#fee2e2' : '#f1f5f9',
          }]}>
            <Text style={[st.cancelPillText, {
              color: order.cancel_request_status === 'pending' ? '#c2410c' : order.cancel_request_status === 'approved' ? '#b91c1c' : '#475569',
            }]}>Cancel {order.cancel_request_status}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={st.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={st.customer} numberOfLines={1}>{order.guest_name || order.customer_name || order.user_id || 'Guest'}</Text>
          <Text style={st.itemsCount}>{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.revLabel}>MY REVENUE</Text>
          <Text style={st.revValue} testID={`order-shop-total-${order.id}`}>${((order.shop_total ?? order.total_amount) || 0).toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.revLabel}>ORDER TOTAL</Text>
          <Text style={[st.revValue, { color: colors.p500 }]}>${(order.total_amount || 0).toFixed(2)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 }}>
        {/* status badge — read-only (shops cannot change order status; only admin can) */}
        <LinearGradient colors={STATUS_GRADS[order.order_status] || ['#94a3b8', '#64748b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.statusPill} testID={`order-status-badge-${order.id}`}>
          <Text style={st.statusPillText}>{m.label}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => onView(order)} style={st.viewBtn} activeOpacity={0.8}>
          <Ionicons name="eye" size={14} color="#059669" />
          <Text style={st.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>
    </RNAnimated.View>
  );
  return isNew ? <NewOrderFlash>{card}</NewOrderFlash> : card;
}

export default function ShopOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [availableDelivery, setAvailableDelivery] = useState(true);
  const [newIds, setNewIds] = useState([]);
  const [changedId, setChangedId] = useState(null);
  const knownIds = useRef(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [maxPrice, setMaxPrice] = useState(2000);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const { data } = await api.shop.getOrders();
      // new orders (from the poll) slide in from the top with an emerald flash
      if (knownIds.current) {
        const fresh = data.filter(o => !knownIds.current.has(o.id)).map(o => o.id);
        if (fresh.length > 0) {
          setNewIds(fresh); notifySuccess();
          setTimeout(() => setNewIds([]), 4000);
        }
      }
      knownIds.current = new Set(data.map(o => o.id));
      setOrders(data);
      if (!silent && data.length > 0) {
        const max = Math.ceil(Math.max(...data.map(o => o.total_amount || 0)));
        setMaxPrice(max || 2000);
        setPriceRange([0, max || 2000]);
      }
    } catch (error) {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    api.admin.getPlatformSettings().then(({ data }) => {
      setAvailableDelivery(data?.available_delivery !== false);
    }).catch(() => {});
    const poll = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(poll);
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchOrders(true); setRefreshing(false); }, [fetchOrders]);

  /* filtering — ported verbatim */
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.guest_name || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.guest_email || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(o => o.order_status === statusFilter);
    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(o => {
        const d = new Date(o.created_at);
        if (timeFilter === 'last_day') return (now - d) < 86400000;
        if (timeFilter === 'last_week') return (now - d) < 604800000;
        if (timeFilter === 'last_month') return (now - d) < 2592000000;
        return true;
      });
    }
    filtered = filtered.filter(o => {
      const amount = o.total_amount || 0;
      return amount >= priceRange[0] && amount <= priceRange[1];
    });
    return filtered;
  }, [orders, searchQuery, statusFilter, timeFilter, priceRange]);

  const { visible: visibleOrders, hasMore: moreOrders, revealing: revealingOrders, revealMore: revealOrders } = useReveal(filteredOrders, 8);

  /* stats — ported */
  const myRevenue = orders.reduce((s, o) => s + ((o.shop_total ?? o.total_amount) || 0), 0);
  const delivered = orders.filter(o => o.order_status === 'delivered').length;
  const inProgress = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.order_status)).length;
  const statCards = [
    { label: 'TOTAL ORDERS', value: orders.length, icon: 'cart', grad: [colors.p450, '#ffc0cb'] },
    { label: 'MY REVENUE', value: myRevenue, icon: 'logo-usd', grad: ['#10b981', '#14b8a6'], money: true },
    { label: 'DELIVERED', value: delivered, icon: 'checkmark-circle', grad: ['#22c55e', '#10b981'] },
    { label: 'IN PROGRESS', value: inProgress, icon: 'time', grad: ['#f59e0b', '#f97316'] },
  ];

  const STATUS_FILTERS = [
    { value: 'all', label: 'All', bg: '#f1f5f9', fg: '#475569' },
    { value: 'pending', label: 'Pending', bg: '#fef3c7', fg: '#b45309' },
    { value: 'processing', label: 'Processing', bg: colors.s100, fg: colors.s700 },
    { value: 'shipped', label: 'Shipped', bg: colors.s100, fg: '#0e7490' },
    { value: 'delivered', label: 'Delivered', bg: '#dcfce7', fg: '#15803d' },
    { value: 'cancelled', label: 'Cancelled', bg: '#fee2e2', fg: '#b91c1c' },
  ];
  const TIME_FILTERS = [
    { v: 'all', l: 'All Time' }, { v: 'last_day', l: 'Last 24 Hours' }, { v: 'last_week', l: 'Last 7 Days' }, { v: 'last_month', l: 'Last 30 Days' },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg }}>
        <Spinner size={34} color="#059669" />
      </View>
    );
  }

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} onEndReached={() => moreOrders && revealOrders()}>
      <Rise duration={500} distance={0}>
        <Text style={st.title} testID="shop-orders-title">My Orders</Text>
      </Rise>

      {/* Stats summary cards */}
      <View style={st.statsRow}>
        {statCards.map((s, i) => (
          <Rise key={s.label} delay={i * 60} duration={350} distance={12} style={st.statWrap}>
            <View style={st.stat} testID={`shop-order-stat-${i}`}>
              <View style={[st.statOrb, { backgroundColor: s.grad[0] }]} />
              <LinearGradient colors={s.grad} style={st.statTile}><Ionicons name={s.icon} size={15} color={colors.white} /></LinearGradient>
              {s.money ? <CountUp value={s.value} prefix="$" style={st.statValue} /> : <CountUp value={s.value} style={st.statValue} />}
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          </Rise>
        ))}
      </View>

      {/* Advanced Filters */}
      <Rise delay={200}>
        <View style={st.filters} testID="shop-orders-filters">
          <View style={st.search}>
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery}
              placeholder="Search by order ID, customer name, email..."
              placeholderTextColor={colors.textMuted} style={st.searchInput} testID="shop-orders-search" />
          </View>

          {/* Status buttons with counts */}
          <Text style={st.filterLabel}>Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_FILTERS.map(s => {
              const count = orders.filter(o => (s.value === 'all' ? true : o.order_status === s.value)).length;
              const active = statusFilter === s.value;
              return (
                <TouchableOpacity key={s.value} onPress={() => setStatusFilter(s.value)}
                  style={[st.statusFilterBtn, { backgroundColor: s.bg, opacity: active ? 1 : 0.65 }, active && st.statusFilterActive]}
                  testID={`shop-status-btn-${s.value}`}>
                  <Text style={[st.statusFilterText, { color: s.fg }]}>{s.label}</Text>
                  <View style={st.statusCount}><Text style={[st.statusCountText, { color: s.fg }]}>{count}</Text></View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time filter */}
          <Text style={st.filterLabel}>Time Period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID="shop-orders-time-filter">
            {TIME_FILTERS.map(t => (
              <TouchableOpacity key={t.v} onPress={() => setTimeFilter(t.v)}
                style={[st.timeChip, timeFilter === t.v && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                <Text style={[st.timeChipText, timeFilter === t.v && { color: colors.white }]}>{t.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Price range slider */}
          <Text style={st.filterLabel}>
            Price Range: <Text style={{ color: colors.text, fontFamily: fonts.bold }}>${priceRange[0]} — ${priceRange[1]}</Text>
          </Text>
          <RangeSlider min={0} max={maxPrice} value={priceRange} onChange={setPriceRange} testID="shop-orders-price-range" />

          {/* Footer: count + clear */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={st.footText}>{filteredOrders.length} of {orders.length} orders</Text>
            {(searchQuery || statusFilter !== 'all' || timeFilter !== 'all') && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setPriceRange([0, maxPrice]); }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.p500 }}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Rise>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <View style={st.empty}>
          <Ionicons name="cart-outline" size={44} color={colors.border} />
          <Text style={st.emptyText}>{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          {visibleOrders.map(order => (
            <Animated.View key={order.id} layout={LinearTransition.springify().damping(18)}
              entering={newIds.includes(order.id) ? SlideInUp.duration(420) : FadeIn}>
              <OrderCard
                order={order}
                availableDelivery={availableDelivery}
                onView={setSelectedOrder}
                isNew={newIds.includes(order.id)}
                justChanged={changedId === order.id}
              />
            </Animated.View>
          ))}
          {revealingOrders && <SkeletonRows count={2} height={120} style={{ paddingHorizontal: 0 }} />}
        </View>
      )}
    </ShopScreenWrap>

    {/* Order detail — full page, Order Details tab only (no route/map for shops) */}
    <OrderDetailTabs
      visible={!!selectedOrder}
      order={selectedOrder}
      tabs={['details']}
      availableDelivery={availableDelivery}
      showShopRevenue
      onClose={() => setSelectedOrder(null)}
    />
    </>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, letterSpacing: -0.6, marginBottom: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  statOrb: { position: 'absolute', top: -14, right: -14, width: 56, height: 56, borderRadius: 28, opacity: 0.1 },
  statTile: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.textMuted, letterSpacing: 0.8, marginTop: 1 },
  filters: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 13, marginTop: 12, gap: 10, ...shadow.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  filterLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  statusFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusFilterActive: { borderWidth: 2, borderColor: '#34d399' },
  statusFilterText: { fontFamily: fonts.bold, fontSize: 10.5 },
  statusCount: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1 },
  statusCountText: { fontFamily: fonts.semibold, fontSize: 9 },
  timeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  timeChipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  footText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 46, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 10 },
  orderCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 13, ...shadow.card },
  orderId: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, letterSpacing: 0.3 },
  cancelPill: { borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2 },
  cancelPillText: { fontFamily: fonts.semibold, fontSize: 9 },
  orderDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  customer: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  itemsCount: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  revLabel: { fontFamily: fonts.bold, fontSize: 7.5, color: colors.textMuted, letterSpacing: 0.8 },
  revValue: { fontFamily: fonts.extrabold, fontSize: 14, color: '#059669', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, ...shadow.card },
  statusPillText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white, textTransform: 'capitalize' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  viewBtnText: { fontFamily: fonts.semibold, fontSize: 11, color: '#059669' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 14 },
  pickerSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, marginBottom: 14, ...shadow.dropdown },
  pickerTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  pickerSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 12 },
  pickerDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerOptionText: { fontFamily: fonts.bold, fontSize: 13 },
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  detailSheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: 18, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  detailTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  detailGrid: { flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  dKey: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  dVal: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginTop: 2 },
  dMono: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text, marginTop: 2 },
  dStatus: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  dStatusText: { fontFamily: fonts.bold, fontSize: 10.5, textTransform: 'capitalize' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, marginTop: 16, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 },
  itemImg: { width: 52, height: 52, borderRadius: 10 },
  itemName: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  vChip: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  vChipText: { fontFamily: fonts.medium, fontSize: 9 },
  itemQty: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  itemSub: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  shipBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  totals: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 12, gap: 7 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  totalVal: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  revBox: { backgroundColor: '#ecfdf5', borderRadius: radius.md, padding: 12, marginTop: 6 },
  revNote: { fontFamily: fonts.body, fontSize: 10.5, color: '#059669', marginTop: 2 },
  closeBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
});
