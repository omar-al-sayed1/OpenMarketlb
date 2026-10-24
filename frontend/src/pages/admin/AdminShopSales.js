import React, { useState, useEffect } from 'react';
import { Tag, Store, Calendar, Percent, Clock, Edit3, Trash2, X, Search, Sparkles, Flame, TrendingUp, AlertTriangle, Filter, Zap } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Live countdown component
const CountdownTimer = ({ endDate, compact = true }) => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(endDate));

  function getTimeLeft(end) {
    const diff = new Date(end) - new Date();
    if (diff <= 0) return { expired: true };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  }

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft(endDate)), 1000);
    return () => clearInterval(t);
  }, [endDate]);

  if (timeLeft.expired) {
    return <span className="text-red-500 font-semibold text-[10px]">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1 text-white font-mono text-xs">
      {timeLeft.days > 0 && <span className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded">{timeLeft.days}d</span>}
      <span className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}h</span>
      <span className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}m</span>
      <span className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded animate-pulse">{String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
};

export default function AdminShopSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, expired
  const [search, setSearch] = useState('');
  const [editingSale, setEditingSale] = useState(null);
  const [editForm, setEditForm] = useState({ discount_percent: 0, end_date: '', title: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data } = await api.adminShopSales.getAll();
      setSales(data || []);
    } catch { toast.error('Failed to load shop sales'); }
    finally { setLoading(false); }
  };

  const isActive = (sale) => sale.is_active && !sale.is_expired;
  const filtered = sales.filter(s => {
    if (filter === 'active' && !isActive(s)) return false;
    if (filter === 'expired' && isActive(s)) return false;
    if (search && !(s.shop_name?.toLowerCase().includes(search.toLowerCase()) || s.title?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const activeCount = sales.filter(s => isActive(s)).length;
  const expiredCount = sales.length - activeCount;
  const avgDiscount = activeCount > 0
    ? Math.round(sales.filter(s => isActive(s)).reduce((sum, s) => sum + (s.discount_percent || 0), 0) / activeCount)
    : 0;
  const highestDiscount = sales.length > 0 ? Math.max(...sales.map(s => s.discount_percent || 0)) : 0;

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setEditForm({
      discount_percent: sale.discount_percent,
      end_date: sale.end_date?.slice(0, 16) || '',
      title: sale.title || '',
      description: sale.description || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSale) return;
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        end_date: editForm.end_date ? new Date(editForm.end_date).toISOString() : editingSale.end_date,
      };
      await api.adminShopSales.update(editingSale.id, payload);
      toast.success('Sale updated successfully');
      setEditingSale(null);
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sale) => {
    if (!window.confirm(`Delete sale "${sale.title}" from ${sale.shop_name}? Original prices will be restored.`)) return;
    try {
      await api.adminShopSales.delete(sale.id);
      toast.success('Sale deleted and prices restored');
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete sale');
    }
  };

  const handleToggleActive = async (sale) => {
    try {
      await api.adminShopSales.update(sale.id, { is_active: !sale.is_active });
      toast.success(sale.is_active ? 'Sale deactivated' : 'Sale reactivated');
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle sale');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-shop-sales-page">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-rose-500 to-orange-500 p-6 sm:p-8 shadow-xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white blur-3xl"></div>
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-yellow-300 blur-3xl"></div>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Flame className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Shop Sales</h1>
                  <p className="text-white/85 text-sm">Manage all shop-wide discount campaigns</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200/60 p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Active Sales</span>
              <div className="p-1.5 rounded-lg bg-emerald-100">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-700">{activeCount}</div>
            <div className="text-[10px] text-emerald-600/70 mt-0.5">live campaigns</div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200/60 p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-violet-700 font-semibold uppercase tracking-wider">Avg Discount</span>
              <div className="p-1.5 rounded-lg bg-violet-100">
                <Percent className="h-3.5 w-3.5 text-violet-600" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-violet-700">{avgDiscount}%</div>
            <div className="text-[10px] text-violet-600/70 mt-0.5">across active sales</div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-200/60 p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider">Highest Off</span>
              <div className="p-1.5 rounded-lg bg-rose-100">
                <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-700">{highestDiscount}%</div>
            <div className="text-[10px] text-rose-600/70 mt-0.5">deepest discount</div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-700 font-semibold uppercase tracking-wider">Expired</span>
              <div className="p-1.5 rounded-lg bg-slate-100">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-700">{expiredCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">past campaigns</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by shop name or sale title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-lg"
                data-testid="search-sales-input"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
              {[
                { value: 'all', label: 'All', count: sales.length },
                { value: 'active', label: 'Active', count: activeCount },
                { value: 'expired', label: 'Expired', count: expiredCount },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filter === opt.value
                      ? 'bg-white text-violet-600 shadow-sm border border-violet-100'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                  data-testid={`filter-${opt.value}`}
                >
                  {opt.label} <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sales Cards */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading sales...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-violet-50/30 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-violet-200 rounded-full blur-2xl opacity-40"></div>
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center shadow-xl">
                <Tag className="h-10 w-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Sales Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {search || filter !== 'all'
                ? 'Try adjusting your filters to see more results'
                : 'When shops launch sales, they will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3" data-testid="shop-sales-list">
            {filtered.map(sale => {
              const active = isActive(sale);
              return (
                <div
                  key={sale.id}
                  className={`group relative overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500'
                      : 'bg-white border border-slate-200 opacity-90'
                  }`}
                  data-testid={`sale-row-${sale.id}`}
                >
                  {/* Background pattern for active */}
                  {active && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white blur-2xl"></div>
                      <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-yellow-300 blur-2xl"></div>
                    </div>
                  )}

                  <div className="relative p-5 flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    {/* Discount circle */}
                    <div className="flex-shrink-0">
                      <div className={`relative h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center shadow-lg ${
                        active ? 'bg-white' : 'bg-slate-100'
                      }`}>
                        <div className={`absolute inset-1 rounded-full border-2 border-dashed ${
                          active ? 'border-rose-200' : 'border-slate-300'
                        }`}></div>
                        <div className="text-center">
                          <div className={`text-2xl sm:text-3xl font-black leading-none ${active ? 'text-rose-600' : 'text-slate-500'}`}>
                            {sale.discount_percent}%
                          </div>
                          <div className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${active ? 'text-rose-400' : 'text-slate-400'}`}>
                            OFF
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${active ? 'text-white' : 'text-slate-700'}`}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          active ? 'bg-emerald-400 text-emerald-900' : sale.is_expired ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-900 animate-pulse' : 'bg-current'}`}></span>
                          {active ? 'Active' : sale.is_expired ? 'Expired' : 'Inactive'}
                        </span>
                        {active && <Sparkles className="h-3.5 w-3.5 text-yellow-300" />}
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <Store className={`h-4 w-4 ${active ? 'text-white/80' : 'text-violet-500'}`} />
                        <span className={`font-semibold text-sm ${active ? 'text-white/95' : 'text-violet-700'}`}>
                          {sale.shop_name || 'Unknown Shop'}
                        </span>
                      </div>

                      <h3 className={`text-lg sm:text-xl font-bold truncate ${active ? 'text-white' : 'text-slate-800'}`}>
                        {sale.title || 'Untitled Sale'}
                      </h3>

                      {sale.description && (
                        <p className={`text-xs line-clamp-1 mt-0.5 ${active ? 'text-white/80' : 'text-slate-500'}`}>
                          {sale.description}
                        </p>
                      )}

                      <div className={`flex items-center gap-3 mt-2 text-xs ${active ? 'text-white/85' : 'text-slate-500'}`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(sale.end_date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(sale.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Countdown + Actions */}
                    <div className="flex flex-col gap-2 lg:items-end w-full lg:w-auto">
                      {active && (
                        <div className="flex flex-col items-start lg:items-end gap-1">
                          <div className="flex items-center gap-1 text-white/85 text-[10px] uppercase tracking-wider font-semibold">
                            <Clock className="h-3 w-3" /> Ends In
                          </div>
                          <CountdownTimer endDate={sale.end_date} />
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        {!sale.is_expired && (
                          <Button
                            size="sm"
                            onClick={() => handleToggleActive(sale)}
                            className={active
                              ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200'
                            }
                            title={sale.is_active ? 'Deactivate' : 'Activate'}
                            data-testid={`toggle-sale-${sale.id}`}
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" /> {sale.is_active ? 'Pause' : 'Resume'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleEdit(sale)}
                          className={active
                            ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm'
                            : 'bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200'
                          }
                          data-testid={`edit-sale-${sale.id}`}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(sale)}
                          className={active
                            ? 'bg-red-500/20 hover:bg-red-500/40 text-white border-red-300/30 backdrop-blur-sm'
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          }
                          data-testid={`delete-sale-${sale.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Modal */}
        {editingSale && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="edit-sale-modal">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingSale(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-rose-500 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Edit Sale</h3>
                      <p className="text-xs text-white/80">{editingSale.shop_name}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingSale(null)} className="p-1.5 rounded-full hover:bg-white/20 text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <Tag className="h-3.5 w-3.5 text-rose-500" /> Title
                  </Label>
                  <Input
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="rounded-lg"
                    data-testid="edit-title-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1 mb-1.5">
                      <Percent className="h-3.5 w-3.5 text-rose-500" /> Discount %
                    </Label>
                    <Input
                      type="number" min="1" max="90"
                      value={editForm.discount_percent}
                      onChange={e => setEditForm({ ...editForm, discount_percent: parseFloat(e.target.value) || 0 })}
                      className="rounded-lg"
                      data-testid="edit-discount-input"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-rose-500" /> End Date
                    </Label>
                    <Input
                      type="datetime-local"
                      value={editForm.end_date}
                      onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                      className="rounded-lg"
                      data-testid="edit-end-date-input"
                    />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Description
                  </Label>
                  <Input
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                {/* Preview */}
                <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-2 tracking-wider">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-rose-500 to-orange-500 text-white text-xl font-black px-3 py-1.5 rounded-lg shadow-lg">
                      -{editForm.discount_percent}%
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{editForm.title || 'Untitled Sale'}</p>
                      {editForm.description && <p className="text-xs text-slate-500">{editForm.description}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 p-4 flex gap-3 bg-slate-50">
                <Button variant="outline" onClick={() => setEditingSale(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-rose-500 hover:from-violet-600 hover:to-rose-600 text-white"
                  data-testid="save-edit-btn"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
