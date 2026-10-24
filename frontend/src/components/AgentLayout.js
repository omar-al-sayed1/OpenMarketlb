import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App';
import TopNotificationBar from './TopNotificationBar';
import AgentSidebar from './AgentSidebar';
import { api } from '../lib/api';

export const AgentContext = React.createContext({ agent: null, refresh: () => {} });

const AgentLayout = ({ children }) => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('agent_sidebar_collapsed') === 'true');
  const [agentInfo, setAgentInfo] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const { data } = await api.agent.me();
      setAgentInfo(data);
    } catch {
      setAgentInfo(null);
    }
  };

  useEffect(() => {
    const handleCustom = (e) => setSidebarCollapsed(e.detail?.collapsed || false);
    window.addEventListener('agent-sidebar-toggle', handleCustom);
    return () => window.removeEventListener('agent-sidebar-toggle', handleCustom);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'agent') {
      setLoaded(true);
      return;
    }
    (async () => {
      await refresh();
      setLoaded(true);
    })();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'agent') return <Navigate to="/" replace />;
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-violet-200 animate-spin" style={{ borderTopColor: '#3bf4fb' }} />
      </div>
    );
  }

  return (
    <AgentContext.Provider value={{ agent: agentInfo, refresh }}>
      <div className="min-h-screen bg-slate-50/50">
        <div className="fixed top-0 left-0 right-0 z-30">
          <TopNotificationBar userRole="agent" userName={user?.name} onLogout={handleLogout} />
        </div>
        <div className="flex pt-[44px]">
          <AgentSidebar onLogout={handleLogout} onCollapseChange={setSidebarCollapsed} />
          <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'} overflow-y-auto`}>
            {children}
          </div>
        </div>
      </div>
    </AgentContext.Provider>
  );
};

export default AgentLayout;
