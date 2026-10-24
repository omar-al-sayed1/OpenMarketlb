import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit3, Calendar, Percent, Clock, AlertCircle, X, AlertTriangle, TrendingUp, Sparkles, Flame, Zap, Timer } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Live countdown component
const CountdownTimer = ({ endDate, compact = false }) => {
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
    return <span className="text-red-500 font-semibold text-xs">Expired</span>;
  }

  const TimeBox = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div className={`bg-white/95 backdrop-blur-sm rounded-md ${compact ? 'px-1.5 py-0.5 min-w-[28px]' : 'px-2 py-1 min-w-[36px]'} text-center shadow-sm border border-white/40`}>
        <span className={`font-mono font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>{String(value).padStart(2, '0')}</span>
      </div>
      <span className={`text-white/90 ${compact ? 'text-[8px]' : 'text-[9px]'} mt-0.5 uppercase tracking-wider`}>{label}</span>
    </div>
  );

  return (
    <div className="flex items-end gap-1">
      {timeLeft.days > 0 && <TimeBox value={timeLeft.days} label="d" />}
      <TimeBox value={timeLeft.hours} label="h" />
      <TimeBox value={timeLeft.minutes} label="m" />
      <TimeBox value={timeLeft.seconds} label="s" />
    </div>
  );
};

export default function ShopSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ discount_percent: 10, end_date: '', title: '', description: '' });
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [higherDiscountProducts, setHigherDiscountProducts] = useState([]);
  const [pendingFormData, setPendingFormData] = useState(null);

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    try {
      const { data } = await api.shop.getSales();
      setSales(data || []);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.end_date) { toast.error('End date is required'); return; }

    if (editing) {
      try {
        await api.shop.updateSale(editing, form);
        toast.success('Sale updated successfully');
        resetForm();
        fetchSales();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update sale'); }
      return;
    }

    try {
      const previewData = { ...form, end_date: new Date(form.end_date).toISOString() };
      const { data } = await api.shop.previewSale(previewData);
      if (data.total > 0) {
        setHigherDiscountProducts(data.products_with_higher_discount);
        setPendingFormData(previewData);
        setShowConfirmPopup(true);
      } else {
        await createSaleDirectly(previewData);
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to preview sale'); }
  };

  const resetForm = () => {
    setShowForm(false); setEditing(null);
    setForm({ discount_percent: 10, end_date: '', title: '', description: '' });
  };

  const createSaleDirectly = async (data) => {
    try {
      await api.shop.createSale(data);
      toast.success('🎉 Sale launched! Prices updated on all products.');
      resetForm();
      fetchSales();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create sale'); }
  };

  const handleConfirmSale = async () => {
    if (pendingFormData) await createSaleDirectly(pendingFormData);
    setShowConfirmPopup(false);
    setHigherDiscountProducts([]);
    setPendingFormData(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirmPopup(false);
    setHigherDiscountProducts([]);
    setPendingFormData(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sale? Original prices will be restored on all products.')) return;
    try {
      await api.shop.deleteSale(id);
      toast.success('Sale deleted - prices restored');
      fetchSales();
    } catch { toast.error('Failed to delete sale'); }
  };

  const handleEdit = (sale) => {
    setEditing(sale.id);
    setForm({
      discount_percent: sale.discount_percent,
      end_date: sale.end_date?.slice(0, 16) || '',
      title: sale.title || '',
      description: sale.description || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isExpired = (sale) => new Date(sale.end_date) < new Date();
  const activeSales = sales.filter(s => s.is_active && !isExpired(s));
  const expiredSales = sales.filter(s => !s.is_active || isExpired(s));
  const totalDiscountOffered = activeSales.reduce((sum, s) => sum + (s.discount_percent || 0), 0);
  const avgDiscount = activeSales.length > 0 ? Math.round(totalDiscountOffered / activeSales.length) : 0;

  return (
    <ShopLayout title="Shop Sales" icon={<Tag className="h-5 w-5" />}>
      <div className="space-y-6" data-testid="shop-sales-page">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500 p-6 sm:p-8 shadow-xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white blur-3xl"></div>
            <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-yellow-300 blur-3xl"></div>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Flame className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Sales Center</h1>
              </div>
              <p className="text-white/90 text-sm sm:text-base max-w-md">
                Launch store-wide discounts to boost sales and attract more customers
              </p>
            </div>
            <Button
              onClick={() => { showForm ? resetForm() : setShowForm(true); setEditing(null); setForm({ discount_percent: 10, end_date: '', title: '', description: '' }); }}
              className="bg-white text-rose-600 hover:bg-rose-50 font-bold shadow-lg shadow-rose-900/20 px-5 py-2.5 rounded-xl"
              data-testid="create-sale-btn"
            >
              {showForm ? <><X className="h-4 w-4 mr-1.5" /> Cancel</> : <><Sparkles className="h-4 w-4 mr-1.5" /> New Sale</>}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-medium">Active</span>
              <Zap className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{activeSales.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-medium">Average</span>
              <Percent className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{avgDiscount}%</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-medium">Total Sales</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{sales.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-medium">Expired</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{expiredSales.length}</div>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden" data-testid="sale-form">
            <div className="bg-gradient-to-r from-rose-50 to-pink-50 px-5 py-3 border-b border-rose-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                {editing ? <><Edit3 className="h-4 w-4 text-rose-600" /> Edit Sale</> : <><Sparkles className="h-4 w-4 text-rose-600" /> Create New Sale</>}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <Tag className="h-3.5 w-3.5 text-rose-500" /> Sale Title
                  </Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Summer Mega Sale" className="rounded-lg" data-testid="sale-title-input" />
                </div>
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <Percent className="h-3.5 w-3.5 text-rose-500" /> Discount %
                  </Label>
                  <div className="relative">
                    <Input
                      type="number" min="1" max="90"
                      value={form.discount_percent}
                      onChange={e => setForm({ ...form, discount_percent: parseFloat(e.target.value) || 0 })}
                      className="rounded-lg pr-12"
                      data-testid="sale-discount-input"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 font-bold text-sm">%</span>
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-rose-500" /> End Date & Time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="rounded-lg"
                    data-testid="sale-end-date-input"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Description (optional)
                  </Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" className="rounded-lg" />
                </div>
              </div>

              {/* Preview Card */}
              {form.discount_percent > 0 && (
                <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-2 tracking-wider">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-rose-500 to-orange-500 text-white text-2xl font-black px-4 py-2 rounded-xl shadow-lg shadow-rose-500/30">
                      -{form.discount_percent}%
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{form.title || 'Untitled Sale'}</p>
                      {form.description && <p className="text-xs text-slate-500">{form.description}</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> All product prices will be updated immediately
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit" className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md" data-testid="save-sale-btn">
                    {editing ? <><Edit3 className="h-4 w-4 mr-1.5" /> Update Sale</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Launch Sale</>}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Confirmation Popup */}
        {showConfirmPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="sale-confirm-popup-overlay">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancelConfirm} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" data-testid="sale-confirm-popup">
              <div className="bg-amber-50 border-b border-amber-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Products with Higher Discounts</h3>
                      <p className="text-xs text-slate-500">{higherDiscountProducts.length} product(s) currently have a higher discount</p>
                    </div>
                  </div>
                  <button onClick={handleCancelConfirm} className="p-1.5 rounded-full hover:bg-amber-100 text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 max-h-[300px] overflow-y-auto">
                <p className="text-sm text-slate-600 mb-4">
                  These products will have their discount <strong>reduced</strong> to {pendingFormData?.discount_percent}%. Do you want to proceed?
                </p>
                <div className="space-y-2.5">
                  {higherDiscountProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100" data-testid={`confirm-product-${p.id}`}>
                      {p.image && <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-rose-600 font-semibold">Current: {p.existing_discount_percent}% off</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-amber-600 font-semibold">New: {pendingFormData?.discount_percent}% off</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 p-4 flex gap-3 bg-slate-50">
                <Button variant="outline" onClick={handleCancelConfirm} className="flex-1" data-testid="cancel-sale-confirm">Cancel</Button>
                <Button onClick={handleConfirmSale} className="flex-1 bg-amber-600 hover:bg-amber-700" data-testid="confirm-sale-btn">
                  Apply {pendingFormData?.discount_percent}% to All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Active Sales Section */}
        {!loading && activeSales.length > 0 && (
          <div className="space-y-3" data-testid="sales-list">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Live Sales</h2>
            </div>
            <div className="grid gap-3">
              {activeSales.map(sale => (
                <div
                  key={sale.id}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500 p-5 shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/30 transition-all duration-300"
                  data-testid={`sale-card-${sale.id}`}
                >
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white blur-2xl"></div>
                    <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-yellow-300 blur-2xl"></div>
                  </div>

                  <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    {/* Discount circle */}
                    <div className="flex-shrink-0">
                      <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                        <div className="absolute inset-1 rounded-full border-2 border-dashed border-rose-200"></div>
                        <div className="text-center">
                          <div className="text-2xl sm:text-3xl font-black text-rose-600 leading-none">{sale.discount_percent}%</div>
                          <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider mt-0.5">OFF</div>
                        </div>
                      </div>
                    </div>

                    {/* Title and description */}
                    <div className="flex-1 min-w-0 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-900 animate-pulse"></span> Active
                        </span>
                        <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-1 truncate">{sale.title}</h3>
                      {sale.description && <p className="text-sm text-white/80 line-clamp-2">{sale.description}</p>}
                    </div>

                    {/* Countdown */}
                    <div className="flex flex-col items-start lg:items-end gap-2">
                      <div className="flex items-center gap-1.5 text-white/90 text-xs">
                        <Timer className="h-3.5 w-3.5" />
                        <span className="uppercase font-semibold tracking-wider">Ends in</span>
                      </div>
                      <CountdownTimer endDate={sale.end_date} />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 lg:flex-col w-full lg:w-auto">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(sale)}
                        className="flex-1 lg:w-24 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                        data-testid={`edit-sale-${sale.id}`}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(sale.id)}
                        className="flex-1 lg:w-24 bg-red-500/20 hover:bg-red-500/40 text-white border-red-300/30 backdrop-blur-sm"
                        data-testid={`delete-sale-${sale.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expired/Inactive Sales Section */}
        {!loading && expiredSales.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-slate-400"></div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Past Sales</h2>
            </div>
            <div className="grid gap-2">
              {expiredSales.map(sale => (
                <div
                  key={sale.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 opacity-75"
                  data-testid={`sale-card-${sale.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-slate-400">{sale.discount_percent}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-700 truncate">{sale.title}</h3>
                        {isExpired(sale) ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">EXPIRED</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">INACTIVE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(sale.end_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(sale.id)}
                    data-testid={`delete-sale-${sale.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && sales.length === 0 && (
          <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-rose-50/30 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-rose-200 rounded-full blur-2xl opacity-50"></div>
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-xl">
                <Tag className="h-10 w-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Sales Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
              Boost your sales by launching a discount campaign across your entire store. Your products will display attention-grabbing badges.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md"
            >
              <Sparkles className="h-4 w-4 mr-1.5" /> Launch Your First Sale
            </Button>
          </div>
        )}

        {loading && <div className="text-center py-12 text-slate-400">Loading sales...</div>}
      </div>
    </ShopLayout>
  );
}
