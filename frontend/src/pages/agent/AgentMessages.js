import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import { MessageSquare, Send, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import AgentLayout from '../../components/AgentLayout';
import MessageMenu from '../../components/MessageMenu';
import { api } from '../../lib/api';
import { AuthContext } from '../../App';
import { toast } from 'sonner';

const AgentMessages = () => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const agentId = user?.id;

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const loadConversation = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await api.messages.getConversations();
      // Find the conversation with admin (agent only ever talks to admin here)
      const convs = data?.conversations || [];
      const adminConv = convs.find(c => c.other_party?.type === 'admin') || convs[0];
      if (adminConv) {
        setConversationId(adminConv.conversation_id);
        const res = await api.messages.getConversation(adminConv.conversation_id);
        setMessages(res.data?.messages || []);
        scrollToBottom();
      } else {
        setMessages([]);
        setConversationId(null);
      }
    } catch (e) {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversation();
    const interval = setInterval(() => loadConversation(true), 12000);
    return () => clearInterval(interval);
  }, [loadConversation]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    // Optimistic append
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_id: agentId,
      sender_type: 'agent',
      sender_name: user?.name || 'You',
      recipient_type: 'admin',
      message: body,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    scrollToBottom();
    try {
      await api.messages.send({ recipient_id: 'admin', recipient_type: 'admin', message: body, subject: 'Agent Support' });
      await loadConversation(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const isMine = (m) => m.sender_type === 'agent' || m.sender_id === agentId;

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const submitEdit = async () => {
    const t = editText.trim(); if (!t) return;
    try { await api.messages.edit(editingId, t); setEditingId(null); setEditText(''); loadConversation(true); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to edit message'); }
  };
  const removeMsg = async (m) => {
    try { await api.messages.remove(m.id); loadConversation(true); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };

  return (
    <AgentLayout>
      <div className="px-4 sm:px-8 py-6 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
              <MessageSquare className="w-3.5 h-3.5" /><span>Support</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Messages</h1>
            <p className="text-white/90 text-sm">Chat directly with the OpenMarket admin team about your referrals, commissions and payouts.</p>
          </div>
        </div>

        {/* Chat window */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '420px' }} data-testid="agent-messages-window">
          {/* Conversation header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">OpenMarket Admin</p>
              <p className="text-xs text-slate-400">Support & Operations</p>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <MessageSquare className="h-10 w-10 mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No messages yet</p>
                <p className="text-xs mt-1">Send a message below to start a conversation with the admin team.</p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = isMine(m);
                const isEditing = editingId === m.id;
                return (
                  <div key={m.id} className={`flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`agent-msg-${mine ? 'out' : 'in'}`}>
                    {mine && !m.is_deleted && !isEditing && !m._optimistic && (
                      <MessageMenu onEdit={() => { setEditingId(m.id); setEditText(m.message || ''); }} onDelete={() => removeMsg(m)} />
                    )}
                    <div className={`max-w-[78%] sm:max-w-[60%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      mine
                        ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white rounded-br-md'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                    }`}>
                      {!mine && <p className="text-[11px] font-semibold text-violet-600 mb-0.5">{m.sender_name || 'Admin'}</p>}
                      {m.is_deleted ? (
                        <p className={`text-sm italic flex items-center gap-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}><Trash2 className="h-3 w-3" /> message deleted</p>
                      ) : isEditing ? (
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                          <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEdit(); } if (e.key === 'Escape') { setEditingId(null); setEditText(''); } }} autoFocus className="h-8 text-sm text-slate-800 bg-white rounded-md px-2 border border-white/40 outline-none" />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => { setEditingId(null); setEditText(''); }} className="text-[11px] text-white/80 hover:text-white">Cancel</button>
                            <button type="button" onClick={submitEdit} className="text-[11px] font-semibold text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                      )}
                      {!isEditing && (
                        <p className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                          {m.created_at ? new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          {m.is_edited && !m.is_deleted && <span className="italic">· edited</span>}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form onSubmit={handleSend} className="border-t border-slate-100 p-3 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
              rows={1}
              placeholder="Type a message to admin…"
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 max-h-32"
              data-testid="agent-message-input"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              data-testid="agent-message-send"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentMessages;
