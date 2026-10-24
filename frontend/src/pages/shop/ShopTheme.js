import React, { useState, useEffect } from 'react';
import { Palette, Lock, Unlock, Check, Sparkles, DollarSign, Loader2, Crown, ShoppingBag, Eye, X } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { getThemedCard } from '../../components/ThemedProductCards';
import { getThemeConfig } from '../../lib/themes';
import ShopPurchaseConfirmation from '../../components/ShopPurchaseConfirmation';
import ConfirmSpendDialog from '../../components/ConfirmSpendDialog';

export default function ShopTheme() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [applying, setApplying] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [accentColor, setAccentColor] = useState('');
  const [shopProducts, setShopProducts] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState({});
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);
  const [pendingPurchaseTheme, setPendingPurchaseTheme] = useState(null);
  const [themeSalePercent, setThemeSalePercent] = useState(0);

  useEffect(() => { fetchThemes(); fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await api.shop.getProducts();
      setShopProducts((data || []).slice(0, 6));
    } catch {}
  };

  const fetchThemes = async () => {
    try {
      const { data: result } = await api.shop.getStorefrontThemes();
      setData(result);
      setAccentColor(result.theme_accent || '');
      // Fetch theme sale percent
      try {
        const { data: saleData } = await api.themeSale.get();
        setThemeSalePercent(saleData.theme_sale_percent || 0);
      } catch {}
    } catch (err) { toast.error('Failed to load themes'); }
    finally { setLoading(false); }
  };

  const handlePurchase = async (themeKey) => {
    const theme = data.themes?.find(t => t.key === themeKey);
    // If free unlocks or spin-wheel free-theme credits available, cost is $0
    const basePrice = theme?.price_usd || theme?.price || 0;
    const discountedPrice = themeSalePercent > 0 ? Math.round(basePrice * (1 - themeSalePercent / 100) * 100) / 100 : basePrice;
    const hasFree = (free_unlocks_remaining > 0) || ((data?.free_theme_credits || 0) > 0);
    const cost = hasFree ? 0 : discountedPrice;
    // Show confirmation dialog instead of window.confirm
    setPendingPurchaseTheme({ key: themeKey, name: theme?.name || themeKey, cost });
    setConfirmSpendOpen(true);
  };

  const executePurchase = async () => {
    if (!pendingPurchaseTheme) return;
    const { key: themeKey, name, cost } = pendingPurchaseTheme;
    setConfirmSpendOpen(false);
    setPurchasing(themeKey);
    try {
      const { data: result } = await api.shop.purchaseTheme({ theme_key: themeKey });
      // Auto-apply the theme after purchase
      try {
        await api.shop.applyTheme({ theme_key: themeKey, theme_accent: accentColor });
      } catch (applyErr) { /* silently fail apply, purchase was successful */ }
      setConfirmDetails({
        themeName: name,
        amount: cost,
        message: result.message ? `${result.message} Theme has been applied automatically!` : 'Theme purchased and applied successfully!'
      });
      setConfirmOpen(true);
      fetchThemes();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to purchase theme'); }
    finally { setPurchasing(null); setPendingPurchaseTheme(null); }
  };

  const handleApply = async (themeKey) => {
    setApplying(themeKey);
    try {
      await api.shop.applyTheme({ theme_key: themeKey, theme_accent: accentColor });
      setConfirmDetails({
        themeName: themeKey,
        message: `Theme "${themeKey}" applied to your storefront!`
      });
      setConfirmOpen(true);
      fetchThemes();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to apply theme'); }
    finally { setApplying(null); }
  };

  if (loading || !data) return (
    <ShopLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    </ShopLayout>
  );

  const { themes, current_theme, free_unlocks_remaining, free_theme_credits = 0, wallet_balance } = data;
  const is_pro = true; // tier system removed — all shops have full theme access

  return (
    <ShopLayout>
      <div className="p-4 lg:p-8 space-y-6" data-testid="shop-theme-page">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-2.5">
            <Palette className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Storefront Theme</h1>
            <p className="text-slate-500 text-sm">Customize how your public shop page looks to customers</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-900">Current: <strong>{themes.find(t => t.key === current_theme)?.name || 'Classic Grid'}</strong></span>
            </div>
            {is_pro && (
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-violet-800">
                  {free_unlocks_remaining > 0 ? `${free_unlocks_remaining} free unlock available!` : 'All free unlocks used'}
                </span>
              </div>
            )}
            {free_theme_credits > 0 && (
              <div className="flex items-center gap-2 bg-fuchsia-100 px-3 py-1 rounded-full" data-testid="free-theme-credits-badge">
                <Sparkles className="h-4 w-4 text-fuchsia-600" />
                <span className="text-sm font-semibold text-fuchsia-700">{free_theme_credits} free theme from Spin Wheel!</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-slate-600">Wallet: ${wallet_balance?.toFixed(2)}</span>
            </div>
            {themeSalePercent > 0 && (
              <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full">
                <span className="text-sm font-bold text-red-700">{themeSalePercent}% OFF all themes!</span>
              </div>
            )}
          </div>
        </div>

        {/* Accent Color */}
        {is_pro && (
          <div className="flex items-center gap-3 bg-white rounded-lg border p-3">
            <label className="text-sm font-medium text-slate-700">Accent Color:</label>
            <Input
              type="color"
              value={accentColor || '#b4f56a'}
              onChange={e => setAccentColor(e.target.value)}
              className="w-10 h-8 p-0.5 cursor-pointer"
            />
            <Input
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              placeholder="#b4f56a"
              className="w-28 h-8 text-sm"
            />
          </div>
        )}

        {/* Theme Grid - sorted by price high to low */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...themes].sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0)).map((theme) => {
            const isCurrent = theme.key === current_theme;
            const isLocked = !theme.is_unlocked && !theme.is_default;
            const canPurchase = isLocked; // Both starter and pro can purchase
            const canApply = theme.is_unlocked || theme.is_default;
            const isProOnly = theme.pro_only && !is_pro;
            const basePrice = theme.price_usd || 0;
            const discountedPrice = themeSalePercent > 0 && basePrice > 0 ? Math.round(basePrice * (1 - themeSalePercent / 100) * 100) / 100 : basePrice;
            const hasDiscount = themeSalePercent > 0 && basePrice > 0;

            return (
              <Card
                key={theme.key}
                className={`overflow-hidden border-2 transition-all hover:shadow-lg cursor-pointer ${
                  isCurrent ? 'border-violet-500 shadow-lg ring-2 ring-violet-200' :
                  isLocked ? 'border-slate-200 opacity-80' : 'border-slate-200 hover:border-violet-300'
                }`}
                data-testid={`shop-theme-${theme.key}`}
              >
                {/* Preview Header */}
                <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${theme.preview_color}33, ${theme.preview_color}66)` }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-xl shadow-md flex items-center justify-center" style={{ backgroundColor: theme.preview_color }}>
                      <Palette className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  {isCurrent && (
                    <Badge className="absolute top-2 left-2 bg-violet-500 text-white text-[10px]">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                  {isLocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-800/60 flex items-center justify-center">
                      <Lock className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {!isLocked && !isCurrent && theme.is_unlocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500/80 flex items-center justify-center">
                      <Unlock className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                <CardContent className="p-3">
                  <h3 className="font-bold text-sm text-slate-900">{theme.name}</h3>
                  <p className="text-[11px] text-slate-400 mb-2 line-clamp-2">{theme.description}</p>
                  
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">{theme.best_for}</Badge>
                    {basePrice > 0 && isLocked && hasDiscount && (
                      <>
                        <Badge variant="secondary" className="text-[9px] line-through opacity-60">${basePrice}</Badge>
                        <Badge className="text-[9px] bg-red-100 text-red-700">${discountedPrice} ({themeSalePercent}% OFF)</Badge>
                      </>
                    )}
                    {basePrice > 0 && isLocked && !hasDiscount && (
                      <Badge variant="secondary" className="text-[9px]">${basePrice}</Badge>
                    )}
                    {free_unlocks_remaining > 0 && isLocked && is_pro && (
                      <Badge className="text-[9px] bg-amber-100 text-amber-700">FREE</Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); setPreviewTheme(theme.key); }}
                      data-testid={`preview-${theme.key}`}
                    >
                      <Eye className="h-3 w-3 mr-0.5" /> Preview
                    </Button>
                    <div className="flex-1">
                    {isCurrent ? (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                        <Check className="h-3 w-3 mr-1" /> Active
                      </Button>
                    ) : canApply ? (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => handleApply(theme.key)}
                        disabled={applying === theme.key}
                        data-testid={`apply-${theme.key}`}
                      >
                        {applying === theme.key ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Palette className="h-3 w-3 mr-1" />}
                        Apply
                      </Button>
                    ) : isProOnly ? (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs text-amber-700 border-amber-300" disabled>
                        <Crown className="h-3 w-3 mr-1" /> Pro Only
                      </Button>
                    ) : canPurchase ? (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => handlePurchase(theme.key)}
                        disabled={purchasing === theme.key}
                        data-testid={`unlock-${theme.key}`}
                      >
                        {purchasing === theme.key ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Unlock className="h-3 w-3 mr-1" />}
                        {free_unlocks_remaining > 0 || free_theme_credits > 0 ? 'Free' : `$${hasDiscount ? discountedPrice : basePrice}`}
                      </Button>
                    ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Theme Preview Dialog */}
        <Dialog open={!!previewTheme} onOpenChange={(open) => { if (!open) setPreviewTheme(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0" data-testid="theme-preview-dialog">
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-violet-600" />
                Preview: {themes.find(t => t.key === previewTheme)?.name || previewTheme}
              </DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewTheme(null)}><X className="h-4 w-4" /></Button>
            </div>
            {previewTheme && (() => {
              const PreviewCard = getThemedCard(previewTheme);
              const themeConf = getThemeConfig(previewTheme);
              const previewProducts = shopProducts.length > 0 ? shopProducts : [
                { id: 'demo-1', name: 'Sample Product 1', price: 49.99, discount_price: 39.99, images: ['https://placehold.co/400x400/e2e8f0/64748b?text=Product+1'], average_rating: 4.5, description: 'A great product for your store.', stock: 10 },
                { id: 'demo-2', name: 'Sample Product 2', price: 89.00, images: ['https://placehold.co/400x400/dbeafe/3b82f6?text=Product+2'], average_rating: 4.8, description: 'Premium quality item.', stock: 5 },
                { id: 'demo-3', name: 'Sample Product 3', price: 129.99, discount_price: 99.99, images: ['https://placehold.co/400x400/fef3c7/d97706?text=Product+3'], average_rating: 4.2, description: 'Best seller of the month.', stock: 20 },
                { id: 'demo-4', name: 'Sample Product 4', price: 29.99, images: ['https://placehold.co/400x400/dcfce7/16a34a?text=Product+4'], average_rating: 4.6, description: 'Affordable and reliable.', stock: 15 },
              ];
              return (
                <div className={`p-6 ${themeConf.bodyBg || 'bg-slate-50'} min-h-[400px]`}>
                  {/* Mini hero preview */}
                  <div className={`rounded-xl overflow-hidden mb-6 bg-gradient-to-r ${themeConf.heroGradient} p-6`}>
                    <h2 className="text-xl font-bold text-white">Your Store Name</h2>
                    <p className="text-sm text-white/60 mt-1">Preview of how your products will look</p>
                  </div>
                  {/* Products grid preview */}
                  <div className={`grid ${themeConf.productGridCols || 'grid-cols-2'} ${themeConf.gridGap || 'gap-4'}`}>
                    {previewProducts.map((product) => (
                      <div key={product.id} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }} className="cursor-default">
                        <PreviewCard product={product} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
        
        {/* Purchase Confirmation Popup */}
        <ShopPurchaseConfirmation
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          type="theme"
          details={confirmDetails}
        />

        {/* Confirm Spend Dialog for theme purchase */}
        <ConfirmSpendDialog
          open={confirmSpendOpen}
          onClose={() => { setConfirmSpendOpen(false); setPendingPurchaseTheme(null); }}
          onConfirm={executePurchase}
          title="Confirm Theme Purchase"
          description="This theme will be unlocked for your storefront"
          icon={Palette}
          iconGradient="from-emerald-500 to-teal-500"
          walletBalance={wallet_balance || 0}
          spendAmount={pendingPurchaseTheme?.cost || 0}
          itemName={pendingPurchaseTheme?.name || ''}
          confirmLabel="Purchase Theme"
          confirmGradient="from-emerald-500 to-teal-500"
          loading={!!purchasing}
        />
      </div>
    </ShopLayout>
  );
}
