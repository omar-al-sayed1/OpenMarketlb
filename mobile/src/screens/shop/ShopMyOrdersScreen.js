import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { useReveal } from '../../lib/useReveal';
import { SkeletonRows } from '../../components/ui';

/* STATUS_COLORS — ported verbatim */
const STATUS_COLORS = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  paid: { bg: '#d1fae5', fg: '#065f46' },
  processing: { bg: '#dbeafe', fg: '#1e40af' },
  shipped: { bg: colors.p100, fg: '#5b21b6' },
  delivered: { bg: '#d1fae5', fg: '#065f46' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
  refunded: { bg: '#f1f5f9', fg: '#334155' },
};

const STATUS_OPTIONS = ['all', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function ShopMyOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      // Orders placed by the logged-in user (shop owner shopping)
      const { data } = await api.orders.getAll();
      const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(sorted);
    } catch (err) {
      toast.error('Failed to load your orders');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }, [fetchOrders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (statusFilter !== 'all' && o.order_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = (o.id || '').toLowerCase().includes(q) ||
        (o.shop_name || '').toLowerCase().includes(q) ||
        (o.items || []).some((it) => (it.product_name || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  }), [orders, statusFilter, search]);

  const { visible: visibleOrders, hasMore: moreOrders, revealing: revealingOrders, revealMore: revealOrders } = useReveal(filtered, 8);

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg }}>
        <Spinner size={34} color="#059669" />
      </View>
    );
  }

  return (
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} onEndReached={() => moreOrders && revealOrders()}>
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={st.headIcon}><Ionicons name="clipboard" size={22} color="#059669" /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>My Orders</Text>
            <Text style={st.sub}>Orders you placed as a buyer. Tap any order to track it in real time.</Text>
          </View>
        </View>
        <PressScale onPress={() => navigation.navigate('Shop')} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <View style={st.shopMore}>
            <Ionicons name="cube" size={13} color={colors.white} />
            <Text style={st.shopMoreText}>Shop More</Text>
          </View>
        </PressScale>
      </Rise>

      {/* Filters */}
      <Rise delay={100}>
        <View style={st.filters}>
          <View style={st.search}>
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search by order ID, shop or product…"
              placeholderTextColor={colors.textMuted} style={st.searchInput} testID="my-orders-search" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID="my-orders-status-filter">
            {STATUS_OPTIONS.map(s => (
              <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}
                style={[st.chip, statusFilter === s && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                <Text style={[st.chipText, statusFilter === s && { color: colors.white }]}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Rise>

      {/* List */}
      {filtered.length === 0 ? (
        <Rise delay={160}>
          <View style={st.empty}>
            <View style={st.emptyIcon}><Ionicons name="clipboard" size={30} color="#059669" /></View>
            <Text style={st.emptyTitle}>No orders yet</Text>
            <Text style={st.emptySub}>Once you place an order from another shop it will appear here.</Text>
            <PressScale onPress={() => navigation.navigate('Shop')} style={{ marginTop: 14 }}>
              <View style={st.shopMore}><Text style={st.shopMoreText}>Browse products</Text></View>
            </PressScale>
          </View>
        </Rise>
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          {visibleOrders.map((order) => {
            const statusKey = (order.order_status || 'pending').toLowerCase();
            const sc = STATUS_COLORS[statusKey] || { bg: '#f1f5f9', fg: '#475569' };
            const paid = order.payment_status === 'paid';
            return (
              <Animated.View key={order.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('OrderTracking', { orderId: order.id, order })} style={st.card}>
                  {/* badges row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={st.orderLabel}>Order</Text>
                    <Text style={st.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                    <View style={[st.badge, { backgroundColor: sc.bg }]}><Text style={[st.badgeText, { color: sc.fg }]}>{statusKey}</Text></View>
                    <View style={[st.badge, { backgroundColor: paid ? '#d1fae5' : '#fef3c7' }]}>
                      <Text style={[st.badgeText, { color: paid ? '#065f46' : '#92400e' }]}>{paid ? 'Paid' : (order.payment_status || 'Pending payment')}</Text>
                    </View>
                  </View>
                  {/* meta row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    <View style={st.metaItem}><Ionicons name="time-outline" size={12} color={colors.textMuted} /><Text style={st.metaText}>{formatDate(order.created_at)}</Text></View>
                    {order.shop_name ? <View style={st.metaItem}><Ionicons name="cube-outline" size={12} color={colors.textMuted} /><Text style={st.metaText}>{order.shop_name}</Text></View> : null}
                    {order.shipping_address?.city ? <View style={st.metaItem}><Ionicons name="location-outline" size={12} color={colors.textMuted} /><Text style={st.metaText}>{order.shipping_address.city}</Text></View> : null}
                  </View>
                  {/* items preview */}
                  {Array.isArray(order.items) && order.items.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginTop: 10 }}>
                      {order.items.slice(0, 4).map((it, i) => (
                        <View key={i} style={st.itemChip}>
                          {it.product_image ? (
                            <Image source={{ uri: img(it.product_image) }} style={st.itemImg} />
                          ) : (
                            <View style={[st.itemImg, { backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="cube" size={12} color="#059669" />
                            </View>
                          )}
                          <Text style={st.itemName} numberOfLines={1}>{it.product_name || 'Item'}</Text>
                          <Text style={st.itemQty}>× {it.quantity}</Text>
                        </View>
                      ))}
                      {order.items.length > 4 && <Text style={[st.metaText, { alignSelf: 'center' }]}>+{order.items.length - 4} more</Text>}
                    </ScrollView>
                  )}
                  {/* total + track */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 }}>
                    <View>
                      <Text style={st.totalKey}>Total</Text>
                      <Text style={st.totalVal}>${Number(order.total_amount || 0).toFixed(2)}</Text>
                    </View>
                    <PressScale onPress={() => navigation.navigate('OrderTracking', { orderId: order.id, order })}>
                      <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.trackBtn} testID={`track-order-btn-${order.id}`}>
                        <Ionicons name="car" size={13} color={colors.white} />
                        <Text style={st.trackText}>Track Order</Text>
                        <Ionicons name="chevron-forward" size={13} color={colors.white} />
                      </LinearGradient>
                    </PressScale>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          {revealingOrders && <SkeletonRows count={2} height={120} style={{ paddingHorizontal: 0 }} />}
        </View>
      )}
    </ShopScreenWrap>
  );
}

const st = StyleSheet.create({
  headIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  shopMore: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#059669', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadow.card },
  shopMoreText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  filters: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 12, gap: 9, ...shadow.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, paddingVertical: 40, paddingHorizontal: 20, marginTop: 12 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow.card },
  orderLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  orderId: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, letterSpacing: 0.3 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2.5 },
  badgeText: { fontFamily: fonts.bold, fontSize: 9.5, textTransform: 'capitalize' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  itemChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 6, maxWidth: 180 },
  itemImg: { width: 26, height: 26, borderRadius: 6 },
  itemName: { fontFamily: fonts.medium, fontSize: 11, color: colors.text, flexShrink: 1 },
  itemQty: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  totalKey: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  totalVal: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.4 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadow.card },
  trackText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
});
