import React, { useEffect, useState, useMemo } from 'react';
import { Package, ShoppingCart, Eye, X, Search, DollarSign, Calendar, Filter, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const ShopOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [availableDelivery, setAvailableDelivery] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [maxPrice, setMaxPrice] = useState(2000);

  useEffect(() => {
    fetchOrders();
    // Fetch platform setting to know if delivery is enabled
    api.admin.getPlatformSettings().then(({ data }) => {
      setAvailableDelivery(data?.available_delivery !== false);
    }).catch(() => {});
  }, []);

  useEffect(() => { filterOrders(); }, [searchQuery, orders, statusFilter, timeFilter, priceRange]);

  const fetchOrders = async () => {
    try {
      const { data } = await api.shop.getOrders();
      setOrders(data);
      if (data.length > 0) {
        const max = Math.ceil(Math.max(...data.map(o => o.total_amount || 0)));
        setMaxPrice(max || 2000);
        setPriceRange([0, max || 2000]);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.guest_name || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.guest_email || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.order_status === statusFilter);
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(o => {
        const d = new Date(o.created_at);
        if (timeFilter === 'last_day') return (now - d) < 86400000;
        if (timeFilter === 'last_week') return (now - d) < 604800000;
        if (timeFilter === 'last_month') return (now - d) < 2592000000;
        return true;
      });
    }

    filtered = filtered.filter(o => {
      const amount = o.total_amount || 0;
      return amount >= priceRange[0] && amount <= priceRange[1];
    });

    setFilteredOrders(filtered);
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.shop.updateOrderStatus(orderId, newStatus);
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'shipped': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'paid': return 'bg-violet-100 text-violet-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <ShopLayout>
      
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 lg:p-4 shop-table-page compact-table" data-testid="shop-orders-content">
        <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-6" data-testid="shop-orders-title">My Orders</h1>

        {/* Stats summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(() => {
            const myRevenue = orders.reduce((s, o) => s + ((o.shop_total ?? o.total_amount) || 0), 0);
            const delivered = orders.filter(o => o.order_status === 'delivered').length;
            const inProgress = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.order_status)).length;
            const cards = [
              { label: 'Total Orders', value: orders.length, icon: ShoppingCart, grad: 'from-violet-500 to-fuchsia-500' },
              { label: 'My Revenue', value: `$${myRevenue.toFixed(0)}`, icon: DollarSign, grad: 'from-emerald-500 to-teal-500' },
              { label: 'Delivered', value: delivered, icon: CheckCircle2, grad: 'from-green-500 to-emerald-500' },
              { label: 'In Progress', value: inProgress, icon: Clock, grad: 'from-amber-500 to-orange-500' },
            ];
            return cards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-4 shadow-card"
                data-testid={`shop-order-stat-${i}`}
              >
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full bg-gradient-to-br ${s.grad} opacity-10`} />
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-2 shadow-sm`}>
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <div className="text-2xl font-black text-slate-800">{s.value}</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
              </motion.div>
            ));
          })()}
        </div>

        {/* Advanced Filters */}
        <div className="bg-white rounded-xl p-4 shadow-card mb-6 space-y-4" data-testid="shop-orders-filters">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by order ID, customer name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
              data-testid="shop-orders-search"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Status Filter Buttons */}
            <div>
              <Label className="text-xs text-slate-500 mb-2 block">Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'all', label: 'All', color: 'bg-slate-100 text-slate-700' },
                  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
                  { value: 'processing', label: 'Processing', color: 'bg-indigo-100 text-indigo-700' },
                  { value: 'shipped', label: 'Shipped', color: 'bg-cyan-100 text-cyan-700' },
                  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
                  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
                ].map(s => {
                  const count = orders.filter(o => s.value === 'all' ? true : o.order_status === s.value).length;
                  return (
                    <button key={s.value} onClick={() => setStatusFilter(s.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${
                        statusFilter === s.value ? 'ring-2 ring-offset-1 ring-emerald-400 ' + s.color : s.color + ' opacity-70'
                      }`}
                      data-testid={`shop-status-btn-${s.value}`}
                    >
                      {s.label}
                      <span className="px-1 text-[10px] bg-black/5 rounded-full">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Time Filter */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Time Period</Label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="text-sm" data-testid="shop-orders-time-filter">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="last_day">Last 24 Hours</SelectItem>
                    <SelectItem value="last_week">Last 7 Days</SelectItem>
                    <SelectItem value="last_month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Price Range: <span className="font-semibold text-slate-700">${priceRange[0]} — ${priceRange[1]}</span>
                </Label>
                <Slider
                  min={0}
                  max={maxPrice}
                  step={1}
                  value={priceRange}
                  onValueChange={setPriceRange}
                  className="mt-2"
                  data-testid="shop-orders-price-range"
                />
              </div>
            </div>
          </div>

          {/* Active filter count */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{filteredOrders.length} of {orders.length} orders</span>
            {(searchQuery || statusFilter !== 'all' || timeFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setPriceRange([0, maxPrice]); }}
                className="text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-card">
            <ShoppingCart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">My Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">My Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Order Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`order-row-${order.id}`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                        {order.cancel_request_status && (
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold block w-fit mt-0.5 ${
                            order.cancel_request_status === 'pending' ? 'bg-orange-100 text-orange-700' :
                            order.cancel_request_status === 'approved' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            Cancel {order.cancel_request_status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{order.guest_name || order.customer_name || order.user_id || 'Guest'}</td>
                      <td className="px-4 py-3 text-sm">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600 text-sm" data-testid={`order-shop-total-${order.id}`}>
                        ${(order.shop_total ?? order.total_amount)?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-violet-600 text-sm block">${order.total_amount?.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order)} className="text-emerald-600 hover:text-emerald-700">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Order Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Order ID</p>
                    <p className="font-mono text-sm font-semibold">{selectedOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="text-sm font-semibold">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Customer</p>
                    <p className="text-sm font-semibold">{selectedOrder.guest_name || selectedOrder.customer_name || 'Guest'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.order_status)}`}>
                      {selectedOrder.order_status}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                        <img src={item.image || item.product_image || '/placeholder.png'} alt={item.name || item.product_name} className="w-16 h-16 object-cover rounded" />
                        <div className="flex-1">
                          <p className="font-semibold">{item.name || item.product_name}</p>
                          <div className="flex flex-wrap gap-1 my-1">
                            {item.selected_color && (
                              <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-[10px] font-medium">Color: {item.selected_color}</span>
                            )}
                            {item.selected_size && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">Size: {item.selected_size}</span>
                            )}
                            {item.selected_shape && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-medium">Shape: {item.selected_shape}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">Qty: {item.quantity} x ${item.price?.toFixed(2)}</p>
                        </div>
                        <p className="font-semibold">${item.subtotal?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.shipping_address && availableDelivery && (
                  <div>
                    <h3 className="font-semibold mb-2">Shipping Address</h3>
                    <div className="p-3 bg-slate-50 rounded-lg text-sm">
                      <p>{selectedOrder.shipping_address.address}</p>
                      <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zip}</p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Items Total:</span>
                    <span className="font-semibold">${((selectedOrder.total_amount || 0) - (selectedOrder.delivery_fee || 0) + (selectedOrder.loyalty_discount_amount || 0)).toFixed(2)}</span>
                  </div>
                  {selectedOrder.loyalty_points_redeemed > 0 && (
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Points Discount ({selectedOrder.loyalty_points_redeemed} pts):</span>
                      <span className="font-semibold">-${(selectedOrder.loyalty_discount_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {availableDelivery && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Delivery Fee:</span>
                      <span className="font-semibold">${(selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-semibold">Customer Paid:</span>
                    <span className="text-xl font-bold text-violet-600">${selectedOrder.total_amount?.toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-emerald-700">Your Revenue:</span>
                      <span className="text-xl font-bold text-emerald-600">${(selectedOrder.shop_total || 0).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">After platform commission</p>
                    {selectedOrder.admin_owes_shop_amount > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-700">Platform owes you (loyalty excess):</span>
                          <span className="font-bold text-amber-600">+${(selectedOrder.admin_owes_shop_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={() => setViewDialogOpen(false)} variant="outline" className="w-full">Close</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ShopLayout>
  );
};

export default ShopOrders;
