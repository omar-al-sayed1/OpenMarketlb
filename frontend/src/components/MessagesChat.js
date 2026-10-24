import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare, Send, Search, Inbox, ChevronLeft, Store, Shield, User as UserIcon,
  Plus, ImagePlus, Paperclip, ShoppingBag, X, FileText, CheckCheck, Loader2, Trash2,
} from 'lucide-react';
import MessageMenu from './MessageMenu';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveImg = (url) => (url && url.startsWith('/') ? `${BACKEND_URL}${url}` : url);

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Modern, reusable chat experience for logged-in customers.
 * Used by the dedicated /messages page and the Profile "Messages" tab.
 * Supports messaging shops + admin, with photo / document / product attachments.
 */
const MessagesChat = ({ embedded = false, heightClass }) => {
  const { user } = useContext(AuthContext);
  const selfId = user?.id;

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [thread, setThread] = useState([]);
  const [convSearch, setConvSearch] = useState('');
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // pending attachment for the reply composer
  const [pendingAttachment, setPendingAttachment] = useState(null); // {type, url, name, product}
  const [uploading, setUploading] = useState(false);

  // Compose new conversation
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTarget, setComposeTarget] = useState('shop'); // 'shop' | 'admin'
  const [composeShopId, setComposeShopId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [shops, setShops] = useState([]);

  // product picker
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pickerProducts, setPickerProducts] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerShopId, setPickerShopId] = useState(null);
  const [pickerForCompose, setPickerForCompose] = useState(false);

  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const threadEndRef = useRef(null);

  const otherPartyType = selectedConversation?.other_party?.type;
  const otherPartyShopId = otherPartyType === 'shop' ? selectedConversation?.other_party?.id : null;

  // ---------- data fetching ----------
  const fetchConversations = async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const { data } = await api.messages.getConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      if (!silent) console.error('Failed to fetch conversations', e);
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.messages.getShopsList();
      setShops(data.shops || []);
    } catch (e) { /* noop */ }
  };

  const loadThread = async (conversationId, silent = false) => {
    if (!silent) setLoadingThread(true);
    try {
      const { data } = await api.messages.getConversation(conversationId);
      setThread(data.messages || []);
      fetchConversations(true); // refresh unread badges
    } catch (e) {
      if (!silent) console.error('Failed to load thread', e);
    } finally {
      if (!silent) setLoadingThread(false);
    }
  };

  // ---- Message edit / delete (sender only) ----
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const startEdit = (m) => { setEditingId(m.id); setEditText(m.message || ''); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const submitEdit = async () => {
    const text = editText.trim();
    if (!text) return;
    try {
      await api.messages.edit(editingId, text);
      cancelEdit();
      if (selectedConversation?.conversation_id) loadThread(selectedConversation.conversation_id, true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to edit message'); }
  };
  const handleDeleteMessage = async (m) => {
    try {
      await api.messages.remove(m.id);
      if (selectedConversation?.conversation_id) loadThread(selectedConversation.conversation_id, true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };

  useEffect(() => {
    fetchConversations();
    fetchShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll conversations + active thread for near-real-time updates
  useEffect(() => {
    const id = setInterval(() => {
      fetchConversations(true);
      if (selectedConversation?.conversation_id && !selectedConversation.conversation_id.startsWith('pending-')) {
        loadThread(selectedConversation.conversation_id, true);
      }
    }, 12000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setShowThreadMobile(true);
    setPendingAttachment(null);
    if (conv.conversation_id && !conv.conversation_id.startsWith('pending-')) {
      loadThread(conv.conversation_id);
    } else {
      setThread([]);
    }
  };

  // ---------- attachments ----------
  const uploadFile = async (file, onDone) => {
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await api.messages.uploadAttachment(file);
      onDone(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openProductPicker = async (forCompose = false) => {
    const shopId = forCompose ? composeShopId : otherPartyShopId;
    if (!shopId) {
      toast.error('Select a shop first to share a product');
      return;
    }
    setPickerForCompose(forCompose);
    setPickerShopId(shopId);
    setProductPickerOpen(true);
    setPickerLoading(true);
    try {
      const { data } = await api.products.getAll({ shop_id: shopId, limit: 60 });
      setPickerProducts(Array.isArray(data) ? data : (data.products || data.items || []));
    } catch (e) {
      setPickerProducts([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const handlePickProduct = (product) => {
    setPendingAttachment({ type: 'product', product_id: product.id, product });
    setProductPickerOpen(false);
  };

  // ---------- sending ----------
  const handleSendReply = async () => {
    if (!selectedConversation) return;
    if (!newMessage.trim() && !pendingAttachment) return;
    setSending(true);
    const op = selectedConversation.other_party;
    const payload = {
      recipient_id: op.id,
      recipient_type: op.type,
      message: newMessage.trim(),
    };
    if (pendingAttachment?.type === 'image') {
      payload.attachment_type = 'image';
      payload.attachment_url = pendingAttachment.url;
      payload.image_url = pendingAttachment.url;
    } else if (pendingAttachment?.type === 'document') {
      payload.attachment_type = 'document';
      payload.attachment_url = pendingAttachment.url;
      payload.attachment_name = pendingAttachment.name;
    } else if (pendingAttachment?.type === 'product') {
      payload.product_id = pendingAttachment.product_id;
    }
    try {
      await api.messages.send(payload);
      setNewMessage('');
      setPendingAttachment(null);
      if (selectedConversation.conversation_id?.startsWith('pending-')) {
        // refresh to obtain the real conversation
        const { data } = await api.messages.getConversations();
        const convs = data.conversations || [];
        setConversations(convs);
        const real = convs.find((c) => c.other_party?.id === op.id || (op.type === 'admin' && c.other_party?.type === 'admin'));
        if (real) {
          setSelectedConversation(real);
          loadThread(real.conversation_id);
        }
      } else {
        loadThread(selectedConversation.conversation_id);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleComposeSend = async () => {
    if (!composeText.trim() && !pendingAttachment) {
      toast.error('Write a message first');
      return;
    }
    if (composeTarget === 'shop' && !composeShopId) {
      toast.error('Select a shop');
      return;
    }
    setComposeSending(true);
    const payload = composeTarget === 'admin'
      ? { recipient_type: 'admin', message: composeText.trim() }
      : { recipient_id: composeShopId, recipient_type: 'shop', message: composeText.trim() };
    if (pendingAttachment?.type === 'image') {
      payload.attachment_type = 'image'; payload.attachment_url = pendingAttachment.url; payload.image_url = pendingAttachment.url;
    } else if (pendingAttachment?.type === 'document') {
      payload.attachment_type = 'document'; payload.attachment_url = pendingAttachment.url; payload.attachment_name = pendingAttachment.name;
    } else if (pendingAttachment?.type === 'product') {
      payload.product_id = pendingAttachment.product_id;
    }
    try {
      await api.messages.send(payload);
      const targetId = composeTarget === 'admin' ? 'admin' : composeShopId;
      setComposeOpen(false);
      setComposeText('');
      setComposeShopId('');
      setPendingAttachment(null);
      toast.success('Message sent');
      const { data } = await api.messages.getConversations();
      const convs = data.conversations || [];
      setConversations(convs);
      const target = convs.find((c) => c.other_party?.id === targetId || (composeTarget === 'admin' && c.other_party?.type === 'admin'));
      if (target) handleSelectConversation(target);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  // Build the displayed conversation list:
  //  - real conversations (most recent first)
  //  - plus placeholders for Admin + every shop the user hasn't messaged yet,
  //    so the user can always start a brand-new conversation (no "empty" dead-end).
  const displayConversations = useMemo(() => {
    const real = [...conversations].sort((a, b) => {
      const ta = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const tb = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return tb - ta;
    });
    const hasAdmin = real.some((c) => c.other_party?.type === 'admin');
    const existingShopIds = new Set(
      real.filter((c) => c.other_party?.type === 'shop').map((c) => c.other_party?.id)
    );

    const placeholders = [];
    if (!hasAdmin) {
      placeholders.push({
        conversation_id: 'pending-admin',
        other_party: { id: 'admin', type: 'admin', name: 'OpenMarket Support' },
        last_message: '',
        last_message_time: null,
        unread_count: 0,
        is_placeholder: true,
      });
    }
    const sortedShops = [...shops].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const s of sortedShops) {
      if (!existingShopIds.has(s.id)) {
        placeholders.push({
          conversation_id: `pending-shop-${s.id}`,
          other_party: { id: s.id, type: 'shop', name: s.name, logo: s.logo },
          last_message: '',
          last_message_time: null,
          unread_count: 0,
          is_placeholder: true,
        });
      }
    }
    return [...real, ...placeholders];
  }, [conversations, shops]);

  const filteredConversations = useMemo(
    () => displayConversations.filter((c) => (c.other_party?.name || '').toLowerCase().includes(convSearch.toLowerCase())),
    [displayConversations, convSearch]
  );
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + (c.unread_count || 0), 0), [conversations]);

  const partyIcon = (type, cls = 'h-5 w-5 text-white') =>
    type === 'shop' ? <Store className={cls} /> : type === 'admin' ? <Shield className={cls} /> : <UserIcon className={cls} />;

  const renderAttachment = (m, isMine) => {
    const isImage = (m.attachment_type === 'image') || (!m.attachment_type && m.image_url);
    if (isImage && (m.attachment_url || m.image_url)) {
      return (
        <img
          src={resolveImg(m.attachment_url || m.image_url)}
          alt="attachment"
          className="rounded-xl mb-1.5 max-h-56 w-auto object-cover cursor-pointer"
          onClick={() => window.open(resolveImg(m.attachment_url || m.image_url), '_blank')}
        />
      );
    }
    if (m.attachment_type === 'document' && m.attachment_url) {
      return (
        <a
          href={resolveImg(m.attachment_url)}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-2 mb-1.5 px-3 py-2 rounded-xl border ${isMine ? 'bg-white/15 border-white/25 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
        >
          <FileText className="h-5 w-5 flex-shrink-0" />
          <span className="text-xs font-medium truncate max-w-[180px]">{m.attachment_name || 'Document'}</span>
        </a>
      );
    }
    if (m.attachment_type === 'product' && m.product_snapshot) {
      const p = m.product_snapshot;
      return (
        <a
          href={`/products/${p.id}`}
          className={`flex items-center gap-2.5 mb-1.5 p-2 rounded-xl border ${isMine ? 'bg-white/15 border-white/25' : 'bg-slate-50 border-slate-200'}`}
        >
          {p.image ? (
            <img src={resolveImg(p.image)} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0"><ShoppingBag className="h-5 w-5 text-slate-400" /></div>
          )}
          <div className="min-w-0">
            <p className={`text-xs font-semibold truncate max-w-[150px] ${isMine ? 'text-white' : 'text-slate-800'}`}>{p.name}</p>
            <p className={`text-xs font-bold ${isMine ? 'text-white/90' : 'text-violet-600'}`}>${(p.discount_price || p.price || 0).toFixed?.(2) || p.price}</p>
          </div>
        </a>
      );
    }
    return null;
  };

  const containerHeight = heightClass || (embedded ? 'h-[70vh] min-h-[460px]' : 'h-[calc(100vh-9rem)] min-h-[520px]');

  return (
    <div className={`bg-white ${embedded ? 'sm:rounded-2xl sm:border sm:border-slate-100 sm:shadow-sm' : 'rounded-2xl border border-slate-100 shadow-sm'} overflow-hidden flex flex-col ${containerHeight}`} data-testid="messages-chat">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-violet-600" />
          <h2 className="font-heading font-semibold text-lg">Messages</h2>
          {totalUnread > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">{totalUnread} new</span>}
        </div>
        <Button
          onClick={() => { setComposeOpen(true); setPendingAttachment(null); setComposeText(''); }}
          className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          size="sm"
          data-testid="message-shop-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] flex-1 min-h-0">
        {/* Conversation list */}
        <div className={`border-r border-slate-100 ${showThreadMobile ? 'hidden lg:flex' : 'flex'} flex-col min-h-0`}>
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={convSearch} onChange={(e) => setConvSearch(e.target.value)} placeholder="Search conversations..." className="pl-9 h-9 rounded-xl text-sm" data-testid="conversation-search" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
            {loadingConvs ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No conversations yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a new message with a shop or admin.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedConversation?.conversation_id === conv.conversation_id;
                return (
                  <button
                    key={conv.conversation_id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-3 border-b border-slate-50 transition-colors ${isActive ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                    data-testid={`conversation-item-${conv.other_party?.id}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${conv.other_party?.type === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-violet-500 to-indigo-500'}`}>
                      {partyIcon(conv.other_party?.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">{conv.other_party?.name}</p>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(conv.last_message_time)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{conv.last_message || (conv.is_placeholder ? 'Start a conversation' : '')}</p>
                    </div>
                    {conv.unread_count > 0 && <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{conv.unread_count}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex-col min-h-0 ${showThreadMobile ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-3">
                <MessageSquare className="h-8 w-8 text-violet-500" />
              </div>
              <p className="text-slate-600 font-medium">Select a conversation</p>
              <p className="text-sm text-slate-400 mt-1">or start a new message to begin chatting.</p>
            </div>
          ) : (
            <>
              {/* thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
                <button className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setShowThreadMobile(false)} data-testid="thread-back-btn">
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${otherPartyType === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-violet-500 to-indigo-500'}`}>
                  {partyIcon(otherPartyType, 'h-4 w-4 text-white')}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{selectedConversation.other_party?.name}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{otherPartyType === 'admin' ? 'Admin' : otherPartyType}</p>
                </div>
              </div>

              {/* messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60" data-testid="message-thread">
                {loadingThread ? (
                  <div className="text-center text-slate-400 text-sm py-8">Loading...</div>
                ) : thread.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-8">No messages yet. Say hello!</div>
                ) : (
                  thread.map((m) => {
                    const isMine = m.sender_id === selfId || (user?.shop_id && m.sender_id === user.shop_id);
                    const isEditing = editingId === m.id;
                    return (
                      <div key={m.id} className={`flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {isMine && !m.is_deleted && !isEditing && (
                          <MessageMenu onEdit={() => startEdit(m)} onDelete={() => handleDeleteMessage(m)} />
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${isMine ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'}`}>
                          {m.is_deleted ? (
                            <p className={`text-sm italic flex items-center gap-1 ${isMine ? 'text-white/70' : 'text-slate-400'}`}><Trash2 className="h-3 w-3" /> message deleted</p>
                          ) : isEditing ? (
                            <div className="flex flex-col gap-1.5 min-w-[180px]">
                              <Input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEdit(); } if (e.key === 'Escape') cancelEdit(); }} className="h-8 text-sm text-slate-800 bg-white" autoFocus />
                              <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="text-[11px] text-white/80 hover:text-white">Cancel</button>
                                <button onClick={submitEdit} className="text-[11px] font-semibold text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30">Save</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {renderAttachment(m, isMine)}
                              {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                            </>
                          )}
                          {!isEditing && (
                            <p className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                              {formatTime(m.created_at)}
                              {m.is_edited && !m.is_deleted && <span className="italic">· edited</span>}
                              {isMine && <CheckCheck className="h-3 w-3" />}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* pending attachment preview */}
              {pendingAttachment && (
                <div className="px-3 pt-2 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl p-2">
                    {pendingAttachment.type === 'image' && <img src={resolveImg(pendingAttachment.url)} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                    {pendingAttachment.type === 'document' && <FileText className="h-6 w-6 text-violet-600" />}
                    {pendingAttachment.type === 'product' && (pendingAttachment.product?.image ? <img src={resolveImg(pendingAttachment.product.image)} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <ShoppingBag className="h-6 w-6 text-violet-600" />)}
                    <span className="text-xs text-slate-600 flex-1 truncate">
                      {pendingAttachment.type === 'image' && 'Photo attached'}
                      {pendingAttachment.type === 'document' && (pendingAttachment.name || 'Document attached')}
                      {pendingAttachment.type === 'product' && (pendingAttachment.product?.name || 'Product attached')}
                    </span>
                    <button onClick={() => setPendingAttachment(null)} className="p-1 rounded-full hover:bg-violet-100"><X className="h-4 w-4 text-slate-500" /></button>
                  </div>
                </div>
              )}

              {/* composer */}
              <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-1.5 flex-shrink-0">
                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, (d) => setPendingAttachment({ type: 'image', url: d.url })); e.target.value=''; }} />
                <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, (d) => setPendingAttachment({ type: 'document', url: d.url, name: d.filename })); e.target.value=''; }} />
                <Button variant="ghost" size="icon" onClick={() => photoInputRef.current?.click()} disabled={uploading} className="rounded-full text-slate-400 hover:text-violet-600 flex-shrink-0" title="Send photo" data-testid="attach-photo-btn">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => docInputRef.current?.click()} disabled={uploading} className="rounded-full text-slate-400 hover:text-violet-600 flex-shrink-0" title="Send document" data-testid="attach-doc-btn">
                  <Paperclip className="h-5 w-5" />
                </Button>
                {otherPartyShopId && (
                  <Button variant="ghost" size="icon" onClick={() => openProductPicker(false)} className="rounded-full text-slate-400 hover:text-violet-600 flex-shrink-0" title="Share a product" data-testid="attach-product-btn">
                    <ShoppingBag className="h-5 w-5" />
                  </Button>
                )}
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Type your message..."
                  className="flex-1 rounded-full h-10"
                  data-testid="reply-input"
                />
                <Button onClick={handleSendReply} disabled={sending || (!newMessage.trim() && !pendingAttachment)} className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 flex-shrink-0" data-testid="reply-send-btn">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== Compose dialog ===== */}
      <Dialog open={composeOpen} onOpenChange={(o) => { if (!o) { setComposeOpen(false); setPendingAttachment(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-violet-600" /> New Message</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setComposeTarget('shop')} className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${composeTarget === 'shop' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} data-testid="compose-target-shop">
                <Store className="h-4 w-4" /> A Shop
              </button>
              <button onClick={() => setComposeTarget('admin')} className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${composeTarget === 'admin' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} data-testid="compose-target-admin">
                <Shield className="h-4 w-4" /> Admin
              </button>
            </div>
            {composeTarget === 'shop' && (
              <div className="space-y-2">
                <Label>Select Shop</Label>
                <Select value={composeShopId} onValueChange={(v) => { setComposeShopId(v); if (pendingAttachment?.type === 'product') setPendingAttachment(null); }}>
                  <SelectTrigger data-testid="compose-shop-select"><SelectValue placeholder="Choose a shop..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id} data-testid={`compose-shop-option-${s.id}`}>
                        <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-violet-500" />{s.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Your Message</Label>
              <Textarea value={composeText} onChange={(e) => setComposeText(e.target.value)} placeholder="Type your message..." rows={4} data-testid="compose-message-input" />
            </div>
            {/* compose attachments */}
            <div className="flex items-center gap-2">
              <input type="file" id="compose-photo" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, (d) => setPendingAttachment({ type: 'image', url: d.url })); e.target.value=''; }} />
              <input type="file" id="compose-doc" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, (d) => setPendingAttachment({ type: 'document', url: d.url, name: d.filename })); e.target.value=''; }} />
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => document.getElementById('compose-photo').click()} disabled={uploading}><ImagePlus className="h-4 w-4 mr-1.5" /> Photo</Button>
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => document.getElementById('compose-doc').click()} disabled={uploading}><Paperclip className="h-4 w-4 mr-1.5" /> Document</Button>
              {composeTarget === 'shop' && composeShopId && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => openProductPicker(true)}><ShoppingBag className="h-4 w-4 mr-1.5" /> Product</Button>
              )}
            </div>
            {pendingAttachment && (
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl p-2">
                {pendingAttachment.type === 'image' && <img src={resolveImg(pendingAttachment.url)} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                {pendingAttachment.type === 'document' && <FileText className="h-6 w-6 text-violet-600" />}
                {pendingAttachment.type === 'product' && (pendingAttachment.product?.image ? <img src={resolveImg(pendingAttachment.product.image)} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <ShoppingBag className="h-6 w-6 text-violet-600" />)}
                <span className="text-xs text-slate-600 flex-1 truncate">
                  {pendingAttachment.type === 'image' && 'Photo attached'}
                  {pendingAttachment.type === 'document' && (pendingAttachment.name || 'Document attached')}
                  {pendingAttachment.type === 'product' && (pendingAttachment.product?.name || 'Product attached')}
                </span>
                <button onClick={() => setPendingAttachment(null)} className="p-1 rounded-full hover:bg-violet-100"><X className="h-4 w-4 text-slate-500" /></button>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setComposeOpen(false); setPendingAttachment(null); }}>Cancel</Button>
            <Button onClick={handleComposeSend} disabled={composeSending} className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="compose-send-btn">
              <Send className="h-4 w-4 mr-2" />{composeSending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Product picker ===== */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-violet-600" /> Share a Product</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {pickerLoading ? (
              <div className="py-10 text-center text-slate-400 text-sm"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading products...</div>
            ) : pickerProducts.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No products available from this shop.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {pickerProducts.map((p) => (
                  <button key={p.id} onClick={() => handlePickProduct(p)} className="text-left border border-slate-200 rounded-xl p-2 hover:border-violet-400 hover:bg-violet-50 transition-colors" data-testid={`picker-product-${p.id}`}>
                    {(p.image || (p.images && p.images[0])) ? (
                      <img src={resolveImg(p.image || p.images[0])} alt={p.name} className="w-full h-24 rounded-lg object-cover mb-1.5" />
                    ) : (
                      <div className="w-full h-24 rounded-lg bg-slate-100 flex items-center justify-center mb-1.5"><ShoppingBag className="h-6 w-6 text-slate-300" /></div>
                    )}
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs font-bold text-violet-600">${(p.discount_price || p.price || 0).toFixed?.(2) || p.price}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesChat;
