import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronRight, Sparkles, ArrowRight, Calendar, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';

const EventPopup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [centerEvents, setCenterEvents] = useState([]);
  const [currentCenter, setCurrentCenter] = useState(null);
  const [showCenter, setShowCenter] = useState(false);

  const [sideFixedEvents, setSideFixedEvents] = useState([]);
  const [expandedFixed, setExpandedFixed] = useState(null);

  const [toastEvents, setToastEvents] = useState([]);
  const toastTimerRef = useRef(null);

  useEffect(() => { fetchEvents(); }, []);

  const isAdminArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/shop/');
  const isAuthPage = location.pathname === '/auth';

  // Robust auto-dismiss for toast events - 10 seconds per toast
  useEffect(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (toastEvents.length > 0) {
      const currentToastId = toastEvents[0].id;
      toastTimerRef.current = setTimeout(() => {
        setToastEvents(prev => prev.filter(e => e.id !== currentToastId));
        dismissEvent(currentToastId);
      }, 10000);
    }
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastEvents.length > 0 ? toastEvents[0]?.id : null]);

  const fetchEvents = async () => {
    try {
      // Fetch platform default color
      let platformColor = '#3bf4fb';
      try {
        const settingsRes = await api.admin.getPlatformSettings();
        if (settingsRes.data?.event_popup_color) platformColor = settingsRes.data.event_popup_color;
      } catch {}

      const { data } = await api.publicEvents.getActive();
      const all = (data.events || []).map(e => ({
        ...e,
        popup_color: e.popup_color || platformColor
      }));

      // Audience targeting: filter events by the current viewer's auth state / role.
      let viewer = null;
      try {
        const raw = localStorage.getItem('user');
        if (raw && localStorage.getItem('token')) viewer = JSON.parse(raw);
      } catch {}
      const role = viewer?.role || null;        // 'user' | 'shop' | 'admin' | 'agent' | 'delivery'
      const isLoggedIn = !!viewer;
      const matchesAudience = (e) => {
        const aud = e.audience || 'all_visitors';
        if (aud === 'all_visitors') return true;
        if (aud === 'users_logged_in') return isLoggedIn && (role === 'user' || role === 'customer');
        if (aud === 'shops_logged_in') return isLoggedIn && role === 'shop';
        if (aud === 'shops_and_users_logged_in') return isLoggedIn && (role === 'user' || role === 'customer' || role === 'shop');
        return true;
      };
      const audienceFiltered = all.filter(matchesAudience);

      const dismissed = JSON.parse(sessionStorage.getItem('dismissed_events') || '[]');
      const fresh = audienceFiltered.filter(e => !dismissed.includes(e.id));

      const center = fresh.filter(e => e.display_mode === 'center');
      const fixed = fresh.filter(e => e.display_mode === 'side_fixed');
      const toast = fresh.filter(e => e.display_mode === 'side_toast');

      if (center.length > 0) {
        setCenterEvents(center);
        setCurrentCenter(center[0]);
        setTimeout(() => setShowCenter(true), 800);
      }
      setSideFixedEvents(fixed);
      if (toast.length > 0) setToastEvents(toast);
    } catch {}
  };

  const dismissEvent = (id) => {
    const d = JSON.parse(sessionStorage.getItem('dismissed_events') || '[]');
    if (!d.includes(id)) { d.push(id); sessionStorage.setItem('dismissed_events', JSON.stringify(d)); }
  };

  const dismissCenter = () => {
    if (currentCenter) dismissEvent(currentCenter.id);
    setShowCenter(false);
    const remaining = centerEvents.filter(e => e.id !== currentCenter?.id);
    if (remaining.length > 0) {
      setCurrentCenter(remaining[0]);
      setCenterEvents(remaining);
      setTimeout(() => setShowCenter(true), 300);
    }
  };

  const dismissFixed = (id) => {
    dismissEvent(id);
    setSideFixedEvents(prev => prev.filter(e => e.id !== id));
    if (expandedFixed?.id === id) setExpandedFixed(null);
  };

  const dismissToast = (id) => {
    dismissEvent(id);
    setToastEvents(prev => prev.filter(e => e.id !== id));
  };

  const formatEndDate = (d) => {
    if (!d) return null;
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  // ===== CREATIVE CENTER MODAL =====
  const renderCenter = (event, onClose) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" data-testid="event-center-popup">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-[92vw] sm:max-w-md w-full overflow-hidden" style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {/* Creative gradient header */}
        <div className="relative overflow-hidden">
          {event.image_url ? (
            <div className="relative h-36 sm:h-48">
              <img src={event.image_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 sm:bottom-4 left-4 sm:left-5 right-4 sm:right-5">
                <h2 className="text-lg sm:text-2xl font-heading font-bold text-white drop-shadow-lg">{event.title}</h2>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6 relative overflow-hidden" style={{ background: event.popup_color ? `linear-gradient(135deg, ${event.popup_color}, ${event.popup_color}dd, #3bf4fb)` : 'linear-gradient(135deg, #f43f5e, #ec4899, #3bf4fb)' }}>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="absolute top-4 right-16 w-8 h-8 bg-white/10 rounded-full" />
              <div className="relative z-10 text-center">
                <div className="w-12 sm:w-14 h-12 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                  <Megaphone className="h-6 sm:h-7 w-6 sm:w-7 text-white" />
                </div>
                <h2 className="text-lg sm:text-2xl font-heading font-bold text-white">{event.title}</h2>
              </div>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-all hover:rotate-90 duration-200 z-20">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-slate-600 text-xs sm:text-sm mb-4 leading-relaxed">{event.description}</p>
          {event.end_date && (
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 mb-4 bg-slate-50 px-3 py-1.5 rounded-full">
              <Calendar className="h-3 w-3" />
              <span>Ends {formatEndDate(event.end_date)}</span>
            </div>
          )}
          {event.cta_text ? (
            <Button onClick={() => { onClose(); if (event.cta_link) navigate(event.cta_link); }}
              className="w-full h-10 sm:h-12 rounded-2xl bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white font-semibold text-sm sm:text-base shadow-lg shadow-rose-200/50">
              {event.cta_text} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-full h-10 sm:h-12 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-semibold">Got it</Button>
          )}
        </div>
      </div>
    </div>
  );

  if (isAdminArea || isAuthPage) return null;

  return (
    <>
      {/* CENTER */}
      {showCenter && currentCenter && renderCenter(currentCenter, dismissCenter)}

      {/* EXPANDED FIXED - close without dismissing, just collapse back */}
      {expandedFixed && renderCenter(expandedFixed, () => setExpandedFixed(null))}

      {/* SIDE FIXED WIDGETS - persist until X clicked */}
      {sideFixedEvents.length > 0 && !expandedFixed && (
        <div className="fixed top-[108px] sm:top-[112px] right-0 z-50 space-y-1.5" data-testid="event-side-fixed">
          {sideFixedEvents.map(event => (
            <div key={event.id} className="relative group" style={{ animation: 'slideInRight 0.4s ease-out' }}>
              <div onClick={() => setExpandedFixed(event)}
                className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-l-xl shadow-lg cursor-pointer hover:shadow-xl transition-all hover:translate-x-[-3px] px-2 sm:px-3 py-1.5 sm:py-2">
                <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap max-w-[80px] sm:max-w-[120px] truncate">{event.title}</span>
                <ChevronRight className="h-2.5 sm:h-3 w-2.5 sm:w-3 opacity-60" />
              </div>
              {/* X button always visible */}
              <button onClick={(e) => { e.stopPropagation(); dismissFixed(event.id); }}
                className="absolute -top-1.5 -left-1.5 w-5 h-5 sm:w-4 sm:h-4 bg-slate-700/90 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-sm z-10">
                <X className="h-3 sm:h-2.5 w-3 sm:w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SIDE TOAST - 10 seconds auto-dismiss */}
      {toastEvents.length > 0 && (
        <div className="fixed bottom-3 sm:bottom-6 right-2 sm:right-6 z-50 space-y-3 max-w-[85vw] sm:max-w-xs" data-testid="event-side-toast">
          {toastEvents.slice(0, 1).map(event => (
            <div key={event.id} className="bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden" style={{ animation: 'slideInRight 0.5s ease-out' }}>
              {event.image_url && <img src={event.image_url} alt="" className="w-full h-20 sm:h-24 object-cover" />}
              <div className="p-2.5 sm:p-3">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1">{event.title}</h4>
                  <button onClick={(e) => { e.stopPropagation(); dismissToast(event.id); }} className="text-slate-400 hover:text-slate-600 p-0.5 -mr-1 -mt-0.5 ml-1"><X className="h-3.5 sm:h-3.5 w-3.5 sm:w-3.5" /></button>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-2 mb-2">{event.description}</p>
                {event.end_date && (
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-2 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> Ends {formatEndDate(event.end_date)}</p>
                )}
                {event.cta_text && (
                  <Button size="sm" onClick={() => { dismissToast(event.id); if (event.cta_link) navigate(event.cta_link); }}
                    className="w-full rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] sm:text-xs h-7 sm:h-8">
                    {event.cta_text}
                  </Button>
                )}
              </div>
              <div className="h-1 bg-rose-100"><div className="h-full bg-gradient-to-r from-rose-400 to-pink-400 event-toast-progress" /></div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes popIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .event-toast-progress { animation: shrinkWidth 10s linear forwards; }
        @keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </>
  );
};

export default EventPopup;
