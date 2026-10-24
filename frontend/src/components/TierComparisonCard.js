import React from 'react';
import { Check, X, Crown, Zap, BarChart3, Download, Search, Megaphone, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TierComparisonCard = ({ tiers, currentTier, onUpgrade, billingCycle = 'monthly', onCycleChange }) => {
  if (!tiers) return null;
  
  const starter = tiers.starter || {};
  const pro = tiers.pro || {};
  
  const features = [
    { label: 'Product Listings', starter: `Up to ${starter.product_limit || 50}`, pro: 'Unlimited', icon: Package },
    { label: 'Commission Rate', starter: `${starter.commission_rate || 12}%`, pro: `${pro.commission_rate || 6}%`, icon: DollarIcon },
    { label: 'Analytics', starter: 'Basic', pro: 'Full (4 charts + export)', icon: BarChart3 },
    { label: 'Free Product Boosts', starter: '0/month', pro: `${pro.boosts_per_month || 3}/month`, icon: Megaphone },
    { label: 'Search Priority', starter: 'Normal', pro: 'Higher ranking', icon: Search },
    { label: 'Shop Badge', starter: <X className="w-4 h-4 text-gray-400" />, pro: <span className="text-amber-500 font-semibold">Pro Seller</span>, icon: Crown },
    { label: 'PDF Reports', starter: <X className="w-4 h-4 text-gray-400" />, pro: <Check className="w-4 h-4 text-green-500" />, icon: Download },
  ];

  return (
    <div data-testid="tier-comparison">
      {onCycleChange && (
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 rounded-full p-1 flex">
            <button
              onClick={() => onCycleChange('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => onCycleChange('yearly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'yearly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Yearly <span className="text-green-600 text-xs font-bold">Save 15%</span>
            </button>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Starter */}
        <div className={`rounded-2xl border-2 p-6 ${currentTier === 'starter' ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-violet-600" />
            <h3 className="text-lg font-bold">Starter</h3>
            {currentTier === 'starter' && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">Current</span>}
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold">${billingCycle === 'yearly' ? Math.round(starter.yearly_price / 12) : starter.monthly_price || 19}</span>
            <span className="text-gray-500">/mo</span>
            {billingCycle === 'yearly' && <p className="text-sm text-green-600 font-medium">Billed ${starter.yearly_price?.toFixed(0)}/year</p>}
          </div>
          <div className="mt-5 space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <f.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600">{f.label}:</span>
                <span className="ml-auto font-medium text-gray-900">{f.starter}</span>
              </div>
            ))}
          </div>
          {currentTier !== 'starter' && onUpgrade && (
            <Button variant="outline" className="w-full mt-6" onClick={() => onUpgrade('starter')} disabled>Current Plan</Button>
          )}
        </div>

        {/* Pro */}
        <div className={`rounded-2xl border-2 p-6 relative overflow-hidden ${currentTier === 'pro' ? 'border-amber-400 bg-amber-50/50' : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'}`}>
          <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">POPULAR</div>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold">Pro</h3>
            {currentTier === 'pro' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Current</span>}
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold">${billingCycle === 'yearly' ? Math.round(pro.yearly_price / 12) : pro.monthly_price || 39}</span>
            <span className="text-gray-500">/mo</span>
            {billingCycle === 'yearly' && <p className="text-sm text-green-600 font-medium">Billed ${pro.yearly_price?.toFixed(0)}/year</p>}
          </div>
          <div className="mt-5 space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <f.icon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-gray-600">{f.label}:</span>
                <span className="ml-auto font-medium text-gray-900">{f.pro}</span>
              </div>
            ))}
          </div>
          {currentTier !== 'pro' && onUpgrade && (
            <Button className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" onClick={() => onUpgrade('pro')}>
              Upgrade to Pro
            </Button>
          )}
          {currentTier === 'pro' && (
            <Button variant="outline" className="w-full mt-6 border-amber-300" disabled>Current Plan</Button>
          )}
        </div>
      </div>
    </div>
  );
};

const DollarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

export default TierComparisonCard;
