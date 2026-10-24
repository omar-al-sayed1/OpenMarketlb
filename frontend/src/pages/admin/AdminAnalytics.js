import React, { useEffect, useState } from 'react';
import { 
  DollarSign, TrendingUp, ShoppingCart, CreditCard, ArrowUpRight, ArrowDownRight,
  Calendar, BarChart3, PieChart as PieChartIcon, Activity, Package, Users, Store,
  Download, PlusCircle, MinusCircle, ChevronDown, ChevronUp, FileDown,
  Sparkles, Target, Award, Zap, X, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart
} from 'recharts';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const CHART_COLORS = ['#5df6fc', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const AdminAnalytics = () => {
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonth, setCurrentMonth] = useState({});
  const [totals, setTotals] = useState({});
  const [topShops, setTopShops] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [adjustmentPopup, setAdjustmentPopup] = useState(null); // { monthKey, adjustments: [] }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, adjustRes] = await Promise.allSettled([
        api.admin.getMonthlyAnalytics(),
        api.admin.getRevenueAdjustments()
      ]);
      
      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value.data;
        setMonthlyData(d.monthly || {});
        setCurrentMonth(d.current_month || {});
        setTotals(d.totals || {});
        setTopShops(d.top_shops_this_month || []);
      }
      if (adjustRes.status === 'fulfilled') {
        setAdjustments(adjustRes.value.data.adjustments || []);
        setTotalAdjustments(adjustRes.value.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch analytics', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const response = await api.admin.downloadReport();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openmarketlb_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Report downloaded!');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  // Prepare chart data
  const getChartData = () => {
    return Object.entries(monthlyData)
      .filter(([key]) => key.startsWith(selectedYear))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short' }),
        monthKey: key,
        sales: data.sales || 0,
        commissions: data.commissions || 0,
        subscriptions: data.subscriptions || 0,
        adjustments: data.adjustments || 0,
        platformServices: data.platform_services || 0,
        monthlyCredits: data.monthly_credits || 0,
        adminProfit: data.admin_profit ?? data.total_revenue ?? 0,
        totalRevenue: data.admin_profit ?? data.total_revenue ?? 0,
        orders: data.orders || 0,
        items: data.items_sold || 0,
        avgOrder: data.avg_order_value || 0,
      }));
  };

  const getRevenueSourceData = () => {
    return [
      { name: 'Commissions', value: totals.commissions || 0, color: '#5df6fc' },
      { name: 'Subscriptions', value: totals.subscriptions || 0, color: '#10b981' },
      { name: 'Platform Services', value: totals.platform_services || 0, color: '#b4f56a' },
      ...(totalAdjustments !== 0 ? [{ name: 'Adjustments', value: Math.abs(totalAdjustments), color: totalAdjustments >= 0 ? '#f59e0b' : '#ef4444' }] : []),
      ...(totals.monthly_credits > 0 ? [{ name: 'New Shop Credits + Monthly Credits (−)', value: totals.monthly_credits, color: '#ef4444' }] : []),
    ].filter(d => d.value > 0);
  };

  const years = [...new Set(Object.keys(monthlyData).map(k => k.split('-')[0]))].sort().reverse();
  if (!years.includes(selectedYear)) years.unshift(selectedYear);

  const chartData = getChartData();
  const sourceData = getRevenueSourceData();
  const totalAdminProfit = (totals.admin_profit ?? totals.total_revenue ?? 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 min-h-screen" data-testid="admin-analytics-page">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-violet-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Profit Analytics</h1>
                <p className="text-slate-500 text-xs sm:text-sm">Subscriptions + Commissions + Services - Credits</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleDownloadReport} className="bg-violet-600 hover:bg-violet-700 rounded-full text-xs" data-testid="download-report-btn">
                <FileDown className="h-4 w-4 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
        </div>

        {/* All-Time Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          {[
            { label: 'Total Admin Profit', value: `$${totalAdminProfit.toFixed(2)}`, icon: DollarSign, color: 'emerald', sub: 'Subs + Commissions + Adj + Services − Credits' },
            { label: 'Total Platform Sales', value: `$${(totals.sales || 0).toFixed(2)}`, icon: ShoppingCart, color: 'violet', sub: `${totals.orders || 0} orders` },
            { label: 'Commission Profit', value: `$${(totals.commissions || 0).toFixed(2)}`, icon: TrendingUp, color: 'blue', sub: 'From product sales' },
            { label: 'Subscription Profit', value: `$${(totals.subscriptions || 0).toFixed(2)}`, icon: CreditCard, color: 'amber', sub: 'From shop subscriptions' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">{stat.label}</span>
                  <div className={`p-1.5 rounded-lg bg-${stat.color}-100`}>
                    <Icon className={`h-4 w-4 text-${stat.color}-600`} />
                  </div>
                </div>
                <p className="text-xl lg:text-2xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-slate-400 mt-1">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Current Month Highlight */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-yellow-300" />
            <h2 className="font-bold text-lg">This Month's Performance</h2>
            <span className="ml-auto text-violet-200 text-sm">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Profit', value: `$${((currentMonth.admin_profit ?? ((currentMonth.commissions || 0) + (currentMonth.subscriptions || 0) + (currentMonth.adjustments || 0) + (currentMonth.platform_services || 0) - (currentMonth.monthly_credits || 0)))).toFixed(2)}`, icon: DollarSign },
              { label: 'Sales', value: `$${(currentMonth.sales || 0).toFixed(2)}`, icon: ShoppingCart },
              { label: 'Orders', value: currentMonth.orders || 0, icon: Package },
              { label: 'Items Sold', value: currentMonth.items_sold || 0, icon: Target },
              { label: 'Avg Order', value: `$${(currentMonth.avg_order_value || 0).toFixed(2)}`, icon: Activity },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-[11px] text-white/70">{item.label}</span>
                  </div>
                  <p className="text-xl font-bold">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          {/* Revenue Trend - Large */}
          <div className="bg-white rounded-xl p-5 shadow-sm border lg:col-span-2" data-testid="revenue-trend-chart">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              Monthly Profit Trend ({selectedYear})
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5df6fc" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5df6fc" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="sales" name="Sales" fill="url(#gradientRevenue)" stroke="#5df6fc" strokeWidth={2} />
                  <Bar dataKey="commissions" name="Commissions" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="subscriptions" name="Subscriptions" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="platformServices" name="Platform Services" fill="#b4f56a" radius={[4, 4, 0, 0]} barSize={16} />
                  <Line type="monotone" dataKey="adminProfit" name="Admin Profit" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400">No data for {selectedYear}</div>
            )}
          </div>

          {/* Revenue Sources Pie */}
          <div className="bg-white rounded-xl p-5 shadow-sm border" data-testid="revenue-sources-pie">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-600" />
              Revenue Sources
            </h3>
            {sourceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {sourceData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {sourceData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-semibold">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400">No revenue data</div>
            )}
          </div>
        </div>

        {/* Orders & Items Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Orders Per Month
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400">No data</div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600" />
              Average Order Value
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Avg Order']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="avgOrder" name="Avg Order Value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400">No data</div>
            )}
          </div>
        </div>

        {/* Top Shops This Month + Monthly Breakdown Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
          {/* Top Shops */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-600" />
              Top Shops This Month
            </h3>
            {topShops.length > 0 ? (
              <div className="space-y-2">
                {topShops.map((shop, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-slate-300'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{shop.name}</p>
                      <p className="text-[11px] text-slate-500">{shop.orders} orders</p>
                    </div>
                    <span className="font-bold text-sm text-emerald-600">${shop.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No shop data this month</div>
            )}
          </div>

          {/* Revenue Adjustments History */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              {totalAdjustments >= 0 ? <PlusCircle className="h-4 w-4 text-emerald-600" /> : <MinusCircle className="h-4 w-4 text-red-600" />}
              Revenue Adjustments
              <span className={`ml-auto text-sm font-bold ${totalAdjustments >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalAdjustments >= 0 ? '+' : ''}${totalAdjustments.toFixed(2)}
              </span>
            </h3>
            {adjustments.length > 0 ? (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {adj.type === 'increase' ? (
                        <PlusCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <MinusCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{adj.description}</p>
                        <p className="text-[11px] text-slate-400">{new Date(adj.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`font-bold flex-shrink-0 ${adj.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {adj.amount >= 0 ? '+' : ''}${adj.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No adjustments yet</div>
            )}
          </div>
        </div>

        {/* Monthly Breakdown Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-5 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600" />
              Monthly Revenue Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Commissions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Subscriptions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Adjustments</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 bg-emerald-50">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(monthlyData)
                  .filter(([k]) => k.startsWith(selectedYear))
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([key, data]) => {
                    const monthAdjustments = adjustments.filter(adj => {
                      const adjDate = adj.created_at || '';
                      return adjDate.startsWith(key);
                    });
                    const hasAdjustments = monthAdjustments.length > 0;
                    
                    return (
                      <tr 
                        key={key}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{data.orders}</td>
                        <td className="px-4 py-3 text-sm text-right">${(data.sales || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-violet-600 font-medium">${(data.commissions || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">${(data.subscriptions || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {hasAdjustments ? (
                            <button
                              onClick={() => setAdjustmentPopup({ monthKey: key, adjustments: monthAdjustments })}
                              className="inline-flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              data-testid={`adjustments-popup-${key}`}
                            >
                              <span className={`${data.adjustments >= 0 ? 'text-emerald-600' : 'text-red-600'} underline decoration-dashed font-medium`}>
                                {data.adjustments !== 0 ? `${data.adjustments >= 0 ? '+' : ''}$${data.adjustments.toFixed(2)}` : '-'}
                              </span>
                              <span className="text-[10px] text-slate-400">({monthAdjustments.length})</span>
                              <Info className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700 bg-emerald-50">
                          ${(data.total_revenue || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                {Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No data for {selectedYear}</td>
                  </tr>
                )}
              </tbody>
              {/* Totals Row */}
              {Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold">Total ({selectedYear})</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.orders || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      ${Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.sales || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-violet-600">
                      ${Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.commissions || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                      ${Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.subscriptions || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      ${Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.adjustments || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-extrabold text-emerald-700 bg-emerald-100">
                      ${Object.entries(monthlyData).filter(([k]) => k.startsWith(selectedYear)).reduce((s, [_, d]) => s + (d.total_revenue || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Adjustment Details Popup Dialog */}
        <Dialog open={!!adjustmentPopup} onOpenChange={(open) => { if (!open) setAdjustmentPopup(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-violet-600" />
                Adjustment Details - {adjustmentPopup?.monthKey && new Date(adjustmentPopup.monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
              {adjustmentPopup?.adjustments?.map((adj) => (
                <div key={adj.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${adj.type === 'increase' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {adj.type === 'increase' ? (
                        <PlusCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <MinusCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{adj.description || 'No reason provided'}</p>
                      <p className="text-xs text-slate-400">{new Date(adj.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${adj.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {adj.amount >= 0 ? '+' : ''}${adj.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {adjustmentPopup?.adjustments?.length > 0 && (
                <div className="border-t pt-3 mt-3 flex items-center justify-between px-1">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className={`text-xl font-bold ${
                    adjustmentPopup.adjustments.reduce((s, a) => s + a.amount, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {adjustmentPopup.adjustments.reduce((s, a) => s + a.amount, 0) >= 0 ? '+' : ''}$
                    {adjustmentPopup.adjustments.reduce((s, a) => s + a.amount, 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
