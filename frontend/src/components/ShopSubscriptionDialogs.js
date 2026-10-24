import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, Sparkles, Wallet, Gift, Loader2, PartyPopper } from 'lucide-react';

// Fallback so subscription benefits always render even if the admin-configured
// list hasn't loaded yet (e.g. the pricing fetch failed or is still in flight).
const FALLBACK_FEATURES = [
  '1 free Lucky Spin every month',
  '2 free product sponsor credits every month',
  'Lower commission on your sales',
  'Full storefront theme customisation',
  'Marketing & boost tools + advanced analytics',
  'Priority customer support',
];

const FeatureList = ({ features = [], tone = 'emerald' }) => {
  const list = (Array.isArray(features) && features.length > 0) ? features : FALLBACK_FEATURES;
  const dot = tone === 'white' ? 'bg-white/25' : 'bg-emerald-100';
  const check = tone === 'white' ? 'text-white' : 'text-emerald-600';
  const text = tone === 'white' ? 'text-white/90' : 'text-slate-700';
  return (
    <div className="space-y-2">
      {list.map((f, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <div className={`mt-0.5 p-0.5 rounded-full flex-shrink-0 ${dot}`}>
            <Check className={`h-3 w-3 ${check}`} strokeWidth={3} />
          </div>
          <span className={text}>{f}</span>
        </div>
      ))}
    </div>
  );
};

/* Centered confirmation before a shop subscribes from the dashboard. */
export const SubscribeConfirmDialog = ({ open, onOpenChange, planName = 'Subscription', price = 0, walletBalance = 0, features = [], onConfirm, loading }) => {
  const enough = walletBalance >= price;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 border-0">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Crown className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-extrabold">Subscribe to {planName}?</h2>
            <p className="text-white/80 text-sm mt-1">${price.toFixed(2)}/month — paid from your wallet</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What you'll unlock</p>
            <FeatureList features={features} />
          </div>
          <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${enough ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Wallet balance</span>
            <span className="font-bold">${walletBalance.toFixed(2)}</span>
          </div>
          {!enough && (
            <p className="text-xs text-red-600 -mt-2">You need ${price.toFixed(2)} to subscribe. Add funds to your wallet first.</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancel</Button>
            <Button onClick={onConfirm} disabled={loading || !enough} className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" data-testid="confirm-subscribe-btn">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Crown className="h-4 w-4 mr-1.5" />}
              Confirm & Subscribe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* Shown right after a successful subscribe — welcome + benefits. */
export const SubscribedWelcomeDialog = ({ open, onOpenChange, planName = 'Subscription', features = [] }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md overflow-hidden p-0 border-0">
      <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-7 text-white text-center relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold">You're subscribed! 🎉</h2>
          <p className="text-white/85 text-sm mt-1">Welcome to {planName}. Here's everything you now get:</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <FeatureList features={features} />
        <Button onClick={() => onOpenChange(false)} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" data-testid="welcome-benefits-close">
          <Sparkles className="h-4 w-4 mr-1.5" /> Start selling
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

/* First-login popup. Subscribed vs. non-subscribed variant. */
export const FirstLoginWelcomeDialog = ({ open, onOpenChange, data }) => {
  if (!data) return null;
  const subscribed = !!data.is_subscribed;
  const bonus = data.welcome_bonus || {};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 border-0">
        <div className={`p-7 text-white text-center relative overflow-hidden ${subscribed ? 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700' : 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500'}`}>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {subscribed ? <Crown className="h-8 w-8" /> : <Gift className="h-8 w-8" />}
            </div>
            <h2 className="text-2xl font-extrabold">Welcome{data.shop_name ? `, ${data.shop_name}` : ''}! 👋</h2>
            <p className="text-white/85 text-sm mt-1">
              {subscribed ? 'Thanks for subscribing — here are your perks.' : "Here's a little gift to get you started."}
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Welcome gift (both variants received it on approval) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Your welcome gift</p>
            <div className="flex flex-wrap gap-2">
              {bonus.wallet > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                  <Wallet className="h-3 w-3" /> +${Number(bonus.wallet).toFixed(2)} wallet credit
                </span>
              )}
              {bonus.sponsors > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                  <Sparkles className="h-3 w-3" /> {bonus.sponsors} free product sponsor{bonus.sponsors > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {subscribed && (
            <div>
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" /> {data.plan_name || 'Subscription'} perks</p>
              <FeatureList features={data.features} />
            </div>
          )}

          <Button onClick={() => onOpenChange(false)} className={`w-full ${subscribed ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'}`} data-testid="first-login-welcome-close">
            Let's go
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
