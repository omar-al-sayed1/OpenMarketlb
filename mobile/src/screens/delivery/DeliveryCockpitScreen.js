import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Modal, ScrollView, FlatList, Animated, Easing, Share, Linking, Platform, RefreshControl } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Animated2, { LinearTransition, SlideOutRight, FadeIn } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { brandRefresh } from '../../components/BrandRefresh';
import { img } from '../../lib/media';
import { useAuth } from '../../context/AuthContext';
import { tapLight, notifySuccess, notifyError } from '../../lib/haptics';
import { colors, delivery as D, radius, fonts, shadow } from '../../theme/theme';
import { CountUp, PressScale, Spinner, ToastHost, toast } from '../../components/shop/ShopKit';
import OrderDetailTabs from '../../components/OrderDetailTabs';
import NotificationBell from '../../components/NotificationBell';

/* ---- ported helpers (verbatim) ---- */
const STATUS_LABELS = { pending: 'Pending', assigned: 'Assigned', picked_up: 'Picked Up', in_transit: 'In Transit', delivered: 'Delivered', failed: 'Failed' };
const statusMeta = (s) => D.status[s] || { bg: '#f1f5f9', fg: '#475569', icon: 'cube' };
const statusLabel = (s) => STATUS_LABELS[s] || s;

const getAddress = (order) => {
  const addr = order.shipping_address;
  if (typeof addr === 'object' && addr) return [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
  return [addr, order.shipping_city, order.shipping_state].filter(Boolean).join(', ');
};
const getShopBreakdown = (order) => {
  const shops = {};
  (order.items || []).forEach(item => {
    const sn = item.shop_name || 'Unknown';
    if (!shops[sn]) shops[sn] = 0;
    shops[sn] += (item.subtotal || item.price * item.quantity || 0);
  });
  return Object.entries(shops);
};

/* bobbing scooter for empty states */
function BobbingScooter({ label, sub }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a]);
  return (
    <View style={st.empty} testID="delivery-empty">
      <Animated.View style={{ transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
        <View style={st.scooterTile}><Ionicons name="bicycle" size={40} color="#94a3b8" /></View>
      </Animated.View>
      <View style={st.scooterShadow} />
      <Text style={st.emptyTitle}>{label}</Text>
      <Text style={st.emptySub}>{sub}</Text>
    </View>
  );
}

/* GPS button that pulses a ring while posting */
function GpsButton({ posting, onPress }) {
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (posting) {
      const loop = Animated.loop(Animated.timing(ping, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }));
      loop.start();
      return () => { loop.stop(); ping.setValue(0); };
    }
  }, [posting, ping]);
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} testID="delivery-update-location-btn">
        <View style={st.gpsBtn}>
          {posting && (
            <Animated.View pointerEvents="none" style={[st.gpsPing, {
              opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
              transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            }]} />
          )}
          <Ionicons name="location" size={14} color="#047857" />
          <Text style={st.gpsText}>Update Location</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ---- the self-drawing metro status rail ---- */
const RAIL_STATIONS = [
  { key: 'picked_up', label: 'Picked Up', color: colors.s700, icon: 'arrow-up-circle' },
  { key: 'in_transit', label: 'In Transit', color: colors.p800, icon: 'car' },
  { key: 'delivered', label: 'Delivered', color: '#047857', icon: 'checkmark-circle' },
];
const RAIL_ORDER = ['assigned', 'picked_up', 'in_transit', 'delivered'];

