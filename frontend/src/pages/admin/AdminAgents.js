import React, { useEffect, useState } from 'react';
import { Plus, UserPlus, Trash2, Edit, Mail, Phone, MapPin, Sparkles, X, Save, Search, RefreshCw, Wallet, Percent, DollarSign, Store, Link as LinkIcon, Copy, BadgePercent, Users2, ListChecks } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StateSelect from '../../components/StateSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const defaultForm = {
  first_name: '', last_name: '', email: '', phone: '', password: '',
  address: '', state: '', commission_share_percent: 30, approval_bonus_amount: 4,
};

const AdminAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsTab, setDetailsTab] = useState('shops');
  const [detailsData, setDetailsData] = useState({ shops: [], transactions: [] });
  const [allShops, setAllShops] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [busyShopId, setBusyShopId] = useState(null);
  const [removingShop, setRemovingShop] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.admin.listReferralAgents();
      setAgents(data || []);
    } catch (e) { toast.error('Failed to load agents'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ ...defaultForm });
    setEditing(null);
    setCreateOpen(true);
  };
  const openEdit = (a) => {
    setForm({
      first_name: a.first_name || '', last_name: a.last_name || '', email: a.email || '',
      phone: a.phone || '', password: '', address: a.address || '', state: a.state || '',
      commission_share_percent: a.commission_share_percent ?? 30,
      approval_bonus_amount: a.approval_bonus_amount ?? 4,
    });
    setEditing(a);
    setCreateOpen(true);
  };
  const closeForm = () => { setCreateOpen(false); setForm(defaultForm); setEditing(null); };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error('First and last name required');
    if (!form.email.trim()) return toast.error('Email required');
    if (!editing && !form.email.toLowerCase().endsWith('@agent.com')) return toast.error('Email must end with @agent.com');
    if (!form.phone.trim()) return toast.error('Phone required');
    if (!editing && !form.password) return toast.error('Password required for new agent');
    setSaving(true);
    try {
      const payload = { ...form,
        commission_share_percent: form.commission_share_percent === '' ? null : Number(form.commission_share_percent),
        approval_bonus_amount: form.approval_bonus_amount === '' ? null : Number(form.approval_bonus_amount),
      };
      if (editing) {
        if (!payload.password) delete payload.password;
        await api.admin.updateReferralAgent(editing.id, payload);
        toast.success('Agent updated');
      } else {
        await api.admin.createReferralAgent(payload);
        toast.success('Agent created');
      }
      await fetchAll();
      closeForm();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.admin.deleteReferralAgent(deleting.id);
      toast.success('Agent deleted');
      setDeleting(null);
      await fetchAll();
    } catch (e) { toast.error('Failed to delete'); }
  };

  const openDetails = async (a) => {
    setDetails(a);
    setDetailsTab('shops');
    setAssignOpen(false);
    setAssignSearch('');
    try {
      const [s, t, all] = await Promise.all([
        api.admin.getReferralAgentReferredShops(a.id),
        api.admin.getReferralAgentTransactions(a.id),
        api.admin.getShops(),
      ]);
      setDetailsData({ shops: s.data?.shops || [], transactions: t.data?.transactions || [] });
      setAllShops(Array.isArray(all.data) ? all.data : (all.data?.shops || []));
    } catch { toast.error('Failed to load details'); }
  };

  const reloadDetails = async (agentId) => {
    try {
      const [s, t, all] = await Promise.all([
        api.admin.getReferralAgentReferredShops(agentId),
        api.admin.getReferralAgentTransactions(agentId),
        api.admin.getShops(),
      ]);
      setDetailsData({ shops: s.data?.shops || [], transactions: t.data?.transactions || [] });
      setAllShops(Array.isArray(all.data) ? all.data : (all.data?.shops || []));
    } catch {}
  };

  const handleAssignShop = async (shopId) => {
    if (!details) return;
    setBusyShopId(shopId);
    try {
      const { data } = await api.admin.assignShopToAgent(details.id, shopId);
      toast.success(data?.message || 'Shop assigned to agent');
      setAssignSearch('');
      setAssignOpen(false);
      await reloadDetails(details.id);
      await fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to assign shop');
    } finally { setBusyShopId(null); }
  };

  const handleRemoveShop = async () => {
    if (!details || !removingShop) return;
    const shopId = removingShop.id;
    setBusyShopId(shopId);
    try {
      const { data } = await api.admin.removeAgentReferredShop(details.id, shopId);
      toast.success(data?.message || 'Referral removed');
      setRemovingShop(null);
      await reloadDetails(details.id);
      await fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove referral');
    } finally { setBusyShopId(null); }
  };

  const filtered = agents.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || (a.phone || '').includes(q) || (a.referral_code || '').toLowerCase().includes(q);
  });

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const referredShopIds = new Set((detailsData.shops || []).map(s => s.id));
  const assignableShops = (allShops || [])
    .filter(s => !s.referred_by_agent_id && !referredShopIds.has(s.id))
    .filter(s => {
      const q = assignSearch.toLowerCase().trim();
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    })
    .slice(0, 50);

  return (
    <AdminLayout>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" /><span>Referral Agents</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Agents</h1>
              <p className="text-white/80 text-sm">Manage agents who refer shops. Configure their referral bonus and commission share.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => navigate('/admin/agent-cashouts')} className="bg-white/15 text-white hover:bg-white/25 border-0"><Wallet className="w-4 h-4 mr-2"/>Cash-out Requests</Button>
              <Button variant="secondary" onClick={fetchAll} className="bg-white/15 text-white hover:bg-white/25 border-0"><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>
              <Button onClick={openCreate} className="bg-white text-violet-700 hover:bg-white/90" data-testid="agent-add-btn"><UserPlus className="w-4 h-4 mr-2"/>Add Agent</Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input className="flex-1 outline-none text-sm bg-transparent" placeholder="Search by name, email, phone, referral code" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid gap-3 sm:gap-4">
          {loading ? <div className="text-center text-slate-500 py-12">Loading...</div> : filtered.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-slate-200">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              No agents yet. Click "Add Agent" to create one.
            </div>
          ) : filtered.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`agent-card-${a.id}`}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center font-bold text-lg">
                  {(a.first_name || a.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-slate-900 text-base">{a.name}</div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5"/>{a.email}</span>
                    {a.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/>{a.phone}</span>}
                    {a.state && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{a.state}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100"><Wallet className="w-3 h-3"/> Wallet: <b>${Number(a.wallet_balance || 0).toFixed(2)}</b></div>
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100"><Percent className="w-3 h-3"/> Comm share: <b>{Number(a.commission_share_percent ?? 30).toFixed(0)}%</b></div>
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100"><DollarSign className="w-3 h-3"/> Approval bonus: <b>${Number(a.approval_bonus_amount ?? 4).toFixed(2)}</b></div>
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100"><Store className="w-3 h-3"/> Referred: <b>{a.referred_shops_count || 0}</b> ({a.referred_shops_approved || 0} approved)</div>
                    <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-700 border border-slate-200"><BadgePercent className="w-3 h-3"/> Lifetime earned: <b>${Number(a.total_earned || 0).toFixed(2)}</b></div>
                  </div>
                  {a.referral_code && (
                    <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                      <LinkIcon className="w-3.5 h-3.5"/>
                      <span>Referral code:</span>
                      <code className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-slate-800">{a.referral_code}</code>
                      <button className="text-violet-600 hover:underline" onClick={() => copyToClipboard(a.referral_code, 'Code')}><Copy className="w-3 h-3"/></button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openDetails(a)} data-testid={`agent-details-${a.id}`}><ListChecks className="w-3.5 h-3.5 mr-1"/>Details</Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(a)} data-testid={`agent-edit-${a.id}`}><Edit className="w-3.5 h-3.5 mr-1"/>Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(a)} className="text-red-600 border-red-200 hover:bg-red-50" data-testid={`agent-delete-${a.id}`}><Trash2 className="w-3.5 h-3.5 mr-1"/>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Agent' : 'Add Agent'}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} data-testid="agent-form-first-name"/></div>
            <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} data-testid="agent-form-last-name"/></div>
            <div className="sm:col-span-2"><Label>Email * (must end with @agent.com)</Label><Input type="email" placeholder="example@agent.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="agent-form-email"/></div>
            <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+961..." data-testid="agent-form-phone"/></div>
            <div><Label>Password {editing ? '(leave empty to keep)' : '*'}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="agent-form-password"/></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="agent-form-address"/></div>
            <div className="sm:col-span-2"><Label>State</Label><StateSelect value={form.state} onChange={(v) => setForm({ ...form, state: v })} /></div>
            <div>
              <Label className="flex items-center gap-1"><Percent className="w-3.5 h-3.5"/> Commission share %</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.commission_share_percent} onChange={e => setForm({ ...form, commission_share_percent: e.target.value })} data-testid="agent-form-comm"/>
              <p className="text-[11px] text-slate-500 mt-1">% of admin's commission given to this agent on every order of their referred shops</p>
            </div>
            <div>
              <Label className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5"/> Approval bonus ($)</Label>
              <Input type="number" min="0" step="0.01" value={form.approval_bonus_amount} onChange={e => setForm({ ...form, approval_bonus_amount: e.target.value })} data-testid="agent-form-bonus"/>
              <p className="text-[11px] text-slate-500 mt-1">$ credited to wallet when a referred shop gets approved</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" data-testid="agent-form-save">
              <Save className="w-4 h-4 mr-1"/>{saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Agent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details dialog */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users2 className="w-5 h-5 text-violet-600"/> {details?.name}'s referrals & commissions</DialogTitle></DialogHeader>
          <div className="flex border-b border-slate-200 -mt-2 mb-3">
            <button onClick={() => setDetailsTab('shops')} className={`px-4 py-2 text-sm font-medium border-b-2 ${detailsTab === 'shops' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Referred Shops ({detailsData.shops?.length || 0})</button>
            <button onClick={() => setDetailsTab('txns')} className={`px-4 py-2 text-sm font-medium border-b-2 ${detailsTab === 'txns' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Transactions ({detailsData.transactions?.length || 0})</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {detailsTab === 'shops' && (
              <div>
                {/* Assign a shop referral to this agent */}
                <div className="mb-3">
                  {!assignOpen ? (
                    <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} className="border-violet-200 text-violet-700 hover:bg-violet-50" data-testid="agent-assign-shop-open">
                      <Plus className="w-3.5 h-3.5 mr-1"/> Assign a shop to this agent
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Store className="w-4 h-4 text-violet-600"/> Assign a shop referral</div>
                        <button onClick={() => { setAssignOpen(false); setAssignSearch(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">The agent will earn their commission share on this shop's future orders. Only shops without a referral are shown.</p>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white" placeholder="Search shops by name or email..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} data-testid="agent-assign-shop-search"/>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1">
                        {assignableShops.length === 0 ? (
                          <div className="text-center text-slate-400 text-xs py-4">No unreferred shops match.</div>
                        ) : assignableShops.map(s => (
                          <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white">
                            {s.logo ? <img src={s.logo} alt="" className="w-7 h-7 rounded object-cover"/> : <div className="w-7 h-7 rounded bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold">{(s.name||'?').charAt(0)}</div>}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-800 truncate">{s.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">{s.email}</div>
                            </div>
                            <Button size="sm" onClick={() => handleAssignShop(s.id)} disabled={busyShopId === s.id} className="h-7 bg-violet-600 hover:bg-violet-700 text-white text-xs" data-testid={`agent-assign-shop-${s.id}`}>
                              {busyShopId === s.id ? 'Assigning...' : 'Assign'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {(detailsData.shops || []).length === 0 ? <div className="text-center text-slate-500 py-8 text-sm">No referred shops yet.</div> :
                <ul className="divide-y divide-slate-100">
                  {(detailsData.shops || []).map(s => (
                    <li key={s.id} className="py-3 flex items-center gap-3">
                      {s.logo ? <img src={s.logo} alt="" className="w-9 h-9 rounded-lg object-cover"/> : <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center font-semibold">{(s.name||'?').charAt(0)}</div>}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 truncate">{s.email}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full ${s.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{s.status}</span>
                      <Button size="sm" variant="outline" onClick={() => setRemovingShop(s)} disabled={busyShopId === s.id} className="h-7 text-red-600 border-red-200 hover:bg-red-50 text-xs" data-testid={`agent-remove-shop-${s.id}`}>
                        <Trash2 className="w-3.5 h-3.5 mr-1"/> Remove
                      </Button>
                    </li>
                  ))}
                </ul>}
              </div>
            )}
            {detailsTab === 'txns' && (
              (detailsData.transactions || []).length === 0 ? <div className="text-center text-slate-500 py-8 text-sm">No transactions yet.</div> :
              <ul className="divide-y divide-slate-100">
                {(detailsData.transactions || []).map(t => (
                  <li key={t.id} className="py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${t.amount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{t.amount > 0 ? '+' : '-'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{t.type.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500">{t.note}</div>
                      <div className="text-[10px] text-slate-400">{t.created_at?.slice(0, 19).replace('T', ' ')}</div>
                    </div>
                    <div className={`text-sm font-semibold ${t.amount > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{t.amount > 0 ? '+' : ''}${Number(t.amount || 0).toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removingShop} onOpenChange={(o) => !o && setRemovingShop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove referral</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removingShop?.name}</strong> from <strong>{details?.name}</strong>? The agent will no longer receive their commission share on this shop's future orders — commission reverts to the default (admin keeps 100%). Commissions already paid are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveShop} className="bg-red-600 hover:bg-red-700">Remove referral</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{deleting?.name}</strong>? Their referred shops will remain but their wallet history will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminAgents;
