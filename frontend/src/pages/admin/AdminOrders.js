import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, Eye, Trash2, MapPin, Store, Phone, Mail, ArrowRight, Download, Printer, DollarSign, Percent, AlertCircle, Map as MapIcon, ShoppingBag, TrendingUp, CheckCircle2, Clock, UserCog } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '../../components/AdminLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import OrderLocationMap from '../../components/OrderLocationMap';

// Resolve an order's destination (delivery) state across the various field shapes.
const getOrderState = (o) => (
  o.shipping_state ||
  o.delivery_state ||
  o.guest_state ||
  (o.shipping_address && typeof o.shipping_address === 'object' ? o.shipping_address.state : '') ||
  ''
);

const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deliveryViewOpen, setDeliveryViewOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [platformSettings, setPlatformSettings] = useState({ commission_percentage: 0 });
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const deliveryPrintRef = useRef(null);
  const [payoutAlertOpen, setPayoutAlertOpen] = useState(false);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [pendingPaidOrderId, setPendingPaidOrderId] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapData, setMapData] = useState({ shops: [], customerLocation: null });

  useEffect(() => {
    fetchOrders();
    fetchPlatformSettings();
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
    } catch (error) {
      console.error('Failed to fetch platform settings');
    }
  };

  useEffect(() => {
    filterOrders();
  }, [searchQuery, orders, statusFilter, timeFilter, priceRange, stateFilter, customerFilter, paymentMethodFilter, paymentStatusFilter]);

  const stateOptions = useMemo(() => Array.from(new Set(orders.map(getOrderState).filter(Boolean))).sort(), [orders]);
  const customerOptions = useMemo(() => Array.from(new Set(orders.map(o => o.customer_name || o.guest_name).filter(Boolean))).sort(), [orders]);
  const paymentMethodOptions = useMemo(() => Array.from(new Set(orders.map(o => o.payment_method).filter(Boolean))).sort(), [orders]);

  const handleViewDeliveryDetails = async (orderId) => {
    try {
      const { data } = await api.admin.getOrderDetails(orderId);
      setSelectedOrderDetails(data);
      setDeliveryViewOpen(true);
    } catch (error) {
      toast.error('Failed to load delivery details');
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(query) ||
        (order.guest_name && order.guest_name.toLowerCase().includes(query)) ||
        (order.guest_email && order.guest_email.toLowerCase().includes(query)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(query)) ||
        (order.customer_email && order.customer_email.toLowerCase().includes(query)) ||
        (order.shop_name && order.shop_name.toLowerCase().includes(query)) ||
        order.total_amount.toString().includes(query)
      );
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.order_status === statusFilter);
    }
    
    // Filter by time period
    if (timeFilter !== 'all') {
      const now = new Date();
      const orderDate = (order) => new Date(order.created_at);
      
      if (timeFilter === 'last_day') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => orderDate(order) >= oneDayAgo);
      } else if (timeFilter === 'last_week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => orderDate(order) >= oneWeekAgo);
      } else if (timeFilter === 'last_month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => orderDate(order) >= oneMonthAgo);
      }
    }

    // Filter by destination (delivery) state
    if (stateFilter !== 'all') {
      filtered = filtered.filter(order => getOrderState(order) === stateFilter);
    }

    // Filter by customer full name
    if (customerFilter !== 'all') {
      filtered = filtered.filter(order => (order.customer_name || order.guest_name || 'Guest') === customerFilter);
    }

    // Filter by payment method
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(order => order.payment_method === paymentMethodFilter);
    }

    // Filter by payment status
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.payment_status === paymentStatusFilter);
    }

    // Filter by price range
    filtered = filtered.filter(order => {
      const amount = order.total_amount || 0;
      return amount >= priceRange[0] && amount <= priceRange[1];
    });
    
    // Sort: pending orders first, then by date descending
    const statusPriority = { pending: 0, confirmed: 1, processing: 2, paid: 3, shipped: 4, delivered: 5, cancelled: 6 };
    filtered.sort((a, b) => {
      const pa = statusPriority[a.order_status] ?? 5;
      const pb = statusPriority[b.order_status] ?? 5;
      if (pa !== pb) return pa - pb;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    
    setFilteredOrders(filtered);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const fetchOrders = async () => {
    try {
      const { data } = await api.orders.getAll();
      const sortedOrders = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
      if (sortedOrders.length > 0) {
        const max = Math.ceil(Math.max(...sortedOrders.map(o => o.total_amount || 0)));
        setMaxPrice(max || 2000);
        setPriceRange([0, max || 2000]);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    // If changing to 'paid', show confirmation dialog first
    if (newStatus === 'paid') {
      setPendingPaidOrderId(orderId);
      setConfirmPaidOpen(true);
      return;
    }
    await executeStatusChange(orderId, newStatus);
  };

  const executeStatusChange = async (orderId, newStatus) => {
    try {
      await api.orders.updateStatus(orderId, newStatus);
      toast.success('Order status updated');
      
      // Check if status changed to 'paid' and order has loyalty payout impact AND payout not already paid
      if (newStatus === 'paid') {
        const order = orders.find(o => o.id === orderId);
        if (order && (order.loyalty_points_redeemed > 0 || order.admin_owes_shop_amount > 0 || order.loyalty_discount_amount > 0)) {
          // Only show popup if payout is NOT already paid
          if (order.payout_status !== 'paid') {
            setPayoutAlertOpen(true);
          }
        }
      }
      
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const confirmPaidStatus = async () => {
    if (pendingPaidOrderId) {
      await executeStatusChange(pendingPaidOrderId, 'paid');
    }
    setConfirmPaidOpen(false);
    setPendingPaidOrderId(null);
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.orders.delete(orderId);
      toast.success('Order deleted successfully');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to delete order');
    }
  };

  const [agentBreakdown, setAgentBreakdown] = useState(null);
  const handleViewDetails = async (order) => {
    setSelectedOrder(order);
    setAgentBreakdown(null);
    setDetailsOpen(true);
    try {
      const { data } = await api.admin.getOrderDetails(order.id);
      if (data?.agent_breakdown) setAgentBreakdown(data.agent_breakdown);
    } catch {}
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-2 sm:p-4 lg:p-8 space-y-6">
          <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
            <div className="flex gap-4">
              <div className="h-10 flex-1 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-10 flex-1 bg-slate-200 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="animate-pulse">
              <div className="h-12 bg-slate-100 border-b" />
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                  <div className="h-8 w-24 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-1 sm:p-2 lg:p-4 admin-table-page compact-table" data-testid="admin-orders-content">
        <h1 className="text-3xl lg:text-4xl font-heading font-bold mb-6 lg:mb-8" data-testid="admin-orders-title">Orders</h1>

        {/* Stats summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(() => {
            const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
            const totalCommission = orders.reduce((s, o) => s + Math.max(0, (o.commission_amount || 0) - (o.loyalty_discount_amount || 0)), 0);
            const pendingCount = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.order_status)).length;
            const cards = [
              { label: 'Total Orders', value: orders.length, icon: ShoppingBag, grad: 'from-violet-500 to-indigo-500' },
              { label: 'Total Revenue', value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, grad: 'from-emerald-500 to-teal-500' },
              { label: 'Admin Commission', value: `$${totalCommission.toFixed(0)}`, icon: Percent, grad: 'from-fuchsia-500 to-pink-500' },
              { label: 'In Progress', value: pendingCount, icon: Clock, grad: 'from-amber-500 to-orange-500' },
            ];
            return cards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-4 shadow-card"
                data-testid={`admin-order-stat-${i}`}
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

        <div className="mb-6 bg-white rounded-xl p-4 shadow-card space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search by order ID, customer name, email, shop name, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="orders-search-input"
            />
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="w-full">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Order Status</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
                  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
                  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                  { value: 'processing', label: 'Processing', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
                  { value: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                  { value: 'shipped', label: 'Shipped', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
                  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
                  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
                ].map(s => {
                  const count = orders.filter(o => s.value === 'all' ? true : o.order_status === s.value).length;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStatusFilter(s.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        statusFilter === s.value
                          ? 'ring-2 ring-offset-1 ring-violet-400 ' + s.color
                          : s.color + ' opacity-70'
                      }`}
                      data-testid={`status-btn-${s.value}`}
                    >
                      {s.label}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === s.value ? 'bg-white/50' : 'bg-black/5'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Destination State</label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger data-testid="orders-state-filter"><SelectValue placeholder="All States" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All States</SelectItem>
                  {stateOptions.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Customer</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger data-testid="orders-customer-filter"><SelectValue placeholder="All Customers" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All Customers</SelectItem>
                  {customerOptions.map(nm => <SelectItem key={nm} value={nm}>{nm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger data-testid="orders-payment-method-filter"><SelectValue placeholder="All Methods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {paymentMethodOptions.map(pm => <SelectItem key={pm} value={pm}><span className="capitalize">{pm}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Status</label>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger data-testid="orders-payment-status-filter"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Time Period</label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger data-testid="time-filter">
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

            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Price Range: <span className="font-semibold">${priceRange[0]} — ${priceRange[1]}</span>
              </Label>
              <Slider
                min={0}
                max={maxPrice}
                step={1}
                value={priceRange}
                onValueChange={setPriceRange}
                className="mt-3"
                data-testid="admin-orders-price-range"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Showing {paginatedOrders.length} of {filteredOrders.length} orders (total: {orders.length})</span>
            {(searchQuery || statusFilter !== 'all' || timeFilter !== 'all' || stateFilter !== 'all' || customerFilter !== 'all' || paymentMethodFilter !== 'all' || paymentStatusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setPriceRange([0, maxPrice]); setStateFilter('all'); setCustomerFilter('all'); setPaymentMethodFilter('all'); setPaymentStatusFilter('all'); }}
                className="text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden" data-testid="orders-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Order ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Shop</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Total</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Commission</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Payment</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedOrders.map((order) => (
                  <tr key={order.id} data-testid={`order-row-${order.id}`} className="transition-colors hover:bg-violet-50/40">
                    <td className="px-6 py-4 font-mono text-sm" data-testid="order-table-id">
                      {order.id.slice(0, 8)}
                      {order.cancel_request_status && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          order.cancel_request_status === 'pending' ? 'bg-orange-100 text-orange-700' :
                          order.cancel_request_status === 'approved' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          Cancel {order.cancel_request_status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm" data-testid="order-table-shop">
                      {order.shop_name || 'Multiple Shops'}
                    </td>
                    <td className="px-6 py-4" data-testid="order-table-customer">
                      <div className="font-medium">{order.customer_name || order.guest_name || 'Guest'}</div>
                      {getOrderState(order) && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1" data-testid="order-table-state">
                          <MapPin className="h-3 w-3" /> {getOrderState(order)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm" data-testid="order-table-date">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-semibold" data-testid="order-table-total">${order.total_amount.toFixed(2)}</td>
                    {(() => {
                      const baseCommission = order.commission_amount || 0;
                      const pointsValue = order.loyalty_discount_amount || 0;
                      const pointsRedeemed = order.loyalty_points_redeemed || 0;
                      const effectiveCommission = Math.max(0, baseCommission - pointsValue);
                      const reduced = pointsValue > 0 && baseCommission > 0;
                      const wipedOut = reduced && effectiveCommission === 0;
                      return (
                        <td className="px-6 py-4" data-testid="order-table-commission">
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-bold ${effectiveCommission > 0 ? 'text-violet-700' : 'text-slate-400'}`} data-testid={`commission-value-${order.id}`}>
                              ${effectiveCommission.toFixed(2)}
                            </span>
                            {reduced && (
                              <span className="text-[10px] text-amber-600 leading-tight" title={`Base commission $${baseCommission.toFixed(2)} reduced by ${pointsRedeemed} pts ($${pointsValue.toFixed(2)})`}>
                                {wipedOut
                                  ? `No commission · ${pointsRedeemed} pts ≥ $${baseCommission.toFixed(2)}`
                                  : `was $${baseCommission.toFixed(2)} · −$${pointsValue.toFixed(2)} pts`}
                              </span>
                            )}
                            {!reduced && baseCommission === 0 && (
                              <span className="text-[10px] text-slate-400 leading-tight">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })()}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize text-sm" data-testid="order-table-payment">{order.payment_method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Select value={order.order_status} onValueChange={(value) => handleStatusChange(order.id, value)}>
                        <SelectTrigger className={`w-36 font-semibold text-xs capitalize border-2 ${
                          order.order_status === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                          order.order_status === 'confirmed' ? 'border-blue-300 bg-blue-50 text-blue-700' :
                          order.order_status === 'processing' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' :
                          order.order_status === 'paid' ? 'border-violet-300 bg-violet-50 text-violet-700' :
                          order.order_status === 'shipped' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' :
                          order.order_status === 'delivered' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                          order.order_status === 'cancelled' ? 'border-red-300 bg-red-50 text-red-700' :
                          'border-slate-200'
                        }`} data-testid="order-status-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(order)}
                          data-testid="view-order-details-button"
                          title="View Order"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDeliveryDetails(order.id)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          data-testid="view-delivery-details-button"
                          title="View Delivery Route"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(order.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid="delete-order-button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) pageNum = i + 1;
              else if (currentPage <= 4) pageNum = i + 1;
              else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = currentPage - 3 + i;
              return (
                <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(pageNum)} className={currentPage === pageNum ? 'bg-violet-600' : ''}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
          </div>
        )}

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="order-details-dialog">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Order ID</p>
                    <p className="font-semibold">{selectedOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Date</p>
                    <p className="font-semibold">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Customer Name</p>
                    <p className="font-semibold">{selectedOrder.guest_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="font-semibold">{selectedOrder.guest_email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Phone</p>
                    <p className="font-semibold">{selectedOrder.guest_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Payment Method</p>
                    <p className="font-semibold capitalize">{selectedOrder.payment_method}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-2">Shipping Address</p>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    {typeof selectedOrder.shipping_address === 'object' && selectedOrder.shipping_address ? (
                      <>
                        <p>{selectedOrder.shipping_address.address}</p>
                        <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zip}</p>
                      </>
                    ) : (
                      <>
                        <p>{selectedOrder.shipping_address}</p>
                        {(selectedOrder.shipping_city || selectedOrder.shipping_state) && (
                          <p>{selectedOrder.shipping_city}, {selectedOrder.shipping_state} {selectedOrder.shipping_zip}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-2">Order Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Product</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Variants</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Quantity</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Price</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                {item.image && (
                                  <img 
                                    src={item.image} 
                                    alt={item.name}
                                    className="w-12 h-12 object-cover rounded-lg"
                                  />
                                )}
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {item.selected_color && (
                                  <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-[10px] font-medium">
                                    Color: {item.selected_color}
                                  </span>
                                )}
                                {item.selected_size && (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                                    Size: {item.selected_size}
                                  </span>
                                )}
                                {item.selected_shape && (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-medium">
                                    Shape: {item.selected_shape}
                                  </span>
                                )}
                                {!item.selected_color && !item.selected_size && !item.selected_shape && (
                                  <span className="text-slate-400 text-sm">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">{item.quantity}</td>
                            <td className="px-4 py-2">${item.price.toFixed(2)}</td>
                            <td className="px-4 py-2">${item.subtotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  {/* Detailed Customer Bill */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm text-slate-700 mb-3">Customer Bill</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Items Subtotal:</span>
                        <span className="font-semibold">${((selectedOrder.total_amount || 0) - (selectedOrder.delivery_fee || 0) + (selectedOrder.loyalty_discount_amount || 0)).toFixed(2)}</span>
                      </div>
                      {selectedOrder.loyalty_points_redeemed > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Points Redeemed ({selectedOrder.loyalty_points_redeemed} pts):</span>
                          <span className="font-semibold">-${(selectedOrder.loyalty_discount_amount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Delivery Fee:</span>
                        <span className="font-semibold">${(selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <span className="text-lg font-semibold">Customer Pays:</span>
                        <span className="text-2xl font-bold text-primary">${selectedOrder.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {selectedOrder.commission_amount > 0 && (
                    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200 p-3 mt-3" data-testid="revenue-breakdown">
                      <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Revenue Breakdown</div>
                      {(() => {
                        const shopBreakdown = {};
                        const fallbackShopName = selectedOrder.shop_name || 'Shop';
                        (selectedOrder.items || []).forEach(item => {
                          // Robust shop name resolution: item.shop_name → order-level shop_name → "Shop"
                          const shopName = item.shop_name || (item.shop_id ? fallbackShopName : fallbackShopName);
                          if (!shopBreakdown[shopName]) shopBreakdown[shopName] = { original: 0, customer: 0, items: 0 };
                          shopBreakdown[shopName].original += (item.original_subtotal || (item.original_price ? item.original_price * item.quantity : 0) || item.subtotal || (item.price * item.quantity) || 0);
                          shopBreakdown[shopName].customer += (item.subtotal || (item.price * item.quantity) || 0);
                          shopBreakdown[shopName].items += (item.quantity || 1);
                        });
                        const subtotalCustomer = (selectedOrder.subtotal || 0);
                        const subtotalShop = (selectedOrder.original_subtotal || Object.values(shopBreakdown).reduce((s, v) => s + v.original, 0));
                        return (
                          <>
                            {Object.entries(shopBreakdown).map(([name, totals], i) => (
                              <div key={i} className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg bg-white/70 mb-1 last:mb-0">
                                <span className="text-emerald-700 flex items-center gap-1.5 font-medium">
                                  <Store className="h-3.5 w-3.5" /> {name}
                                  <span className="text-[10px] text-slate-400 font-normal">({totals.items} item{totals.items !== 1 ? 's' : ''})</span>
                                </span>
                                <span className="text-right">
                                  <span className="font-bold text-emerald-700">${totals.original.toFixed(2)}</span>
                                  <span className="text-[10px] text-slate-400 block">received</span>
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-violet-200 my-1.5"></div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Subtotal (customer paid):</span>
                              <span className="font-semibold text-slate-700">${subtotalCustomer.toFixed(2)}</span>
                            </div>
                            {(() => {
                              const agentTotal = (agentBreakdown?.has_agent ? (agentBreakdown.entries || []).reduce((s, e) => s + Number(e.agent_amount || 0), 0) : 0);
                              const platformFee = Math.max(0, (selectedOrder.commission_amount || 0) - agentTotal);
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-violet-700 flex items-center gap-1"><Percent className="h-3 w-3" /> Platform fee{agentTotal > 0 ? ' (excl. agent)' : ''}:</span>
                                    <span className="font-bold text-violet-700">+${platformFee.toFixed(2)}</span>
                                  </div>
                                  {agentTotal > 0 && (agentBreakdown.entries || []).map((e, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span className="text-fuchsia-700 flex items-center gap-1 pl-4"><UserCog className="h-3 w-3" /> {e.agent_name} (agent):</span>
                                      <span className="font-semibold text-fuchsia-700">+${Number(e.agent_amount || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </>
                              );
                            })()}
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Delivery fee:</span>
                              <span className="font-semibold text-blue-600">+${(selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                            </div>
                      {selectedOrder.loyalty_points_redeemed > 0 && (
                        <>
                          <div className="border-t border-amber-200 my-1.5"></div>
                          <div className="flex justify-between text-sm">
                            <span className="text-amber-600">Loyalty Points Redeemed:</span>
                            <span className="font-semibold text-amber-600">{selectedOrder.loyalty_points_redeemed} pts</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-amber-600">Loyalty Discount:</span>
                            <span className="font-semibold text-amber-600">-${(selectedOrder.loyalty_discount_amount || 0).toFixed(2)}</span>
                          </div>
                          {selectedOrder.admin_owes_shop_amount > 0 && (
                            <div className="flex justify-between text-sm bg-red-50 rounded p-1.5 mt-1">
                              <span className="text-red-600 font-medium">Admin Owes Shop:</span>
                              <span className="font-bold text-red-600">${(selectedOrder.admin_owes_shop_amount || 0).toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {selectedOrder.loyalty_points_earned > 0 && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-emerald-600">Points Earned:</span>
                          <span className="font-semibold text-emerald-600">+{selectedOrder.loyalty_points_earned} pts</span>
                        </div>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {agentBreakdown?.has_agent && (agentBreakdown.entries || []).length > 0 && (
                    <div className="bg-gradient-to-br from-fuchsia-50 to-pink-50 rounded-xl border border-fuchsia-200 p-3 mt-3" data-testid="agent-breakdown">
                      <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider flex items-center gap-1"><UserCog className="h-3.5 w-3.5 text-fuchsia-600"/>Referral Agent Earnings {agentBreakdown.entries[0].agent_commission_distributed ? <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Paid out</span> : <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending payment</span>}</div>
                      {agentBreakdown.entries.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/70 mb-1 last:mb-0 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-fuchsia-700 truncate">{e.agent_name}</div>
                            <div className="text-[11px] text-slate-500">Shop: {e.shop_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">{Number(e.agent_share_percent).toFixed(0)}% of ${Number(e.shop_commission).toFixed(2)}</div>
                            <div className="font-bold text-fuchsia-700">+${Number(e.agent_amount).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedOrder.commission_amount > 0 && (
                    <Button size="sm" variant="outline" className="mt-3 w-full rounded-xl" data-testid="download-revenue-pdf-btn"
                      onClick={() => {
                        try {
                          const o = selectedOrder;
                          const doc = new jsPDF();
                          let y = 18;
                          doc.setFontSize(16); doc.setFont(undefined, 'bold');
                          doc.text('Revenue Breakdown', 14, y); y += 6;
                          doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(120);
                          doc.text(`Order #${(o.id || '').slice(0, 8)}  •  ${o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}`, 14, y); y += 10;
                          doc.setTextColor(0);
                          // Per-shop received
                          const shopMap = {};
                          (o.items || []).forEach(it => {
                            const nm = it.shop_name || o.shop_name || 'Shop';
                            if (!shopMap[nm]) shopMap[nm] = { original: 0, items: 0 };
                            shopMap[nm].original += (it.original_subtotal || (it.original_price ? it.original_price * it.quantity : 0) || it.subtotal || (it.price * it.quantity) || 0);
                            shopMap[nm].items += (it.quantity || 1);
                          });
                          doc.setFont(undefined, 'bold'); doc.text('Shops received', 14, y); y += 6; doc.setFont(undefined, 'normal');
                          Object.entries(shopMap).forEach(([nm, t]) => { doc.text(`${nm} (${t.items} items)`, 18, y); doc.text(`$${t.original.toFixed(2)}`, 196, y, { align: 'right' }); y += 6; });
                          y += 2; doc.line(14, y, 196, y); y += 6;
                          const agentTotal = (agentBreakdown?.has_agent ? (agentBreakdown.entries || []).reduce((s, e) => s + Number(e.agent_amount || 0), 0) : 0);
                          const platformFee = Math.max(0, (o.commission_amount || 0) - agentTotal);
                          const rowR = (l, v, b) => { doc.setFont(undefined, b ? 'bold' : 'normal'); doc.text(l, 18, y); doc.text(v, 196, y, { align: 'right' }); y += 6; };
                          rowR('Subtotal (customer paid)', `$${(o.subtotal || 0).toFixed(2)}`);
                          rowR(agentTotal > 0 ? 'Platform fee (excl. agent)' : 'Platform fee', `+$${platformFee.toFixed(2)}`);
                          if (agentTotal > 0) (agentBreakdown.entries || []).forEach(e => rowR(`  ${e.agent_name} (agent)`, `+$${Number(e.agent_amount || 0).toFixed(2)}`));
                          rowR('Delivery fee', `+$${(o.delivery_fee || 0).toFixed(2)}`);
                          if (Number(o.loyalty_discount_amount || 0) > 0) rowR('Loyalty discount', `-$${Number(o.loyalty_discount_amount).toFixed(2)}`);
                          y += 1; doc.line(14, y, 196, y); y += 6;
                          doc.setFontSize(12); rowR('Customer Pays', `$${(o.total_amount || 0).toFixed(2)}`, true);
                          doc.save(`revenue_${(o.id || 'order').slice(0, 8)}.pdf`);
                        } catch (e) { toast.error('Failed to generate PDF'); }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" /> Download Revenue PDF
                    </Button>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Order Status</p>
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize bg-slate-100">
                      {selectedOrder.order_status}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Payment Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                      selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedOrder.payment_status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delivery Route Dialog */}
        <Dialog open={deliveryViewOpen} onOpenChange={setDeliveryViewOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Route Details
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (deliveryPrintRef.current) {
                        const printWindow = window.open('', '_blank');
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Delivery Route - Order ${selectedOrderDetails?.id?.slice(0, 8)}</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                                .section { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
                                .row { display: flex; justify-content: space-between; margin: 5px 0; }
                                .label { color: #666; }
                                .value { font-weight: bold; }
                                .total { font-size: 18px; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                              </style>
                            </head>
                            <body>
                              ${deliveryPrintRef.current.innerHTML}
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    data-testid="print-delivery-btn"
                  >
                    <Printer className="h-4 w-4 mr-1" /> Print
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedOrderDetails) {
                        const doc = new jsPDF();
                        const pageWidth = doc.internal.pageSize.width;
                        let yPos = 20;
                        
                        // Title
                        doc.setFontSize(18);
                        doc.setFont(undefined, 'bold');
                        doc.text('CUSTOMER BILL', pageWidth / 2, yPos, { align: 'center' });
                        yPos += 15;
                        
                        // Order Info
                        doc.setFontSize(12);
                        doc.setFont(undefined, 'normal');
                        doc.text(`Order ID: ${selectedOrderDetails.id}`, 20, yPos);
                        yPos += 7;
                        doc.text(`Date: ${new Date(selectedOrderDetails.created_at).toLocaleDateString()}`, 20, yPos);
                        yPos += 15;
                        
                        // FROM (SHOPS)
                        doc.setFont(undefined, 'bold');
                        doc.text('FROM (SHOPS)', 20, yPos);
                        yPos += 7;
                        doc.setFont(undefined, 'normal');
                        
                        if (selectedOrderDetails.delivery_info?.from_shops) {
                          selectedOrderDetails.delivery_info.from_shops.forEach((shop, idx) => {
                            if (yPos > 270) {
                              doc.addPage();
                              yPos = 20;
                            }
                            doc.text(`Shop ${idx + 1}: ${shop.shop_name}`, 25, yPos);
                            yPos += 6;
                            doc.text(`Address: ${shop.shop_address || 'N/A'}`, 25, yPos);
                            yPos += 6;
                            doc.text(`State: ${shop.shop_state || 'N/A'}`, 25, yPos);
                            yPos += 6;
                            doc.text(`Phone: ${shop.shop_phone || 'N/A'}`, 25, yPos);
                            yPos += 6;
                            doc.text(`Items: ${shop.items_count} items - $${shop.items_subtotal?.toFixed(2)}`, 25, yPos);
                            yPos += 10;
                          });
                        }
                        
                        yPos += 5;
                        
                        // TO (CUSTOMER)
                        doc.setFont(undefined, 'bold');
                        doc.text('TO (CUSTOMER)', 20, yPos);
                        yPos += 7;
                        doc.setFont(undefined, 'normal');
                        
                        const customer = selectedOrderDetails.delivery_info?.to_customer;
                        if (customer) {
                          doc.text(`Name: ${customer.name || 'N/A'}`, 25, yPos);
                          yPos += 6;
                          doc.text(`Email: ${customer.email || 'N/A'}`, 25, yPos);
                          yPos += 6;
                          doc.text(`Phone: ${customer.phone || 'N/A'}`, 25, yPos);
                          yPos += 6;
                          doc.text(`Address: ${customer.address || 'N/A'}`, 25, yPos);
                          yPos += 6;
                          doc.text(`City: ${customer.city || 'N/A'}, ${customer.state || 'N/A'} ${customer.zip || ''}`, 25, yPos);
                          yPos += 15;
                        }
                        
                        // CUSTOMER BILL (item names + totals)
                        doc.setFont(undefined, 'bold');
                        doc.text('CUSTOMER BILL', 20, yPos);
                        yPos += 7;
                        doc.setFont(undefined, 'normal');
                        (selectedOrderDetails.items || []).forEach(item => {
                          if (yPos > 265) { doc.addPage(); yPos = 20; }
                          const nm = `${item.name || item.product_name || 'Item'} x ${item.quantity || 1}`;
                          const amt = `$${(item.subtotal || item.price * item.quantity || 0).toFixed(2)}`;
                          doc.text(nm.slice(0, 60), 25, yPos);
                          doc.text(amt, 190, yPos, { align: 'right' });
                          yPos += 6;
                        });
                        const deliveryFee = selectedOrderDetails.delivery_fee || 0;
                        const itemsSubtotal = (selectedOrderDetails.total_amount || 0) - deliveryFee + (selectedOrderDetails.loyalty_discount_amount || 0);
                        yPos += 2; doc.line(25, yPos, 190, yPos); yPos += 6;
                        doc.text('Items Subtotal:', 25, yPos); doc.text(`$${itemsSubtotal.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 6;
                        doc.text('Delivery Fee:', 25, yPos); doc.text(`$${deliveryFee.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 6;
                        doc.setFont(undefined, 'bold');
                        doc.text('Customer Pays:', 25, yPos); doc.text(`$${(selectedOrderDetails.total_amount || 0).toFixed(2)}`, 190, yPos, { align: 'right' });

                        // Save PDF
                        doc.save(`bill-${selectedOrderDetails.id.slice(0, 8)}.pdf`);
                        toast.success('Bill downloaded successfully!');
                      }
                    }}
                    data-testid="download-delivery-btn"
                  >
                    <Download className="h-4 w-4 mr-1" /> Download bill
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            {selectedOrderDetails && (
              <div ref={deliveryPrintRef} className="space-y-6 py-4">
                {/* Order Info */}
                <div className="header bg-slate-50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 label">Order ID:</span>
                      <span className="ml-2 font-mono text-xs value">{selectedOrderDetails.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 label">Date:</span>
                      <span className="ml-2 value">{new Date(selectedOrderDetails.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Flow: From Shops -> To Customer */}
                <div className="space-y-4">
                  {/* From Shops */}
                  <div className="space-y-3 section">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">FROM (Shops)</p>
                    {selectedOrderDetails.delivery_info?.from_shops?.map((shop, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-100 rounded-full p-2 flex-shrink-0">
                            <Store className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900 value">{shop.shop_name}</p>
                            <div className="mt-2 text-sm space-y-1">
                              {shop.shop_address && (
                                <p className="flex items-center gap-2 text-blue-700 row">
                                  <MapPin className="h-3 w-3" />
                                  <span className="value">{shop.shop_address}</span>
                                </p>
                              )}
                              {shop.shop_state && (
                                <p className="text-blue-600 ml-5">State: <strong className="value">{shop.shop_state}</strong></p>
                              )}
                              {shop.shop_phone && (
                                <p className="flex items-center gap-2 text-blue-700 row">
                                  <Phone className="h-3 w-3" />
                                  <span className="value">{shop.shop_phone}</span>
                                </p>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-blue-600">
                              {shop.items_count} items • <span className="value">${shop.items_subtotal?.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="bg-slate-200 rounded-full p-2">
                      <ArrowRight className="h-5 w-5 text-slate-500 rotate-90" />
                    </div>
                  </div>

                  {/* To Customer */}
                  <div className="section">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">TO (Customer)</p>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 rounded-full p-2 flex-shrink-0">
                          <Mail className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900 value">{selectedOrderDetails.delivery_info?.to_customer?.name}</p>
                          <div className="mt-2 text-sm space-y-1">
                            <p className="flex items-center gap-2 text-emerald-700 row">
                              <Mail className="h-3 w-3" />
                              <span className="value">{selectedOrderDetails.delivery_info?.to_customer?.email}</span>
                            </p>
                            {selectedOrderDetails.delivery_info?.to_customer?.phone && (
                              <p className="flex items-center gap-2 text-emerald-700 row">
                                <Phone className="h-3 w-3" />
                                <span className="value">{selectedOrderDetails.delivery_info?.to_customer?.phone}</span>
                              </p>
                            )}
                            <p className="flex items-center gap-2 text-emerald-700 row">
                              <MapPin className="h-3 w-3" />
                              <span className="value">{selectedOrderDetails.delivery_info?.to_customer?.address}</span>
                            </p>
                            <p className="text-emerald-600 ml-5">
                              {selectedOrderDetails.delivery_info?.to_customer?.city}, <strong className="value">{selectedOrderDetails.delivery_info?.to_customer?.state}</strong> {selectedOrderDetails.delivery_info?.to_customer?.zip}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Bill */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Customer Bill
                  </h4>
                  <div className="space-y-2 text-sm">
                    {/* Items breakdown */}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Items Subtotal:</span>
                      <span className="font-semibold">${((selectedOrderDetails.total_amount || 0) - (selectedOrderDetails.delivery_fee || 0) + (selectedOrderDetails.loyalty_discount_amount || 0)).toFixed(2)}</span>
                    </div>
                    
                    {selectedOrderDetails.loyalty_points_redeemed > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Points Redeemed ({selectedOrderDetails.loyalty_points_redeemed} pts):</span>
                        <span className="font-semibold">-${(selectedOrderDetails.loyalty_discount_amount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-slate-600">Delivery Fee:</span>
                      <span className="font-semibold text-blue-600">${(selectedOrderDetails.delivery_fee || 0).toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-slate-300 my-2"></div>
                    
                    <div className="flex justify-between pt-1">
                      <span className="font-bold text-slate-800 text-base">Customer Pays:</span>
                      <span className="font-bold text-lg text-emerald-600">
                        ${(selectedOrderDetails.total_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (selectedOrderDetails?.delivery_info) {
                        setMapData({
                          shops: selectedOrderDetails.delivery_info.from_shops || [],
                          customerLocation: selectedOrderDetails.delivery_info.to_customer?.location || null
                        });
                        setDeliveryViewOpen(false);
                        setTimeout(() => setMapOpen(true), 300);
                      }
                    }}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    data-testid="view-order-map-btn"
                  >
                    <MapIcon className="h-4 w-4 mr-2" /> View on Map
                  </Button>
                  <Button onClick={() => setDeliveryViewOpen(false)} variant="outline" className="flex-1">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Order Location Map Dialog */}
        <OrderLocationMap
          shops={mapData.shops}
          customerLocation={mapData.customerLocation}
          open={mapOpen}
          onOpenChange={setMapOpen}
        />

        {/* Confirm Paid Status Dialog */}
        <Dialog open={confirmPaidOpen} onOpenChange={setConfirmPaidOpen}>
          <DialogContent className="max-w-md" data-testid="confirm-paid-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Confirm Payment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to mark this order as <strong className="text-emerald-600">Paid</strong>?
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm text-emerald-800 font-medium">
                  This will distribute revenues to the respective shops and record admin commission. This action cannot be reversed.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={confirmPaidStatus}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="confirm-paid-btn"
                >
                  Yes, Mark as Paid
                </Button>
                <Button variant="outline" onClick={() => { setConfirmPaidOpen(false); setPendingPaidOrderId(null); }} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Payout Alert Dialog - shown when order marked as paid with loyalty impact */}
        <Dialog open={payoutAlertOpen} onOpenChange={setPayoutAlertOpen}>
          <DialogContent className="max-w-md" data-testid="payout-alert-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Loyalty Payout Required
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                This order has redeemed loyalty points which reduced the shop's revenue. 
                You may need to process a payout to the shop for the deducted amount.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">
                  Please check the Shop Payouts page to review and process any pending payouts.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => { setPayoutAlertOpen(false); navigate('/admin/payouts'); }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="go-to-payouts-btn"
                >
                  Go to Shop Payouts
                </Button>
                <Button variant="outline" onClick={() => setPayoutAlertOpen(false)} className="flex-1">
                  Dismiss
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;