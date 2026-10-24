import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Store, CreditCard, Settings, Wallet, ArrowDown, ArrowUp, ChevronRight, RefreshCw, Filter, X, Sparkles, Gift, Clock, Download, PlusCircle, MinusCircle, Truck, AlertCircle, CheckCircle2, UserCog, Percent, ExternalLink, Eye, CalendarDays, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Activity, RotateCcw } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (amount) => `$${(amount || 0).toFixed(2)}`;
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return dateStr; }
};

const StatCard = ({ title, value, icon: Icon, color, subtext, trend }) => (
  <Card className="relative overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 group" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <CardContent className="p-5">
      <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-gradient-to-br opacity-[0.07] group-hover:opacity-[0.14] group-hover:scale-150 transition-all duration-700" style={{ background: color?.includes('green') ? 'linear-gradient(to br, #10b981, #059669)' : color?.includes('red') ? 'linear-gradient(to br, #ef4444, #dc2626)' : color?.includes('blue') ? 'linear-gradient(to br, #3b82f6, #2563eb)' : color?.includes('orange') ? 'linear-gradient(to br, #f59e0b, #d97706)' : color?.includes('purple') ? 'linear-gradient(to br, #5df6fc, #3bf4fb)' : 'linear-gradient(to br, #b4f56a, #caff8a)' }} />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</p>
          <p className={`text-2xl font-black ${color || 'text-slate-900'}`}>{value}</p>
          {subtext && <p className="text-[10px] text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300 ${color?.includes('green') ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-200' : color?.includes('red') ? 'bg-gradient-to-br from-red-500 to-rose-500 shadow-red-200' : color?.includes('blue') ? 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-200' : color?.includes('orange') ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-200' : color?.includes('purple') ? 'bg-gradient-to-br from-violet-500 to-purple-500 shadow-violet-200' : 'bg-gradient-to-br from-indigo-500 to-violet-500 shadow-indigo-200'}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(trend)}% from last month
        </div>
      )}
    </CardContent>
  </Card>
);

