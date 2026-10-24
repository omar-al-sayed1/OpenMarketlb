import React, { useEffect, useState, useCallback } from 'react';
import { XCircle, CheckCircle, X, Package, User, Mail, Phone, Clock, Filter, Eye, ChevronDown, ChevronUp, RefreshCw, MessageSquare, ShoppingBag, AlertCircle, Search, Edit, Gift, DollarSign } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminCancelRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [userOrdersDialog, setUserOrdersDialog] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingUserOrders, setLoadingUserOrders] = useState(false);
  
  // Edit redemption state
  const [editRedemptionDialog, setEditRedemptionDialog] = useState(null);
  const [newRedeemPoints, setNewRedeemPoints] = useState(0);
  const [redemptionNote, setRedemptionNote] = useState('');
  const [savingRedemption, setSavingRedemption] = useState(false);

  // Expanded order detail in user orders dialog
  const [expandedOrderInDialog, setExpandedOrderInDialog] = useState(null);
  const [userPointsBalance, setUserPointsBalance] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await api.admin.getCancelRequests(statusFilter === 'all' ? null : statusFilter);
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch cancel requests', error);
      toast.error('Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId) => {
    setProcessing(requestId);
    try {
      await api.admin.approveCancelRequest(requestId, adminNotes[requestId] || '');
      toast.success('Cancellation request approved. Order has been cancelled.');
      setAdminNotes(prev => { const n = {...prev}; delete n[requestId]; return n; });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessing(requestId);
    try {
      await api.admin.rejectCancelRequest(requestId, adminNotes[requestId] || '');
      toast.success('Cancellation request rejected.');
      setAdminNotes(prev => { const n = {...prev}; delete n[requestId]; return n; });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  // View user orders that were ordered AFTER this cancel request's order
  const viewUserOrders = async (req) => {
    setLoadingUserOrders(true);
    setUserOrdersDialog(req);
    setExpandedOrderInDialog(null);
    setUserPointsBalance(null);
    try {
      // Get orders created after the cancel request's order creation date
      const orderCreatedAt = req.order?.created_at || req.created_at;
      const [ordersRes, pointsRes] = await Promise.allSettled([
        api.admin.getUserOrders(req.user_id, orderCreatedAt),
        api.admin.getUserPoints(req.user_id)
      ]);
      if (ordersRes.status === 'fulfilled') setUserOrders(ordersRes.value.data);
      if (pointsRes.status === 'fulfilled') setUserPointsBalance(pointsRes.value.data);
    } catch (error) {
      toast.error('Failed to load user orders');
    } finally {
      setLoadingUserOrders(false);
    }
  };

  // Edit redemption points on an order
  const openEditRedemption = (order, requestContext) => {
    setEditRedemptionDialog({ order, requestContext });
    setNewRedeemPoints(order.loyalty_points_redeemed || 0);
    setRedemptionNote('');
  };

  const handleSaveRedemption = async () => {
    if (!editRedemptionDialog) return;
    setSavingRedemption(true);
    try {
      const { data } = await api.admin.editOrderRedemption(editRedemptionDialog.order.id, {
        loyalty_points_redeemed: newRedeemPoints,
        admin_note: redemptionNote
      });
      toast.success(`Redemption updated: ${data.old_points} → ${data.new_points} pts. ${data.points_returned_to_user > 0 ? `${data.points_returned_to_user} pts returned to user.` : ''}`);
      setEditRedemptionDialog(null);
      // Refresh data
      fetchRequests();
      // If user orders dialog is open, refresh those too
      if (userOrdersDialog) {
        const orderCreatedAt = userOrdersDialog.order?.created_at || userOrdersDialog.created_at;
        const { data: ordersData } = await api.admin.getUserOrders(userOrdersDialog.user_id, orderCreatedAt);
        setUserOrders(ordersData);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update redemption');
    } finally {
      setSavingRedemption(false);
    }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  // Filter requests by search query
  const filteredRequests = requests.filter(req => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (req.customer_name || '').toLowerCase().includes(q) ||
      (req.customer_email || '').toLowerCase().includes(q) ||
      (req.customer_phone || '').toLowerCase().includes(q) ||
      (req.order_id || '').toLowerCase().includes(q) ||
      (req.reason || '').toLowerCase().includes(q)
    );
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-8" data-testid="admin-cancel-requests">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 lg:mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-heading font-bold" data-testid="cancel-requests-title">
              Cancellation Requests
            </h1>
            <p className="text-slate-600 mt-1">
              Review and manage order cancellation requests from customers
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {pendingCount} Pending
              </div>
            )}
            <Button variant="outline" onClick={fetchRequests} className="gap-2" data-testid="refresh-requests">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search by name, email, phone, order ID, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="cancel-requests-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setLoading(true); }}>
              <SelectTrigger className="w-40" data-testid="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {searchQuery && (
          <p className="text-sm text-slate-500 mb-4">
            Showing {filteredRequests.length} of {requests.length} results for "<strong>{searchQuery}</strong>"
          </p>
        )}

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-12 text-center" data-testid="no-requests">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Cancellation Requests</h2>
            <p className="text-slate-600">
              {searchQuery ? `No requests match "${searchQuery}".` : statusFilter === 'all' ? 'There are no cancellation requests at the moment.' : `No ${statusFilter} requests found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-card overflow-hidden border border-slate-100" data-testid={`cancel-request-${req.id}`}>
                {/* Request Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Badge className={`${statusColors[req.status]} border`} data-testid="request-status-badge">
                          {req.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">
                          Order #{req.order_id?.slice(0, 8)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {/* Customer Info */}
                      <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {req.customer_name || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {req.customer_email || 'N/A'}
                        </span>
                        {req.customer_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {req.customer_phone}
                          </span>
                        )}
                        <span className="font-semibold text-violet-600">
                          ${req.order_total?.toFixed(2)}
                        </span>
                      </div>

                      {req.reason && (
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Reason:</span> {req.reason}
                        </div>
                      )}

                      {req.admin_note && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                          <span className="font-medium">Admin Note:</span> {req.admin_note}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* View User Orders (after this order) */}
                      {req.user_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewUserOrders(req)}
                          className="gap-1 text-xs"
                          data-testid={`view-user-orders-${req.id}`}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Orders After
                        </Button>
                      )}
                      {/* Expand Order Details */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
                        data-testid={`toggle-order-details-${req.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {expandedRequest === req.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons for Pending Requests */}
                  {req.status === 'pending' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-end gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-xs text-slate-500 mb-1 block">Admin Note (optional)</label>
                          <Input
                            placeholder="Add a note for the customer..."
                            value={adminNotes[req.id] || ''}
                            onChange={(e) => setAdminNotes(prev => ({...prev, [req.id]: e.target.value}))}
                            className="text-sm"
                            data-testid={`admin-note-${req.id}`}
                          />
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              disabled={processing === req.id}
                              size="sm"
                              data-testid={`approve-btn-${req.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve Cancellation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel order #{req.order_id?.slice(0, 8)}, restore stock, and notify the customer. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Go Back</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleApprove(req.id)} className="bg-emerald-600 hover:bg-emerald-700">
                                Yes, Cancel Order
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => handleReject(req.id)}
                          disabled={processing === req.id}
                          size="sm"
                          data-testid={`reject-btn-${req.id}`}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Order Details */}
                {expandedRequest === req.id && req.order && (
                  <div className="border-t border-slate-100 bg-slate-50 p-5">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4 text-violet-600" />
                      Order Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Payment Method</p>
                        <p className="font-semibold capitalize">{req.order.payment_method}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Payment Status</p>
                        <p className="font-semibold capitalize">{req.order.payment_status}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Total Amount</p>
                        <p className="font-semibold text-lg">${req.order.total_amount?.toFixed(2)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Commission</p>
                        <p className="font-semibold text-red-600">${(req.order.commission_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {/* Loyalty / Redemption summary */}
                    {(req.order.loyalty_points_redeemed > 0 || req.order.loyalty_points_earned > 0) && (
                      <div className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
                        <h5 className="font-semibold text-amber-800 text-sm flex items-center gap-2 mb-2">
                          <Gift className="h-4 w-4" />
                          Loyalty Details
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {req.order.loyalty_points_redeemed > 0 && (
                            <div>
                              <p className="text-xs text-amber-600">Points Redeemed</p>
                              <p className="font-bold text-amber-800">{req.order.loyalty_points_redeemed} pts</p>
                            </div>
                          )}
                          {req.order.loyalty_discount_amount > 0 && (
                            <div>
                              <p className="text-xs text-amber-600">Discount (Money)</p>
                              <p className="font-bold text-amber-800">-${req.order.loyalty_discount_amount?.toFixed(2)}</p>
                            </div>
                          )}
                          {req.order.admin_owes_shop_amount > 0 && (
                            <div>
                              <p className="text-xs text-red-600">Admin Owes Shop</p>
                              <p className="font-bold text-red-700">${req.order.admin_owes_shop_amount?.toFixed(2)}</p>
                            </div>
                          )}
                          {req.order.loyalty_points_earned > 0 && (
                            <div>
                              <p className="text-xs text-emerald-600">Points Earned</p>
                              <p className="font-bold text-emerald-700">+{req.order.loyalty_points_earned} pts</p>
                            </div>
                          )}
                        </div>
                        {req.order.loyalty_points_redeemed > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 gap-1 text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={() => openEditRedemption(req.order, req)}
                            data-testid={`edit-redemption-${req.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit Redemption Points
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-2">
                      {req.order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-3">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              Qty: {item.quantity} {item.selected_color && `| ${item.selected_color}`} | Shop: {item.shop_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">${item.subtotal?.toFixed(2)}</p>
                            {item.original_subtotal && item.original_subtotal !== item.subtotal && (
                              <p className="text-xs text-slate-400">Original: ${item.original_subtotal?.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Shipping Address */}
                    {req.order.shipping_address && (
                      <div className="mt-4 bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Shipping Address</p>
                        <p className="text-sm">
                          {req.order.shipping_address.address}, {req.order.shipping_address.city}, {req.order.shipping_address.state} {req.order.shipping_address.zip}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* User Orders Dialog (only after cancel request date) */}
        <Dialog open={!!userOrdersDialog} onOpenChange={(open) => { if (!open) { setUserOrdersDialog(null); setExpandedOrderInDialog(null); } }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-violet-600" />
                Orders by {userOrdersDialog?.customer_name} (After Cancel Request)
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-slate-500">
                  Showing orders placed <strong>after</strong> the cancelled order (#{userOrdersDialog?.order_id?.slice(0, 8)})
                </p>
                {userPointsBalance && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                    <Gift className="h-3 w-3" />
                    {userPointsBalance.loyalty_points_balance?.toLocaleString()} pts ({userPointsBalance.loyalty_tier || 'Bronze'})
                  </span>
                )}
              </div>
            </DialogHeader>
            {loadingUserOrders ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : userOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No orders found after this cancellation request</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{userOrders.length} order(s) found after the cancellation request</p>
                {userOrders.map((order) => (
                  <div key={order.id} className="border rounded-xl overflow-hidden hover:shadow-sm transition-shadow" data-testid={`user-order-${order.id}`}>
                    <div 
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedOrderInDialog(expandedOrderInDialog === order.id ? null : order.id)}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            order.order_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            order.order_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                            order.order_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {order.order_status}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">{order.payment_method}</Badge>
                          {expandedOrderInDialog === order.id ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${order.total_amount?.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {order.loyalty_points_redeemed > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            {order.loyalty_points_redeemed} pts redeemed (-${(order.loyalty_discount_amount || 0).toFixed(2)})
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Expanded order details */}
                    {expandedOrderInDialog === order.id && (
                      <div className="border-t bg-slate-50 p-4">
                        {/* Items */}
                        <div className="space-y-2 mb-3">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-3">
                              {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover" />}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-slate-500">x{item.quantity} | ${item.subtotal?.toFixed(2)} | {item.shop_name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Financial summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-500">Total</p>
                            <p className="font-bold">${order.total_amount?.toFixed(2)}</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-500">Delivery</p>
                            <p className="font-bold">${(order.delivery_fee || 0).toFixed(2)}</p>
                          </div>
                          {order.loyalty_points_redeemed > 0 && (
                            <div className="bg-amber-50 rounded p-2">
                              <p className="text-amber-600">Points Discount</p>
                              <p className="font-bold text-amber-700">-${(order.loyalty_discount_amount || 0).toFixed(2)}</p>
                            </div>
                          )}
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-500">Commission</p>
                            <p className="font-bold text-red-600">${(order.commission_amount || 0).toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Edit redemption button */}
                        {order.loyalty_points_redeemed > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 gap-1 text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={(e) => { e.stopPropagation(); openEditRedemption(order, userOrdersDialog); }}
                            data-testid={`edit-redemption-order-${order.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit Redemption
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Redemption Dialog */}
        <Dialog open={!!editRedemptionDialog} onOpenChange={(open) => { if (!open) setEditRedemptionDialog(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-500" />
                Edit Order Redemption
              </DialogTitle>
            </DialogHeader>
            {editRedemptionDialog && (
              <div className="space-y-4 py-2">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Order: <span className="font-mono text-slate-500">#{editRedemptionDialog.order.id?.slice(0, 8)}</span></p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Current Points Redeemed</p>
                      <p className="font-bold text-amber-700">{editRedemptionDialog.order.loyalty_points_redeemed} pts</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Current Discount</p>
                      <p className="font-bold text-amber-700">-${(editRedemptionDialog.order.loyalty_discount_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Order Total</p>
                      <p className="font-bold">${editRedemptionDialog.order.total_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Admin Owes Shop</p>
                      <p className="font-bold text-red-600">${(editRedemptionDialog.order.admin_owes_shop_amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="new-redeem-points">New Redeemed Points (0 to remove all)</Label>
                  <Input
                    id="new-redeem-points"
                    type="number"
                    min={0}
                    max={editRedemptionDialog.order.loyalty_points_redeemed}
                    value={newRedeemPoints}
                    onChange={(e) => setNewRedeemPoints(Math.min(parseInt(e.target.value) || 0, editRedemptionDialog.order.loyalty_points_redeemed))}
                    className="mt-1"
                    data-testid="new-redeem-points-input"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {newRedeemPoints < editRedemptionDialog.order.loyalty_points_redeemed 
                      ? `Reducing by ${editRedemptionDialog.order.loyalty_points_redeemed - newRedeemPoints} pts. These will be returned to the user.`
                      : 'No change'}
                  </p>
                  {newRedeemPoints === 0 && editRedemptionDialog.order.loyalty_points_redeemed > 0 && (
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      All {editRedemptionDialog.order.loyalty_points_redeemed} points will be returned to the user and the discount removed.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="redemption-note">Admin Note (optional)</Label>
                  <Input
                    id="redemption-note"
                    value={redemptionNote}
                    onChange={(e) => setRedemptionNote(e.target.value)}
                    placeholder="Reason for adjustment..."
                    className="mt-1"
                    data-testid="redemption-note-input"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRedemptionDialog(null)}>Cancel</Button>
              <Button
                onClick={handleSaveRedemption}
                disabled={savingRedemption || (editRedemptionDialog && newRedeemPoints === editRedemptionDialog.order.loyalty_points_redeemed)}
                className="bg-amber-600 hover:bg-amber-700 gap-1"
                data-testid="save-redemption-btn"
              >
                {savingRedemption ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                {savingRedemption ? 'Saving...' : 'Update Redemption'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCancelRequests;
