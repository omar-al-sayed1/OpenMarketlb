import React, { useEffect, useState, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, Edit2, Eye, PanelRight, Clock, Save, ExternalLink, Image as ImageIcon, ToggleLeft, ToggleRight, ImagePlay, Filter, Tag, DollarSign, Search as SearchIcon, Sparkles, ArrowUpRight, X, Users } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageUploader from '../../components/ImageUploader';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  title: '', description: '', image_url: '', cta_text: '', cta_link: '',
  display_mode: 'center', popup_color: '', audience: 'all_visitors',
  filter_category_ids: [], filter_gender: '', filter_search: '',
  filter_discount_only: false, filter_min_price: '', filter_max_price: '', filter_shop_id: '',
  banner_subtitle: '', banner_accent_color: 'from-violet-600 via-fuchsia-600 to-rose-500', banner_text_color: '#ffffff', banner_order: 0,
  sponsorship_enabled: false, sponsorship_price_per_day: 2,
  start_date: '', end_date: '', is_active: true
};

const AUDIENCE_OPTIONS = [
  { value: 'all_visitors', label: 'All visitors', desc: 'Everyone (logged in or not)' },
  { value: 'users_logged_in', label: 'Logged-in users only', desc: 'Signed-in customers' },
  { value: 'shops_logged_in', label: 'Logged-in shops only', desc: 'Signed-in shop owners' },
  { value: 'shops_and_users_logged_in', label: 'Shops & users (logged-in)', desc: 'Any signed-in account' },
];

