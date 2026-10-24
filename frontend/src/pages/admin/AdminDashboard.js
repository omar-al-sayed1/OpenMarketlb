import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Package, DollarSign, Users, Clock, Eye, Store, CreditCard, Percent, RotateCcw, AlertTriangle, ShoppingCart, Calendar, ArrowUpRight, ArrowDownRight, FileDown, PlusCircle, MinusCircle, Wallet, Activity, ChevronRight, Layers, Shield, Zap, Globe, Target, BarChart3, Check, X, Image, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import AdminLayout from '../../components/AdminLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#5df6fc', '#ec4899'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resettingRevenue, setResettingRevenue] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustType, setAdjustType] = useState('increase');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [currentMonthData, setCurrentMonthData] = useState(null);
  const [monthlyMap, setMonthlyMap] = useState({});
  const [dailyMap, setDailyMap] = useState({});
  const _now0 = new Date();
  const [selYear, setSelYear] = useState(_now0.getFullYear());
  const [selMonth, setSelMonth] = useState(_now0.getMonth() + 1); // 1-12, 0 = whole year
  const [selDay, setSelDay] = useState(0); // 0 = all days
  const [pendingShops, setPendingShops] = useState([]);
  const [selectedShopDetail, setSelectedShopDetail] = useState(null);

  useEffect(() => {
    fetchAnalytics();
    fetchRevenueData();
    fetchAdjustments();
    fetchCurrentMonth();
    fetchPendingShops();
  }, []);

  const fetchAnalytics = async () => {
    try { const { data } = await api.admin.getAnalytics(); setAnalytics(data); }
    catch (error) { console.error('Failed to fetch analytics', error); }
    finally { setLoading(false); }
  };
  const fetchRevenueData = async () => {
    try { const { data } = await api.admin.getRevenue(); setRevenueData(data); } catch {}
  };
  const fetchAdjustments = async () => {
    try { const { data } = await api.admin.getRevenueAdjustments(); setAdjustments(data.adjustments || []); setTotalAdjustments(data.total || 0); } catch {}
  };
  const fetchCurrentMonth = async () => {
    try {
      const { data } = await api.admin.getMonthlyAnalytics();
      setMonthlyMap(data.monthly || {});
      setDailyMap(data.daily || {});
      setCurrentMonthData(data.current_month || {});
      // Default selection to the current month key returned by the API (if present)
      const ck = data.current_month_key;
      if (ck && /^\d{4}-\d{2}$/.test(ck)) {
        setSelYear(parseInt(ck.slice(0, 4), 10));
        setSelMonth(parseInt(ck.slice(5, 7), 10));
      }
    } catch {}
  };
  const fetchPendingShops = async () => {
    try {
      const { data } = await api.admin.getShops();
      const pending = (data || []).filter(s => s.status === 'pending');
      setPendingShops(pending);
    } catch {}
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try { await api.orders.updateStatus(orderId, newStatus); toast.success('Order status updated'); fetchAnalytics(); }
    catch { toast.error('Failed to update order status'); }
  };

  const handleResetRevenue = async () => {
    setResettingRevenue(true);
    try { await api.admin.resetRevenue(); toast.success('Revenue reset'); await fetchRevenueData(); await fetchAnalytics(); await fetchAdjustments(); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
    finally { setResettingRevenue(false); }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const response = await api.admin.downloadReport();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `openmarketlb_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Report downloaded!');
    } catch { toast.error('Failed to download report'); }
    finally { setDownloadingReport(false); }
  };

  const handleAdjustRevenue = async () => {
    if (!adjustAmount || parseFloat(adjustAmount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!adjustDescription.trim()) { toast.error('Enter a reason'); return; }
    setAdjusting(true);
    try {
      await api.admin.adjustRevenue({ amount: parseFloat(adjustAmount), type: adjustType, description: adjustDescription });
      toast.success(`Revenue ${adjustType === 'increase' ? 'increased' : 'decreased'} by $${parseFloat(adjustAmount).toFixed(2)}`);
      setAdjustDialogOpen(false); setAdjustAmount(''); setAdjustDescription('');
      await fetchRevenueData(); await fetchAdjustments();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
    finally { setAdjusting(false); }
  };

  const getMonthlyChartData = () => {
    if (!analytics?.monthly_revenue) return [];
    return Object.entries(analytics.monthly_revenue).map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      revenue: data.total || 0, orders: data.orders || 0,
    })).slice(-6);
  };
  const getShopRevenueChartData = () => {
    if (!revenueData?.shops_breakdown) return [];
    return revenueData.shops_breakdown.slice(0, 5).map(shop => ({ name: shop.shop_name?.slice(0, 12) || 'Unknown', revenue: shop.net_revenue || shop.gross_revenue || 0 }));
  };
  const getAdminRevenueChartData = () => {
    if (!revenueData?.admin_revenue) return [];
    return [
      { name: 'Subscriptions', value: revenueData.admin_revenue.subscriptions || 0, color: '#10b981' },
      { name: 'Commissions', value: revenueData.admin_revenue.commissions || 0, color: '#3b82f6' },
    ].filter(item => item.value > 0);
  };
  const getOrderStatusData = () => {
    if (!analytics) return [];
    const pending = analytics.pending_orders?.length || 0;
    const total = analytics.total_orders || 0;
    return [
      { name: 'Completed', value: total - pending, color: '#10b981' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
    ].filter(item => item.value > 0);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 min-h-screen">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 animate-pulse" />
            <div><div className="h-6 w-40 bg-slate-200 rounded-lg animate-pulse mb-1" /><div className="h-3 w-24 bg-slate-100 rounded animate-pulse" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (<div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />))}
          </div>
          <div className="h-64 bg-white rounded-2xl border animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  const monthlyData = getMonthlyChartData();
  const shopRevenueData2 = getShopRevenueChartData();
  const adminRevenueData = getAdminRevenueChartData();
  const orderStatusData = getOrderStatusData();

  // ===== Selected-period profit (driven by year + month selectors) =====
  const EMPTY_MONTH = { orders: 0, sales: 0, commissions: 0, subscriptions: 0, adjustments: 0, platform_services: 0, monthly_credits: 0, loyalty_deductions: 0, agent_commission_payouts: 0, agent_approval_bonus_payouts: 0, items_sold: 0, avg_order_value: 0, admin_profit: 0 };
  const sumYearData = (map, yr) => {
    const acc = { ...EMPTY_MONTH };
    Object.entries(map || {}).forEach(([k, v]) => {
      if (k.slice(0, 4) === String(yr)) {
        acc.orders += v.orders || 0; acc.sales += v.sales || 0; acc.commissions += v.commissions || 0;
        acc.subscriptions += v.subscriptions || 0; acc.adjustments += v.adjustments || 0;
        acc.platform_services += v.platform_services || 0; acc.monthly_credits += v.monthly_credits || 0;
        acc.loyalty_deductions += v.loyalty_deductions || 0;
        acc.agent_commission_payouts += v.agent_commission_payouts || 0;
        acc.agent_approval_bonus_payouts += v.agent_approval_bonus_payouts || 0;
        acc.items_sold += v.items_sold || 0;
      }
    });
    return acc;
  };
  // selYear === 0 → "All Years" (aggregate every month across every year)
  const sumAllData = (map) => {
    const acc = { ...EMPTY_MONTH };
    Object.values(map || {}).forEach((v) => {
      acc.orders += v.orders || 0; acc.sales += v.sales || 0; acc.commissions += v.commissions || 0;
      acc.subscriptions += v.subscriptions || 0; acc.adjustments += v.adjustments || 0;
      acc.platform_services += v.platform_services || 0; acc.monthly_credits += v.monthly_credits || 0;
      acc.loyalty_deductions += v.loyalty_deductions || 0;
      acc.agent_commission_payouts += v.agent_commission_payouts || 0;
      acc.agent_approval_bonus_payouts += v.agent_approval_bonus_payouts || 0;
      acc.items_sold += v.items_sold || 0;
    });
    return acc;
  };
  const availableYears = (() => {
    const ys = new Set(Object.keys(monthlyMap || {}).map(k => k.slice(0, 4)).filter(Boolean));
    ys.add(String(_now0.getFullYear()));
    return Array.from(ys).map(Number).sort((a, b) => b - a);
  })();
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const isAllYears = selYear === 0;
  const selKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const dayKey = `${selKey}-${String(selDay).padStart(2, '0')}`;
  const daysInSelMonth = selMonth > 0 ? new Date(selYear, selMonth, 0).getDate() : 31;
  const periodData = isAllYears
    ? sumAllData(monthlyMap)
    : (selMonth === 0
      ? sumYearData(monthlyMap, selYear)
      : (selDay > 0 ? (dailyMap[dayKey] || EMPTY_MONTH) : (monthlyMap[selKey] || EMPTY_MONTH)));
  const periodLabel = isAllYears
    ? 'All Years'
    : (selMonth === 0
      ? `${selYear}`
      : (selDay > 0 ? `${MONTH_NAMES[selMonth - 1]} ${selDay}, ${selYear}` : `${MONTH_NAMES[selMonth - 1]} ${selYear}`));

  const cmCommissions = periodData?.commissions || 0;
  const cmSubscriptions = periodData?.subscriptions || 0;
  const cmAdjustments = periodData?.adjustments || 0;
  const cmPlatformServices = periodData?.platform_services || 0;
  const cmMonthlyCredits = periodData?.monthly_credits || 0;
  const cmLoyaltyDeductions = periodData?.loyalty_deductions || 0;
  const cmAgentCommission = periodData?.agent_commission_payouts || 0;
  const cmAgentApprovalBonus = periodData?.agent_approval_bonus_payouts || 0;
  const totalAdminProfit = (cmSubscriptions + cmCommissions + cmAdjustments + cmPlatformServices - cmMonthlyCredits - cmLoyaltyDeductions - cmAgentCommission - cmAgentApprovalBonus);
  const subscriptionRevenue = cmSubscriptions;
  const commissionRevenue = cmCommissions;
  const platformServicesRevenue = cmPlatformServices;
  const monthlyCreditsAmount = cmMonthlyCredits;

  return (
    <AdminLayout>
      <div className="p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 min-h-screen" data-testid="admin-dashboard-content">
        
        {/* ===== HERO HEADER ===== */}
        <div className="relative overflow-hidden rounded-3xl mb-8 p-6 sm:p-8 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-indigo-100/40 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-violet-50/50 to-transparent rounded-full translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-indigo-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight" data-testid="admin-dashboard-title">
                  Admin Dashboard
                </h1>
                <p className="text-slate-500 text-sm">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setAdjustDialogOpen(true)} variant="outline" size="sm" className="rounded-full text-xs border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-all duration-300">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Adjust Revenue
              </Button>
              <Button onClick={handleDownloadReport} disabled={downloadingReport} size="sm" className="rounded-full text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-200 transition-all duration-300" data-testid="download-report-btn">
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> {downloadingReport ? 'Generating...' : 'Report'}
              </Button>
            </div>
          </div>
        </div>

        {/* ===== MAIN STATS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
          {[
            { label: 'Total Orders', value: analytics?.total_orders || 0, icon: ShoppingCart, gradient: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-100', bg: 'from-blue-50' },
            { label: 'Platform Sales', value: `$${(analytics?.total_revenue || 0).toFixed(0)}`, icon: DollarSign, gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-100', bg: 'from-emerald-50' },
            { label: 'Pending Orders', value: analytics?.pending_orders?.length || 0, icon: Clock, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100', bg: 'from-amber-50' },
            { label: 'Active Shops', value: revenueData?.shops_breakdown?.length || 0, icon: Store, gradient: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-100', bg: 'from-violet-50' },
          ].map((stat, i) => (
            <div key={stat.label} className={`relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 shadow-sm ${stat.shadow} hover:shadow-md hover:-translate-y-1 transition-all duration-500 group`} style={{ animation: `slideUp 0.4s ease-out ${0.1 + i * 0.08}s both` }} data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
              <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br ${stat.gradient} opacity-[0.07] group-hover:opacity-[0.14] group-hover:scale-150 transition-all duration-700`} />
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3 shadow-sm ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ===== PROFIT HERO CARD ===== */}
        <div className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-xl shadow-indigo-500/15" data-testid="admin-revenue-section" style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-white/15 rounded-full" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="absolute bottom-1/4 right-1/2 w-2 h-2 bg-white/20 rounded-full" style={{ animation: 'float 3s ease-in-out infinite 1s' }} />
          
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Monthly Profit</h2>
                  <p className="text-white/60 text-xs" data-testid="profit-period-label">{periodLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Year + Month selectors */}
                <Select value={String(selYear)} onValueChange={(v) => { const y = parseInt(v, 10); setSelYear(y); if (y === 0) setSelDay(0); }}>
                  <SelectTrigger className="h-9 w-[120px] rounded-full bg-white/10 border-white/20 text-white text-xs hover:bg-white/15 focus:ring-white/30" data-testid="profit-year-select">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" data-testid="profit-year-option-all">All Years</SelectItem>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={String(y)} data-testid={`profit-year-option-${y}`}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isAllYears && (
                <Select value={String(selMonth)} onValueChange={(v) => { setSelMonth(parseInt(v, 10)); setSelDay(0); }}>
                  <SelectTrigger className="h-9 w-[140px] rounded-full bg-white/10 border-white/20 text-white text-xs hover:bg-white/15 focus:ring-white/30" data-testid="profit-month-select">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" data-testid="profit-month-option-all">All months</SelectItem>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)} data-testid={`profit-month-option-${i + 1}`}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                )}
                {/* Day filter — defaults to "All days" */}
                {!isAllYears && selMonth > 0 && (
                  <Select value={String(selDay)} onValueChange={(v) => setSelDay(parseInt(v, 10))}>
                    <SelectTrigger className="h-9 w-[120px] rounded-full bg-white/10 border-white/20 text-white text-xs hover:bg-white/15 focus:ring-white/30" data-testid="profit-day-select">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" data-testid="profit-day-option-all">All days</SelectItem>
                      {Array.from({ length: daysInSelMonth }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)} data-testid={`profit-day-option-${d}`}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="text-left sm:text-right ml-1">
                  <p className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">Admin Profit</p>
                  <p className="text-3xl sm:text-4xl font-black tracking-tight" data-testid="admin-total-revenue">${totalAdminProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Subscriptions', value: subscriptionRevenue, icon: CreditCard },
                { label: 'Commissions', value: commissionRevenue, icon: Percent },
                { label: 'Adjustments', value: totalAdjustments, icon: totalAdjustments >= 0 ? PlusCircle : MinusCircle },
                { label: 'Platform Services', value: platformServicesRevenue, icon: Zap },
                { label: 'New Shop Credits + Monthly Credits', value: -monthlyCreditsAmount, icon: MinusCircle },
                { label: 'Loyalty Point Deductions (Shop)', value: -cmLoyaltyDeductions, icon: MinusCircle },
                { label: 'Shop referrals first pay', value: -cmAgentApprovalBonus, icon: MinusCircle },
                { label: 'Loyalty Point Deductions (Agent)', value: -cmAgentCommission, icon: MinusCircle },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className="h-3 w-3 text-white/60" />
                    <p className="text-white/60 text-[9px] font-medium uppercase">{item.label}</p>
                  </div>
                  <p className="text-base font-bold">${item.value.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative px-6 sm:px-8 pb-5 flex items-center gap-2 flex-wrap border-t border-white/10 pt-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/finance-center')} className="text-[10px] text-white/80 hover:text-white hover:bg-white/10 rounded-full h-7 px-3">
              <Wallet className="h-3 w-3 mr-1.5" /> Finance Center <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/analytics')} className="text-[10px] text-white/80 hover:text-white hover:bg-white/10 rounded-full h-7 px-3">
              <BarChart3 className="h-3 w-3 mr-1.5" /> Full Analytics <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* ===== QUICK ACTIONS ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8" style={{ animation: 'slideUp 0.5s ease-out 0.5s both' }}>
          {[
            { label: 'Orders', icon: ShoppingCart, route: '/admin/orders', gradient: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
            { label: 'Shops', icon: Store, route: '/admin/shops', gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200' },
            { label: 'Products', icon: Package, route: '/admin/products', gradient: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-200' },
            { label: 'Users', icon: Users, route: '/admin/users', gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
            { label: 'Finance', icon: Wallet, route: '/admin/finance-center', gradient: 'from-rose-500 to-pink-500', shadow: 'shadow-rose-200' },
            { label: 'Themes', icon: Globe, route: '/admin/themes', gradient: 'from-cyan-500 to-sky-500', shadow: 'shadow-cyan-200' },
          ].map((action) => (
            <button key={action.label} onClick={() => navigate(action.route)} className={`group relative overflow-hidden rounded-2xl p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md ${action.shadow} hover:-translate-y-1 transition-all duration-500 text-left`}>
              <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br ${action.gradient} opacity-[0.06] group-hover:opacity-[0.12] group-hover:scale-150 transition-all duration-700`} />
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-2 shadow-sm ${action.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="h-4 w-4 text-white" />
              </div>
              <p className="font-semibold text-xs text-slate-700">{action.label}</p>
            </button>
          ))}
        </div>

        {/* ===== CHARTS ROW 1 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6" style={{ animation: 'fadeIn 0.6s ease-out 0.6s both' }}>
          {/* Revenue Pie */}
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" data-testid="admin-revenue-pie">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-200">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Revenue Sources</h2>
            </div>
            {adminRevenueData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={adminRevenueData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {adminRevenueData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value.toFixed(2)}`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {adminRevenueData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-slate-600">{item.name}</span></div>
                      <span className="font-semibold text-sm">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2"><div className="flex justify-between"><span className="text-sm font-medium">Total</span><span className="font-bold text-emerald-600">${totalAdminProfit.toFixed(2)}</span></div></div>
                </div>
              </div>
            ) : (<div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No revenue data yet</div>)}
          </div>

          {/* Monthly Trend */}
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" data-testid="monthly-revenue-chart">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm shadow-violet-200">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Monthly Revenue Trend</h2>
            </div>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyData}>
                  <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b4f56a" stopOpacity={0.3}/><stop offset="95%" stopColor="#b4f56a" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#b4f56a" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (<div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>)}
          </div>
        </div>

        {/* ===== CHARTS ROW 2 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" style={{ animation: 'fadeIn 0.6s ease-out 0.7s both' }}>
          <div className="lg:col-span-2 rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" data-testid="shop-revenue-chart">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-blue-200">
                <Store className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Top Shops by Revenue</h2>
            </div>
            {shopRevenueData2.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={shopRevenueData2} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#b4f56a" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No shop revenue data</div>)}
          </div>
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" data-testid="order-status-chart">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-200">
                <Package className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Order Status</h2>
            </div>
            {orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart><Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>{orderStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : (<div className="h-[160px] flex items-center justify-center text-slate-400 text-sm">No orders yet</div>)}
            <div className="flex justify-center gap-4 mt-2">{orderStatusData.map((item, index) => (<div key={index} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-xs text-slate-600">{item.name}: {item.value}</span></div>))}</div>
          </div>
        </div>

        {/* ===== SHOP REQUESTS TABLE ===== */}
        {pendingShops.length > 0 && (
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm mb-6" data-testid="shop-requests-section" style={{ animation: 'slideUp 0.5s ease-out 0.75s both' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-200">
                  <Store className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">Shop Requests</h2>
                  <p className="text-[10px] text-slate-400">{pendingShops.length} pending request{pendingShops.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/shops')} className="text-xs text-indigo-600 hover:text-indigo-700">
                Manage All <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Shop Name</TableHead>
                    <TableHead className="text-xs">Owner Email</TableHead>
                    <TableHead className="text-xs">City</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Applied</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingShops.slice(0, 10).map((shop) => (
                    <TableRow key={shop.id} data-testid={`shop-request-row-${shop.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {shop.logo ? (
                            <img src={shop.logo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${shop.logo}` : shop.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center">
                              <Store className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-xs text-slate-800">{shop.name}</p>
                            <Badge variant="outline" className="text-[9px] mt-0.5">Pending</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{shop.email || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600">{shop.city || shop.state || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600">{shop.phone || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {shop.created_at ? new Date(shop.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-full" onClick={() => setSelectedShopDetail(shop)} data-testid={`view-shop-${shop.id}`}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button size="sm" className="h-7 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/admin/shops')} data-testid={`approve-shop-${shop.id}`}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Shop Detail View Dialog */}
        <Dialog open={!!selectedShopDetail} onOpenChange={() => setSelectedShopDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-emerald-600" />
                Shop Request Details
              </DialogTitle>
            </DialogHeader>
            {selectedShopDetail && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  {selectedShopDetail.logo ? (
                    <img src={selectedShopDetail.logo.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${selectedShopDetail.logo}` : selectedShopDetail.logo} alt="" className="w-14 h-14 rounded-xl object-cover border" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <Store className="h-7 w-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{selectedShopDetail.name}</h3>
                    <p className="text-sm text-slate-500">{selectedShopDetail.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 uppercase font-semibold">Phone</p><p className="text-sm font-medium text-slate-800">{selectedShopDetail.phone || '—'}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 uppercase font-semibold">City</p><p className="text-sm font-medium text-slate-800">{selectedShopDetail.city || '—'}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 uppercase font-semibold">State</p><p className="text-sm font-medium text-slate-800">{selectedShopDetail.state || '—'}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 uppercase font-semibold">Address</p><p className="text-sm font-medium text-slate-800">{selectedShopDetail.address || '—'}</p></div>
                </div>
                {selectedShopDetail.description && (
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Description</p><p className="text-sm text-slate-700">{selectedShopDetail.description}</p></div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedShopDetail(null)} className="flex-1 rounded-full">Close</Button>
                  <Button onClick={() => { setSelectedShopDetail(null); navigate('/admin/shops'); }} className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700">
                    <Check className="h-4 w-4 mr-1" /> Go to Approve
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== PENDING ORDERS ===== */}
        {analytics?.pending_orders && analytics.pending_orders.length > 0 && (
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm" data-testid="pending-orders-list" style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-200">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold text-sm text-slate-900">Pending Orders</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')} className="text-xs text-indigo-600 hover:text-indigo-700">
                View All <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {analytics.pending_orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors duration-200" data-testid={`pending-order-${order.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><ShoppingCart className="h-3.5 w-3.5 text-amber-600" /></div>
                    <div>
                      <p className="font-semibold text-xs text-slate-800">{order.guest_name || order.customer_name || 'Guest'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{order.id.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-slate-900">${order.total_amount.toFixed(2)}</span>
                    <Select value={order.order_status} onValueChange={(value) => handleStatusChange(order.id, value)}>
                      <SelectTrigger className="w-24 h-7 text-[10px] rounded-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Adjustment Dialog */}
        <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-emerald-600" />Adjust Revenue</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label className="mb-2 block">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAdjustType('increase')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${adjustType === 'increase' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`} data-testid="adjust-increase-btn"><PlusCircle className="h-5 w-5" />Increase</button>
                  <button type="button" onClick={() => setAdjustType('decrease')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${adjustType === 'decrease' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`} data-testid="adjust-decrease-btn"><MinusCircle className="h-5 w-5" />Decrease</button>
                </div>
              </div>
              <div><Label>Amount ($)</Label><Input type="number" min="0.01" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0.00" className="text-lg" data-testid="adjust-amount-input" /></div>
              <div><Label>Reason *</Label><Textarea value={adjustDescription} onChange={(e) => setAdjustDescription(e.target.value)} placeholder="Reason..." rows={2} data-testid="adjust-description-input" /></div>
              {adjustAmount && parseFloat(adjustAmount) > 0 && (<div className={`p-3 rounded-lg border text-sm ${adjustType === 'increase' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>Revenue will be {adjustType === 'increase' ? 'increased' : 'decreased'} by <strong>${parseFloat(adjustAmount).toFixed(2)}</strong></div>)}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} className="flex-1 rounded-full">Cancel</Button>
                <Button onClick={handleAdjustRevenue} disabled={adjusting || !adjustAmount || parseFloat(adjustAmount) <= 0 || !adjustDescription.trim()} className={`flex-1 rounded-full ${adjustType === 'increase' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`} data-testid="confirm-adjust-btn">{adjusting ? 'Processing...' : 'Confirm'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
