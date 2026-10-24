import React, { useEffect, useState } from 'react';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, Package, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import ShopLayout from '../../components/ShopLayout';
import { api } from '../../lib/api';

const ShopAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data } = await api.shop.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform monthly revenue data for charts
  const getMonthlyChartData = () => {
    if (!analytics?.monthly_revenue) return [];
    
    const data = Object.entries(analytics.monthly_revenue)
      .map(([month, revenue]) => {
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          month: `${monthNames[parseInt(monthNum) - 1]} ${year}`,
          revenue: parseFloat(revenue.toFixed(2)),
          fullMonth: month
        };
      })
      .sort((a, b) => a.fullMonth.localeCompare(b.fullMonth))
      .slice(-12); // Last 12 months
    
    return data;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const monthlyData = getMonthlyChartData();

  // Order status distribution for pie chart
  const getOrderStatusData = () => {
    if (!analytics?.order_status_breakdown) {
      // Build from total_orders if breakdown not available
      const statuses = ['pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled'];
      return statuses.map(s => ({
        name: s.charAt(0).toUpperCase() + s.slice(1),
        value: analytics?.[`${s}_orders`] || 0
      })).filter(s => s.value > 0);
    }
    return Object.entries(analytics.order_status_breakdown).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count
    })).filter(s => s.value > 0);
  };

  // Monthly orders count for line chart
  const getMonthlyOrdersData = () => {
    if (!analytics?.monthly_orders) {
      // Derive from monthly_revenue if monthly_orders not available
      return monthlyData.map(d => ({ ...d, orders: Math.max(1, Math.round(d.revenue / (analytics?.total_orders > 0 ? analytics.total_revenue / analytics.total_orders : 50))) }));
    }
    return Object.entries(analytics.monthly_orders)
      .map(([month, count]) => {
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { month: `${monthNames[parseInt(monthNum) - 1]} ${year}`, orders: count, fullMonth: month };
      })
      .sort((a, b) => a.fullMonth.localeCompare(b.fullMonth))
      .slice(-12);
  };

  const orderStatusData = getOrderStatusData();
  const monthlyOrdersData = getMonthlyOrdersData();
  const PIE_COLORS = ['#f59e0b', '#3b82f6', '#5df6fc', '#10b981', '#06b6d4', '#22c55e', '#ef4444'];

  return (
    <ShopLayout>
      
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" data-testid="shop-analytics-content">
        <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-blue-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-200">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900" data-testid="shop-analytics-title">Analytics</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Performance insights and revenue trends</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-card" data-testid="stat-total-revenue">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">${analytics?.total_revenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-emerald-100 rounded-full p-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-card" data-testid="stat-total-orders">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs">Total Orders</p>
                <p className="text-2xl font-bold text-blue-600">{analytics?.total_orders || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-card" data-testid="stat-products">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs">Products</p>
                <p className="text-2xl font-bold text-purple-600">{analytics?.products_count || 0}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-2">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-card" data-testid="stat-avg-order">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs">Avg Order Value</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${analytics?.total_orders > 0 ? (analytics.total_revenue / analytics.total_orders).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Bar Chart */}
          <div className="bg-white rounded-xl p-5 shadow-card" data-testid="monthly-revenue-chart">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Monthly Revenue
            </h2>
            {monthlyData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No revenue data yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Revenue Trend Area Chart */}
          <div className="bg-white rounded-xl p-5 shadow-card" data-testid="revenue-trend-chart">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Revenue Trend
            </h2>
            {monthlyData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No trend data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Order Status Pie Chart */}
          <div className="bg-white rounded-xl p-5 shadow-card" data-testid="order-status-chart">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-violet-600" />
              Order Status Distribution
            </h2>
            {orderStatusData.length > 0 ? (
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value, name) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 ml-2 min-w-[100px]">
                  {orderStatusData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-slate-600">{entry.name}</span>
                      <span className="font-semibold ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No order data yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Orders Over Time Line Chart */}
          <div className="bg-white rounded-xl p-5 shadow-card" data-testid="orders-over-time-chart">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-600" />
              Orders Over Time
            </h2>
            {monthlyOrdersData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyOrdersData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={{ stroke: '#e2e8f0' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => [value, 'Orders']}
                    />
                    <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No order history yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Breakdown Table */}
        {monthlyData.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-card mt-6" data-testid="monthly-breakdown">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Monthly Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Month</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.slice().reverse().map((item, index) => (
                    <tr key={item.fullMonth} className={index % 2 === 0 ? 'bg-slate-50' : ''}>
                      <td className="py-3 px-4">{item.month}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">${item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
};

export default ShopAnalytics;
