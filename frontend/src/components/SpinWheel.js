import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Wallet, Crown, RotateCcw, Gift, Zap, Star, Megaphone, Palette } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ConfirmSpendDialog from './ConfirmSpendDialog';

const SEGMENT_COLORS = [
  ['#5df6fc', '#3bf4fb'], // violet
  ['#EC4899', '#DB2777'], // pink
  ['#10B981', '#059669'], // emerald
  ['#F59E0B', '#D97706'], // amber
  ['#3B82F6', '#2563EB'], // blue
  ['#EF4444', '#DC2626'], // red
  ['#06B6D4', '#0891B2'], // cyan
  ['#F97316', '#EA580C'], // orange
];

const SpinWheel = ({ open, onOpenChange, spinInfo, onSpinComplete }) => {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [useFreeSpin, setUseFreeSpin] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const wheelRef = useRef(null);

  const outcomes = (spinInfo?.outcomes || []).filter(o => o.is_active !== false);
  const freeSpins = spinInfo?.free_spins || 0;
  const spinCost = spinInfo?.spin_cost || 7;
  const segmentCount = outcomes.length || 6;
  const segmentAngle = 360 / segmentCount;

  useEffect(() => {
    if (freeSpins > 0) setUseFreeSpin(true);
    else setUseFreeSpin(false);
  }, [freeSpins]);

  useEffect(() => {
    if (open) { setShowResult(false); setResult(null); setCurrentRotation(0); setShowConfetti(false); setConfirmSpendOpen(false); }
  }, [open]);

  // Fetch wallet balance when opening
  useEffect(() => {
    if (open) {
      (async () => {
        try {
          const { data } = await api.shopTier.getInfo();
          setWalletBalance(data?.wallet_balance || 0);
        } catch (e) {}
      })();
    }
  }, [open]);

  const handleSpin = async () => {
    if (spinning) return;
    
    // If using a paid spin, show confirmation dialog
    const usingFree = useFreeSpin && freeSpins > 0;
    if (!usingFree) {
      setConfirmSpendOpen(true);
      return;
    }
    
    executeSpin(true);
  };

  const executeSpin = async (usingFree) => {
    setSpinning(true);
    setShowResult(false);
    setResult(null);
    setShowConfetti(false);
    setConfirmSpendOpen(false);

    try {
      const { data } = await api.shopSpin.play({ use_free_spin: usingFree });
      const outcomeIdx = outcomes.findIndex(o => o.key === data.outcome.key);
      const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
      const targetAngle = outcomeIdx * segmentAngle + segmentAngle / 2;
      const finalRotation = currentRotation + fullRotations + (360 - targetAngle);
      setCurrentRotation(finalRotation);

      setTimeout(() => {
        setResult(data);
        setShowResult(true);
        setSpinning(false);
        if (data.outcome.key !== 'try_again') setShowConfetti(true);
        if (onSpinComplete) onSpinComplete(data);
        window.dispatchEvent(new Event('wallet-updated'));
        // Reset wheel to default after showing result
        setTimeout(() => {
          setCurrentRotation(0);
        }, 2000);
      }, 5000);
    } catch (error) {
      setSpinning(false);
      toast.error(error.response?.data?.detail || 'Failed to spin');
    }
  };

  const getResultIcon = (key) => {
    switch (key) {
      case 'free_sponsors_4': return <Megaphone className="h-10 w-10 text-amber-500" />;
      case 'free_sponsor_10_days': return <Megaphone className="h-10 w-10 text-blue-500" />;
      case 'free_subscription': return <Crown className="h-10 w-10 text-amber-500" />;
      case 'subscription_extension': return <Crown className="h-10 w-10 text-blue-500" />;
      case 'wallet_credit_small': case 'wallet_credit_large': return <Wallet className="h-10 w-10 text-emerald-500" />;
      case 'free_theme': return <Palette className="h-10 w-10 text-fuchsia-500" />;
      case 'another_spin': return <Zap className="h-10 w-10 text-violet-500" />;
      case 'try_again': return <RotateCcw className="h-10 w-10 text-slate-400" />;
      default: return <Gift className="h-10 w-10 text-pink-500" />;
    }
  };

  const getResultColor = (key) => {
    switch (key) {
      case 'free_sponsors_4': return 'from-amber-400 to-orange-500';
      case 'free_sponsor_10_days': return 'from-blue-400 to-indigo-500';
      case 'free_subscription': return 'from-amber-400 to-orange-500';
      case 'subscription_extension': return 'from-blue-400 to-indigo-500';
      case 'wallet_credit_small': case 'wallet_credit_large': return 'from-emerald-400 to-teal-500';
      case 'free_theme': return 'from-fuchsia-400 to-purple-500';
      case 'another_spin': return 'from-violet-400 to-purple-500';
      case 'try_again': return 'from-slate-400 to-slate-500';
      default: return 'from-pink-400 to-rose-500';
    }
  };

  const getResultMessage = (data) => {
    if (!data) return '';
    const effects = data.applied_effects;
    switch (data.outcome.key) {
      case 'free_sponsors_4': return `${effects?.count || 4} free product sponsor credits added! Use them to boost your products for free.`;
      case 'free_sponsor_10_days': return `${effects?.count || 1} free 10-day sponsor credit added! Boost any product for 10 days at no cost.`;
      case 'free_subscription': return `${effects?.days_added || 30} days added to your subscription!`;
      case 'subscription_extension': return `${effects?.days_added || 15} days added to your subscription!`;
      case 'wallet_credit_small': case 'wallet_credit_large': return `$${effects?.amount || 0} added to your wallet!`;
      case 'free_theme':
        if (effects?.theme_name) return `You won the "${effects.theme_name}" storefront theme! It's been unlocked and applied to your shop.`;
        return 'You won a free storefront theme! You already own every theme, so we added a free theme credit for you.';
      case 'another_spin': return 'You won a free spin! Spin again!';
      case 'try_again': return 'Better luck next time!';
      default: return data.outcome.label;
    }
  };

  // Build SVG wheel with improved text rendering
  const renderWheel = () => {
    if (outcomes.length === 0) return null;
    const size = 320;
    const center = size / 2;
    const radius = center - 8;
    const segments = [];

    outcomes.forEach((outcome, i) => {
      const startAngleDeg = i * segmentAngle - 90;
      const endAngleDeg = startAngleDeg + segmentAngle;
      const startRad = (startAngleDeg * Math.PI) / 180;
      const endRad = (endAngleDeg * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArc = segmentAngle > 180 ? 1 : 0;
      const d = `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`;

      const midAngleRad = ((startAngleDeg + endAngleDeg) / 2 * Math.PI) / 180;
      const textRadius = radius * 0.62;
      const textX = center + textRadius * Math.cos(midAngleRad);
      const textY = center + textRadius * Math.sin(midAngleRad);
      const textRotation = (startAngleDeg + endAngleDeg) / 2;

      const [color1, color2] = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const gradId = `seg-grad-${i}`;

      // Split label into lines if long
      const label = outcome.label || '';
      const words = label.split(' ');
      let lines = [];
      if (words.length <= 2 || label.length <= 12) {
        lines = [label];
      } else {
        const mid = Math.ceil(words.length / 2);
        lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }

      segments.push(
        <g key={i}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <path d={d} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          {/* Decorative inner line */}
          <path d={d} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" 
            transform={`scale(0.92) translate(${center * 0.08}, ${center * 0.08})`} />
          {lines.map((line, li) => (
            <text
              key={li}
              x={textX}
              y={textY + (li - (lines.length - 1) / 2) * 11}
              fill="white"
              fontSize={lines.length > 1 ? "9" : "10"}
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${textRotation}, ${textX}, ${textY + (li - (lines.length - 1) / 2) * 11})`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', letterSpacing: '0.02em' }}
            >
              {line.length > 14 ? line.substring(0, 14) + '..' : line}
            </text>
          ))}
        </g>
      );
    });

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-xl">
        {/* Outer ring */}
        <circle cx={center} cy={center} r={radius + 4} fill="none" stroke="url(#outerRing)" strokeWidth="6" />
        <defs>
          <linearGradient id="outerRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="50%" stopColor="#daffab" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
          {/* Tick marks pattern */}
          {Array.from({ length: segmentCount * 2 }, (_, i) => {
            const angle = (i * 360 / (segmentCount * 2) - 90) * Math.PI / 180;
            const x1t = center + (radius + 1) * Math.cos(angle);
            const y1t = center + (radius + 1) * Math.sin(angle);
            const x2t = center + (radius + 6) * Math.cos(angle);
            const y2t = center + (radius + 6) * Math.sin(angle);
            return <line key={`tick-${i}`} x1={x1t} y1={y1t} x2={x2t} y2={y2t} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />;
          })}
        </defs>
        {segments}
        {/* Center hub */}
        <circle cx={center} cy={center} r="32" fill="url(#centerGrad)" stroke="white" strokeWidth="3" />
        <defs>
          <radialGradient id="centerGrad">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#213510" />
          </radialGradient>
        </defs>
        <text x={center} y={center - 4} fill="white" fontSize="8" fontWeight="600" textAnchor="middle" dominantBaseline="middle" style={{ letterSpacing: '0.1em' }}>LUCKY</text>
        <text x={center} y={center + 7} fill="#C084FC" fontSize="10" fontWeight="800" textAnchor="middle" dominantBaseline="middle">SPIN</text>
      </svg>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 border-0 bg-transparent shadow-none">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
        {!showResult ? (
          <>
            {/* Header with animated gradient */}
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2" />
              </div>
              <div className="relative">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Star className="h-4 w-4 text-amber-300" />
                  <h2 className="text-lg font-bold tracking-wide">Lucky Spin Wheel</h2>
                  <Star className="h-4 w-4 text-amber-300" />
                </div>
                <p className="text-violet-200 text-xs">
                  {freeSpins > 0 ? `${freeSpins} free spin${freeSpins > 1 ? 's' : ''} available!` : `$${spinCost} per spin from wallet`}
                </p>
              </div>
            </div>

            {/* Wheel Area */}
            <div className="relative flex items-center justify-center py-5 px-4 bg-gradient-to-b from-violet-50/80 to-white">
              {/* Pointer */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <div className="relative">
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderTop: '24px solid #EF4444',
                    filter: 'drop-shadow(0 3px 6px rgba(239,68,68,0.5))'
                  }} />
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              {/* Wheel */}
              <div
                ref={wheelRef}
                className="relative"
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                  transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                }}
              >
                {renderWheel()}
              </div>

              {/* Glow effect while spinning */}
              {spinning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[280px] h-[280px] bg-violet-400/20 rounded-full animate-pulse blur-xl" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 pt-2 space-y-3">
              {freeSpins > 0 && (
                <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <input type="checkbox" checked={useFreeSpin} onChange={(e) => setUseFreeSpin(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-emerald-800">Use free spin ({freeSpins} left)</span>
                </label>
              )}
              <Button
                onClick={handleSpin} disabled={spinning}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-violet-500/25"
                data-testid="spin-button"
              >
                {spinning ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Spinning...</>
                ) : (
                  <><Sparkles className="h-5 w-5 mr-2" /> {useFreeSpin && freeSpins > 0 ? 'Spin Free!' : `Spin for $${spinCost}`}</>
                )}
              </Button>
            </div>
          </>
        ) : result && (
          <div className="text-center relative">
            {/* Confetti effect */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: '-8px',
                      backgroundColor: ['#5df6fc', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'][i % 6],
                      animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-in forwards`,
                      animationDelay: `${Math.random() * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <div className={`bg-gradient-to-br ${getResultColor(result.outcome.key)} p-8 text-white relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-10">
                {[...Array(6)].map((_, i) => (
                  <Star key={i} className="absolute text-white" style={{
                    top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                    width: `${12 + Math.random() * 16}px`, opacity: 0.3 + Math.random() * 0.5,
                  }} />
                ))}
              </div>
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  {getResultIcon(result.outcome.key)}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {result.outcome.key === 'try_again' ? 'Try Again!' : 'Congratulations!'}
                </h2>
                <p className="text-lg font-semibold opacity-90">{result.outcome.label}</p>
              </div>
            </div>
            <div className="p-5 space-y-4 relative">
              <p className="text-slate-600 text-sm">{getResultMessage(result)}</p>
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Spin Type</span><span className="font-medium capitalize">{result.spin_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Free Spins Left</span><span className="font-medium">{result.free_spins_remaining}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Wallet Balance</span><span className="font-medium text-emerald-600">${result.wallet_balance?.toFixed(2)}</span></div>
              </div>
              {result.outcome.key === 'free_theme' && result.applied_effects?.theme_key && (
                <Button
                  onClick={() => { onOpenChange(false); navigate('/shop/theme'); }}
                  className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700"
                  data-testid="view-theme-btn"
                >
                  <Palette className="h-4 w-4 mr-1.5" /> View in Storefront Theme
                </Button>
              )}
              <div className="flex gap-2">
                {(result.outcome.key === 'try_again' || result.outcome.key === 'another_spin') && (
                  <Button onClick={() => { setShowResult(false); setResult(null); setShowConfetti(false); }}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="spin-again-btn">
                    <RotateCcw className="h-4 w-4 mr-1" /> Spin Again
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Close</Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </Dialog>

    {/* Confirm Spend Dialog for paid spins */}
    <ConfirmSpendDialog
      open={confirmSpendOpen}
      onClose={() => setConfirmSpendOpen(false)}
      onConfirm={() => executeSpin(false)}
      title="Confirm Spin Payment"
      description="This will be deducted from your wallet balance"
      icon={Sparkles}
      iconGradient="from-violet-500 to-purple-500"
      walletBalance={walletBalance}
      spendAmount={spinCost}
      itemName="Lucky Spin Wheel"
      confirmLabel="Spin Now"
      confirmGradient="from-violet-600 to-indigo-600"
      loading={spinning}
    />
    </>
  );
};

export default SpinWheel;
