import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AgentWallet = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ balance: 0, transactions: [], agent_name: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.agent.wallet(); setData(r.data); }
      catch { toast.error('Failed to load wallet'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3"><Wallet className="w-3.5 h-3.5"/><span>My Wallet</span></div>
              <div className="text-white/80 text-sm">Available Balance</div>
              <div className="text-4xl sm:text-5xl font-extrabold text-white mt-1">${Number(data.balance).toFixed(2)}</div>
            </div>
            <Button onClick={() => navigate('/agent/cashout')} className="bg-white text-emerald-700 hover:bg-white/90" data-testid="agent-cashout-cta"><Banknote className="w-4 h-4 mr-2"/>Request Cash-out</Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800">All Transactions</h2>
            <span className="text-xs text-slate-500">{data.transactions.length} entries</span>
          </div>
          {loading ? <div className="text-center py-12 text-slate-500">Loading…</div> : data.transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-2">Type</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Balance After</th>
                    <th className="py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map(t => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0 text-sm">
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${Number(t.amount) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                          {Number(t.amount) > 0 ? <ArrowDownLeft className="w-3 h-3"/> : <ArrowUpRight className="w-3 h-3"/>}
                          {(t.type || '').replace(/^agent_/, '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700">{t.note}</td>
                      <td className={`py-3 text-right font-semibold ${Number(t.amount) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(t.amount) > 0 ? '+' : ''}${Number(t.amount || 0).toFixed(2)}</td>
                      <td className="py-3 text-right text-slate-600">${Number(t.balance_after || 0).toFixed(2)}</td>
                      <td className="py-3 text-right text-xs text-slate-500">{t.created_at?.slice(0, 19).replace('T', ' ')}</td>
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

export default AgentWallet;
