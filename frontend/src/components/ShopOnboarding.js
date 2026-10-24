import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Shield, Settings, CheckCircle2, ChevronRight, Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '../lib/api';

const STEP_ICONS = {
  products: Package,
  profile: Settings,
  verification: Shield,
};

const STEP_COLORS = {
  products: { bg: 'from-blue-500 to-indigo-500', light: 'bg-blue-50 text-blue-700 border-blue-200', ring: 'ring-blue-200' },
  profile: { bg: 'from-amber-500 to-orange-500', light: 'bg-amber-50 text-amber-700 border-amber-200', ring: 'ring-amber-200' },
  verification: { bg: 'from-violet-500 to-purple-500', light: 'bg-violet-50 text-violet-700 border-violet-200', ring: 'ring-violet-200' },
};

export default function ShopOnboarding() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const { data: result } = await api.shop.getOnboardingStatus();
      setData(result);
    } catch (e) {
      // Silently fail (don't show wizard)
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Hide ONLY when all steps are complete. Onboarding cannot be dismissed manually.
  if (loading || !data || data.all_complete) return null;

  const nextStep = data.steps.find(s => !s.completed);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="shop-onboarding-wizard">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Setup Your Shop</h2>
            <p className="text-xs text-white/50">Complete these steps to start selling</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={data.progress} className="flex-1 h-2 bg-white/10" />
          <span className="text-xs font-bold text-emerald-400">{data.completed}/{data.total}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 sm:p-5 space-y-2.5">
        {data.steps.map((step) => {
          const Icon = STEP_ICONS[step.id] || Package;
          const colors = STEP_COLORS[step.id] || STEP_COLORS.products;
          const isNext = nextStep?.id === step.id;

          return (
            <button
              key={step.id}
              onClick={() => navigate(step.link)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                step.completed
                  ? 'bg-slate-50 border-slate-100 opacity-70'
                  : isNext
                  ? `${colors.light} border-2 shadow-sm ${colors.ring}`
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
              data-testid={`onboarding-step-${step.id}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                step.completed
                  ? 'bg-emerald-100'
                  : `bg-gradient-to-br ${colors.bg} shadow-sm`
              }`}>
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Icon className="h-4.5 w-4.5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${step.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {step.title}
                  {step.count !== undefined && step.count > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 no-underline">{step.count}</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{step.description}</p>
                {step.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 mt-1">
                    <Sparkles className="h-3 w-3" /> Under review
                  </span>
                )}
              </div>
              {!step.completed && (
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* CTA for next step */}
      {nextStep && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <Button
            onClick={() => navigate(nextStep.link)}
            className="w-full rounded-xl h-10 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-200"
            data-testid="onboarding-next-step-btn"
          >
            {nextStep.title} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
