import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App';
import TopNotificationBar from './TopNotificationBar';
import EmployeeSidebar from './EmployeeSidebar';
import { api } from '../lib/api';

export const EmployeeContext = React.createContext({ allowedPages: [], employee: null });

const EmployeeLayout = ({ children, requirePage = null }) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('employee_sidebar_collapsed') === 'true');
  const [allowedPages, setAllowedPages] = useState([]);
  const [employeeLoaded, setEmployeeLoaded] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  useEffect(() => {
    const handleCustom = (e) => setSidebarCollapsed(e.detail?.collapsed || false);
    window.addEventListener('employee-sidebar-toggle', handleCustom);
    return () => window.removeEventListener('employee-sidebar-toggle', handleCustom);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'employee') {
      setEmployeeLoaded(true);
      return;
    }
    (async () => {
      try {
        const { data } = await api.employee.me();
        setAllowedPages(data.allowed_pages || []);
        setEmployeeInfo(data);
      } catch {
        setAllowedPages([]);
      } finally {
        setEmployeeLoaded(true);
      }
    })();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'employee') return <Navigate to="/" replace />;
  if (!employeeLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-emerald-200 animate-spin" style={{ borderTopColor: '#10b981' }} />
      </div>
    );
  }
  if (requirePage && !allowedPages.includes(requirePage)) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <div className="fixed top-0 left-0 right-0 z-30">
          <TopNotificationBar userRole="employee" userName={user?.name} onLogout={handleLogout} />
        </div>
        <div className="flex pt-[44px]">
          <EmployeeSidebar onLogout={handleLogout} onCollapseChange={setSidebarCollapsed} allowedPages={allowedPages} />
          <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'} overflow-y-auto`}>
            <div className="max-w-3xl mx-auto px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h1>
              <p className="text-slate-500 mb-6">You don't have permission to view this page. Please contact your administrator.</p>
              <button onClick={() => navigate('/employee')} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-md hover:shadow-lg transition-all">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmployeeContext.Provider value={{ allowedPages, employee: employeeInfo }}>
      <div className="min-h-screen bg-slate-50/50">
        <div className="fixed top-0 left-0 right-0 z-30">
          <TopNotificationBar userRole="employee" userName={user?.name} onLogout={handleLogout} />
        </div>
        <div className="flex pt-[44px]">
          <EmployeeSidebar onLogout={handleLogout} onCollapseChange={setSidebarCollapsed} allowedPages={allowedPages} />
          <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'} overflow-y-auto`}>
            {children}
          </div>
        </div>
      </div>
    </EmployeeContext.Provider>
  );
};

export default EmployeeLayout;
