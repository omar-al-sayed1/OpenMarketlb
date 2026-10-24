import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, PlusSquare, MapPin, Phone, Mail } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const statusBadge = (status) => {
  const map = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    suspended: 'bg-red-50 text-red-700 border-red-100',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const AgentReferredShops = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ shops: [], pending_applications: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.agent.referredShops(); setData(r.data); }
      catch { toast.error('Failed to load'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Store className="w-3.5 h-3.5"/><span>Referred Shops</span></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Your Referred Shops</h1>
              <p className="text-white/80 text-sm">Shops you brought to OpenMarket Lebanon. You earn from every paid order.</p>
            </div>
            <Button onClick={() => navigate('/agent/refer-shop')} className="bg-white text-blue-700 hover:bg-white/90"><PlusSquare className="w-4 h-4 mr-2"/>Refer a Shop</Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">Approved Shops</div>
            <div className="text-2xl font-bold text-emerald-700">{data.shops?.filter(s => s.status === 'approved').length || 0}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">Pending Applications</div>
            <div className="text-2xl font-bold text-amber-700">{data.pending_applications?.length || 0}</div>
          </div>
        </div>

        {loading ? <div className="text-center py-12 text-slate-500">Loading…</div> : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
              <h2 className="text-base font-bold text-slate-800 mb-3">Approved & Active Shops ({data.shops?.length || 0})</h2>
              {!data.shops || data.shops.length === 0 ? <div className="text-sm text-slate-500 py-6 text-center">No referred shops yet. Get started by referring one!</div> : (
                <ul className="divide-y divide-slate-100">
                  {data.shops.map(s => (
                    <li key={s.id} className="py-3 flex items-start gap-3" data-testid={`referred-shop-${s.id}`}>
                      {s.logo ? <img src={s.logo} alt="" className="w-10 h-10 rounded-lg object-cover"/> : <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{(s.name||'?').charAt(0)}</div>}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800">{s.name}</div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                          {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/>{s.email}</span>}
                          {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{s.phone}</span>}
                          {s.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{s.state}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          {s.commission_percentage != null && <span>Commission: <b>{s.commission_percentage}%</b></span>}
                          <span>Created: {s.created_at?.slice(0, 10)}</span>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full border ${statusBadge(s.status)}`}>{s.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 mb-3">Pending Applications ({data.pending_applications?.length || 0})</h2>
              {!data.pending_applications || data.pending_applications.length === 0 ? <div className="text-sm text-slate-500 py-6 text-center">No pending applications.</div> : (
                <ul className="divide-y divide-slate-100">
                  {data.pending_applications.map(a => (
                    <li key={a.id} className="py-3 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">{(a.shop_name||'?').charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800">{a.shop_name}</div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                          {a.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/>{a.email}</span>}
                          {a.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{a.phone}</span>}
                          {a.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{a.state}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">Submitted: {a.created_at?.slice(0, 10)}</div>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AgentLayout>
  );
};

export default AgentReferredShops;
