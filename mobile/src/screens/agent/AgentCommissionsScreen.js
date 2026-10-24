import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, CountUp, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero } from '../../components/agent/AgentKit';

export default function AgentCommissionsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommissions = useCallback(async () => {
    try { const r = await api.agent.commissions(); setItems(r.data?.commissions || []); }
    catch { toast.error('Failed to load commissions'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchCommissions(); setRefreshing(false); }, [fetchCommissions]);

  const total = items.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  if (loading) {
    return <View style={st.center}><Spinner size={36} color="#f59e0b" /></View>;
  }

  return (
    <AgentScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Hero — amber-500 -> orange-500 -> rose-500 with counting totals bar */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.commissionsHero} tag="Commissions" tagIcon="receipt"
          title="Order Commissions"
          sub="All commissions earned from orders of your referred shops.">
          <View style={st.totalBar}>
            <Text style={st.totalText}>Total: </Text>
            <CountUp value={total} prefix="$" decimals={2} style={st.totalValue} />
            <Text style={st.totalText}> across </Text>
            <Text style={st.totalValue}>{items.length}</Text>
            <Text style={st.totalText}> orders</Text>
          </View>
        </AgentHero>
      </Rise>

      {/* Receipt cards — paper-feed printing top-down */}
      {items.length === 0 ? (
        <Rise delay={140}>
          <View style={[st.card, { alignItems: 'center', paddingVertical: 36 }]}>
            <Ionicons name="receipt-outline" size={40} color={colors.border} />
            <Text style={st.emptyText}>No commissions yet. You earn when orders from your referred shops are paid.</Text>
          </View>
        </Rise>
      ) : (
        <View style={{ gap: 10, marginTop: 14 }}>
          {items.map((t, i) => {
            const paid = t.order?.payment_status === 'paid';
            return (
              <Rise key={t.id || i} delay={Math.min(800, 120 + i * 90)} distance={16}>
                <View style={st.receipt}>
                  {/* top row: order ref + date */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={st.orderRef}>#{(t.order_id || '').slice(0, 8)}</Text>
                    <Text style={st.date}>{(t.created_at || '').slice(0, 10)}</Text>
                  </View>
                  {/* shop + status chip */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                      <Ionicons name="storefront" size={13} color={colors.textMuted} />
                      <Text style={st.shopName} numberOfLines={1}>{t.shop_name || '—'}</Text>
                    </View>
                    <View style={[st.statusChip, paid ? st.statusPaid : st.statusOther]}>
                      <Text style={[st.statusText, { color: paid ? '#047857' : '#475569' }]}>{t.order?.payment_status || '—'}</Text>
                    </View>
                  </View>
                  {/* perforated divider */}
                  <View style={st.perforation}>
                    {Array.from({ length: 24 }, (_, d) => <View key={d} style={st.perfDot} />)}
                  </View>
                  {/* money rows */}
                  <View style={st.moneyRow}>
                    <Text style={st.moneyKey}>Order Total</Text>
                    <Text style={st.moneyVal}>${Number(t.order?.total_amount || 0).toFixed(2)}</Text>
                  </View>
                  <View style={st.moneyRow}>
                    <Text style={st.moneyKey}>Admin Commission</Text>
                    <Text style={st.moneyVal}>${Number(t.order?.commission_amount || 0).toFixed(2)}</Text>
                  </View>
                  <View style={[st.moneyRow, { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 8, marginTop: 3 }]}>
                    <Text style={[st.moneyKey, { fontFamily: fonts.bold, color: colors.ink }]}>Your Earning</Text>
                    <Text style={st.earning}>+${Number(t.amount || 0).toFixed(2)}</Text>
                  </View>
                </View>
              </Rise>
            );
          })}
        </View>
      )}
    </AgentScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.bg },
  totalBar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9, marginTop: 14 },
  totalText: { color: colors.white, fontFamily: fonts.body, fontSize: 12.5 },
  totalValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 13.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 15, marginTop: 14, ...shadow.card },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  receipt: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow.card },
  orderRef: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, letterSpacing: 0.4 },
  date: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  shopName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, flexShrink: 1 },
  statusChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusPaid: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
  statusOther: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  statusText: { fontFamily: fonts.semibold, fontSize: 10, textTransform: 'capitalize' },
  perforation: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  perfDot: { width: 5, height: 1.5, borderRadius: 1, backgroundColor: colors.border },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  moneyKey: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  moneyVal: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  earning: { fontFamily: fonts.extrabold, fontSize: 15, color: '#047857' },
});
