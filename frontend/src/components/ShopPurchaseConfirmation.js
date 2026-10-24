import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Gift, Rocket, Palette, X } from 'lucide-react';

const confettiColors = ['#3bf4fb', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316'];

const ShopPurchaseConfirmation = ({ open, onClose, type = 'boost', details = {} }) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const configs = {
    boost: {
      icon: Rocket,
      title: 'Product Boosted!',
      subtitle: 'Your product is now being promoted to more customers',
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'bg-amber-500/20',
      iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    },
    spin: {
      icon: Sparkles,
      title: 'Spin Complete!',
      subtitle: 'Check your reward below',
      gradient: 'from-violet-500 to-purple-500',
      bgGlow: 'bg-violet-500/20',
      iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500',
    },
    theme: {
      icon: Palette,
      title: 'Theme Applied!',
      subtitle: 'Your storefront has a fresh new look',
      gradient: 'from-emerald-500 to-teal-500',
      bgGlow: 'bg-emerald-500/20',
      iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    },
    gift: {
      icon: Gift,
      title: 'Purchase Complete!',
      subtitle: 'Your purchase was successful',
      gradient: 'from-pink-500 to-rose-500',
      bgGlow: 'bg-pink-500/20',
      iconBg: 'bg-gradient-to-br from-pink-400 to-rose-500',
    },
  };

  const config = configs[type] || configs.gift;
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none" data-testid="shop-purchase-confirmation">
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Confetti Animation */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-10px',
                    width: `${6 + Math.random() * 6}px`,
                    height: `${6 + Math.random() * 6}px`,
                    backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    animationDelay: `${Math.random() * 1.5}s`,
                    animationDuration: `${1.5 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header gradient */}
          <div className={`relative bg-gradient-to-br ${config.gradient} pt-10 pb-14 px-6 text-center`}>
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[-50px] left-[20%] w-[200px] h-[200px] bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-[-30px] right-[10%] w-[150px] h-[150px] bg-white/10 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <div className={`w-20 h-20 mx-auto rounded-2xl ${config.iconBg} flex items-center justify-center shadow-xl mb-4 animate-bounce-gentle`}>
                <Icon className="h-10 w-10 text-white" />
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <CheckCircle2 className="h-5 w-5 text-white/90" />
                <span className="text-white/90 text-sm font-medium">Success</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{config.title}</h2>
              <p className="text-white/70 text-sm mt-1">{config.subtitle}</p>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-5 -mt-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              {details.productName && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Product</span>
                  <span className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{details.productName}</span>
                </div>
              )}
              {details.themeName && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Theme</span>
                  <span className="text-sm font-semibold text-slate-800">{details.themeName}</span>
                </div>
              )}
              {details.amount !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Amount</span>
                  <span className="text-sm font-bold text-emerald-600">${parseFloat(details.amount).toFixed(2)}</span>
                </div>
              )}
              {details.duration && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Duration</span>
                  <span className="text-sm font-semibold text-slate-800">{details.duration}</span>
                </div>
              )}
              {details.reward && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Reward</span>
                  <span className="text-sm font-bold text-violet-600">{details.reward}</span>
                </div>
              )}
              {details.message && (
                <div className="pt-2">
                  <p className="text-xs text-slate-600 text-center">{details.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="px-6 pb-6">
            <Button
              onClick={onClose}
              className={`w-full h-11 rounded-xl bg-gradient-to-r ${config.gradient} text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg`}
              data-testid="confirmation-close-btn"
            >
              Continue
            </Button>
          </div>
        </div>

        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
          }
          .animate-confetti {
            animation: confetti-fall 2.5s ease-out forwards;
          }
          @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default ShopPurchaseConfirmation;
