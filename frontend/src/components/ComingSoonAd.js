import React from 'react';
import BrandName from './BrandName';
import { Sparkles, Store, ArrowRight, Star, Zap, Gift, TrendingUp } from 'lucide-react';

const ComingSoonAd = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-5 text-white shadow-xl" data-testid="coming-soon-ad-compact">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-20 h-20 bg-white rounded-full blur-xl" />
          <div className="absolute bottom-4 left-4 w-16 h-16 bg-pink-400 rounded-full blur-xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200">Coming Soon</span>
          </div>
          <h3 className="text-lg font-bold leading-tight">New Features for Shops</h3>
          <p className="text-violet-200 text-xs mt-1">Exciting updates are on the way. Stay tuned!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-2xl" data-testid="coming-soon-ad">
      {/* Background gradient matching website theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-400/10 rounded-full blur-3xl" />
        
        {/* Floating shapes */}
        <div className="absolute top-8 right-16 w-3 h-3 bg-amber-400 rounded-full opacity-50 animate-pulse" style={{animationDelay: '0s'}} />
        <div className="absolute top-20 right-32 w-2 h-2 bg-pink-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '0.5s'}} />
        <div className="absolute bottom-12 left-20 w-4 h-4 bg-cyan-400 rounded-full opacity-30 animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute bottom-24 right-24 w-2.5 h-2.5 bg-emerald-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '1.5s'}} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
      </div>

      {/* Content */}
      <div className="relative px-8 py-10 sm:px-12 sm:py-14 text-white">
        <div className="max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Coming Soon</span>
          </div>

          {/* Main heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            <BrandName showLb={false} />
            <sup className="text-purple-400 text-lg ml-1">lb</sup>
            <br />
            <span className="text-violet-200 text-2xl sm:text-3xl">for Shops</span>
          </h2>

          <p className="text-violet-200 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
            Your next-level marketplace experience is almost here. Powerful tools, beautiful storefronts, and more customers await.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { icon: Store, label: 'Custom Storefront' },
              { icon: TrendingUp, label: 'Smart Analytics' },
              { icon: Gift, label: 'Loyalty Rewards' },
              { icon: Zap, label: 'Instant Setup' },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
                <feat.icon className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs font-medium">{feat.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-violet-700 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
            Get Early Access
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Decorative side stars */}
        <div className="hidden sm:block absolute top-8 right-8">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 text-amber-400" fill="currentColor" style={{ opacity: 0.4 + i * 0.15 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonAd;
