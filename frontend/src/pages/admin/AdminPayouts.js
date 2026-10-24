import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, Store, Package, CheckCircle, RefreshCw, CreditCard, AlertCircle, Gift, ChevronDown, ChevronUp, Eye, Search } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminPayouts = () => {
  const [payoutData, setPayoutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingShop, setProcessingShop] = useState(null);
  const [expandedShop, setExpandedShop] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPayouts = useCallback(async () => {
    try {
      const { data } = await api.admin.getPendingPayouts();
      setPayoutData(data);
    } catch (error) {
      console.error('Failed to fetch payouts', error);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleMarkPaid = async (shopId, shopName) => {
    setProcessingShop(shopId);
    try {
      await api.admin.markPayoutPaid(shopId);
      toast.success(`Payout marked as paid for ${shopName}`);
      await fetchPayouts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark payout as paid');
    } finally {
      setProcessingShop(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const pendingPayouts = payoutData?.pending_payouts || [];
  const totalAdminOwes = payoutData?.total_admin_owes || 0;
  const totalOrders = payoutData?.total_orders || 0;

  // Filter payouts by search
  const filteredPayouts = searchQuery.trim() 
    ? pendingPayouts.filter(p => 
        p.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shop_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingPayouts;

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-8" data-testid="admin-payouts-content">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 lg:mb-8 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold" data-testid="admin-payouts-title">
              Shop Payouts
            </h1>
            <p className="text-slate-600 mt-1 text-sm">Pay shops for loyalty point deductions on their orders</p>
          </div>
          <Button variant="outline" onClick={() => { setLoading(true); fetchPayouts(); }} className="gap-2" data-testid="refresh-payouts-btn">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards - Simplified */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 sm:p-5 text-white shadow-lg" data-testid="admin-owes-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 rounded-lg p-2">
                <DollarSign className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm opacity-90">Total You Owe Shops</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">${totalAdminOwes.toFixed(2)}</p>
            <p className="text-[10px] sm:text-xs opacity-75 mt-1">Amount deducted from shops due to points</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 sm:p-5 text-white shadow-lg" data-testid="pending-orders-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 rounded-lg p-2">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm opacity-90">Orders With Payouts</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{totalOrders}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 sm:p-5 text-white shadow-lg" data-testid="shops-pending-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 rounded-lg p-2">
                <Store className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm opacity-90">Shops Pending Payout</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{pendingPayouts.length}</p>
          </div>
        </div>

        {/* Info Banner - Simplified */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 flex items-start gap-3" data-testid="info-banner">
          <CreditCard className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 text-sm">How it works</h3>
            <p className="text-xs sm:text-sm text-blue-700">
              When customers use loyalty points, the discount is split between <strong>commission reduction</strong> and <strong>shop revenue reduction</strong>. 
              If the discount exceeds commission, you owe the shop the difference.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
              data-testid="payout-search-input"
            />
          </div>
        </div>

        {/* Payouts List */}
        {filteredPayouts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-8 sm:p-12 text-center" data-testid="no-payouts">
            <CheckCircle className="h-12 sm:h-16 w-12 sm:w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">All Caught Up!</h2>
            <p className="text-slate-600 text-sm">No pending payouts. All shops have been paid.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="payouts-list">
            {filteredPayouts.map((payout) => (
              <div key={payout.shop_id} className="bg-white rounded-xl shadow-card overflow-hidden border border-slate-100" data-testid={`payout-row-${payout.shop_id}`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                        {payout.shop_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-base sm:text-lg text-slate-900" data-testid="payout-shop-name">{payout.shop_name}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500">{payout.order_count} order(s)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                      <div className="text-left sm:text-right flex-1 sm:flex-initial">
                        <p className="text-[10px] sm:text-xs text-slate-500">You Owe Shop</p>
                        <p className="text-xl sm:text-2xl font-bold text-red-600" data-testid="payout-owe-amount">
                          ${payout.admin_owes_shop.toFixed(2)}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs sm:text-sm"
                            disabled={processingShop === payout.shop_id}
                            data-testid="mark-paid-btn"
                          >
                            {processingShop === payout.shop_id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Mark Paid
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[92vw] sm:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5 text-emerald-600" />
                              Confirm Payout to {payout.shop_name}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                              <p>Confirm you have paid the shop:</p>
                              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Loyalty Discount (from orders):</span>
                                  <span className="font-semibold text-amber-600">${payout.loyalty_discount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Covered by Commission:</span>
                                  <span className="font-semibold text-slate-500">-${payout.commission_deducted.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="text-slate-600 font-medium">Amount to Pay Shop:</span>
                                  <span className="font-bold text-red-600 text-lg">${payout.admin_owes_shop.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-amber-800">
                                  Make sure you have transferred <strong>${payout.admin_owes_shop.toFixed(2)}</strong> to the shop.
                                </p>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleMarkPaid(payout.shop_id, payout.shop_name)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Confirm Paid
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Simple Breakdown Row */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-amber-50 rounded-lg p-2.5 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-amber-600">Points Discount Total</p>
                      <p className="font-semibold text-amber-700 text-sm sm:text-base">${payout.loyalty_discount.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-slate-500">Covered by Commission</p>
                      <p className="font-semibold text-slate-600 text-sm sm:text-base">-${payout.commission_deducted.toFixed(2)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2.5 sm:p-3 col-span-2 sm:col-span-1">
                      <p className="text-[10px] sm:text-xs text-red-500 flex items-center gap-1">
                        You Owe Shop
                        <Gift className="h-3 w-3" />
                      </p>
                      <p className="font-bold text-red-600 text-base sm:text-lg">${payout.admin_owes_shop.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Toggle Orders */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-xs text-slate-500"
                    onClick={() => setExpandedShop(expandedShop === payout.shop_id ? null : payout.shop_id)}
                    data-testid={`toggle-orders-${payout.shop_id}`}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    {expandedShop === payout.shop_id ? 'Hide' : 'Show'} Orders
                    {expandedShop === payout.shop_id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                </div>

                {/* Expanded Orders */}
                {expandedShop === payout.shop_id && payout.orders && (
                  <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="text-[10px] sm:text-xs text-slate-500 border-b">
                            <th className="py-2 px-2 sm:px-3 text-left">Order ID</th>
                            <th className="py-2 px-2 sm:px-3 text-left">Points Used</th>
                            <th className="py-2 px-2 sm:px-3 text-left">Discount</th>
                            <th className="py-2 px-2 sm:px-3 text-left">You Owe</th>
                            <th className="py-2 px-2 sm:px-3 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payout.orders.map((order) => (
                            <tr key={order.id} className="border-b border-slate-200 hover:bg-white">
                              <td className="py-2 px-2 sm:px-3 font-mono text-[10px] sm:text-xs">{order.id.slice(0, 8)}</td>
                              <td className="py-2 px-2 sm:px-3">
                                {order.loyalty_points_redeemed > 0 ? (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    {order.loyalty_points_redeemed} pts
                                  </Badge>
                                ) : '-'}
                              </td>
                              <td className="py-2 px-2 sm:px-3 text-amber-600 text-xs">${order.loyalty_discount_amount?.toFixed(2)}</td>
                              <td className="py-2 px-2 sm:px-3">
                                {order.admin_owes_shop_amount > 0 ? (
                                  <span className="text-red-600 font-semibold text-xs">${order.admin_owes_shop_amount.toFixed(2)}</span>
                                ) : (
                                  <span className="text-slate-400 text-xs">$0.00</span>
                                )}
                              </td>
                              <td className="py-2 px-2 sm:px-3 text-[10px] sm:text-xs text-slate-400">
                                {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPayouts;
