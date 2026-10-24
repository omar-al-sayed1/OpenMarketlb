import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ClipboardList, Package, Truck, Eye, Search, Filter, CheckCircle, Clock, MapPin, ChevronRight } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-slate-100 text-slate-800',
};

const ShopMyOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Returns orders placed by the logged-in user (shop owner shopping)
      const { data } = await api.orders.getAll();
      // Sort newest first
      const sorted = [...data].sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const dbb = new Date(b.created_at).getTime();
        return dbb - da;
      });
      setOrders(sorted);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      toast.error('Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.order_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = (o.id || '').toLowerCase().includes(q) ||
                  (o.shop_name || '').toLowerCase().includes(q) ||
                  (o.items || []).some((it) => (it.product_name || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <ShopLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
              <ClipboardList className="h-7 w-7 text-emerald-600" /> My Orders
            </h1>
            <p className="text-sm text-slate-500 mt-1">Orders you placed as a buyer. Tap any order to track it in real time.</p>
          </div>
          <Button onClick={() => navigate('/products')} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            <Package className="h-4 w-4 mr-1" /> Shop More
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by order ID, shop or product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" data-testid="my-orders-search" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="my-orders-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading orders…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <ClipboardList className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">No orders yet</h3>
            <p className="text-sm text-slate-500 mb-4">Once you place an order from another shop it will appear here.</p>
            <Button onClick={() => navigate('/products')} className="rounded-full bg-emerald-600 hover:bg-emerald-700">Browse products</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((order) => {
              const trackHref = `/track-order/${order.id}`;
              const statusKey = (order.order_status || 'pending').toLowerCase();
              const statusClass = STATUS_COLORS[statusKey] || 'bg-slate-100 text-slate-700';
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition overflow-hidden">
                  <div className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:items-center">
                    {/* Left: order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500">Order</span>
                        <span className="font-mono text-sm font-semibold text-slate-800">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <Badge className={`${statusClass} border-0 capitalize`}>{statusKey}</Badge>
                        {order.payment_status === 'paid' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0">Paid</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-0">{order.payment_status || 'Pending payment'}</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(order.created_at)}</span>
                        {order.shop_name && (
                          <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {order.shop_name}</span>
                        )}
                        {order.shipping_address?.city && (
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.shipping_address.city}</span>
                        )}
                      </div>
                      {/* Items preview */}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                          {order.items.slice(0, 4).map((it, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-2 py-1.5 text-xs whitespace-nowrap">
                              {it.product_image ? (
                                <img src={it.product_image} alt="" className="w-7 h-7 rounded object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center">
                                  <Package className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                              )}
                              <span className="font-medium text-slate-700">{it.product_name || 'Item'}</span>
                              <span className="text-slate-400">× {it.quantity}</span>
                            </div>
                          ))}
                          {order.items.length > 4 && (
                            <div className="px-2 py-1.5 text-xs text-slate-500">+{order.items.length - 4} more</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col items-stretch md:items-end gap-2 md:min-w-[200px]">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Total</div>
                        <div className="text-2xl font-extrabold text-slate-900">${Number(order.total_amount || 0).toFixed(2)}</div>
                      </div>
                      <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700" data-testid={`track-order-btn-${order.id}`}>
                        <Link to={trackHref}>
                          <Truck className="h-4 w-4 mr-1" /> Track Order <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ShopLayout>
  );
};

export default ShopMyOrders;
