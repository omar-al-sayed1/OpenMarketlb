import React, { useEffect, useState } from 'react';
import {
  Crown, Save, DollarSign, Users, TrendingUp, Wallet, RefreshCw,
  Plus, X, Check, Calendar, Sparkles, Tag, ShoppingBag, Star, Megaphone, Percent
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const DEFAULT_FEATURES = [
  '1 free Lucky Spin every month',
  '2 free product sponsor credits every month',
  'Lower commission on your sales',
  'Full storefront theme customisation',
  'Marketing & boost tools + advanced analytics',
  'Priority customer support',
];

const PRICE_MIN = 15;
const PRICE_MAX = 25;

const AdminSubscriptionTiers = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creditingWallets, setCreditingWallets] = useState(false);

  const [subscription, setSubscription] = useState({
    name: 'Subscription',
    description: '',
    monthly_price: 19,
    yearly_price: 190,
    commission_rate: 10,
    monthly_wallet_credit: 0,
    features: DEFAULT_FEATURES,
    sale_active: false,
    sale_percentage: 0,
  });
  const [stats, setStats] = useState({});
  const [recentPayments, setRecentPayments] = useState([]);
  const [promoSettings, setPromoSettings] = useState({
    promotion_daily_price: 2,
    promotion_enabled: true,
    promotion_max_slots_per_page: 4,
  });
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.adminSubscriptionTiers.get();
      const pro = data?.subscription || data?.tiers?.pro || {};
      setSubscription({
        name: pro.name || 'Subscription',
        description: pro.description || 'Unlock the full seller experience for your shop.',
        monthly_price: Math.max(PRICE_MIN, Math.min(PRICE_MAX, parseFloat(pro.monthly_price) || 19)),
        yearly_price: parseFloat(pro.yearly_price) || 190,
        commission_rate: parseFloat(pro.commission_rate) || 10,
        monthly_wallet_credit: parseFloat(pro.monthly_wallet_credit) || 0,
        features: Array.isArray(pro.features) && pro.features.length > 0 ? pro.features : DEFAULT_FEATURES,
        sale_active: !!pro.sale_active,
        sale_percentage: parseFloat(pro.sale_percentage) || 0,
      });
      setStats(data?.stats || {});
      setRecentPayments(data?.recent_payments || []);
      setPromoSettings({
        promotion_daily_price: data?.promotion_daily_price ?? 2,
        promotion_enabled: data?.promotion_enabled !== false,
        promotion_max_slots_per_page: data?.promotion_max_slots_per_page ?? 4,
      });
    } catch {
      toast.error('Failed to load subscription settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const clampedPrice = Math.max(PRICE_MIN, Math.min(PRICE_MAX, parseFloat(subscription.monthly_price) || 19));
      const payload = {
        subscription: {
          ...subscription,
          monthly_price: clampedPrice,
          yearly_price: parseFloat(subscription.yearly_price) || clampedPrice * 10,
        },
        ...promoSettings,
      };
      await api.adminSubscriptionTiers.update(payload);
      toast.success('Subscription settings saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleMonthlyCredit = async () => {
    setCreditingWallets(true);
    try {
      const { data } = await api.adminWallet.runMonthlyCredit();
      toast.success(data.message || 'Monthly credit applied');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to run monthly credit');
    } finally {
      setCreditingWallets(false);
    }
  };

  const handlePriceChange = (val) => {
    let n = parseFloat(val);
    if (isNaN(n)) n = 19;
    setSubscription(s => ({ ...s, monthly_price: n }));
  };

  const addFeature = () => {
    const f = newFeature.trim();
    if (!f) return;
    setSubscription(s => ({ ...s, features: [...(s.features || []), f] }));
    setNewFeature('');
  };

  const removeFeature = (idx) => {
    setSubscription(s => ({ ...s, features: (s.features || []).filter((_, i) => i !== idx) }));
  };

  if (loading) return (
    <AdminLayout>
      <div className="flex h-full items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    </AdminLayout>
  );

  const isOutOfRange = subscription.monthly_price < PRICE_MIN || subscription.monthly_price > PRICE_MAX;
  const monthlyRevenue = (subscription.monthly_price || 0) * (stats?.active_subscribed || 0);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="admin-subscription-tiers">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 sm:p-8 shadow-xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white blur-3xl"></div>
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-cyan-300 blur-3xl"></div>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Subscription Plan</h1>
                  <p className="text-white/85 text-sm">Single subscription — shops decide whether to subscribe</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMonthlyCredit}
                disabled={creditingWallets}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                data-testid="run-monthly-credit-btn"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${creditingWallets ? 'animate-spin' : ''}`} />
                Monthly Credit
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-violet-600 hover:bg-violet-50 font-bold shadow-lg"
                data-testid="save-tiers-btn"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Shops"
            value={stats?.total_shops ?? 0}
            icon={ShoppingBag}
            color="violet"
          />
          <StatCard
            label="Subscribed"
            value={stats?.active_subscribed ?? 0}
            icon={Crown}
            color="emerald"
            subtitle="active subscribers"
          />
          <StatCard
            label="No Subscription"
            value={stats?.free ?? 0}
            icon={Users}
            color="slate"
            subtitle="free shops"
          />
          <StatCard
            label="Est. Monthly"
            value={`$${monthlyRevenue.toFixed(0)}`}
            icon={DollarSign}
            color="rose"
            subtitle="recurring revenue"
          />
        </div>

        {/* Main Subscription Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Card */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="sticky top-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-3 tracking-wider">Live Preview</p>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 shadow-xl text-white">
                <div className="absolute inset-0 opacity-15">
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white blur-2xl"></div>
                  <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300 blur-2xl"></div>
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                      <Crown className="h-5 w-5 text-yellow-300" />
                    </div>
                    <span className="text-xs uppercase tracking-widest font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                      <Sparkles className="h-3 w-3 inline mr-0.5" /> Featured
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold mb-1">{subscription.name || 'Subscription'}</h3>
                  <p className="text-sm text-white/80 mb-5 line-clamp-3">{subscription.description}</p>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black tracking-tighter">${subscription.monthly_price.toFixed(2)}</span>
                    <span className="text-sm text-white/70 font-medium">/mo</span>
                  </div>
                  <p className="text-xs text-white/60 mb-5">or ${subscription.yearly_price.toFixed(0)}/year</p>

                  <div className="space-y-2 mb-5">
                    {(subscription.features || []).slice(0, 6).map((f, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <div className="mt-0.5 p-0.5 rounded-full bg-emerald-400 flex-shrink-0">
                          <Check className="h-3 w-3 text-emerald-900" strokeWidth={3} />
                        </div>
                        <span className="text-white/90">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5 text-center text-xs text-white/85">
                    Shops can choose to subscribe or use the marketplace without a subscription
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <strong className="block mb-1">Note</strong>
                Price is restricted to <strong>${PRICE_MIN}-${PRICE_MAX}/month</strong> range.
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="lg:col-span-2 order-1 lg:order-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-3 border-b border-violet-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-violet-600" /> Subscription Configuration
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <Label className="text-xs mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-violet-500" /> Plan Name
                  </Label>
                  <Input
                    value={subscription.name}
                    onChange={e => setSubscription({ ...subscription, name: e.target.value })}
                    className="rounded-lg"
                    data-testid="plan-name-input"
                  />
                </div>

                <div>
                  <Label className="text-xs mb-1.5 flex items-center gap-1">
                    Description
                  </Label>
                  <Textarea
                    value={subscription.description}
                    onChange={e => setSubscription({ ...subscription, description: e.target.value })}
                    className="rounded-lg min-h-[60px]"
                    placeholder="What shops get with the subscription"
                    data-testid="description-input"
                  />
                </div>

                {/* Pricing */}
                <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-xl p-4">
                  <Label className="text-xs mb-3 flex items-center gap-1 text-rose-700 font-semibold uppercase tracking-wider">
                    <DollarSign className="h-3.5 w-3.5" /> Pricing (${PRICE_MIN}–${PRICE_MAX} range)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1">Monthly Price ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <Input
                          type="number"
                          min={PRICE_MIN}
                          max={PRICE_MAX}
                          step="0.5"
                          value={subscription.monthly_price}
                          onChange={e => handlePriceChange(e.target.value)}
                          className={`pl-7 rounded-lg ${isOutOfRange ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                          data-testid="monthly-price-input"
                        />
                      </div>
                      {isOutOfRange && (
                        <p className="text-xs text-red-600 mt-1">Price will be clamped to ${PRICE_MIN}-${PRICE_MAX}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs mb-1">Yearly Price ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <Input
                          type="number" min="0" step="1"
                          value={subscription.yearly_price}
                          onChange={e => setSubscription({ ...subscription, yearly_price: parseFloat(e.target.value) || 0 })}
                          className="pl-7 rounded-lg"
                          data-testid="yearly-price-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price slider */}
                  <div className="mt-4">
                    <input
                      type="range"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step="0.5"
                      value={Math.max(PRICE_MIN, Math.min(PRICE_MAX, subscription.monthly_price))}
                      onChange={e => handlePriceChange(e.target.value)}
                      className="w-full h-2 bg-rose-100 rounded-full appearance-none cursor-pointer accent-rose-500"
                      data-testid="price-slider"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-0.5">
                      <span>${PRICE_MIN}</span>
                      <span className="font-bold text-rose-600">${subscription.monthly_price.toFixed(1)}/mo</span>
                      <span>${PRICE_MAX}</span>
                    </div>
                  </div>
                </div>

                {/* Wallet credit */}
                <div>
                  <Label className="text-xs mb-1.5 flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-violet-500" /> Monthly Wallet Credit ($)
                  </Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={subscription.monthly_wallet_credit}
                    onChange={e => setSubscription({ ...subscription, monthly_wallet_credit: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg"
                    data-testid="wallet-credit-input"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Bonus wallet balance given to subscribed shops every month</p>
                </div>

                {/* Sale toggle */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-100">
                        <Tag className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <Label className="text-sm font-bold">Subscription Sale</Label>
                        <p className="text-[10px] text-slate-500">Offer a temporary discount on the subscription</p>
                      </div>
                    </div>
                    <Switch
                      checked={subscription.sale_active}
                      onCheckedChange={(v) => setSubscription({ ...subscription, sale_active: v })}
                      data-testid="sale-toggle"
                    />
                  </div>
                  {subscription.sale_active && (
                    <div className="mt-2">
                      <Label className="text-xs mb-1">Discount %</Label>
                      <Input
                        type="number" min="0" max="90"
                        value={subscription.sale_percentage}
                        onChange={e => setSubscription({ ...subscription, sale_percentage: parseFloat(e.target.value) || 0 })}
                        className="rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3 border-b border-emerald-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Star className="h-4 w-4 text-emerald-600" /> Features Included
                </h2>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">These are the live benefits a subscribed shop gets. This exact list is shown on the Become-a-Seller page, the shop dashboard subscribe card, and the welcome popups — edit it here and it updates everywhere.</p>
              </div>
              <div className="p-5 space-y-3">
                <div className="space-y-2">
                  {(subscription.features || []).map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 group" data-testid={`feature-${idx}`}>
                      <div className="p-1 rounded-full bg-emerald-100 flex-shrink-0">
                        <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                      </div>
                      <Input
                        value={f}
                        onChange={e => {
                          const next = [...subscription.features];
                          next[idx] = e.target.value;
                          setSubscription({ ...subscription, features: next });
                        }}
                        className="rounded-lg flex-1"
                      />
                      <button
                        onClick={() => removeFeature(idx)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        data-testid={`remove-feature-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a new feature..."
                    value={newFeature}
                    onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                    className="rounded-lg"
                    data-testid="new-feature-input"
                  />
                  <Button
                    onClick={addFeature}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    data-testid="add-feature-btn"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Promotion Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-3 border-b border-blue-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-blue-600" /> Boost / Promotion Settings
                </h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs mb-1.5">Daily Boost Price ($)</Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={promoSettings.promotion_daily_price}
                    onChange={e => setPromoSettings({ ...promoSettings, promotion_daily_price: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5">Max Slots Per Page</Label>
                  <Input
                    type="number" min="1" max="20"
                    value={promoSettings.promotion_max_slots_per_page}
                    onChange={e => setPromoSettings({ ...promoSettings, promotion_max_slots_per_page: parseInt(e.target.value) || 1 })}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-xs mb-1.5">Promotion Enabled</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={promoSettings.promotion_enabled}
                      onCheckedChange={(v) => setPromoSettings({ ...promoSettings, promotion_enabled: v })}
                    />
                    <span className="text-xs text-slate-500">{promoSettings.promotion_enabled ? 'On' : 'Off'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Recent Subscription Payments
              </h2>
              <span className="text-xs text-slate-500">{recentPayments.length} latest</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Shop</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.slice(0, 10).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{p.shop_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">${(p.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

const StatCard = ({ label, value, icon: Icon, color, subtitle }) => {
  const colors = {
    violet: 'from-violet-50 to-purple-50 border-violet-200/60 text-violet-700',
    emerald: 'from-emerald-50 to-green-50 border-emerald-200/60 text-emerald-700',
    slate: 'from-slate-50 to-gray-50 border-slate-200/60 text-slate-700',
    rose: 'from-rose-50 to-pink-50 border-rose-200/60 text-rose-700',
  };
  const iconBg = {
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    slate: 'bg-slate-100 text-slate-500',
    rose: 'bg-rose-100 text-rose-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg ${iconBg[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="text-3xl font-extrabold">{value}</div>
      {subtitle && <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>}
    </div>
  );
};

export default AdminSubscriptionTiers;
