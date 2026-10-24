import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Animated, Easing, Share, Platform, Dimensions, LayoutAnimation, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PieChart, LineChart, BarChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import { api, getAuthToken } from '../../lib/api';
import { API_BASE_URL } from '../../config';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { notifySuccess } from '../../lib/haptics';
import { AdminScreen, AdminHeroCard, AdminStatCard, AdminCard, Shimmer, CountUp } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

const CHART_COLORS = [colors.p450, '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
const CHART_W = Dimensions.get('window').width - 72;
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const monthShort = (key) => new Date(key + '-01').toLocaleDateString('en-US', { month: 'short' });
const monthLong = (key) => new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/* sign-aware currency count-up */
function MoneyCU({ value = 0, style, testID, signed }) {
  const a = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState('$0.00');
  useEffect(() => {
    a.setValue(0);
    const id = a.addListener(({ value: v }) => { const c = v * value; setTxt(`${c < 0 ? '-' : signed ? '+' : ''}$${Math.abs(c).toFixed(2)}`); });
    Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]); // eslint-disable-line
  return <Text style={style} testID={testID}>{txt}</Text>;
}

/* medal chip that slides in sequentially */
const MEDAL = [['#facc15', '#eab308'], ['#cbd5e1', '#94a3b8'], ['#d97706', '#b45309']];
function MedalChip({ i }) {
  const grad = MEDAL[i] || ['#e2e8f0', '#cbd5e1'];
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 400, delay: i * 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []); // eslint-disable-line
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
      <LinearGradient colors={grad} style={styles.medal}><Text style={styles.medalNum}>{i + 1}</Text></LinearGradient>
    </Animated.View>
  );
}

