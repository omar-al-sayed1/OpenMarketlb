import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { StatusPill, AdminCard } from './AdminKit';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const orderVariant = (s) => (s === 'delivered' ? 'emerald' : s === 'paid' || s === 'processing' ? 'blue' : s === 'cancelled' ? 'rose' : 'amber');
const variantLine = (it) => [it.selected_color, it.selected_size, it.selected_shape, it.selected_type].filter(Boolean).join(' · ');

/** Admin: read-only detail view for a single order. Opened from the shop's Orders tab. */
export default function AdminOrderDetail({ orderId, orderSummary, onClose }) {
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState(orderSummary || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.admin.getOrderDetails(orderId)
      .then(({ data }) => { if (alive) setOrder(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orderId]);

  const cust = order?.delivery_info?.to_customer;
  const items = order?.items || [];
  const subtotal = items.reduce((s, it) => s + (it.subtotal ?? (it.price || 0) * (it.quantity || 1)), 0);
  const delivery = order?.delivery_fee ?? order?.shipping_fee ?? 0;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 6 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn} hitSlop={8}><Ionicons name="close" size={22} color={colors.white} /></TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.hTitle} numberOfLines={1}>Order #{String(orderId).slice(0, 8)}</Text>
              <Text style={styles.hSub}>{order?.created_at ? new Date(order.created_at).toLocaleString() : ''}</Text>
            </View>
            {order?.order_status ? <StatusPill label={order.order_status} variant={orderVariant(order.order_status)} /> : null}
          </View>
        </LinearGradient>

        {loading && !order ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
            {cust ? (
              <AdminCard title="Customer" icon="person">
                <Line icon="person-outline" text={cust.name || 'Guest'} />
                <Line icon="call-outline" text={cust.phone || 'Not provided'} />
                <Line icon="mail-outline" text={cust.email || 'Not provided'} />
                <Line icon="location-outline" text={[cust.address, cust.city, cust.state].filter(Boolean).join(', ') || 'Not provided'} />
              </AdminCard>
            ) : null}

            <AdminCard title={`Items (${items.length})`} icon="cube">
              {items.length === 0 ? <Text style={styles.muted}>No items</Text> : items.map((it, i) => (
                <View key={it.product_id || i} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                  <Image source={{ uri: img(it.image || it.images?.[0]) }} style={styles.itemImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{it.name || it.product_name}</Text>
                    {variantLine(it) ? <Text style={styles.itemVariant}>{variantLine(it)}</Text> : null}
                    <Text style={styles.itemMeta}>Qty {it.quantity || 1} × {money(it.price)}</Text>
                  </View>
                  <Text style={styles.itemSub}>{money(it.subtotal ?? (it.price || 0) * (it.quantity || 1))}</Text>
                </View>
              ))}
            </AdminCard>

            <AdminCard title="Payment" icon="card">
              <KV label="Method"><Text style={styles.kvVal}>{order?.payment_method === 'card' ? 'Card' : order?.payment_method === 'wallet' ? 'Wallet' : 'Cash on Delivery'}</Text></KV>
              <KV label="Payment status"><StatusPill label={order?.payment_status || 'pending'} variant={order?.payment_status === 'paid' ? 'emerald' : 'amber'} /></KV>
              <KV label="Subtotal"><Text style={styles.kvVal}>{money(subtotal)}</Text></KV>
              {delivery ? <KV label="Delivery"><Text style={styles.kvVal}>{money(delivery)}</Text></KV> : null}
              <KV label="Total"><Text style={styles.kvTotal}>{money(order?.total_amount ?? subtotal + delivery)}</Text></KV>
            </AdminCard>

            {Array.isArray(order?.delivery_info?.from_shops) && order.delivery_info.from_shops.length > 0 ? (
              <AdminCard title="Fulfilled by" icon="storefront">
                {order.delivery_info.from_shops.map((s) => (
                  <View key={s.shop_id} style={styles.shopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{s.shop_name}</Text>
                      <Text style={styles.itemMeta}>{[s.shop_state, s.shop_address].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Text style={styles.itemSub}>{money(s.items_subtotal)}</Text>
                  </View>
                ))}
              </AdminCard>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Line({ icon, text }) { return <View style={styles.line}><Ionicons name={icon} size={14} color={colors.textMuted} /><Text style={styles.lineText} numberOfLines={2}>{text}</Text></View>; }
function KV({ label, children }) { return <View style={styles.kv}><Text style={styles.kvLabel}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  hBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  hSub: { fontFamily: fonts.body, fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  lineText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemImg: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.bgAlt },
  itemName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  itemVariant: { fontFamily: fonts.body, fontSize: 11, color: colors.violet, marginTop: 1 },
  itemMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  itemSub: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  kvLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  kvVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  kvTotal: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryDarker },
});
