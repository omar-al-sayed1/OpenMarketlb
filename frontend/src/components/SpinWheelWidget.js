import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import SpinWheel from './SpinWheel';
import { api } from '../lib/api';

const SpinWheelWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [spinInfo, setSpinInfo] = useState(null);
  const [tierInfo, setTierInfo] = useState(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spinRes, tierRes] = await Promise.allSettled([
          api.shopSpin.getInfo(),
          api.shopTier.getInfo()
        ]);
        if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
        if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data);
      } catch (e) {}
    };
    fetchData();
  }, []);

  const freeSpins = spinInfo?.free_spins || 0;

  return (
    <>
      {/* Floating Widget Button */}
      <div
        className="fixed right-4 bottom-5 z-40 lg:right-6 lg:bottom-6"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center"
          data-testid="spin-widget-fab"
        >
          {/* Pulse ring */}
          {freeSpins > 0 && (
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-30" />
          )}
          {/* Main button */}
          <span className={`relative flex items-center gap-2 rounded-full shadow-xl transition-all duration-300 ${
            hovered 
              ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 py-3' 
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 p-3'
          }`}>
            <Sparkles className={`text-white transition-transform duration-300 ${hovered ? 'h-5 w-5 animate-spin' : 'h-5 w-5'}`} style={{ animationDuration: '3s' }} />
            {hovered && (
              <span className="text-white text-sm font-semibold whitespace-nowrap">
                Spin & Win
              </span>
            )}
          </span>
          {/* Free spin badge */}
          {freeSpins > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              {freeSpins}
            </span>
          )}
        </button>
        {/* Tooltip for non-pro */}
        {false && hovered && (
          <div className="absolute bottom-full right-0 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
            <p className="text-[11px] text-amber-700 font-medium">Spin to win wallet credits!</p>
          </div>
        )}
      </div>

      {/* Spin Wheel Dialog */}
      <SpinWheel
        open={isOpen}
        onOpenChange={setIsOpen}
        spinInfo={spinInfo}
        onSpinComplete={() => {
          api.shopSpin.getInfo().then(r => setSpinInfo(r.data)).catch(() => {});
        }}
      />
    </>
  );
};

export default SpinWheelWidget;