const TransactionRow = ({ txn }) => (
  <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0" data-testid="transaction-row">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${txn.direction === 'debit' ? 'bg-red-100' : 'bg-emerald-100'}`}>
      {txn.direction === 'debit' ? <ArrowDown className="h-4 w-4 text-red-600" /> : <ArrowUp className="h-4 w-4 text-emerald-600" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-900 truncate">{txn.note || txn.description || txn.subtype || 'Transaction'}</p>
      <p className="text-xs text-slate-400">{txn.shop_name && `${txn.shop_name} · `}{formatDate(txn.created_at)}</p>
    </div>
    <div className="text-right">
      <p className={`text-sm font-bold ${txn.direction === 'debit' ? 'text-red-600' : 'text-emerald-600'}`}>
        {txn.direction === 'debit' ? '-' : '+'}{formatCurrency(txn.amount)}
      </p>
      {txn.subtype && <Badge variant="outline" className="text-[10px] mt-0.5">{txn.subtype.replace(/_/g, ' ')}</Badge>}
    </div>
  </div>
);

export default function AdminFinanceCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnTotalPages, setTxnTotalPages] = useState(0);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutNote, setCashoutNote] = useState('');
  const [cashoutLoading, setCashoutLoading] = useState(false);
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [totalCashedOut, setTotalCashedOut] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState('increase');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // ===== Period filter (year/month) + analytics time series =====
  const _now = new Date();
  const [selYear, setSelYear] = useState(_now.getFullYear());
  const [selMonth, setSelMonth] = useState(-1); // all time (Filter by Period removed — finance shows all-time totals)
  const [timeseries, setTimeseries] = useState([]);
  const [availableYears, setAvailableYears] = useState([_now.getFullYear()]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selMonth === -1) {
        // all time → no params
      } else {
        params.year = selYear;
        if (selMonth > 0) params.month = selMonth;
      }
      const { data: result } = await api.admin.getFinanceCenter(params);
      setData(result);
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  }, [selYear, selMonth]);

  const fetchTimeseries = useCallback(async () => {
    try {
      const { data: result } = await api.admin.getFinanceTimeseries(selMonth === -1 ? undefined : selYear);
      setTimeseries(result.series || []);
      if (Array.isArray(result.available_years) && result.available_years.length) {
        setAvailableYears(result.available_years.sort((a, b) => b - a));
      }
    } catch (err) {
      console.error('Error fetching finance timeseries:', err);
    }
  }, [selYear, selMonth]);

  useEffect(() => { fetchData(); fetchTimeseries(); }, [fetchData, fetchTimeseries]);
  useEffect(() => { fetchCashoutHistory(); }, []);

  const fetchTransactions = async (type, page = 1) => {
    try {
      setTxnLoading(true);
      const { data: result } = await api.admin.getFinanceTransactions(type, page, 20);
      setTransactions(result.transactions || []);
      setTxnTotal(result.total || 0);
      setTxnTotalPages(result.total_pages || 0);
      setTxnPage(page);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTxnLoading(false);
    }
  };

  const openSection = (section) => {
    setSelectedSection(section);
    fetchTransactions(section, 1);
  };

  const handleDownloadCsv = async (type) => {
    try {
      const response = await api.admin.exportFinanceCsv(type || 'all');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `finance_${type || 'all'}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading CSV:', err);
    }
  };

  const fetchCashoutHistory = async () => {
    try {
      const { data: result } = await api.admin.getRevenueCashouts();
      setCashoutHistory(result.cashouts || []);
      setTotalCashedOut(result.total_cashed_out || 0);
    } catch (err) {}
  };

  const handleAdminCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) return;
    setCashoutLoading(true);
    try {
      const { data: result } = await api.admin.cashoutRevenue({ amount: parseFloat(cashoutAmount), note: cashoutNote || 'Admin revenue cash out' });
      setCashoutOpen(false);
      setCashoutAmount('');
      setCashoutNote('');
      fetchData();
      fetchCashoutHistory();
    } catch (err) {
      console.error('Cash out failed:', err);
    } finally {
      setCashoutLoading(false);
    }
  };

  const handleAdjust = async () => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setAdjustLoading(true);
    try {
      await api.admin.adjustRevenue({ amount, type: adjustType, description: adjustNote || `Manual ${adjustType}` });
      toast.success(`Revenue ${adjustType}d by $${amount.toFixed(2)}`);
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustNote('');
      setAdjustType('increase');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Adjustment failed');
    } finally {
      setAdjustLoading(false);
    }
  };

  const sectionLabels = {
    subscriptions: { label: 'Subscriptions', icon: CreditCard, color: 'text-blue-600' },
    commissions: { label: 'Commissions', icon: TrendingUp, color: 'text-emerald-600' },
    adjustments: { label: 'Adjustments', icon: Settings, color: 'text-orange-600' },
    platform_services: { label: 'Platform Services', icon: Sparkles, color: 'text-purple-600' },
    monthly_credits: { label: 'New Shop Credits + Monthly Credits', icon: Gift, color: 'text-red-600' },
    admin_cashouts: { label: 'Admin Cash Outs', icon: Wallet, color: 'text-slate-700' },
    loyalty_deductions: { label: 'Loyalty Point Deductions', icon: MinusCircle, color: 'text-rose-600' },
    shop_referral_first_pay: { label: 'Shop referrals first pay', icon: Gift, color: 'text-fuchsia-600' },
    agent_commission: { label: 'Agent Commission Payouts', icon: UserCog, color: 'text-fuchsia-600' },
  };

  if (loading || !data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm text-slate-500">Loading finance data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { admin_revenue, shop_order_money, agent_money, total_money_held, pending_orders, delivery_fees, delivery_owed, period } = data;
  const periodLabel = period?.label || (selMonth === -1 ? 'All time' : (selMonth === 0 ? `${selYear}` : `${MONTH_NAMES[selMonth - 1]} ${selYear}`));
  const isCurrentPeriod = selMonth === (_now.getMonth() + 1) && selYear === _now.getFullYear();
  const resetToCurrentMonth = () => { setSelYear(_now.getFullYear()); setSelMonth(_now.getMonth() + 1); };

  // ===== Analytics chart data (derived from time series + current snapshot) =====
  const tsData = (timeseries || []).map(s => ({ ...s }));
  const heldBreakdown = [
    { name: 'Admin Available', value: Math.max(0, admin_revenue?.available_balance || 0), color: '#b4f56a' },
    { name: 'Shop Wallets', value: Math.max(0, shop_order_money?.total || 0), color: '#5df6fc' },
    { name: 'Agent Wallets', value: Math.max(0, agent_money?.total || 0), color: '#ec4899' },
    { name: 'Pending Orders', value: Math.max(0, pending_orders?.total || 0), color: '#f59e0b' },
    { name: 'Held Delivery', value: Math.max(0, delivery_fees?.total_unreleased || 0), color: '#06b6d4' },
  ].filter(d => d.value > 0);
  const heldTotalForDonut = heldBreakdown.reduce((s, d) => s + d.value, 0);
  // profit MoM delta (use the latest months that actually have activity)
  const monthsWithData = tsData.filter(d => (d.orders || 0) > 0 || (d.profit || 0) !== 0 || (d.subscriptions || 0) !== 0 || (d.commissions || 0) !== 0);
  const relevantMonths = monthsWithData.length ? monthsWithData : tsData;
  const profitNow = relevantMonths.length ? relevantMonths[relevantMonths.length - 1].profit : 0;
  const profitNowLabel = relevantMonths.length ? relevantMonths[relevantMonths.length - 1].label : '—';
  const profitPrev = relevantMonths.length >= 2 ? relevantMonths[relevantMonths.length - 2].profit : 0;
  const profitDelta = profitPrev !== 0 ? Math.round(((profitNow - profitPrev) / Math.abs(profitPrev)) * 100) : (profitNow > 0 ? 100 : 0);
  const ytdProfit = tsData.reduce((s, d) => s + (d.profit || 0), 0);
  const bestMonth = tsData.reduce((b, d) => (d.profit > (b?.profit ?? -Infinity) ? d : b), null);
  const totalOutflows = tsData.reduce((s, d) => s + (d.monthly_credits || 0) + (d.agent_payouts || 0) + (d.loyalty_deductions || 0), 0);

  const CHART_GRAD = { profit: '#10b981', subs: '#3b82f6', comm: '#5df6fc', svc: '#f59e0b', credits: '#ef4444', payouts: '#ec4899' };

  const handleReleaseDeliveryFee = async (feeId) => {
    try {
      await api.admin.releaseDeliveryFee(feeId);
      toast.success('Delivery fee released successfully');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to release delivery fee');
    }
  };

  const handleSettleDeliveryCash = async (orderId) => {
    try {
      await api.admin.settleDeliveryCash(orderId);
      toast.success('Order marked as paid');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark as paid');
    }
  };

  const handleSettleDeliveryCashBulk = async (agentId) => {
    try {
      const { data: r } = await api.admin.settleDeliveryCashBulk(agentId);
      toast.success(r.message || 'Bulk settle complete');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to settle');
    }
  };

  const handleResetRevenue = async () => {
    try {
      setResetLoading(true);
      await api.admin.resetRevenue();
      toast.success('Revenue & profit reset to $0');
      await fetchData();
      await fetchCashoutHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset revenue');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 min-h-screen" data-testid="admin-finance-center">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-indigo-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Finance Center</h1>
                <p className="text-slate-500 text-xs sm:text-sm">Complete overview of platform finances</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setAdjustOpen(true)} size="sm" className="gap-1.5 rounded-full text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm shadow-orange-200" data-testid="adjust-btn">
                <Settings className="h-3.5 w-3.5" /> Adjust
              </Button>
              <Button onClick={() => handleDownloadCsv('all')} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" data-testid="download-csv-btn">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button onClick={fetchData} variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" data-testid="refresh-btn">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-full text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300" data-testid="reset-revenue-btn">
                    <RefreshCw className="h-3.5 w-3.5" /> Reset Revenue &amp; Profit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="reset-revenue-dialog">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" /> Reset Revenue &amp; Profit?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-sm text-slate-600 space-y-2">
                        <p>This permanently resets <strong>both Total Revenue and Admin Profit to $0</strong>. It clears:</p>
                        <ul className="list-disc pl-5 space-y-0.5 text-slate-500">
                          <li>Subscription revenue records</li>
                          <li>Order commission amounts (set to $0)</li>
                          <li>Profit ledger (platform services, credits, loyalty deductions)</li>
                          <li>Manual revenue adjustments</li>
                          <li>Admin cash-out history (available balance)</li>
                        </ul>
                        <p className="text-red-500 font-medium">Shop wallets &amp; orders are kept. This cannot be undone.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="reset-revenue-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetRevenue} disabled={resetLoading} className="bg-red-600 hover:bg-red-700" data-testid="reset-revenue-confirm">
                      {resetLoading ? 'Resetting…' : 'Reset Everything'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Total Money Held + Profit headline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 border-0 text-white shadow-xl overflow-hidden relative" data-testid="total-money-card">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-200 text-sm font-medium">Total Money Held</p>
                  <p className="text-4xl font-bold mt-1">{formatCurrency(total_money_held)}</p>
                  <p className="text-violet-200 text-xs mt-2">Live balances + pending orders + held delivery fees{period?.active ? ' (flows for ' + periodLabel + ')' : ''}</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <DollarSign className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 border-0 text-white shadow-xl overflow-hidden relative" data-testid="period-profit-card">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Admin Profit · {periodLabel}</p>
                  <p className="text-4xl font-bold mt-1" data-testid="period-profit-value">{formatCurrency(admin_revenue?.admin_profit)}</p>
                  <p className="text-emerald-100 text-xs mt-2">Subscriptions + Commissions + Adjustments − Credits − Payouts</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="admin-revenue" className="w-full">
          <TabsList className="bg-white border border-slate-200 p-1.5 rounded-2xl flex-wrap gap-1 h-auto shadow-sm">
            <TabsTrigger value="admin-revenue" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm px-3 sm:px-4 py-2.5 font-semibold transition-all duration-300" data-testid="tab-admin-revenue">
              <DollarSign className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Admin Revenue
            </TabsTrigger>
            <TabsTrigger value="shop-money" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm px-3 sm:px-4 py-2.5 font-semibold transition-all duration-300" data-testid="tab-shop-money">
              <Store className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Shop Money
            </TabsTrigger>
            <TabsTrigger value="agent-money" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-fuchsia-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm px-3 sm:px-4 py-2.5 font-semibold transition-all duration-300" data-testid="tab-agent-money">
              <UserCog className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Agent Money {agent_money?.agents?.length > 0 && <Badge className="ml-1 bg-white/20 text-current text-[9px] px-1.5">{agent_money.agents.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="pending-orders" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm px-3 sm:px-4 py-2.5 font-semibold transition-all duration-300" data-testid="tab-pending-orders">
              <Clock className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Pending {pending_orders?.orders?.length > 0 && <Badge className="ml-1 bg-white/20 text-current text-[9px] px-1.5">{pending_orders.orders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="delivery-fees" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm px-3 sm:px-4 py-2.5 font-semibold transition-all duration-300" data-testid="tab-delivery-fees">
              <Truck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Delivery {delivery_fees?.fees?.filter(f => !f.released)?.length > 0 && <Badge className="ml-1 bg-white/20 text-current text-[9px] px-1.5">{delivery_fees.fees.filter(f => !f.released).length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Admin Revenue Tab */}
          <TabsContent value="admin-revenue" className="mt-4">
            <div className="space-y-4">
              {/* Admin Profit - main metric */}
              <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200" data-testid="admin-profit-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Admin Profit</p>
                      <p className="text-3xl font-bold text-emerald-800 mt-1">{formatCurrency(admin_revenue.admin_profit ?? admin_revenue.net_total)}</p>
                      <p className="text-xs text-emerald-600 mt-1">Subscriptions + Commissions + Adjustments + Platform Services − (New Shop Credits + Monthly Credits) − Loyalty Deductions − Shop Referral Payouts</p>
                      <p className="text-[11px] text-emerald-500 mt-1 italic">Profit is business earnings (does NOT subtract admin cash-outs)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-emerald-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Available Balance - after cashouts */}
              <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200" data-testid="available-balance-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Available Balance</p>
                      <p className="text-2xl font-bold text-cyan-800 mt-1">{formatCurrency(admin_revenue.available_balance ?? Math.max(0, (admin_revenue.admin_profit ?? admin_revenue.net_total ?? 0) - (admin_revenue.admin_cashouts ?? 0)))}</p>
                      <p className="text-[11px] text-cyan-600 mt-1">Admin Profit − Admin Cash Outs (${(admin_revenue.admin_cashouts ?? 0).toFixed(2)} withdrawn)</p>
                    </div>
                    <Button size="sm" onClick={() => setCashoutOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-xs" data-testid="admin-cashout-open-btn">
                      <ArrowDown className="h-3 w-3 mr-1" /> Cash Out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div onClick={() => openSection('subscriptions')} className="cursor-pointer">
                  <StatCard
                    title="Subscriptions"
                    value={formatCurrency(admin_revenue.subscriptions)}
                    icon={CreditCard}
                    color="text-blue-600"
                    subtext="From shop subscription payments"
                  />
                </div>
                <div onClick={() => openSection('commissions')} className="cursor-pointer">
                  <StatCard
                    title="Commissions"
                    value={formatCurrency(admin_revenue.commissions)}
                    icon={TrendingUp}
                    color="text-emerald-600"
                    subtext="From order commission fees"
                  />
                </div>
                <div onClick={() => openSection('adjustments')} className="cursor-pointer">
                  <StatCard
                    title="Adjustments"
                    value={formatCurrency(admin_revenue.adjustments)}
                    icon={Settings}
                    color="text-orange-600"
                    subtext="Manual revenue adjustments"
                  />
                </div>
                <div onClick={() => openSection('platform_services')} className="cursor-pointer">
                  <StatCard
                    title="Platform Services"
                    value={formatCurrency(admin_revenue.platform_services)}
                    icon={Sparkles}
                    color="text-purple-600"
                    subtext="Spin wheel & product boosts"
                  />
                </div>
                <div onClick={() => openSection('monthly_credits')} className="cursor-pointer">
                  <StatCard
                    title="New Shop Credits + Monthly Credits (Given)"
                    value={`-${formatCurrency(admin_revenue.monthly_credits)}`}
                    icon={Gift}
                    color="text-red-600"
                    subtext="Credits given to shops monthly"
                  />
                </div>
                <div onClick={() => openSection('admin_cashouts')} className="cursor-pointer">
                  <StatCard
                    title="Admin Cash Out"
                    value={`-${formatCurrency(admin_revenue.admin_cashouts || 0)}`}
                    icon={Wallet}
                    color="text-slate-700"
                    subtext="Money admin has withdrawn"
                  />
                </div>
                <div onClick={() => openSection('loyalty_deductions')} className="cursor-pointer">
                  <StatCard
                    title="Loyalty Point Deductions (Shop)"
                    value={`-${formatCurrency(admin_revenue.loyalty_deductions || 0)}`}
                    icon={MinusCircle}
                    color="text-rose-600"
                    subtext="Shop payouts for orders where customers redeemed loyalty points"
                  />
                </div>
                <div onClick={() => openSection('shop_referral_first_pay')} className="cursor-pointer" data-testid="finance-shop-referral-first-pay">
                  <StatCard
                    title="Shop referrals first pay"
                    value={`-${formatCurrency(admin_revenue.agent_approval_bonus_payouts || 0)}`}
                    icon={Gift}
                    color="text-fuchsia-600"
                    subtext="$4 bonus paid to agents on referred-shop approval"
                  />
                </div>
                <div onClick={() => openSection('agent_commission')} className="cursor-pointer" data-testid="finance-agent-commission">
                  <StatCard
                    title="Loyalty Point Deductions (Agent)"
                    value={`-${formatCurrency(admin_revenue.agent_commission_payouts || 0)}`}
                    icon={UserCog}
                    color="text-fuchsia-600"
                    subtext="Agents' share of commission on paid orders"
                  />
                </div>
              </div>

              {/* Delivery Cash Owed - flat list of ALL delivered orders (no agent grouping) */}
              {delivery_owed && (delivery_owed.orders || []).length > 0 && (() => {
                const allOrders = (delivery_owed.orders || []);
                const owedOrders = allOrders.filter((o) => !o.settled);
                return (
                <Card className="overflow-hidden border-0 shadow-lg" data-testid="delivery-owed-section">
                  <div className="relative bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-5 text-white overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                    <div className="relative flex items-start justify-between flex-wrap gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                          <Truck className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-widest font-bold opacity-90">Money on its way to you</p>
                          <h3 className="text-2xl font-extrabold mt-0.5">Delivery Cash Owed to Admin</h3>
                          <p className="text-xs text-white/90 mt-1 max-w-md">Cash collected from delivered orders (minus delivery fees) that delivery must hand over to admin.</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Total Owed</p>
                        <p className="text-4xl font-black tracking-tight" data-testid="delivery-owed-total">{formatCurrency(delivery_owed.total || 0)}</p>
                        <p className="text-xs text-white/90 mt-0.5">{delivery_owed.orders_owed_count || 0} unsettled order{(delivery_owed.orders_owed_count || 0) !== 1 ? 's' : ''}</p>
                        {owedOrders.length > 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                className="mt-2 bg-white text-orange-700 hover:bg-orange-50 font-semibold shadow"
                                data-testid="settle-all-orders"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark All Paid
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent data-testid="confirm-paid-all-dialog">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Mark all {owedOrders.length} order(s) as paid?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Confirm you received a total of <span className="font-bold text-orange-700">{formatCurrency(delivery_owed.total || 0)}</span> from delivery. This will set the payment status of all {owedOrders.length} unsettled order(s) to <span className="font-semibold">Paid</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="confirm-paid-all-cancel">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSettleDeliveryCashBulk('all')} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-paid-all-confirm">
                                  Yes, mark all as paid
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-0">
                    {allOrders.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
                        <p className="text-sm font-medium">No delivered orders yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="delivery-owed-table">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                              <th className="text-left px-4 py-2.5">Order</th>
                              <th className="text-left px-4 py-2.5">Customer</th>
                              <th className="text-left px-4 py-2.5 hidden sm:table-cell">Delivered</th>
                              <th className="text-right px-4 py-2.5">Total</th>
                              <th className="text-right px-4 py-2.5">Delivery Fee</th>
                              <th className="text-right px-4 py-2.5">Owed to Admin</th>
                              <th className="text-right px-4 py-2.5">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allOrders.map((o) => (
                              <tr key={o.order_id} className={`hover:bg-orange-50/40 ${o.settled ? 'opacity-60' : ''}`} data-testid={`delivery-owed-row-${o.order_id}`}>
                                <td className="px-4 py-3 font-mono text-slate-600">#{(o.order_id || '').slice(0, 8)}</td>
                                <td className="px-4 py-3 text-slate-700">{o.customer_name || 'Customer'}</td>
                                <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{o.delivered_at ? new Date(o.delivered_at).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(o.total_amount)}</td>
                                <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(o.delivery_fee)}</td>
                                <td className="px-4 py-3 text-right font-bold text-orange-700">{formatCurrency(o.amount_owed)}</td>
                                <td className="px-4 py-3 text-right">
                                  {o.settled ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full" data-testid={`paid-badge-${o.order_id}`}>
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                                    </span>
                                  ) : (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" className="h-7 text-[11px] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-sm" data-testid={`paid-order-${o.order_id}`}>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Paid
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent data-testid="confirm-paid-dialog">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Mark this order as paid?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Confirm you received <span className="font-bold text-orange-700">{formatCurrency(o.amount_owed)}</span> for order <span className="font-mono">#{(o.order_id || '').slice(0, 8)}</span> from delivery. This will set the order's payment status to <span className="font-semibold">Paid</span>.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel data-testid="confirm-paid-cancel">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleSettleDeliveryCash(o.order_id)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-paid-confirm">
                                          Yes, mark as paid
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                              <td className="px-4 py-3" colSpan={5}>Total owed from {owedOrders.length} delivered order{owedOrders.length !== 1 ? 's' : ''}</td>
                              <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(delivery_owed.total || 0)}</td>
                              <td className="px-4 py-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })()}

              {/* Commission Analytics Breakdown */}
              {admin_revenue.commission_breakdown && admin_revenue.commission_breakdown.length > 0 ? (
                <Card className="border border-slate-100" data-testid="commission-breakdown-section">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">Commission Breakdown by Shop</h3>
                        <p className="text-[10px] text-slate-400">Detailed commission analytics per shop</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-xs">{formatCurrency(admin_revenue.commissions)} total</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Shop</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Commission Type</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Rate</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Orders</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Order Value</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Commission Earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admin_revenue.commission_breakdown.map((shop, idx) => (
                            <tr key={shop.shop_id || idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`commission-row-${shop.shop_id}`}>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                                    <Store className="h-3 w-3 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800">{shop.shop_name}</p>
                                    <Badge variant="outline" className="text-[8px] mt-0.5">{(shop.tier || 'starter').charAt(0).toUpperCase() + (shop.tier || 'starter').slice(1)}</Badge>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge className={`text-[9px] ${
                                  shop.commission_type === 'on_shop' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                                  shop.commission_type === 'half_half' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                                  'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                }`}>
                                  {shop.commission_type === 'on_shop' ? 'On Shop' : shop.commission_type === 'half_half' ? 'Half/Half' : 'On Customer'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{shop.commission_percentage !== null && shop.commission_percentage !== undefined ? `${shop.commission_percentage}%` : '—'}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">{shop.order_count}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(shop.total_order_value)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatCurrency(shop.total_commission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-slate-100" data-testid="commission-breakdown-section">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">Commission Breakdown by Shop</h3>
                        <p className="text-[10px] text-slate-400">Detailed commission analytics per shop</p>
                      </div>
                    </div>
                    <div className="text-center py-6 text-slate-400">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No commission data yet</p>
                      <p className="text-[10px] mt-1">Commission breakdown will appear once orders with commissions are processed</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <p className="text-xs text-slate-400 text-center">Click any section above to view its transactions</p>

              {/* Recent Cash Outs summary (action lives in Available Balance card above) */}
              {cashoutHistory.length > 0 && (
                <Card className="border" data-testid="admin-cashout-section">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="h-4 w-4 text-slate-600" />
                      <h3 className="font-semibold text-sm text-slate-800">Recent Admin Cash Outs</h3>
                      <Badge variant="outline" className="ml-auto text-[10px]">Total: {formatCurrency(totalCashedOut)}</Badge>
                    </div>
                    <div className="space-y-1">
                      {cashoutHistory.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg p-2 border">
                          <span className="text-slate-600 truncate max-w-[60%]">{c.note}</span>
                          <div className="text-right">
                            <span className="font-bold text-slate-700">{formatCurrency(c.amount)}</span>
                            <p className="text-[9px] text-slate-400">{formatDate(c.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Admin Cashout Dialog */}
            <Dialog open={cashoutOpen} onOpenChange={setCashoutOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                    Cash Out Revenue
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <p className="text-xs text-emerald-600">Available to cash out</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(Math.max(0, (admin_revenue.net_total || 0) - totalCashedOut))}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Amount ($)</label>
                    <input type="number" min="0.01" step="0.01" value={cashoutAmount} onChange={(e) => setCashoutAmount(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-xl text-lg" placeholder="Enter amount..." data-testid="admin-cashout-amount" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Note (optional)</label>
                    <input type="text" value={cashoutNote} onChange={(e) => setCashoutNote(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" placeholder="Reason for cash out..." />
                  </div>
                  <Button onClick={handleAdminCashout} disabled={cashoutLoading || !cashoutAmount || parseFloat(cashoutAmount) <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="admin-cashout-confirm">
                    {cashoutLoading ? 'Processing...' : `Cash Out $${parseFloat(cashoutAmount || 0).toFixed(2)}`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Shop Order Money Tab */}
          <TabsContent value="shop-money" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200" data-testid="shop-money-total-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Total Shop Money (Not Cashed Out)</p>
                      <p className="text-3xl font-bold text-blue-800 mt-1">{formatCurrency(shop_order_money.total)}</p>
                      <p className="text-xs text-blue-600 mt-1">Sum of all shop wallet balances (without delivery fees)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Store className="h-6 w-6 text-blue-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shops Table */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Shop Wallet Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="shop-money-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Shop</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Tier</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Wallet Balance</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Pending Cashout</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Total Cashed Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shop_order_money.shops.map((shop) => (
                          <tr key={shop.shop_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900">{shop.shop_name}</td>
                            <td className="py-3 px-4">
                              <Badge variant={shop.tier === 'pro' ? 'default' : 'secondary'} className={`text-xs ${shop.tier === 'pro' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                                {shop.tier?.charAt(0).toUpperCase() + shop.tier?.slice(1)}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(shop.wallet_balance)}</td>
                            <td className="py-3 px-4 text-right text-orange-600">{formatCurrency(shop.pending_cashout)}</td>
                            <td className="py-3 px-4 text-right text-slate-500">{formatCurrency(shop.total_cashed_out)}</td>
                          </tr>
                        ))}
                        {shop_order_money.shops.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">No shops with wallet balance</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Agent Money Tab (between Shop Money and Pending) */}
          <TabsContent value="agent-money" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-fuchsia-200" data-testid="agent-money-total-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">Total Agent Money (Not Cashed Out)</p>
                      <p className="text-3xl font-bold text-fuchsia-800 mt-1">{formatCurrency(agent_money?.total || 0)}</p>
                      <p className="text-xs text-fuchsia-600 mt-1">Wallet balances held by all referral agents</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[11px] uppercase text-amber-700 font-semibold">Pending Cash-outs</p>
                        <p className="text-xl font-bold text-amber-800">{formatCurrency(agent_money?.pending_cashout_amount || 0)}</p>
                        <p className="text-[11px] text-amber-600">{agent_money?.pending_cashout_count || 0} request(s)</p>
                      </div>
                      <Button onClick={() => navigate('/admin/agent-cashouts')} size="sm" variant="outline" className="border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5"/>Cash-out Requests
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2"><UserCog className="h-4 w-4 text-fuchsia-600"/>Referral Agents & Their Wallets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Agent</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Referral Code</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Comm. Share</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Approval Bonus</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Referred</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Wallet</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Lifetime Earned</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Cashed Out</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Pending Cashout</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(agent_money?.agents || []).map((a) => (
                          <tr key={a.agent_id} className="border-b border-slate-100 hover:bg-slate-50/50" data-testid={`agent-money-row-${a.agent_id}`}>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{a.name}</div>
                              <div className="text-[11px] text-slate-500">{a.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700">{a.referral_code || '—'}</code>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-700 font-medium"><Percent className="inline w-3 h-3 text-slate-400"/> {Number(a.commission_share_percent ?? 30).toFixed(0)}%</td>
                            <td className="py-3 px-4 text-right text-slate-700 font-medium">${Number(a.approval_bonus_amount ?? 4).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{a.referred_shops_approved || 0} / {a.referred_shops_count || 0}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatCurrency(a.wallet_balance)}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(a.total_earned)}</td>
                            <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(a.total_cashed_out)}</td>
                            <td className="py-3 px-4 text-right text-amber-700">{formatCurrency(a.pending_cashout_amount)}</td>
                            <td className="py-3 px-4 text-right">
                              <Button size="sm" variant="outline" onClick={() => navigate('/admin/agents')} className="h-7 text-[11px]"><Eye className="w-3 h-3 mr-1"/>View</Button>
                            </td>
                          </tr>
                        ))}
                        {(!agent_money?.agents || agent_money.agents.length === 0) && (
                          <tr><td colSpan={10} className="py-8 text-center text-slate-400">No referral agents yet. Create one from Admin → Agents.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pending Orders Tab (Wallet/Card paid, not yet fully settled) */}
          <TabsContent value="pending-orders" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200" data-testid="pending-orders-total-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Total Pending Orders Money</p>
                      <p className="text-3xl font-bold text-amber-800 mt-1">{formatCurrency(pending_orders?.total || 0)}</p>
                      <p className="text-xs text-amber-600 mt-1">Orders paid by wallet or card, not yet set to "paid" status</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-amber-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Pending Orders (Paid by Card or Wallet)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="pending-orders-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Order</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Method</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Total</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Commission</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Delivery</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pending_orders?.orders || []).map((po) => (
                          <tr key={po.order_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs font-medium">#{po.order_id?.slice(0, 8)}</td>
                            <td className="py-3 px-4 text-slate-700">{po.customer_name}</td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`text-[10px] ${po.payment_method === 'wallet' ? 'border-violet-300 text-violet-600' : 'border-blue-300 text-blue-600'}`}>
                                {po.payment_method === 'wallet' ? 'Wallet' : 'Card'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={`text-[10px] ${po.order_status === 'pending' ? 'bg-amber-100 text-amber-700' : po.order_status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                {po.order_status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-bold">{formatCurrency(po.total_amount)}</td>
                            <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(po.commission_amount)}</td>
                            <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(po.delivery_fee)}</td>
                            <td className="py-3 px-4 text-right text-xs text-slate-400">{formatDate(po.created_at)}</td>
                          </tr>
                        ))}
                        {(!pending_orders?.orders || pending_orders.orders.length === 0) && (
                          <tr><td colSpan={8} className="py-8 text-center text-slate-400">No pending wallet/card orders</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Delivery Fees Tab */}
          <TabsContent value="delivery-fees" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Unreleased Delivery Fees</p>
                    <p className="text-3xl font-bold text-blue-800 mt-1">{formatCurrency(delivery_fees?.total_unreleased || 0)}</p>
                    <p className="text-xs text-blue-600 mt-1">Held from paid wallet/card orders</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Released Delivery Fees</p>
                    <p className="text-3xl font-bold text-emerald-800 mt-1">{formatCurrency(delivery_fees?.total_released || 0)}</p>
                    <p className="text-xs text-emerald-600 mt-1">Already released to delivery</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    Delivery Fees (Paid by Card & Wallet)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="delivery-fees-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Order</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Shop</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Released</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(delivery_fees?.fees || []).map((fee) => (
                          <tr key={fee.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs font-medium">#{fee.order_id?.slice(0, 8)}</td>
                            <td className="py-3 px-4 text-slate-700">{fee.shop_name || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{fee.customer_name || '—'}</td>
                            <td className="py-3 px-4">
                              <Badge className={`text-[10px] ${fee.order_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {fee.order_status || 'unknown'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-blue-700">{formatCurrency(fee.amount)}</td>
                            <td className="py-3 px-4 text-center">
                              {fee.released ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {!fee.released && fee.order_status === 'paid' ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50" data-testid={`release-fee-${fee.id}`}>
                                      Release
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Release Delivery Fee?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to release the delivery fee of {formatCurrency(fee.amount)} for order #{fee.order_id?.slice(0, 8)}? This will decrease it from the money held.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleReleaseDeliveryFee(fee.id)} className="bg-blue-600 hover:bg-blue-700">
                                        Confirm Release
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : fee.released ? (
                                <span className="text-xs text-emerald-600">Released</span>
                              ) : (
                                <span className="text-xs text-slate-400">Waiting for paid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!delivery_fees?.fees || delivery_fees.fees.length === 0) && (
                          <tr><td colSpan={7} className="py-8 text-center text-slate-400">No delivery fees yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* ===================== ANALYTICS & GRAPHS ===================== */}
        <div className="pt-2" data-testid="finance-analytics-section">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-200">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Analytics &amp; Insights</h2>
              <p className="text-xs text-slate-500">Profit trends, revenue streams &amp; money-held breakdown {selMonth === -1 ? '(last 12 months)' : `· ${selYear}`}</p>
            </div>
          </div>

          {/* KPI delta strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-2xl p-4 bg-white border border-slate-100 shadow-sm" data-testid="kpi-profit-mom">
              <div className="flex items-center gap-1.5 mb-1"><Activity className="h-3.5 w-3.5 text-emerald-500" /><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest Month Profit</p></div>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(profitNow)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${profitDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {profitDelta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(profitDelta)}% · {profitNowLabel}
              </div>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-slate-100 shadow-sm" data-testid="kpi-ytd-profit">
              <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-indigo-500" /><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{selMonth === -1 ? '12-Month' : selYear} Profit</p></div>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(ytdProfit)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Across {tsData.length} months</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-slate-100 shadow-sm" data-testid="kpi-best-month">
              <div className="flex items-center gap-1.5 mb-1"><Sparkles className="h-3.5 w-3.5 text-amber-500" /><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Best Month</p></div>
              <p className="text-2xl font-black text-slate-900">{bestMonth ? formatCurrency(bestMonth.profit) : '—'}</p>
              <p className="text-[11px] text-slate-400 mt-1">{bestMonth ? bestMonth.label : 'No data'}</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-slate-100 shadow-sm" data-testid="kpi-outflows">
              <div className="flex items-center gap-1.5 mb-1"><MinusCircle className="h-3.5 w-3.5 text-rose-500" /><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Outflows</p></div>
              <p className="text-2xl font-black text-rose-600">{formatCurrency(totalOutflows)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Credits + payouts + loyalty</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Profit trend (area) */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm" data-testid="chart-profit-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><LineChartIcon className="h-4 w-4 text-emerald-500" /> Profit Trend</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={tsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_GRAD.profit} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_GRAD.profit} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${v}`} />
                    <RTooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Profit']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="profit" stroke={CHART_GRAD.profit} strokeWidth={2.5} fill="url(#profitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Money held breakdown (donut) */}
            <Card className="border border-slate-100 shadow-sm" data-testid="chart-held-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-violet-500" /> Money Held Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {heldBreakdown.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">No money currently held</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={heldBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                          {heldBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <RTooltip formatter={(v, n) => [`$${Number(v).toFixed(2)}`, n]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {heldBreakdown.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(d.value)} <span className="text-slate-400">({heldTotalForDonut ? Math.round(d.value / heldTotalForDonut * 100) : 0}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Revenue streams (stacked area) */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm" data-testid="chart-revenue-streams">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-500" /> Revenue Streams</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={tsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${v}`} />
                    <RTooltip formatter={(v, n) => [`$${Number(v).toFixed(2)}`, n]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="subscriptions" stackId="a" fill={CHART_GRAD.subs} radius={[0, 0, 0, 0]} name="Subscriptions" />
                    <Bar dataKey="commissions" stackId="a" fill={CHART_GRAD.comm} radius={[0, 0, 0, 0]} name="Commissions" />
                    <Bar dataKey="platform_services" stackId="a" fill={CHART_GRAD.svc} radius={[4, 4, 0, 0]} name="Services" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Outflows trend (line) */}
            <Card className="border border-slate-100 shadow-sm" data-testid="chart-outflows">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><MinusCircle className="h-4 w-4 text-rose-500" /> Outflows Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={tsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} tickFormatter={(v) => `$${v}`} />
                    <RTooltip formatter={(v, n) => [`$${Number(v).toFixed(2)}`, n]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="monthly_credits" stroke={CHART_GRAD.credits} strokeWidth={2} dot={false} name="Credits" />
                    <Line type="monotone" dataKey="agent_payouts" stroke={CHART_GRAD.payouts} strokeWidth={2} dot={false} name="Agent Payouts" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Transactions Modal */}
        <Dialog open={!!selectedSection} onOpenChange={(open) => { if (!open) setSelectedSection(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="transactions-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedSection && sectionLabels[selectedSection] && (
                  <>
                    {React.createElement(sectionLabels[selectedSection].icon, { className: `h-5 w-5 ${sectionLabels[selectedSection].color}` })}
                    {sectionLabels[selectedSection].label} Transactions
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0">
              {txnLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map((txn, idx) => (
                    <TransactionRow key={txn.id || idx} txn={txn} />
                  ))}
                </div>
              )}
            </div>
            {txnTotalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t">
                <p className="text-xs text-slate-500">Page {txnPage} of {txnTotalPages} ({txnTotal} total)</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={txnPage <= 1} onClick={() => fetchTransactions(selectedSection, txnPage - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={txnPage >= txnTotalPages} onClick={() => fetchTransactions(selectedSection, txnPage + 1)}>Next</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              Adjust Admin Revenue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustType('increase')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  adjustType === 'increase' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <PlusCircle className="h-4 w-4" /> Increase
              </button>
              <button
                onClick={() => setAdjustType('decrease')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  adjustType === 'decrease' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <MinusCircle className="h-4 w-4" /> Decrease
              </button>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Amount ($)</Label>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-1"
                min="0.01"
                step="0.01"
                data-testid="adjust-amount-input"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Note (optional)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g., Manual correction"
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleAdjust}
              disabled={adjustLoading || !adjustAmount || parseFloat(adjustAmount) <= 0}
              className={`w-full ${adjustType === 'increase' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              data-testid="confirm-adjust-btn"
            >
              {adjustLoading ? 'Processing...' : `${adjustType === 'increase' ? 'Increase' : 'Decrease'} by $${parseFloat(adjustAmount || 0).toFixed(2)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
