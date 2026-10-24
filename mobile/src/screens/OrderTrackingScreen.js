import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Modal, Animated, Platform } from 'react-native';
import { Alert } from '../components/AppDialog';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { StackHeader, Loading, GradientButton } from '../components/ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const STEPS = [
  { key: 'placed', label: 'Order placed', icon: 'receipt', desc: 'We received your order' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle', desc: 'The shop is preparing it' },
  { key: 'shipped', label: 'On the way', icon: 'bicycle', desc: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered', icon: 'home', desc: 'Enjoy your order!' },
];
const STATUS_INDEX = { pending: 0, placed: 0, new: 0, confirmed: 1, processing: 1, preparing: 1, accepted: 1, shipped: 2, out_for_delivery: 2, on_the_way: 2, delivered: 3, completed: 3 };
const num = (v) => (typeof v === 'number' ? v : parseFloat(v));

export default function OrderTrackingScreen({ navigation, route }) {
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(route.params?.order || null);
  const [loading, setLoading] = useState(!route.params?.order);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelStatus, setCancelStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const load = useCallback(() => {
    api.orders.track(orderId).then(({ data }) => setOrder(data?.order || data)).catch(() => {
      api.orders.getById(orderId).then(({ data }) => setOrder(data?.order || data)).catch(() => {});
    }).finally(() => setLoading(false));
    api.orders.getCancelRequestStatus(orderId).then(({ data }) => setCancelStatus(data?.status || data?.cancel_request?.status || null)).catch(() => {});
  }, [orderId]);

  useEffect(() => { if (orderId) load(); }, [orderId, load]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (loading) return <Loading text="Loading your order…" />;
  const o = order || {};
  const status = (o.order_status || o.status || 'pending').toLowerCase();
  const current = o.status === 'cancelled' || status === 'cancelled' ? -1 : (STATUS_INDEX[status] ?? 0);
  const loc = o.customer_location;
  const hasLoc = loc && !isNaN(num(loc.lat)) && !isNaN(num(loc.lng));
  const cancelled = status === 'cancelled';

  const submitCancel = async () => {
    if (!reason.trim()) return Alert.alert('Reason required', 'Please tell us why you want to cancel.');
    setBusy(true);
    try {
      await api.orders.requestCancel(orderId, reason.trim());
      setCancelStatus('pending'); setCancelOpen(false);
      Alert.alert('Request sent', 'Your cancellation request was submitted for review.');
    } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not submit request.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader navigation={navigation} title="Track Order" subtitle={orderId ? `#${String(orderId).slice(0, 8).toUpperCase()}` : ''} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status hero */}
        <LinearGradient colors={cancelled ? gradients.sale : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Ionicons name={cancelled ? 'close-circle' : (STEPS[current]?.icon || 'time')} size={26} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroStatus}>{cancelled ? 'Order cancelled' : (STEPS[current]?.label || 'Processing')}</Text>
            <Text style={styles.heroSub}>{cancelled ? 'This order was cancelled' : (STEPS[current]?.desc || '')}</Text>
          </View>
        </LinearGradient>

        {/* Timeline */}
        {!cancelled && (
          <View style={styles.timeline}>
            {STEPS.map((s, i) => {
              const doneStep = i < current;
              const isCurrent = i === current;
              return (
                <View key={s.key} style={styles.tRow}>
                  <View style={styles.tRail}>
                    <View style={[styles.tDot, (doneStep || isCurrent) && styles.tDotOn]}>
                      {doneStep ? <Ionicons name="checkmark" size={13} color={colors.white} /> : isCurrent ? (
                        <Animated.View style={[styles.tPulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
                      ) : null}
                      {isCurrent ? <View style={styles.tDotInner} /> : null}
                    </View>
                    {i < STEPS.length - 1 && <View style={[styles.tLine, doneStep && { backgroundColor: colors.violet }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 22 }}>
                    <Text style={[styles.tLabel, (doneStep || isCurrent) && { color: colors.ink }]}>{s.label}</Text>
                    <Text style={styles.tDesc}>{s.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Map */}
        {hasLoc && (
          <View style={styles.mapCard}>
            <MapView style={styles.map} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} pointerEvents="none"
              initialRegion={{ latitude: num(loc.lat), longitude: num(loc.lng), latitudeDelta: 0.02, longitudeDelta: 0.02 }}>
              <Marker coordinate={{ latitude: num(loc.lat), longitude: num(loc.lng) }}>
                <LinearGradient colors={gradients.primary} style={styles.mapPin}><Ionicons name="location" size={16} color={colors.white} /></LinearGradient>
              </Marker>
            </MapView>
            <View style={styles.mapLabel}><Ionicons name="location" size={13} color={colors.violet} /><Text style={styles.mapLabelText}>Delivery location</Text></View>
          </View>
        )}

        {/* Cancel */}
        {cancelStatus ? (
          <View style={styles.cancelPending}>
            <Ionicons name="hourglass-outline" size={16} color={colors.amber} />
            <Text style={styles.cancelPendingText}>Cancellation request {cancelStatus}</Text>
          </View>
        ) : (!cancelled && current < 2) ? (
          <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={() => setCancelOpen(true)}>
            <Ionicons name="close-circle-outline" size={17} color={colors.sale} />
            <Text style={styles.cancelBtnText}>Request cancellation</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Cancel modal */}
      <Modal visible={cancelOpen} transparent animationType="slide" onRequestClose={() => setCancelOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setCancelOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Request cancellation</Text>
          <Text style={styles.sheetSub}>Tell us why — the shop will review your request.</Text>
          <TextInput style={styles.reasonInput} placeholder="Reason for cancellation…" placeholderTextColor={colors.textMuted} multiline value={reason} onChangeText={setReason} />
          <GradientButton label="Submit request" icon="send" variant="primary" onPress={submitCancel} loading={busy} style={{ marginTop: 12 }} colorsArr={gradients.sale} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.lg, ...shadow.violetGlow },
  heroStatus: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  timeline: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 18, marginTop: 14, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  tRow: { flexDirection: 'row', gap: 14 },
  tRail: { alignItems: 'center', width: 28 },
  tDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tDotOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  tDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  tPulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.violet },
  tLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border, marginVertical: 2 },
  tLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  tDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  mapCard: { marginTop: 14, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  map: { height: 180 },
  mapPin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  mapLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 10, backgroundColor: colors.surface },
  mapLabelText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  cancelPending: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: '#fffbeb' },
  cancelPendingText: { fontFamily: fonts.semibold, fontSize: 13, color: '#b45309', textTransform: 'capitalize' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 13, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.saleSoft, backgroundColor: '#fff1f2' },
  cancelBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.sale },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  reasonInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, height: 100, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginTop: 14 },
});
