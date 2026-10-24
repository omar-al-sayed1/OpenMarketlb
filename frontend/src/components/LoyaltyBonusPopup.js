import React, { useEffect, useState, useContext, useRef } from 'react';
import { Gift, Star, X, LogIn, Sparkles, ChevronRight, Calendar, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

const LoyaltyBonusPopup = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [claiming, setClaiming] = useState(false);

  const isAdminArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/shop/');
  const isAuthPage = location.pathname === '/auth';

  const [centerEvents, setCenterEvents] = useState([]);
  const [currentCenter, setCurrentCenter] = useState(null);
  const [showCenter, setShowCenter] = useState(false);

  const [sideToastEvents, setSideToastEvents] = useState([]);
  const [sideFixedEvents, setSideFixedEvents] = useState([]);
  const [expandedFixedEvent, setExpandedFixedEvent] = useState(null);
  const [claimedEventIds, setClaimedEventIds] = useState([]);

  const [fpb, setFpb] = useState(null);
  const [fpbVisible, setFpbVisible] = useState(false);
  const [fpbExpanded, setFpbExpanded] = useState(false);

  const toastTimerRef = useRef(null);
  const fpbToastTimerRef = useRef(null);

  useEffect(() => { fetchActiveBonus(); }, [user]);

  // Robust auto-dismiss for side toast - 10 seconds per toast
  useEffect(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (sideToastEvents.length > 0) {
      const currentToastId = sideToastEvents[0].id;
      toastTimerRef.current = setTimeout(() => {
        setSideToastEvents(prev => prev.filter(e => e.id !== currentToastId));
        dismissEvent(currentToastId);
      }, 10000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [sideToastEvents.length > 0 ? sideToastEvents[0]?.id : null]);

  // Robust auto-dismiss for FPB side toast - 10 seconds
  useEffect(() => {
    if (fpbToastTimerRef.current) {
      clearTimeout(fpbToastTimerRef.current);
      fpbToastTimerRef.current = null;
    }
    if (fpbVisible && fpb && fpb.display_mode === 'side') {
      fpbToastTimerRef.current = setTimeout(() => {
        dismissFpb();
      }, 10000);
    }
    return () => {
      if (fpbToastTimerRef.current) clearTimeout(fpbToastTimerRef.current);
    };
  }, [fpbVisible, fpb?.display_mode]);

  const fetchActiveBonus = async () => {
    try {
      const { data } = await api.loyalty.getActiveBonus();
      if (!data.loyalty_enabled) return;

      const allEvents = data.events || [];
      const dismissed = JSON.parse(sessionStorage.getItem('dismissed_bonus_events') || '[]');
      const fresh = allEvents.filter(e => !dismissed.includes(e.id));

      // Store claimed event IDs
      setClaimedEventIds(data.claimed_event_ids || []);

      setCenterEvents(fresh.filter(e => e.display_mode === 'center' || !e.display_mode));
      setSideToastEvents(fresh.filter(e => e.display_mode === 'side'));
      setSideFixedEvents(fresh.filter(e => e.display_mode === 'side_fixed'));

      const center = fresh.filter(e => e.display_mode === 'center' || !e.display_mode);
      if (center.length > 0) { setCurrentCenter(center[0]); setShowCenter(true); }

      if (data.first_purchase_bonus && !sessionStorage.getItem('dismissed_first_purchase_bonus')) {
        setFpb(data.first_purchase_bonus);
        setFpbVisible(true);
      }
    } catch {}
  };

  const dismissEvent = (id) => {
    const d = JSON.parse(sessionStorage.getItem('dismissed_bonus_events') || '[]');
    if (!d.includes(id)) { d.push(id); sessionStorage.setItem('dismissed_bonus_events', JSON.stringify(d)); }
  };

  const dismissCenter = () => {
    if (currentCenter) dismissEvent(currentCenter.id);
    setShowCenter(false);
    const remaining = centerEvents.filter(e => e.id !== currentCenter?.id);
    if (remaining.length > 0) { setCurrentCenter(remaining[0]); setCenterEvents(remaining); setTimeout(() => setShowCenter(true), 300); }
  };

  const dismissToast = (id) => { dismissEvent(id); setSideToastEvents(prev => prev.filter(e => e.id !== id)); };
  const dismissFixed = (id) => { dismissEvent(id); setSideFixedEvents(prev => prev.filter(e => e.id !== id)); if (expandedFixedEvent?.id === id) setExpandedFixedEvent(null); };
  const dismissFpb = () => { sessionStorage.setItem('dismissed_first_purchase_bonus', 'true'); setFpbVisible(false); setFpbExpanded(false); setFpb(null); };

  const isEventClaimed = (eventId) => claimedEventIds.includes(eventId);

  const handleClaim = async (event, onDone) => {
    if (!user) { navigate('/auth'); return; }
    setClaiming(true);
    try {
      const { data } = await api.loyalty.claimBonus(event.id);
      toast.success(data.message || `Claimed ${event.added_points} bonus points!`);
      setClaimedEventIds(prev => [...prev, event.id]);
      window.dispatchEvent(new Event('loyalty-updated'));
      if (onDone) onDone();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to claim';
      if (msg.includes('already claimed')) { 
        toast.info('Already claimed!'); 
        setClaimedEventIds(prev => [...prev, event.id]);
        if (onDone) onDone(); 
      }
      else toast.error(msg);
    } finally { setClaiming(false); }
  };

  const formatEndDate = (d) => {
    if (!d) return null;
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  // Get the CTA button for an event based on login/claimed state
  const getEventCTA = (event, onClose, size = 'default') => {
    const claimed = isEventClaimed(event.id);
    const isSmall = size === 'sm';
    
    if (event.type === 'added_points') {
      if (!user) {
        return (
          <Button onClick={() => { if (onClose) onClose(); navigate('/auth'); }} 
            className={`w-full rounded-${isSmall ? 'lg' : '2xl'} bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-200/50 ${isSmall ? 'text-[10px] sm:text-xs h-7 sm:h-8' : 'h-11'}`}
            data-testid="login-to-claim-btn">
            <LogIn className={`${isSmall ? 'h-3 w-3' : 'h-4 w-4'} mr-1.5`} /> Login to Claim
          </Button>
        );
      }
      if (claimed) {
        return (
          <Button disabled 
            className={`w-full rounded-${isSmall ? 'lg' : '2xl'} bg-slate-200 text-slate-500 font-semibold cursor-not-allowed ${isSmall ? 'text-[10px] sm:text-xs h-7 sm:h-8' : 'h-11'}`}
            data-testid="already-claimed-btn">
            <CheckCircle className={`${isSmall ? 'h-3 w-3' : 'h-4 w-4'} mr-1.5`} /> Already Claimed
          </Button>
        );
      }
      return (
        <Button onClick={() => handleClaim(event, onClose)} disabled={claiming}
          className={`w-full rounded-${isSmall ? 'lg' : '2xl'} bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-200/50 ${isSmall ? 'text-[10px] sm:text-xs h-7 sm:h-8' : 'h-11'}`}
          data-testid="claim-bonus-btn">
          {claiming ? 'Claiming...' : <><Gift className={`${isSmall ? 'h-3 w-3' : 'h-4 w-4'} mr-1.5`} /> Claim {event.added_points} Points</>}
        </Button>
      );
    }
    // Multiplier type
    return (
      <Button onClick={onClose} 
        className={`w-full rounded-${isSmall ? 'lg' : '2xl'} bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold shadow-lg shadow-violet-200/50 ${isSmall ? 'text-[10px] sm:text-xs h-7 sm:h-8' : 'h-11'}`}>
        <Star className={`${isSmall ? 'h-3 w-3' : 'h-4 w-4'} mr-1.5`} /> Shop & Earn {event.multiplier}x
      </Button>
    );
  };

  // ===== CREATIVE Center Modal =====
  const renderCenterModal = (event, onClose, isFirstPurchase = false) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" data-testid={isFirstPurchase ? "fpb-popup" : "loyalty-bonus-popup"}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-[92vw] sm:max-w-md w-full overflow-hidden" style={{ animation: 'loyaltyPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {/* Creative header with decorative elements */}
        <div className={`relative p-5 sm:p-6 text-center overflow-hidden ${isFirstPurchase
          ? 'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500'
          : 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500'}`}>
          {/* Decorative shapes */}
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute top-8 -left-4 w-12 h-12 bg-white/10 rounded-full" />
          <div className="absolute -bottom-3 right-12 w-8 h-8 bg-white/10 rounded-full" />
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-all hover:rotate-90 duration-200 z-10">
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-10">
            <div className="w-12 sm:w-14 h-12 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              {isFirstPurchase ? <Sparkles className="h-6 sm:h-7 w-6 sm:w-7 text-white" /> : event.type === 'multiplier' ? <Zap className="h-6 sm:h-7 w-6 sm:w-7 text-white" /> : <Gift className="h-6 sm:h-7 w-6 sm:w-7 text-white" />}
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-bold text-white">{isFirstPurchase ? 'First Purchase Bonus!' : (event.name || 'Bonus Points!')}</h2>
            {!isFirstPurchase && event.description && <p className="text-white/85 text-xs sm:text-sm mt-1">{event.description}</p>}
          </div>
        </div>
        <div className="p-4 sm:p-5 text-center">
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-3 border ${isFirstPurchase ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <Star className={`h-4 w-4 ${isFirstPurchase ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className={`text-lg sm:text-xl font-bold ${isFirstPurchase ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isFirstPurchase ? `+${event.points}` : event.type === 'multiplier' ? `${event.multiplier}x` : `+${event.added_points}`}
            </span>
            <span className={`text-xs sm:text-sm font-medium ${isFirstPurchase ? 'text-emerald-600' : 'text-amber-600'}`}>
              {event.type === 'multiplier' ? 'multiplier' : 'points'}
            </span>
          </div>
          {!isFirstPurchase && event.end_date && (
            <p className="text-xs text-slate-400 mb-3 flex items-center justify-center gap-1">
              <Calendar className="h-3 w-3" /> Ends {formatEndDate(event.end_date)}
            </p>
          )}
          {isFirstPurchase ? (
            <Button onClick={() => { onClose(); navigate('/products'); }} className="w-full h-10 sm:h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-200/50">
              <Sparkles className="h-4 w-4 mr-2" /> Start Shopping
            </Button>
          ) : (
            getEventCTA(event, onClose)
          )}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="mt-2 text-xs text-slate-400 hover:text-slate-600">Maybe later</button>
        </div>
      </div>
    </div>
  );

  if (isAdminArea || isAuthPage) return null;

  return (
    <>
      {/* CENTER MODAL */}
      {showCenter && currentCenter && renderCenterModal(currentCenter, dismissCenter)}

      {/* SIDE FIXED - persist until X clicked, click only expands */}
      {sideFixedEvents.length > 0 && !expandedFixedEvent && (
        <div className="fixed top-[108px] sm:top-[112px] left-0 z-50 space-y-1.5" data-testid="loyalty-side-fixed">
          {sideFixedEvents.map(event => (
            <div key={event.id} className="relative" style={{ animation: 'loyaltySlideInLeft 0.4s ease-out' }}>
              <div onClick={() => setExpandedFixedEvent(event)}
                className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-r-xl shadow-lg cursor-pointer hover:shadow-xl transition-all hover:translate-x-[2px] px-2 sm:px-3 py-1.5 sm:py-2">
                <Gift className="h-3 sm:h-3.5 w-3 sm:w-3.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs font-semibold block truncate max-w-[70px] sm:max-w-[110px]">{event.name || 'Bonus!'}</span>
                  <span className="text-[9px] sm:text-[10px] text-white/80">{event.type === 'multiplier' ? `${event.multiplier}x` : `+${event.added_points} pts`}</span>
                </div>
                <ChevronRight className="h-2.5 sm:h-3 w-2.5 sm:w-3 opacity-60 flex-shrink-0" />
              </div>
              {/* X always visible - only way to dismiss */}
              <button onClick={(e) => { e.stopPropagation(); dismissFixed(event.id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-4 sm:h-4 bg-slate-700/90 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-sm z-10">
                <X className="h-3 sm:h-2.5 w-3 sm:w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Expanded fixed event - close goes back to widget, NOT dismiss */}
      {expandedFixedEvent && renderCenterModal(expandedFixedEvent, () => setExpandedFixedEvent(null))}

      {/* SIDE TOAST - 10 seconds auto-dismiss */}
      {sideToastEvents.length > 0 && (
        <div className="fixed bottom-3 sm:bottom-6 right-2 sm:right-6 z-50 space-y-3 max-w-[85vw] sm:max-w-xs" data-testid="loyalty-side-popup">
          {sideToastEvents.slice(0, 1).map(event => (
            <div key={event.id} className="bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden" style={{ animation: 'loyaltySlideInRight 0.5s ease-out' }}>
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Gift className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-white" />
                  <span className="text-white font-semibold text-[10px] sm:text-xs">{event.name || 'Bonus!'}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); dismissToast(event.id); }} className="text-white/80 hover:text-white"><X className="h-3.5 sm:h-3.5 w-3.5 sm:w-3.5" /></button>
              </div>
              <div className="p-2.5 sm:p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-amber-100 rounded-full p-1 sm:p-1.5"><Star className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-500" /></div>
                  <div>
                    <p className="font-bold text-amber-700 text-sm sm:text-base">{event.type === 'multiplier' ? `${event.multiplier}x Points` : `+${event.added_points} pts`}</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500">{event.description || ''}</p>
                  </div>
                </div>
                {event.end_date && <p className="text-[9px] sm:text-[10px] text-slate-400 mb-2 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> Ends {formatEndDate(event.end_date)}</p>}
                {getEventCTA(event, () => dismissToast(event.id), 'sm')}
              </div>
              <div className="h-1 bg-amber-100"><div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 loyalty-toast-progress" /></div>
            </div>
          ))}
        </div>
      )}

      {/* FIRST PURCHASE BONUS - Center */}
      {fpbVisible && fpb && fpb.display_mode === 'center' && renderCenterModal(fpb, dismissFpb, true)}

      {/* FIRST PURCHASE BONUS - Side Fixed (persist until X) */}
      {fpbVisible && fpb && fpb.display_mode === 'side_fixed' && !fpbExpanded && (
        <div className="fixed top-[140px] sm:top-[150px] left-0 z-50" style={{ animation: 'loyaltySlideInLeft 0.4s ease-out' }}>
          <div className="relative">
            <div onClick={() => setFpbExpanded(true)}
              className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-r-xl shadow-lg cursor-pointer hover:shadow-xl transition-all hover:translate-x-[2px] px-2 sm:px-3 py-1.5 sm:py-2">
              <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              <div>
                <span className="text-[10px] sm:text-xs font-semibold block">1st Purchase</span>
                <span className="text-[9px] sm:text-[10px] text-white/80">+{fpb.points} pts</span>
              </div>
              <ChevronRight className="h-2.5 sm:h-3 w-2.5 sm:w-3 opacity-60" />
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismissFpb(); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-4 sm:h-4 bg-slate-700/90 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-sm z-10">
              <X className="h-3 sm:h-2.5 w-3 sm:w-2.5" />
            </button>
          </div>
        </div>
      )}
      {fpbExpanded && fpb && renderCenterModal(fpb, () => setFpbExpanded(false), true)}

      {/* FIRST PURCHASE BONUS - Side Toast (auto-dismiss 10s) */}
      {fpbVisible && fpb && fpb.display_mode === 'side' && (
        <div className="fixed bottom-3 sm:bottom-6 left-2 sm:left-6 z-50 max-w-[85vw] sm:max-w-xs" style={{ animation: 'loyaltySlideInLeft 0.5s ease-out' }}>
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5"><Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-white" /><span className="text-white font-semibold text-[10px] sm:text-xs">First Purchase Bonus!</span></div>
              <button onClick={(e) => { e.stopPropagation(); dismissFpb(); }} className="text-white/80 hover:text-white"><X className="h-3.5 sm:h-3.5 w-3.5 sm:w-3.5" /></button>
            </div>
            <div className="p-2.5 sm:p-3">
              <p className="font-bold text-emerald-700 mb-1 text-sm sm:text-base">+{fpb.points} points</p>
              <p className="text-[9px] sm:text-[10px] text-slate-500 mb-2">Make your first purchase!</p>
              <Button onClick={() => { dismissFpb(); navigate('/products'); }} size="sm" className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] sm:text-xs h-7 sm:h-8">Start Shopping</Button>
            </div>
            <div className="h-1 bg-emerald-100"><div className="h-full bg-emerald-400 fpb-toast-progress" /></div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loyaltyPopIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes loyaltySlideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes loyaltySlideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .loyalty-toast-progress { animation: shrinkWidth 10s linear forwards; }
        .fpb-toast-progress { animation: shrinkWidth 10s linear forwards; }
        @keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </>
  );
};

export default LoyaltyBonusPopup;
