import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import TopNotificationBar from './TopNotificationBar';
import AdminSidebar from './AdminSidebar';
import AgentLayout from './AgentLayout';

// AGENT_PAGE_MAP: derive required page key from URL
const AGENT_PAGE_MAP = {
  '/agent': 'dashboard',
  '/agent/shops': 'shops',
  '/agent/map': 'map',
  '/agent/products': 'products',
  '/agent/orders': 'orders',
  '/agent/cancel-requests': 'cancel_requests',
  '/agent/verification-requests': 'shops_verifications',
  '/agent/shop-sales': 'shop_sales',
  '/agent/categories': 'categories',
  '/agent/users': 'users',
  '/agent/contact-messages': 'contact_form',
  '/agent/promotions': 'promotions',
  '/agent/gallery': 'gallery',
};

const AdminLayout = ({ children }) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('admin_sidebar_collapsed') === 'true');

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleStorage = () => {
      setSidebarCollapsed(localStorage.getItem('admin_sidebar_collapsed') === 'true');
    };
    const handleCustom = (e) => {
      setSidebarCollapsed(e.detail?.collapsed || false);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('admin-sidebar-toggle', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('admin-sidebar-toggle', handleCustom);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // If user is an agent (and on /agent path), delegate to AgentLayout
  if (user && user.role === 'agent') {
    const requirePage = AGENT_PAGE_MAP[location.pathname];
    return <AgentLayout requirePage={requirePage}>{children}</AgentLayout>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="fixed top-0 left-0 right-0 z-30">
        <TopNotificationBar 
          userRole="admin" 
          userName={user?.name} 
          onLogout={handleLogout}
        />
      </div>
      <div className="flex pt-[44px]">
        <AdminSidebar onLogout={handleLogout} onCollapseChange={setSidebarCollapsed} />
        <div className={`flex-1 ml-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'} overflow-y-auto`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
