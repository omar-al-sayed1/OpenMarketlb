import React, { useEffect, useState, useCallback } from 'react';
import {
  Rocket, DollarSign, TrendingUp, MousePointerClick, Mail, Megaphone, CalendarDays,
  Settings2, Loader2, Save, Users, BarChart3, Search, ShieldCheck, Crown, Wallet, Check,
  Plus, Edit, Trash2
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ImageUploader from '../../components/ImageUploader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Cell } from 'recharts';

const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const KpiCard = ({ icon: Icon, label, value, hint, testid }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover-lift" data-testid={testid}>
    <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 to-indigo-600" />
    <div className="p-4">
      <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700"><Icon className="h-[18px] w-[18px]" /></div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  </div>
);

const AdminAdvertising = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  const [prices, setPrices] = useState({
    ads_enabled: true,
    email_campaigns_enabled: true,
    ppc_campaigns_enabled: true,
    banner_campaigns_enabled: true,
    email_price_per_email: 0.05,
    ppc_price_per_click: 0.10,
    ppc_min_wallet_to_start: 5,
    event_sponsorship_default_price: 2,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [ov, camp, ev] = await Promise.allSettled([api.adminAds.overview(), api.adminAds.campaigns(), api.adminAds.events()]);
      if (ov.status === 'fulfilled') {
        setOverview(ov.value.data);
        const s = ov.value.data.settings || {};
        setPrices({
          ads_enabled: s.ads_enabled !== false,
          email_campaigns_enabled: s.email_campaigns_enabled !== false,
          ppc_campaigns_enabled: s.ppc_campaigns_enabled !== false,
          banner_campaigns_enabled: s.banner_campaigns_enabled !== false,
          email_price_per_email: s.email_price_per_email ?? 0.05,
          ppc_price_per_click: s.ppc_price_per_click ?? 0.10,
          ppc_min_wallet_to_start: s.ppc_min_wallet_to_start ?? 5,
          event_sponsorship_default_price: s.event_sponsorship_default_price ?? 2,
        });
      }
      if (camp.status === 'fulfilled') setCampaigns(camp.value.data?.campaigns || []);
      if (ev.status === 'fulfilled') setEvents(ev.value.data?.events || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSavePrices = async () => {
    setSaving(true);
    try {
      await api.adminAds.updateSettings(prices);
      toast.success('Advertising settings saved');
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleToggleAds = async (val) => {
    setPrices({ ...prices, ads_enabled: val });
    try { await api.adminAds.updateSettings({ ...prices, ads_enabled: val }); toast.success(`Advertising ${val ? 'enabled' : 'disabled'}`); }
    catch { toast.error('Failed'); }
  };

  const handleEventSponsorship = async (ev, field, value) => {
    try {
      await api.adminAds.updateEventSponsorship(ev.id, { [field]: value });
      toast.success('Event updated');
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleRemoveSponsor = async (ev) => {
    if (!ev.current_sponsor) return;
    const shopName = ev.current_sponsor.shop_name || 'this shop';
    if (!window.confirm(`Remove ${shopName} from "${ev.title}" banner? This frees the banner for other shops (no refund issued).`)) return;
    try {
      await api.adminAds.removeEventSponsor(ev.id);
      toast.success(`Removed ${shopName}'s sponsorship`);
      // Optimistic UI update so user sees the change immediately
      setEvents((prev) => prev.map((x) => x.id === ev.id ? { ...x, current_sponsor: null, is_reserved: false, reserved_until: null } : x));
      // Refresh from server
      await fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to remove'); }
  };

  // ---- Event CRUD (photo / title / subtitle / price-per-day) ----
  const EMPTY_EVENT = { title: '', banner_subtitle: '', image_url: '', sponsorship_price_per_day: 2, sponsorship_enabled: true, is_active: true };
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT);
  const [savingEvent, setSavingEvent] = useState(false);

  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({ ...EMPTY_EVENT, sponsorship_price_per_day: prices.event_sponsorship_default_price || 2 });
    setEventDialogOpen(true);
  };
  const openEditEvent = (ev) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title || '',
      banner_subtitle: ev.banner_subtitle || '',
      image_url: ev.image_url || '',
      sponsorship_price_per_day: ev.sponsorship_price_per_day ?? ev.sponsorship_price ?? 2,
      sponsorship_enabled: !!ev.sponsorship_enabled,
      is_active: ev.is_active !== false,
    });
    setEventDialogOpen(true);
  };
  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) { toast.error('Title is required'); return; }
    setSavingEvent(true);
    try {
      const payload = {
        title: eventForm.title.trim(),
        banner_subtitle: eventForm.banner_subtitle,
        image_url: eventForm.image_url,
        sponsorship_price_per_day: parseFloat(eventForm.sponsorship_price_per_day) || 0,
        sponsorship_price: parseFloat(eventForm.sponsorship_price_per_day) || 0,
        sponsorship_enabled: !!eventForm.sponsorship_enabled,
        is_active: !!eventForm.is_active,
        display_mode: 'home_banner',
      };
      if (editingEvent) {
        await api.adminEvents.update(editingEvent.id, payload);
        toast.success('Event updated');
      } else {
        await api.adminEvents.create(payload);
        toast.success('Event created');
      }
      setEventDialogOpen(false);
      await fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save event'); } finally { setSavingEvent(false); }
  };
  const handleDeleteEvent = async (ev) => {
    try {
      await api.adminEvents.delete(ev.id);
      toast.success('Event deleted');
      setEvents((prev) => prev.filter((x) => x.id !== ev.id));
      await fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete'); }
  };

  const rev = overview?.revenue || { total: 0, by_type: {} };
  const stats = overview?.stats || {};
  const revenueChart = [
    { name: 'Email', value: rev.by_type?.email_blast || 0 },
    { name: 'PPC', value: rev.by_type?.ppc_click || 0 },
    { name: 'Sponsorship', value: rev.by_type?.event_sponsorship || 0 },
    { name: 'Boosts', value: rev.by_type?.product_boost || 0 },
  ];
  const BAR_COLORS = ['#10b981', '#b4f56a', '#f59e0b', '#5df6fc'];

  const filteredCampaigns = campaigns.filter(c => {
    const matchType = filterType === 'all' || c.type === (filterType === 'email' ? 'blast' : filterType);
    const matchSearch = !search || (c.name || c.subject || '').toLowerCase().includes(search.toLowerCase()) || (c.shop_name || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  if (loading) return <AdminLayout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-violet-500" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6" data-testid="admin-advertising-page">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200 flex-shrink-0">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Advertising</h1>
              <p className="text-sm text-slate-600">Pricing controls, ad revenue, and cross-shop campaign oversight.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${prices.ads_enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-sm font-medium text-slate-700">Advertising {prices.ads_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <Switch checked={prices.ads_enabled} onCheckedChange={handleToggleAds} data-testid="admin-advertising-feature-toggle" />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard icon={DollarSign} label="Total Ad Revenue" value={fmt(rev.total)} hint="Added to admin profit" testid="admin-advertising-kpi-revenue" />
          <KpiCard icon={MousePointerClick} label="Clicks Delivered" value={stats.total_clicks ?? 0} testid="admin-advertising-kpi-clicks" />
          <KpiCard icon={Mail} label="Emails Sent" value={stats.total_emails_sent ?? 0} testid="admin-advertising-kpi-emails" />
          <KpiCard icon={Megaphone} label="Campaigns" value={stats.total_campaigns ?? 0} hint={`${stats.active_campaigns ?? 0} active`} testid="admin-advertising-kpi-campaigns" />
        </div>

        <Tabs value={tab} onValueChange={setTab} data-testid="admin-advertising-tabs">
          <TabsList className="rounded-2xl border border-slate-200 bg-white p-1 h-auto">
            <TabsTrigger value="overview" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><BarChart3 className="h-4 w-4 mr-1.5" />Revenue</TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><Settings2 className="h-4 w-4 mr-1.5" />Pricing</TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><Megaphone className="h-4 w-4 mr-1.5" />Campaigns</TabsTrigger>
            <TabsTrigger value="events" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><CalendarDays className="h-4 w-4 mr-1.5" />Events</TabsTrigger>
          </TabsList>

          {/* REVENUE */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Ad revenue by type</h3>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <RTooltip formatter={(v) => fmt(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {revenueChart.map((e, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 shadow-sm p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-violet-600" /> Revenue breakdown</h3>
                {[
                  { label: 'Email campaigns', icon: Mail, val: rev.by_type?.email_blast },
                  { label: 'Pay-per-click', icon: MousePointerClick, val: rev.by_type?.ppc_click },
                  { label: 'Event sponsorship', icon: Crown, val: rev.by_type?.event_sponsorship },
                  { label: 'Product boosts', icon: Megaphone, val: rev.by_type?.product_boost },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between rounded-xl bg-white border border-violet-100 px-3 py-2.5">
                    <span className="text-sm text-slate-600 flex items-center gap-2"><r.icon className="h-4 w-4 text-violet-500" /> {r.label}</span>
                    <span className="text-sm font-bold text-slate-900">{fmt(r.val)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-3 text-white">
                  <span className="text-sm font-medium">Total ad revenue</span>
                  <span className="text-lg font-bold">{fmt(rev.total)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PRICING */}
          <TabsContent value="pricing" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Settings2 className="h-4 w-4 text-violet-600" /> Advertising pricing</h3>

                {/* 3 channel toggles (independent on/off) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="admin-advertising-channel-toggles">
                  <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 p-3" data-testid="toggle-email-campaigns">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                          <Mail className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">Email Campaigns</span>
                      </div>
                      <Switch
                        checked={!!prices.email_campaigns_enabled}
                        onCheckedChange={async (v) => {
                          const next = { ...prices, email_campaigns_enabled: v };
                          setPrices(next);
                          try { await api.adminAds.updateSettings({ email_campaigns_enabled: v }); toast.success(`Email campaigns ${v ? 'enabled' : 'disabled'}`); fetchAll(); }
                          catch { toast.error('Failed'); }
                        }}
                        data-testid="email-campaigns-toggle"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Pay-per-send email blasts. Toggle off to hide the channel from shops.</p>
                  </div>
                  
                  <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-indigo-50/30 p-3" data-testid="toggle-ppc-campaigns">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
                          <MousePointerClick className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">PPC Campaigns</span>
                      </div>
                      <Switch
                        checked={!!prices.ppc_campaigns_enabled}
                        onCheckedChange={async (v) => {
                          const next = { ...prices, ppc_campaigns_enabled: v };
                          setPrices(next);
                          try { await api.adminAds.updateSettings({ ppc_campaigns_enabled: v }); toast.success(`PPC campaigns ${v ? 'enabled' : 'disabled'}`); fetchAll(); }
                          catch { toast.error('Failed'); }
                        }}
                        data-testid="ppc-campaigns-toggle"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Pay-per-click email ads. Toggle off to hide the channel from shops.</p>
                  </div>
                  
                  <div className="rounded-2xl border-2 border-amber-100 bg-gradient-to-br from-amber-50/80 to-amber-50/30 p-3" data-testid="toggle-banner-campaigns">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                          <Crown className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">Banner Campaigns</span>
                      </div>
                      <Switch
                        checked={!!prices.banner_campaigns_enabled}
                        onCheckedChange={async (v) => {
                          const next = { ...prices, banner_campaigns_enabled: v };
                          setPrices(next);
                          try { await api.adminAds.updateSettings({ banner_campaigns_enabled: v }); toast.success(`Banner campaigns ${v ? 'enabled' : 'disabled'}`); fetchAll(); }
                          catch { toast.error('Failed'); }
                        }}
                        data-testid="banner-campaigns-toggle"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Home-banner event sponsorships. Toggle off to hide the channel from shops.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Price per email ($)</Label>
                    <Input type="number" step="0.01" min="0" value={prices.email_price_per_email} onChange={(e) => setPrices({ ...prices, email_price_per_email: parseFloat(e.target.value) || 0 })} className="h-10" data-testid="admin-price-per-email-input" />
                    <p className="text-[11px] text-slate-400">Charged per email delivered in a blast campaign.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Price per click ($)</Label>
                    <Input type="number" step="0.01" min="0" value={prices.ppc_price_per_click} onChange={(e) => setPrices({ ...prices, ppc_price_per_click: parseFloat(e.target.value) || 0 })} className="h-10" data-testid="admin-price-per-click-input" />
                    <p className="text-[11px] text-slate-400">Deducted each time a customer clicks a PPC email link.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Min wallet to start PPC ($)</Label>
                    <Input type="number" step="1" min="0" value={prices.ppc_min_wallet_to_start} onChange={(e) => setPrices({ ...prices, ppc_min_wallet_to_start: parseFloat(e.target.value) || 0 })} className="h-10" data-testid="admin-min-wallet-input" />
                    <p className="text-[11px] text-slate-400">Minimum balance a shop needs to launch a PPC campaign.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Default event sponsorship price ($)</Label>
                    <Input type="number" step="1" min="0" value={prices.event_sponsorship_default_price} onChange={(e) => setPrices({ ...prices, event_sponsorship_default_price: parseFloat(e.target.value) || 0 })} className="h-10" data-testid="admin-event-sponsorship-price-input" />
                    <p className="text-[11px] text-slate-400">Default price; can be overridden per event in the Events tab.</p>
                  </div>
                </div>
                <Button onClick={handleSavePrices} disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white" data-testid="admin-save-pricing-button">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save pricing
                </Button>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-600" /> How it works</h3>
                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                  <li>Shops pay from their wallet for every ad action.</li>
                  <li>Every charge is added to <b>Admin Profit</b> automatically.</li>
                  <li>Email blasts charge upfront (recipients × price).</li>
                  <li>PPC charges only when a recipient clicks, until the budget runs out.</li>
                  <li>Event sponsorship features the shop on the home banner.</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* CAMPAIGNS */}
          <TabsContent value="campaigns" className="mt-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="admin-advertising-campaigns-table">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border-b border-slate-100">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaign or shop..." className="pl-9 h-9" data-testid="admin-advertising-campaigns-search" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="ppc">PPC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                    <th className="text-left px-4 py-2.5">Campaign</th><th className="text-left px-4 py-2.5">Shop</th>
                    <th className="text-left px-4 py-2.5">Type</th><th className="text-left px-4 py-2.5">Target</th>
                    <th className="text-right px-4 py-2.5">Recipients</th><th className="text-right px-4 py-2.5">Clicks</th>
                    <th className="text-right px-4 py-2.5">Spend</th><th className="text-left px-4 py-2.5">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredCampaigns.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No campaigns found</td></tr>
                    ) : filteredCampaigns.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate">{c.name || c.subject}</td>
                        <td className="px-4 py-3 text-slate-600">{c.shop_name}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className={c.type === 'ppc' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}>{c.type === 'ppc' ? 'PPC' : 'Email'}</Badge></td>
                        <td className="px-4 py-3 text-xs text-slate-600">{c.target_type === 'own_customers' ? 'Own customers' : (c.target_state === 'all' ? 'All states' : c.target_state)}</td>
                        <td className="px-4 py-3 text-right">{c.recipients_count || 0}</td>
                        <td className="px-4 py-3 text-right font-medium">{c.clicks || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt((c.cost_charged || 0) + (c.spend || 0))}</td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-sky-100 text-sky-700' : c.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : c.status === 'sending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* EVENTS */}
          <TabsContent value="events" className="mt-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Event sponsorship management</h3>
                  <p className="text-xs text-slate-500">Add home-banner events (photo, title, subtitle, price/day). Shops sponsor them from their wallet.</p>
                </div>
                <Button onClick={openCreateEvent} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-full shadow-md whitespace-nowrap" data-testid="add-event-btn">
                  <Plus className="h-4 w-4 mr-1" /> Add Event
                </Button>
              </div>
              {events.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No home-banner events yet. Click <span className="font-semibold text-violet-600">Add Event</span> to create one.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {events.map(ev => {
                    const reservedUntilFmt = ev.reserved_until ? new Date(ev.reserved_until).toLocaleString() : '';
                    return (
                      <div key={ev.id} className="px-4 py-4" data-testid={`admin-event-row-${ev.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          {ev.image_url ? (
                            <img src={ev.image_url} alt={ev.title} className="w-full sm:w-28 h-16 sm:h-16 object-cover rounded-xl flex-shrink-0 border border-slate-200" />
                          ) : (
                            <div className="w-full sm:w-28 h-16 sm:h-16 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                              <Crown className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-800 truncate">{ev.title}</p>
                              {!ev.is_active && <Badge variant="outline" className="text-slate-500">Inactive</Badge>}
                              {ev.is_reserved && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Reserved</Badge>}
                            </div>
                            {ev.banner_subtitle && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{ev.banner_subtitle}</p>}
                            <p className="text-xs text-slate-500 mt-0.5">{ev.sponsors_count} sponsor{ev.sponsors_count !== 1 ? 's' : ''} total · {fmt(ev.revenue)} lifetime revenue</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">$/day</span>
                              <Input type="number" step="0.5" min="0" defaultValue={ev.sponsorship_price_per_day ?? ev.sponsorship_price}
                                onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== (ev.sponsorship_price_per_day ?? ev.sponsorship_price)) handleEventSponsorship(ev, 'sponsorship_price_per_day', v); }}
                                className="h-9 w-24" data-testid={`admin-event-price-input-${ev.id}`} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Open</span>
                              <Switch checked={!!ev.sponsorship_enabled} onCheckedChange={(v) => handleEventSponsorship(ev, 'sponsorship_enabled', v)} data-testid={`admin-event-switch-${ev.id}`} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => openEditEvent(ev)} className="h-9 w-9 p-0 border-slate-200 text-slate-600 hover:text-violet-700 hover:border-violet-300" data-testid={`admin-event-edit-${ev.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-rose-200 text-rose-600 hover:bg-rose-50" data-testid={`admin-event-delete-${ev.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{ev.title}"?</AlertDialogTitle>
                                    <AlertDialogDescription>This permanently removes the event/home-banner. Any active sponsorship will end. This cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteEvent(ev)} className="bg-rose-600 hover:bg-rose-700" data-testid={`admin-event-delete-confirm-${ev.id}`}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                        
                        {ev.current_sponsor && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`admin-event-current-sponsor-${ev.id}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              {ev.current_sponsor.logo ? (
                                <img src={ev.current_sponsor.logo} alt={ev.current_sponsor.shop_name} className="w-9 h-9 rounded-lg object-cover border border-white shadow-sm" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                                  {(ev.current_sponsor.shop_name || '?').charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-bold">Currently sponsored by</p>
                                <p className="text-sm font-semibold text-slate-800 truncate">{ev.current_sponsor.shop_name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {ev.current_sponsor.days || 1} day{(ev.current_sponsor.days || 1) !== 1 ? 's' : ''} · {fmt(ev.current_sponsor.amount || 0)} · ends {reservedUntilFmt}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveSponsor(ev)}
                              className="border-rose-200 text-rose-600 hover:bg-rose-50 self-start sm:self-auto"
                              data-testid={`admin-event-remove-sponsor-${ev.id}`}
                            >
                              Remove campaign
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ===== Add / Edit Event Dialog ===== */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="event-form-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-violet-600" />
                {editingEvent ? 'Edit Event' : 'Add New Event'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 block">Event Photo</Label>
                <ImageUploader value={eventForm.image_url} onChange={(url) => setEventForm({ ...eventForm, image_url: url })} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Title *</Label>
                <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="e.g. Black Friday Mega Sale" className="mt-1.5 h-11 rounded-xl" data-testid="event-title-input" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Subtitle</Label>
                <Textarea value={eventForm.banner_subtitle} onChange={(e) => setEventForm({ ...eventForm, banner_subtitle: e.target.value })} rows={2} placeholder="e.g. Up to 70% off across all shops" className="mt-1.5 rounded-xl" data-testid="event-subtitle-input" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Sponsorship Price / Day ($)</Label>
                <Input type="number" step="0.5" min="0" value={eventForm.sponsorship_price_per_day} onChange={(e) => setEventForm({ ...eventForm, sponsorship_price_per_day: e.target.value })} className="mt-1.5 h-11 rounded-xl max-w-[160px]" data-testid="event-price-input" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Open for sponsorship</p>
                  <p className="text-[11px] text-slate-400">Allow shops to purchase this banner</p>
                </div>
                <Switch checked={eventForm.sponsorship_enabled} onCheckedChange={(v) => setEventForm({ ...eventForm, sponsorship_enabled: v })} data-testid="event-sponsorship-toggle" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Active</p>
                  <p className="text-[11px] text-slate-400">Show this event on the home banner</p>
                </div>
                <Switch checked={eventForm.is_active} onCheckedChange={(v) => setEventForm({ ...eventForm, is_active: v })} data-testid="event-active-toggle" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setEventDialogOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleSaveEvent} disabled={savingEvent} className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold" data-testid="event-save-btn">
                  {savingEvent ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAdvertising;
