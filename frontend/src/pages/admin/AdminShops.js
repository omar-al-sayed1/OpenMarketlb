import React, { useEffect, useState } from 'react';
import { 
  Store, Check, X, Eye, DollarSign, Package, ShoppingCart, Calendar, Edit2, 
  Settings, CreditCard, FileText, Percent, Trash2, MapPin, Phone, Mail, 
  ArrowRight, Search, Filter, RefreshCw, MoreVertical, AlertTriangle,
  TrendingUp, Users, Clock, CheckCircle, XCircle, BarChart3, ChevronDown,
  ExternalLink, Star, Shield, Zap, Sparkles, User as UserIcon, BadgeCheck, Gift, UserPlus, Wallet
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '../../lib/api';
import { toast } from 'sonner';

// Small "subscription ended/cancelled · N ago" badge info. Auto-hides after 5 days.
const ENDED_BADGE_WINDOW_DAYS = 5;
const getSubscriptionEndedBadge = (shop) => {
  const ts = shop?.subscription_ended_at;
  if (!ts) return null;
  const ended = new Date(ts);
  if (isNaN(ended.getTime())) return null;
  const diffMs = Date.now() - ended.getTime();
  if (diffMs < 0 || diffMs > ENDED_BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000) return null; // older than 5 days → gone
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let ago;
  if (days >= 1) ago = `${days}d ago`;
  else if (hrs >= 1) ago = `${hrs}h ago`;
  else if (mins >= 1) ago = `${mins}m ago`;
  else ago = 'just now';
  const cancelled = shop.subscription_end_reason === 'cancelled';
  return { cancelled, label: cancelled ? 'Subscription cancelled' : 'Subscription ended', ago };
};

const AdminShops = () => {
  const [shops, setShops] = useState([]);
  const [filteredShops, setFilteredShops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [referredFilter, setReferredFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopProducts, setShopProducts] = useState([]);
  const [shopOrders, setShopOrders] = useState([]);
  const [shopAnalytics, setShopAnalytics] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editShopOpen, setEditShopOpen] = useState(false);
  const [editSubscriptionOpen, setEditSubscriptionOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [shopToActivate, setShopToActivate] = useState(null);
  const [activateMonths, setActivateMonths] = useState(1);
  const [activateSubscriptionRequired, setActivateSubscriptionRequired] = useState(false);
  const [activateCommissionRate, setActivateCommissionRate] = useState('10');
  const [activateCommissionType, setActivateCommissionType] = useState('on_customer');
  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState({ subscription_price: 29, commission_percentage: 0 });
  const [tierRequests, setTierRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('shops');
  const [guestApplications, setGuestApplications] = useState([]);
  const [guestEditOpen, setGuestEditOpen] = useState(false);
  const [guestApproveOpen, setGuestApproveOpen] = useState(false);
  const [selectedGuestApp, setSelectedGuestApp] = useState(null);
  const [guestEditForm, setGuestEditForm] = useState({});
  const [guestApproveForm, setGuestApproveForm] = useState({ password: '', commission_percentage: '10', commission_type: 'on_customer', subscription_required: false });
  const [agents, setAgents] = useState([]);
  const [verifyConfirm, setVerifyConfirm] = useState({ open: false, shop: null });
  const [verifying, setVerifying] = useState(false);
  const [walletAdjustOpen, setWalletAdjustOpen] = useState(false);
  const [walletAdjustType, setWalletAdjustType] = useState('add');
  const [walletAdjustAmount, setWalletAdjustAmount] = useState('');
  const [walletAdjustNote, setWalletAdjustNote] = useState('');
  const [shopWalletData, setShopWalletData] = useState(null);
  const [states, setStates] = useState([]);
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    commission_percentage: '',
    commission_type: 'on_customer',
    logo: '',
    category_ids: []
  });
  const [allCategories, setAllCategories] = useState([]);
  
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    subscription_status: '',
    subscription_end: '',
    payment_amount: ''
  });

  useEffect(() => {
    fetchShops();
    fetchPlatformSettings();
    fetchTierRequests();
    fetchCategories();
    fetchGuestApplications();
    fetchAgents();
    // Fetch states for guest edit dropdown
    api.states.getAll().then(({ data }) => setStates(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    filterShops();
  }, [shops, searchQuery, statusFilter, paymentFilter, subscriptionFilter, referredFilter, stateFilter, agentFilter]);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const { data } = await api.admin.getShops();
      setShops(data);
    } catch (error) {
      console.error('Failed to fetch shops', error);
      toast.error('Failed to load shops');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
    } catch (error) {
      console.error('Failed to fetch platform settings', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getAll();
      setAllCategories(data || []);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const toggleEditCategory = (catId) => {
    setEditFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  };

  const fetchTierRequests = async () => {
    try {
      const { data } = await api.adminTier.getUpgradeRequests();
      setTierRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch tier requests', error);
    }
  };

  const fetchGuestApplications = async () => {
    try {
      const { data } = await api.guestApplications.getAll('pending');
      setGuestApplications(data || []);
    } catch (error) {
      console.error('Failed to fetch guest applications', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data } = await api.admin.listReferralAgents();
      setAgents(Array.isArray(data) ? data : (data?.agents || []));
    } catch (error) {
      console.error('Failed to fetch referral agents', error);
    }
  };

  const openGuestEdit = (app) => {
    setSelectedGuestApp(app);
    setGuestEditForm({
      shop_name: app.shop_name || '',
      guest_name: app.guest_name || '',
      email: app.email || '',
      phone: app.phone || '',
      address: app.address || '',
      state: app.state || '',
      description: app.description || '',
    });
    setGuestEditOpen(true);
  };

  const handleSaveGuestEdit = async () => {
    if (!selectedGuestApp) return;
    try {
      await api.guestApplications.update(selectedGuestApp.id, guestEditForm);
      toast.success('Application updated');
      setGuestEditOpen(false);
      fetchGuestApplications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    }
  };

  const openGuestApprove = (app) => {
    setSelectedGuestApp(app);
    // Pre-select the agent detected from the referral link (if any) and pre-fill
    // that agent's current commission-share %.
    const detectedAgentId = app.referred_by_agent_id || '';
    const detectedAgent = agents.find(a => a.id === detectedAgentId);
    setGuestApproveForm({
      password: '',
      commission_percentage: '10',
      commission_type: 'on_customer',
      subscription_required: false,
      referred_by_agent_id: detectedAgentId,
      agent_commission_share_percent: detectedAgent
        ? String(detectedAgent.commission_share_percent ?? 30)
        : '30',
    });
    setGuestApproveOpen(true);
  };

  const handleApproveGuest = async () => {
    if (!selectedGuestApp) return;
    const isLoggedInApp = !!(selectedGuestApp.is_logged_in_user || selectedGuestApp.user_id);
    if (!isLoggedInApp && (!guestApproveForm.password || guestApproveForm.password.length < 6)) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const payload = {
        commission_percentage: parseFloat(guestApproveForm.commission_percentage) || 10,
        commission_type: guestApproveForm.commission_type,
        subscription_required: guestApproveForm.subscription_required,
      };
      // Referral agent assignment (admin can set/override + set commission share %)
      if (guestApproveForm.referred_by_agent_id) {
        payload.referred_by_agent_id = guestApproveForm.referred_by_agent_id;
        if (guestApproveForm.agent_commission_share_percent !== undefined && guestApproveForm.agent_commission_share_percent !== '') {
          payload.agent_commission_share_percent = parseFloat(guestApproveForm.agent_commission_share_percent);
        }
      }
      // Only send a password for true (non-logged-in) guest applicants.
      if (!isLoggedInApp) {
        payload.password = guestApproveForm.password;
      }
      if (guestApproveForm.subscription_required) {
        payload.subscription_fee = parseFloat(guestApproveForm.subscription_fee || 19) || 19;
        payload.months = parseInt(guestApproveForm.months || 1) || 1;
      }
      const { data } = await api.guestApplications.approve(selectedGuestApp.id, payload);
      toast.success(`Approved! Account ready for ${data.email}`);
      setGuestApproveOpen(false);
      fetchGuestApplications();
      fetchShops();
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectGuest = async (appId) => {
    if (!window.confirm('Reject this guest application?')) return;
    try {
      await api.guestApplications.reject(appId);
      toast.success('Application rejected');
      fetchGuestApplications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleApproveTierRequest = async (requestId) => {
    try {
      await api.adminTier.approveUpgrade(requestId, '');
      toast.success('Tier upgrade approved!');
      fetchTierRequests();
      fetchShops();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectTierRequest = async (requestId) => {
    if (!window.confirm('Reject this tier upgrade request?')) return;
    try {
      await api.adminTier.rejectUpgrade(requestId, '');
      toast.success('Tier upgrade rejected');
      fetchTierRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleWalletAdjust = async () => {
    const amount = parseFloat(walletAdjustAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!selectedShop) return;
    try {
      if (walletAdjustType === 'add') {
        await api.adminWallet.addFunds(selectedShop.id, amount, walletAdjustNote || 'Admin top-up');
        toast.success(`Added $${amount.toFixed(2)} to wallet`);
      } else {
        await api.adminWallet.decreaseFunds(selectedShop.id, amount, walletAdjustNote || 'Admin deduction');
        toast.success(`Deducted $${amount.toFixed(2)} from wallet`);
      }
      setWalletAdjustOpen(false);
      setWalletAdjustAmount('');
      setWalletAdjustNote('');
      fetchShops();
      if (selectedShop) fetchShopDetails(selectedShop);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const filterShops = () => {
    let filtered = [...shops];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(shop =>
        shop.name?.toLowerCase().includes(query) ||
        shop.email?.toLowerCase().includes(query) ||
        shop.phone?.includes(query) ||
        shop.referred_by_agent_name?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(shop => shop.subscription_status === statusFilter);
    }
    
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(shop => shop.payment_method === paymentFilter);
    }

    if (subscriptionFilter === 'subscribed') {
      filtered = filtered.filter(shop => isSubscribed(shop));
    } else if (subscriptionFilter === 'not_subscribed') {
      filtered = filtered.filter(shop => !isSubscribed(shop));
    }

    if (referredFilter === 'referred') {
      filtered = filtered.filter(shop => !!shop.referred_by_agent_id);
    } else if (referredFilter === 'direct') {
      filtered = filtered.filter(shop => !shop.referred_by_agent_id);
    }

    if (stateFilter !== 'all') {
      filtered = filtered.filter(shop => (shop.state || '') === stateFilter);
    }

    if (agentFilter !== 'all') {
      filtered = filtered.filter(shop => shop.referred_by_agent_id === agentFilter);
    }
    
    // Sort: pending first, then by name
    const statusPriority = { pending: 0, trial: 1, active: 2, expired: 3, suspended: 4 };
    filtered.sort((a, b) => {
      const pa = statusPriority[a.subscription_status] ?? 5;
      const pb = statusPriority[b.subscription_status] ?? 5;
      if (pa !== pb) return pa - pb;
      return (a.name || '').localeCompare(b.name || '');
    });
    
    setFilteredShops(filtered);
  };

  const fetchShopDetails = async (shop) => {
    setSelectedShop(shop);
    setDetailsOpen(true);
    
    try {
      // Fetch shop analytics
      const { data: analytics } = await api.admin.getShopAnalytics(shop.id);
      setShopAnalytics(analytics);
      
      // Fetch shop products using dedicated endpoint
      const { data: products } = await api.admin.getShopProducts(shop.id);
      setShopProducts(products || []);
      
      // Fetch shop orders using dedicated endpoint
      const { data: orders } = await api.admin.getShopOrders(shop.id);
      setShopOrders(orders || []);
    } catch (error) {
      console.error('Failed to fetch shop details', error);
    }
  };

  const handleApproveShop = (shopId) => {
    setShopToActivate(shopId);
    const shop = shops.find(s => s.id === shopId);
    if (shop && shop.plan_type === 'yearly') {
      setActivateMonths(12);
    } else {
      setActivateMonths(1);
    }
    // Reset commission fields
    setActivateSubscriptionRequired(false);
    setActivateCommissionRate(shop?.commission_percentage?.toString() || '10');
    setActivateCommissionType(shop?.commission_type || 'on_customer');
    setActivateDialogOpen(true);
  };

  const confirmActivation = async () => {
    const commRate = parseFloat(activateCommissionRate);
    if (isNaN(commRate) || commRate < 0 || commRate > 100) {
      toast.error('Commission rate must be between 0 and 100');
      return;
    }
    try {
      await api.admin.approveShop(
        shopToActivate,
        activateSubscriptionRequired ? activateMonths : 1,
        activateSubscriptionRequired,
        commRate,
        activateCommissionType
      );
      const subMsg = activateSubscriptionRequired ? `with subscription for ${activateMonths} month(s)` : 'without subscription';
      toast.success(`Shop approved ${subMsg}! Commission: ${commRate}% (${activateCommissionType.replace(/_/g, ' ')})`);
      setActivateDialogOpen(false);
      setShopToActivate(null);
      setActivateMonths(1);
      fetchShops();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve shop');
    }
  };

  const handleSuspendShop = async (shopId) => {
    if (window.confirm('Are you sure you want to suspend this shop? All their products will be hidden.')) {
      try {
        await api.admin.suspendShop(shopId);
        toast.success('Shop suspended');
        fetchShops();
        setDetailsOpen(false);
      } catch (error) {
        toast.error('Failed to suspend shop');
      }
    }
  };

  const openVerifyConfirm = (shop) => {
    setVerifyConfirm({ open: true, shop });
  };

  const confirmVerifyShop = async () => {
    const shop = verifyConfirm.shop;
    if (!shop) return;
    const isVerified = !!shop.is_verified;
    setVerifying(true);
    try {
      if (isVerified) {
        await api.admin.unverifyShop(shop.id);
        toast.success('Verification badge removed');
      } else {
        await api.admin.verifyShop(shop.id);
        toast.success('Shop verified successfully');
      }
      fetchShops();
      if (selectedShop?.id === shop.id) {
        setSelectedShop(prev => prev ? { ...prev, is_verified: !isVerified } : prev);
      }
      setVerifyConfirm({ open: false, shop: null });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update verification');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteShop = async (shopId, shopName) => {
    if (window.confirm(`Are you sure you want to DELETE "${shopName}"? This will remove ALL their products and cannot be undone!`)) {
      try {
        const { data } = await api.admin.deleteShop(shopId);
        toast.success(`Shop "${shopName}" deleted. ${data.products_deleted} products removed.`);
        fetchShops();
        setDetailsOpen(false);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete shop');
      }
    }
  };

  const handleChangeTier = async (shopId, shopName, currentTier) => {
    const newTier = currentTier === 'pro' ? 'starter' : 'pro';
    const tierLabel = newTier === 'pro' ? 'Pro' : 'Starter';
    if (!window.confirm(`Change "${shopName}" tier from ${(currentTier || 'starter').charAt(0).toUpperCase() + (currentTier || 'starter').slice(1)} to ${tierLabel}?`)) return;
    try {
      await api.adminTier.setShopTier(shopId, newTier);
      toast.success(`Shop tier changed to ${tierLabel}`);
      fetchShops();
      if (selectedShop?.id === shopId) {
        setSelectedShop(prev => prev ? { ...prev, tier: newTier } : prev);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change tier');
    }
  };

  const openEditShop = (shop) => {
    setEditFormData({
      name: shop.name || '',
      description: shop.description || '',
      phone: shop.phone || '',
      email: shop.email || '',
      address: shop.address || '',
      commission_percentage: shop.commission_percentage !== null && shop.commission_percentage !== undefined ? shop.commission_percentage.toString() : '',
      commission_type: shop.commission_type || 'on_customer',
      logo: shop.logo || '',
      category_ids: Array.isArray(shop.category_ids) ? shop.category_ids : []
    });
    setEditShopOpen(true);
  };

  const handleSaveShopEdit = async () => {
    try {
      await api.admin.updateShop(selectedShop.id, {
        name: editFormData.name,
        description: editFormData.description,
        phone: editFormData.phone,
        email: editFormData.email,
        address: editFormData.address,
        commission_percentage: editFormData.commission_percentage ? parseFloat(editFormData.commission_percentage) : null,
        commission_type: editFormData.commission_type || 'on_customer',
        logo: editFormData.logo || null,
        category_ids: editFormData.category_ids || []
      });
      toast.success('Shop updated successfully');
      setEditShopOpen(false);
      fetchShops();
      fetchShopDetails(selectedShop);
    } catch (error) {
      toast.error('Failed to update shop');
    }
  };

  const openEditSubscription = (shop) => {
    setSubscriptionFormData({
      subscription_status: shop.subscription_status || 'none',
      subscription_end: shop.subscription_end ? shop.subscription_end.split('T')[0] : '',
      payment_amount: ''
    });
    setEditSubscriptionOpen(true);
  };

  const handleSaveSubscription = async () => {
    try {
      await api.admin.updateShopSubscription(selectedShop.id, subscriptionFormData);
      toast.success('Subscription updated successfully');
      setEditSubscriptionOpen(false);
      fetchShops();
      fetchShopDetails(selectedShop);
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  // A shop counts as "subscribed" when it is on a required subscription that is
  // currently active or in trial. Free shops (subscription_required === false) and
  // pending/expired/suspended shops count as "not subscribed".
  const isSubscribed = (shop) =>
    shop?.subscription_required !== false && ['active', 'trial'].includes(shop?.subscription_status);

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
      trial: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Zap },
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
      expired: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
      suspended: { bg: 'bg-slate-100', text: 'text-slate-700', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-3 w-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  const stats = [
    { label: 'Total Shops', value: shops.length, icon: Store, color: 'violet' },
    { label: 'Active', value: shops.filter(s => s.subscription_status === 'active').length, icon: CheckCircle, color: 'emerald' },
    { label: 'Pending', value: shops.filter(s => s.subscription_status === 'pending').length, icon: Clock, color: 'amber' },
    { label: 'Guest Apps', value: guestApplications.length, icon: Users, color: 'blue' },
  ];

  const pendingTierRequests = tierRequests.filter(r => r.status === 'pending');

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6" data-testid="admin-shops-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-violet-200">
                <Store className="h-6 w-6" />
              </div>
              Shops Management
            </h1>
            <p className="text-slate-600 mt-1 ml-14">Manage shops, subscriptions, tier requests & commissions</p>
          </div>
          <Button onClick={() => { fetchShops(); fetchTierRequests(); fetchGuestApplications(); }} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-${stat.color}-100`}>
                    <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tier Upgrade Requests Banner — Hidden: tier system removed */}
        {false && pendingTierRequests.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 mb-6" data-testid="tier-requests-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Pending Tier Upgrade Requests ({pendingTierRequests.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingTierRequests.map((req) => {
                const tierSaleInfo = platformSettings?.tiers?.[req.to_tier];
                const hasSale = tierSaleInfo?.sale_active && tierSaleInfo?.sale_percentage > 0;
                return (
                  <div key={req.id} className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm" data-testid={`tier-request-${req.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-800">{req.shop_name}</p>
                        <p className="text-xs text-slate-500">{new Date(req.requested_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{req.from_tier}</span>
                        <ArrowRight className="h-3 w-3 text-amber-500" />
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize font-bold">{req.to_tier}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      <span className="capitalize">{req.billing_cycle} billing</span>
                      {hasSale && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                          {tierSaleInfo.sale_percentage}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApproveTierRequest(req.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid={`approve-tier-${req.id}`}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRejectTierRequest(req.id)} className="flex-1 border-red-200 text-red-600 hover:bg-red-50" data-testid={`reject-tier-${req.id}`}>
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Guest Shop Applications */}
        {guestApplications.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-5 mb-6" data-testid="guest-applications-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-500" />
                Guest Shop Applications ({guestApplications.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guestApplications.map(app => (
                <div key={app.id} className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm" data-testid={`guest-app-${app.id}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {app.logo ? (
                      <img src={app.logo} alt={app.shop_name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                        <Store className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 truncate">{app.shop_name}</p>
                        {(app.is_logged_in_user || app.user_id) && (
                          <span className="inline-flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 border border-violet-200" data-testid={`logged-in-badge-${app.id}`}>
                            <UserIcon className="h-2.5 w-2.5" /> Logged-in
                          </span>
                        )}
                        {app.referred_by_agent_id && (
                          <span className="inline-flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200" data-testid={`referred-badge-${app.id}`} title={`Referred by ${app.referred_by_agent_name || ''} ${app.referral_code || ''}`}>
                            <Gift className="h-2.5 w-2.5" /> Referred
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{app.email}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3 text-xs text-slate-500">
                    <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {app.guest_name || 'Guest'}</p>
                    <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {app.phone}</p>
                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {app.address}, {app.state}</p>
                    <p className="text-[10px] text-slate-400">{new Date(app.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openGuestApprove(app)} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid={`approve-guest-${app.id}`}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openGuestEdit(app)} className="border-blue-200 text-blue-600 hover:bg-blue-50" data-testid={`edit-guest-${app.id}`}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectGuest(app.id)} className="border-red-200 text-red-600 hover:bg-red-50" data-testid={`reject-guest-${app.id}`}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6" data-testid="admin-shops-filters">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, phone, or agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="admin-shops-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-40" data-testid="admin-shops-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
              <SelectTrigger className="w-full lg:w-44" data-testid="admin-shops-subscription-filter">
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shops</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="not_subscribed">Not Subscribed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={referredFilter} onValueChange={setReferredFilter}>
              <SelectTrigger className="w-full lg:w-40" data-testid="admin-shops-referred-filter">
                <SelectValue placeholder="Referral" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shops</SelectItem>
                <SelectItem value="referred">Referred by agent</SelectItem>
                <SelectItem value="direct">Direct (no agent)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-full lg:w-44" data-testid="admin-shops-agent-filter">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {(agents || []).map((ag) => (
                  <SelectItem key={ag.id} value={ag.id}>{ag.name || ag.email || 'Agent'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full lg:w-40" data-testid="admin-shops-state-filter">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {Array.from(new Set(shops.map(s => s.state).filter(Boolean))).sort().map((st) => (
                  <SelectItem key={st} value={st}>{st}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full lg:w-36" data-testid="admin-shops-payment-filter">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500" data-testid="admin-shops-result-count">
              Showing <span className="font-bold text-slate-800">{filteredShops.length}</span> of {shops.length} shops
            </p>
            {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || subscriptionFilter !== 'all' || referredFilter !== 'all' || stateFilter !== 'all' || agentFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); setSubscriptionFilter('all'); setReferredFilter('all'); setStateFilter('all'); setAgentFilter('all'); }}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                data-testid="admin-shops-clear-filters"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Shops Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200">
            <Store className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600">No shops found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredShops.map((shop) => (
              <div
                key={shop.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {shop.logo ? (
                        <img src={shop.logo} alt={shop.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Store className="h-6 w-6 text-white" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-slate-900 truncate">{shop.name}</h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm" title="Wallet balance" data-testid={`shop-wallet-chip-${shop.id}`}>
                            <Wallet className="h-3 w-3" /> ${(shop.wallet_balance || 0).toFixed(2)}
                          </span>
                          {shop.referred_by_agent_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200" data-testid={`shop-referred-badge-${shop.id}`} title={`Referred by ${shop.referred_by_agent_name || 'an agent'}`}>
                              <UserPlus className="h-3 w-3" /> Referred
                            </span>
                          )}
                          {(() => {
                            const ended = getSubscriptionEndedBadge(shop);
                            if (!ended) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse"
                                data-testid={`shop-subscription-ended-badge-${shop.id}`}
                                title={`${ended.label} ${ended.ago}`}
                              >
                                <XCircle className="h-3 w-3" /> {ended.cancelled ? 'Cancelled' : 'Ended'} · {ended.ago}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-slate-500 truncate flex items-center gap-1"><Mail className="h-3 w-3 flex-shrink-0" /> {shop.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => fetchShopDetails(shop)}>
                          <Eye className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedShop(shop); openEditShop(shop); }}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit Shop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedShop(shop); openEditSubscription(shop); }}>
                          <Calendar className="h-4 w-4 mr-2" /> Edit Subscription
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {shop.subscription_status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleApproveShop(shop.id)} className="text-emerald-600">
                            <Check className="h-4 w-4 mr-2" /> Approve
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openVerifyConfirm(shop)} className={shop.is_verified ? 'text-slate-600' : 'text-blue-600'}>
                          <BadgeCheck className="h-4 w-4 mr-2" /> {shop.is_verified ? 'Remove Verification' : 'Verify Shop'}
                        </DropdownMenuItem>
                        {shop.subscription_status !== 'suspended' && (
                          <DropdownMenuItem onClick={() => handleSuspendShop(shop.id)} className="text-amber-600">
                            <XCircle className="h-4 w-4 mr-2" /> Suspend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDeleteShop(shop.id, shop.name)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 divide-y divide-slate-50">
                  {shop.referred_by_agent_id && (
                    <div className="flex items-center justify-between py-2" data-testid={`shop-referred-info-${shop.id}`}>
                      <span className="text-sm text-slate-500 flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-violet-500" /> Referred by</span>
                      <span className="text-sm font-semibold text-violet-700 truncate max-w-[160px]" title={shop.referred_by_agent_name || shop.referred_by_agent_id}>
                        {shop.referred_by_agent_name || 'Agent'}
                        {shop.referral_code && <span className="ml-1 font-mono text-[10px] text-violet-400">({shop.referral_code})</span>}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Status</span>
                    {getStatusBadge(shop.subscription_status)}
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Verified</span>
                    {shop.is_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700" data-testid={`shop-verified-badge-${shop.id}`}>
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        Not verified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Revenue</span>
                    <span className="font-bold text-emerald-600">${(shop.total_revenue || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Commission</span>
                    <span className="text-sm font-medium text-slate-700">
                      {(() => {
                        const rate = shop.commission_percentage !== null && shop.commission_percentage !== undefined
                          ? shop.commission_percentage
                          : (platformSettings?.commission_percentage || 10);
                        const type = shop.commission_type || 'on_customer';
                        const typeLabel = type === 'on_shop' ? 'On Shop' : type === 'half_half' ? 'Half/Half' : 'On Customer';
                        return `${rate}% · ${typeLabel}`;
                      })()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Subscription</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isSubscribed(shop) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} data-testid={`shop-subscription-badge-${shop.id}`}>
                      {isSubscribed(shop) ? <><CheckCircle className="h-3.5 w-3.5" /> Subscribed</> : <><XCircle className="h-3.5 w-3.5" /> Not Subscribed</>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> State</span>
                    <span className="text-sm font-medium text-slate-700">{shop.state || '—'}</span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-2">
                  {!shop.is_verified && (
                    <Button
                      onClick={() => openVerifyConfirm(shop)}
                      variant="outline"
                      className="w-full justify-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      data-testid={`verify-shop-btn-${shop.id}`}
                    >
                      <BadgeCheck className="h-4 w-4" /> Verify Shop
                    </Button>
                  )}
                  <Button 
                    onClick={() => fetchShopDetails(shop)} 
                    variant="ghost" 
                    className="w-full justify-center gap-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  >
                    View Full Details <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verify Shop Confirmation Dialog (centered) */}
        <Dialog open={verifyConfirm.open} onOpenChange={(o) => { if (!o) setVerifyConfirm({ open: false, shop: null }); }}>
          <DialogContent className="sm:max-w-md" data-testid="verify-shop-confirm-dialog">
            <DialogHeader>
              <div className={`mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center ${verifyConfirm.shop?.is_verified ? 'bg-amber-100' : 'bg-blue-100'}`}>
                <BadgeCheck className={`h-7 w-7 ${verifyConfirm.shop?.is_verified ? 'text-amber-600' : 'text-blue-600'}`} />
              </div>
              <DialogTitle className="text-center text-xl">
                {verifyConfirm.shop?.is_verified ? 'Remove Verification?' : 'Verify this shop?'}
              </DialogTitle>
              <DialogDescription className="text-center">
                {verifyConfirm.shop?.is_verified ? (
                  <>This will remove the <b>Verified</b> badge from <b>{verifyConfirm.shop?.name}</b>. The shop will lose its higher search ranking.</>
                ) : (
                  <>You are about to instantly mark <b>{verifyConfirm.shop?.name}</b> as a <b>Verified Seller</b>. This gives the shop a verified badge and higher ranking in search results.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setVerifyConfirm({ open: false, shop: null })}
                disabled={verifying}
                data-testid="verify-shop-cancel-btn"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmVerifyShop}
                disabled={verifying}
                className={verifyConfirm.shop?.is_verified ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}
                data-testid="verify-shop-confirm-btn"
              >
                {verifying ? 'Please wait...' : (verifyConfirm.shop?.is_verified ? 'Remove Verification' : 'Yes, Verify Shop')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Shop Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedShop && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    {selectedShop.logo ? (
                      <img src={selectedShop.logo} alt={selectedShop.name} className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                        <Store className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-2xl">{selectedShop.name}</DialogTitle>
                      <DialogDescription className="flex items-center gap-2 mt-1">
                        {getStatusBadge(selectedShop.subscription_status)}
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-500">ID: {selectedShop.id.slice(0, 8)}...</span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="mt-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="products">Products ({shopProducts.length})</TabsTrigger>
                    <TabsTrigger value="orders">Orders ({shopOrders.length})</TabsTrigger>
                    <TabsTrigger value="subscription">Subscription</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Shop Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="font-semibold mb-3">Contact Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span>{selectedShop.email || 'Not provided'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span>{selectedShop.phone || 'Not provided'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{selectedShop.address || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="font-semibold mb-3">Analytics Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Total Revenue</span>
                            <span className="font-semibold text-emerald-600">${(shopAnalytics?.gross_revenue || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Total Orders</span>
                            <span className="font-semibold">{shopAnalytics?.total_orders || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Total Products</span>
                            <span className="font-semibold">{shopProducts.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Commission Rate</span>
                            <span className="font-semibold">
                              {(() => {
                                const rate = selectedShop.commission_percentage !== null && selectedShop.commission_percentage !== undefined
                                  ? selectedShop.commission_percentage
                                  : (platformSettings?.commission_percentage || 10);
                                const type = selectedShop.commission_type || 'on_customer';
                                const typeLabel = type === 'on_shop' ? 'On Shop' : type === 'half_half' ? 'Half/Half' : 'On Customer';
                                return `${rate}% · ${typeLabel}`;
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Subscription</span>
                            <span className={`font-semibold ${selectedShop.subscription_required === false ? 'text-green-600' : 'text-slate-700'}`}>
                              {selectedShop.subscription_required === false ? 'Free (No Sub)' : 'Required'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Wallet Balance</span>
                            <span className="font-semibold text-violet-600">${(selectedShop.wallet_balance || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedShop.description && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="font-semibold mb-2">Description</h4>
                        <p className="text-slate-600 text-sm">{selectedShop.description}</p>
                      </div>
                    )}

                    {/* Shop Categories applied by seller */}
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-4" data-testid="shop-detail-categories">
                      <h4 className="font-semibold mb-2 text-violet-900 flex items-center gap-2">
                        <Package className="h-4 w-4" /> Categories Applied
                      </h4>
                      {Array.isArray(selectedShop.category_ids) && selectedShop.category_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedShop.category_ids.map(cid => {
                            const cat = allCategories.find(c => c.id === cid);
                            return cat ? (
                              <span key={cid} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-violet-700 border border-violet-200" data-testid={`shop-detail-category-${cid}`}>
                                {cat.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No categories selected by the shop. You can add them via "Edit Shop".</p>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <Button onClick={() => openEditShop(selectedShop)} variant="outline" className="gap-2">
                        <Edit2 className="h-4 w-4" /> Edit Shop
                      </Button>
                      <Button onClick={() => openEditSubscription(selectedShop)} variant="outline" className="gap-2">
                        <Calendar className="h-4 w-4" /> Edit Subscription
                      </Button>
                      {selectedShop.subscription_status === 'pending' && (
                        <Button onClick={() => handleApproveShop(selectedShop.id)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                          <Check className="h-4 w-4" /> Approve Shop
                        </Button>
                      )}
                      {selectedShop.subscription_status !== 'suspended' && (
                        <Button onClick={() => handleSuspendShop(selectedShop.id)} variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
                          <XCircle className="h-4 w-4" /> Suspend
                        </Button>
                      )}
                      <Button onClick={() => handleDeleteShop(selectedShop.id, selectedShop.name)} variant="outline" className="gap-2 text-red-600 border-red-300 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                      <Button onClick={() => { setWalletAdjustType('add'); setWalletAdjustAmount(''); setWalletAdjustNote(''); setWalletAdjustOpen(true); }} variant="outline" className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                        <DollarSign className="h-4 w-4" /> Add Wallet
                      </Button>
                      <Button onClick={() => { setWalletAdjustType('decrease'); setWalletAdjustAmount(''); setWalletAdjustNote(''); setWalletAdjustOpen(true); }} variant="outline" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                        <DollarSign className="h-4 w-4" /> Decrease Wallet
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="products" className="mt-4">
                    {shopProducts.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                        No products yet
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                        {shopProducts.map((product) => (
                          <div key={product.id} className="bg-slate-50 rounded-lg p-3 flex gap-3">
                            <img 
                              src={product.images?.[0] || '/placeholder.png'} 
                              alt={product.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <h5 className="font-medium text-sm truncate">{product.name}</h5>
                              <p className="text-emerald-600 font-semibold">${product.price}</p>
                              <p className="text-xs text-slate-500">Stock: {product.stock}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="orders" className="mt-4">
                    {shopOrders.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                        No orders yet
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {shopOrders.slice(0, 10).map((order) => (
                          <div key={order.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                              <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">${order.total_amount?.toFixed(2)}</p>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                order.order_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                order.order_status === 'paid' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {order.order_status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="subscription" className="mt-4">
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="font-semibold text-lg">Subscription Details</h4>
                          <p className="text-slate-600 text-sm">Manage shop subscription and billing</p>
                        </div>
                        <Button onClick={() => openEditSubscription(selectedShop)} variant="outline" className="gap-2">
                          <Edit2 className="h-4 w-4" /> Edit
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Status</p>
                          <div className="mt-1">{getStatusBadge(selectedShop.subscription_status)}</div>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Payment Method</p>
                          <p className="font-semibold mt-1">{selectedShop.payment_method === 'card' ? 'Card (Stripe)' : 'Manual'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Plan Type</p>
                          <p className="font-semibold mt-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              selectedShop.plan_type === 'yearly' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {selectedShop.plan_type === 'yearly' ? 'Yearly' : selectedShop.plan_type === 'monthly' ? 'Monthly' : 'N/A'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Started</p>
                          <p className="font-semibold mt-1">
                            {selectedShop.subscription_start ? new Date(selectedShop.subscription_start).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Expires</p>
                          <p className="font-semibold mt-1">
                            {selectedShop.subscription_end ? new Date(selectedShop.subscription_end).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {selectedShop.subscription_status === 'pending' && (
                        <div className="mt-6 p-4 bg-amber-100 rounded-lg">
                          <p className="text-amber-800 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            This shop is waiting for approval. Click below to activate their subscription.
                          </p>
                          <Button 
                            onClick={() => handleApproveShop(selectedShop.id)} 
                            className="mt-3 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check className="h-4 w-4 mr-2" /> Approve & Activate
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Shop Dialog */}
        <Dialog open={editShopOpen} onOpenChange={setEditShopOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Shop</DialogTitle>
              <DialogDescription>Update shop information and commission rate</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Shop Name</Label>
                <Input 
                  value={editFormData.name} 
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={editFormData.email} 
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input 
                  value={editFormData.phone} 
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input 
                  value={editFormData.address} 
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={editFormData.description} 
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Commission Rate (%)</Label>
                <Input 
                  type="number"
                  placeholder={`Leave empty for default (${platformSettings.commission_percentage}%)`}
                  value={editFormData.commission_percentage} 
                  onChange={(e) => setEditFormData({ ...editFormData, commission_percentage: e.target.value })}
                />
              </div>
              {/* Commission Type - Radio Card Style */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4" data-testid="edit-commission-type-section">
                <h4 className="font-semibold text-violet-900 text-sm mb-1">Commission Type</h4>
                <p className="text-xs text-violet-600 mb-3">How the commission is applied to product prices</p>
                <div className="space-y-2">
                  {[
                    {
                      value: 'on_shop',
                      label: 'Commission on Shop',
                      desc: 'Customer sees listed price. Commission is deducted from shop revenue.',
                      example: `$10 product → Customer pays $10 → Shop gets $${(10 * (1 - (parseFloat(editFormData.commission_percentage) || 0) / 100)).toFixed(2)} → Admin gets $${(10 * (parseFloat(editFormData.commission_percentage) || 0) / 100).toFixed(2)}`,
                    },
                    {
                      value: 'on_customer',
                      label: 'Commission on Customer',
                      desc: 'Customer sees marked-up price. Shop gets full listed price.',
                      example: `$10 product → Customer pays $${(10 * (1 + (parseFloat(editFormData.commission_percentage) || 0) / 100)).toFixed(2)} → Shop gets $10.00 → Admin gets $${(10 * (parseFloat(editFormData.commission_percentage) || 0) / 100).toFixed(2)}`,
                    },
                    {
                      value: 'half_half',
                      label: 'Commission Half/Half',
                      desc: 'Commission split equally: half on customer markup, half on shop deduction.',
                      example: `$10 product → Customer pays $${(10 * (1 + (parseFloat(editFormData.commission_percentage) || 0) / 200)).toFixed(2)} → Shop gets $${(10 * (1 - (parseFloat(editFormData.commission_percentage) || 0) / 200)).toFixed(2)} → Admin gets $${(10 * (parseFloat(editFormData.commission_percentage) || 0) / 100).toFixed(2)}`,
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`block p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        editFormData.commission_type === option.value
                          ? 'border-violet-500 bg-violet-100/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      data-testid={`edit-commission-type-${option.value}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="edit_commission_type"
                          value={option.value}
                          checked={editFormData.commission_type === option.value}
                          onChange={() => setEditFormData({ ...editFormData, commission_type: option.value })}
                          className="mt-1 accent-violet-600"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-900">{option.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                          <p className="text-[11px] text-slate-400 mt-1 font-mono bg-slate-50 rounded px-2 py-1">{option.example}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Shop Logo URL</Label>
                <Input 
                  placeholder="Paste logo image URL"
                  value={editFormData.logo} 
                  onChange={(e) => setEditFormData({ ...editFormData, logo: e.target.value })}
                />
                {editFormData.logo && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={editFormData.logo} alt="Logo" className="w-12 h-12 object-cover rounded-lg border" onError={(e) => e.target.style.display='none'} />
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => setEditFormData({ ...editFormData, logo: '' })}>Remove</Button>
                  </div>
                )}
              </div>
              {/* Categories Multi-Select */}
              <div data-testid="admin-shop-categories-section">
                <div className="flex items-center justify-between mb-2">
                  <Label>Categories</Label>
                  {editFormData.category_ids.length > 0 && (
                    <span className="text-[10px] text-violet-600 font-bold bg-violet-50 rounded-full px-2 py-0.5 border border-violet-100">
                      {editFormData.category_ids.length} selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Categories this shop sells in.</p>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No categories available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto" data-testid="admin-shop-categories-chips">
                    {allCategories.map(cat => {
                      const selected = editFormData.category_ids.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleEditCategory(cat.id)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer select-none ${
                            selected
                              ? 'bg-violet-600 border-violet-600 text-white shadow-sm hover:bg-violet-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-violet-300 hover:text-violet-700'
                          }`}
                          data-testid={selected ? `admin-category-chip-selected-${cat.id}` : `admin-category-chip-unselected-${cat.id}`}
                        >
                          {cat.name}
                          {selected && <span className="ml-1.5 text-white/90">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditShopOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveShopEdit}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubscriptionOpen} onOpenChange={setEditSubscriptionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Subscription</DialogTitle>
              <DialogDescription>Change subscription status and expiration date</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Subscription Status</Label>
                <Select 
                  value={subscriptionFormData.subscription_status} 
                  onValueChange={(v) => setSubscriptionFormData({ ...subscriptionFormData, subscription_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiration Date</Label>
                <Input 
                  type="date"
                  value={subscriptionFormData.subscription_end} 
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, subscription_end: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Amount ($)</Label>
                <Input 
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount to add to admin revenue"
                  value={subscriptionFormData.payment_amount} 
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, payment_amount: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">This amount will be recorded as subscription revenue</p>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditSubscriptionOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveSubscription}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Approve & Configure Shop Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-emerald-100 rounded-lg"><Check className="h-5 w-5 text-emerald-600" /></div>
                Approve Shop
              </DialogTitle>
              <DialogDescription>Configure subscription, commission rate, and commission type for this shop</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              {/* Shop Info Summary */}
              {(() => {
                const requestedShop = shops.find(s => s.id === shopToActivate);
                if (requestedShop) {
                  return (
                    <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                      {requestedShop.logo ? (
                        <img src={requestedShop.logo} alt={requestedShop.name} className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                          <Store className="h-6 w-6 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{requestedShop.name}</p>
                        <p className="text-sm text-slate-500">{requestedShop.email || 'No email'}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Step 1: Subscription Toggle */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4" data-testid="subscription-toggle-section">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-blue-900 text-sm">Activate Subscription?</h4>
                    <p className="text-xs text-blue-600 mt-0.5">If disabled, shop pays no monthly subscription fees</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={activateSubscriptionRequired} onChange={(e) => setActivateSubscriptionRequired(e.target.checked)} className="sr-only peer" data-testid="subscription-required-toggle" />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {activateSubscriptionRequired && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <Label className="text-xs font-semibold text-blue-800">Subscription Duration</Label>
                    <Select value={activateMonths.toString()} onValueChange={(v) => setActivateMonths(parseInt(v))}>
                      <SelectTrigger className="mt-1 bg-white" data-testid="subscription-duration-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 month</SelectItem>
                        <SelectItem value="2">2 months</SelectItem>
                        <SelectItem value="3">3 months</SelectItem>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="12">12 months (Yearly)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-blue-700 mt-2">Subscription fee will be added to your admin profit ledger.</p>
                  </div>
                )}
              </div>

              {/* Welcome bonus notice */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2 text-xs text-violet-700" data-testid="approval-welcome-bonus-note">
                <Sparkles className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                <span>On approval the shop will receive {shopToActivate?.referred_by_agent_id ? (<><b>2 free product sponsors</b> + <b>$3 wallet credit</b></>) : (<><b>1 free product sponsor</b> + <b>$2 wallet credit</b></>)} as a welcome bonus (recorded as <b>New Shop Credits</b>).{shopToActivate?.referred_by_agent_id && <> This shop was <b>referred by {shopToActivate.referred_by_agent_name || 'an agent'}</b>, so it gets the boosted bonus.</>} An approval email is sent to the shop.</span>
              </div>

              {/* Step 2: Commission Rate */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="commission-rate-section">
                <h4 className="font-semibold text-amber-900 text-sm mb-1">Commission Rate</h4>
                <p className="text-xs text-amber-600 mb-3">Percentage taken from each sale for this shop</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={activateCommissionRate}
                    onChange={(e) => setActivateCommissionRate(e.target.value)}
                    className="bg-white w-28"
                    data-testid="commission-rate-input"
                  />
                  <span className="text-amber-800 font-bold">%</span>
                </div>
              </div>

              {/* Step 3: Commission Type */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4" data-testid="commission-type-section">
                <h4 className="font-semibold text-violet-900 text-sm mb-1">Commission Type</h4>
                <p className="text-xs text-violet-600 mb-3">How the commission is applied to product prices</p>
                <div className="space-y-2">
                  {[
                    {
                      value: 'on_shop',
                      label: 'Commission on Shop',
                      desc: 'Customer sees listed price. Commission is deducted from shop revenue.',
                      example: `$10 product → Customer pays $10 → Shop gets $${(10 * (1 - (parseFloat(activateCommissionRate) || 0) / 100)).toFixed(2)} → Admin gets $${(10 * (parseFloat(activateCommissionRate) || 0) / 100).toFixed(2)}`,
                      color: 'emerald'
                    },
                    {
                      value: 'on_customer',
                      label: 'Commission on Customer',
                      desc: 'Customer sees marked-up price. Shop gets full listed price.',
                      example: `$10 product → Customer pays $${(10 * (1 + (parseFloat(activateCommissionRate) || 0) / 100)).toFixed(2)} → Shop gets $10.00 → Admin gets $${(10 * (parseFloat(activateCommissionRate) || 0) / 100).toFixed(2)}`,
                      color: 'blue'
                    },
                    {
                      value: 'half_half',
                      label: 'Commission Half/Half',
                      desc: 'Commission split equally: half on customer markup, half on shop deduction.',
                      example: `$10 product → Customer pays $${(10 * (1 + (parseFloat(activateCommissionRate) || 0) / 200)).toFixed(2)} → Shop gets $${(10 * (1 - (parseFloat(activateCommissionRate) || 0) / 200)).toFixed(2)} → Admin gets $${(10 * (parseFloat(activateCommissionRate) || 0) / 100).toFixed(2)}`,
                      color: 'purple'
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`block p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        activateCommissionType === option.value
                          ? `border-${option.color}-400 bg-${option.color}-50 shadow-sm`
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      data-testid={`commission-type-${option.value}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="commission_type"
                          value={option.value}
                          checked={activateCommissionType === option.value}
                          onChange={() => setActivateCommissionType(option.value)}
                          className="mt-1 accent-violet-600"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-900">{option.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                          <p className="text-[11px] text-slate-400 mt-1 font-mono bg-slate-50 rounded px-2 py-1">{option.example}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={async () => {
                  try {
                    await api.admin.updateShop(shopToActivate, { status: 'rejected', subscription_status: 'rejected' });
                    toast.success('Shop application denied');
                    setActivateDialogOpen(false);
                    setShopToActivate(null);
                    fetchShops();
                  } catch (err) { toast.error('Failed to deny shop'); }
                }} className="bg-red-600 hover:bg-red-700" data-testid="deny-shop-btn">
                  <X className="h-4 w-4 mr-1" /> Deny
                </Button>
                <Button onClick={confirmActivation} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-approve-btn">
                  <Check className="h-4 w-4 mr-1" /> Approve Shop
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Wallet Adjust Dialog */}
        <Dialog open={walletAdjustOpen} onOpenChange={setWalletAdjustOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className={`h-5 w-5 ${walletAdjustType === 'add' ? 'text-emerald-600' : 'text-orange-600'}`} />
                {walletAdjustType === 'add' ? 'Add Funds' : 'Decrease Funds'} - {selectedShop?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 rounded-lg p-3 flex justify-between">
                <span className="text-sm text-slate-600">Current Balance</span>
                <span className="font-bold text-lg">${(selectedShop?.wallet_balance || 0).toFixed(2)}</span>
              </div>
              <div>
                <Label className="text-sm">Amount ($)</Label>
                <Input type="number" value={walletAdjustAmount} onChange={e => setWalletAdjustAmount(e.target.value)} placeholder="Enter amount" className="mt-1" data-testid="wallet-adjust-amount" />
              </div>
              <div>
                <Label className="text-sm">Note (optional)</Label>
                <Input value={walletAdjustNote} onChange={e => setWalletAdjustNote(e.target.value)} placeholder="Reason..." className="mt-1" />
              </div>
              <Button onClick={handleWalletAdjust} className={`w-full ${walletAdjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`} data-testid="confirm-wallet-adjust">
                {walletAdjustType === 'add' ? 'Add Funds' : 'Deduct Funds'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

        {/* Guest Application Edit Dialog - Improved */}
        <Dialog open={guestEditOpen} onOpenChange={setGuestEditOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 rounded-t-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-blue-100 rounded-lg"><Edit2 className="h-5 w-5 text-blue-600" /></div>
                  Edit Guest Application
                </DialogTitle>
                <DialogDescription>Update application details before approval</DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Shop Name *</Label>
                  <Input value={guestEditForm.shop_name || ''} onChange={e => setGuestEditForm({...guestEditForm, shop_name: e.target.value})} data-testid="guest-edit-shop-name" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Applicant Name *</Label>
                  <Input value={guestEditForm.guest_name || ''} onChange={e => setGuestEditForm({...guestEditForm, guest_name: e.target.value})} data-testid="guest-edit-name" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email *</Label>
                  <Input type="email" value={guestEditForm.email || ''} onChange={e => setGuestEditForm({...guestEditForm, email: e.target.value})} data-testid="guest-edit-email" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone *</Label>
                  <Input value={guestEditForm.phone || ''} onChange={e => setGuestEditForm({...guestEditForm, phone: e.target.value})} data-testid="guest-edit-phone" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Address *</Label>
                <Input value={guestEditForm.address || ''} onChange={e => setGuestEditForm({...guestEditForm, address: e.target.value})} data-testid="guest-edit-address" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">State *</Label>
                <Select value={guestEditForm.state || ''} onValueChange={(v) => setGuestEditForm({...guestEditForm, state: v})}>
                  <SelectTrigger className="mt-1" data-testid="guest-edit-state-select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {(states || []).map(s => (
                      <SelectItem key={s.id || s.name} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</Label>
                <Textarea value={guestEditForm.description || ''} onChange={e => setGuestEditForm({...guestEditForm, description: e.target.value})} rows={3} data-testid="guest-edit-description" className="mt-1" placeholder="Tell us about the shop..." />
              </div>
              <div data-testid="guest-edit-categories">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Categories</Label>
                  {(guestEditForm.category_ids || []).length > 0 && (
                    <span className="text-[10px] text-violet-600 font-bold bg-violet-50 rounded-full px-2 py-0.5 border border-violet-100">
                      {(guestEditForm.category_ids || []).length} selected
                    </span>
                  )}
                </div>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No categories available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                    {allCategories.map(cat => {
                      const selectedCats = guestEditForm.category_ids || [];
                      const selected = selectedCats.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const curr = guestEditForm.category_ids || [];
                            setGuestEditForm({
                              ...guestEditForm,
                              category_ids: selected ? curr.filter(id => id !== cat.id) : [...curr, cat.id]
                            });
                          }}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                            selected
                              ? 'bg-violet-600 border-violet-600 text-white shadow-sm hover:bg-violet-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-violet-300'
                          }`}
                        >
                          {cat.name}
                          {selected && <span className="ml-1 text-white/90">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end rounded-b-lg">
              <Button variant="outline" onClick={() => setGuestEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGuestEdit} data-testid="save-guest-edit" className="bg-blue-600 hover:bg-blue-700">
                <Check className="h-4 w-4 mr-1" /> Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Guest Application Approve Dialog - Improved */}
        <Dialog open={guestApproveOpen} onOpenChange={setGuestApproveOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 rounded-t-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-emerald-100 rounded-lg"><Check className="h-5 w-5 text-emerald-600" /></div>
                  Approve Guest Application
                </DialogTitle>
                <DialogDescription>Create a user account and shop for this applicant</DialogDescription>
              </DialogHeader>
            </div>
            {selectedGuestApp && (
              <div className="px-6 pb-6 space-y-5">
                {/* Applicant Summary Card */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    {selectedGuestApp.logo ? (
                      <img src={selectedGuestApp.logo} alt={selectedGuestApp.shop_name} className="w-14 h-14 rounded-xl object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                        <Store className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{selectedGuestApp.shop_name}</p>
                      <p className="text-xs text-slate-500 truncate">{selectedGuestApp.guest_name} • {selectedGuestApp.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        {selectedGuestApp.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedGuestApp.phone}</span>}
                        {selectedGuestApp.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedGuestApp.address}{selectedGuestApp.state ? `, ${selectedGuestApp.state}` : ''}</span>}
                      </div>
                    </div>
                  </div>
                  {selectedGuestApp.description && (
                    <p className="text-xs text-slate-600 mt-3 border-t border-slate-200/60 pt-3 italic">"{selectedGuestApp.description}"</p>
                  )}
                  {/* Applicant's selected categories */}
                  {(selectedGuestApp.category_ids || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Requested Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedGuestApp.category_ids || []).map(cid => {
                          const cat = allCategories.find(c => c.id === cid);
                          return cat ? (
                            <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200">
                              {cat.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Password — only for true guest applicants (non-logged-in) */}
                {(selectedGuestApp.is_logged_in_user || selectedGuestApp.user_id) ? (
                  <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-4">
                    <h4 className="font-semibold text-violet-900 text-sm mb-1 flex items-center gap-1.5">
                      <UserIcon className="h-4 w-4" /> Logged-in Applicant
                    </h4>
                    <p className="text-xs text-violet-600">This applicant already has a user account, so no password is needed. Approving will upgrade their existing account to a shop.</p>
                  </div>
                ) : (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 text-sm mb-1 flex items-center gap-1.5">
                      <Shield className="h-4 w-4" /> Set Account Password *
                    </h4>
                    <p className="text-xs text-blue-600 mb-3">This password will be used to log in to the shop account</p>
                    <Input 
                      type="password" 
                      placeholder="Min 6 characters" 
                      value={guestApproveForm.password} 
                      onChange={e => setGuestApproveForm({...guestApproveForm, password: e.target.value})}
                      data-testid="guest-approve-password"
                      className="bg-white"
                    />
                  </div>
                )}

                {/* Commission Rate */}
                <div>
                  <Label className="text-sm font-semibold mb-1 block flex items-center gap-1.5">
                    <Percent className="h-4 w-4 text-violet-600" /> Commission Rate (%)
                  </Label>
                  <p className="text-xs text-slate-500 mb-2">Percentage commission per order (default: 10%)</p>
                  <Input 
                    type="number" min="0" max="100" step="0.1"
                    value={guestApproveForm.commission_percentage} 
                    onChange={e => setGuestApproveForm({...guestApproveForm, commission_percentage: e.target.value})}
                    data-testid="guest-approve-commission"
                  />
                </div>

                {/* Referral Agent assignment */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4" data-testid="guest-approve-agent-section">
                  <Label className="text-sm font-semibold mb-1 block flex items-center gap-1.5 text-emerald-900">
                    <UserIcon className="h-4 w-4 text-emerald-600" /> Referring Agent
                  </Label>
                  {selectedGuestApp.referred_by_agent_id ? (
                    <p className="text-xs text-emerald-700 mb-2">
                      Detected from referral link: <span className="font-semibold">{selectedGuestApp.referred_by_agent_name || 'Agent'}</span>
                      {selectedGuestApp.referral_code ? <span className="font-mono"> ({selectedGuestApp.referral_code})</span> : null}. You can change it below.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-700 mb-2">No agent detected from a referral link. You can assign one manually (optional).</p>
                  )}
                  <select
                    value={guestApproveForm.referred_by_agent_id || ''}
                    onChange={e => {
                      const aid = e.target.value;
                      const ag = agents.find(a => a.id === aid);
                      setGuestApproveForm({
                        ...guestApproveForm,
                        referred_by_agent_id: aid,
                        agent_commission_share_percent: ag ? String(ag.commission_share_percent ?? 30) : (guestApproveForm.agent_commission_share_percent || '30'),
                      });
                    }}
                    className="w-full rounded-lg border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-medium"
                    data-testid="guest-approve-agent-select"
                  >
                    <option value="">— No referring agent —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.referral_code ? `(${a.referral_code})` : ''}
                      </option>
                    ))}
                  </select>

                  {guestApproveForm.referred_by_agent_id && (
                    <div className="mt-3">
                      <Label className="text-xs font-semibold mb-1 block text-emerald-900">Agent commission share (% of admin commission)</Label>
                      <Input
                        type="number" min="0" max="100" step="0.1"
                        value={guestApproveForm.agent_commission_share_percent}
                        onChange={e => setGuestApproveForm({ ...guestApproveForm, agent_commission_share_percent: e.target.value })}
                        data-testid="guest-approve-agent-share"
                        className="bg-white"
                      />
                      <p className="text-[11px] text-emerald-700 mt-2 leading-relaxed">
                        On approval the agent gets <b>$4</b> added to their wallet. They earn{' '}
                        <b>{parseFloat(guestApproveForm.agent_commission_share_percent) || 0}%</b> of the admin's commission on this shop's paid orders
                        {' '}≈ effective{' '}
                        <b>{(((parseFloat(guestApproveForm.commission_percentage) || 0) * (parseFloat(guestApproveForm.agent_commission_share_percent) || 0)) / 100).toFixed(2)}%</b>
                        {' '}of order value.
                      </p>
                    </div>
                  )}
                </div>

                {/* Commission Type Cards */}
                <div>
                  <Label className="text-sm font-semibold mb-1 block">Commission Type</Label>
                  <p className="text-xs text-slate-500 mb-2">How the commission is applied</p>
                  <div className="space-y-2">
                    {[
                      {
                        value: 'on_shop',
                        label: 'Commission on Shop',
                        desc: 'Customer sees listed price. Commission deducted from shop revenue.',
                        example: `$10 → Customer pays $10 → Shop gets $${(10 * (1 - (parseFloat(guestApproveForm.commission_percentage) || 0) / 100)).toFixed(2)} → Admin gets $${(10 * (parseFloat(guestApproveForm.commission_percentage) || 0) / 100).toFixed(2)}`,
                      },
                      {
                        value: 'on_customer',
                        label: 'Commission on Customer',
                        desc: 'Customer sees marked-up price. Shop gets full listed price.',
                        example: `$10 → Customer pays $${(10 * (1 + (parseFloat(guestApproveForm.commission_percentage) || 0) / 100)).toFixed(2)} → Shop gets $10.00 → Admin gets $${(10 * (parseFloat(guestApproveForm.commission_percentage) || 0) / 100).toFixed(2)}`,
                      },
                      {
                        value: 'half_half',
                        label: 'Commission Half/Half',
                        desc: 'Split equally: half on customer markup, half on shop deduction.',
                        example: `$10 → Customer pays $${(10 * (1 + (parseFloat(guestApproveForm.commission_percentage) || 0) / 200)).toFixed(2)} → Shop gets $${(10 * (1 - (parseFloat(guestApproveForm.commission_percentage) || 0) / 200)).toFixed(2)} → Admin gets $${(10 * (parseFloat(guestApproveForm.commission_percentage) || 0) / 100).toFixed(2)}`,
                      },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`block p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          guestApproveForm.commission_type === option.value
                            ? 'border-violet-500 bg-violet-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                        data-testid={`guest-commission-type-${option.value}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="guest_commission_type"
                            value={option.value}
                            checked={guestApproveForm.commission_type === option.value}
                            onChange={() => setGuestApproveForm({...guestApproveForm, commission_type: option.value})}
                            className="mt-1 accent-violet-600"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-slate-900">{option.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono bg-slate-50 rounded px-2 py-0.5 break-all">{option.example}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Subscription Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Require Subscription?</p>
                      <p className="text-xs text-slate-500">If off, shop pays no subscription; if on, fee is added to admin profit</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={guestApproveForm.subscription_required} onChange={e => setGuestApproveForm({...guestApproveForm, subscription_required: e.target.checked, subscription_fee: guestApproveForm.subscription_fee || '19', months: guestApproveForm.months || '1'})} className="sr-only peer" data-testid="guest-approve-sub-toggle" />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  {guestApproveForm.subscription_required && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200" data-testid="guest-subscription-fields">
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 mb-1 block">Subscription Fee (USD/month)</Label>
                        <Input type="number" min="0" step="0.5" value={guestApproveForm.subscription_fee ?? '19'} onChange={e => setGuestApproveForm({...guestApproveForm, subscription_fee: e.target.value})} data-testid="guest-approve-sub-fee" placeholder="19" />
                        <p className="text-[10px] text-slate-500 mt-1">Default $19/month. Goes to admin profit.</p>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 mb-1 block">Months</Label>
                        <Input type="number" min="1" max="12" value={guestApproveForm.months ?? '1'} onChange={e => setGuestApproveForm({...guestApproveForm, months: e.target.value})} data-testid="guest-approve-months" placeholder="1" />
                        <p className="text-[10px] text-slate-500 mt-1">Total: ${(parseFloat(guestApproveForm.subscription_fee || 19) * (parseInt(guestApproveForm.months || 1))).toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                  {guestApproveForm.subscription_required && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800" data-testid="guest-approve-subscription-benefits">
                      <p className="font-semibold flex items-center gap-1.5 mb-1"><Sparkles className="h-3.5 w-3.5 text-amber-600" /> Subscribed shop perks (granted each month from subscription date):</p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                        <li>1 free spin / month</li>
                        <li>2 product sponsors / month</li>
                        <li>Lower commissions</li>
                      </ul>
                    </div>
                  )}
                  {/* Welcome bonus note */}
                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-xs text-violet-700 flex items-start gap-2" data-testid="guest-approve-welcome-note">
                    <Sparkles className="h-4 w-4 mt-0.5 text-violet-600 shrink-0" />
                    <span>On approval the shop receives {guestApproveForm.referred_by_agent_id ? (<><b>2 free product sponsors</b> + <b>$3 wallet credit</b></>) : (<><b>1 free product sponsor</b> + <b>$2 wallet credit</b></>)} as a welcome bonus.{guestApproveForm.referred_by_agent_id && <> This is a <b>referred</b> application{selectedGuestApp?.referred_by_agent_name ? <> (by {selectedGuestApp.referred_by_agent_name})</> : null}, so it gets the boosted bonus.</>}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end rounded-b-lg">
              <Button variant="outline" onClick={() => setGuestApproveOpen(false)}>Cancel</Button>
              <Button onClick={handleApproveGuest} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-guest-approve">
                <Check className="h-4 w-4 mr-1" /> Approve & Create Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </AdminLayout>
  );
};

export default AdminShops;
