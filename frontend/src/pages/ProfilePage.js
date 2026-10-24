import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import {
  Package, User, Edit2, Save, X, Phone, MapPin, Building, Mail, XCircle, Gift, Star, Award, Crown,
  Medal, TrendingUp, MessageSquare, Send, Store, ChevronLeft, Search, ShoppingBag, Sparkles, ArrowRight, CheckCheck, Plus, Inbox,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import MessagesChat from '../components/MessagesChat';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ---- Animation variants ----
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.05 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};
const containerStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const tabMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const ProfilePage = () => {
  const { user, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelRequestStatuses, setCancelRequestStatuses] = useState({});
  const [cancelReasonDialog, setCancelReasonDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', phone: '', address: '', city: '', state: '', zip: '' });

  // ---- Messages state ----
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [shops, setShops] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeShopId, setComposeShopId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(true);
  const [convSearch, setConvSearch] = useState('');
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    fetchLoyalty();
    fetchConversations();
    fetchShops();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '', phone: user.phone || '', address: user.address || '',
        city: user.city || '', state: user.state || '', zip: user.zip || '',
      });
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data } = await api.orders.getAll();
      const sortedOrders = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(sortedOrders);
      const statuses = {};
      for (const order of sortedOrders) {
        if (order.order_status === 'pending' || order.cancel_request_status) {
          try {
            const { data: reqData } = await api.orders.getCancelRequestStatus(order.id);
            if (reqData.has_request) statuses[order.id] = reqData.request;
          } catch (e) {}
        }
      }
      setCancelRequestStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyalty = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([api.loyalty.getStatus(), api.loyalty.getHistory()]);
      setLoyaltyData(statusRes.data);
      setLoyaltyHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch loyalty data', error);
    }
  };

  // ---- Messages ----
  const fetchConversations = async () => {
    try {
      const { data } = await api.messages.getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    } finally {
      setMsgLoading(false);
    }
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.messages.getShopsList();
      setShops(data.shops || []);
    } catch (error) {
      console.error('Failed to fetch shops', error);
    }
  };

  const loadThread = async (conversationId) => {
    setThreadLoading(true);
    try {
      const { data } = await api.messages.getConversation(conversationId);
      setThread(data.messages || []);
      // refresh conversation list to clear unread badge
      fetchConversations();
    } catch (error) {
      console.error('Failed to load thread', error);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setShowThreadMobile(true);
    loadThread(conv.conversation_id);
  };

  const handleSendReply = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    setSending(true);
    try {
      await api.messages.send({
        recipient_id: selectedConversation.other_party.id,
        recipient_type: selectedConversation.other_party.type,
        message: newMessage.trim(),
      });
      setNewMessage('');
      await loadThread(selectedConversation.conversation_id);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!composeShopId) { toast.error('Please select a shop'); return; }
    if (!composeText.trim()) { toast.error('Message cannot be empty'); return; }
    setComposeSending(true);
    try {
      await api.messages.send({ recipient_id: composeShopId, recipient_type: 'shop', message: composeText.trim() });
      toast.success('Message sent!');
      const text = composeText.trim();
      setComposeOpen(false);
      setComposeText('');
      const targetShopId = composeShopId;
      setComposeShopId('');
      // reload conversations and open the one with this shop
      const { data } = await api.messages.getConversations();
      const convs = data.conversations || [];
      setConversations(convs);
      const conv = convs.find((c) => c.other_party?.id === targetShopId);
      if (conv) {
        handleSelectConversation(conv);
      } else {
        // fallback synthetic conversation so the user immediately sees their message
        const shop = shops.find((s) => s.id === targetShopId);
        setSelectedConversation({
          conversation_id: `pending-${targetShopId}`,
          other_party: { id: targetShopId, name: shop?.name || 'Shop', type: 'shop' },
        });
        setThread([{ id: 'tmp', sender_id: user?.id, sender_type: 'customer', message: text, created_at: new Date().toISOString() }]);
        setShowThreadMobile(true);
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  const filteredConversations = useMemo(
    () => conversations.filter((c) => (c.other_party?.name || '').toLowerCase().includes(convSearch.toLowerCase())),
    [conversations, convSearch]
  );

  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + (c.unread_count || 0), 0), [conversations]);

  const handleInputChange = (field, value) => setProfileData((prev) => ({ ...prev, [field]: value }));

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.users.updateProfile(profileData);
      setUser((prev) => ({ ...prev, ...profileData }));
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...storedUser, ...profileData }));
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileData({
      name: user?.name || '', phone: user?.phone || '', address: user?.address || '',
      city: user?.city || '', state: user?.state || '', zip: user?.zip || '',
    });
    setIsEditing(false);
  };

  const handleCancelOrder = (orderId) => setCancelReasonDialog(orderId);

  const submitCancelRequest = async () => {
    if (!cancelReasonDialog) return;
    setCancellingOrderId(cancelReasonDialog);
    try {
      await api.orders.requestCancel(cancelReasonDialog, cancelReason);
      toast.success('Cancellation request submitted! Admin will review it shortly.');
      setCancelReasonDialog(null);
      setCancelReason('');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit cancellation request');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return date.toLocaleDateString();
  };

  const initials = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const totalSpent = useMemo(
    () => orders.reduce((s, o) => s + (o.order_status !== 'cancelled' ? (o.total_amount || 0) : 0), 0),
    [orders]
  );

  const stats = [
    { label: 'Orders', value: orders.length, icon: ShoppingBag, grad: 'from-violet-500 to-indigo-500' },
    { label: 'Reward Points', value: (loyaltyData?.points_balance ?? 0).toLocaleString(), icon: Gift, grad: 'from-amber-500 to-orange-500' },
    { label: 'Total Spent', value: `$${totalSpent.toFixed(0)}`, icon: TrendingUp, grad: 'from-emerald-500 to-teal-500' },
    { label: 'Conversations', value: conversations.length, icon: MessageSquare, grad: 'from-fuchsia-500 to-pink-500' },
  ];

  const tabs = [
    { value: 'orders', label: 'Orders', icon: Package },
    { value: 'loyalty', label: 'Rewards', icon: Gift },
    { value: 'messages', label: 'Messages', icon: MessageSquare, badge: totalUnread },
    { value: 'profile', label: 'Profile', icon: User },
  ];

  const resolveImg = (url) => (url && url.startsWith('/') ? `${BACKEND_URL}${url}` : url);

  return (
    <div className="min-h-screen pb-16 bg-gradient-to-b from-slate-50 to-white">
      {/* ===== Animated Hero ===== */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-700" />
        {/* animated blobs */}
        <motion.div
          className="absolute -top-20 -left-10 w-72 h-72 rounded-full bg-fuchsia-500/30 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-400/30 blur-3xl"
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20 sm:pt-14 sm:pb-24">
          <motion.div initial="hidden" animate="show" variants={containerStagger} className="flex flex-col sm:flex-row sm:items-center gap-5">
            <motion.div variants={fadeUp} className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
                <span className="text-4xl sm:text-5xl font-black text-white" data-testid="profile-avatar-initial">{initials}</span>
              </div>
              <motion.span
                className="absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-emerald-400 border-2 sm:border-4 border-violet-700"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="min-w-0">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-white tracking-tight" data-testid="profile-page-title">
                {user?.name || 'My Account'}
              </h1>
              <p className="text-white/80 mt-1 flex items-center gap-2 text-sm sm:text-base">
                <Mail className="h-4 w-4" /> {user?.email}
              </p>
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" /> {user?.role || 'Member'}
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ===== Stat pills (overlapping hero) ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-14 relative z-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerStagger}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl shadow-xl shadow-violet-900/5 border border-slate-100 p-4 flex items-center gap-3"
                data-testid={`profile-stat-${s.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-none truncate">{s.value}</p>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">{s.label}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-white/70 backdrop-blur rounded-2xl p-1.5 border border-slate-100 shadow-sm flex flex-wrap h-auto gap-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  data-testid={`${t.value}-tab`}
                  className="relative rounded-xl px-3.5 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {t.label}
                  {t.badge > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {t.badge > 9 ? '9+' : t.badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ===== Orders ===== */}
          <TabsContent value="orders" data-testid="orders-content">
            <motion.div {...tabMotion}>
              {loading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-6 animate-pulse">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2">
                          <div className="h-3 w-20 bg-slate-200 rounded" />
                          <div className="h-5 w-44 bg-slate-200 rounded" />
                        </div>
                        <div className="h-5 w-24 bg-slate-200 rounded" />
                      </div>
                      <div className="border-t border-b py-4 my-4 flex items-center gap-3">
                        <div className="w-14 h-14 bg-slate-200 rounded-lg" />
                        <div className="flex-1 space-y-2"><div className="h-4 w-40 bg-slate-200 rounded" /><div className="h-3 w-20 bg-slate-200 rounded" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center" data-testid="no-orders">
                  <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No orders yet</p>
                  <p className="text-slate-400 text-sm mt-1">Your orders will appear here once you start shopping.</p>
                </div>
              ) : (
                <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-5">
                  {orders.map((order, idx) => (
                    <motion.div
                      key={order.id}
                      variants={fadeUp}
                      custom={idx}
                      whileHover={{ y: -2 }}
                      className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow border border-slate-100 p-5 sm:p-6"
                      data-testid={`order-${order.id}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Order ID</p>
                          <p className="font-heading font-bold text-lg" data-testid="profile-order-id">#{order.id?.slice(0, 8).toUpperCase()}</p>
                          {order.guest_name && <p className="text-sm text-slate-600 mt-1">Customer: {order.guest_name}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Date</p>
                          <p className="font-semibold" data-testid="order-date">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="border-t border-b border-slate-100 py-4 my-4 space-y-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3" data-testid="order-item">
                            {item.image && <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.name}</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.selected_color && <span className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full">Color: {item.selected_color}</span>}
                                {item.selected_size && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Size: {item.selected_size}</span>}
                                {item.selected_shape && <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">Shape: {item.selected_shape}</span>}
                              </div>
                              <p className="text-sm text-slate-600">Qty: {item.quantity}</p>
                            </div>
                            <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-slate-600">Status:</span>
                          <span
                            className="inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize"
                            style={{
                              backgroundColor: order.order_status === 'paid' || order.order_status === 'delivered' ? '#f0fdf4' : order.order_status === 'pending' ? '#fef9c3' : order.order_status === 'cancelled' ? '#fee2e2' : '#fef2f2',
                              color: order.order_status === 'paid' || order.order_status === 'delivered' ? '#166534' : order.order_status === 'pending' ? '#854d0e' : order.order_status === 'cancelled' ? '#dc2626' : '#991b1b',
                            }}
                            data-testid="order-status-badge"
                          >
                            {order.order_status}
                          </span>
                          {order.order_status === 'pending' && !cancelRequestStatuses[order.id] && (
                            <Button onClick={() => handleCancelOrder(order.id)} disabled={cancellingOrderId === order.id} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid={`cancel-order-${order.id}`}>
                              <XCircle className="h-4 w-4 mr-1" />
                              {cancellingOrderId === order.id ? 'Requesting...' : 'Request Cancellation'}
                            </Button>
                          )}
                          {cancelRequestStatuses[order.id]?.status === 'pending' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700" data-testid={`cancel-status-${order.id}`}>Cancellation Pending</span>}
                          {cancelRequestStatuses[order.id]?.status === 'approved' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700" data-testid={`cancel-status-${order.id}`}>Cancelled</span>}
                          {cancelRequestStatuses[order.id]?.status === 'rejected' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700" data-testid={`cancel-status-${order.id}`}>Cancel Request Rejected</span>}
                          {['picked_up', 'in_transit', 'shipped'].includes((order.delivery_status || '').toLowerCase()) && order.order_status !== 'delivered' && (
                            <a href={`/track-order/${order.id}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors animate-pulse" data-testid={`track-order-${order.id}`}>
                              <MapPin className="h-3.5 w-3.5" /> Track order (live)
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          {order.loyalty_points_redeemed > 0 && <div className="text-xs text-amber-600 mb-1">{order.loyalty_points_redeemed} pts redeemed (-${(order.loyalty_discount_amount || 0).toFixed(2)})</div>}
                          <span className="text-sm text-slate-600 mr-2">Total:</span>
                          <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent" data-testid="profile-order-total">${order.total_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </TabsContent>

          {/* ===== Rewards ===== */}
          <TabsContent value="loyalty" data-testid="loyalty-content">
            <motion.div {...tabMotion}>
              {loyaltyData && loyaltyData.enabled ? (
                <div className="space-y-6">
                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 rounded-3xl p-6 shadow-lg">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
                    <div className="relative flex items-center justify-between flex-wrap gap-4 text-white">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                          {loyaltyData.tier?.name === 'Gold' ? <Crown className="h-8 w-8" /> : loyaltyData.tier?.name === 'Silver' ? <Award className="h-8 w-8" /> : <Medal className="h-8 w-8" />}
                        </div>
                        <div>
                          <p className="text-sm text-white/80 font-medium">Your Tier</p>
                          <h3 className="text-2xl font-heading font-bold">{loyaltyData.tier?.name || 'Bronze'}</h3>
                          <p className="text-sm text-white/80">{loyaltyData.tier?.multiplier}x points multiplier</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/80">Available Points</p>
                        <p className="text-3xl font-bold">{loyaltyData.points_balance?.toLocaleString()}</p>
                        <p className="text-sm text-white/90 font-medium">Worth ${loyaltyData.redeem_value?.toFixed(2)}</p>
                      </div>
                    </div>
                    {loyaltyData.next_tier && (
                      <div className="relative mt-4 text-white">
                        <div className="flex justify-between text-xs mb-1 text-white/90">
                          <span>{loyaltyData.tier?.name}</span>
                          <span>{loyaltyData.next_tier.name} ({loyaltyData.next_tier.min_points} pts)</span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-2.5 overflow-hidden">
                          <motion.div className="bg-white h-2.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${loyaltyData.progress_to_next_tier}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                        </div>
                        <p className="text-xs text-white/90 mt-1">{loyaltyData.next_tier.min_points - loyaltyData.points_lifetime} more points to {loyaltyData.next_tier.name}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Your Benefits</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(loyaltyData.tier?.benefits || []).map((b, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                          <span className="text-sm text-amber-900">{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: TrendingUp, color: 'text-emerald-500', value: loyaltyData.points_lifetime?.toLocaleString(), label: 'Lifetime Points' },
                      { icon: Gift, color: 'text-violet-500', value: loyaltyData.points_balance?.toLocaleString(), label: 'Available' },
                      { icon: Star, color: 'text-amber-500', value: loyaltyData.points_per_dollar, label: 'Pts per $1' },
                    ].map((c, i) => {
                      const Icon = c.icon;
                      return (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
                          <Icon className={`h-5 w-5 ${c.color} mx-auto mb-1`} />
                          <p className="text-xl font-bold">{c.value}</p>
                          <p className="text-xs text-slate-500">{c.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-lg mb-3">Points History</h3>
                    {loyaltyHistory.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No points activity yet. Start shopping to earn rewards!</p>
                    ) : (
                      <div className="space-y-2">
                        {loyaltyHistory.map((e, i) => (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${e.type === 'earn' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                            <div><p className="text-sm font-medium">{e.description}</p><p className="text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString()}</p></div>
                            <span className={`font-bold ${e.type === 'earn' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.type === 'earn' ? '+' : ''}{e.points}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
                  <Gift className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg text-slate-600">Loyalty Program</h3>
                  <p className="text-sm text-slate-400 mt-1">The loyalty rewards program is currently inactive.</p>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ===== Messages ===== */}
          <TabsContent value="messages" data-testid="messages-content" className="-mx-4 sm:mx-0">
            <motion.div {...tabMotion}>
              <MessagesChat embedded />
            </motion.div>
          </TabsContent>

          {/* ===== Profile ===== */}
          <TabsContent value="profile" data-testid="profile-content">
            <motion.div {...tabMotion}>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <h2 className="font-heading font-semibold text-2xl">Profile Information</h2>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-full" data-testid="edit-profile-btn">
                      <Edit2 className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile} disabled={saving} className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="save-profile-btn">
                        <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" className="rounded-full" data-testid="cancel-edit-btn">
                        <X className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="edit-profile-form">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2"><User className="h-4 w-4 text-slate-500" /> Full Name</Label>
                      <Input id="name" value={profileData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Enter your full name" data-testid="profile-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" /> Email</Label>
                      <Input id="email" value={user?.email || ''} disabled className="bg-slate-50" data-testid="profile-email-input" />
                      <p className="text-xs text-slate-500">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" /> Phone Number</Label>
                      <Input id="phone" value={profileData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="Enter your phone number" data-testid="profile-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-500" /> Street Address</Label>
                      <Input id="address" value={profileData.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Enter your street address" data-testid="profile-address-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="flex items-center gap-2"><Building className="h-4 w-4 text-slate-500" /> City</Label>
                      <Input id="city" value={profileData.city} onChange={(e) => handleInputChange('city', e.target.value)} placeholder="Enter your city" data-testid="profile-city-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" value={profileData.state} onChange={(e) => handleInputChange('state', e.target.value)} placeholder="State" data-testid="profile-state-input" /></div>
                      <div className="space-y-2"><Label htmlFor="zip">ZIP Code</Label><Input id="zip" value={profileData.zip} onChange={(e) => handleInputChange('zip', e.target.value)} placeholder="ZIP" data-testid="profile-zip-input" /></div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div><p className="text-sm text-slate-600 flex items-center gap-2"><User className="h-4 w-4" /> Name</p><p className="font-semibold text-lg" data-testid="user-name">{user?.name || '-'}</p></div>
                      <div><p className="text-sm text-slate-600 flex items-center gap-2"><Mail className="h-4 w-4" /> Email</p><p className="font-semibold text-lg" data-testid="user-email">{user?.email || '-'}</p></div>
                      <div><p className="text-sm text-slate-600 flex items-center gap-2"><Phone className="h-4 w-4" /> Phone</p><p className="font-semibold text-lg" data-testid="user-phone">{user?.phone || '-'}</p></div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-slate-600 flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</p>
                        <p className="font-semibold text-lg" data-testid="user-address">
                          {user?.address || '-'}{user?.city && `, ${user.city}`}{user?.state && `, ${user.state}`}{user?.zip && ` ${user.zip}`}
                        </p>
                      </div>
                      <div><p className="text-sm text-slate-600">Role</p><p className="font-semibold text-lg capitalize" data-testid="user-role">{user?.role || '-'}</p></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== Cancel Request Dialog ===== */}
      <Dialog open={!!cancelReasonDialog} onOpenChange={(open) => { if (!open) { setCancelReasonDialog(null); setCancelReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" /> Request Order Cancellation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">Your cancellation request will be reviewed by the admin. Please provide a reason for cancellation.</p>
            <div>
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why do you want to cancel this order?" className="mt-1" data-testid="cancel-reason-input" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelReasonDialog(null); setCancelReason(''); }} data-testid="cancel-dialog-close">Never Mind</Button>
            <Button variant="destructive" onClick={submitCancelRequest} disabled={cancellingOrderId === cancelReasonDialog} data-testid="submit-cancel-request">
              {cancellingOrderId === cancelReasonDialog ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Compose new message to shop ===== */}
      <Dialog open={composeOpen} onOpenChange={(open) => { if (!open) { setComposeOpen(false); setComposeText(''); setComposeShopId(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-violet-600" /> Message a Shop</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Shop</Label>
              <Select value={composeShopId} onValueChange={setComposeShopId}>
                <SelectTrigger data-testid="compose-shop-select"><SelectValue placeholder="Choose a shop to message..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`compose-shop-option-${s.id}`}>
                      <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-violet-500" />{s.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shops.length === 0 && <p className="text-xs text-slate-400">No shops available to message right now.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-text">Your Message</Label>
              <Textarea id="compose-text" value={composeText} onChange={(e) => setComposeText(e.target.value)} placeholder="Ask about products, availability, delivery..." rows={5} data-testid="compose-message-input" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setComposeOpen(false); setComposeText(''); setComposeShopId(''); }}>Cancel</Button>
            <Button onClick={handleStartConversation} disabled={composeSending} className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="compose-send-btn">
              <Send className="h-4 w-4 mr-2" />{composeSending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