const BANNER_ACCENT_PRESETS = [
  { key: 'from-violet-600 via-fuchsia-600 to-rose-500', label: 'Sunset' },
  { key: 'from-blue-600 via-indigo-600 to-violet-700', label: 'Twilight' },
  { key: 'from-emerald-500 via-teal-500 to-cyan-600', label: 'Mint' },
  { key: 'from-amber-500 via-orange-500 to-rose-600', label: 'Tangerine' },
  { key: 'from-pink-500 via-rose-500 to-red-500', label: 'Blush' },
  { key: 'from-slate-700 via-slate-900 to-black', label: 'Midnight' },
  { key: 'from-sky-400 via-blue-500 to-indigo-600', label: 'Ocean' },
  { key: 'from-fuchsia-500 via-purple-600 to-indigo-700', label: 'Galaxy' },
];

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('all'); // all | home_banner | popup
  const [defaultPopupColor, setDefaultPopupColor] = useState('#3bf4fb');
  const [categoryTree, setCategoryTree] = useState([]);
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchEvents(); fetchDefaultColor(); fetchCategories(); fetchShops(); }, []);

  const fetchDefaultColor = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      if (data?.event_popup_color) setDefaultPopupColor(data.event_popup_color);
    } catch (e) { /* ignore */ }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree(true);
      setCategoryTree(data || []);
    } catch (e) { /* ignore */ }
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.admin.getShops();
      setShops(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ }
  };

  const fetchEvents = async () => {
    try { const { data } = await api.adminEvents.getAll(); setEvents(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setEditingEvent(null); setForm(EMPTY_FORM); };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setForm({
      ...EMPTY_FORM,
      title: event.title || '', description: event.description || '', image_url: event.image_url || '',
      cta_text: event.cta_text || '', cta_link: event.cta_link || '',
      display_mode: event.display_mode || 'center', popup_color: event.popup_color || '',
      audience: event.audience || 'all_visitors',
      filter_category_ids: event.filter_category_ids || (event.filter_category_id ? [event.filter_category_id] : []),
      filter_gender: event.filter_gender || '',
      filter_search: event.filter_search || '',
      filter_discount_only: !!event.filter_discount_only,
      filter_min_price: event.filter_min_price ?? '',
      filter_max_price: event.filter_max_price ?? '',
      filter_shop_id: event.filter_shop_id || '',
      banner_subtitle: event.banner_subtitle || '',
      banner_accent_color: event.banner_accent_color || 'from-violet-600 via-fuchsia-600 to-rose-500',
      banner_text_color: event.banner_text_color || '#ffffff',
      banner_order: event.banner_order ?? 0,
      sponsorship_enabled: !!event.sponsorship_enabled,
      sponsorship_price_per_day: event.sponsorship_price_per_day ?? event.sponsorship_price ?? 2,
      start_date: event.start_date || '', end_date: event.end_date || '',
      is_active: event.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      // Clean empty numeric strings
      if (payload.filter_min_price === '') payload.filter_min_price = null;
      else payload.filter_min_price = parseFloat(payload.filter_min_price);
      if (payload.filter_max_price === '') payload.filter_max_price = null;
      else payload.filter_max_price = parseFloat(payload.filter_max_price);
      if (editingEvent) {
        await api.adminEvents.update(editingEvent.id, payload);
        toast.success('Event updated!');
      } else {
        await api.adminEvents.create(payload);
        toast.success('Event created!');
      }
      setDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (err) { toast.error('Failed to save event'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try { await api.adminEvents.delete(id); toast.success('Event deleted'); fetchEvents(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleToggleActive = async (event) => {
    try {
      await api.adminEvents.update(event.id, { is_active: !event.is_active });
      fetchEvents();
      toast.success(event.is_active ? 'Event deactivated' : 'Event activated');
    } catch { toast.error('Failed to update'); }
  };

  const displayModeMeta = (mode) => {
    if (mode === 'center') return { label: 'Center Popup', color: 'bg-violet-100 text-violet-700' };
    if (mode === 'side_fixed') return { label: 'Side Widget', color: 'bg-blue-100 text-blue-700' };
    if (mode === 'side_toast') return { label: 'Side Toast', color: 'bg-emerald-100 text-emerald-700' };
    if (mode === 'home_banner') return { label: 'Home Banner', color: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white' };
    return { label: mode, color: 'bg-slate-100 text-slate-700' };
  };

  const audienceLabel = (aud) => {
    const found = AUDIENCE_OPTIONS.find(o => o.value === (aud || 'all_visitors'));
    return found ? found.label : 'All visitors';
  };

  const filteredEvents = useMemo(() => {
    if (tab === 'all') return events;
    if (tab === 'home_banner') return events.filter(e => e.display_mode === 'home_banner');
    return events.filter(e => e.display_mode !== 'home_banner');
  }, [events, tab]);

  // Flatten categories for label lookup
  const flatCats = useMemo(() => {
    const out = [];
    const walk = (nodes) => (nodes || []).forEach(n => { out.push({ id: n.id, name: n.name }); if (n.children) walk(n.children); });
    walk(categoryTree);
    return out;
  }, [categoryTree]);

  const filterSummary = (e) => {
    const parts = [];
    const cats = (e.filter_category_ids?.length ? e.filter_category_ids : (e.filter_category_id ? [e.filter_category_id] : [])).map(id => flatCats.find(c => c.id === id)?.name).filter(Boolean);
    if (cats.length) parts.push(cats.join(', '));
    if (e.filter_gender) parts.push(e.filter_gender);
    if (e.filter_search) parts.push(`"${e.filter_search}"`);
    if (e.filter_discount_only) parts.push('On Sale');
    if (e.filter_min_price || e.filter_max_price) parts.push(`$${e.filter_min_price || 0}-${e.filter_max_price || '∞'}`);
    return parts.length ? parts.join(' · ') : null;
  };

  if (loading) return <AdminLayout><div className="p-8 text-center text-slate-400">Loading...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-6" data-testid="admin-events-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-400 via-fuchsia-500 to-violet-500 rounded-xl text-white shadow-md">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-heading font-bold">Events & Banners</h1>
              <p className="text-sm text-slate-500">Manage popups, side widgets, and home-page swipable banners</p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 hover:from-violet-700 hover:via-fuchsia-700 hover:to-rose-600 rounded-full shadow-lg shadow-fuchsia-500/25" data-testid="create-event-btn">
            <Plus className="h-4 w-4 mr-2" /> Create New
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {[
            { key: 'all', label: 'All', count: events.length },
            { key: 'home_banner', label: 'Home Banners', count: events.filter(e => e.display_mode === 'home_banner').length, icon: ImagePlay },
            { key: 'popup', label: 'Popups & Widgets', count: events.filter(e => e.display_mode !== 'home_banner').length, icon: Eye },
          ].map((t) => {
            const Ic = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${active ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-transparent shadow-md shadow-fuchsia-200' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-200'}`}
                data-testid={`events-tab-${t.key}`}
              >
                {Ic && <Ic className="h-3.5 w-3.5" />}
                {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No items in this view</p>
            <p className="text-xs text-slate-400 mt-1">Click &quot;Create New&quot; to add a popup or home-page banner</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => {
              const dm = displayModeMeta(event.display_mode);
              const isActive = event.is_active;
              const isBanner = event.display_mode === 'home_banner';
              const accent = event.banner_accent_color || 'from-violet-600 via-fuchsia-600 to-rose-500';
              return (
                <div key={event.id} className={`bg-white rounded-2xl border-2 ${isBanner ? 'border-violet-200' : 'border-slate-100'} shadow-sm overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${!isActive ? 'opacity-60' : ''}`} data-testid={`event-card-${event.id}`}>
                  {/* Banner-style preview for home banners */}
                  {isBanner ? (
                    <div className="relative h-32 overflow-hidden">
                      {event.image_url ? (
                        <>
                          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-45 mix-blend-multiply`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3 text-white">
                            <p className="text-[9px] uppercase tracking-wider font-bold opacity-80">Home Banner</p>
                            <p className="text-base font-black truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{event.title}</p>
                          </div>
                        </>
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-r ${accent} flex items-center justify-center`}>
                          <ImagePlay className="h-10 w-10 text-white/70" />
                        </div>
                      )}
                    </div>
                  ) : (
                    event.image_url && <img src={event.image_url} alt={event.title} className="w-full h-32 object-cover" />
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800 text-base line-clamp-1 flex-1">{event.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${dm.color}`}>{dm.label}</span>
                    </div>
                    {(event.banner_subtitle || event.description) && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-2">{event.banner_subtitle || event.description}</p>
                    )}

                    {/* Audience badge for popups / widgets / toasts */}
                    {!isBanner && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5" data-testid={`event-audience-badge-${event.id}`}>
                          <Users className="h-3 w-3" /> {audienceLabel(event.audience)}
                        </span>
                      </div>
                    )}

                    {/* Filter summary for home banners */}
                    {isBanner && (
                      <div className="mb-2.5">
                        {filterSummary(event) ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5">
                            <Filter className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">→ {filterSummary(event)}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">All products</div>
                        )}
                      </div>
                    )}

                    {(event.start_date || event.end_date) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                        <Clock className="h-3 w-3" />
                        {event.start_date && <span>{event.start_date}</span>}
                        {event.start_date && event.end_date && <span>→</span>}
                        {event.end_date && <span>{event.end_date}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button onClick={() => handleToggleActive(event)} className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} data-testid={`toggle-event-${event.id}`}>
                        {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(event)} data-testid={`edit-event-${event.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(event.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ====== Create/Edit Dialog ====== */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 border-0">
            {/* Sticky gradient header */}
            <div className="sticky top-0 z-20 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 p-5 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur rounded-xl p-2.5">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-lg tracking-tight">{editingEvent ? 'Edit Event' : 'Create New'}</h2>
                  <p className="text-white/80 text-xs">Pick a display mode and customize</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDialogOpen(false); resetForm(); }}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-all active:scale-95"
                  aria-label="Close"
                  data-testid="event-modal-close-btn"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Display Mode Selector — FIRST */}
              <div>
                <Label className="mb-2 block font-semibold text-sm">Display Mode</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'home_banner', label: 'Home Banner', desc: 'Swipable hero', icon: ImagePlay, gradient: 'from-violet-500 via-fuchsia-500 to-rose-500' },
                    { value: 'center', label: 'Center Popup', desc: 'Full modal', icon: Eye, gradient: 'from-violet-500 to-purple-500' },
                    { value: 'side_fixed', label: 'Side Widget', desc: 'Fixed tab', icon: PanelRight, gradient: 'from-blue-500 to-cyan-500' },
                    { value: 'side_toast', label: 'Side Toast', desc: 'Auto-hides', icon: Clock, gradient: 'from-emerald-500 to-teal-500' },
                  ].map(opt => {
                    const Icon = opt.icon;
                    const isSelected = form.display_mode === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setForm({ ...form, display_mode: opt.value })}
                        className={`p-3 rounded-xl border-2 text-xs font-medium transition-all text-center ${
                          isSelected
                            ? `border-transparent bg-gradient-to-br ${opt.gradient} text-white shadow-lg`
                            : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`event-mode-${opt.value}`}>
                        <Icon className="h-5 w-5 mx-auto mb-1.5" />
                        <p className="font-semibold">{opt.label}</p>
                        <p className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audience targeting — applies to popup / side widget / side toast */}
              {['center', 'side_fixed', 'side_toast'].includes(form.display_mode) && (
                <div data-testid="event-audience-section">
                  <Label className="font-semibold text-sm">Show this message to</Label>
                  <p className="text-xs text-slate-500 mb-2">Choose which visitors should see this {displayModeMeta(form.display_mode).label.toLowerCase()}.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AUDIENCE_OPTIONS.map(opt => {
                      const isSel = (form.audience || 'all_visitors') === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setForm({ ...form, audience: opt.value })}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                            isSel ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                          data-testid={`event-audience-${opt.value}`}>
                          <p className={`text-xs font-semibold ${isSel ? 'text-violet-700' : 'text-slate-700'}`}>{opt.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Basics */}
              <div>
                <Label className="font-semibold text-sm">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Summer Clothes 2026" className="mt-1 rounded-xl" data-testid="event-title-input" />
              </div>

              {form.display_mode === 'home_banner' ? (
                <>
                  <div>
                    <Label className="font-semibold text-sm">Subtitle</Label>
                    <Input value={form.banner_subtitle} onChange={(e) => setForm({ ...form, banner_subtitle: e.target.value })} placeholder="e.g. Up to 50% off — limited time" className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label className="font-semibold text-sm">Banner Image <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="" showUrlInput={true} />
                    <p className="text-[10px] text-slate-400 mt-1">Recommended: 1600 × 600 (wide hero). Leave empty for a clean gradient banner.</p>
                  </div>
                  {/* Accent gradient */}
                  <div>
                    <Label className="text-sm font-semibold">Banner Accent Gradient</Label>
                    <div className="grid grid-cols-4 gap-2 mt-1.5">
                      {BANNER_ACCENT_PRESETS.map(p => {
                        const selected = form.banner_accent_color === p.key;
                        return (
                          <button key={p.key} type="button" onClick={() => setForm({ ...form, banner_accent_color: p.key })}
                            className={`relative h-12 rounded-xl overflow-hidden bg-gradient-to-r ${p.key} ring-offset-2 transition-all ${selected ? 'ring-2 ring-violet-600 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
                            title={p.label}>
                            <span className="absolute bottom-0.5 left-1.5 right-1 text-[9px] font-bold text-white text-left" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* CTA + order */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">CTA Text</Label>
                      <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="e.g. Shop Summer" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-sm">Display Order</Label>
                      <Input type="number" value={form.banner_order} onChange={(e) => setForm({ ...form, banner_order: parseInt(e.target.value || 0) })} placeholder="0 = first" className="mt-1 rounded-xl" />
                    </div>
                  </div>

                  {/* Click-through filters */}
                  <div className="rounded-xl border-2 border-violet-100 bg-violet-50/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-violet-200 text-violet-700 flex items-center justify-center">
                        <Filter className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-violet-900">Click → Products Page Filters</p>
                        <p className="text-[11px] text-violet-700/80">Define what filters apply when shoppers tap this banner</p>
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="mb-3">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Categories</Label>
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-violet-200 bg-white p-2 mt-1">
                        <CategoryTreeSelect tree={categoryTree} selectedIds={form.filter_category_ids} onChange={(ids) => setForm({ ...form, filter_category_ids: ids })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Audience</Label>
                        <select value={form.filter_gender} onChange={(e) => setForm({ ...form, filter_gender: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-violet-200 bg-white px-2 py-1.5 text-xs font-medium">
                          <option value="">Everyone</option>
                          <option value="men">Men</option>
                          <option value="women">Women</option>
                          <option value="kids">Kids</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Shop</Label>
                        <select value={form.filter_shop_id} onChange={(e) => setForm({ ...form, filter_shop_id: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-violet-200 bg-white px-2 py-1.5 text-xs font-medium truncate">
                          <option value="">All shops</option>
                          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="mb-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Search Keyword</Label>
                      <Input value={form.filter_search} onChange={(e) => setForm({ ...form, filter_search: e.target.value })} placeholder="e.g. summer dress" className="mt-1 h-9 text-sm rounded-lg" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Min $</Label>
                        <Input type="number" value={form.filter_min_price} onChange={(e) => setForm({ ...form, filter_min_price: e.target.value })} placeholder="0" className="mt-1 h-9 text-sm rounded-lg" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-violet-700">Max $</Label>
                        <Input type="number" value={form.filter_max_price} onChange={(e) => setForm({ ...form, filter_max_price: e.target.value })} placeholder="∞" className="mt-1 h-9 text-sm rounded-lg" />
                      </div>
                      <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border-2 border-violet-200 cursor-pointer">
                        <span className="text-xs font-medium text-violet-700">On Sale only</span>
                        <Switch checked={!!form.filter_discount_only} onCheckedChange={(v) => setForm({ ...form, filter_discount_only: v })} />
                      </label>
                    </div>
                  </div>

                  {/* Banner Sponsorship configuration */}
                  <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-700 flex items-center justify-center">
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-amber-900">Banner Sponsorship</p>
                        <p className="text-[11px] text-amber-700/80">Let shops pay to be featured on this banner</p>
                      </div>
                      <Switch checked={!!form.sponsorship_enabled} onCheckedChange={(v) => setForm({ ...form, sponsorship_enabled: v })} data-testid="event-sponsorship-enabled-switch" />
                    </div>
                    {form.sponsorship_enabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-amber-700">Price per Day ($)</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={form.sponsorship_price_per_day}
                            onChange={(e) => setForm({ ...form, sponsorship_price_per_day: parseFloat(e.target.value) || 0 })}
                            placeholder="2.00"
                            className="mt-1 h-9 text-sm rounded-lg"
                            data-testid="event-sponsorship-price-input"
                          />
                          <p className="text-[10px] text-amber-600 mt-1">Shop pays this × number of days they want.</p>
                        </div>
                        <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs">
                          <p className="text-amber-800 font-semibold">Example</p>
                          <p className="text-amber-600 mt-1">${form.sponsorship_price_per_day || 0}/day × 7 days = <span className="font-bold text-amber-700">${((form.sponsorship_price_per_day || 0) * 7).toFixed(2)}</span></p>
                          <p className="text-[10px] text-amber-500 mt-1">Banner is locked to one shop during their duration.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Non-banner: keep existing fields */}
                  <div>
                    <Label className="font-semibold text-sm">Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the event..." rows={3} className="mt-1 rounded-xl" data-testid="event-description-input" />
                  </div>
                  <div>
                    <Label className="font-semibold text-sm">Event Image</Label>
                    <ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="" showUrlInput={true} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Button Text</Label>
                      <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="e.g. Shop Now" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-sm">Button Link</Label>
                      <Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="e.g. /products" className="mt-1 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Popup Accent Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={form.popup_color || defaultPopupColor} onChange={(e) => setForm({ ...form, popup_color: e.target.value })} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                      <Input value={form.popup_color || ''} onChange={(e) => setForm({ ...form, popup_color: e.target.value })} placeholder={`Default (${defaultPopupColor})`} className="flex-1 rounded-xl" />
                    </div>
                  </div>
                </>
              )}

              {/* Dates + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label className="text-sm">End Date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 rounded-xl" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-emerald-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-semibold text-sm">Active</p>
                  <p className="text-xs text-slate-500">{form.display_mode === 'home_banner' ? 'Banner shown to all visitors' : 'Event will be shown to users'}</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>

              {/* Live preview */}
              {form.title && (
                <div className="border-2 border-dashed border-violet-200 rounded-xl p-4 bg-violet-50/40">
                  <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider mb-2">Live Preview</p>
                  {form.display_mode === 'home_banner' ? (
                    <div className="relative aspect-[21/8] rounded-lg overflow-hidden group">
                      {/* Base creative gradient (always present, primary look for photo-less banners) */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${form.banner_accent_color}`} />
                      {form.image_url && <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                      {/* Accent blend only over an image */}
                      {form.image_url && <div className={`absolute inset-0 bg-gradient-to-r ${form.banner_accent_color} opacity-50 mix-blend-multiply`} />}
                      {/* Decorative mesh for photo-less banners */}
                      {!form.image_url && (
                        <>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_45%)]" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.18),transparent_45%)]" />
                        </>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute inset-0 flex items-center px-5" style={{ color: form.banner_text_color }}>
                        <div className="max-w-md">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-bold uppercase mb-1.5">
                            <Sparkles className="h-2.5 w-2.5" /> Featured
                          </div>
                          <p className="font-black text-base sm:text-lg leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{form.title}</p>
                          {form.banner_subtitle && <p className="text-[11px] mt-1 opacity-90 line-clamp-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{form.banner_subtitle}</p>}
                          {form.cta_text && <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-white text-slate-900 text-[10px] font-bold">{form.cta_text}<ArrowUpRight className="h-2.5 w-2.5" /></span>}
                        </div>
                      </div>
                      {!form.image_url && (
                        <span className="absolute top-2 right-2 text-[9px] font-semibold text-white/70 bg-black/30 px-2 py-0.5 rounded-full">No photo</span>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                      {form.image_url && <img src={form.image_url} alt="" className="w-full h-28 object-cover" />}
                      <div className="p-3" style={{ borderTop: `3px solid ${form.popup_color || defaultPopupColor}` }}>
                        <h4 className="font-bold text-sm">{form.title}</h4>
                        {form.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{form.description}</p>}
                        {form.cta_text && (
                          <button className="mt-2 px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: form.popup_color || defaultPopupColor }}>
                            {form.cta_text}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 hover:from-violet-700 hover:via-fuchsia-700 hover:to-rose-600 rounded-xl h-11 font-bold shadow-lg shadow-fuchsia-500/25" data-testid="save-event-btn">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminEvents;
