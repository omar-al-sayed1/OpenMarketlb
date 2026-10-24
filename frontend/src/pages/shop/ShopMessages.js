import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Search, Inbox, Clock, CheckCheck, User, X, Shield, ImagePlus, Paperclip, ShoppingBag, FileText, Trash2 } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import MessageMenu from '../../components/MessageMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveImg = (url) => (url && url.startsWith('/') ? `${BACKEND_URL}${url}` : url);

const renderShopAttachment = (msg, isMine) => {
  const isImage = msg.attachment_type === 'image' || (!msg.attachment_type && msg.image_url);
  if (isImage && (msg.attachment_url || msg.image_url)) {
    return <img src={resolveImg(msg.attachment_url || msg.image_url)} alt="Shared" className="rounded-lg max-w-full max-h-48 object-cover mb-2 cursor-pointer" onClick={() => window.open(resolveImg(msg.attachment_url || msg.image_url), '_blank')} />;
  }
  if (msg.attachment_type === 'document' && msg.attachment_url) {
    return <a href={resolveImg(msg.attachment_url)} target="_blank" rel="noreferrer" className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border ${isMine ? 'bg-white/15 border-white/25 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}><FileText className="h-5 w-5" /><span className="text-xs truncate max-w-[180px]">{msg.attachment_name || 'Document'}</span></a>;
  }
  if (msg.attachment_type === 'product' && msg.product_snapshot) {
    const p = msg.product_snapshot;
    return <a href={`/products/${p.id}`} className={`flex items-center gap-2 mb-2 p-2 rounded-lg border ${isMine ? 'bg-white/15 border-white/25' : 'bg-slate-50 border-slate-200'}`}>{p.image ? <img src={resolveImg(p.image)} alt="" className="w-11 h-11 rounded object-cover" /> : <ShoppingBag className="h-5 w-5 text-slate-400" />}<div className="min-w-0"><p className={`text-xs font-semibold truncate max-w-[140px] ${isMine ? 'text-white' : 'text-slate-800'}`}>{p.name}</p><p className={`text-xs font-bold ${isMine ? 'text-white/90' : 'text-emerald-600'}`}>${p.price}</p></div></a>;
  }
  return null;
};

const ShopMessages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConvList, setShowConvList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [shopProducts, setShopProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // When a conversation is opened (or its messages update), land on the LATEST message.
  useEffect(() => {
    if (selectedConversation && messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selectedConversation]);

  const handleImageUpload = async (file, onSuccess) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/api/upload/attachment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) onSuccess(data.url);
      else toast.error('Upload failed');
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const openProductPicker = async () => {
    setProductPickerOpen(true);
    if (!productsLoaded) {
      try {
        const { data } = await api.shop.getProducts();
        setShopProducts(Array.isArray(data) ? data : (data.products || []));
        setProductsLoaded(true);
      } catch (e) { setShopProducts([]); }
    }
  };

  const handleSendProduct = (product) => {
    setProductPickerOpen(false);
    handleSendReply({ type: 'product', product_id: product.id });
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const { data } = await api.messages.getConversations();
      setConversations(data.conversations);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    }
  };

  const fetchConversationMessages = async (conversationId) => {
    try {
      const { data } = await api.messages.getConversation(conversationId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchConversationMessages(conversation.conversation_id);
    setShowConvList(false);
  };

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const submitEdit = async () => {
    const t = editText.trim(); if (!t) return;
    try { await api.messages.edit(editingId, t); setEditingId(null); setEditText(''); if (selectedConversation) fetchConversationMessages(selectedConversation.conversation_id); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to edit message'); }
  };
  const removeMsg = async (m) => {
    try { await api.messages.remove(m.id); if (selectedConversation) fetchConversationMessages(selectedConversation.conversation_id); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };

  const handleSendReply = async (attachment = null) => {
    if (!newMessage.trim() && !attachment) return;
    if (!selectedConversation) return;
    const payload = {
      recipient_id: selectedConversation.other_party.id,
      recipient_type: selectedConversation.other_party.type,
      message: newMessage || '',
    };
    if (attachment?.type === 'image') {
      payload.attachment_type = 'image'; payload.attachment_url = attachment.url; payload.image_url = attachment.url;
    } else if (attachment?.type === 'document') {
      payload.attachment_type = 'document'; payload.attachment_url = attachment.url; payload.attachment_name = attachment.name;
    } else if (attachment?.type === 'product') {
      payload.product_id = attachment.product_id;
    }
    try {
      await api.messages.send(payload);
      setNewMessage('');
      fetchConversationMessages(selectedConversation.conversation_id);
      fetchConversations();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to send message');
    }
  };

  const handleComposeMessage = async () => {
    if (!composeMessage.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    try {
      await api.messages.send({
        recipient_id: 'admin',
        recipient_type: 'admin',
        subject: composeSubject,
        message: composeMessage,
      });
      setComposeDialogOpen(false);
      setComposeSubject('');
      setComposeMessage('');
      fetchConversations();
      toast.success('Message sent to admin!');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_party.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <ShopLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]" data-testid="shop-messages-content">
        {/* Header */}
        <div className="bg-white border-b px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {!showConvList && selectedConversation && (
              <button onClick={() => setShowConvList(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-xl lg:text-2xl font-heading font-bold" data-testid="shop-messages-title">Messages</h1>
          </div>
          <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-full">
                <Send className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Contact Admin</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Message Admin</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-sm">Subject</Label>
                  <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Optional subject..." className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Message *</Label>
                  <Textarea value={composeMessage} onChange={(e) => setComposeMessage(e.target.value)} placeholder="Type your message..." rows={4} className="mt-1" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleComposeMessage} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <Send className="h-4 w-4 mr-1.5" /> Send
                  </Button>
                  <Button variant="outline" onClick={() => setComposeDialogOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversations List */}
          <div className={`${showConvList ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 flex-col bg-white border-r border-slate-200 flex-shrink-0`}>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm rounded-xl bg-slate-50" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Send a message to admin to start</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.conversation_id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3.5 border-b border-slate-100 transition-colors ${
                      selectedConversation?.conversation_id === conv.conversation_id
                        ? 'bg-emerald-50 border-l-3 border-l-emerald-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        conv.other_party.type === 'admin' ? 'bg-violet-100' : 'bg-emerald-100'
                      }`}>
                        {conv.other_party.type === 'admin' 
                          ? <Shield className="h-4 w-4 text-violet-600" />
                          : <User className="h-4 w-4 text-emerald-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {conv.other_party.name}
                          </span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                            {formatTime(conv.last_message_time)}
                          </span>
                        </div>
                        {conv.subject && <p className="text-xs font-medium text-emerald-600 truncate">{conv.subject}</p>}
                        <p className="text-xs text-slate-500 truncate">{conv.last_message}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${!showConvList || !selectedConversation ? '' : 'hidden lg:flex'} flex-1 flex flex-col bg-slate-50`}>
            {selectedConversation ? (
              <>
                <div className="px-4 py-3 bg-white border-b flex items-center gap-3 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedConversation.other_party.type === 'admin' ? 'bg-violet-100' : 'bg-emerald-100'
                  }`}>
                    {selectedConversation.other_party.type === 'admin'
                      ? <Shield className="h-4 w-4 text-violet-600" />
                      : <User className="h-4 w-4 text-emerald-600" />
                    }
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">{selectedConversation.other_party.name}</h2>
                    <p className="text-[10px] text-slate-500 capitalize">{selectedConversation.other_party.type}</p>
                  </div>
                </div>
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map(msg => {
                    const mine = msg.sender_type === 'shop';
                    const isEditing = editingId === msg.id;
                    return (
                    <div key={msg.id} className={`flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {mine && !msg.is_deleted && !isEditing && (
                        <MessageMenu onEdit={() => { setEditingId(msg.id); setEditText(msg.message || ''); }} onDelete={() => removeMsg(msg)} />
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                      }`}>
                        {msg.is_deleted ? (
                          <p className={`text-sm italic flex items-center gap-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}><Trash2 className="h-3 w-3" /> message deleted</p>
                        ) : isEditing ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEdit(); } if (e.key === 'Escape') { setEditingId(null); setEditText(''); } }} autoFocus className="h-8 text-sm text-slate-800 bg-white rounded-md px-2 border border-white/40 outline-none" />
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setEditingId(null); setEditText(''); }} className="text-[11px] text-white/80 hover:text-white">Cancel</button>
                              <button type="button" onClick={submitEdit} className="text-[11px] font-semibold text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {renderShopAttachment(msg, mine)}
                            {msg.message && msg.message !== '(photo)' && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                          </>
                        )}
                        {!isEditing && (
                          <div className={`flex items-center gap-1 mt-1.5 ${mine ? 'text-emerald-200' : 'text-slate-400'}`}>
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.is_edited && !msg.is_deleted && <span className="text-[10px] italic">· edited</span>}
                            {mine && <CheckCheck className="h-3 w-3 ml-1" />}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="p-3 bg-white border-t flex-shrink-0">
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, (url) => handleSendReply({ type: 'image', url }));
                        e.target.value = '';
                      }}
                    />
                    <input
                      type="file"
                      ref={docInputRef}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, (url) => handleSendReply({ type: 'document', url, name: file.name }));
                        e.target.value = '';
                      }}
                    />
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-xl text-slate-400 hover:text-emerald-600 px-2" title="Send photo">
                      <ImagePlus className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => docInputRef.current?.click()} disabled={uploading} className="rounded-xl text-slate-400 hover:text-emerald-600 px-2" title="Send document">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    {selectedConversation.other_party.type !== 'admin' && (
                      <Button variant="ghost" size="sm" onClick={openProductPicker} className="rounded-xl text-slate-400 hover:text-emerald-600 px-2" title="Share a product">
                        <ShoppingBag className="h-5 w-5" />
                      </Button>
                    )}
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                      className="flex-1 rounded-xl bg-slate-50"
                    />
                    <Button onClick={() => handleSendReply()} disabled={!newMessage.trim() && !uploading} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="text-slate-500 font-medium">Select a conversation</p>
                  <p className="text-sm text-slate-400 mt-1">Or contact admin for support</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product picker */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-emerald-600" /> Share a Product</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 mt-2">
            {shopProducts.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No products to share.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {shopProducts.map((p) => (
                  <button key={p.id} onClick={() => handleSendProduct(p)} className="text-left border border-slate-200 rounded-xl p-2 hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                    {(p.image || (p.images && p.images[0])) ? (
                      <img src={resolveImg(p.image || p.images[0])} alt={p.name} className="w-full h-24 rounded-lg object-cover mb-1.5" />
                    ) : (
                      <div className="w-full h-24 rounded-lg bg-slate-100 flex items-center justify-center mb-1.5"><ShoppingBag className="h-6 w-6 text-slate-300" /></div>
                    )}
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs font-bold text-emerald-600">${(p.discount_price || p.price || 0).toFixed?.(2) || p.price}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ShopLayout>
  );
};

export default ShopMessages;
