import React, { useEffect, useState } from 'react';
import { Megaphone, Search, Wallet, DollarSign, Clock, Eye, ShoppingCart, Plus, ArrowRight, Ban, Sparkles, Gift } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import ShopPurchaseConfirmation from '../../components/ShopPurchaseConfirmation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ShopBoostProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [shop, setShop] = useState({ free_sponsor_credits: 0, free_sponsor_10day_credits: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dailyPrice, setDailyPrice] = useState(2);

  // Boost dialog
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [durationDays, setDurationDays] = useState(7);
  const [boosting, setBoosting] = useState(false);
  const [useFreeCredit, setUseFreeCredit] = useState(false);

  // Wallet request dialog
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  // Purchase confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState({});
  const [requesting, setRequesting] = useState(false);
  const [txnDetailOpen, setTxnDetailOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [cancelPromoOpen, setCancelPromoOpen] = useState(false);
  const [promoToCancel, setPromoToCancel] = useState(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (!searchQuery) { setFilteredProducts(products); return; }
    const q = searchQuery.toLowerCase();
    setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)));
  }, [searchQuery, products]);

  const fetchData = async () => {
    try {
      const [productsRes, promosRes, walletRes, settingsRes, shopRes] = await Promise.allSettled([
        api.shop.getProducts(),
        api.shopPromotions.getAll(),
        api.shopWallet.get(),
        api.admin.getPlatformSettings(),
        api.shop.getProfile()
      ]);
      if (productsRes.status === 'fulfilled') { setProducts(productsRes.value.data); setFilteredProducts(productsRes.value.data); }
      if (promosRes.status === 'fulfilled') setPromotions(promosRes.value.data?.promotions || []);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data || { balance: 0 });
      if (settingsRes.status === 'fulfilled') setDailyPrice(settingsRes.value.data?.promotion_daily_price || 2);
      if (shopRes.status === 'fulfilled') setShop(shopRes.value.data || { free_sponsor_credits: 0, free_sponsor_10day_credits: 0 });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const totalCost = dailyPrice * durationDays;
  const isProductBoosted = (pid) => promotions.some(p => p.product_id === pid && p.status === 'active');

  const handleBoost = async () => {
    const freeShortCredits = shop?.free_sponsor_credits || 0;
    const freeLongCredits = shop?.free_sponsor_10day_credits || 0;
    const canUseShortFree = useFreeCredit && freeShortCredits > 0 && durationDays === 3;
    const canUseLongFree = useFreeCredit && freeLongCredits > 0 && durationDays === 10;
    const usingFreeCredit = canUseShortFree || canUseLongFree;
    
    if (!usingFreeCredit && totalCost > wallet.balance) {
      toast.error(`Not enough credits in wallet. Need $${totalCost.toFixed(2)}, have $${wallet.balance.toFixed(2)}. Contact admin to add money.`);
      return;
    }
    
    if (useFreeCredit && !usingFreeCredit) {
      toast.error('Free sponsor credits can only be used for 3-day (regular) or 10-day (special) boosts.');
      return;
    }
    
    const confirmMsg = usingFreeCredit
      ? `Use a FREE sponsor credit to boost "${selectedProduct?.name}" for ${durationDays} days?`
      : `Are you sure you want to boost "${selectedProduct?.name}" for ${durationDays} days?\n\nCost: $${totalCost.toFixed(2)}\nWallet Balance: $${wallet.balance.toFixed(2)}\nRemaining after boost: $${(wallet.balance - totalCost).toFixed(2)}`;
    if (!window.confirm(confirmMsg)) return;
    setBoosting(true);
    try {
      const { data } = await api.shopPromotions.create({ product_id: selectedProduct.id, duration_days: durationDays, use_free_credit: usingFreeCredit });
      setBoostDialogOpen(false);
      setConfirmDetails({
        productName: selectedProduct?.name,
        amount: usingFreeCredit ? 0 : totalCost,
        duration: `${durationDays} days`,
        message: usingFreeCredit ? 'Free sponsor credit used. Boost activated!' : `Remaining wallet balance: $${(wallet.balance - totalCost).toFixed(2)}`
      });
      setConfirmOpen(true);
      setUseFreeCredit(false);
      fetchData();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to boost');
    } finally { setBoosting(false); }
  };

  const handleWalletRequest = async () => {
    const amt = parseFloat(requestAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setRequesting(true);
    try {
      await api.shopWallet.requestTopup(amt);
      toast.success('Top-up request sent to admin!');
      setWalletDialogOpen(false);
      setRequestAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Request failed');
    } finally { setRequesting(false); }
  };

  const handleCancelPromo = async (promoId) => {
    try {
      await api.shopPromotions.cancel(promoId);
      toast.success('Promotion cancelled');
      setCancelPromoOpen(false);
      setPromoToCancel(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const openCancelConfirm = (promo) => {
    setPromoToCancel(promo);
    setCancelPromoOpen(true);
  };

  const getImageUrl = (img) => {
    if (!img) return '/placeholder.png';
    if (img.startsWith('http')) return img;
    if (img.startsWith('/api/')) return `${BACKEND_URL}${img}`;
    return img;
  };

  const activePromos = promotions.filter(p => p.status === 'active');
  const [showTransactions, setShowTransactions] = useState(false);

  if (loading) return <ShopLayout><div className="flex h-full items-center justify-center min-h-[80vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div></div></ShopLayout>;

  return (
    <ShopLayout>
      <div className="p-3 sm:p-5 lg:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 min-h-screen" data-testid="shop-boost-page">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-100/30 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-amber-300 rounded-full opacity-30" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200">
                <Megaphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Boost a Product</h1>
                <p className="text-slate-500 text-xs sm:text-sm">Promote your products to reach more customers</p>
              </div>
            </div>
            {((shop?.free_sponsor_credits || 0) + (shop?.free_sponsor_10day_credits || 0)) > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md animate-pulse" data-testid="boost-page-free-sponsor-badge">
                <Gift className="h-4 w-4" /> {(shop?.free_sponsor_credits || 0) + (shop?.free_sponsor_10day_credits || 0)} Free Sponsor{((shop?.free_sponsor_credits || 0) + (shop?.free_sponsor_10day_credits || 0)) > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Creative Wallet Card */}
        <div className="relative overflow-hidden rounded-2xl shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700"></div>
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'}}></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-violet-200 text-sm font-medium">Wallet Balance</span>
                </div>
                <p className="text-5xl font-black text-white tracking-tight">${(wallet.balance || 0).toFixed(2)}</p>
                <div className="flex items-center gap-4 mt-3 text-violet-200 text-sm">
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Rate: ${dailyPrice}/day</span>
                  <span className="flex items-center gap-1"><Megaphone className="w-4 h-4" /> {activePromos.length} active boost{activePromos.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setWalletDialogOpen(true)} className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-lg" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Request Top-up
                </Button>
                <Button onClick={() => setShowTransactions(!showTransactions)} variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 text-xs" size="sm">
                  <Clock className="w-3.5 h-3.5 mr-1" /> {showTransactions ? 'Hide' : 'Show'} Transactions
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Collapsible */}
        {showTransactions && wallet.transactions?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-top-2">
            <div className="px-5 py-3 bg-slate-50 border-b font-semibold text-sm text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" /> Recent Transactions
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {wallet.transactions.slice(0, 15).map(txn => (
                <div key={txn.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setSelectedTxn(txn); setTxnDetailOpen(true); }}>
                  <div>
                    <p className="font-medium text-sm text-slate-800">{txn.note}</p>
                    <p className="text-xs text-slate-400">{new Date(txn.created_at).toLocaleDateString()} · {txn.type?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`text-sm font-bold ${txn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {txn.amount >= 0 ? '+' : ''}{txn.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Promotions */}
        {activePromos.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-500" /> Active Boosts ({activePromos.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activePromos.map(promo => {
                const daysLeft = Math.max(0, Math.ceil((new Date(promo.end_date) - new Date()) / (86400000)));
                return (
                  <div key={promo.id} className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="w-4 h-4 text-amber-600" />
                      <p className="font-semibold text-sm text-slate-800 truncate">{promo.product_name}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-white rounded-lg p-2"><p className="text-lg font-bold text-amber-600">{daysLeft}</p><p className="text-[10px] text-slate-500">Days Left</p></div>
                      <div className="bg-white rounded-lg p-2"><p className="text-lg font-bold text-blue-600">{promo.views || 0}</p><p className="text-[10px] text-slate-500">Views</p></div>
                      <div className="bg-white rounded-lg p-2"><p className="text-lg font-bold text-emerald-600">{promo.orders || 0}</p><p className="text-[10px] text-slate-500">Orders</p></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">${promo.total_cost?.toFixed(2)} spent</span>
                      <Button variant="ghost" size="sm" className="text-red-500 text-xs h-7" onClick={() => openCancelConfirm(promo)}>
                        <Ban className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products to boost..."
            className="pl-10"
            data-testid="boost-search"
          />
        </div>

        {/* Products Grid - Creative Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map(product => {
            const boosted = isProductBoosted(product.id);
            const img = getImageUrl(product.images?.[0]);
            return (
              <div key={product.id} className={`group bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${boosted ? 'ring-2 ring-amber-400 shadow-amber-100' : 'hover:border-violet-200'}`}>
                <div className="relative overflow-hidden">
                  <img src={img} alt={product.name} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                  {boosted && (
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent" />
                  )}
                  {boosted && (
                    <span className="absolute top-2 left-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Megaphone className="w-3 h-3" /> Boosted
                    </span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-3.5">
                  <h3 className="font-bold text-sm truncate text-slate-800">{product.name}</h3>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5">
                      {product.discount_price && product.discount_price < product.price ? (
                        <>
                          <p className="text-violet-600 font-bold text-base">${product.discount_price?.toFixed(2)}</p>
                          <span className="text-[10px] line-through text-slate-400">${product.price?.toFixed(2)}</span>
                        </>
                      ) : (
                        <p className="text-violet-600 font-bold text-base">${product.price?.toFixed(2)}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Stock: {product.stock}</span>
                  </div>
                  {product.discount_price && product.discount_price < product.price && (
                    <span className="inline-block mt-1 text-[9px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.5 rounded">
                      {Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF
                    </span>
                  )}
                  {boosted ? (
                    <div className="mt-3 text-xs text-amber-700 font-semibold bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl py-2 text-center border border-amber-200">
                      Currently Boosted
                    </div>
                  ) : (
                    <Button
                      size="sm" className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-xs rounded-xl shadow-md shadow-amber-200/50 hover:shadow-lg transition-all"
                      onClick={() => { setSelectedProduct(product); setDurationDays(7); setBoostDialogOpen(true); }}
                      data-testid={`boost-btn-${product.id}`}
                    >
                      <Megaphone className="w-3 h-3 mr-1" /> Boost
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {filteredProducts.length === 0 && <p className="text-center text-gray-500 py-8">No products found</p>}

        {/* Boost Dialog */}
        <Dialog open={boostDialogOpen} onOpenChange={(o) => { setBoostDialogOpen(o); if (!o) setUseFreeCredit(false); }}>
          <DialogContent className="sm:max-w-[460px]" data-testid="boost-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-500" /> Boost Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold">{selectedProduct?.name}</p>
                <p className="text-sm text-gray-500">Your product will appear across the platform</p>
              </div>

              {/* Free sponsor credits notice */}
              {((shop?.free_sponsor_credits || 0) > 0 || (shop?.free_sponsor_10day_credits || 0) > 0) && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4" data-testid="free-credits-box">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-emerald-800">Free Sponsor Credits Available</h4>
                  </div>
                  <div className="text-xs text-emerald-700 space-y-1 mb-3">
                    {(shop?.free_sponsor_credits || 0) > 0 && <p>• {shop.free_sponsor_credits} × 7-day sponsor credit{shop.free_sponsor_credits>1?'s':''}</p>}
                    {(shop?.free_sponsor_10day_credits || 0) > 0 && <p>• {shop.free_sponsor_10day_credits} × 10-day sponsor credit{shop.free_sponsor_10day_credits>1?'s':''}</p>}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useFreeCredit} onChange={(e) => {
                      setUseFreeCredit(e.target.checked);
                      // Free sponsor = 3 days (regular). Only fall back to 10-day if that's the
                      // only credit the shop has. Duration is locked while the box is checked.
                      if (e.target.checked) {
                        if ((shop?.free_sponsor_credits || 0) > 0) setDurationDays(3);
                        else if ((shop?.free_sponsor_10day_credits || 0) > 0) setDurationDays(10);
                      }
                    }} data-testid="use-free-credit-toggle" className="rounded border-emerald-400 accent-emerald-600 w-4 h-4" />
                    <span className="text-sm font-semibold text-emerald-800">Use a free sponsor credit ({durationDays === 10 ? '10-day' : '3-day'})</span>
                  </label>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Duration: {durationDays} days{useFreeCredit && (durationDays === 3 || durationDays === 10) ? ' (FREE)' : ''}</label>
                <Slider value={[durationDays]} onValueChange={v => setDurationDays(v[0])} min={1} max={30} step={1} className="mt-2" disabled={useFreeCredit} />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1 day</span><span>30 days</span></div>
                {useFreeCredit && (
                  <p className="text-[11px] text-emerald-600 mt-1">Free credit sets the duration to 3 days (or 10 for a special credit) and locks it.</p>
                )}
              </div>

              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span>Rate</span><span className="font-semibold">${dailyPrice}/day</span></div>
                <div className="flex justify-between text-sm mt-1"><span>Duration</span><span className="font-semibold">{durationDays} days</span></div>
                <div className="border-t border-violet-200 my-3" />
                <div className="flex justify-between"><span className="text-lg font-bold">Total</span><span className="text-lg font-bold text-violet-700">{useFreeCredit ? <span className="text-emerald-600">FREE</span> : `$${totalCost.toFixed(2)}`}</span></div>
                {!useFreeCredit && <div className="flex justify-between text-xs mt-2"><span className="text-gray-500">Wallet Balance</span><span className={wallet.balance >= totalCost ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>${(wallet.balance || 0).toFixed(2)}</span></div>}
              </div>

              {!useFreeCredit && totalCost > wallet.balance ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">Not enough credits</p>
                    <p className="text-xs text-red-600">You need ${(totalCost - wallet.balance).toFixed(2)} more. Contact admin to add money to your wallet.</p>
                  </div>
                </div>
              ) : null}

              <Button onClick={handleBoost} disabled={boosting || (!useFreeCredit && totalCost > wallet.balance)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                {boosting ? 'Boosting...' : useFreeCredit ? `Boost for FREE (${durationDays}d)` : `Boost for $${totalCost.toFixed(2)}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Wallet Request Dialog */}
        <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-violet-500" /> Request Wallet Top-up</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Request the admin to add funds to your boost wallet.</p>
              <div>
                <label className="text-sm font-medium">Amount ($)</label>
                <Input type="number" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} placeholder="Enter amount" min="1" />
              </div>
              <Button onClick={handleWalletRequest} disabled={requesting} className="w-full">
                {requesting ? 'Sending...' : 'Send Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction Detail Popup */}
        <Dialog open={txnDetailOpen} onOpenChange={setTxnDetailOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-violet-500" /> Transaction Details</DialogTitle></DialogHeader>
            {selectedTxn && (
              <div className="space-y-3 pt-2">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Type</span><span className="font-medium text-sm capitalize">{selectedTxn.type?.replace(/_/g, ' ')}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Amount</span><span className={`font-bold text-lg ${selectedTxn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{selectedTxn.amount >= 0 ? '+' : ''}${selectedTxn.amount?.toFixed(2)}</span></div>
                  {selectedTxn.balance_after !== undefined && (
                    <div className="flex justify-between"><span className="text-sm text-slate-500">Balance After</span><span className="font-semibold">${selectedTxn.balance_after?.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Status</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedTxn.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : selectedTxn.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{selectedTxn.status}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Date</span><span className="text-sm">{new Date(selectedTxn.created_at).toLocaleString()}</span></div>
                </div>
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-sm text-violet-800"><strong>Note:</strong> {selectedTxn.note || 'No note'}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel Boost Confirmation */}
        <Dialog open={cancelPromoOpen} onOpenChange={setCancelPromoOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Ban className="w-5 h-5" /> Cancel Boost</DialogTitle></DialogHeader>
            {promoToCancel && (
              <div className="space-y-4 pt-2">
                <p className="text-slate-600">Are you sure you want to cancel the boost for <strong>{promoToCancel.product_name}</strong>?</p>
                <div className="bg-red-50 rounded-xl p-4 space-y-2 border border-red-200">
                  <div className="flex justify-between"><span className="text-sm text-red-700">Total Paid</span><span className="font-bold text-red-700">${promoToCancel.total_cost?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-red-700">Days Used</span><span className="font-semibold">{Math.max(0, promoToCancel.duration_days - Math.ceil((new Date(promoToCancel.end_date) - new Date()) / 86400000))} of {promoToCancel.duration_days}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-red-700">Refund Amount</span><span className="font-bold text-emerald-600">$0.00</span></div>
                  <p className="text-xs text-red-600 mt-2">Note: Cancellations are non-refundable. The remaining boost days will be forfeited.</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCancelPromoOpen(false)} className="flex-1">Keep Boost</Button>
                  <Button onClick={() => handleCancelPromo(promoToCancel.id)} className="flex-1 bg-red-600 hover:bg-red-700">Confirm Cancel</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Purchase Confirmation Popup */}
        <ShopPurchaseConfirmation
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          type="boost"
          details={confirmDetails}
        />
      </div>
    </ShopLayout>
  );
};

export default ShopBoostProducts;
