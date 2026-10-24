import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import TopNotificationBar from './TopNotificationBar';
import ShopSidebar from './ShopSidebar';
import SpinWheelWidget from './SpinWheelWidget';

const ShopLayout = ({ children }) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  // Hide the floating Spin Wheel widget on pages where it overlaps content (create-order, messages)
  const hideSpinWidget = location.pathname === '/shop/create-order' || location.pathname === '/shop/messages';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('shop_sidebar_collapsed') === 'true');

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleStorage = () => {
      setSidebarCollapsed(localStorage.getItem('shop_sidebar_collapsed') === 'true');
    };
    const handleCustom = (e) => {
      setSidebarCollapsed(e.detail?.collapsed || false);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('shop-sidebar-toggle', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('shop-sidebar-toggle', handleCustom);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="fixed top-0 left-0 right-0 z-30">
        <TopNotificationBar 
          userRole="shop" 
          userName={user?.name} 
          onLogout={handleLogout}
        />
      </div>
      <div className="flex pt-[44px]">
        <ShopSidebar onLogout={handleLogout} onCollapseChange={setSidebarCollapsed} />
        <div className={`flex-1 ml-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'} overflow-y-auto`}>
          {children}
        </div>
      </div>
      {/* Floating Spin Wheel Widget (hidden on create-order page) */}
      {!hideSpinWidget && <SpinWheelWidget />}
    </div>
  );
};

export default ShopLayout;
