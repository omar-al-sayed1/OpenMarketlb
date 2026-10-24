import React, { useState, useEffect } from 'react';
import { Megaphone, Zap, Calendar, DollarSign, Gift, Rocket } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ConfirmSpendDialog from './ConfirmSpendDialog';

const BoostProductDialog = ({ open, onClose, product, onSuccess }) => {
  const [durationDays, setDurationDays] = useState(7);
  const [dailyPrice, setDailyPrice] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState('deduct_payout');
  const [boostCredits, setBoostCredits] = useState({ total: 0, remaining: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setDailyPrice(data.promotion_daily_price || 3);
      // Get boost credits and wallet balance
      try {
        const tierData = await api.shopTier.getInfo();
        setBoostCredits(tierData.data?.boost_credits || { total: 0, remaining: 0 });
        setWalletBalance(tierData.data?.wallet_balance || 0);
      } catch (e) {}
    } catch (err) {}
  };

  const totalCost = boostCredits.remaining > 0 ? 0 : dailyPrice * durationDays;
  const useFreeBoost = boostCredits.remaining > 0;

  const handleSubmit = async () => {
    // If using free boost, no need for confirmation dialog
    if (useFreeBoost) {
      executeBoost();
      return;
    }
    // Show confirmation dialog for paid boosts
    setConfirmSpendOpen(true);
  };

  const executeBoost = async () => {
    setSubmitting(true);
    setConfirmSpendOpen(false);
    try {
      await api.shopPromotions.create({
        product_id: product.id,
        duration_days: durationDays,
        payment_method: paymentMethod,
      });
      toast.success(useFreeBoost ? 'Free boost activated!' : 'Product boosted successfully!');
      window.dispatchEvent(new Event('wallet-updated'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to boost product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]" data-testid="boost-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            Boost Product
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{product?.name}</p>
            <p className="text-sm text-gray-500 mt-1">Your product will appear in sponsored sections across the platform</p>
          </div>

          {useFreeBoost && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <Gift className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Free Boost Available!</p>
                <p className="text-sm text-green-600">You have {boostCredits.remaining} free boost{boostCredits.remaining > 1 ? 's' : ''} this month (Pro perk)</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">Duration: {durationDays} days</label>
            <Slider
              value={[durationDays]}
              onValueChange={(v) => setDurationDays(v[0])}
              min={1}
              max={30}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 day</span><span>30 days</span>
            </div>
          </div>

          {!useFreeBoost && (
            <div className="bg-violet-50 rounded-xl p-3 text-center">
              <p className="text-sm text-violet-700 font-medium">Payment will be deducted from your wallet balance</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Daily Rate</span>
              <span className="font-semibold">${dailyPrice.toFixed(2)}/day</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-700">Duration</span>
              <span className="font-semibold">{durationDays} days</span>
            </div>
            <div className="border-t border-violet-200 my-3"></div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-lg font-bold text-violet-700">
                {useFreeBoost ? <span className="text-green-600">FREE</span> : `$${totalCost.toFixed(2)}`}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            data-testid="boost-submit-btn"
          >
            {submitting ? 'Boosting...' : useFreeBoost ? 'Use Free Boost' : `Boost for $${totalCost.toFixed(2)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirm Spend Dialog for paid boosts */}
    <ConfirmSpendDialog
      open={confirmSpendOpen}
      onClose={() => setConfirmSpendOpen(false)}
      onConfirm={executeBoost}
      title="Confirm Boost Payment"
      description="This will promote your product across the platform"
      icon={Rocket}
      iconGradient="from-amber-500 to-orange-500"
      walletBalance={walletBalance}
      spendAmount={totalCost}
      itemName={product?.name || ''}
      confirmLabel={`Boost for $${totalCost.toFixed(2)}`}
      confirmGradient="from-amber-500 to-orange-500"
      loading={submitting}
    />
    </>
  );
};

export default BoostProductDialog;
