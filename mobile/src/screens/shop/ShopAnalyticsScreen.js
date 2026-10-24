import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { api } from '../../lib/api';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Float, CountUp, Spinner } from '../../components/shop/ShopKit';

const W = Dimensions.get('window').width;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#f59e0b', '#3b82f6', colors.p450, '#10b981', '#06b6d4', '#22c55e', '#ef4444'];

/* chart card shell */
function ChartCard({ icon, tint, title, children, empty, emptyIcon, testID, delay = 0 }) {
  return (
    <Rise delay={delay}>
      <View style={st.chartCard} testID={testID}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <Ionicons name={icon} size={17} color={tint} />
          <Text style={st.chartTitle}>{title}</Text>
        </View>
        {empty ? (
          <View style={st.chartEmpty}>
            <Ionicons name={emptyIcon || icon} size={40} color={colors.borderLight} />
            <Text style={st.chartEmptyText}>{empty}</Text>
          </View>
        ) : children}
      </View>
    </Rise>
  );
}

export default function ShopAnalyticsScreen() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawKey, setDrawKey] = useState(0); // charts redraw on pull-to-refresh

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await api.shop.getAnalytics();
      setAnalytics(data);
    } catch (error) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setDrawKey(k => k + 1); // charts draw themselves again
    setRefreshing(false);
  }, [fetchAnalytics]);

  /* ---- transforms — ported verbatim ---- */
  const getMonthlyChartData = () => {
    if (!analytics?.monthly_revenue) return [];
    return Object.entries(analytics.monthly_revenue)
      .map(([month, revenue]) => {
        const [year, monthNum] = month.split('-');
        return { month: `${MONTH_NAMES[parseInt(monthNum, 10) - 1]} ${year}`, short: MONTH_NAMES[parseInt(monthNum, 10) - 1], revenue: parseFloat(revenue.toFixed(2)), fullMonth: month };
      })
      .sort((a, b) => a.fullMonth.localeCompare(b.fullMonth))
      .slice(-12);
  };
  const monthlyData = getMonthlyChartData();

  const getOrderStatusData = () => {
    if (!analytics?.order_status_breakdown) {
      const statuses = ['pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled'];
      return statuses.map(s => ({ name: s.charAt(0).toUpperCase() + s.slice(1), value: analytics?.[`${s}_orders`] || 0 })).filter(s => s.value > 0);
    }
    return Object.entries(analytics.order_status_breakdown)
      .map(([status, count]) => ({ name: status.charAt(0).toUpperCase() + status.slice(1), value: count }))
      .filter(s => s.value > 0);
  };
  const getMonthlyOrdersData = () => {
    if (!analytics?.monthly_orders) {
      return monthlyData.map(d => ({ ...d, orders: Math.max(1, Math.round(d.revenue / (analytics?.total_orders > 0 ? analytics.total_revenue / analytics.total_orders : 50))) }));
    }
    return Object.entries(analytics.monthly_orders)
      .map(([month, count]) => {
        const [year, monthNum] = month.split('-');
        return { month: `${MONTH_NAMES[parseInt(monthNum, 10) - 1]} ${year}`, short: MONTH_NAMES[parseInt(monthNum, 10) - 1], orders: count, fullMonth: month };
      })
      .sort((a, b) => a.fullMonth.localeCompare(b.fullMonth))
      .slice(-12);
  };
  const orderStatusData = getOrderStatusData();
  const monthlyOrdersData = getMonthlyOrdersData();

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#059669" /></View>;
  }

  const chartW = W - 110;
  const barData = monthlyData.map(d => ({ value: d.revenue, label: d.short, frontColor: '#10b981', labelTextStyle: { color: colors.textMuted, fontSize: 8 } }));
  const areaData = monthlyData.map(d => ({ value: d.revenue, label: d.short }));
  const ordersLine = monthlyOrdersData.map(d => ({ value: d.orders, label: d.short }));
  const pieData = orderStatusData.map((s, i) => ({ value: s.value, color: PIE_COLORS[i % PIE_COLORS.length], text: String(s.value) }));

  const stats = [
    { label: 'Total Revenue', value: Number(analytics?.total_revenue || 0), prefix: '$', decimals: 2, icon: 'logo-usd', soft: '#d1fae5', tint: '#059669', testID: 'stat-total-revenue' },
    { label: 'Total Orders', value: analytics?.total_orders || 0, icon: 'cart', soft: '#dbeafe', tint: '#2563eb', testID: 'stat-total-orders' },
    { label: 'Products', value: analytics?.products_count || 0, icon: 'cube', soft: colors.p100, tint: colors.p600, testID: 'stat-products' },
    { label: 'Avg Order Value', value: analytics?.total_orders > 0 ? analytics.total_revenue / analytics.total_orders : 0, prefix: '$', decimals: 2, icon: 'trending-up', soft: '#ffedd5', tint: '#ea580c', testID: 'stat-avg-order' },
  ];

  return (
    <ShopScreenWrap wash={shop.washAnalytics} refreshing={refreshing} onRefresh={onRefresh} testID="shop-analytics-content">
      {/* Header hero — blue-500 -> indigo-500 tile on the blue wash */}
      <Rise duration={500} distance={0}>
        <View style={st.headerCard}>
          <Float style={{ position: 'absolute', top: '30%', right: '25%' }} dur={4000}><View style={st.particle} /></Float>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <LinearGradient colors={['#3b82f6', colors.s600]} style={st.headerIcon}><Ionicons name="trending-up" size={22} color={colors.white} /></LinearGradient>
            <View>
              <Text style={st.headerTitle} testID="shop-analytics-title">Analytics</Text>
              <Text style={st.headerSub}>Performance insights and revenue trends</Text>
            </View>
          </View>
        </View>
      </Rise>

      {/* Stat cards — count-up */}
      <View style={st.statsGrid}>
        {stats.map((s, i) => (
          <Rise key={s.label} delay={80 + i * 70} style={st.statWrap}>
            <View style={st.stat} testID={s.testID}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.statLabel}>{s.label}</Text>
                  <CountUp key={`s-${i}-${drawKey}`} value={s.value} prefix={s.prefix || ''} decimals={s.decimals || 0} style={[st.statValue, { color: s.tint }]} />
                </View>
                <View style={[st.statIcon, { backgroundColor: s.soft }]}><Ionicons name={s.icon} size={17} color={s.tint} /></View>
              </View>
            </View>
          </Rise>
        ))}
      </View>

      {/* Monthly Revenue — bar */}
      <ChartCard icon="bar-chart" tint="#059669" title="Monthly Revenue" delay={200} testID="monthly-revenue-chart"
        empty={monthlyData.length === 0 ? 'No revenue data yet' : null}>
        <BarChart
          key={`bar-${drawKey}`}
          data={barData} width={chartW} height={190} barWidth={Math.max(12, chartW / (barData.length * 2))}
          barBorderTopLeftRadius={4} barBorderTopRightRadius={4} spacing={10}
          yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }} yAxisLabelPrefix="$"
          yAxisColor="transparent" xAxisColor={colors.border} rulesColor={colors.borderLight} rulesType="dashed"
          noOfSections={4} isAnimated animationDuration={800}
        />
      </ChartCard>

      {/* Revenue Trend — area */}
      <ChartCard icon="trending-up" tint="#2563eb" title="Revenue Trend" delay={260} testID="revenue-trend-chart"
        empty={monthlyData.length === 0 ? 'No trend data yet' : null}>
        <LineChart
          key={`area-${drawKey}`}
          areaChart data={areaData} width={chartW} height={190} spacing={Math.max(28, chartW / Math.max(1, areaData.length))}
          color="#3b82f6" startFillColor="#3b82f6" endFillColor="#ffffff" startOpacity={0.3} endOpacity={0.02}
          thickness={2.5} curved hideDataPoints={false} dataPointsColor="#2563eb" dataPointsRadius={3}
          yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }} xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 8 }}
          yAxisLabelPrefix="$" yAxisColor="transparent" xAxisColor={colors.border} rulesColor={colors.borderLight} rulesType="dashed"
          noOfSections={4} isAnimated animationDuration={900}
        />
      </ChartCard>

      {/* Order Status Distribution — donut + legend */}
      <ChartCard icon="pie-chart" tint={colors.p500} title="Order Status Distribution" delay={320} testID="order-status-chart"
        empty={orderStatusData.length === 0 ? 'No order data yet' : null}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <PieChart key={`pie-${drawKey}`} data={pieData} donut radius={80} innerRadius={48} strokeWidth={3} strokeColor={colors.white} isAnimated />
          <View style={{ flex: 1, gap: 7 }}>
            {orderStatusData.map((entry, index) => (
              <View key={entry.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <Text style={st.legendName}>{entry.name}</Text>
                <Text style={st.legendVal}>{entry.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ChartCard>

      {/* Orders Over Time — line */}
      <ChartCard icon="pulse" tint="#ea580c" title="Orders Over Time" delay={380} testID="orders-over-time-chart"
        empty={monthlyOrdersData.length === 0 ? 'No order history yet' : null}>
        <LineChart
          key={`line-${drawKey}`}
          data={ordersLine} width={chartW} height={190} spacing={Math.max(28, chartW / Math.max(1, ordersLine.length))}
          color="#f59e0b" thickness={2.5} curved
          hideDataPoints={false} dataPointsColor="#f59e0b" dataPointsRadius={4}
          yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }} xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 8 }}
          yAxisColor="transparent" xAxisColor={colors.border} rulesColor={colors.borderLight} rulesType="dashed"
          noOfSections={4} isAnimated animationDuration={900}
        />
      </ChartCard>

      {/* Monthly Breakdown table */}
      {monthlyData.length > 0 && (
        <ChartCard icon="logo-usd" tint="#059669" title="Monthly Breakdown" delay={440} testID="monthly-breakdown">
          <View style={st.tableHead}>
            <Text style={st.thMonth}>Month</Text>
            <Text style={st.thRevenue}>Revenue</Text>
          </View>
          {monthlyData.slice().reverse().map((item, index) => (
            <View key={item.fullMonth} style={[st.tableRow, index % 2 === 0 && { backgroundColor: colors.surfaceMuted }]}>
              <Text style={st.tdMonth}>{item.month}</Text>
              <Text style={st.tdRevenue}>${item.revenue.toFixed(2)}</Text>
            </View>
          ))}
        </ChartCard>
      )}
    </ShopScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 17, overflow: 'hidden', ...shadow.card },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#93c5fd', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  particle: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(147,197,253,0.6)' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 13, ...shadow.card },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textSecondary },
  statValue: { fontFamily: fonts.extrabold, fontSize: 21, marginTop: 2, letterSpacing: -0.4 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chartCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 15, marginTop: 14, ...shadow.card },
  chartTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  chartEmpty: { height: 190, alignItems: 'center', justifyContent: 'center', gap: 8 },
  chartEmptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  legendName: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  legendVal: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 9, paddingHorizontal: 10 },
  thMonth: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  thRevenue: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm },
  tdMonth: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.text },
  tdRevenue: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#059669' },
});
