import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, Sparkles, Gift, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';

const SubscriptionSalePopup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sale, setSale] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const isAuthPage = location.pathname === '/auth';

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const { data } = await api.admin.getPlatformSettings();
        if (data.subscription_sale_active && data.subscription_sale_percentage > 0 && data.subscription_sale_popup_enabled) {
          setSale({
            percentage: data.subscription_sale_percentage,
            message: data.subscription_sale_message || '',
            originalPrice: data.subscription_price || 29,
            salePrice: ((data.subscription_price || 29) * (1 - (data.subscription_sale_percentage || 0) / 100)).toFixed(2),
          });
          const popupShown = sessionStorage.getItem('sale_popup_shown');
          if (!popupShown) {
            setTimeout(() => setShowPopup(true), 1500);
            sessionStorage.setItem('sale_popup_shown', 'true');
          }
        }
      } catch (e) { /* ignore */ }
    };
    fetchSale();
  }, []);

  if (!showPopup || !sale || isAuthPage) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" data-testid="sale-popup-overlay">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowPopup(false); }} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-[92vw] sm:max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300" data-testid="sale-popup">
        {/* Decorative top */}
        <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20">
            <div className="absolute top-2 left-4 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>&#127881;</div>
            <div className="absolute top-4 right-8 text-3xl animate-bounce" style={{ animationDelay: '0.3s' }}>&#11088;</div>
            <div className="absolute bottom-2 left-1/4 text-2xl animate-bounce" style={{ animationDelay: '0.6s' }}>&#127873;</div>
            <div className="absolute bottom-4 right-1/4 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>&#128293;</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPopup(false); }}
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-white/20 rounded-full p-1.5 transition-colors z-10"
            data-testid="close-sale-popup"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3 text-sm text-white font-medium">
              <Tag className="h-3.5 w-3.5" />
              Limited Time Offer
            </div>
            <h2 className="text-3xl font-black text-white mb-1">
              {sale.percentage}% OFF
            </h2>
            <p className="text-white/90 font-medium">Seller Subscription</p>
          </div>
        </div>

        <div className="p-6 text-center">
          {sale.message && (
            <p className="text-slate-700 font-medium mb-4 text-lg">{sale.message}</p>
          )}

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-0.5">Was</p>
              <p className="text-2xl font-bold text-slate-400 line-through">${sale.originalPrice}</p>
              <p className="text-xs text-slate-500">/month</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <div className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl px-5 py-3 border-2 border-emerald-200">
              <p className="text-xs text-emerald-600 mb-0.5 font-medium">Now</p>
              <p className="text-3xl font-black text-emerald-600">${sale.salePrice}</p>
              <p className="text-xs text-emerald-600 font-medium">/month</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-5">
            <Gift className="h-4 w-4 text-violet-500" />
            <span>Start selling your products today!</span>
          </div>

          <Button
            onClick={() => { setShowPopup(false); navigate('/become-seller'); }}
            className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 hover:from-orange-600 hover:via-rose-600 hover:to-violet-700 shadow-lg"
            data-testid="sale-cta-btn"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Become a Seller Now
          </Button>

          <button
            onClick={() => setShowPopup(false)}
            className="text-sm text-slate-400 hover:text-slate-600 mt-3 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSalePopup;
