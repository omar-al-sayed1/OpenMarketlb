import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Image, Modal, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { img } from '../lib/media';
import { colors, radius, fonts } from '../theme/theme';
import { StatusPill } from './admin/AdminKit';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const orderVariant = (s) => (s === 'delivered' ? 'emerald' : s === 'paid' || s === 'processing' ? 'blue' : s === 'cancelled' ? 'rose' : 'amber');
const statusOf = (o) => o?.order_status || o?.status || 'pending';

const TAB_META = {
  details: { label: 'Order Details', icon: 'receipt-outline' },
  route: { label: 'Route Details', icon: 'git-branch-outline' },
  map: { label: 'Locations Map', icon: 'map-outline' },
};

/**
 * Full-screen order detail with a Material-style top tab pager, matching the shop
 * detail page. `tabs` selects which of details/route/map to show (shop passes only
 * ['details']). `fetchDetails` loads the full order (with delivery_info) for the
 * route/map tabs; omit it to use the passed-in `order` as-is.
 */
export default function OrderDetailTabs({ visible, order: summary, onClose, tabs = ['details'], fetchDetails, availableDelivery = true, showCommission = false, showShopRevenue = false, detailsFooter = null, renderDetails = null }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef(null);
  const indicator = useSharedValue(0);
  const [tab, setTab] = useState(0);
  const [order, setOrder] = useState(summary || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setOrder(summary || null); setTab(0); indicator.value = 0; }, [summary?.id]); // eslint-disable-line

  // Load full details (delivery_info) when the route/map tabs need it.
  useEffect(() => {
    if (!visible || !summary?.id || !fetchDetails) return;
    let alive = true;
    setLoading(true);
    fetchDetails(summary.id)
      .then(({ data }) => { if (alive && data) setOrder(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, summary?.id]); // eslint-disable-line

  const tabW = (width - 32) / Math.max(tabs.length, 1);
  const goTab = (i) => { pagerRef.current?.scrollTo({ x: i * width, animated: true }); setTab(i); indicator.value = withTiming(i, { duration: 180 }); };
  const onPagerScroll = (e) => { indicator.value = e.nativeEvent.contentOffset.x / width; };
  const onPagerEnd = (e) => { const i = Math.round(e.nativeEvent.contentOffset.x / width); setTab(i); indicator.value = withTiming(i, { duration: 140 }); };
  const indStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicator.value * tabW }] }));

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 6 }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.hBtn} hitSlop={8}><Ionicons name="close" size={22} color={colors.white} /></TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.hTitle} numberOfLines={1}>Order #{String(order?.id || summary?.id || '').slice(0, 8)}</Text>
              <Text style={s.hSub}>{order?.created_at ? new Date(order.created_at).toLocaleString() : ''}</Text>
            </View>
            <StatusPill label={statusOf(order)} variant={orderVariant(statusOf(order))} />
          </View>
          {tabs.length > 1 && (
            <View style={s.tabBar}>
              <Animated.View style={[s.tabIndicator, { width: tabW }, indStyle]} />
              {tabs.map((key, i) => (
                <TouchableOpacity key={key} style={s.tab} onPress={() => goTab(i)} testID={`order-tab-${key}`}>
                  <Ionicons name={TAB_META[key].icon} size={14} color={tab === i ? colors.white : 'rgba(255,255,255,0.7)'} />
                  <Text style={[s.tabText, tab === i && s.tabTextOn]} numberOfLines={1}>{TAB_META[key].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </LinearGradient>

        {loading && !order?.items ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={tabs.length > 1} onScroll={onPagerScroll} scrollEventThrottle={16} onMomentumScrollEnd={onPagerEnd} keyboardShouldPersistTaps="handled">
            {tabs.map((key) => (
              <View key={key} style={{ width }}>
                {key === 'details' && (renderDetails || <DetailsTab order={order} availableDelivery={availableDelivery} showCommission={showCommission} showShopRevenue={showShopRevenue} footer={detailsFooter} bottom={insets.bottom} />)}
                {key === 'route' && <RouteTab order={order} availableDelivery={availableDelivery} bottom={insets.bottom} />}
                {key === 'map' && <MapTab order={order} bottom={insets.bottom} />}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/* ---------------- Order Details ---------------- */
function DetailsTab({ order, availableDelivery, showCommission, showShopRevenue, footer, bottom }) {
  if (!order) return null;
  const itemsTotal = ((order.total_amount || 0) - (order.delivery_fee || 0)) + (order.loyalty_discount_amount || 0);
  return (
    <ScrollView contentContainerStyle={[s.page, { paddingBottom: bottom + 30 }]} showsVerticalScrollIndicator={false}>
      <View style={s.grid}>
        <Field label="Order ID" value={`${String(order.id).slice(0, 18)}…`} mono />
        <Field label="Date" value={order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'} />
      </View>
      <View style={[s.grid, { marginTop: 8 }]}>
        <Field label="Customer" value={order.guest_name || order.customer_name || 'Guest'} />
        <Field label="Shop" value={order.shop_name || '—'} />
      </View>
      <View style={[s.grid, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}><Text style={s.key}>Status</Text><View style={{ marginTop: 3, alignSelf: 'flex-start' }}><StatusPill label={statusOf(order)} variant={orderVariant(statusOf(order))} /></View></View>
        <Field label="Payment" value={order.payment_method === 'card' ? 'Card' : order.payment_method === 'wallet' ? 'Wallet' : 'Cash on Delivery'} />
      </View>

      <Text style={s.sectionTitle}>Order Items</Text>
      <View style={{ gap: 8 }}>
        {(order.items || []).map((it, idx) => (
          <View key={it.product_id || idx} style={s.itemRow}>
            {(it.image || it.product_image || it.images?.[0]) ? <Image source={{ uri: img(it.image || it.product_image || it.images?.[0]) }} style={s.itemImg} /> : <View style={[s.itemImg, s.itemImgFallback]}><Ionicons name="cube" size={17} color={colors.textMuted} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={s.itemName} numberOfLines={1}>{it.name || it.product_name}</Text>
              <View style={s.vChips}>
                {it.selected_color ? <VChip text={`Color: ${it.selected_color}`} bg={colors.p50} fg={colors.p800} /> : null}
                {it.selected_size ? <VChip text={`Size: ${it.selected_size}`} bg="#eff6ff" fg="#1d4ed8" /> : null}
                {it.selected_shape ? <VChip text={`Shape: ${it.selected_shape}`} bg="#fffbeb" fg="#b45309" /> : null}
              </View>
              <Text style={s.itemQty}>Qty: {it.quantity} × {money(it.price)}</Text>
            </View>
            <Text style={s.itemSub}>{money(it.subtotal ?? (it.price || 0) * (it.quantity || 1))}</Text>
          </View>
        ))}
      </View>

      {order.shipping_address && availableDelivery ? (
        <>
          <Text style={s.sectionTitle}>Shipping Address</Text>
          <View style={s.shipBox}>
            <Text style={s.val}>{order.shipping_address.address}</Text>
            <Text style={s.val}>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</Text>
          </View>
        </>
      ) : null}

      <View style={s.totals}>
        <Row k="Items Total:" v={money(itemsTotal)} />
        {order.loyalty_points_redeemed > 0 ? <Row k={`Points Discount (${order.loyalty_points_redeemed} pts):`} v={`-${money(order.loyalty_discount_amount)}`} tint="#d97706" /> : null}
        {availableDelivery ? <Row k="Delivery Fee:" v={money(order.delivery_fee)} /> : null}
        <View style={[s.totalRow, s.totalDivider]}><Text style={s.totalKeyBold}>Customer Paid:</Text><Text style={s.totalBig}>{money(order.total_amount)}</Text></View>
        {showCommission ? (
          <View style={s.revBox}>
            <View style={s.totalRow}><Text style={s.commKey}>Platform Commission:</Text><Text style={s.commVal}>{money(order.commission_amount)}</Text></View>
            <Text style={s.revNote}>Admin earnings from this order</Text>
          </View>
        ) : null}
        {showShopRevenue ? (
          <View style={s.revBox}>
            <View style={s.totalRow}><Text style={s.commKey}>Your Revenue:</Text><Text style={s.commVal}>{money(order.shop_total)}</Text></View>
            <Text style={s.revNote}>After platform commission</Text>
            {order.admin_owes_shop_amount > 0 ? (
              <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: '#a7f3d0', paddingTop: 7, marginTop: 7 }]}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#b45309' }}>Platform owes you (loyalty excess):</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#d97706' }}>+{money(order.admin_owes_shop_amount)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {footer ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
    </ScrollView>
  );
}

/* ---------------- Route Details ---------------- */
function RouteTab({ order, availableDelivery, bottom }) {
  const di = order?.delivery_info;
  const shops = di?.from_shops || [];
  const customer = di?.to_customer || {};
  const itemsSubtotal = ((order?.total_amount || 0) - (order?.delivery_fee || 0) + (order?.loyalty_discount_amount || 0));
  if (!order) return null;
  return (
    <ScrollView contentContainerStyle={[s.page, { paddingBottom: bottom + 30 }]} showsVerticalScrollIndicator={false}>
      <View style={s.grid}>
        <Field label="Order ID" value={`${String(order.id).slice(0, 18)}…`} mono />
        <Field label="Date" value={order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'} />
      </View>

      <Text style={s.routeLabel}>FROM (SHOPS)</Text>
      {shops.length === 0 ? <Text style={s.routeEmpty}>No shop details available</Text> : shops.map((shop, idx) => (
        <View key={idx} style={s.fromCard}>
          <View style={s.fromIcon}><Ionicons name="storefront" size={15} color="#2563eb" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fromName}>{shop.shop_name}</Text>
            {shop.shop_address ? <View style={s.routeRow}><Ionicons name="location-outline" size={12} color="#1d4ed8" /><Text style={s.fromMeta}>{shop.shop_address}</Text></View> : null}
            {shop.shop_state ? <Text style={[s.fromMeta, { marginLeft: 18 }]}>State: <Text style={{ fontFamily: fonts.bold }}>{shop.shop_state}</Text></Text> : null}
            {shop.shop_phone ? <View style={s.routeRow}><Ionicons name="call-outline" size={12} color="#1d4ed8" /><Text style={s.fromMeta}>{shop.shop_phone}</Text></View> : null}
            <Text style={s.fromItems}>{shop.items_count} items • <Text style={{ fontFamily: fonts.bold }}>{money(shop.items_subtotal)}</Text></Text>
          </View>
        </View>
      ))}

      <View style={{ alignItems: 'center', marginVertical: 8 }}><View style={s.arrowChip}><Ionicons name="arrow-down" size={18} color="#64748b" /></View></View>

      <Text style={s.routeLabel}>TO (CUSTOMER)</Text>
      <View style={s.toCard}>
        <View style={s.toIcon}><Ionicons name="mail" size={15} color="#059669" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.toName}>{customer.name || 'Customer'}</Text>
          {customer.email ? <View style={s.routeRow}><Ionicons name="mail-outline" size={12} color="#047857" /><Text style={s.toMeta}>{customer.email}</Text></View> : null}
          {customer.phone ? <View style={s.routeRow}><Ionicons name="call-outline" size={12} color="#047857" /><Text style={s.toMeta}>{customer.phone}</Text></View> : null}
          {customer.address ? <View style={s.routeRow}><Ionicons name="location-outline" size={12} color="#047857" /><Text style={s.toMeta}>{customer.address}</Text></View> : null}
          <Text style={[s.toMeta, { marginLeft: 18 }]}>{customer.city ? `${customer.city}, ` : ''}<Text style={{ fontFamily: fonts.bold }}>{customer.state || ''}</Text>{customer.zip ? ` ${customer.zip}` : ''}</Text>
        </View>
      </View>

      <View style={s.billCard}>
        <View style={s.billHead}><Ionicons name="cash-outline" size={15} color={colors.ink} /><Text style={s.billTitle}>Customer Bill</Text></View>
        <Row k="Items Subtotal:" v={money(itemsSubtotal)} />
        {order.loyalty_points_redeemed > 0 ? <Row k={`Points Redeemed (${order.loyalty_points_redeemed} pts):`} v={`-${money(order.loyalty_discount_amount)}`} tint="#d97706" /> : null}
        {availableDelivery ? <Row k="Delivery Fee:" v={money(order.delivery_fee)} tint="#2563eb" /> : null}
        <View style={[s.totalRow, s.totalDivider]}><Text style={s.totalKeyBold}>Customer Pays:</Text><Text style={[s.totalBig, { color: '#059669' }]}>{money(order.total_amount)}</Text></View>
      </View>
    </ScrollView>
  );
}

/* ---------------- Locations Map ---------------- */
function MapTab({ order, bottom }) {
  const di = order?.delivery_info;
  const shops = (di?.from_shops || []).filter((sh) => sh.shop_latitude && sh.shop_longitude);
  const cust = di?.to_customer?.location;
  const custPt = cust && cust.lat && cust.lng ? { latitude: cust.lat, longitude: cust.lng } : null;

  const points = useMemo(() => {
    const pts = shops.map((sh) => ({ latitude: sh.shop_latitude, longitude: sh.shop_longitude }));
    if (custPt) pts.push(custPt);
    return pts;
  }, [order?.id]); // eslint-disable-line

  const region = useMemo(() => {
    if (points.length === 0) return { latitude: 33.8547, longitude: 35.8623, latitudeDelta: 1.5, longitudeDelta: 1.5 }; // Lebanon
    const lats = points.map((p) => p.latitude), lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.05), longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.05),
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <View style={[s.center, { padding: 30 }]}>
        <Ionicons name="map-outline" size={40} color={colors.textFaint} />
        <Text style={s.mapEmpty}>No location coordinates available for this order.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} provider={PROVIDER_DEFAULT} initialRegion={region}>
        {shops.map((sh, idx) => (
          <Marker key={`shop-${idx}`} coordinate={{ latitude: sh.shop_latitude, longitude: sh.shop_longitude }}
            pinColor={colors.primary} title={sh.shop_name} description={sh.shop_address || sh.shop_state || ''} />
        ))}
        {custPt ? <Marker coordinate={custPt} pinColor={colors.secondary} title={di?.to_customer?.name || 'Customer'} description={di?.to_customer?.address || ''} /> : null}
        {custPt ? shops.map((sh, idx) => (
          <Polyline key={`line-${idx}`} coordinates={[{ latitude: sh.shop_latitude, longitude: sh.shop_longitude }, custPt]} strokeColor={colors.s500} strokeWidth={3} lineDashPattern={[6, 4]} />
        )) : null}
      </MapView>
      <View style={[s.legend, { paddingBottom: bottom + 10 }]}>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.primary }]} /><Text style={s.legendText}>Shop{shops.length > 1 ? 's' : ''}</Text></View>
        {custPt ? <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.secondary }]} /><Text style={s.legendText}>Customer</Text></View> : null}
      </View>
    </View>
  );
}

/* ---------------- small blocks ---------------- */
function Field({ label, value, mono }) { return <View style={{ flex: 1 }}><Text style={s.key}>{label}</Text><Text style={mono ? s.mono : s.val}>{value}</Text></View>; }
function Row({ k, v, tint }) { return <View style={s.totalRow}><Text style={[s.totalKey, tint && { color: tint }]}>{k}</Text><Text style={[s.totalVal, tint && { color: tint }]}>{v}</Text></View>; }
function VChip({ text, bg, fg }) { return <View style={[s.vChip, { backgroundColor: bg }]}><Text style={[s.vChipText, { color: fg }]}>{text}</Text></View>; }

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  hBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  hSub: { fontFamily: fonts.body, fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, position: 'relative', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill, padding: 3 },
  tabIndicator: { position: 'absolute', top: 3, bottom: 3, left: 3, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: radius.pill },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  tabText: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  tabTextOn: { color: colors.white, fontFamily: fonts.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  page: { padding: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  key: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  val: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginTop: 2 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 12, color: colors.text, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 8 },
  itemImg: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.bgAlt },
  itemImgFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  vChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 3 },
  vChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.badge },
  vChipText: { fontSize: 10, fontFamily: fonts.semibold },
  itemQty: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  itemSub: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  shipBox: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, gap: 2 },
  totals: { marginTop: 16, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  totalVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  totalDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 3 },
  totalKeyBold: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  totalBig: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.p500 },
  revBox: { marginTop: 10, backgroundColor: '#ecfdf5', borderRadius: radius.md, padding: 12 },
  commKey: { fontFamily: fonts.bold, fontSize: 13, color: '#047857' },
  commVal: { fontFamily: fonts.extrabold, fontSize: 18, color: '#059669' },
  revNote: { fontFamily: fonts.body, fontSize: 11, color: '#059669', marginTop: 2 },
  routeLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  routeEmpty: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  fromCard: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: radius.md, padding: 12, marginBottom: 8 },
  fromIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  fromName: { fontFamily: fonts.bold, fontSize: 13.5, color: '#1e3a8a' },
  fromMeta: { fontFamily: fonts.body, fontSize: 12, color: '#1d4ed8', flex: 1 },
  fromItems: { fontFamily: fonts.body, fontSize: 11.5, color: '#2563eb', marginTop: 4 },
  arrowChip: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  toCard: { flexDirection: 'row', gap: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, padding: 12 },
  toIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  toName: { fontFamily: fonts.bold, fontSize: 13.5, color: '#064e3b' },
  toMeta: { fontFamily: fonts.body, fontSize: 12, color: '#047857', flex: 1 },
  billCard: { marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  billHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  billTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  mapEmpty: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  legend: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 6, ...(Platform.OS === 'android' ? { elevation: 4 } : { shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink },
});
