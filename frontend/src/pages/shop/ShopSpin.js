import React, { useEffect, useState } from 'react';
import { Sparkles, Crown, Loader2, History, Clock, Wallet, DollarSign, RotateCcw, Zap, Gift, Megaphone, Palette, CalendarPlus, Percent } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import SpinWheel from '../../components/SpinWheel';
import { api } from '../../lib/api';
import { toast } from 'sonner';
const ShopSpin = () => {
  const [spinInfo, setSpinInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);
  const [tierInfo, setTierInfo] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [spinRes, tierRes] = await Promise.allSettled([
        api.shopSpin.getInfo(),
        api.shopTier.getInfo()
      ]);
      if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
      if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const isPro = tierInfo?.current_tier === 'pro';

  // Match the admin spin wheel icon mapping so shop UI mirrors admin exactly
  const getOutcomeIcon = (key) => {
    switch (key) {
      case 'free_sponsors_4': return <Megaphone className="h-4 w-4 text-amber-500" />;
      case 'free_sponsor_10_days': return <Megaphone className="h-4 w-4 text-blue-500" />;
      case 'free_theme': return <Palette className="h-4 w-4 text-fuchsia-500" />;
      case 'free_subscription': return <Crown className="h-4 w-4 text-amber-500" />;
      case 'subscription_extension': return <CalendarPlus className="h-4 w-4 text-amber-600" />;
      case 'wallet_credit_small': return <Wallet className="h-4 w-4 text-emerald-500" />;
      case 'wallet_credit_large': return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'commission_reduction': return <Percent className="h-4 w-4 text-blue-500" />;
      case 'another_spin': return <Zap className="h-4 w-4 text-violet-500" />;
      case 'try_again': return <RotateCcw className="h-4 w-4 text-slate-400" />;
      default: return <Gift className="h-4 w-4 text-pink-500" />;
    }
  };

  if (loading) {
    return <ShopLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div></ShopLayout>;
  }

  return (
    <ShopLayout>
      <div className="p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 min-h-screen">
        <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-violet-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-200">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lucky Spin Wheel</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Spin to win rewards for your shop!</p>
            </div>
          </div>
        </div>

        {!isPro ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Spin Card */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <Sparkles className="h-8 w-8 mb-3" />
                <h2 className="text-xl font-bold mb-2">Spin Now!</h2>
                <p className="text-violet-200 text-sm mb-4">
                  {spinInfo?.free_spins > 0
                    ? `You have ${spinInfo.free_spins} free spin${spinInfo.free_spins > 1 ? 's' : ''}!`
                    : `$${spinInfo?.spin_cost || 7} per spin from wallet`}
                </p>
                <div className="bg-white/10 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Free Spins</span><span className="font-bold">{spinInfo?.free_spins || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Spin Cost</span><span className="font-bold">${spinInfo?.spin_cost || 7}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Wallet Balance</span><span className="font-bold">${tierInfo?.wallet_balance?.toFixed(2) || '0.00'}</span></div>
                </div>
                <Button
                  onClick={() => setSpinWheelOpen(true)}
                  className="w-full bg-white text-violet-700 hover:bg-violet-50 font-bold h-12 text-lg"
                  data-testid="open-spin-btn"
                >
                  <Sparkles className="h-5 w-5 mr-2" /> Open Spin Wheel
                </Button>
              </div>

              {/* Subscribe note — only shown to shops without an active subscription */}
              {!spinInfo?.is_subscribed && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold text-amber-800 text-sm">Get a free spin every month</span>
                  </div>
                  <p className="text-xs text-amber-700"><strong>Subscribe to get a free spin per month</strong> — plus more perks for your shop.</p>
                  <Button size="sm" className="mt-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs" onClick={() => window.location.href = '/shop/dashboard'}>
                    <Crown className="h-3 w-3 mr-1" /> Subscribe
                  </Button>
                </div>
              )}

              {/* Possible Rewards */}
              <div className="bg-white rounded-xl border p-5 mt-4">
                <h3 className="font-semibold mb-3">Possible Rewards</h3>
                <div className="space-y-2">
                  {spinInfo?.outcomes?.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {getOutcomeIcon(o.key)}
                      <span className="text-slate-700">{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spin History */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-400" />
                  <h3 className="font-semibold">Spin History</h3>
                </div>
                {spinInfo?.history?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Cost</th>
                          <th className="text-left p-3 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {spinInfo.history.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="p-3 text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</td>
                            <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.spin_type === 'monthly_free' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{h.spin_type?.replace('_', ' ')}</span></td>
                            <td className="p-3">{h.cost > 0 ? `$${h.cost.toFixed(2)}` : 'Free'}</td>
                            <td className="p-3"><div className="flex items-center gap-1">{getOutcomeIcon(h.outcome_key)}<span className="text-xs">{h.outcome_label}</span></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No spins yet</p>
                    <p className="text-sm">Spin the wheel to see your history here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Spin Card */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <Sparkles className="h-8 w-8 mb-3" />
                <h2 className="text-xl font-bold mb-2">Spin Now!</h2>
                <p className="text-violet-200 text-sm mb-4">
                  {spinInfo?.free_spins > 0
                    ? `You have ${spinInfo.free_spins} free spin${spinInfo.free_spins > 1 ? 's' : ''}!`
                    : `$${spinInfo?.spin_cost || 7} per spin from wallet`}
                </p>
                <div className="bg-white/10 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Free Spins</span><span className="font-bold">{spinInfo?.free_spins || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Spin Cost</span><span className="font-bold">${spinInfo?.spin_cost || 7}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-violet-200">Wallet Balance</span><span className="font-bold">${tierInfo?.wallet_balance?.toFixed(2) || '0.00'}</span></div>
                </div>
                <Button
                  onClick={() => setSpinWheelOpen(true)}
                  className="w-full bg-white text-violet-700 hover:bg-violet-50 font-bold h-12 text-lg"
                  data-testid="open-spin-btn"
                >
                  <Sparkles className="h-5 w-5 mr-2" /> Open Spin Wheel
                </Button>
              </div>

              {/* Possible Rewards */}
              <div className="bg-white rounded-xl border p-5 mt-4">
                <h3 className="font-semibold mb-3">Possible Rewards</h3>
                <div className="space-y-2">
                  {spinInfo?.outcomes?.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {getOutcomeIcon(o.key)}
                      <span className="text-slate-700">{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spin History */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-400" />
                  <h3 className="font-semibold">Spin History</h3>
                </div>
                {spinInfo?.history?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Cost</th>
                          <th className="text-left p-3 font-medium">Result</th>
                          <th className="text-left p-3 font-medium">Effect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {spinInfo.history.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="p-3 text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.spin_type === 'monthly_free' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {h.spin_type?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3">{h.cost > 0 ? `$${h.cost.toFixed(2)}` : 'Free'}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                {getOutcomeIcon(h.outcome_key)}
                                <span className="text-xs">{h.outcome_label}</span>
                              </div>
                            </td>
                            <td className="p-3 text-xs text-slate-500">
                              {h.applied_effects?.type === 'wallet_credit' && `+$${h.applied_effects.amount}`}
                              {h.applied_effects?.type === 'subscription_extension' && `+${h.applied_effects.days_added} days`}
                              {h.applied_effects?.type === 'another_spin' && 'Free spin'}
                              {h.applied_effects?.type === 'try_again' && '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No spins yet</p>
                    <p className="text-sm">Spin the wheel to see your history here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <SpinWheel
        open={spinWheelOpen}
        onOpenChange={setSpinWheelOpen}
        spinInfo={spinInfo}
        onSpinComplete={(result) => {
          fetchData();
        }}
      />
    </ShopLayout>
  );
};

export default ShopSpin;
