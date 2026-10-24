import React, { useEffect, useState } from 'react';
import { Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Clock, Loader2, Plus, Megaphone, Sparkles, Banknote, TrendingUp, AlertCircle, RefreshCw, Shield, Calendar } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const ShopWallet = () => {
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [cashoutDialogOpen, setCashoutDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('cash');
  const [cashoutNumber, setCashoutNumber] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [renewingNow, setRenewingNow] = useState(false);
  const [minCashout, setMinCashout] = useState(5);

  useEffect(() => { fetchWallet(); fetchSubStatus(); fetchCashoutSettings(); }, []);

  const fetchCashoutSettings = async () => {
    try {
      const { data } = await api.shopWallet.getCashoutSettings();
      setMinCashout(data.min_cashout_amount || 5);
    } catch {}
  };

  const fetchSubStatus = async () => {
    try {
      const { data } = await api.shop.getSubscriptionStatus();
      setSubStatus(data);
    } catch {}
  };

  const fetchWallet = async () => {
    try {
      const { data } = await api.shopWallet.get();
      setWallet(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleRequestTopup = async () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setRequesting(true);
    try {
      await api.shopWallet.requestTopup(parseFloat(requestAmount));
      toast.success('Top-up request sent to admin!');
      setRequestDialogOpen(false);
      setRequestAmount('');
      fetchWallet();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send request'); }
    finally { setRequesting(false); }
  };

  const handleCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (parseFloat(cashoutAmount) > (wallet.balance || 0)) { toast.error('Amount exceeds available balance'); return; }
    if ((cashoutMethod === 'whish' || cashoutMethod === 'omt') && !cashoutNumber.trim()) {
      toast.error('Enter the phone number for Wish Money / OMT'); return;
    }
    setCashingOut(true);
    try {
      await api.shopWallet.requestCashout(parseFloat(cashoutAmount), cashoutMethod, cashoutNumber.trim());
      toast.success('Cash out request submitted! Admin will process it shortly.');
      setCashoutDialogOpen(false);
      setCashoutAmount('');
      setCashoutMethod('cash');
      setCashoutNumber('');
      fetchWallet();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to submit cash out request'); }
    finally { setCashingOut(false); }
  };

  const handleToggleAutoRenew = async (enabled) => {
    try {
      await api.shop.toggleAutoRenew({ enabled, period: subStatus?.auto_renew_period || 'monthly' });
      toast.success(enabled ? 'Auto-renewal enabled' : 'Auto-renewal disabled');
      fetchSubStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update auto-renew'); }
  };

  const handleRenewNow = async () => {
    setRenewingNow(true);
    try {
      const { data } = await api.shop.renewNow({ period: subStatus?.auto_renew_period || 'monthly' });
      toast.success(data.message);
      fetchWallet();
      fetchSubStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to renew subscription'); }
    finally { setRenewingNow(false); }
  };

  // Separate revenue transactions from other transactions
  const revenueTransactions = wallet.transactions?.filter(t => t.type === 'order_revenue') || [];
  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingCashouts = wallet.transactions?.filter(t => t.type === 'cashout_request' && t.status === 'pending') || [];
  const pendingCashoutTotal = pendingCashouts.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const getTypeLabel = (type) => {
    switch (type) {
      case 'order_revenue': return 'Order Revenue';
      case 'cashout_request': return 'Cash Out Request';
      case 'cashout_refund': return 'Cash Out Refund';
      case 'admin_topup': return 'Admin Top-up';
      case 'admin_deduction': return 'Admin Deduction';
      case 'admin_bulk_topup': return 'Bulk Top-up';
      case 'topup_request': return 'Top-up Request';
      case 'subscription_credit': return 'Subscription Credit';
      case 'promotion_spend': return 'Boost Spend';
      case 'spin_purchase': return 'Spin Purchase';
      case 'spin_win': return 'Spin Win';
      case 'subscription_renewal': return 'Subscription Renewal';
      case 'monthly_credit': return 'Monthly Credit';
      default: return type?.replace(/_/g, ' ') || 'Transaction';
    }
  };

  const getTypeColor = (type) => {
    if (['order_revenue', 'admin_topup', 'admin_bulk_topup', 'cashout_refund', 'spin_win', 'subscription_credit', 'monthly_credit'].includes(type)) return 'text-emerald-600 bg-emerald-100';
    if (['cashout_request', 'promotion_spend', 'spin_purchase', 'admin_deduction', 'subscription_renewal', 'boost_payment'].includes(type)) return 'text-red-600 bg-red-100';
    return 'text-slate-600 bg-slate-100';
  };

  if (loading) {
    return <ShopLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></ShopLayout>;
  }

  return (
    <ShopLayout>
      <div className="p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 min-h-screen">
        <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-emerald-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Wallet</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Revenue, credits & cash out management</p>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-xl mb-6">
          <p className="text-emerald-100 text-sm">Digital Wallet Balance</p>
          <p className="text-4xl font-bold mt-1 mb-4" data-testid="wallet-balance">${wallet.balance?.toFixed(2) || '0.00'}</p>
          {pendingCashoutTotal > 0 && (
            <p className="text-emerald-200 text-xs mb-3">
              <AlertCircle className="h-3 w-3 inline mr-1" /> ${pendingCashoutTotal.toFixed(2)} pending cash out
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => setCashoutDialogOpen(true)} className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold" data-testid="cashout-btn">
              <Banknote className="h-4 w-4 mr-1" /> Cash Out
            </Button>
            <Button onClick={() => setRequestDialogOpen(true)} className="bg-white/20 text-white hover:bg-white/30 border-0 font-semibold">
              <Plus className="h-4 w-4 mr-1" /> Request Credits
            </Button>
            <Button onClick={() => window.location.href='/shop/theme'} className="bg-white/20 text-white hover:bg-white/30 border-0 font-semibold">
              <Sparkles className="h-4 w-4 mr-1" /> Buy a Theme
            </Button>
            <Button onClick={() => window.location.href='/shop/boost'} className="bg-white/20 text-white hover:bg-white/30 border-0 font-semibold">
              <Megaphone className="h-4 w-4 mr-1" /> Boost Products
            </Button>
          </div>
        </div>

        {/* Subscription Auto-Renew Section - only shown for shops that have a subscription */}
        {subStatus && subStatus.subscription_required !== false && subStatus.subscription_status !== 'none' && (
          <div className={`rounded-2xl border p-5 mb-6 ${subStatus.is_near_expiry ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`} data-testid="subscription-renew-section">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-violet-600" />
              <h3 className="font-semibold text-slate-900">Subscription Renewal</h3>
              {subStatus.is_near_expiry && (
                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">Expiring Soon!</span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Current Tier</p>
                <p className="font-bold text-slate-900">{subStatus.tier_name}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Days Left</p>
                <p className={`font-bold ${subStatus.days_left !== null && subStatus.days_left <= 7 ? 'text-amber-600' : 'text-slate-900'}`}>{subStatus.days_left ?? '—'} days</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Renewal Price ({subStatus.auto_renew_period || 'monthly'})</p>
                <p className="font-bold text-slate-900">${subStatus.renewal_price?.toFixed(2)}</p>
              </div>
            </div>

            {!subStatus.wallet_sufficient && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2" data-testid="low-balance-warning">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Insufficient wallet balance for renewal</p>
                  <p className="text-xs text-red-600">You need ${subStatus.renewal_price?.toFixed(2)} but have ${subStatus.wallet_balance?.toFixed(2)}. Please add funds.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-6 bg-emerald-500 rounded-full flex items-center justify-end px-1">
                  <div className="w-4 h-4 bg-white rounded-full shadow" />
                </div>
                <div>
                  <p className="text-sm font-medium">Auto-Renew from Wallet <span className="text-emerald-600 text-xs font-semibold ml-1">Always On</span></p>
                  <p className="text-xs text-slate-400">Automatically renews when subscription expires</p>
                </div>
              </div>
              <Button
                onClick={handleRenewNow}
                disabled={renewingNow || !subStatus.wallet_sufficient}
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
                data-testid="renew-now-btn"
              >
                <RefreshCw className={`h-4 w-4 ${renewingNow ? 'animate-spin' : ''}`} />
                {renewingNow ? 'Renewing...' : 'Renew Now'}
              </Button>
              <Button
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to cancel your subscription? Your shop will become inactive after the current period ends.')) return;
                  try {
                    await api.shop.cancelSubscription();
                    toast.success('Subscription cancelled. Your shop will remain active until the end of the current period.');
                    fetchSubStatus();
                  } catch (e) { toast.error(e.response?.data?.detail || 'Failed to cancel subscription'); }
                }}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                data-testid="cancel-subscription-btn"
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
              <span className="text-xs text-slate-500">Available Balance</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">${wallet.balance?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-blue-600" /></div>
              <span className="text-xs text-slate-500">Total Revenue</span>
            </div>
            <p className="text-xl font-bold text-blue-600">${totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><Banknote className="h-4 w-4 text-amber-600" /></div>
              <span className="text-xs text-slate-500">Pending Cash Out</span>
            </div>
            <p className="text-xl font-bold text-amber-600">${pendingCashoutTotal.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center"><Megaphone className="h-4 w-4 text-violet-600" /></div>
              <span className="text-xs text-slate-500">Monthly Credit</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">From your subscription plan</p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            <h3 className="font-semibold">Transaction History</h3>
          </div>
          {wallet.transactions?.length > 0 ? (
            <div className="divide-y">
              {wallet.transactions.map(txn => (
                <div key={txn.id} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${txn.amount > 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {txn.amount > 0 ? <ArrowDownRight className="h-5 w-5 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{txn.note || getTypeLabel(txn.type)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTypeColor(txn.type)}`}>
                        {getTypeLabel(txn.type)}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(txn.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${txn.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${txn.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : txn.status === 'pending' ? 'bg-amber-100 text-amber-700' : txn.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                      {txn.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <Wallet className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No transactions yet</p>
              <p className="text-xs mt-1">Revenue from your orders will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Top-up Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Wallet Top-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Amount (USD)</label>
              <Input type="number" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} placeholder="Enter amount" className="mt-1" step="0.5" min="1" />
            </div>
            <p className="text-xs text-slate-400">Your request will be sent to admin for approval.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleRequestTopup} disabled={requesting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={cashoutDialogOpen} onOpenChange={setCashoutDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" /> Request Cash Out
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-sm text-emerald-700">Available Balance: <strong>${wallet.balance?.toFixed(2) || '0.00'}</strong></p>
            </div>
            <div>
              <label className="text-sm font-medium">Cash Out Amount (USD)</label>
              <Input 
                type="number" 
                value={cashoutAmount} 
                onChange={e => setCashoutAmount(e.target.value)} 
                placeholder="Enter amount" 
                className="mt-1" 
                step="0.5" 
                min="1" 
                max={wallet.balance || 0}
                data-testid="cashout-amount-input"
              />
            </div>
            <Button
              variant="link"
              className="text-xs text-emerald-600 p-0 h-auto"
              onClick={() => setCashoutAmount(String(wallet.balance || 0))}
            >
              Cash out full balance
            </Button>
            <div>
              <label className="text-sm font-medium">Cash Out Method</label>
              <select
                value={cashoutMethod}
                onChange={e => { setCashoutMethod(e.target.value); if (e.target.value === 'cash') setCashoutNumber(''); }}
                className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                data-testid="cashout-method-select"
              >
                <option value="cash">Cash</option>
                <option value="whish">Wish Money</option>
                <option value="omt">OMT</option>
              </select>
            </div>
            {(cashoutMethod === 'whish' || cashoutMethod === 'omt') && (
              <div>
                <label className="text-sm font-medium">{cashoutMethod === 'whish' ? 'Wish Money' : 'OMT'} Number</label>
                <Input
                  type="tel"
                  value={cashoutNumber}
                  onChange={e => setCashoutNumber(e.target.value)}
                  placeholder="e.g. 70 123 456"
                  className="mt-1"
                  data-testid="cashout-method-number-input"
                />
              </div>
            )}
            <p className="text-xs text-slate-400">Your cash out request will be reviewed and processed by admin. The amount will be deducted from your wallet immediately.</p>
            {minCashout > 0 && (
              <p className="text-xs text-amber-600 font-medium">Minimum cash out amount: ${minCashout.toFixed(2)}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCashoutDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button 
                onClick={handleCashout} 
                disabled={cashingOut || !cashoutAmount || parseFloat(cashoutAmount) <= 0 || parseFloat(cashoutAmount) > (wallet.balance || 0) || parseFloat(cashoutAmount) < minCashout || ((cashoutMethod === 'whish' || cashoutMethod === 'omt') && !cashoutNumber.trim())}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                data-testid="submit-cashout-btn"
              >
                {cashingOut ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Banknote className="h-4 w-4 mr-1" />} Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ShopLayout>
  );
};

export default ShopWallet;
