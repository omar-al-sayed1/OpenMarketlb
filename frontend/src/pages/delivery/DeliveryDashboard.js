import React, { useEffect, useState, useContext } from 'react';
import { Package, Truck, MapPin, Clock, CheckCircle2, Eye, Phone, Mail, Search, DollarSign, X, Store, ArrowUpRight, Map as MapIcon, UserCheck, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { AuthContext } from '../../App';
import OrderLocationMap from '../../components/OrderLocationMap';

const DeliveryDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapData, setMapData] = useState({ shops: [], customerLocation: null });
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const [availRes, myRes] = await Promise.allSettled([
        api.delivery.getAvailableOrders(),
        api.delivery.getMyOrders()
      ]);
      if (availRes.status === 'fulfilled') setAvailableOrders(availRes.value.data || []);
      if (myRes.status === 'fulfilled') setMyOrders(myRes.value.data || []);
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (orderId) => {
    try {
      await api.delivery.claimOrder(orderId);
      toast.success('Order claimed successfully!');
      fetchOrders();
      setDetailOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to claim order');
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await api.delivery.updateStatus(orderId, newStatus, '');
      toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
      fetchOrders();
      setDetailOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const openOrderDetails = async (order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
    // Fetch full details to include the referral-agent commission breakdown
    try {
      const { data } = await api.delivery.getOrderDetails(order.id);
      setSelectedOrder(prev => ({ ...(prev || {}), ...order, agent_breakdown: data?.agent_breakdown || { has_agent: false, entries: [] } }));
    } catch {}
  };

  const handleViewMap = async (orderId) => {    setMapLoading(true);
    try {
      const { data } = await api.delivery.getOrderDetails(orderId);
      if (data.delivery_info) {
        setMapData({
          shops: data.delivery_info.from_shops || [],
          customerLocation: data.delivery_info.to_customer?.location || null
        });
        setMapOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load map data');
    } finally {
      setMapLoading(false);
    }
  };

  // Turn-by-turn navigation via Google Maps
  const openNavigation = async (orderId) => {
    try {
      const { data } = await api.delivery.getOrderDetails(orderId);
      const shops = data.delivery_info?.from_shops || [];
      const customer = data.delivery_info?.to_customer?.location;
      
      // Build waypoints: shops first, then customer
      const waypoints = [];
      shops.forEach(s => {
        if (s.shop_latitude && s.shop_longitude) waypoints.push(`${s.shop_latitude},${s.shop_longitude}`);
      });
      
      let navUrl;
      if (customer && customer.lat && customer.lng) {
        const destination = `${customer.lat},${customer.lng}`;
        if (waypoints.length > 0) {
          navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints.join('|')}&travelmode=driving`;
        } else {
          navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
        }
      } else if (waypoints.length > 0) {
        navUrl = `https://www.google.com/maps/dir/?api=1&destination=${waypoints[0]}&travelmode=driving`;
      } else {
        toast.error('No location data available for navigation');
        return;
      }
      window.open(navUrl, '_blank');
    } catch {
      toast.error('Failed to get navigation data');
    }
  };

  // Send live location update
  const sendLocationUpdate = (orderId) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.orderTracking.updateDriverLocation({
              order_id: orderId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            toast.success('Location updated');
          } catch { toast.error('Failed to update location'); }
        },
        () => toast.error('GPS not available'),
        { timeout: 10000 }
      );
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      assigned: 'bg-blue-100 text-blue-700 border-blue-200',
      picked_up: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      in_transit: 'bg-violet-100 text-violet-700 border-violet-200',
      delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending', assigned: 'Assigned', picked_up: 'Picked Up',
      in_transit: 'In Transit', delivered: 'Delivered', failed: 'Failed'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status) => {
    const icons = { pending: Clock, assigned: Package, picked_up: ArrowUpRight, in_transit: Truck, delivered: CheckCircle2, failed: X };
    const Icon = icons[status] || Package;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const getShopBreakdown = (order) => {
    const shops = {};
    (order.items || []).forEach(item => {
      const sn = item.shop_name || 'Unknown';
      if (!shops[sn]) shops[sn] = 0;
      shops[sn] += (item.subtotal || item.price * item.quantity || 0);
    });
    return Object.entries(shops);
  };

  const getAddress = (order) => {
    const addr = order.shipping_address;
    if (typeof addr === 'object' && addr) {
      return [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
    }
    return [addr, order.shipping_city, order.shipping_state].filter(Boolean).join(', ');
  };

  // Download a customer bill PDF: shops ordered from, customer details + address,
  // and the Customer Bill (Items Subtotal, Delivery Fee, Customer Pays).
  const handleDownloadBill = (order) => {
    try {
      const doc = new jsPDF();
      let y = 16;
      doc.setFontSize(18); doc.setFont(undefined, 'bold');
      doc.text('Customer Bill', 14, y); y += 6;
      doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(120);
      doc.text(`Order #${(order.id || '').slice(0, 8)}`, 14, y); y += 10;
      doc.setTextColor(0);

      // Shops ordered from
      const shops = getShopBreakdown(order).map(([name]) => name);
      doc.setFont(undefined, 'bold'); doc.text('Shops ordered from:', 14, y); y += 6;
      doc.setFont(undefined, 'normal');
      (shops.length ? shops : ['—']).forEach((s) => { doc.text(`- ${s}`, 18, y); y += 5.5; });
      y += 4;

      // Customer details
      doc.setFont(undefined, 'bold'); doc.text('Customer', 14, y); y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Name: ${order.customer_name || order.guest_name || 'Customer'}`, 18, y); y += 5.5;
      const phone = order.customer_phone || order.guest_phone;
      if (phone) { doc.text(`Phone: ${phone}`, 18, y); y += 5.5; }
      doc.text(`Address: ${getAddress(order) || '—'}`, 18, y); y += 10;

      // Customer Bill
      doc.setFont(undefined, 'bold'); doc.text('Customer Bill', 14, y); y += 7;
      doc.setFont(undefined, 'normal'); doc.setFontSize(10);
      (order.items || []).forEach((it) => {
        const name = `${it.name || it.product_name || 'Item'} x ${it.quantity || 1}`;
        const amt = `$${(it.subtotal || (it.price * it.quantity) || 0).toFixed(2)}`;
        doc.text(name.slice(0, 70), 18, y);
        doc.text(amt, 196, y, { align: 'right' });
        y += 5.5;
      });
      y += 2;
      const deliveryFee = Number(order.delivery_fee || 0);
      const itemsSubtotal = Number(order.total_amount || 0) - deliveryFee + Number(order.loyalty_discount_amount || 0);
      doc.line(14, y, 196, y); y += 6;
      const row = (label, val, bold) => {
        doc.setFont(undefined, bold ? 'bold' : 'normal');
        doc.text(label, 18, y); doc.text(val, 196, y, { align: 'right' }); y += 6;
      };
      row('Items Subtotal', `$${itemsSubtotal.toFixed(2)}`);
      if (Number(order.loyalty_discount_amount || 0) > 0) row('Loyalty Discount', `-$${Number(order.loyalty_discount_amount).toFixed(2)}`);
      row('Delivery Fee', `$${deliveryFee.toFixed(2)}`);
      doc.line(14, y, 196, y); y += 6;
      doc.setFontSize(12); row('Customer Pays', `$${Number(order.total_amount || 0).toFixed(2)}`, true);

      doc.save(`bill_${(order.id || 'order').slice(0, 8)}.pdf`);
    } catch (e) {
      toast.error('Failed to generate bill');
    }
  };

  const stats = {
    available: availableOrders.length,
    active: myOrders.filter(o => o.delivery_status !== 'delivered' && o.delivery_status !== 'failed').length,
    delivered: myOrders.filter(o => o.delivery_status === 'delivered').length,
    totalEarnings: myOrders.filter(o => o.delivery_status === 'delivered').reduce((sum, o) => sum + (o.delivery_fee || 0), 0),
  };

  const currentOrders = activeTab === 'available' ? availableOrders : myOrders;
  const filteredOrders = currentOrders.filter(order => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || order.id?.toLowerCase().includes(q) ||
      (order.customer_name || order.guest_name || '').toLowerCase().includes(q) ||
      getAddress(order).toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || order.delivery_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20" data-testid="delivery-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900">Delivery Dashboard</h1>
                <p className="text-[10px] text-slate-500">Welcome, {user?.name || 'Driver'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-slate-500" data-testid="delivery-logout">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="delivery-stats">
          {[
            { label: 'Available', value: stats.available, icon: Package, color: 'text-amber-600 bg-amber-50 border-amber-100' },
            { label: 'Active', value: stats.active, icon: Truck, color: 'text-blue-600 bg-blue-50 border-blue-100' },
            { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            { label: 'Earnings', value: `$${stats.totalEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-violet-600 bg-violet-50 border-violet-100' },
          ].map((stat, i) => (
            <div key={i} className={`rounded-xl border p-4 ${stat.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs font-medium opacity-70">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 bg-white rounded-xl p-1 border w-fit" data-testid="delivery-tabs">
          {[
            { id: 'available', label: 'Available Orders', count: availableOrders.length },
            { id: 'my', label: 'My Deliveries', count: myOrders.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatusFilter('all'); setSearchQuery(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
              data-testid={`delivery-tab-${tab.id}`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by order ID, customer, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm bg-white"
              data-testid="delivery-search"
            />
          </div>
          {activeTab === 'my' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white text-sm" data-testid="delivery-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border" data-testid="delivery-empty">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">
              {activeTab === 'available' ? 'No available orders' : 'No deliveries yet'}
            </h3>
            <p className="text-sm text-slate-500">
              {activeTab === 'available' ? 'Check back later for new orders.' : 'Claim an available order to start delivering.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="delivery-orders-list">
            {filteredOrders.map(order => {
              const shopBreakdown = getShopBreakdown(order);
              return (
                <div key={order.id} className="bg-white rounded-xl border hover:border-blue-200 hover:shadow-md transition-all overflow-hidden" data-testid={`delivery-order-${order.id}`}>
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">#{order.id?.slice(0, 10)}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(order.delivery_status)}`}>
                            {getStatusIcon(order.delivery_status)} {getStatusLabel(order.delivery_status)}
                          </span>
                          <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-slate-800 mb-1">
                              {order.customer_name || order.guest_name || 'Customer'}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{getAddress(order)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1.5 mt-2 overflow-x-auto">
                          {(order.items || []).slice(0, 4).map((item, i) => (
                            <div key={i} className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border">
                              {(item.image || item.product_image) ? (
                                <img src={item.image || item.product_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 m-2 text-slate-400" />
                              )}
                            </div>
                          ))}
                          {(order.items || []).length > 4 && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 border flex items-center justify-center text-[10px] font-bold text-slate-500">
                              +{order.items.length - 4}
                            </div>
                          )}
                          <span className="self-center text-xs text-slate-500 ml-1">{(order.items || []).length} items</span>
                        </div>

                        {shopBreakdown.length > 1 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {shopBreakdown.map(([name, total], i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <Store className="h-2.5 w-2.5" /> {name}: ${total.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">${(order.total_amount || 0).toFixed(2)}</p>
                          <p className="text-xs text-blue-600 font-medium">Fee: ${(order.delivery_fee || 0).toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openOrderDetails(order)}
                            className="rounded-lg"
                            data-testid={`delivery-view-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {activeTab === 'available' && (
                            <Button
                              size="sm"
                              onClick={() => handleClaim(order.id)}
                              className="rounded-lg bg-blue-600 hover:bg-blue-700"
                              data-testid={`delivery-claim-${order.id}`}
                            >
                              <Truck className="h-4 w-4 mr-1" /> Claim
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Order Details
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-xs text-slate-500">Order ID</span>
                  <p className="font-mono text-sm font-semibold">{selectedOrder.id}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedOrder.delivery_status)}`}>
                  {getStatusIcon(selectedOrder.delivery_status)} {getStatusLabel(selectedOrder.delivery_status)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border rounded-xl">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customer</h4>
                  <p className="font-semibold text-sm">{selectedOrder.customer_name || selectedOrder.guest_name || 'Customer'}</p>
                  {(selectedOrder.customer_phone || selectedOrder.guest_phone) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <Phone className="h-3 w-3" /> {selectedOrder.customer_phone || selectedOrder.guest_phone}
                    </div>
                  )}
                  {(selectedOrder.customer_email || selectedOrder.guest_email) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Mail className="h-3 w-3" /> {selectedOrder.customer_email || selectedOrder.guest_email}
                    </div>
                  )}
                </div>
                <div className="p-3 border rounded-xl">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Delivery Address</h4>
                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="font-medium">{getAddress(selectedOrder)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Items ({(selectedOrder.items || []).length})</h4>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        {(item.image || item.product_image) ? (
                          <img src={item.image || item.product_image} alt="" className="w-full h-full object-cover" />
                        ) : <Package className="h-6 w-6 m-3 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name || item.product_name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          {item.selected_color && <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded-full font-medium">Color: {item.selected_color}</span>}
                          {item.selected_size && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">Size: {item.selected_size}</span>}
                          {item.selected_shape && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">Shape: {item.selected_shape}</span>}
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded">Qty: {item.quantity}</span>
                          {item.shop_name && <span className="text-emerald-600 font-medium">{item.shop_name}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-semibold">${(item.subtotal || item.price * item.quantity || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue per shop */}
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Revenue by Shop</h4>
                <div className="space-y-1.5">
                  {getShopBreakdown(selectedOrder).map(([name, total], i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <Store className="h-3.5 w-3.5" /> {name}
                      </span>
                      <span className="font-semibold text-emerald-700">${total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Bill */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5" data-testid="delivery-customer-bill">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Customer Bill</h4>
                <div className="space-y-1">
                  {(selectedOrder.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-500">
                      <span className="truncate pr-2">{it.name || it.product_name || 'Item'} × {it.quantity || 1}</span>
                      <span className="flex-shrink-0">${(it.subtotal || (it.price * it.quantity) || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm border-t pt-1.5">
                  <span className="text-slate-600">Items Subtotal</span>
                  <span className="font-medium">${((selectedOrder.total_amount || 0) - (selectedOrder.delivery_fee || 0) + (selectedOrder.loyalty_discount_amount || 0)).toFixed(2)}</span>
                </div>
                {selectedOrder.loyalty_points_redeemed > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Points Redeemed ({selectedOrder.loyalty_points_redeemed} pts)</span>
                    <span className="font-semibold">-${(selectedOrder.loyalty_discount_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Delivery Fee</span>
                  <span className="font-semibold text-blue-600">${(selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Customer Pays</span>
                  <span>${(selectedOrder.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Download bill */}
              <Button onClick={() => handleDownloadBill(selectedOrder)} variant="outline" className="w-full rounded-xl border-slate-200" data-testid="delivery-download-bill-btn">
                <FileDown className="h-4 w-4 mr-2" /> Download bill
              </Button>

              {/* View on Map Button */}
              <Button
                onClick={() => handleViewMap(selectedOrder.id)}
                disabled={mapLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl"
                data-testid="delivery-view-map-btn"
              >
                <MapIcon className="h-4 w-4 mr-2" /> View on Map
              </Button>

              {/* Navigation & Location Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => openNavigation(selectedOrder.id)}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl"
                  data-testid="delivery-navigate-btn"
                >
                  <MapPin className="h-4 w-4 mr-2" /> Navigate
                </Button>
                {activeTab === 'my' && ['assigned', 'picked_up', 'in_transit'].includes(selectedOrder.delivery_status) && (
                  <Button
                    onClick={() => sendLocationUpdate(selectedOrder.id)}
                    variant="outline"
                    className="flex-1 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    data-testid="delivery-update-location-btn"
                  >
                    <MapPin className="h-4 w-4 mr-2" /> Update Location
                  </Button>
                )}
              </div>

              {/* Status Update Actions */}
              {activeTab === 'my' && selectedOrder.delivery_status !== 'delivered' && selectedOrder.delivery_status !== 'failed' && (
                <div className="flex gap-2 pt-2">
                  {selectedOrder.delivery_status === 'assigned' && (
                    <Button onClick={() => handleStatusUpdate(selectedOrder.id, 'picked_up')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl" data-testid="delivery-mark-picked-up">
                      <ArrowUpRight className="h-4 w-4 mr-2" /> Mark as Picked Up
                    </Button>
                  )}
                  {selectedOrder.delivery_status === 'picked_up' && (
                    <Button onClick={() => handleStatusUpdate(selectedOrder.id, 'in_transit')} className="flex-1 bg-violet-600 hover:bg-violet-700 rounded-xl" data-testid="delivery-mark-in-transit">
                      <Truck className="h-4 w-4 mr-2" /> Mark as In Transit
                    </Button>
                  )}
                  {(selectedOrder.delivery_status === 'in_transit' || selectedOrder.delivery_status === 'picked_up') && (
                    <Button onClick={() => handleStatusUpdate(selectedOrder.id, 'delivered')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl" data-testid="delivery-mark-delivered">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Delivered
                    </Button>
                  )}
                </div>
              )}

              {activeTab === 'available' && (
                <Button onClick={() => handleClaim(selectedOrder.id)} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl" data-testid="delivery-claim-btn">
                  <Truck className="h-4 w-4 mr-2" /> Claim This Order
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Location Map */}
      <OrderLocationMap
        shops={mapData.shops}
        customerLocation={mapData.customerLocation}
        open={mapOpen}
        onOpenChange={setMapOpen}
      />
    </div>
  );
};

export default DeliveryDashboard;
