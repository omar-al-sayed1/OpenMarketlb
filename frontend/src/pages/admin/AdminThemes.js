import React, { useState, useEffect } from 'react';
import { Palette, DollarSign, Save, Eye, EyeOff, RefreshCw, Crown, X, Check, Shield, ShoppingBag } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { getThemedCard } from '../../components/ThemedProductCards';
import { getThemeConfig } from '../../lib/themes';

export default function AdminThemes() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [shopUsage, setShopUsage] = useState({});
  const [salePercent, setSalePercent] = useState(0);
  const [saleLoading, setSaleLoading] = useState(false);

  useEffect(() => { fetchThemes(); fetchShopUsage(); fetchSalePercent(); }, []);

  const fetchThemes = async () => {
    try {
      const { data } = await api.admin.getStorefrontThemes();
      setThemes(data.themes || []);
    } catch (err) { toast.error('Failed to load themes'); }
    finally { setLoading(false); }
  };

  const fetchShopUsage = async () => {
    try {
      const { data } = await api.admin.getShops();
      const usage = {};
      (data.shops || data || []).forEach(shop => {
        const theme = shop.theme || 'classic';
        usage[theme] = (usage[theme] || 0) + 1;
      });
      setShopUsage(usage);
    } catch {}
  };

  const fetchSalePercent = async () => {
    try {
      const { data } = await api.themeSale.get();
      setSalePercent(data.theme_sale_percent || 0);
    } catch {}
  };

  const handleSaveSale = async () => {
    setSaleLoading(true);
    try {
      await api.admin.setThemeSalePercent(salePercent);
      toast.success(`Theme sale set to ${salePercent}%`);
    } catch (err) { toast.error('Failed to set sale'); }
    finally { setSaleLoading(false); }
  };

  const handleUpdateTheme = async (key, updates) => {
    setSaving(key);
    try {
      await api.admin.updateStorefrontTheme(key, updates);
      toast.success('Theme updated');
      fetchThemes();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    finally { setSaving(null); }
  };

  const demoProducts = [
    { id: 'demo-1', name: 'Classic Sneakers', price: 79.99, discount_price: 59.99, images: ['https://placehold.co/400x400/e2e8f0/64748b?text=Sneakers'], average_rating: 4.5, stock: 10, has_free_gift: true },
    { id: 'demo-2', name: 'Premium Watch', price: 199.00, images: ['https://placehold.co/400x400/dbeafe/3b82f6?text=Watch'], average_rating: 4.8, stock: 5 },
    { id: 'demo-3', name: 'Designer Bag', price: 149.99, discount_price: 119.99, images: ['https://placehold.co/400x400/fef3c7/d97706?text=Bag'], average_rating: 4.2, stock: 20 },
    { id: 'demo-4', name: 'Silk Scarf', price: 39.99, images: ['https://placehold.co/400x400/dcfce7/16a34a?text=Scarf'], average_rating: 4.6, stock: 15 },
  ];

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    </AdminLayout>
  );

  const enabledCount = themes.filter(t => t.enabled).length;
  const totalRevenue = themes.reduce((sum, t) => sum + (t.price_usd || 0) * (shopUsage[t.key] || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-themes-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
                <Palette className="h-6 w-6" />
              </div>
              Storefront Themes
            </h1>
            <p className="text-sm text-slate-500 mt-1 ml-14">Manage, review, and price shop storefront themes</p>
          </div>
          <Button onClick={fetchThemes} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-100"><Palette className="h-5 w-5 text-violet-600" /></div>
              <div>
                <p className="text-sm text-slate-500">Total Themes</p>
                <p className="text-2xl font-bold text-slate-900">{themes.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100"><Check className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-slate-500">Enabled</p>
                <p className="text-2xl font-bold text-slate-900">{enabledCount} / {themes.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100"><ShoppingBag className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-slate-500">Shops Using Themes</p>
                <p className="text-2xl font-bold text-slate-900">{Object.values(shopUsage).reduce((a, b) => a + b, 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Theme Sale */}
        <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-xl border border-rose-200 p-5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-rose-800 flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Global Theme Sale
              </h3>
              <p className="text-xs text-rose-600 mt-0.5">Set a discount percentage applied to all theme prices</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={salePercent}
                onChange={(e) => setSalePercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20 h-9 text-center font-bold"
                min="0"
                max="100"
                data-testid="theme-sale-input"
              />
              <span className="text-sm font-bold text-rose-700">%</span>
              <Button size="sm" onClick={handleSaveSale} disabled={saleLoading} className="bg-rose-600 hover:bg-rose-700 h-9" data-testid="save-sale-btn">
                <Save className="h-3.5 w-3.5 mr-1" /> {saleLoading ? '...' : 'Save'}
              </Button>
            </div>
            {salePercent > 0 && (
              <Badge className="bg-rose-500 text-white text-sm px-3 py-1 animate-pulse">{salePercent}% OFF ALL THEMES</Badge>
            )}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {themes.map((theme) => (
            <Card key={theme.key} className={`overflow-hidden border-0 shadow-md transition-all hover:shadow-lg ${!theme.enabled ? 'opacity-50 grayscale' : ''}`} data-testid={`theme-card-${theme.key}`}>
              {/* Theme Preview Header */}
              <div className="h-28 relative cursor-pointer" style={{ background: `linear-gradient(135deg, ${theme.preview_color}22, ${theme.preview_color}55)` }} onClick={() => setPreviewTheme(theme.key)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-transform hover:scale-110" style={{ backgroundColor: theme.preview_color }}>
                    <Palette className="h-7 w-7 text-white" />
                  </div>
                </div>
                {theme.is_default && (
                  <Badge className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px]">DEFAULT</Badge>
                )}
                {shopUsage[theme.key] > 0 && (
                  <Badge className="absolute bottom-2 left-2 bg-blue-500 text-white text-[10px]">
                    <ShoppingBag className="h-2.5 w-2.5 mr-0.5" /> {shopUsage[theme.key]} shop{shopUsage[theme.key] > 1 ? 's' : ''}
                  </Badge>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewTheme(theme.key); }}
                    className="w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm transition-all"
                    title="Preview theme"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                  <Switch
                    checked={theme.enabled}
                    onCheckedChange={(v) => handleUpdateTheme(theme.key, { enabled: v })}
                    data-testid={`toggle-${theme.key}`}
                  />
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-bold text-slate-900">{theme.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-1">{theme.best_for}</p>
                <p className="text-[11px] text-slate-400 mb-3 line-clamp-2">{theme.description}</p>

                {/* Price */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1 flex-1">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      value={theme.price_usd || 0}
                      onChange={(e) => {
                        const newThemes = themes.map(t => t.key === theme.key ? { ...t, price_usd: parseFloat(e.target.value) || 0 } : t);
                        setThemes(newThemes);
                      }}
                      className="h-8 text-sm w-20"
                      min="0"
                      step="0.5"
                      disabled={theme.is_default}
                      data-testid={`price-${theme.key}`}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateTheme(theme.key, { price_usd: theme.price_usd, pro_only: theme.pro_only })}
                    disabled={saving === theme.key || theme.is_default}
                    className="h-8"
                    data-testid={`save-${theme.key}`}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {saving === theme.key ? '...' : 'Save'}
                  </Button>
                </div>

                {/* Pro Only toggle */}
                {!theme.is_default && (
                  <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Pro Only
                    </span>
                    <Switch
                      checked={theme.pro_only || false}
                      onCheckedChange={(v) => {
                        const newThemes = themes.map(t => t.key === theme.key ? { ...t, pro_only: v } : t);
                        setThemes(newThemes);
                        handleUpdateTheme(theme.key, { pro_only: v });
                      }}
                      data-testid={`pro-only-${theme.key}`}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px]">{theme.category || 'general'}</Badge>
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.preview_color }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Theme Preview Dialog */}
        <Dialog open={!!previewTheme} onOpenChange={(open) => { if (!open) setPreviewTheme(null); }}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto p-0" data-testid="theme-preview-dialog">
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-violet-600" />
                Review: {themes.find(t => t.key === previewTheme)?.name || previewTheme}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {previewTheme && (() => {
                  const theme = themes.find(t => t.key === previewTheme);
                  return theme ? (
                    <>
                      <Badge variant={theme.enabled ? "default" : "destructive"} className="text-xs">
                        {theme.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">${theme.price_usd || 0}</Badge>
                    </>
                  ) : null;
                })()}
                <Button variant="ghost" size="sm" onClick={() => setPreviewTheme(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            {previewTheme && (() => {
              const PreviewCard = getThemedCard(previewTheme);
              const themeConf = getThemeConfig(previewTheme);
              return (
                <div className={`${themeConf.bodyBg || 'bg-slate-50'} min-h-[500px]`}>
                  {/* Hero preview */}
                  <div className={`bg-gradient-to-r ${themeConf.heroGradient} p-8 sm:p-12`}>
                    <div className="max-w-3xl mx-auto text-center">
                      <h2 className={`text-3xl font-bold ${themeConf.heroTextColor || 'text-white'}`}>Sample Store Name</h2>
                      <p className={`text-sm mt-2 ${themeConf.heroTextColor === 'text-slate-900' ? 'text-slate-500' : 'text-white/60'}`}>This is how the shop header will look to customers</p>
                    </div>
                  </div>
                  {/* Products grid preview */}
                  <div className="p-4 sm:p-8">
                    <h3 className={`text-lg font-bold mb-4 ${themeConf.darkMode ? 'text-white' : 'text-slate-900'}`}>Product Cards Preview</h3>
                    <div className={`grid ${themeConf.productGridCols || 'grid-cols-2 sm:grid-cols-4'} ${themeConf.gridGap || 'gap-4'}`}>
                      {demoProducts.map((product) => (
                        <div key={product.id} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }} className="cursor-default">
                          <PreviewCard product={product} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
