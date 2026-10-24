import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusSquare, Store, ArrowLeft, ArrowRight, Loader2, UserCheck, Globe, Tag, Gift, Wallet, Megaphone, BadgeCheck } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import StateSelect from '../../components/StateSelect';
import ImageUploader from '../../components/ImageUploader';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AgentReferShop = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ shop_name: '', description: '', email: '', phone: '', address: '', state: '', guest_name: '', logo: '', category_ids: [] });
  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => { fetchCategories(); }, []);
  const fetchCategories = async () => {
    try { const { data } = await api.categories.getAll(true); setAllCategories(data || []); } catch {}
  };

  const toggleCategory = (catId) => {
    setForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter((id) => id !== catId)
        : [...prev.category_ids, catId],
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.shop_name.trim() || !form.phone.trim() || !form.address.trim() || !form.state.trim()) {
      return toast.error('Shop name, phone, address and region are required');
    }
    if (!form.email.trim()) return toast.error('Shop owner email is required');
    if (!form.guest_name.trim()) return toast.error("Shop owner's name is required");
    setSaving(true);
    try {
      await api.agent.fillShop({
        shop_name: form.shop_name,
        description: form.description,
        email: form.email,
        phone: form.phone,
        address: form.address,
        state: form.state,
        guest_name: form.guest_name,
        category_ids: form.category_ids || [],
        logo: form.logo || '',
      });
      toast.success('Shop application submitted — awaiting admin approval.');
      navigate('/agent/referred-shops');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally { setSaving(false); }
  };

  const filteredCategories = allCategories.filter((cat) => {
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase();
    return (cat.name || '').toLowerCase().includes(q) || (cat.name_ar || '').toLowerCase().includes(q);
  });

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1100px] mx-auto w-full">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 mb-3 flex items-center gap-1 hover:text-slate-800" data-testid="refer-back-btn"><ArrowLeft className="w-4 h-4" />Back</button>

        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute top-[-60px] right-[-40px] w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3"><PlusSquare className="w-3.5 h-3.5" /><span>Refer a Shop</span></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Submit a Shop Application</h1>
            <p className="text-white/80 text-sm max-w-2xl">Fill in the shop's details on behalf of the owner — the same application as the public Become a Seller form. The shop will be marked as referred by you. Once admin approves, you earn your approval bonus and ongoing commission share.</p>
          </div>
        </div>

        {/* What the shop will get on approval (referred benefits) */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 mb-6" data-testid="refer-benefits-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center"><Gift className="h-4.5 w-4.5 text-white" /></div>
            <div>
              <p className="text-sm font-bold text-emerald-800">What this shop gets on approval</p>
              <p className="text-[11px] text-emerald-600">Referred shops receive a boosted welcome bonus</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-white/70 border border-emerald-100 px-3.5 py-2.5">
              <Wallet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-700">$3 wallet credit</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/70 border border-emerald-100 px-3.5 py-2.5">
              <Megaphone className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-700">2 free product sponsors</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden" data-testid="refer-shop-form">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center"><Store className="h-5 w-5 text-white" /></div>
              <h2 className="text-xl font-bold text-white">Shop Application</h2>
            </div>
            <div className="flex items-center gap-2">
              {['Owner Info', 'Shop Details', 'Location'].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-[10px] font-bold text-violet-300">{i + 1}</div>
                    <span className="text-xs text-white/60 hidden sm:inline">{step}</span>
                  </div>
                  {i < 2 && <div className="w-8 h-px bg-white/10" />}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Section 1: Owner Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><UserCheck className="h-4 w-4 text-violet-600" /></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Owner Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Owner's Full Name *</Label>
                  <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="John Doe" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-violet-500 focus:ring-violet-500/20" data-testid="refer-guest-name-input" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Owner's Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-violet-500 focus:ring-violet-500/20" data-testid="refer-email-input" />
                </div>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-200" />

            {/* Section 2: Shop Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Store className="h-4 w-4 text-emerald-600" /></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Shop Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Shop Name *</Label>
                  <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} placeholder="e.g. Beirut Boutique" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="refer-shop-name-input" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+961 ..." className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="refer-phone-input" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell us about the shop and what it sells..." rows={3} className="mt-1.5 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="refer-description-input" />
              </div>
              <div>
                <ImageUploader value={form.logo} onChange={(url) => setForm({ ...form, logo: url })} label="Shop Logo (optional)" showUrlInput={true} />
              </div>
              {/* Categories Multi-Select Chips */}
              <div data-testid="refer-categories-section">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-emerald-600" /> Categories
                  </Label>
                  {form.category_ids.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-100" data-testid="refer-categories-count">{form.category_ids.length} selected</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Select all categories the shop will sell in. Admin can edit later.</p>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No categories available yet.</p>
                ) : (
                  <>
                    <div className="relative mb-3">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                      <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Search categories..." className="w-full h-9 pl-9 pr-9 text-xs rounded-lg border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white" data-testid="refer-categories-search" />
                    </div>
                    {filteredCategories.length === 0 ? (
                      <p className="text-xs text-slate-400 italic" data-testid="refer-categories-no-results">No categories match "{categorySearch}"</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1 max-h-52 overflow-y-auto" data-testid="refer-categories-chips">
                        {filteredCategories.map((cat) => {
                          const selected = form.category_ids.includes(cat.id);
                          return (
                            <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)} className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer select-none ${selected ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm hover:bg-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-emerald-300 hover:text-emerald-700'}`} data-testid={selected ? `refer-category-chip-selected-${cat.id}` : `refer-category-chip-unselected-${cat.id}`}>
                              {cat.name}{selected && <span className="ml-1.5 text-white/90">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-dashed border-slate-200" />

            {/* Section 3: Location */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Globe className="h-4 w-4 text-blue-600" /></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Location</h3>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Address *</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, Building, City" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20" data-testid="refer-address-input" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">State/Region *</Label>
                <StateSelect value={form.state} onChange={(val) => setForm({ ...form, state: val })} />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button type="submit" disabled={saving} className="w-full rounded-2xl h-12 text-base font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-200 transition-all" data-testid="refer-submit-btn">
                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
                Submit Application
              </Button>
              <p className="text-center text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-violet-500" /> Marked as referred by you · Admin reviews within 24-48 hours.
              </p>
            </div>
          </form>
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentReferShop;
