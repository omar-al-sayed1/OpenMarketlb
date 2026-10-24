import React, { useEffect, useState } from 'react';
import { Gift, Search, Trash2, Plus, Package, Loader2, Edit } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GiftDialog from '../../components/GiftDialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ShopGifts = () => {
  const [products, setProducts] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, giftRes] = await Promise.allSettled([
        api.shop.getProducts(),
        api.shopGifts.getAll(),
      ]);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data || []);
      if (giftRes.status === 'fulfilled') setGifts(giftRes.value.data?.gifts || []);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleRemoveGift = async (productId) => {
    try {
      await api.shopGifts.removeGift(productId);
      toast.success('Gift removed from product');
      fetchData();
    } catch (e) { toast.error('Failed to remove gift'); }
  };

  const giftsMap = {};
  gifts.forEach(g => { giftsMap[g.product_id] = g; });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Products without gifts for the "Add Gift" button quick pick
  const productsWithoutGifts = products.filter(p => !giftsMap[p.id]);

  if (loading) {
    return <ShopLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></ShopLayout>;
  }

  return (
    <ShopLayout>
      <div className="p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl p-2.5">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Product Gifts</h1>
              <p className="text-slate-500 text-sm">Attach free gifts to products to attract more customers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (productsWithoutGifts.length > 0) {
                  setSelectedProductId(null);
                  setSelectedProductName('');
                  setGiftDialogOpen(true);
                } else {
                  toast.info('All products already have gifts attached');
                }
              }}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
              data-testid="add-gift-top-btn"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Gift
            </Button>
          </div>
        </div>

        <>
          {/* Active Gifts Table */}
            {gifts.length > 0 && (
              <div className="bg-white rounded-xl border mb-6 overflow-hidden">
                <div className="p-4 border-b bg-pink-50">
                  <h3 className="font-semibold text-pink-800 flex items-center gap-2">
                    <Gift className="h-4 w-4" /> Active Gifts ({gifts.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Gift</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">For Product</th>
                        <th className="text-left p-3 font-medium">Stock</th>
                        <th className="text-left p-3 font-medium">Created</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gifts.map(g => {
                        const product = products.find(p => p.id === g.product_id);
                        return (
                          <tr key={g.id || g.product_id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {g.gift_image ? <img src={g.gift_image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center"><Gift className="h-4 w-4 text-pink-400" /></div>}
                                <span className="font-medium">{g.gift_name}</span>
                              </div>
                            </td>
                            <td className="p-3"><span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{g.gift_type === 'existing_product' ? 'Existing Product' : 'Custom Gift'}</span></td>
                            <td className="p-3 text-slate-600">{product?.name || g.product_id.substring(0,12)+'...'}</td>
                            <td className="p-3">
                              {g.gift_stock !== null && g.gift_stock !== undefined ? (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${g.gift_stock <= 0 ? 'bg-red-100 text-red-700' : g.gift_stock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {g.gift_stock} {g.gift_stock_used ? `(${g.gift_stock_used} used)` : ''}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Unlimited</span>
                              )}
                            </td>
                            <td className="p-3 text-xs text-slate-400">{new Date(g.created_at).toLocaleDateString()}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => { setSelectedProductId(g.product_id); setSelectedProductName(product?.name || ''); setGiftDialogOpen(true); }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemoveGift(g.product_id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map(product => {
                const hasGift = !!giftsMap[product.id];
                const img = product.images?.[0];
                // Show customer-facing price WITH commission (what the customer pays)
                const customerPrice = product.customer_price || product.price;
                const customerDiscount = product.customer_discount_price || product.discount_price;
                const displayPrice = customerDiscount || customerPrice;
                return (
                  <div key={product.id} className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow ${hasGift ? 'ring-2 ring-pink-300' : ''}`}>
                    <div className="relative aspect-square bg-slate-50">
                      {img ? <img src={img} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-slate-300" /></div>}
                      {hasGift && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-pink-500 text-white text-[9px] font-bold px-2 py-1 rounded-md">
                          <Gift className="w-3 h-3" /> Gift Active
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm truncate mb-1">{product.name}</p>
                      <p className="text-xs text-slate-400 mb-2">${displayPrice?.toFixed(2)}</p>
                      <Button
                        size="sm"
                        className={`w-full text-xs ${hasGift ? 'bg-pink-100 text-pink-700 hover:bg-pink-200 border border-pink-200' : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white'}`}
                        onClick={() => { setSelectedProductId(product.id); setSelectedProductName(product.name); setGiftDialogOpen(true); }}
                        data-testid={`add-gift-${product.id}`}
                      >
                        <Gift className="h-3 w-3 mr-1" /> {hasGift ? 'Edit Gift' : 'Add Gift'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
      </div>

      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={setGiftDialogOpen}
        productId={selectedProductId}
        productName={selectedProductName}
        products={productsWithoutGifts}
        onGiftSaved={fetchData}
      />
    </ShopLayout>
  );
};

export default ShopGifts;
