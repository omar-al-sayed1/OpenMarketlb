import React, { useEffect, useState } from 'react';
import { Megaphone, DollarSign, Eye, ShoppingCart, Clock, CheckCircle, XCircle, AlertCircle, Search, MoreHorizontal, TrendingUp, Calendar } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminPromotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [stats, setStats] = useState({ total_revenue: 0, active_count: 0, total_count: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchPromotions(); }, [filter]);

  const fetchPromotions = async () => {
    try {
      const { data } = await api.adminPromotions.getAll(filter === 'all' ? null : filter);
      setPromotions(data.promotions || []);
      setStats({ total_revenue: data.total_revenue, active_count: data.active_count, total_count: data.total_count });
    } catch (err) {
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    active: { icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    expired: { icon: Clock, color: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
    cancelled: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    pending: { icon: AlertCircle, color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  };

  const daysRemaining = (endDate) => {
    const diff = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const filteredPromotions = promotions.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (p.product_name || '').toLowerCase().includes(term) || (p.shop_name || '').toLowerCase().includes(term);
  });

  const filterTabs = [
    { key: 'all', label: 'All', count: stats.total_count },
    { key: 'active', label: 'Active', count: stats.active_count },
    { key: 'expired', label: 'Expired' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Product Promotions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage all sponsored product promotions</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4 sm:p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">${stats.total_revenue?.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 sm:p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Promotions</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.active_count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 sm:p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Promotions</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total_count}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
                {f.count !== undefined && <span className="ml-1 text-gray-400">({f.count})</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products or shops..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Promotions Table / Cards */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="8" className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin"></div>
                      <span className="text-sm">Loading promotions...</span>
                    </div>
                  </td></tr>
                ) : filteredPromotions.length === 0 ? (
                  <tr><td colSpan="8" className="p-12 text-center">
                    <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm font-medium">No promotions found</p>
                    <p className="text-gray-400 text-xs mt-0.5">Promotions will appear here once shops boost their products</p>
                  </td></tr>
                ) : filteredPromotions.map(promo => {
                  const cfg = statusConfig[promo.status] || statusConfig.pending;
                  const remaining = promo.status === 'active' ? daysRemaining(promo.end_date) : null;
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{promo.product_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{promo.shop_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {promo.duration_days} days
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {promo.total_cost === 0 ? (
                          <span className="text-emerald-600 text-sm font-medium">Free</span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">${promo.total_cost?.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">{promo.views || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ShoppingCart className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">{promo.orders || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                          {promo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {remaining !== null ? (
                          <span className={`text-sm font-medium ${remaining <= 3 ? 'text-red-600' : remaining <= 7 ? 'text-amber-600' : 'text-gray-600'}`}>
                            {remaining}d left
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : filteredPromotions.length === 0 ? (
              <div className="p-8 text-center">
                <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No promotions found</p>
              </div>
            ) : filteredPromotions.map(promo => {
              const cfg = statusConfig[promo.status] || statusConfig.pending;
              const remaining = promo.status === 'active' ? daysRemaining(promo.end_date) : null;
              return (
                <div key={promo.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{promo.product_name}</p>
                      <p className="text-xs text-gray-500">{promo.shop_name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                      {promo.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{promo.duration_days}d</span>
                    <span>{promo.total_cost === 0 ? 'Free' : `$${promo.total_cost?.toFixed(2)}`}</span>
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{promo.views || 0}</span>
                    <span className="flex items-center gap-0.5"><ShoppingCart className="h-3 w-3" />{promo.orders || 0}</span>
                    {remaining !== null && <span className="ml-auto font-medium text-gray-700">{remaining}d left</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPromotions;
