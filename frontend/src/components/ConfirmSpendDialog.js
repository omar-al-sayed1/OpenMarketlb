import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, AlertTriangle, ArrowRight, X, Loader2 } from 'lucide-react';

const ConfirmSpendDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Payment',
  description = 'This action will deduct from your wallet balance.',
  icon: Icon = Wallet,
  iconGradient = 'from-violet-500 to-indigo-500',
  walletBalance = 0,
  spendAmount = 0,
  itemName = '',
  confirmLabel = 'Confirm & Pay',
  confirmGradient = 'from-violet-600 to-indigo-600',
  loading = false,
}) => {
  const balanceAfter = walletBalance - spendAmount;
  const canAfford = walletBalance >= spendAmount;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-0 bg-transparent shadow-none" data-testid="confirm-spend-dialog">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className={`relative bg-gradient-to-br ${iconGradient} pt-8 pb-10 px-6 text-center`}>
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[-40px] left-[25%] w-[160px] h-[160px] bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-[-20px] right-[15%] w-[120px] h-[120px] bg-white/10 rounded-full blur-2xl" />
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative">
              <div className={`w-16 h-16 mx-auto rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl mb-3`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
              <p className="text-white/70 text-sm mt-1">{description}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="px-6 py-5 -mt-5">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              {itemName && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Item</span>
                  <span className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">{itemName}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  Current Balance
                </span>
                <span className="text-sm font-bold text-emerald-600">${walletBalance.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs font-bold">−</span>
                  Amount to Spend
                </span>
                <span className="text-sm font-bold text-red-500">−${spendAmount.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4 text-blue-500" />
                    Balance After
                  </span>
                  <span className={`text-base font-extrabold ${balanceAfter >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ${balanceAfter.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {!canAfford && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 font-medium">Insufficient wallet balance. Please add funds first.</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-6 flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-semibold"
              data-testid="confirm-spend-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!canAfford || loading}
              className={`flex-1 h-11 rounded-xl bg-gradient-to-r ${confirmGradient} text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50`}
              data-testid="confirm-spend-confirm"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmSpendDialog;
