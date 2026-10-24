import React, { useEffect, useState } from 'react';
import { Receipt, Percent, DollarSign, Store } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AgentCommissions = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.agent.commissions(); setItems(r.data?.commissions || []); }
      catch { toast.error('Failed to load commissions'); }
      finally { setLoading(false); }
    })();
  }, []);

  const total = items.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Receipt className="w-3.5 h-3.5"/><span>Commissions</span></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Order Commissions</h1>
            <p className="text-white/90 text-sm">All commissions earned from orders of your referred shops.</p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 text-white text-sm">Total: <b>${total.toFixed(2)}</b> across <b>{items.length}</b> orders</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          {loading ? <div className="text-center py-12 text-slate-500">Loading…</div> : items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No commissions yet. You earn when orders from your referred shops are paid.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-2">Order</th>
                    <th className="py-2">Shop</th>
                    <th className="py-2">Order Status</th>
                    <th className="py-2 text-right">Order Total</th>
                    <th className="py-2 text-right">Admin Commission</th>
                    <th className="py-2 text-right">Your Earning</th>
                    <th className="py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(t => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0 text-sm">
                      <td className="py-3 font-mono text-xs text-slate-700">#{(t.order_id || '').slice(0, 8)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1 text-slate-700"><Store className="w-3.5 h-3.5 text-slate-400"/>{t.shop_name || '—'}</div>
                      </td>
                      <td className="py-3">
                        <span className={`text-[11px] px-2 py-1 rounded-md ${t.order?.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>{t.order?.payment_status || '—'}</span>
                      </td>
                      <td className="py-3 text-right text-slate-700">${Number(t.order?.total_amount || 0).toFixed(2)}</td>
                      <td className="py-3 text-right text-slate-700">${Number(t.order?.commission_amount || 0).toFixed(2)}</td>
                      <td className="py-3 text-right font-bold text-emerald-700">+${Number(t.amount || 0).toFixed(2)}</td>
                      <td className="py-3 text-right text-xs text-slate-500">{t.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentCommissions;
