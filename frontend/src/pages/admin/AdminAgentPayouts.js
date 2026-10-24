import React, { useEffect, useState } from 'react';
import { Wallet, RefreshCw, DollarSign, TrendingDown, Gift, Store, Search } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const AdminAgentPayouts = () => {
  const [data, setData] = useState({ payouts: [], total_agent_paid: 0, total_admin_owed: 0, total_funded_from_loyalty: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyOwed, setOnlyOwed] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.admin.getAgentPayouts();
      setData(data || { payouts: [] });
    } catch { toast.error('Failed to load agent payouts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const rows = (data.payouts || []).filter((r) => {
    if (onlyOwed && !(Number(r.admin_owed) > 0)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.agent_name || '').toLowerCase().includes(q) || (r.shop_name || '').toLowerCase().includes(q) || (r.order_id || '').toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto" data-testid="admin-agent-payouts">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Wallet className="w-3.5 h-3.5" /><span>Agent Payouts</span></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Agent Commission Payouts</h1>
              <p className="text-white/90 text-sm">What each agent earned from referred-shop orders — and what admin funded when loyalty points reduced the order's commission.</p>
            </div>
            <Button variant="secondary" onClick={fetchData} className="bg-white/15 text-white hover:bg-white/25 border-0"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5"><div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><DollarSign className="h-4 w-4 text-emerald-600" /></div><span className="text-xs text-slate-500">Total Paid to Agents</span></div>
            <p className="text-2xl font-extrabold text-emerald-600">{fmt(data.total_agent_paid)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5"><div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-rose-600" /></div><span className="text-xs text-slate-500">Admin Owed (funded from profit)</span></div>
            <p className="text-2xl font-extrabold text-rose-600">{fmt(data.total_admin_owed)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5"><div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Gift className="h-4 w-4 text-amber-600" /></div><span className="text-xs text-slate-500">Funded due to Loyalty Points</span></div>
            <p className="text-2xl font-extrabold text-amber-600">{fmt(data.total_funded_from_loyalty)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agent, shop, or order…" className="pl-9" />
          </div>
          <Button variant={onlyOwed ? 'default' : 'outline'} size="sm" onClick={() => setOnlyOwed(v => !v)} className={onlyOwed ? 'bg-rose-600 hover:bg-rose-700' : ''}>
            {onlyOwed ? 'Showing admin-owed only' : 'Admin-owed only'}
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Wallet className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No agent payouts yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="agent-payouts-table">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5">Agent</th>
                    <th className="text-left px-4 py-2.5">Shop</th>
                    <th className="text-left px-4 py-2.5">Order</th>
                    <th className="text-right px-4 py-2.5">Share %</th>
                    <th className="text-right px-4 py-2.5">Agent Earned</th>
                    <th className="text-right px-4 py-2.5">From Order</th>
                    <th className="text-right px-4 py-2.5">Admin Owed</th>
                    <th className="text-left px-4 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-fuchsia-50/40" data-testid={`agent-payout-row-${r.id}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.agent_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5 text-slate-400" />{r.shop_name || '—'}</span></td>
                      <td className="px-4 py-3 font-mono text-slate-500">#{(r.order_id || '').slice(0, 8)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{Math.round(r.share_percent || 0)}%</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmt(r.agent_amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmt(r.covered_by_order)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(r.admin_owed) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                            {fmt(r.admin_owed)}
                            {r.loyalty_redeemed && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">LOYALTY</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Agents are credited their share to their wallet automatically. <strong>Admin Owed</strong> is the part admin funded from profit because loyalty points reduced the order's collected commission.
        </p>
      </div>
    </AdminLayout>
  );
};

export default AdminAgentPayouts;
