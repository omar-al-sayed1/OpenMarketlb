import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero } from '../../components/agent/AgentKit';

/* floating wallet illustration for the empty state */
function FloatingWallet() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a]);
  return (
    <Animated.View style={{ transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }], alignItems: 'center' }}>
      <View style={st.emptyWallet}><Ionicons name="wallet" size={34} color="#10b981" /></View>
      <View style={st.emptyShadow} />
    </Animated.View>
  );
}

export default function AgentWalletScreen({ navigation }) {
  const [data, setData] = useState({ balance: 0, transactions: [], agent_name: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = useCallback(async () => {
    try { const r = await api.agent.wallet(); setData(r.data); }
    catch { toast.error('Failed to load wallet'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchWallet(); }, [fetchWallet]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchWallet(); setRefreshing(false); }, [fetchWallet]);

  if (loading) {
    return <View style={st.center}><Spinner size={36} color="#10b981" /></View>;
  }

  return (
    <AgentScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Balance hero — emerald-500 -> teal-500 -> cyan-600, odometer amount */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.walletHero} tag="My Wallet" tagIcon="wallet">
          <Text style={st.balanceKicker}>Available Balance</Text>
          <CountUp value={Number(data.balance || 0)} prefix="$" decimals={2} style={st.balanceValue} />
          <PressScale onPress={() => navigation.navigate('AgentCashout')} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <View style={st.cashoutBtn} testID="agent-cashout-cta">
              <Ionicons name="cash" size={15} color="#047857" />
              <Text style={st.cashoutText}>Request Cash-out</Text>
            </View>
          </PressScale>
        </AgentHero>
      </Rise>

      {/* Ledger — signed rows sliding in like a bank statement */}
      <Rise delay={120}>
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={st.cardTitle}>All Transactions</Text>
            <Text style={st.entries}>{data.transactions.length} entries</Text>
          </View>
          {data.transactions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 34 }}>
              <FloatingWallet />
              <Text style={st.emptyText}>No transactions yet.</Text>
            </View>
          ) : (
            data.transactions.map((t, i) => {
              const positive = Number(t.amount) > 0;
              const typeLabel = (t.type || '').replace(/^agent_/, '').replace(/_/g, ' ');
              return (
                <Rise key={t.id || i} delay={Math.min(700, i * 70)} distance={12}>
                  <View style={[st.txnRow, i < data.transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={[st.typeChip, positive ? st.typeChipIn : st.typeChipOut]}>
                      <Ionicons name={positive ? 'arrow-down' : 'arrow-up'} size={10} color={positive ? '#047857' : '#be123c'} />
                      <Text style={[st.typeChipText, { color: positive ? '#047857' : '#be123c' }]}>{typeLabel}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={st.txnNote} numberOfLines={2}>{t.note}</Text>
                      <Text style={st.txnDate}>{(t.created_at || '').slice(0, 19).replace('T', ' ')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[st.txnAmount, { color: positive ? '#047857' : '#b91c1c' }]}>
                        {positive ? '+' : ''}${Number(t.amount || 0).toFixed(2)}
                      </Text>
                      <Text style={st.balanceAfter}>bal ${Number(t.balance_after || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                </Rise>
              );
            })
          )}
        </View>
      </Rise>
    </AgentScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.bg },
  balanceKicker: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12.5 },
  balanceValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 42, letterSpacing: -1, marginTop: 3 },
  cashoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, ...shadow.emphasis },
  cashoutText: { fontFamily: fonts.bold, fontSize: 13, color: '#047857' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 15, marginTop: 14, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  entries: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  emptyWallet: { width: 70, height: 70, borderRadius: 22, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  emptyShadow: { width: 44, height: 8, borderRadius: 4, backgroundColor: 'rgba(15,23,42,0.07)', marginTop: 10 },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 4, maxWidth: 118 },
  typeChipIn: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
  typeChipOut: { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },
  typeChipText: { fontFamily: fonts.semibold, fontSize: 9.5, textTransform: 'capitalize', flexShrink: 1 },
  txnNote: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  txnDate: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 2 },
  txnAmount: { fontFamily: fonts.extrabold, fontSize: 13.5 },
  balanceAfter: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 2 },
});