function MetroRail({ status }) {
  const reached = RAIL_ORDER.indexOf(status);
  return (
    <View style={st.rail}>
      {RAIL_STATIONS.map((station, i) => {
        const stationIdx = RAIL_ORDER.indexOf(station.key);
        const done = reached >= stationIdx;
        return (
          <React.Fragment key={station.key}>
            <View style={{ alignItems: 'center', width: 66 }}>
              <RailStation done={done} color={station.color} icon={station.icon} />
              <Text style={[st.railLabel, { color: done ? station.color : colors.textMuted }]}>{station.label}</Text>
            </View>
            {i < RAIL_STATIONS.length - 1 && <RailLine done={reached >= RAIL_ORDER.indexOf(RAIL_STATIONS[i + 1].key)} color={RAIL_STATIONS[i + 1].color} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}
function RailStation({ done, color, icon }) {
  const a = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => { Animated.spring(a, { toValue: done ? 1 : 0, friction: 5, tension: 160, useNativeDriver: true }).start(); }, [done, a]);
  return (
    <Animated.View style={[st.station, { backgroundColor: done ? color : colors.borderLight, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      <Ionicons name={icon} size={16} color={done ? colors.white : colors.textMuted} />
    </Animated.View>
  );
}
function RailLine({ done, color }) {
  const a = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => { Animated.timing(a, { toValue: done ? 1 : 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [done, a]);
  return (
    <View style={st.railTrack}>
      <Animated.View style={[st.railFill, { backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export default function DeliveryCockpitScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [claimingId, setClaimingId] = useState(null);
  const [gpsPosting, setGpsPosting] = useState(false);
  const [autoPing, setAutoPing] = useState(false);
  const autoTimer = useRef(null);

  const tabIndicator = useRef(new Animated.Value(0)).current;

  const fetchOrders = useCallback(async () => {
    try {
      const [availRes, myRes] = await Promise.allSettled([api.delivery.getAvailableOrders(), api.delivery.getMyOrders()]);
      if (availRes.status === 'fulfilled') setAvailableOrders(availRes.value.data || []);
      if (myRes.status === 'fulfilled') setMyOrders(myRes.value.data || []);
    } catch (e) {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }, [fetchOrders]);

  const switchTab = (id) => {
    setActiveTab(id);
    setStatusFilter('all');   // reset — exactly like web
    setSearchQuery('');
    Animated.spring(tabIndicator, { toValue: id === 'available' ? 0 : 1, friction: 8, tension: 90, useNativeDriver: false }).start();
  };

  const handleClaim = async (orderId) => {
    setClaimingId(orderId); // triggers the swoosh-out exit animation
    try {
      await api.delivery.claimOrder(orderId);
      notifySuccess();
      toast.success('Order claimed successfully!');
      setDetailOpen(false);
      setTimeout(() => { fetchOrders(); setClaimingId(null); }, 380);
    } catch (error) {
      setClaimingId(null);
      notifyError();
      toast.error(error.response?.data?.detail || 'Failed to claim order');
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await api.delivery.updateStatus(orderId, newStatus, '');
      tapLight();
      if (newStatus === 'delivered') notifySuccess();
      toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
      // optimistic: keep the sheet open, morph the rail
      setSelectedOrder(prev => (prev ? { ...prev, delivery_status: newStatus } : prev));
      fetchOrders();
    } catch (error) {
      notifyError();
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const openOrderDetails = async (order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
    try {
      const { data } = await api.delivery.getOrderDetails(order.id);
      // Merge delivery_info too so the Route + Map tabs render without a second fetch.
      setSelectedOrder(prev => ({ ...(prev || {}), ...order, delivery_info: data?.delivery_info || null, agent_breakdown: data?.agent_breakdown || { has_agent: false, entries: [] } }));
    } catch {}
  };

  /* turn-by-turn — build the same waypoints and deep-link into Maps */
  const openNavigation = async (orderId) => {
    try {
      const { data } = await api.delivery.getOrderDetails(orderId);
      const shops = data.delivery_info?.from_shops || [];
      const customer = data.delivery_info?.to_customer?.location;
      const waypoints = [];
      shops.forEach(s => { if (s.shop_latitude && s.shop_longitude) waypoints.push(`${s.shop_latitude},${s.shop_longitude}`); });
      let navUrl;
      if (customer && customer.lat && customer.lng) {
        const destination = `${customer.lat},${customer.lng}`;
        navUrl = waypoints.length > 0
          ? `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints.join('|')}&travelmode=driving`
          : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      } else if (waypoints.length > 0) {
        navUrl = `https://www.google.com/maps/dir/?api=1&destination=${waypoints[0]}&travelmode=driving`;
      } else { toast.error('No location data available for navigation'); return; }
      Linking.openURL(navUrl).catch(() => toast.error('Could not open Maps'));
    } catch { toast.error('Failed to get navigation data'); }
  };

  /* live location update — expo-location → updateDriverLocation */
  const sendLocationUpdate = async (orderId) => {
    setGpsPosting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.error('GPS not available'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api.orderTracking.updateDriverLocation({ order_id: orderId, lat: loc.coords.latitude, lng: loc.coords.longitude });
      tapLight();
      toast.success('Location updated');
    } catch { toast.error('Failed to update location'); }
    finally { setGpsPosting(false); }
  };

  /* auto-ping toggle — MOBILE ENHANCEMENT: foreground ping every 15s */
  const toggleAutoPing = (orderId) => {
    if (autoPing) {
      setAutoPing(false);
      if (autoTimer.current) clearInterval(autoTimer.current);
    } else {
      setAutoPing(true);
      sendLocationUpdate(orderId);
      autoTimer.current = setInterval(() => sendLocationUpdate(orderId), 15000);
    }
  };
  useEffect(() => () => { if (autoTimer.current) clearInterval(autoTimer.current); }, []);
  // stop auto-ping when the sheet closes
  useEffect(() => { if (!detailOpen && autoPing) { setAutoPing(false); if (autoTimer.current) clearInterval(autoTimer.current); } }, [detailOpen]); // eslint-disable-line

  /* download bill — compose a plaintext bill and share (MOBILE: share vs jsPDF) */
  const handleDownloadBill = async (order) => {
    try {
      const shops = getShopBreakdown(order).map(([name]) => name);
      const deliveryFee = Number(order.delivery_fee || 0);
      const itemsSubtotal = Number(order.total_amount || 0) - deliveryFee + Number(order.loyalty_discount_amount || 0);
      const lines = [
        `CUSTOMER BILL`, `Order #${(order.id || '').slice(0, 8)}`, ``,
        `Shops ordered from:`, ...(shops.length ? shops : ['—']).map(s => `  - ${s}`), ``,
        `Customer: ${order.customer_name || order.guest_name || 'Customer'}`,
        ...((order.customer_phone || order.guest_phone) ? [`Phone: ${order.customer_phone || order.guest_phone}`] : []),
        `Address: ${getAddress(order) || '—'}`, ``,
        `Items:`,
        ...(order.items || []).map(it => `  ${(it.name || it.product_name || 'Item')} x ${it.quantity || 1}   $${(it.subtotal || (it.price * it.quantity) || 0).toFixed(2)}`),
        ``,
        `Items Subtotal: $${itemsSubtotal.toFixed(2)}`,
        ...(Number(order.loyalty_discount_amount || 0) > 0 ? [`Loyalty Discount: -$${Number(order.loyalty_discount_amount).toFixed(2)}`] : []),
        `Delivery Fee: $${deliveryFee.toFixed(2)}`,
        `CUSTOMER PAYS: $${Number(order.total_amount || 0).toFixed(2)}`,
      ];
      await Share.share({ title: `Bill ${(order.id || '').slice(0, 8)}`, message: lines.join('\n') });
    } catch (e) { toast.error('Failed to generate bill'); }
  };

  /* stats — ported */
  const stats = {
    available: availableOrders.length,
    active: myOrders.filter(o => o.delivery_status !== 'delivered' && o.delivery_status !== 'failed').length,
    delivered: myOrders.filter(o => o.delivery_status === 'delivered').length,
    totalEarnings: myOrders.filter(o => o.delivery_status === 'delivered').reduce((sum, o) => sum + (o.delivery_fee || 0), 0),
  };

  const currentOrders = activeTab === 'available' ? availableOrders : myOrders;
  const filteredOrders = useMemo(() => currentOrders.filter(order => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || order.id?.toLowerCase().includes(q) ||
      (order.customer_name || order.guest_name || '').toLowerCase().includes(q) || getAddress(order).toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || order.delivery_status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [currentOrders, searchQuery, statusFilter]);

  if (loading) {
    return <View style={[st.center, { paddingTop: insets.top }]}><Spinner size={38} color={D.primary} /></View>;
  }

  const STATUS_FILTERS = [
    { v: 'all', l: 'All' }, { v: 'assigned', l: 'Assigned' }, { v: 'picked_up', l: 'Picked Up' },
    { v: 'in_transit', l: 'In Transit', }, { v: 'delivered', l: 'Delivered' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      {/* Header — blue-600 -> indigo-600 gradient bar */}
      <LinearGradient colors={D.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 8 }}>
        <View style={st.header} testID="delivery-header">
          <View style={st.truckTile}><Ionicons name="car" size={18} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Delivery Dashboard</Text>
            <Text style={st.headerSub}>Welcome, {user?.name || 'Driver'}</Text>
          </View>
          <NotificationBell color={colors.white} onDark />
          <TouchableOpacity onPress={() => Alert.alert('Log out', 'Sign out of the courier cockpit?', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => logout() },
          ])} style={st.logoutBtn} testID="delivery-logout">
            <Text style={st.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={brandRefresh(refreshing, onRefresh)}
        ListHeaderComponent={
          <>
            {/* Stats — count-up chips */}
            <View style={st.statsGrid} testID="delivery-stats">
              {[
                { key: 'available', label: 'Available', value: stats.available },
                { key: 'active', label: 'Active', value: stats.active },
                { key: 'delivered', label: 'Delivered', value: stats.delivered },
                { key: 'earnings', label: 'Earnings', value: stats.totalEarnings, money: true },
              ].map(s => {
                const cfg = D.stats[s.key];
                return (
                  <View key={s.key} style={[st.statChip, { backgroundColor: cfg.soft, borderColor: cfg.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.tint} />
                      <Text style={[st.statLabel, { color: cfg.tint }]}>{s.label}</Text>
                    </View>
                    {s.money
                      ? <CountUp value={Number(s.value)} prefix="$" decimals={2} style={[st.statValue, { color: cfg.tint }]} />
                      : <CountUp value={s.value} style={[st.statValue, { color: cfg.tint }]} />}
                  </View>
                );
              })}
            </View>

            {/* Tabs — white tray, sliding indicator */}
            <View style={st.tabTray} testID="delivery-tabs">
              <Animated.View style={[st.tabIndicator, {
                left: tabIndicator.interpolate({ inputRange: [0, 1], outputRange: ['1%', '50%'] }),
              }]} />
              {[
                { id: 'available', label: 'Available Orders', count: availableOrders.length },
                { id: 'my', label: 'My Deliveries', count: myOrders.length },
              ].map(tab => {
                const on = activeTab === tab.id;
                return (
                  <TouchableOpacity key={tab.id} onPress={() => switchTab(tab.id)} style={st.tabBtn} activeOpacity={0.85} testID={`delivery-tab-${tab.id}`}>
                    <Text style={[st.tabLabel, on && { color: colors.white }]} numberOfLines={1}>{tab.label}</Text>
                    <View style={[st.tabBadge, on ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: colors.borderLight }]}>
                      <Text style={[st.tabBadgeText, on && { color: colors.white }]}>{tab.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filters */}
            <View style={st.search}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by order ID, customer, location..."
                placeholderTextColor={colors.textMuted} style={st.searchInput} testID="delivery-search" />
            </View>
            {activeTab === 'my' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 4 }} testID="delivery-status-filter">
                {STATUS_FILTERS.map(f => (
                  <TouchableOpacity key={f.v} onPress={() => setStatusFilter(f.v)}
                    style={[st.filterChip, statusFilter === f.v && { backgroundColor: D.primary, borderColor: D.primary }]}>
                    <Text style={[st.filterChipText, statusFilter === f.v && { color: colors.white }]}>{f.l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        }
        ListEmptyComponent={
          <BobbingScooter
            label={activeTab === 'available' ? 'No available orders' : 'No deliveries yet'}
            sub={activeTab === 'available' ? 'Check back later for new orders.' : 'Claim an available order to start delivering.'}
          />
        }
        renderItem={({ item: order }) => {
          const m = statusMeta(order.delivery_status);
          const shopBreakdown = getShopBreakdown(order);
          const items = order.items || [];
          return (
            <Animated2.View layout={LinearTransition.springify().damping(16)} entering={FadeIn}
              exiting={claimingId === order.id ? SlideOutRight.duration(360) : undefined}>
              <View style={st.orderCard} testID={`delivery-order-${order.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Text style={st.orderId}>#{order.id?.slice(0, 10)}</Text>
                  <View style={[st.statusPill, { backgroundColor: m.bg }]}>
                    <Ionicons name={m.icon} size={11} color={m.fg} />
                    <Text style={[st.statusText, { color: m.fg }]}>{statusLabel(order.delivery_status)}</Text>
                  </View>
                  <Text style={st.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.customer}>{order.customer_name || order.guest_name || 'Customer'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <Ionicons name="location" size={11} color={colors.textMuted} />
                      <Text style={st.address} numberOfLines={1}>{getAddress(order)}</Text>
                    </View>
                    {/* item thumbnails */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                      {items.slice(0, 4).map((it, i) => (
                        <View key={i} style={st.thumb}>
                          {(it.image || it.product_image) ? <Image source={{ uri: img(it.image || it.product_image) }} style={StyleSheet.absoluteFill} /> : <Ionicons name="cube" size={14} color={colors.textMuted} />}
                        </View>
                      ))}
                      {items.length > 4 && <View style={[st.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Text style={st.thumbMore}>+{items.length - 4}</Text></View>}
                      <Text style={st.itemsCount}>{items.length} items</Text>
                    </View>
                    {shopBreakdown.length > 1 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                        {shopBreakdown.map(([name, total], i) => (
                          <View key={i} style={st.shopChip}>
                            <Ionicons name="storefront" size={9} color="#047857" />
                            <Text style={st.shopChipText}>{name}: ${total.toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={st.total}>${(order.total_amount || 0).toFixed(2)}</Text>
                      <Text style={st.fee}>Fee: ${(order.delivery_fee || 0).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => openOrderDetails(order)} style={st.eyeBtn} testID={`delivery-view-${order.id}`}>
                        <Ionicons name="eye" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {activeTab === 'available' && (
                        <PressScale onPress={() => handleClaim(order.id)}>
                          <View style={st.claimBtn} testID={`delivery-claim-${order.id}`}>
                            <Ionicons name="car" size={14} color={colors.white} />
                            <Text style={st.claimText}>Claim</Text>
                          </View>
                        </PressScale>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </Animated2.View>
          );
        }}
      />

      {/* ===== Order detail — tabbed page (Details / Route / Map); Details keeps all courier actions ===== */}
      <OrderDetailTabs
        visible={detailOpen}
        order={selectedOrder}
        onClose={() => setDetailOpen(false)}
        tabs={['details', 'route', 'map']}
        availableDelivery
        renderDetails={selectedOrder ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14 }}>
                {/* id + status */}
                <View style={st.idRow}>
                  <View>
                    <Text style={st.idLabel}>Order ID</Text>
                    <Text style={st.idValue}>{selectedOrder.id}</Text>
                  </View>
                  {(() => { const m = statusMeta(selectedOrder.delivery_status); return (
                    <View style={[st.statusPill, { backgroundColor: m.bg }]}>
                      <Ionicons name={m.icon} size={12} color={m.fg} />
                      <Text style={[st.statusText, { color: m.fg }]}>{statusLabel(selectedOrder.delivery_status)}</Text>
                    </View>
                  ); })()}
                </View>

                {/* customer + address */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={st.infoBox}>
                    <Text style={st.infoLabel}>Customer</Text>
                    <Text style={st.infoName}>{selectedOrder.customer_name || selectedOrder.guest_name || 'Customer'}</Text>
                    {(selectedOrder.customer_phone || selectedOrder.guest_phone) ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedOrder.customer_phone || selectedOrder.guest_phone}`)} style={st.infoMeta}>
                        <Ionicons name="call" size={11} color="#2563eb" /><Text style={[st.infoMetaText, { color: '#2563eb' }]}>{selectedOrder.customer_phone || selectedOrder.guest_phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {(selectedOrder.customer_email || selectedOrder.guest_email) ? (
                      <View style={st.infoMeta}><Ionicons name="mail" size={11} color={colors.textMuted} /><Text style={st.infoMetaText} numberOfLines={1}>{selectedOrder.customer_email || selectedOrder.guest_email}</Text></View>
                    ) : null}
                  </View>
                  <View style={st.infoBox}>
                    <Text style={st.infoLabel}>Delivery Address</Text>
                    <View style={{ flexDirection: 'row', gap: 5, marginTop: 3 }}>
                      <Ionicons name="location" size={13} color="#2563eb" style={{ marginTop: 1 }} />
                      <Text style={st.infoAddress}>{getAddress(selectedOrder)}</Text>
                    </View>
                  </View>
                </View>

                {/* items */}
                <View>
                  <Text style={st.sectionCaps}>Items ({(selectedOrder.items || []).length})</Text>
                  <View style={{ gap: 7 }}>
                    {(selectedOrder.items || []).map((item, i) => (
                      <View key={i} style={st.itemRow}>
                        <View style={st.itemImg}>
                          {(item.image || item.product_image) ? <Image source={{ uri: img(item.image || item.product_image) }} style={StyleSheet.absoluteFill} /> : <Ionicons name="cube" size={18} color={colors.textMuted} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.itemName} numberOfLines={1}>{item.name || item.product_name}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                            {item.selected_color ? <View style={[st.vChip, { backgroundColor: colors.p50 }]}><Text style={[st.vChipText, { color: colors.p800 }]}>Color: {item.selected_color}</Text></View> : null}
                            {item.selected_size ? <View style={[st.vChip, { backgroundColor: '#eff6ff' }]}><Text style={[st.vChipText, { color: '#1d4ed8' }]}>Size: {item.selected_size}</Text></View> : null}
                            <View style={[st.vChip, { backgroundColor: colors.borderLight }]}><Text style={[st.vChipText, { color: colors.textSecondary }]}>Qty: {item.quantity}</Text></View>
                            {item.shop_name ? <Text style={st.itemShop}>{item.shop_name}</Text> : null}
                          </View>
                        </View>
                        <Text style={st.itemAmt}>${(item.subtotal || item.price * item.quantity || 0).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* revenue by shop */}
                <LinearGradient colors={D.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.revenueBox}>
                  <Text style={st.revenueCaps}>Revenue by Shop</Text>
                  {getShopBreakdown(selectedOrder).map(([name, total], i) => (
                    <View key={i} style={st.revenueRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="storefront" size={12} color="#047857" /><Text style={st.revenueName}>{name}</Text></View>
                      <Text style={st.revenueVal}>${total.toFixed(2)}</Text>
                    </View>
                  ))}
                </LinearGradient>

                {/* customer bill */}
                <View style={st.billBox} testID="delivery-customer-bill">
                  <Text style={st.sectionCaps}>Customer Bill</Text>
                  {(selectedOrder.items || []).map((it, i) => (
                    <View key={i} style={st.billItemRow}>
                      <Text style={st.billItemName} numberOfLines={1}>{it.name || it.product_name || 'Item'} × {it.quantity || 1}</Text>
                      <Text style={st.billItemAmt}>${(it.subtotal || (it.price * it.quantity) || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={[st.billTotalRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 }]}>
                    <Text style={st.billKey}>Items Subtotal</Text>
                    <Text style={st.billVal}>${((selectedOrder.total_amount || 0) - (selectedOrder.delivery_fee || 0) + (selectedOrder.loyalty_discount_amount || 0)).toFixed(2)}</Text>
                  </View>
                  {selectedOrder.loyalty_points_redeemed > 0 ? (
                    <View style={st.billTotalRow}><Text style={[st.billKey, { color: '#d97706' }]}>Points Redeemed ({selectedOrder.loyalty_points_redeemed} pts)</Text><Text style={[st.billVal, { color: '#d97706' }]}>-${(selectedOrder.loyalty_discount_amount || 0).toFixed(2)}</Text></View>
                  ) : null}
                  <View style={st.billTotalRow}><Text style={[st.billKey, { color: '#2563eb' }]}>Delivery Fee</Text><Text style={[st.billVal, { color: '#2563eb' }]}>${(selectedOrder.delivery_fee || 0).toFixed(2)}</Text></View>
                  <View style={[st.billTotalRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 }]}>
                    <Text style={st.billPaysKey}>Customer Pays</Text>
                    <Text style={st.billPaysVal}>${(selectedOrder.total_amount || 0).toFixed(2)}</Text>
                  </View>
                </View>

                {/* download bill */}
                <PressScale onPress={() => handleDownloadBill(selectedOrder)}>
                  <View style={st.outlineBtn} testID="delivery-download-bill-btn"><Ionicons name="download-outline" size={15} color={colors.text} /><Text style={st.outlineText}>Download bill</Text></View>
                </PressScale>

                {/* navigate + update location */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PressScale style={{ flex: 1 }} onPress={() => openNavigation(selectedOrder.id)}>
                    <LinearGradient colors={D.navBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.gradBtn} testID="delivery-navigate-btn">
                      <Ionicons name="navigate" size={15} color={colors.white} /><Text style={st.gradBtnText}>Navigate</Text>
                    </LinearGradient>
                  </PressScale>
                  {activeTab === 'my' && ['assigned', 'picked_up', 'in_transit'].includes(selectedOrder.delivery_status) && (
                    <GpsButton posting={gpsPosting} onPress={() => sendLocationUpdate(selectedOrder.id)} />
                  )}
                </View>

                {/* auto-ping toggle — MOBILE ENHANCEMENT */}
                {activeTab === 'my' && ['assigned', 'picked_up', 'in_transit'].includes(selectedOrder.delivery_status) && (
                  <TouchableOpacity onPress={() => toggleAutoPing(selectedOrder.id)} activeOpacity={0.8} style={[st.autoPing, autoPing && { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Ionicons name={autoPing ? 'radio' : 'radio-outline'} size={14} color={autoPing ? '#059669' : colors.textMuted} />
                    <Text style={[st.autoPingText, autoPing && { color: '#047857' }]}>{autoPing ? 'Auto-ping ON — sharing live location every 15s' : 'Enable live location auto-ping (every 15s)'}</Text>
                  </TouchableOpacity>
                )}

                {/* metro status rail + actions */}
                {activeTab === 'my' && selectedOrder.delivery_status !== 'delivered' && selectedOrder.delivery_status !== 'failed' && (
                  <View style={st.railCard}>
                    <MetroRail status={selectedOrder.delivery_status} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                      {selectedOrder.delivery_status === 'assigned' && (
                        <PressScale style={{ flex: 1 }} onPress={() => handleStatusUpdate(selectedOrder.id, 'picked_up')}>
                          <View style={[st.railBtn, { backgroundColor: colors.s700 }]} testID="delivery-mark-picked-up"><Ionicons name="arrow-up-circle" size={15} color={colors.white} /><Text style={st.railBtnText}>Mark Picked Up</Text></View>
                        </PressScale>
                      )}
                      {selectedOrder.delivery_status === 'picked_up' && (
                        <PressScale style={{ flex: 1 }} onPress={() => handleStatusUpdate(selectedOrder.id, 'in_transit')}>
                          <View style={[st.railBtn, { backgroundColor: colors.p800 }]} testID="delivery-mark-in-transit"><Ionicons name="car" size={15} color={colors.white} /><Text style={st.railBtnText}>Mark In Transit</Text></View>
                        </PressScale>
                      )}
                      {(selectedOrder.delivery_status === 'in_transit' || selectedOrder.delivery_status === 'picked_up') && (
                        <PressScale style={{ flex: 1 }} onPress={() => handleStatusUpdate(selectedOrder.id, 'delivered')}>
                          <View style={[st.railBtn, { backgroundColor: '#059669' }]} testID="delivery-mark-delivered"><Ionicons name="checkmark-circle" size={15} color={colors.white} /><Text style={st.railBtnText}>Mark Delivered</Text></View>
                        </PressScale>
                      )}
                    </View>
                  </View>
                )}

                {/* delivered stamp */}
                {selectedOrder.delivery_status === 'delivered' && (
                  <LinearGradient colors={D.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.deliveredCard}>
                    <DeliveredStamp />
                    <Text style={st.deliveredTitle}>Delivered!</Text>
                    <Text style={st.deliveredSub}>This order is complete. Great work. 🛵</Text>
                  </LinearGradient>
                )}

                {/* claim (available tab) */}
                {activeTab === 'available' && (
                  <PressScale onPress={() => handleClaim(selectedOrder.id)}>
                    <View style={[st.gradBtn, { backgroundColor: D.primary }]} testID="delivery-claim-btn"><Ionicons name="car" size={15} color={colors.white} /><Text style={st.gradBtnText}>Claim This Order</Text></View>
                  </PressScale>
                )}
              </ScrollView>
        ) : null}
      />

      <ToastHost />
    </View>
  );
}

/* delivered checkmark that stamps down */
function DeliveredStamp() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(120), Animated.spring(a, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true })]).start();
  }, [a]);
  return (
    <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [2, 1] }) }], opacity: a }}>
      <View style={st.deliveredIcon}><Ionicons name="checkmark-circle" size={40} color="#059669" /></View>
    </Animated.View>
  );
}

/* full-screen map — shop pickup pins + customer drop-off + route line */
function DeliveryMap({ data, insets, onClose }) {
  const shops = (data.shops || []).filter(s => s.shop_latitude && s.shop_longitude);
  const cust = data.customerLocation && data.customerLocation.lat && data.customerLocation.lng ? data.customerLocation : null;
  const points = [...shops.map(s => ({ latitude: Number(s.shop_latitude), longitude: Number(s.shop_longitude) })), ...(cust ? [{ latitude: Number(cust.lat), longitude: Number(cust.lng) }] : [])];
  const region = points.length
    ? { latitude: points[0].latitude, longitude: points[0].longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : { latitude: 33.8938, longitude: 35.5018, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <MapView style={StyleSheet.absoluteFill} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} initialRegion={region}>
        {shops.map((s, i) => (
          <Marker key={`shop-${i}`} coordinate={{ latitude: Number(s.shop_latitude), longitude: Number(s.shop_longitude) }} title={s.shop_name || 'Pickup'} anchor={{ x: 0.5, y: 1 }}>
            <View style={[mp.pin, { backgroundColor: colors.p500 }]}><Ionicons name="storefront" size={13} color={colors.white} /></View>
          </Marker>
        ))}
        {cust && (
          <Marker coordinate={{ latitude: Number(cust.lat), longitude: Number(cust.lng) }} title="Drop-off" anchor={{ x: 0.5, y: 1 }}>
            <View style={[mp.pin, { backgroundColor: '#059669' }]}><Ionicons name="flag" size={13} color={colors.white} /></View>
          </Marker>
        )}
        {points.length > 1 && <Polyline coordinates={points} strokeColor="#2563eb" strokeWidth={3} lineDashPattern={[6, 6]} />}
      </MapView>
      <View style={[mp.topBar, { top: insets.top + 8 }]}>
        <View style={mp.legend}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={[mp.dot, { backgroundColor: colors.p500 }]} /><Text style={mp.legendText}>Pickup ({shops.length})</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={[mp.dot, { backgroundColor: '#059669' }]} /><Text style={mp.legendText}>Drop-off</Text></View>
        </View>
        <TouchableOpacity onPress={onClose} style={mp.closeBtn}><Ionicons name="close" size={20} color={colors.white} /></TouchableOpacity>
      </View>
    </View>
  );
}
const mp = StyleSheet.create({
  pin: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, ...shadow.emphasis },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11 },
  closeBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center' },
});

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: D.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingBottom: 12 },
  truckTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16, letterSpacing: -0.3 },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 8 },
  logoutText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statChip: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: radius.lg, padding: 13 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, opacity: 0.8 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 23, letterSpacing: -0.5 },
  tabTray: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 4, marginTop: 14, position: 'relative', ...shadow.card },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, width: '49%', borderRadius: radius.md, backgroundColor: D.primary, ...D.blueGlow },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  tabBadge: { minWidth: 20, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginTop: 12, marginBottom: 8, ...shadow.card },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  filterChipText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 44, marginTop: 8, ...shadow.card },
  scooterTile: { width: 78, height: 78, borderRadius: 24, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  scooterShadow: { width: 48, height: 8, borderRadius: 4, backgroundColor: 'rgba(15,23,42,0.07)', marginTop: 10 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.textSecondary, marginTop: 12 },
  emptySub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  orderCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadow.card },
  orderId: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  orderDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  customer: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  address: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, flex: 1 },
  thumb: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  thumbMore: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted },
  itemsCount: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginLeft: 3 },
  shopChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  shopChipText: { fontFamily: fonts.semibold, fontSize: 9, color: '#047857' },
  total: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  fee: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#2563eb', marginTop: 1 },
  eyeBtn: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.primary, borderRadius: 11, paddingHorizontal: 13, height: 36, ...D.blueGlow },
  claimText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  sheetClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  idLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  idValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, marginTop: 2 },
  infoBox: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11 },
  infoLabel: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  infoName: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginTop: 4 },
  infoMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  infoMetaText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  infoAddress: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text, lineHeight: 16 },
  sectionCaps: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 9 },
  itemImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  vChip: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  vChipText: { fontFamily: fonts.medium, fontSize: 9 },
  itemShop: { fontFamily: fonts.semibold, fontSize: 9.5, color: '#059669' },
  itemAmt: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  revenueBox: { borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 12 },
  revenueCaps: { fontFamily: fonts.bold, fontSize: 10, color: '#047857', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  revenueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  revenueName: { fontFamily: fonts.medium, fontSize: 12.5, color: '#047857' },
  revenueVal: { fontFamily: fonts.bold, fontSize: 12.5, color: '#047857' },
  billBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, gap: 5 },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billItemName: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginRight: 8 },
  billItemAmt: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  billVal: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  billPaysKey: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  billPaysVal: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  outlineBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outlineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  gradBtn: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...D.blueGlow },
  gradBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
  gpsBtn: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  gpsPing: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#6ee7b7' },
  gpsText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#047857' },
  autoPing: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  autoPingText: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  railCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  station: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  railLabel: { fontFamily: fonts.semibold, fontSize: 10, marginTop: 5, textAlign: 'center' },
  railTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 17, marginHorizontal: -6, overflow: 'hidden' },
  railFill: { height: '100%', borderRadius: 2 },
  railBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  railBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  deliveredCard: { borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.lg, padding: 22, alignItems: 'center' },
  deliveredIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  deliveredTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: '#047857', marginTop: 12 },
  deliveredSub: { fontFamily: fonts.body, fontSize: 12.5, color: '#059669', marginTop: 3 },
});
