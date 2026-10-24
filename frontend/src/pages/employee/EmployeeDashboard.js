import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Users, Clock, Store, ShoppingCart, AlertTriangle, ChevronRight, ShoppingBag, Activity, Layers, Shield, Image as ImageIcon, Map, Megaphone, FolderTree, Inbox, XCircle, Tag } from 'lucide-react';
import EmployeeLayout, { EmployeeContext } from '../../components/EmployeeLayout';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const QuickAction = ({ to, icon: Icon, label, color, navigate, allowed, pageKey }) => {
  if (!allowed) return null;
  return (
    <button onClick={() => navigate(to)} className={`group flex items-center gap-3 p-4 rounded-2xl border border-slate-200/60 bg-white hover:shadow-lg transition-all hover:-translate-y-0.5`}
      data-testid={`employee-quickaction-${pageKey}`}>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left">
        <div className="font-semibold text-sm text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">Open</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
    </button>
  );
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingShops, setPendingShops] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.admin.getAnalytics();
        setAnalytics(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    (async () => {
      try {
        const { data } = await api.admin.getShops();
        setPendingShops((data || []).filter(s => s.status === 'pending'));
      } catch {}
    })();
  }, []);

  return (
    <EmployeeLayout requirePage="dashboard">
      <EmployeeContext.Consumer>
        {({ allowedPages = [], employee }) => (
        <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 sm:p-8 mb-6 shadow-xl">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
                <Activity className="w-3.5 h-3.5" />
                <span>Employee Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Welcome, {employee?.first_name || 'Employee'} 👋</h1>
              <p className="text-white/80 text-sm">Manage shops, products, orders and more. You have {allowedPages.length} pages available.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard icon={ShoppingBag} label="Total Orders" value={analytics?.total_orders ?? '—'} color="from-blue-500 to-indigo-500" loading={loading} />
            <StatCard icon={Package} label="Products" value={analytics?.total_products ?? '—'} color="from-amber-500 to-orange-500" loading={loading} />
            <StatCard icon={Users} label="Users" value={analytics?.total_users ?? '—'} color="from-purple-500 to-fuchsia-500" loading={loading} />
            <StatCard icon={AlertTriangle} label="Low Stock" value={analytics?.low_stock_count ?? '—'} color="from-rose-500 to-red-500" loading={loading} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600"/>Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <QuickAction navigate={navigate} pageKey="shops" to="/employee/shops" icon={Store} label="Shops" color="bg-gradient-to-br from-emerald-500 to-teal-500" allowed={allowedPages.includes('shops')} />
              <QuickAction navigate={navigate} pageKey="map" to="/employee/map" icon={Map} label="Map" color="bg-gradient-to-br from-cyan-500 to-blue-500" allowed={allowedPages.includes('map')} />
              <QuickAction navigate={navigate} pageKey="products" to="/employee/products" icon={Package} label="Products" color="bg-gradient-to-br from-amber-500 to-orange-500" allowed={allowedPages.includes('products')} />
              <QuickAction navigate={navigate} pageKey="orders" to="/employee/orders" icon={ShoppingBag} label="Orders" color="bg-gradient-to-br from-indigo-500 to-violet-500" allowed={allowedPages.includes('orders')} />
              <QuickAction navigate={navigate} pageKey="cancel_requests" to="/employee/cancel-requests" icon={XCircle} label="Cancel Requests" color="bg-gradient-to-br from-rose-500 to-pink-500" allowed={allowedPages.includes('cancel_requests')} />
              <QuickAction navigate={navigate} pageKey="shops_verifications" to="/employee/verification-requests" icon={Shield} label="Verifications" color="bg-gradient-to-br from-blue-500 to-indigo-600" allowed={allowedPages.includes('shops_verifications')} />
              <QuickAction navigate={navigate} pageKey="shop_sales" to="/employee/shop-sales" icon={Tag} label="Shop Sales" color="bg-gradient-to-br from-fuchsia-500 to-pink-500" allowed={allowedPages.includes('shop_sales')} />
              <QuickAction navigate={navigate} pageKey="categories" to="/employee/categories" icon={FolderTree} label="Categories" color="bg-gradient-to-br from-lime-500 to-emerald-500" allowed={allowedPages.includes('categories')} />
              <QuickAction navigate={navigate} pageKey="users" to="/employee/users" icon={Users} label="Users" color="bg-gradient-to-br from-purple-500 to-fuchsia-500" allowed={allowedPages.includes('users')} />
              <QuickAction navigate={navigate} pageKey="contact_form" to="/employee/contact-messages" icon={Inbox} label="Contact Forms" color="bg-gradient-to-br from-sky-500 to-cyan-500" allowed={allowedPages.includes('contact_form')} />
              <QuickAction navigate={navigate} pageKey="promotions" to="/employee/promotions" icon={Megaphone} label="Promotions" color="bg-gradient-to-br from-yellow-500 to-amber-500" allowed={allowedPages.includes('promotions')} />
              <QuickAction navigate={navigate} pageKey="gallery" to="/employee/gallery" icon={ImageIcon} label="Gallery" color="bg-gradient-to-br from-pink-500 to-rose-500" allowed={allowedPages.includes('gallery')} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600"/>Pending Shops</h2>
              {allowedPages.includes('shops') && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/employee/shops')}>View All <ChevronRight className="w-4 h-4 ml-1"/></Button>
              )}
            </div>
            {pendingShops.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">No pending shops.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingShops.slice(0, 5).map(s => (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {s.logo ? <img src={s.logo} alt="" className="w-9 h-9 rounded-lg object-cover"/> : <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-semibold">{(s.name||'?').charAt(0)}</div>}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 text-sm truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 truncate">{s.email || s.phone || '—'}</div>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}
      </EmployeeContext.Consumer>
    </EmployeeLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, color, loading }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-2xl sm:text-3xl font-bold text-slate-900">{loading ? '—' : value}</div>
    <div className="text-xs text-slate-500 mt-1">{label}</div>
  </div>
);

export default EmployeeDashboard;
