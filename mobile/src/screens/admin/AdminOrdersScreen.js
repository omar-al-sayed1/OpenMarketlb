import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Modal, ScrollView, Animated as RNAnimated, Easing, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn, SlideInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { useReveal } from '../../lib/useReveal';
import { SkeletonRows } from '../../components/ui';
import OrderDetailTabs from '../../components/OrderDetailTabs';
import { Alert } from '../../components/AppDialog';

const STATUS_META = {
  pending: { bg: '#fef3c7', fg: '#b45309', label: 'Pending' },
  processing: { bg: colors.s100, fg: colors.s700, label: 'Processing' },
  confirmed: { bg: colors.s100, fg: colors.s700, label: 'Confirmed' },
  shipped: { bg: colors.s100, fg: '#0e7490', label: 'Shipped' },
  delivered: { bg: '#d1fae5', fg: '#047857', label: 'Delivered' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled' },
  paid: { bg: colors.p100, fg: colors.p800, label: 'Paid' },
};
const statusMeta = (s) => STATUS_META[s] || { bg: '#f1f5f9', fg: '#475569', label: s || 'unknown' };
const STATUS_GRADS = {
  delivered: ['#22c55e', '#10b981'], processing: [colors.p450, '#ffc0cb'], confirmed: [colors.p450, '#ffc0cb'],
  paid: [colors.p450, '#ffc0cb'], shipped: ['#06b6d4', '#3b82f6'], pending: ['#f59e0b', '#f97316'], cancelled: ['#ef4444', '#f43f5e'],
};
const statusOf = (o) => (o.order_status || o.status || 'pending').toLowerCase();

/* dual-thumb price range slider */
function RangeSlider({ min = 0, max = 2000, value, onChange, testID }) {
  const [width, setWidth] = useState(0);
  const range = Math.max(1, max - min);
  const toX = (v) => ((v - min) / range) * width;
  const stateRef = useRef({ value, min, max, width, onChange });
  stateRef.current = { value, min, max, width, onChange };
  const makeResponder = (thumb) => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { stateRef.current.startValue = stateRef.current.value; },
    onPanResponderMove: (_, g) => {
      const { startValue, min: mn, max: mx, width: w, onChange: emit, value: cur } = stateRef.current;
      if (!w) return;
      const rg = Math.max(1, mx - mn); const [sLo, sHi] = startValue || cur;
      const startX = thumb === 'lo' ? ((sLo - mn) / rg) * w : ((sHi - mn) / rg) * w;
      const x = Math.min(Math.max(startX + g.dx, 0), w); const v = Math.round(mn + (x / w) * rg);
      const [lo, hi] = cur;
      if (thumb === 'lo') emit([Math.min(v, hi), hi]); else emit([lo, Math.max(v, lo)]);
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

function NewOrderFlash({ children }) {
  const a = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.sequence([
      RNAnimated.timing(a, { toValue: 1, duration: 350, useNativeDriver: false }),
      RNAnimated.delay(900),
      RNAnimated.timing(a, { toValue: 0, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, [a]);
  return <RNAnimated.View style={{ borderRadius: radius.lg, backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['rgba(16,185,129,0)', 'rgba(16,185,129,0.18)'] }) }}>{children}</RNAnimated.View>;
}
function useRipple() {
  const a = useRef(new RNAnimated.Value(0)).current;
  const trigger = () => { a.setValue(0); RNAnimated.sequence([RNAnimated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }), RNAnimated.timing(a, { toValue: 0, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true })]).start(); };
  return [{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }, trigger];
}

function OrderCard({ order, onView, onRoute, onPickStatus, isNew, justChanged }) {
  const m = statusMeta(statusOf(order));
  const [rippleStyle, ripple] = useRipple();
  useEffect(() => { if (justChanged) ripple(); }, [justChanged]); // eslint-disable-line
  const card = (
    <RNAnimated.View style={[st.orderCard, rippleStyle]} testID={`order-row-${order.id}`}>
     <TouchableOpacity activeOpacity={0.85} onPress={() => onView(order)} testID={`order-open-${order.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={st.orderId}>#{String(order.id).slice(0, 8)}</Text>
        {order.cancel_request_status && (
          <View style={[st.cancelPill, { backgroundColor: order.cancel_request_status === 'pending' ? '#ffedd5' : order.cancel_request_status === 'approved' ? '#fee2e2' : '#f1f5f9' }]}>
            <Text style={[st.cancelPillText, { color: order.cancel_request_status === 'pending' ? '#c2410c' : order.cancel_request_status === 'approved' ? '#b91c1c' : '#475569' }]}>Cancel {order.cancel_request_status}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={st.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={st.customer} numberOfLines={1}>{order.guest_name || order.customer_name || 'Guest'}</Text>
          <Text style={st.itemsCount} numberOfLines={1}>{order.shop_name || 'Shop'} · {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.revLabel}>COMMISSION</Text>
          <Text style={st.revValue}>${((order.commission_amount ?? 0) || 0).toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.revLabel}>ORDER TOTAL</Text>
          <Text style={[st.revValue, { color: colors.p500 }]}>${(order.total_amount || 0).toFixed(2)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 }}>
        <TouchableOpacity onPress={() => onPickStatus(order)} activeOpacity={0.8} testID={`order-status-select-${order.id}`}>
          <LinearGradient colors={STATUS_GRADS[statusOf(order)] || ['#94a3b8', '#64748b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.statusPill}>
            <Text style={st.statusPillText}>{m.label}</Text><Ionicons name="chevron-down" size={11} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => onView(order)} style={st.viewBtn} activeOpacity={0.8}><Text style={st.viewBtnText}>View details</Text><Ionicons name="chevron-forward" size={14} color="#059669" /></TouchableOpacity>
      </View>
     </TouchableOpacity>
    </RNAnimated.View>
  );
  return isNew ? <NewOrderFlash>{card}</NewOrderFlash> : card;
}

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabOrder, setTabOrder] = useState(null); // order shown in the tabbed detail page
  const [availableDelivery, setAvailableDelivery] = useState(true);
  const [statusPickerFor, setStatusPickerFor] = useState(null);
  const [newIds, setNewIds] = useState([]);
  const [changedId, setChangedId] = useState(null);
  const knownIds = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [destStateFilter, setDestStateFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [maxPrice, setMaxPrice] = useState(2000);

  const destStateOf = (o) => o.shipping_address?.state || o.destination_state || o.state || '';
  const customerOf = (o) => o.guest_name || o.customer_name || '';

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const { data } = await api.orders.getAll();
      const arr = Array.isArray(data) ? data : data?.orders || [];
      if (knownIds.current) {
        const fresh = arr.filter((o) => !knownIds.current.has(o.id)).map((o) => o.id);
        if (fresh.length > 0) { setNewIds(fresh); notifySuccess(); setTimeout(() => setNewIds([]), 4000); }
      }
      knownIds.current = new Set(arr.map((o) => o.id));
      setOrders(arr);
      if (!silent && arr.length > 0) { const max = Math.ceil(Math.max(...arr.map((o) => o.total_amount || 0))); setMaxPrice(max || 2000); setPriceRange([0, max || 2000]); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    api.admin.getPlatformSettings().then(({ data }) => setAvailableDelivery(data?.available_delivery !== false)).catch(() => {});
    const poll = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(poll);
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchOrders(true); setRefreshing(false); }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    let f = [...orders];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter((o) => String(o.id).toLowerCase().includes(q) || (o.guest_name || '').toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q) || (o.shop_name || '').toLowerCase().includes(q) || (o.guest_email || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') f = f.filter((o) => statusOf(o) === statusFilter);
    if (destStateFilter !== 'all') f = f.filter((o) => destStateOf(o) === destStateFilter);
    if (customerFilter !== 'all') f = f.filter((o) => customerOf(o) === customerFilter);
    if (timeFilter !== 'all') {
      const now = new Date();
      f = f.filter((o) => { const d = new Date(o.created_at); if (timeFilter === 'last_day') return now - d < 86400000; if (timeFilter === 'last_week') return now - d < 604800000; if (timeFilter === 'last_month') return now - d < 2592000000; return true; });
    }
    f = f.filter((o) => { const a = o.total_amount || 0; return a >= priceRange[0] && a <= priceRange[1]; });
    return f;
  }, [orders, searchQuery, statusFilter, destStateFilter, customerFilter, timeFilter, priceRange]);

  const { visible: visibleOrders, hasMore: moreOrders, revealing: revealingOrders, revealMore: revealOrders } = useReveal(filteredOrders, 8);

  const destStateOptions = useMemo(() => ['all', ...Array.from(new Set(orders.map(destStateOf).filter(Boolean))).sort()], [orders]);
  const customerOptions = useMemo(() => ['all', ...Array.from(new Set(orders.map(customerOf).filter(Boolean))).sort()], [orders]);

  const executeStatusChange = async (orderId, newStatus) => {
    try {
      await api.orders.updateStatus(orderId, newStatus);
      toast.success('Order status updated');
      setChangedId(orderId); setTimeout(() => setChangedId(null), 900);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, order_status: newStatus, status: newStatus } : o)));
      fetchOrders(true);
    } catch { toast.error('Failed to update order status'); }
  };

  const handleStatusChange = (orderId, newStatus) => {
    setStatusPickerFor(null);
    // Marking an order as paid is money-sensitive — confirm in a centered dialog first.
    if (newStatus === 'paid') {
      Alert.alert(
        'Mark order as paid?',
        `Confirm that payment for order #${String(orderId).slice(0, 8)} has been received. This updates the order status to Paid.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark as Paid', onPress: () => executeStatusChange(orderId, 'paid') },
        ],
      );
      return;
    }
    executeStatusChange(orderId, newStatus);
  };

  const totalSales = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const delivered = orders.filter((o) => statusOf(o) === 'delivered').length;
  const inProgress = orders.filter((o) => ['pending', 'processing', 'confirmed', 'shipped'].includes(statusOf(o))).length;
  const statCards = [
    { label: 'TOTAL ORDERS', value: orders.length, icon: 'cart', grad: [colors.p450, '#ffc0cb'] },
    { label: 'TOTAL SALES', value: totalSales, icon: 'logo-usd', grad: ['#10b981', '#14b8a6'], money: true },
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
  const TIME_FILTERS = [{ v: 'all', l: 'All Time' }, { v: 'last_day', l: 'Last 24 Hours' }, { v: 'last_week', l: 'Last 7 Days' }, { v: 'last_month', l: 'Last 30 Days' }];

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><Spinner size={34} color={colors.p500} /></View>;

  return (
    <>
      <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} onEndReached={() => moreOrders && revealOrders()}>
        <Rise duration={500} distance={0}><Text style={st.title} testID="admin-orders-title">Orders</Text></Rise>

        <View style={st.statsRow}>
          {statCards.map((s, i) => (
            <Rise key={s.label} delay={i * 60} duration={350} distance={12} style={st.statWrap}>
              <View style={st.stat} testID={`admin-order-stat-${i}`}>
                <View style={[st.statOrb, { backgroundColor: s.grad[0] }]} />
                <LinearGradient colors={s.grad} style={st.statTile}><Ionicons name={s.icon} size={15} color={colors.white} /></LinearGradient>
                {s.money ? <CountUp value={s.value} prefix="$" style={st.statValue} /> : <CountUp value={s.value} style={st.statValue} />}
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
            </Rise>
          ))}
        </View>

        <Rise delay={200}>
          <View style={st.filters} testID="admin-orders-filters">
            <View style={st.search}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by order ID, customer, shop..." placeholderTextColor={colors.textMuted} style={st.searchInput} testID="admin-orders-search" />
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SelectPill label="Destination State" value={destStateFilter} options={destStateOptions} onChange={setDestStateFilter} icon="location-outline" testID="admin-orders-state-filter" />
              <SelectPill label="Customer" value={customerFilter} options={customerOptions} onChange={setCustomerFilter} icon="person-outline" testID="admin-orders-customer-filter" />
            </View>

            <Text style={st.filterLabel}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_FILTERS.map((s) => {
                const count = orders.filter((o) => (s.value === 'all' ? true : statusOf(o) === s.value)).length;
                const active = statusFilter === s.value;
                return (
                  <TouchableOpacity key={s.value} onPress={() => setStatusFilter(s.value)} style={[st.statusFilterBtn, { backgroundColor: s.bg, opacity: active ? 1 : 0.65 }, active && st.statusFilterActive]} testID={`admin-status-btn-${s.value}`}>
                    <Text style={[st.statusFilterText, { color: s.fg }]}>{s.label}</Text>
                    <View style={st.statusCount}><Text style={[st.statusCountText, { color: s.fg }]}>{count}</Text></View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.filterLabel}>Time Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID="admin-orders-time-filter">
              {TIME_FILTERS.map((t) => (
                <TouchableOpacity key={t.v} onPress={() => setTimeFilter(t.v)} style={[st.timeChip, timeFilter === t.v && { backgroundColor: colors.p500, borderColor: colors.p500 }]}>
                  <Text style={[st.timeChipText, timeFilter === t.v && { color: colors.white }]}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={st.filterLabel}>Price Range: <Text style={{ color: colors.text, fontFamily: fonts.bold }}>${priceRange[0]} — ${priceRange[1]}</Text></Text>
            <RangeSlider min={0} max={maxPrice} value={priceRange} onChange={setPriceRange} testID="admin-orders-price-range" />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={st.footText}>{filteredOrders.length} of {orders.length} orders</Text>
              {(searchQuery || statusFilter !== 'all' || timeFilter !== 'all' || destStateFilter !== 'all' || customerFilter !== 'all') && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setDestStateFilter('all'); setCustomerFilter('all'); setPriceRange([0, maxPrice]); }}><Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.p500 }}>Clear Filters</Text></TouchableOpacity>
              )}
            </View>
          </View>
        </Rise>

        {filteredOrders.length === 0 ? (
          <View style={st.empty}><Ionicons name="cart-outline" size={44} color={colors.border} /><Text style={st.emptyText}>{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</Text></View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            {visibleOrders.map((order) => (
              <Animated.View key={order.id} layout={LinearTransition.springify().damping(18)} entering={newIds.includes(order.id) ? SlideInUp.duration(420) : FadeIn}>
                <OrderCard order={order} onView={setTabOrder} onRoute={setTabOrder} onPickStatus={setStatusPickerFor} isNew={newIds.includes(order.id)} justChanged={changedId === order.id} />
              </Animated.View>
            ))}
            {revealingOrders && <SkeletonRows count={2} height={120} style={{ paddingHorizontal: 0 }} />}
          </View>
        )}
      </ShopScreenWrap>

      {/* Status picker */}
      <Modal visible={!!statusPickerFor} transparent animationType="fade" onRequestClose={() => setStatusPickerFor(null)}>
        <BlurView intensity={22} tint="dark" style={st.pickerBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setStatusPickerFor(null)} />
          <View style={st.pickerSheet}>
            <Text style={st.pickerTitle}>Update Order Status</Text>
            <Text style={st.pickerSub}>#{String(statusPickerFor?.id || '').slice(0, 8)}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {['pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled'].map((sKey) => {
                const current = statusOf(statusPickerFor || {}) === sKey;
                return (
                  <TouchableOpacity key={sKey} activeOpacity={0.85} onPress={() => handleStatusChange(statusPickerFor.id, sKey)}>
                    <LinearGradient colors={current ? STATUS_GRADS[sKey] : ['#f8fafc', '#f8fafc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.pickerOption, !current && { borderWidth: 1, borderColor: colors.border }]}>
                      <View style={[st.pickerDot, { backgroundColor: current ? 'rgba(255,255,255,0.4)' : statusMeta(sKey).bg }]}>{current && <Ionicons name="checkmark" size={11} color={colors.white} />}</View>
                      <Text style={[st.pickerOptionText, { color: current ? colors.white : statusMeta(sKey).fg }]}>{statusMeta(sKey).label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Order detail — tabbed page (Details / Route / Map) */}
      <OrderDetailTabs
        visible={!!tabOrder}
        order={tabOrder}
        tabs={['details', 'route', 'map']}
        fetchDetails={api.admin.getOrderDetails}
        availableDelivery={availableDelivery}
        showCommission
        onClose={() => setTabOrder(null)}
      />
    </>
  );
}

/* ---------- Destination State / Customer select pill ---------- */
function SelectPill({ label, value, options, onChange, icon, testID }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const isDefault = value === 'all';
  return (
    <>
      <TouchableOpacity style={[st.selPill, !isDefault && st.selPillOn]} activeOpacity={0.8} onPress={() => setOpen(true)} testID={testID}>
        <Ionicons name={icon} size={13} color={isDefault ? colors.textMuted : colors.p500} />
        <Text style={[st.selPillText, !isDefault && { color: colors.p800 }]} numberOfLines={1}>{isDefault ? label : value}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={st.detailBackdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} /></View>
        <View style={[st.pickSheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
          <View style={st.grabber} />
          <Text style={st.detailTitle}>{label}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {options.map((o) => (
              <TouchableOpacity key={String(o)} style={st.pickOpt} onPress={() => { onChange(o); setOpen(false); }}>
                <Text style={[st.pickOptText, o === value && { color: colors.violet, fontFamily: fonts.bold }]}>{o === 'all' ? `All ${label}s` : o}</Text>
                {o === value && <Ionicons name="checkmark" size={17} color={colors.violet} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  statusFilterActive: { borderWidth: 2, borderColor: colors.p400 },
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
  routeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.s200, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, marginRight: 6 },
  routeBtnText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.s500 },
  selPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: colors.surfaceMuted },
  selPillOn: { borderColor: colors.p400, backgroundColor: colors.p50 },
  selPillText: { flex: 1, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  pickSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: 18, paddingTop: 10, maxHeight: '70%' },
  pickOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickOptText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text, flex: 1 },
  routeHeader: { flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  routeSectionLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  routeEmpty: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  fromCard: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: radius.md, padding: 12, marginBottom: 8 },
  fromIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  fromName: { fontFamily: fonts.bold, fontSize: 13.5, color: '#1e3a8a' },
  fromMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: '#1d4ed8', flex: 1 },
  fromItems: { fontFamily: fonts.body, fontSize: 11, color: '#2563eb', marginTop: 6 },
  arrowChip: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  toCard: { flexDirection: 'row', gap: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, padding: 12 },
  toIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  toName: { fontFamily: fonts.bold, fontSize: 13.5, color: '#065f46' },
  toMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: '#047857', flex: 1 },
  billCard: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginTop: 16 },
  billTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
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
