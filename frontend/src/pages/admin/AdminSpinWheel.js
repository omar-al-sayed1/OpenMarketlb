import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Loader2, Settings, History, DollarSign, Percent, RotateCcw, Gift, Wallet, Crown, Zap, Plus, CalendarPlus, ToggleLeft, ToggleRight, Megaphone, Palette, Send, Mail, Users, Search } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminSpinWheel = () => {
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('settings');

  // Grant free spin state
  const [shops, setShops] = useState([]);
  const [grantMode, setGrantMode] = useState('all'); // 'all' or 'select'
  const [selectedShopIds, setSelectedShopIds] = useState([]);
  const [grantCount, setGrantCount] = useState(1);
  const [granting, setGranting] = useState(false);
  const [shopSearch, setShopSearch] = useState('');

  useEffect(() => {
    fetchData();
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const { data } = await api.admin.getShops();
      setShops(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ }
  };

  const fetchData = async () => {
    try {
      const [settingsRes, historyRes] = await Promise.allSettled([
        api.adminSpin.getSettings(),
        api.adminSpin.getHistory()
      ]);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
      if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data.history || []);
    } catch (e) {
      console.error('Failed to fetch spin data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.adminSpin.updateSettings(settings);
      toast.success('Spin settings saved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateOutcome = (index, field, value) => {
    const updated = { ...settings };
    updated.outcomes = [...updated.outcomes];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updated.outcomes[index] = {
        ...updated.outcomes[index],
        [parent]: { ...updated.outcomes[index][parent], [child]: parseFloat(value) || 0 }
      };
    } else {
      updated.outcomes[index] = {
        ...updated.outcomes[index],
        [field]: field === 'weight' ? (parseFloat(value) || 0) : value
      };
    }
    setSettings(updated);
  };

  const toggleOutcomeActive = (index) => {
    const updated = { ...settings };
    updated.outcomes = [...updated.outcomes];
    updated.outcomes[index] = {
      ...updated.outcomes[index],
      is_active: !updated.outcomes[index].is_active
    };
    setSettings(updated);
  };

  const addOutcome = () => {
    const updated = { ...settings };
    updated.outcomes = [...(updated.outcomes || []), {
      key: `custom_${Date.now()}`,
      label: 'New Outcome',
      weight: 5,
      payload: {},
      is_active: true
    }];
    setSettings(updated);
  };

  const removeOutcome = (index) => {
    const updated = { ...settings };
    updated.outcomes = updated.outcomes.filter((_, i) => i !== index);
    setSettings(updated);
  };

  const getOutcomeIcon = (key) => {
    switch (key) {
      case 'free_sponsors_4': return <Megaphone className="h-4 w-4 text-amber-500" />;
      case 'free_sponsor_10_days': return <Megaphone className="h-4 w-4 text-blue-500" />;
      case 'free_theme': return <Palette className="h-4 w-4 text-fuchsia-500" />;
      case 'free_subscription': return <Crown className="h-4 w-4 text-amber-500" />;
      case 'subscription_extension': return <CalendarPlus className="h-4 w-4 text-amber-600" />;
      case 'wallet_credit_small': return <Wallet className="h-4 w-4 text-emerald-500" />;
      case 'wallet_credit_large': return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'commission_reduction': return <Percent className="h-4 w-4 text-blue-500" />;
      case 'another_spin': return <Zap className="h-4 w-4 text-violet-500" />;
      case 'try_again': return <RotateCcw className="h-4 w-4 text-slate-400" />;
      default: return <Gift className="h-4 w-4 text-pink-500" />;
    }
  };

  const handleGrantFreeSpin = async () => {
    const shop_ids = grantMode === 'all' ? 'all' : selectedShopIds;
    if (grantMode === 'select' && (!shop_ids.length)) { toast.error('Pick at least one shop'); return; }
    setGranting(true);
    try {
      const { data } = await api.adminSpin.grantFreeSpins({ shop_ids, count: grantCount });
      toast.success(data.message || 'Free spins granted!');
      setSelectedShopIds([]);
      setGrantCount(1);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to grant');
    } finally {
      setGranting(false);
    }
  };

  const toggleShopSelection = (id) => {
    setSelectedShopIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const filteredShops = shops.filter((s) => {
    if (!shopSearch.trim()) return true;
    return (s.name || '').toLowerCase().includes(shopSearch.toLowerCase());
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </AdminLayout>
    );
  }

  const activeOutcomes = settings?.outcomes?.filter(o => o.is_active !== false) || [];
  const totalWeight = activeOutcomes.reduce((sum, o) => sum + (o.weight || 0), 0);

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl p-2.5">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Lucky Spin Wheel</h1>
              <p className="text-slate-500 text-sm">Configure spin wheel settings and view history</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'settings'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                : 'bg-white text-slate-600 border hover:bg-slate-50'
            }`}
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
          <button
            onClick={() => setTab('grant')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'grant'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-600 border hover:bg-slate-50'
            }`}
            data-testid="spin-grant-tab"
          >
            <Gift className="h-4 w-4" /> Give Free Spin
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'history'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                : 'bg-white text-slate-600 border hover:bg-slate-50'
            }`}
          >
            <History className="h-4 w-4" /> Spin History ({history.length})
          </button>
        </div>

        {tab === 'settings' && settings && (
          <div className="space-y-6">
            {/* General Settings */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-lg mb-4">General Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Spin Cost (USD)</Label>
                  <Input
                    type="number"
                    value={settings.spin_cost_usd || 7}
                    onChange={(e) => setSettings({ ...settings, spin_cost_usd: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    step="0.5"
                    data-testid="spin-cost-input"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enabled !== false}
                      onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                      className="rounded border-violet-300 text-violet-600 focus:ring-violet-500 w-5 h-5"
                    />
                    <span className="text-sm font-medium">Spin Wheel Enabled</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Outcomes */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Spin Outcomes</h3>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    totalWeight === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    Active Total: {totalWeight}%
                  </span>
                  <Button variant="outline" size="sm" onClick={addOutcome}>
                    <Plus className="h-4 w-4 mr-1" /> Add Outcome
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                {settings.outcomes?.map((outcome, idx) => {
                  const isActive = outcome.is_active !== false;
                  return (
                    <div key={idx} className={`border rounded-xl p-4 transition-all ${isActive ? 'hover:border-violet-200' : 'opacity-60 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        {getOutcomeIcon(outcome.key)}
                        <span className={`font-medium text-sm ${!isActive ? 'line-through text-slate-400' : ''}`}>{outcome.label}</span>
                        <span className="ml-auto text-xs text-slate-400">Key: {outcome.key}</span>
                        <div className="flex items-center gap-2 ml-3">
                          <span className={`text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleOutcomeActive(idx)}
                            data-testid={`toggle-outcome-${idx}`}
                          />
                        </div>
                      </div>
                      {isActive && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={outcome.label}
                              onChange={(e) => updateOutcome(idx, 'label', e.target.value)}
                              className="mt-1 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Chance (%)</Label>
                            <Input
                              type="number"
                              value={outcome.weight}
                              onChange={(e) => updateOutcome(idx, 'weight', e.target.value)}
                              className="mt-1 text-sm"
                              min="0"
                              max="100"
                            />
                          </div>
                          {outcome.key.includes('wallet_credit') && (
                            <div>
                              <Label className="text-xs">Amount ($)</Label>
                              <Input
                                type="number"
                                value={outcome.payload?.amount || 0}
                                onChange={(e) => updateOutcome(idx, 'payload.amount', e.target.value)}
                                className="mt-1 text-sm"
                                step="0.5"
                              />
                            </div>
                          )}
                          {outcome.key === 'commission_reduction' && (
                            <>
                              <div>
                                <Label className="text-xs">Reduction (%)</Label>
                                <Input
                                  type="number"
                                  value={outcome.payload?.reduction_percent || 0}
                                  onChange={(e) => updateOutcome(idx, 'payload.reduction_percent', e.target.value)}
                                  className="mt-1 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Duration (days)</Label>
                                <Input
                                  type="number"
                                  value={outcome.payload?.duration_days || 0}
                                  onChange={(e) => updateOutcome(idx, 'payload.duration_days', e.target.value)}
                                  className="mt-1 text-sm"
                                />
                              </div>
                            </>
                          )}
                          {(outcome.key === 'free_subscription' || outcome.key === 'subscription_extension') && (
                            <div>
                              <Label className="text-xs">Days to Add</Label>
                              <Input
                                type="number"
                                value={outcome.payload?.days || (outcome.key === 'subscription_extension' ? 15 : 30)}
                                onChange={(e) => updateOutcome(idx, 'payload.days', e.target.value)}
                                className="mt-1 text-sm"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              data-testid="save-spin-settings-btn"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        )}

        {tab === 'grant' && (
          <div className="bg-white rounded-2xl border p-6 max-w-3xl shadow-sm">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Give Free Spins to Shops</h3>
                <p className="text-sm text-slate-500">Recipients get an in-app message + an email from <span className="font-semibold">openmarketlb@gmail.com</span></p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Who should receive?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGrantMode('all')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${grantMode === 'all' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}
                    data-testid="grant-mode-all"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-sm">All Shops</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Send to every approved shop ({shops.length})</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantMode('select')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${grantMode === 'select' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}
                    data-testid="grant-mode-select"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span className="font-bold text-sm">Specific Shops</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Pick which shops get the gift</p>
                  </button>
                </div>
              </div>

              {grantMode === 'select' && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Select shops</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search shops..."
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      className="pl-9 h-10"
                      data-testid="grant-shop-search"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto border-2 border-slate-200 rounded-xl p-2 space-y-1">
                    {filteredShops.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6">No shops match your search</p>
                    ) : filteredShops.map((s) => {
                      const checked = selectedShopIds.includes(s.id);
                      return (
                        <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'}`} data-testid={`grant-shop-row-${s.id}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleShopSelection(s.id)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          {s.logo ? <img src={s.logo} alt={s.name} className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-slate-200" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{s.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{s.email || '—'}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{selectedShopIds.length} selected</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-2 block">How many free spins per shop?</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={grantCount}
                  onChange={(e) => setGrantCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="max-w-[140px]"
                  data-testid="grant-count-input"
                />
              </div>

              <Button
                onClick={handleGrantFreeSpin}
                disabled={granting || (grantMode === 'select' && selectedShopIds.length === 0)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                data-testid="grant-spin-button"
              >
                {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Grant {grantCount} Free Spin{grantCount !== 1 ? 's' : ''} to {grantMode === 'all' ? 'All Shops' : `${selectedShopIds.length} Shop${selectedShopIds.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Date</th>
                    <th className="text-left p-3 font-medium text-slate-600">Shop</th>
                    <th className="text-left p-3 font-medium text-slate-600">Type</th>
                    <th className="text-left p-3 font-medium text-slate-600">Cost</th>
                    <th className="text-left p-3 font-medium text-slate-600">Result</th>
                    <th className="text-left p-3 font-medium text-slate-600">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No spin history yet</td></tr>
                  ) : history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="p-3 font-medium">{h.shop_name || h.shop_id?.substring(0, 12)}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          h.spin_type === 'monthly_free' ? 'bg-emerald-100 text-emerald-700' :
                          h.spin_type === 'paid' ? 'bg-blue-100 text-blue-700' :
                          'bg-violet-100 text-violet-700'
                        }`}>
                          {h.spin_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3">{h.cost > 0 ? `$${h.cost.toFixed(2)}` : 'Free'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {getOutcomeIcon(h.outcome_key)}
                          <span className="text-xs">{h.outcome_label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {h.applied_effects?.type === 'wallet_credit' && `+$${h.applied_effects.amount}`}
                        {h.applied_effects?.type === 'subscription_extension' && `+${h.applied_effects.days_added} days`}
                        {h.applied_effects?.type === 'commission_reduction' && `-${h.applied_effects.reduction_percent}% for ${h.applied_effects.duration_days}d`}
                        {h.applied_effects?.type === 'commission_reduction_rejected' && (
                          <span className="text-amber-600">Already active - free re-spin granted</span>
                        )}
                        {h.applied_effects?.type === 'free_theme' && <span className="text-fuchsia-600 font-medium">+1 Free Theme credit</span>}
                        {h.applied_effects?.type === 'free_sponsor_credits' && <span className="text-amber-700 font-medium">+{h.applied_effects.count} sponsor credit{h.applied_effects.count !== 1 ? 's' : ''}</span>}
                        {h.applied_effects?.type === 'free_sponsor_10day' && <span className="text-blue-700 font-medium">+{h.applied_effects.count} × {h.applied_effects.days}-day sponsor</span>}
                        {h.applied_effects?.type === 'another_spin' && 'Free spin'}
                        {h.applied_effects?.type === 'try_again' && 'No effect'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSpinWheel;
