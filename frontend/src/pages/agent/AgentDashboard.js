import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Store, Receipt, Banknote, Percent, DollarSign, Sparkles, Copy, Share2, PlusSquare, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const Card = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</div>
    <div className="text-xs text-slate-500 mt-1">{label}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
  </div>
);

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.agent.dashboard();
        setData(data);
      } catch (e) {
        toast.error('Failed to load dashboard');
      } finally { setLoading(false); }
    })();
  }, []);

  const code = data?.referral_code || '';
  const link = `${window.location.origin}/become-seller?ref=${code}`;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Open a shop on OpenMarket Lebanon',
          text: `Sign up your shop using my referral code ${code}!`,
          url: link,
        });
      } catch {}
    } else {
      copy(link, 'Link');
    }
  };

  if (loading) return <AgentLayout><div className="px-6 py-12 text-center text-slate-500">Loading…</div></AgentLayout>;

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Sparkles className="w-3.5 h-3.5" /><span>Agent Portal</span></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Welcome, {data?.agent?.first_name || 'Agent'} 👋</h1>
            <p className="text-white/80 text-sm">Refer shops, earn commission, and track your wallet — all in one place.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card icon={Wallet} label="Wallet Balance" value={`$${Number(data?.wallet_balance || 0).toFixed(2)}`} color="from-emerald-500 to-teal-500" sub={`Lifetime earned: $${Number(data?.stats?.total_earned || 0).toFixed(2)}`} />
          <Card icon={Store} label="Referred Shops" value={data?.stats?.referred_total ?? 0} color="from-blue-500 to-indigo-500" sub={`${data?.stats?.referred_approved ?? 0} approved`} />
          <Card icon={Receipt} label="Commission Earned" value={`$${Number(data?.stats?.total_commission || 0).toFixed(2)}`} color="from-amber-500 to-orange-500" sub={`Bonus: $${Number(data?.stats?.total_approval_bonus || 0).toFixed(2)}`} />
          <Card icon={Banknote} label="Cashed Out" value={`$${Number(data?.stats?.total_cashed_out || 0).toFixed(2)}`} color="from-fuchsia-500 to-pink-500" sub={data?.stats?.pending_cashout_count ? `${data.stats.pending_cashout_count} pending ($${Number(data?.stats?.pending_cashout_amount || 0).toFixed(2)})` : 'No pending'} />
        </div>

        {/* Referral link card */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center"><Share2 className="w-5 h-5"/></div>
            <div>
              <div className="font-bold text-slate-900">Your Referral Link</div>
              <div className="text-xs text-slate-500">Share this with shop owners. When their shop is approved, you earn <b>${Number(data?.settings?.approval_bonus_amount || 4).toFixed(2)}</b> + <b>{Number(data?.settings?.commission_share_percent || 30).toFixed(0)}%</b> of admin's commission on every order.</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 mb-1">Referral Code</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm font-semibold text-violet-700">{code}</code>
                <button onClick={() => copy(code, 'Code')} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-violet-50"><Copy className="w-3.5 h-3.5 text-slate-500"/></button>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 mb-1">Referral Link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs text-slate-700 truncate">{link}</code>
                <button onClick={() => copy(link, 'Link')} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-violet-50"><Copy className="w-3.5 h-3.5 text-slate-500"/></button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button onClick={shareNative} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"><Share2 className="w-4 h-4 mr-2"/>Share</Button>
            <Button variant="outline" onClick={() => navigate('/agent/refer-shop')}><PlusSquare className="w-4 h-4 mr-2"/>Refer a Shop Now</Button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { to: '/agent/wallet', icon: Wallet, label: 'My Wallet', color: 'from-emerald-500 to-teal-500' },
            { to: '/agent/referred-shops', icon: Store, label: 'Referred Shops', color: 'from-blue-500 to-indigo-500' },
            { to: '/agent/commissions', icon: Receipt, label: 'Commissions', color: 'from-amber-500 to-orange-500' },
            { to: '/agent/cashout', icon: Banknote, label: 'Cash Out', color: 'from-fuchsia-500 to-pink-500' },
          ].map(it => (
            <button key={it.to} onClick={() => navigate(it.to)} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${it.color} text-white flex items-center justify-center`}><it.icon className="w-5 h-5"/></div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm text-slate-800">{it.label}</div>
                <div className="text-[11px] text-slate-500">Open</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400"/>
            </button>
          ))}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Receipt className="w-4 h-4 text-violet-600"/>Recent Activity</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agent/wallet')}>View All →</Button>
          </div>
          {(data?.recent_transactions || []).length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">No transactions yet. Refer your first shop to earn!</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_transactions.map(t => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${Number(t.amount) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {Number(t.amount) > 0 ? <CheckCircle2 className="w-4 h-4"/> : <Clock className="w-4 h-4"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-800">{(t.type || '').replace(/_/g, ' ').replace(/agent\s*/, '').replace(/^./, c => c.toUpperCase())}</div>
                    <div className="text-[11px] text-slate-500 truncate">{t.note}</div>
                  </div>
                  <div className={`text-sm font-semibold ${Number(t.amount) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(t.amount) > 0 ? '+' : ''}${Number(t.amount || 0).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentDashboard;
