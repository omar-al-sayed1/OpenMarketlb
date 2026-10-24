import React, { useEffect, useState } from 'react';
import { Gift, Star, TrendingUp, Users, Settings, Zap, Calendar, Plus, Trash2, Save, Award, Crown, Medal, Eye, PanelRight } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminLoyalty = () => {
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bonusDialog, setBonusDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', description: '', type: 'multiplier', multiplier: 2, added_points: 100, display_mode: 'center', start_date: '', end_date: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, settingsRes] = await Promise.all([
        api.adminLoyalty.getAnalytics(),
        api.adminLoyalty.getSettings()
      ]);
      setAnalytics(analyticsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Failed to fetch loyalty data', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.adminLoyalty.updateSettings(settings);
      toast.success('Loyalty settings saved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBonusEvent = async () => {
    try {
      await api.adminLoyalty.addBonusEvent({ ...newEvent, is_active: true });
      toast.success('Bonus event added!');
      setBonusDialog(false);
      setNewEvent({ name: '', description: '', type: 'multiplier', multiplier: 2, added_points: 100, display_mode: 'center', start_date: '', end_date: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add bonus event');
    }
  };

  const handleDeleteBonusEvent = async (id) => {
    try {
      await api.adminLoyalty.deleteBonusEvent(id);
      toast.success('Bonus event deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const tierIcons = { Bronze: Medal, Silver: Award, Gold: Crown };
  const tierColors = { Bronze: 'text-amber-700 bg-amber-100', Silver: 'text-slate-600 bg-slate-200', Gold: 'text-yellow-600 bg-yellow-100' };

  if (!analytics || !settings) return <AdminLayout><div className="p-8 text-center text-slate-400">Loading...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-6 admin-table-page" data-testid="admin-loyalty">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl text-white">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-heading font-bold">Loyalty & Rewards</h1>
              <p className="text-sm text-slate-500">Manage your customer loyalty program</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-full" data-testid="save-loyalty-btn">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Points Issued', value: analytics.total_points_issued.toLocaleString(), icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
            { label: 'Points Redeemed', value: analytics.total_points_redeemed.toLocaleString(), icon: Gift, color: 'from-violet-500 to-indigo-500' },
            { label: 'Outstanding', value: analytics.total_points_outstanding.toLocaleString(), icon: Star, color: 'from-amber-500 to-orange-500' },
            { label: 'Discount Given', value: `$${analytics.total_discount_given}`, icon: Zap, color: 'from-rose-500 to-pink-500' },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${card.color} text-white mb-2`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Members by Tier */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          {Object.entries(analytics.tier_breakdown || {}).map(([tier, count]) => {
            const Icon = tierIcons[tier] || Medal;
            const color = tierColors[tier] || 'text-slate-600 bg-slate-100';
            return (
              <div key={tier} className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{tier}</p>
                  <p className="text-sm text-slate-500">{count} member{count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-slate-500" /> Program Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <p className="font-medium text-amber-900">Enable Loyalty Program</p>
                  <p className="text-xs text-amber-600">Customers earn points on purchases</p>
                </div>
                <Switch
                  checked={settings.loyalty_enabled !== false}
                  onCheckedChange={(v) => setSettings({ ...settings, loyalty_enabled: v })}
                  data-testid="loyalty-enabled-switch"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Points per $1 Spent</Label>
                  <Input type="number" min="0" step="0.1" value={settings.points_per_dollar || 1}
                    onChange={(e) => setSettings({ ...settings, points_per_dollar: parseFloat(e.target.value) || 1 })}
                    data-testid="points-per-dollar"
                  />
                </div>
                <div>
                  <Label>Points per $1 Discount</Label>
                  <Input type="number" min="1" value={settings.redeem_points_per_dollar || 100}
                    onChange={(e) => setSettings({ ...settings, redeem_points_per_dollar: parseInt(e.target.value) || 100 })}
                    data-testid="redeem-rate"
                  />
                  <p className="text-xs text-slate-400 mt-1">{settings.redeem_points_per_dollar || 100} pts = $1 off</p>
                </div>
              </div>

              {/* Tier Settings */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Tier Thresholds</h3>
                {(settings.tiers || []).map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-medium w-16 ${idx === 0 ? 'text-amber-700' : idx === 1 ? 'text-slate-600' : 'text-yellow-600'}`}>{tier.name}</span>
                    <Input type="number" className="w-24" value={tier.min_points}
                      onChange={(e) => {
                        const newTiers = [...settings.tiers];
                        newTiers[idx] = { ...newTiers[idx], min_points: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, tiers: newTiers });
                      }}
                    />
                    <span className="text-xs text-slate-400">pts</span>
                    <Input type="number" step="0.1" className="w-20" value={tier.multiplier}
                      onChange={(e) => {
                        const newTiers = [...settings.tiers];
                        newTiers[idx] = { ...newTiers[idx], multiplier: parseFloat(e.target.value) || 1 };
                        setSettings({ ...settings, tiers: newTiers });
                      }}
                    />
                    <span className="text-xs text-slate-400">x multiplier</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bonus & Events */}
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Bonuses & Events</h2>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
                <div>
                  <p className="font-medium text-violet-900">Double Points Weekends</p>
                  <p className="text-xs text-violet-600">2x points on Saturday & Sunday</p>
                </div>
                <Switch
                  checked={settings.double_points_weekend_enabled || false}
                  onCheckedChange={(v) => setSettings({ ...settings, double_points_weekend_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200">
                <div>
                  <p className="font-medium text-pink-900">Birthday Bonus</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" className="w-20 h-7 text-xs" value={settings.birthday_bonus_points || 50}
                      onChange={(e) => setSettings({ ...settings, birthday_bonus_points: parseInt(e.target.value) || 50 })}
                    />
                    <span className="text-xs text-pink-600">bonus points</span>
                  </div>
                </div>
                <Switch
                  checked={settings.birthday_bonus_enabled || false}
                  onCheckedChange={(v) => setSettings({ ...settings, birthday_bonus_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex-1">
                  <p className="font-medium text-emerald-900">First Purchase Bonus</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" className="w-20 h-7 text-xs" value={settings.first_purchase_bonus_points || 100}
                      onChange={(e) => setSettings({ ...settings, first_purchase_bonus_points: parseInt(e.target.value) || 100 })}
                    />
                    <span className="text-xs text-emerald-600">bonus points</span>
                  </div>
                  {settings.first_purchase_bonus_enabled && (
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 mb-1">Popup Display (optional)</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { value: 'none', label: 'No Popup' },
                          { value: 'center', label: 'Center Modal' },
                          { value: 'side_fixed', label: 'Side Widget' },
                          { value: 'side', label: 'Side Toast' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSettings({ ...settings, first_purchase_bonus_display: opt.value })}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                              (settings.first_purchase_bonus_display || 'none') === opt.value 
                                ? 'border-emerald-500 bg-emerald-100 text-emerald-700' 
                                : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Switch
                  checked={settings.first_purchase_bonus_enabled || false}
                  onCheckedChange={(v) => setSettings({ ...settings, first_purchase_bonus_enabled: v })}
                />
              </div>
            </div>

            {/* Custom Bonus Events */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-600">Custom Bonus Events</h3>
                <Dialog open={bonusDialog} onOpenChange={setBonusDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-xs"><Plus className="h-3 w-3 mr-1" /> Add Event</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Bonus Event</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Event Name</Label>
                        <Input value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="e.g. Summer Sale" />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="e.g. Earn extra points!" />
                      </div>
                      {/* Event Type */}
                      <div>
                        <Label>Event Type</Label>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, type: 'multiplier' })}
                            className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${newEvent.type === 'multiplier' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}
                          >
                            <Zap className="h-4 w-4 mx-auto mb-1" />
                            Multiplier
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, type: 'added_points' })}
                            className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${newEvent.type === 'added_points' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'}`}
                          >
                            <Gift className="h-4 w-4 mx-auto mb-1" />
                            Added Points
                          </button>
                        </div>
                      </div>
                      {newEvent.type === 'multiplier' ? (
                        <div>
                          <Label>Points Multiplier</Label>
                          <Input type="number" step="0.5" min="1" value={newEvent.multiplier} onChange={(e) => setNewEvent({ ...newEvent, multiplier: parseFloat(e.target.value) })} />
                          <p className="text-xs text-slate-400 mt-1">e.g. 2 = double points on purchases during event</p>
                        </div>
                      ) : (
                        <div>
                          <Label>Bonus Points to Give</Label>
                          <Input type="number" min="1" value={newEvent.added_points} onChange={(e) => setNewEvent({ ...newEvent, added_points: parseInt(e.target.value) })} />
                          <p className="text-xs text-slate-400 mt-1">All users can claim these points (popup shown, one-time per user)</p>
                        </div>
                      )}
                      {/* Display Mode - 3 options */}
                      <div>
                        <Label className="mb-2 block">Popup Display</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, display_mode: 'center' })}
                            className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${newEvent.display_mode === 'center' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}
                          >
                            <Eye className="h-4 w-4 mx-auto mb-1" />
                            Center Popup
                            <p className="text-[10px] text-slate-400 mt-0.5">Full modal overlay</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, display_mode: 'side_fixed' })}
                            className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${newEvent.display_mode === 'side_fixed' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                          >
                            <PanelRight className="h-4 w-4 mx-auto mb-1" />
                            Side Widget
                            <p className="text-[10px] text-slate-400 mt-0.5">Fixed badge, click to expand</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, display_mode: 'side' })}
                            className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${newEvent.display_mode === 'side' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
                          >
                            <Calendar className="h-4 w-4 mx-auto mb-1" />
                            Side Toast
                            <p className="text-[10px] text-slate-400 mt-0.5">Auto-hides 7-9s</p>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Start Date</Label>
                          <Input type="date" value={newEvent.start_date} onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })} />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input type="date" value={newEvent.end_date} onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })} />
                        </div>
                      </div>
                      <Button onClick={handleAddBonusEvent} className="w-full">Add Event</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {(settings.bonus_events || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No custom bonus events yet</p>
              ) : (
                <div className="space-y-2">
                  {(settings.bonus_events || []).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{event.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${event.type === 'added_points' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                            {event.type === 'added_points' ? `+${event.added_points} pts` : `${event.multiplier}x`}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            event.display_mode === 'center' ? 'bg-violet-50 text-violet-600' : 
                            event.display_mode === 'side_fixed' ? 'bg-blue-50 text-blue-600' :
                            'bg-emerald-50 text-emerald-600'
                          }`}>
                            {event.display_mode === 'center' ? 'Center' : event.display_mode === 'side_fixed' ? 'Side Widget' : 'Toast'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{event.description} {event.start_date && `| ${event.start_date} - ${event.end_date}`}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteBonusEvent(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminLoyalty;
