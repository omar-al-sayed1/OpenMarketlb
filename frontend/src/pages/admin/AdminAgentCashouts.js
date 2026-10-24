import React, { useEffect, useState } from 'react';
import { Wallet, RefreshCw, Check, X, DollarSign, Mail, Phone } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const METHOD_LABELS = { cash: 'Cash', whish: 'Wish Money', omt: 'OMT' };
const methodLabel = (m) => METHOD_LABELS[m] || m || 'Cash';

const AdminAgentCashouts = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirm, setConfirm] = useState(null); // {action:'approve'|'reject', req}

  useEffect(() => { fetchAll(); }, [statusFilter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.admin.listAgentCashoutRequests(statusFilter === 'all' ? undefined : statusFilter);
      setRequests(data || []);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  };

  const doAction = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'approve') {
        await api.admin.approveAgentCashout(confirm.req.id);
        toast.success('Cash-out approved & paid');
      } else {
        await api.admin.rejectAgentCashout(confirm.req.id, '');
        toast.success('Cash-out rejected');
      }
      setConfirm(null);
      await fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  return (
    <AdminLayout>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Wallet className="w-3.5 h-3.5" /><span>Agent Cash-outs</span></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Agent Cash-out Requests</h1>
              <p className="text-white/90 text-sm">Review and approve agents' cash-out requests.</p>
            </div>
            <div className="flex gap-2 items-center">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-white/15 text-white border-0 text-sm outline-none">
                <option value="pending" className="text-slate-800">Pending</option>
                <option value="approved" className="text-slate-800">Approved</option>
                <option value="rejected" className="text-slate-800">Rejected</option>
                <option value="all" className="text-slate-800">All</option>
              </select>
              <Button variant="secondary" onClick={fetchAll} className="bg-white/15 text-white hover:bg-white/25 border-0"><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {loading ? <div className="text-center text-slate-500 py-12">Loading...</div> : requests.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-slate-200">No requests.</div>
          ) : requests.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid={`agent-cashout-${r.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center font-bold">{(r.agent_name || '?').charAt(0)}</div>
                  <div>
                    <div className="font-bold text-slate-900">{r.agent_name}</div>
                    <div className="text-xs text-slate-500 flex gap-3 flex-wrap mt-1">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3"/>{r.agent_email}</span>
                      {r.agent_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{r.agent_phone}</span>}
                    </div>
                    {r.method && <div className="text-xs text-slate-500 mt-1">Method: <b>{methodLabel(r.method)}</b>{r.method_number ? <> · <b>{r.method_number}</b></> : null}</div>}
                    {r.note && <div className="text-xs text-slate-500 mt-1">Note: {r.note}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{r.created_at?.slice(0, 19).replace('T', ' ')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-600"><DollarSign className="w-5 h-5 inline -mt-1"/>{Number(r.amount).toFixed(2)}</div>
                  <div className="text-xs mt-1">
                    {r.status === 'pending' && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">Pending</span>}
                    {r.status === 'approved' && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">Approved</span>}
                    {r.status === 'rejected' && <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-100">Rejected</span>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button size="sm" onClick={() => setConfirm({action: 'approve', req: r})} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Check className="w-3.5 h-3.5 mr-1"/>Approve & Pay</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirm({action: 'reject', req: r})} className="text-red-600 border-red-200 hover:bg-red-50"><X className="w-3.5 h-3.5 mr-1"/>Reject</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === 'approve' ? 'Approve cash-out?' : 'Reject cash-out?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'approve'
                ? `This will deduct $${Number(confirm?.req?.amount || 0).toFixed(2)} from ${confirm?.req?.agent_name}'s wallet. Confirm only after the payment is sent.`
                : `This will reject the request. The agent's wallet will be unchanged.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doAction} className={confirm?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}>{confirm?.action === 'approve' ? 'Approve' : 'Reject'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminAgentCashouts;