export default function AdminAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonth, setCurrentMonth] = useState({});
  const [totals, setTotals] = useState({});
  const [topShops, setTopShops] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [yearOpen, setYearOpen] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [adjustmentPopup, setAdjustmentPopup] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    const [aRes, adjRes] = await Promise.allSettled([api.admin.getMonthlyAnalytics(), api.admin.getRevenueAdjustments()]);
    if (aRes.status === 'fulfilled') {
      const d = aRes.value.data || {};
      setMonthlyData(d.monthly || {});
      setCurrentMonth(d.current_month || {});
      setTotals(d.totals || {});
      setTopShops(d.top_shops_this_month || []);
    }
    if (adjRes.status === 'fulfilled') {
      setAdjustments(adjRes.value.data?.adjustments || []);
      setTotalAdjustments(adjRes.value.data?.total || 0);
    }
    setLoading(false); setRefreshing(false);
    setChartKey((k) => k + 1);
  }, []);
  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => {
    const ys = [...new Set(Object.keys(monthlyData).map((k) => k.split('-')[0]))].sort().reverse();
    if (!ys.includes(selectedYear)) ys.unshift(selectedYear);
    return ys;
  }, [monthlyData, selectedYear]);

  const yearEntries = useMemo(() => Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)), [monthlyData, selectedYear]);

  const chartData = useMemo(() => yearEntries.slice().sort(([a], [b]) => a.localeCompare(b)).map(([key, d]) => ({
    month: monthShort(key), monthKey: key,
    sales: d.sales || 0, commissions: d.commissions || 0, subscriptions: d.subscriptions || 0,
    adjustments: d.adjustments || 0, platformServices: d.platform_services || 0,
    adminProfit: d.admin_profit ?? d.total_revenue ?? 0, orders: d.orders || 0, avgOrder: d.avg_order_value || 0,
  })), [yearEntries]);

  const sourceData = useMemo(() => [
    { name: 'Commissions', value: totals.commissions || 0, color: colors.p450 },
    { name: 'Subscriptions', value: totals.subscriptions || 0, color: '#10b981' },
    { name: 'Platform Services', value: totals.platform_services || 0, color: colors.s600 },
    ...(totalAdjustments !== 0 ? [{ name: 'Adjustments', value: Math.abs(totalAdjustments), color: totalAdjustments >= 0 ? '#f59e0b' : '#ef4444' }] : []),
    ...(totals.monthly_credits > 0 ? [{ name: 'New Shop + Monthly Credits (−)', value: totals.monthly_credits, color: '#ef4444' }] : []),
  ].filter((d) => d.value > 0), [totals, totalAdjustments]);
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);

  const totalAdminProfit = totals.admin_profit ?? totals.total_revenue ?? 0;
  const monthsDesc = useMemo(() => yearEntries.slice().sort(([a], [b]) => b.localeCompare(a)), [yearEntries]);
  const yearTotals = useMemo(() => yearEntries.reduce((acc, [, d]) => {
    acc.orders += d.orders || 0; acc.sales += d.sales || 0; acc.commissions += d.commissions || 0;
    acc.subscriptions += d.subscriptions || 0; acc.adjustments += d.adjustments || 0; acc.total_revenue += d.total_revenue || 0;
    return acc;
  }, { orders: 0, sales: 0, commissions: 0, subscriptions: 0, adjustments: 0, total_revenue: 0 }), [yearEntries]);

  const cmProfit = currentMonth.admin_profit ?? ((currentMonth.commissions || 0) + (currentMonth.subscriptions || 0) + (currentMonth.adjustments || 0) + (currentMonth.platform_services || 0) - (currentMonth.monthly_credits || 0));

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const dest = FileSystem.cacheDirectory + `openmarketlb_report_${new Date().toISOString().split('T')[0]}.pdf`;
      const { uri, status } = await FileSystem.downloadAsync(`${API_BASE_URL}${api.admin.reportPdfPath}`, dest, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (status !== 200) throw new Error('bad');
      notifySuccess(); toast.success('Report downloaded!');
      try { await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: uri, title: 'OpenMarketlb Report' }); } catch {}
    } catch { toast.error('Failed to download report'); }
    finally { setDownloading(false); }
  };

  const toggleMonth = (key) => { LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)); setExpandedMonth((m) => (m === key ? null : key)); };

  if (loading) {
    return (
      <AdminScreen testID="admin-analytics-page">
        <Shimmer height={80} radius={radius.lg} />
        <View style={styles.kpiRow}>{[0, 1].map((i) => <Shimmer key={i} width="48%" height={96} radius={radius.lg} />)}</View>
        <Shimmer height={130} radius={radius.lg} style={{ marginTop: 12 }} />
        <Shimmer height={240} radius={radius.lg} style={{ marginTop: 12 }} />
      </AdminScreen>
    );
  }

  return (
    <AdminScreen testID="admin-analytics-page" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* ===== HEADER ===== */}
      <AdminHeroCard
        icon="bar-chart" title="Profit Analytics" titleTestID="admin-analytics-title" subtitle="Subscriptions + Commissions + Services − Credits"
        actions={<>
          <TouchableOpacity style={styles.yearPill} activeOpacity={0.8} onPress={() => setYearOpen(true)}>
            <Ionicons name="calendar-outline" size={13} color={colors.violet} /><Text style={styles.yearPillText}>{selectedYear}</Text><Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={downloadReport} disabled={downloading} testID="download-report-btn">
            <LinearGradient colors={[colors.p500, colors.p800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pdfBtn}>
              {downloading ? <Spinner size={14} color={colors.white} /> : <Ionicons name="download-outline" size={14} color={colors.white} />}
              <Text style={styles.pdfBtnText}>{downloading ? 'Generating…' : 'PDF'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>}
      />

      {/* ===== KPI STATS ===== */}
      <View key={`kpi-${selectedYear}`}>
        <View style={styles.kpiRow}>
          <AdminStatCard label="Total Admin Profit" value={totalAdminProfit} prefix="$" decimals={2} icon="cash" variant="emerald" index={0} subtext="Subs + Commissions + Adj + Services − Credits" />
          <AdminStatCard label="Total Platform Sales" value={totals.sales || 0} prefix="$" decimals={2} icon="cart" variant="violet" index={1} subtext={`${totals.orders || 0} orders`} />
        </View>
        <View style={[styles.kpiRow, { marginTop: 10 }]}>
          <AdminStatCard label="Commission Profit" value={totals.commissions || 0} prefix="$" decimals={2} icon="trending-up" variant="blue" index={2} subtext="From product sales" />
          <AdminStatCard label="Subscription Profit" value={totals.subscriptions || 0} prefix="$" decimals={2} icon="card" variant="amber" index={3} subtext="From shop subscriptions" />
        </View>
      </View>

      {/* ===== THIS MONTH ===== */}
      <LinearGradient colors={[colors.p500, colors.p600, colors.s700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cmCard}>
        <View style={styles.cmHead}>
          <Ionicons name="sparkles" size={18} color="#fce883" />
          <Text style={styles.cmTitle}>This Month's Performance</Text>
          <Text style={styles.cmMonth}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <View style={styles.cmGrid}>
          <CmTile icon="cash" label="Profit" value={cmProfit} prefix="$" decimals={2} />
          <CmTile icon="cart" label="Sales" value={currentMonth.sales || 0} prefix="$" decimals={2} />
          <CmTile icon="cube" label="Orders" value={currentMonth.orders || 0} />
          <CmTile icon="pricetag" label="Items Sold" value={currentMonth.items_sold || 0} />
          <CmTile icon="pulse" label="Avg Order" value={currentMonth.avg_order_value || 0} prefix="$" decimals={2} />
        </View>
      </LinearGradient>

      {/* ===== CHARTS ===== */}
      <View key={`ch-${selectedYear}-${chartKey}`}>
        <AdminCard title={`Monthly Profit Trend (${selectedYear})`} icon="trending-up" testID="revenue-trend-chart">
          {chartData.length > 0 ? (
            <View style={{ paddingTop: 8 }}>
              <LineChart areaChart curved isAnimated animationDuration={900}
                data={chartData.map((d) => ({ value: d.sales, label: d.month }))}
                data2={chartData.map((d) => ({ value: d.adminProfit }))}
                color1={colors.p450} color2="#f59e0b" thickness={2.5}
                startFillColor={colors.p450} endFillColor={colors.p450} startOpacity={0.3} endOpacity={0.02}
                width={CHART_W} height={220} spacing={(CHART_W - 30) / Math.max(1, chartData.length)} initialSpacing={12} endSpacing={8}
                hideDataPoints hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
              <View style={styles.chartLegend}><LegendChip color={colors.p450} label="Sales" /><LegendChip color="#f59e0b" label="Admin Profit" /></View>
            </View>
          ) : <Empty label={`No data for ${selectedYear}`} />}
        </AdminCard>

        <AdminCard title="Revenue Sources" icon="pie-chart" testID="revenue-sources-pie">
          {sourceData.length > 0 ? (
            <View style={{ alignItems: 'center' }}>
              <PieChart data={sourceData.map((d) => ({ value: d.value, color: d.color }))} donut radius={80} innerRadius={50} isAnimated animationDuration={800}
                centerLabelComponent={() => <View style={{ alignItems: 'center' }}><MoneyCU value={sourceTotal} style={styles.donutCenter} /><Text style={styles.donutSub}>sources</Text></View>} />
              <View style={{ alignSelf: 'stretch', marginTop: 12, gap: 8 }}>
                {sourceData.map((item) => (
                  <View key={item.name} style={styles.legendRow}>
                    <View style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: item.color }]} /><Text style={styles.legendName}>{item.name}</Text></View>
                    <Text style={styles.legendVal}>{money(item.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : <Empty label="No revenue data" />}
        </AdminCard>

        <AdminCard title="Orders Per Month" icon="cube">
          {chartData.length > 0 ? (
            <View style={{ paddingTop: 6 }}>
              <BarChart data={chartData.map((d) => ({ value: d.orders, label: d.month, frontColor: '#3b82f6' }))}
                width={CHART_W} height={180} barWidth={16} spacing={Math.max(6, (CHART_W - 40) / Math.max(1, chartData.length) - 16)} initialSpacing={12}
                barBorderTopLeftRadius={6} barBorderTopRightRadius={6} isAnimated animationDuration={800} hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
            </View>
          ) : <Empty label="No data" />}
        </AdminCard>

        <AdminCard title="Average Order Value" icon="pulse">
          {chartData.length > 0 ? (
            <View style={{ paddingTop: 6 }}>
              <LineChart data={chartData.map((d) => ({ value: d.avgOrder, label: d.month }))} curved isAnimated animationDuration={900}
                color="#f59e0b" thickness={2} dataPointsColor="#f59e0b" dataPointsRadius={3}
                width={CHART_W} height={180} spacing={(CHART_W - 30) / Math.max(1, chartData.length)} initialSpacing={12} endSpacing={8}
                hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
            </View>
          ) : <Empty label="No data" />}
        </AdminCard>
      </View>

      {/* ===== TOP SHOPS ===== */}
      <AdminCard title="Top Shops This Month" icon="trophy">
        {topShops.length > 0 ? topShops.map((shop, i) => (
          <View key={i} style={styles.shopRow}>
            <MedalChip i={i} />
            <View style={{ flex: 1 }}><Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text><Text style={styles.shopMeta}>{shop.orders} orders</Text></View>
            <Text style={styles.shopRev}>{money(shop.revenue)}</Text>
          </View>
        )) : <Empty label="No shop data this month" />}
      </AdminCard>

      {/* ===== ADJUSTMENTS HISTORY ===== */}
      <AdminCard title="Revenue Adjustments" icon={totalAdjustments >= 0 ? 'add-circle' : 'remove-circle'} right={<Text style={[styles.adjTotal, { color: totalAdjustments >= 0 ? '#059669' : '#dc2626' }]}>{totalAdjustments >= 0 ? '+' : ''}{money(totalAdjustments)}</Text>}>
        {adjustments.length > 0 ? adjustments.slice(0, 30).map((adj) => (
          <View key={adj.id} style={styles.adjRow}>
            <Ionicons name={adj.type === 'increase' ? 'add-circle' : 'remove-circle'} size={16} color={adj.type === 'increase' ? '#10b981' : '#ef4444'} />
            <View style={{ flex: 1 }}><Text style={styles.adjDesc} numberOfLines={1}>{adj.description}</Text><Text style={styles.adjDate}>{new Date(adj.created_at).toLocaleDateString()}</Text></View>
            <Text style={[styles.adjAmt, { color: adj.amount >= 0 ? '#059669' : '#dc2626' }]}>{adj.amount >= 0 ? '+' : ''}{money(adj.amount)}</Text>
          </View>
        )) : <Empty label="No adjustments yet" />}
      </AdminCard>

      {/* ===== MONTHLY BREAKDOWN — expandable cards ===== */}
      <AdminCard title="Monthly Revenue Breakdown" icon="calendar">
        {monthsDesc.length > 0 ? (
          <View key={`mb-${selectedYear}`} style={{ gap: 8 }}>
            {monthsDesc.map(([key, d]) => {
              const monthAdj = adjustments.filter((a) => (a.created_at || '').startsWith(key));
              const open = expandedMonth === key;
              return (
                <MonthCard key={key} monthKey={key} data={d} monthAdj={monthAdj} open={open} onToggle={() => toggleMonth(key)} onAdjPopup={() => setAdjustmentPopup({ monthKey: key, adjustments: monthAdj })} />
              );
            })}
            {/* Total footer */}
            <View style={styles.totalFoot}>
              <Text style={styles.totalFootLabel}>Total ({selectedYear})</Text>
              <View style={styles.totalFootGrid}>
                <FootCell label="Orders"><CountUp value={yearTotals.orders} style={styles.footVal} /></FootCell>
                <FootCell label="Sales"><MoneyCU value={yearTotals.sales} style={styles.footVal} /></FootCell>
                <FootCell label="Commissions"><MoneyCU value={yearTotals.commissions} style={[styles.footVal, { color: colors.p500 }]} /></FootCell>
                <FootCell label="Subscriptions"><MoneyCU value={yearTotals.subscriptions} style={[styles.footVal, { color: '#2563eb' }]} /></FootCell>
                <FootCell label="Adjustments"><MoneyCU value={yearTotals.adjustments} style={styles.footVal} /></FootCell>
                <FootCell label="Total Revenue" highlight><MoneyCU value={yearTotals.total_revenue} style={[styles.footVal, { color: '#047857' }]} /></FootCell>
              </View>
            </View>
          </View>
        ) : <Empty label={`No data for ${selectedYear}`} />}
      </AdminCard>

      {/* ===== YEAR SELECT ===== */}
      <Modal visible={yearOpen} transparent animationType="fade" onRequestClose={() => setYearOpen(false)}>
        <TouchableOpacity style={styles.pickBackdrop} activeOpacity={1} onPress={() => setYearOpen(false)}>
          <View style={styles.pickCard}>
            {years.map((y) => (
              <TouchableOpacity key={y} style={styles.pickRow} onPress={() => { setYearOpen(false); setSelectedYear(y); setExpandedMonth(null); }}>
                <Text style={[styles.pickText, y === selectedYear && { color: colors.violet, fontFamily: fonts.bold }]}>{y}</Text>
                {y === selectedYear && <Ionicons name="checkmark" size={16} color={colors.violet} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== ADJUSTMENT POPUP ===== */}
      <AdjustmentPopup popup={adjustmentPopup} onClose={() => setAdjustmentPopup(null)} />
    </AdminScreen>
  );
}

/* ---------- This-month tile ---------- */
function CmTile({ icon, label, value, prefix, decimals }) {
  return (
    <View style={styles.cmTile}>
      <View style={styles.cmTileHead}><Ionicons name={icon} size={13} color="rgba(255,255,255,0.7)" /><Text style={styles.cmTileLabel}>{label}</Text></View>
      <CountUp value={Number(value) || 0} prefix={prefix} decimals={decimals} style={styles.cmTileValue} />
    </View>
  );
}

/* ---------- Expandable month card ---------- */
function MonthCard({ monthKey, data, monthAdj, open, onToggle, onAdjPopup }) {
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.spring(rot, { toValue: open ? 1 : 0, useNativeDriver: true, speed: 16 }).start(); }, [open]); // eslint-disable-line
  const hasAdj = monthAdj.length > 0;
  return (
    <View style={styles.mCard}>
      <TouchableOpacity activeOpacity={0.85} style={styles.mHead} onPress={onToggle}>
        <View style={{ flex: 1 }}><Text style={styles.mMonth}>{monthLong(monthKey)}</Text><Text style={styles.mSub}>{data.orders || 0} orders</Text></View>
        <View style={styles.mTotalBox}><Text style={styles.mTotalLabel}>TOTAL REVENUE</Text><Text style={styles.mTotal}>{money(data.total_revenue)}</Text></View>
        <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><Ionicons name="chevron-down" size={18} color={colors.textMuted} /></Animated.View>
      </TouchableOpacity>
      {open && (
        <View style={styles.mBody}>
          <Detail label="Orders" value={String(data.orders || 0)} />
          <Detail label="Sales" value={money(data.sales)} />
          <Detail label="Commissions" value={money(data.commissions)} color={colors.p500} />
          <Detail label="Subscriptions" value={money(data.subscriptions)} color="#2563eb" />
          <Detail label="Platform Services" value={money(data.platform_services)} />
          <Detail label="Items Sold" value={String(data.items_sold || 0)} />
          <Detail label="Avg Order" value={money(data.avg_order_value)} />
          {/* adjustments row */}
          {hasAdj ? (
            <TouchableOpacity style={styles.mAdjRow} onPress={onAdjPopup} testID={`adjustments-popup-${monthKey}`}>
              <Text style={styles.detailLabel}>Adjustments</Text>
              <View style={styles.mAdjRight}>
                <Text style={[styles.detailValue, { color: (data.adjustments || 0) >= 0 ? '#059669' : '#dc2626', textDecorationLine: 'underline' }]}>
                  {(data.adjustments || 0) !== 0 ? `${data.adjustments >= 0 ? '+' : ''}${money(data.adjustments)}` : '-'}
                </Text>
                <Text style={styles.mAdjCount}>({monthAdj.length})</Text>
                <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ) : (
            <Detail label="Adjustments" value="-" />
          )}
        </View>
      )}
    </View>
  );
}
function Detail({ label, value, color }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, color && { color }]}>{value}</Text></View>;
}
function FootCell({ label, highlight, children }) {
  return <View style={[styles.footCell, highlight && styles.footCellHi]}><Text style={styles.footCellLabel}>{label}</Text>{children}</View>;
}

/* ---------- Adjustment details popup ---------- */
function AdjustmentPopup({ popup, onClose }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const total = popup?.adjustments?.reduce((s, a) => s + a.amount, 0) || 0;
  return (
    <Modal visible={!!popup} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.txHeadRow}><Ionicons name="cash" size={18} color={colors.violet} /><Text style={styles.sheetTitle}>Adjustment Details — {popup?.monthKey ? monthLong(popup.monthKey) : ''}</Text></View>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {popup?.adjustments?.map((adj) => (
            <View key={adj.id} style={styles.popRow}>
              <View style={[styles.popIcon, { backgroundColor: adj.type === 'increase' ? '#d1fae5' : '#fee2e2' }]}><Ionicons name={adj.type === 'increase' ? 'add-circle' : 'remove-circle'} size={16} color={adj.type === 'increase' ? '#059669' : '#dc2626'} /></View>
              <View style={{ flex: 1 }}><Text style={styles.popDesc} numberOfLines={2}>{adj.description || 'No reason provided'}</Text><Text style={styles.popDate}>{new Date(adj.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View>
              <Text style={[styles.popAmt, { color: adj.amount >= 0 ? '#059669' : '#dc2626' }]}>{adj.amount >= 0 ? '+' : ''}{money(adj.amount)}</Text>
            </View>
          ))}
          {popup?.adjustments?.length > 0 && (
            <View style={styles.popTotal}><Text style={styles.popTotalLabel}>Total</Text><Text style={[styles.popTotalVal, { color: total >= 0 ? '#059669' : '#dc2626' }]}>{total >= 0 ? '+' : ''}{money(total)}</Text></View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function LegendChip({ color, label }) { return <View style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendChipText}>{label}</Text></View>; }
function Empty({ label }) { return <View style={styles.empty}><Text style={styles.emptyText}>{label}</Text></View>; }

const styles = StyleSheet.create({
  yearPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  yearPillText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  pdfBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  kpiRow: { flexDirection: 'row', gap: 10 },

  /* this month */
  cmCard: { borderRadius: radius.lg, padding: 18, marginTop: 14, ...shadow.violetGlow },
  cmHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cmTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  cmMonth: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.medium, fontSize: 12, marginLeft: 'auto' },
  cmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cmTile: { width: '47.5%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, padding: 12 },
  cmTileHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  cmTileLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.medium, fontSize: 10.5 },
  cmTileValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.5 },

  /* charts */
  axis: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 9 },
  donutCenter: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  donutSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  legendName: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  legendVal: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'center' },
  legendChipText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  empty: { paddingVertical: 30, alignItems: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  /* top shops */
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  medal: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  medalNum: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.white },
  shopName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  shopMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  shopRev: { fontFamily: fonts.extrabold, fontSize: 14, color: '#059669' },

  /* adjustments history */
  adjTotal: { fontFamily: fonts.extrabold, fontSize: 13 },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  adjDesc: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  adjDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  adjAmt: { fontFamily: fonts.bold, fontSize: 13 },

  /* month cards */
  mCard: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  mHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  mMonth: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  mSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  mTotalBox: { alignItems: 'flex-end' },
  mTotalLabel: { fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.3, color: '#059669' },
  mTotal: { fontFamily: fonts.extrabold, fontSize: 15, color: '#047857' },
  mBody: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.surfaceMuted },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.borderLight },
  detailLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  detailValue: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  mAdjRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.borderLight },
  mAdjRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mAdjCount: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },

  /* total footer */
  totalFoot: { backgroundColor: '#f1f5f9', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 4 },
  totalFootLabel: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink, marginBottom: 8 },
  totalFootGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footCell: { width: '31%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 8 },
  footCellHi: { backgroundColor: '#d1fae5' },
  footCellLabel: { fontFamily: fonts.semibold, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  footVal: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink },

  /* year picker */
  pickBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 40 },
  pickCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 6, width: 180, ...shadow.dropdown },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  pickText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },

  /* sheets */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, flex: 1 },
  txHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  popIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  popDesc: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  popDate: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  popAmt: { fontFamily: fonts.extrabold, fontSize: 15 },
  popTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 },
  popTotalLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  popTotalVal: { fontFamily: fonts.extrabold, fontSize: 18 },
});
