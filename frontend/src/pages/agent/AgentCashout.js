import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, ArrowLeft, Wallet, Send } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const METHOD_LABELS = { cash: 'Cash', whish: 'Wish Money', omt: 'OMT' };
const methodLabel = (m) => METHOD_LABELS[m] || m || 'Cash';

const AgentCashout = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ amount: '', method: 'cash', method_number: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [w, r] = await Promise.all([api.agent.wallet(), api.agent.myCashouts()]);
      setBalance(w.data?.balance || 0);
      setRequests(r.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (amt > balance) return toast.error(`Insufficient balance ($${balance.toFixed(2)})`);
    if ((form.method === 'whish' || form.method === 'omt') && !form.method_number.trim()) {
      return toast.error('Enter the phone number for Wish Money / OMT');
    }
    setSaving(true);
    try {
      await api.agent.cashoutRequest({ amount: amt, method: form.method, method_number: form.method_number.trim(), note: form.note });
      toast.success('Cash-out request submitted!');
      setForm({ amount: '', method: 'cash', method_number: '', note: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 mb-3 flex items-center gap-1 hover:text-slate-800"><ArrowLeft className="w-4 h-4"/>Back</button>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><Banknote className="w-3.5 h-3.5"/><span>Cash-out</span></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Request a Cash-out</h1>
              <p className="text-white/85 text-sm">Submit a withdrawal request — admin will review and pay out manually.</p>
            </div>
            <div className="text-right">
              <div className="text-white/80 text-xs">Available</div>
              <div className="text-4xl font-extrabold text-white">${Number(balance).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Amount ($) *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="e.g. 25.00" data-testid="agent-cashout-amount" />
            </div>
            <div>
              <Label>Method</Label>
              <select value={form.method} onChange={e => setForm({...form, method: e.target.value, method_number: e.target.value === 'cash' ? '' : form.method_number})} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" data-testid="agent-cashout-method">
                <option value="cash">Cash</option>
                <option value="whish">Wish Money</option>
                <option value="omt">OMT</option>
              </select>
            </div>
            {(form.method === 'whish' || form.method === 'omt') && (
              <div>
                <Label>{form.method === 'whish' ? 'Wish Money' : 'OMT'} Number *</Label>
                <Input value={form.method_number} onChange={e => setForm({...form, method_number: e.target.value})} placeholder="e.g. 70 123 456" data-testid="agent-cashout-number"/>
              </div>
            )}
            <div>
              <Label>Note</Label>
              <Input value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="Optional details" data-testid="agent-cashout-note"/>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white" data-testid="agent-cashout-submit"><Send className="w-4 h-4 mr-2"/>{saving ? 'Submitting…' : 'Submit Request'}</Button>
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h2 className="text-base font-bold text-slate-800 mb-3">My Cash-out Requests</h2>
          {loading ? <div className="text-center py-8 text-slate-500">Loading…</div> : requests.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No cash-out requests yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map(r => (
                <li key={r.id} className="py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center"><Wallet className="w-4 h-4"/></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">${Number(r.amount).toFixed(2)} via {methodLabel(r.method)}{r.method_number ? ` (${r.method_number})` : ''}</div>
                    <div className="text-[11px] text-slate-500">{r.note}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.created_at?.slice(0, 19).replace('T', ' ')}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-full border ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentCashout;
