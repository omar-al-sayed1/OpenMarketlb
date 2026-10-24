import React, { useEffect, useState } from 'react';
import { Plus, UserPlus, Trash2, Edit, Mail, Phone, MapPin, Shield, X, Save, Search, RefreshCw, Lock, CheckSquare, Square } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StateSelect from '../../components/StateSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const defaultForm = {
  first_name: '', last_name: '', email: '', phone: '', password: '', address: '', state: '', allowed_pages: []
};

const AdminEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [pagesOpen, setPagesOpen] = useState(null);
  const [pagesSelection, setPagesSelection] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([api.admin.listEmployees(), api.admin.getAvailableEmployeePages()]);
      setEmployees(a.data || []);
      setAvailablePages(p.data.pages || []);
      setDefaults(p.data.defaults || []);
    } catch (e) { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ ...defaultForm, allowed_pages: [...defaults] });
    setEditing(null);
    setCreateOpen(true);
  };
  const openEdit = (a) => {
    setForm({
      first_name: a.first_name || '', last_name: a.last_name || '', email: a.email || '',
      phone: a.phone || '', password: '', address: a.address || '', state: a.state || '',
      allowed_pages: a.allowed_pages || []
    });
    setEditing(a);
    setCreateOpen(true);
  };
  const closeForm = () => { setCreateOpen(false); setForm(defaultForm); setEditing(null); };

  const togglePage = (key) => {
    setForm(f => ({ ...f, allowed_pages: f.allowed_pages.includes(key) ? f.allowed_pages.filter(p => p !== key) : [...f.allowed_pages, key] }));
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error('First and last name required');
    if (!form.email.trim()) return toast.error('Email required');
    if (!form.phone.trim()) return toast.error('Phone required');
    if (!editing && !form.password) return toast.error('Password required for new employee');
    setSaving(true);
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.admin.updateEmployee(editing.id, payload);
        toast.success('Employee updated');
      } else {
        await api.admin.createEmployee(form);
        toast.success('Employee created');
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
      await api.admin.deleteEmployee(deleting.id);
      toast.success('Employee deleted');
      setDeleting(null);
      await fetchAll();
    } catch (e) { toast.error('Failed to delete'); }
  };

  const openPages = (a) => { setPagesOpen(a); setPagesSelection(a.allowed_pages || []); };
  const savePages = async () => {
    try {
      await api.admin.setEmployeePages(pagesOpen.id, pagesSelection);
      toast.success('Pages updated');
      setPagesOpen(null);
      await fetchAll();
    } catch (e) { toast.error('Failed to update pages'); }
  };

  const filtered = employees.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || (a.phone || '').includes(q);
  });

  return (
    <AdminLayout>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
                <Shield className="w-3.5 h-3.5" /><span>Employees Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Employees</h1>
              <p className="text-white/80 text-sm">Create internal staff (employees) and configure which pages they can access.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={fetchAll} className="bg-white/15 text-white hover:bg-white/25 border-0"><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>
              <Button onClick={openCreate} className="bg-white text-emerald-700 hover:bg-white/90" data-testid="employee-add-btn"><UserPlus className="w-4 h-4 mr-2"/>Add Employee</Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input className="flex-1 outline-none text-sm bg-transparent" placeholder="Search employees by name, email, phone" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid gap-3 sm:gap-4">
          {loading ? <div className="text-center text-slate-500 py-12">Loading...</div> : filtered.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-slate-200">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              No employees yet. Click "Add Employee" to create one.
            </div>
          ) : filtered.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`employee-card-${a.id}`}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-lg">
                  {(a.first_name || a.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold text-slate-900 text-base">{a.name}</div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5"/>{a.email}</span>
                    {a.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/>{a.phone}</span>}
                    {a.state && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{a.state}</span>}
                  </div>
                  {a.address && <div className="text-xs text-slate-500 mt-1">{a.address}</div>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(a.allowed_pages || []).slice(0, 6).map(p => (
                      <span key={p} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100">{availablePages.find(x => x.key === p)?.label || p}</span>
                    ))}
                    {(a.allowed_pages || []).length > 6 && <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 text-[10px]">+{(a.allowed_pages || []).length - 6} more</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openPages(a)} data-testid={`employee-pages-${a.id}`}><Lock className="w-3.5 h-3.5 mr-1"/>Pages</Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(a)} data-testid={`employee-edit-${a.id}`}><Edit className="w-3.5 h-3.5 mr-1"/>Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(a)} className="text-red-600 border-red-200 hover:bg-red-50" data-testid={`employee-delete-${a.id}`}><Trash2 className="w-3.5 h-3.5 mr-1"/>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Employee' : 'Add Employee'}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} data-testid="employee-form-first-name"/></div>
            <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} data-testid="employee-form-last-name"/></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="employee-form-email"/></div>
            <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+961..." data-testid="employee-form-phone"/></div>
            <div className="sm:col-span-2"><Label>Password {editing ? '(leave empty to keep)' : '*'}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="employee-form-password"/></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="employee-form-address"/></div>
            <div className="sm:col-span-2"><Label>State</Label><StateSelect value={form.state} onChange={(v) => setForm({ ...form, state: v })} /></div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Page Access</Label>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setForm({ ...form, allowed_pages: availablePages.map(p => p.key) })} className="text-emerald-700 hover:underline">Select all</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => setForm({ ...form, allowed_pages: [] })} className="text-slate-500 hover:underline">Clear</button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto p-1">
              {availablePages.map(p => (
                <label key={p.key} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${form.allowed_pages.includes(p.key) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <Checkbox checked={form.allowed_pages.includes(p.key)} onCheckedChange={() => togglePage(p.key)} />
                  <span className="text-sm font-medium text-slate-800">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white" data-testid="employee-form-save">
              <Save className="w-4 h-4 mr-1"/>{saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Employee')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pagesOpen} onOpenChange={(o) => !o && setPagesOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Page access for {pagesOpen?.name}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
            {availablePages.map(p => (
              <label key={p.key} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${pagesSelection.includes(p.key) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <Checkbox checked={pagesSelection.includes(p.key)} onCheckedChange={() => setPagesSelection(s => s.includes(p.key) ? s.filter(x => x !== p.key) : [...s, p.key])} />
                <span className="text-sm font-medium text-slate-800">{p.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagesOpen(null)}>Cancel</Button>
            <Button onClick={savePages} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{deleting?.name}</strong>? This action cannot be undone.</AlertDialogDescription>
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

export default AdminEmployees;
