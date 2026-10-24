import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero } from '../../components/agent/AgentKit';

const { width: W } = Dimensions.get('window');
const METHOD_LABELS = { cash: 'Cash', whish: 'Wish Money', omt: 'OMT' };
const methodLabel = (m) => METHOD_LABELS[m] || m || 'Cash';
const METHODS = [
  { v: 'cash', l: 'Cash', icon: 'cash' },
  { v: 'whish', l: 'Wish Money', icon: 'phone-portrait' },
  { v: 'omt', l: 'OMT', icon: 'phone-portrait' },
];

/* paper-plane that flies off across the screen on submit */
function PaperPlane({ trigger }) {
  const a = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setVisible(false));
    }
  }, [trigger]); // eslint-disable-line
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 99 }]}>
      <Animated.View style={{
        position: 'absolute', top: '45%', left: 40,
        opacity: a.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, W] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
          { rotate: '-20deg' },
          { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.8, 1.25, 0.9] }) },
        ],
      }}>
        <Ionicons name="paper-plane" size={40} color="#db2777" />
      </Animated.View>
    </View>
  );
}

/* submit button whose ring charges up while saving */
function ChargingSubmit({ onPress, saving, disabled }) {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (saving) {
      ring.setValue(0);
      Animated.loop(Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })).start();
    } else { ring.stopAnimation(); ring.setValue(0); }
  }, [saving, ring]);
  return (
    <PressScale onPress={onPress} disabled={disabled}>
      <LinearGradient colors={['#f06a92', '#db2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.submitBtn, disabled && { opacity: 0.6 }]}>
        {saving ? (
          <Animated.View style={{ transform: [{ rotate: ring.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Ionicons name="sync" size={16} color={colors.white} />
          </Animated.View>
        ) : <Ionicons name="paper-plane" size={16} color={colors.white} />}
        <Text style={st.submitText}>{saving ? 'Submitting…' : 'Submit Request'}</Text>
      </LinearGradient>
    </PressScale>
  );
}

export default function AgentCashoutScreen({ navigation }) {
  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ amount: '', method: 'cash', method_number: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plane, setPlane] = useState(0);
  const [flashId, setFlashId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([api.agent.wallet(), api.agent.myCashouts()]);
      setBalance(w.data?.balance || 0);
      setRequests(r.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const submit = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (amt > balance) return toast.error(`Insufficient balance ($${balance.toFixed(2)})`);
    if ((form.method === 'whish' || form.method === 'omt') && !form.method_number.trim()) {
      return toast.error('Enter the phone number for Wish Money / OMT');
    }
    setSaving(true);
    try {
      await api.agent.cashoutRequest({ amount: amt, method: form.method, method_number: form.method_number.trim(), note: form.note });
      setPlane(k => k + 1);
      notifySuccess();
      toast.success('Cash-out request submitted!');
      setForm({ amount: '', method: 'cash', method_number: '', note: '' });
      await load();
      // flash the newest request row
      setTimeout(() => {
        setRequests(prev => { if (prev[0]) setFlashId(prev[0].id); return prev; });
        setTimeout(() => setFlashId(null), 1200);
      }, 250);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const disabled = saving || !form.amount || Number(form.amount) <= 0;

  return (
    <>
    <AgentScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Hero — fuchsia-600 -> pink-600 -> rose-600 */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.cashoutHero} tag="Cash-out" tagIcon="cash"
          title="Request a Cash-out"
          sub="Submit a withdrawal request — admin will review and pay out manually.">
          <View style={st.availRow}>
            <Text style={st.availLabel}>Available</Text>
            <CountUp value={Number(balance || 0)} prefix="$" decimals={2} style={st.availValue} />
          </View>
        </AgentHero>
      </Rise>

      {/* Request form */}
      <Rise delay={100}>
        <View style={st.card}>
          {/* amount + MAX chip */}
          <Text style={st.label}>Amount ($) *</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput value={form.amount} onChangeText={(t) => setForm(f => ({ ...f, amount: t }))} keyboardType="decimal-pad"
              placeholder="e.g. 25.00" placeholderTextColor={colors.textMuted} style={[st.input, { flex: 1 }]} testID="agent-cashout-amount" />
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, amount: String(balance.toFixed(2)) }))} style={st.maxChip}>
              <Text style={st.maxChipText}>MAX</Text>
            </TouchableOpacity>
          </View>

          {/* method chips */}
          <Text style={[st.label, { marginTop: 12 }]}>Method</Text>
          <View style={{ flexDirection: 'row', gap: 7 }} testID="agent-cashout-method">
            {METHODS.map(m => {
              const on = form.method === m.v;
              return (
                <TouchableOpacity key={m.v} onPress={() => setForm(f => ({ ...f, method: m.v, method_number: m.v === 'cash' ? '' : f.method_number }))}
                  style={[st.methodChip, on && { backgroundColor: '#f06a92', borderColor: '#f06a92' }]}>
                  <Ionicons name={m.icon} size={13} color={on ? colors.white : colors.textSecondary} />
                  <Text style={[st.methodText, on && { color: colors.white }]}>{m.l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(form.method === 'whish' || form.method === 'omt') && (
            <>
              <Text style={[st.label, { marginTop: 12 }]}>{form.method === 'whish' ? 'Wish Money' : 'OMT'} Number *</Text>
              <TextInput value={form.method_number} onChangeText={(t) => setForm(f => ({ ...f, method_number: t }))} keyboardType="phone-pad"
                placeholder="e.g. 70 123 456" placeholderTextColor={colors.textMuted} style={st.input} testID="agent-cashout-number" />
            </>
          )}

          <Text style={[st.label, { marginTop: 12 }]}>Note</Text>
          <TextInput value={form.note} onChangeText={(t) => setForm(f => ({ ...f, note: t }))}
            placeholder="Optional details" placeholderTextColor={colors.textMuted} style={st.input} testID="agent-cashout-note" />

          <View style={{ marginTop: 16 }}>
            <View testID="agent-cashout-submit">
              <ChargingSubmit onPress={submit} saving={saving} disabled={disabled} />
            </View>
          </View>
        </View>
      </Rise>

      {/* My cash-out requests */}
      <Rise delay={180}>
        <View style={[st.card, { marginTop: 14 }]}>
          <Text style={st.cardTitle}>My Cash-out Requests</Text>
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}><Spinner size={22} color="#f06a92" /></View>
          ) : requests.length === 0 ? (
            <Text style={st.emptyText}>No cash-out requests yet.</Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {requests.map((r, i) => {
                const paid = r.status === 'approved';
                const rejected = r.status === 'rejected';
                return (
                  <Rise key={r.id || i} delay={flashId === r.id ? 0 : Math.min(600, i * 70)} distance={flashId === r.id ? 24 : 12}>
                    <View style={[st.reqRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }, flashId === r.id && st.reqFlash]}>
                      <View style={st.reqIcon}><Ionicons name="wallet" size={15} color="#f06a92" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.reqAmount}>${Number(r.amount).toFixed(2)} via {methodLabel(r.method)}{r.method_number ? ` (${r.method_number})` : ''}</Text>
                        {r.note ? <Text style={st.reqNote} numberOfLines={1}>{r.note}</Text> : null}
                        <Text style={st.reqDate}>{(r.created_at || '').slice(0, 19).replace('T', ' ')}</Text>
                      </View>
                      <View style={[st.statusPill, paid ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' } : rejected ? { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' } : { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                        <Text style={[st.statusText, { color: paid ? '#047857' : rejected ? '#be123c' : '#b45309' }]}>{r.status}</Text>
                      </View>
                    </View>
                  </Rise>
                );
              })}
            </View>
          )}
        </View>
      </Rise>
    </AgentScreenWrap>
    <PaperPlane trigger={plane} />
    </>
  );
}

const st = StyleSheet.create({
  availRow: { alignSelf: 'flex-start', alignItems: 'flex-start', marginTop: 14 },
  availLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12 },
  availValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -0.5, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 15, marginTop: 14, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, backgroundColor: colors.surface },
  maxChip: { backgroundColor: '#fae8ff', borderWidth: 1, borderColor: '#ffd6de', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
  maxChipText: { fontFamily: fonts.extrabold, fontSize: 12, color: '#be3a5c' },
  methodChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9 },
  methodText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  submitBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...agent.fuchsiaGlow },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderRadius: radius.md },
  reqFlash: { backgroundColor: '#fff0f3', paddingHorizontal: 8 },
  reqIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff0f3', alignItems: 'center', justifyContent: 'center' },
  reqAmount: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  reqNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  reqDate: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 1 },
  statusPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: fonts.semibold, fontSize: 10, textTransform: 'capitalize' },
});
