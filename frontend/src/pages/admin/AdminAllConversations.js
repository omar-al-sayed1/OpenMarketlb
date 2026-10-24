import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MessageSquare, Search, X, Inbox, Store, Shield, User as UserIcon, FileText, ShoppingBag, MessagesSquare, Trash2, Eye, EyeOff } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveImg = (url) => (url && url.startsWith('/') ? `${BACKEND_URL}${url}` : url);

const partyIcon = (type) => type === 'shop' ? <Store className="h-4 w-4" /> : type === 'admin' ? <Shield className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />;

const formatTime = (d) => {
  if (!d) return '';
  const date = new Date(d); const now = new Date(); const diff = now - date;
  if (diff < 86400000 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const AdminAllConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(true);
  const messagesContainerRef = useRef(null);

  // When a conversation is opened (or its messages update), land on the LATEST message.
  useEffect(() => {
    if (selected && messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selected]);

  useEffect(() => { fetchConversations(); }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.messages.adminGetConversations();
      setConversations(data.conversations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openConversation = async (conv) => {
    setSelected(conv);
    setShowList(false);
    try {
      const { data } = await api.messages.adminGetConversation(conv.conversation_id);
      setMessages(data.messages || []);
    } catch (e) { setMessages([]); }
  };

  const [revealed, setRevealed] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const adminDelete = async (m) => {
    try {
      await api.messages.adminDeleteMessage(m.id);
      if (selected) {
        const { data } = await api.messages.adminGetConversation(selected.conversation_id);
        setMessages(data.messages || []);
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };
  const DeleteBtn = ({ m }) => (
    <button onClick={() => setConfirmDelete(m)} title="Delete this message (admin)" className="p-1 rounded-full text-slate-300 hover:text-red-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" data-testid={`admin-delete-msg-${m.id}`}>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );

  const filtered = useMemo(() => conversations.filter(c =>
    (c.party_a?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.party_b?.name || '').toLowerCase().includes(search.toLowerCase())
  ), [conversations, search]);

  const renderAttachment = (m) => {
    const isImage = m.attachment_type === 'image' || (!m.attachment_type && m.image_url);
    if (isImage && (m.attachment_url || m.image_url)) {
      return <img src={resolveImg(m.attachment_url || m.image_url)} alt="" className="rounded-lg mb-1.5 max-h-44 object-cover cursor-pointer" onClick={() => window.open(resolveImg(m.attachment_url || m.image_url), '_blank')} />;
    }
    if (m.attachment_type === 'document' && m.attachment_url) {
      return <a href={resolveImg(m.attachment_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"><FileText className="h-4 w-4" /><span className="text-xs truncate max-w-[160px]">{m.attachment_name || 'Document'}</span></a>;
    }
    if (m.attachment_type === 'product' && m.product_snapshot) {
      const p = m.product_snapshot;
      return <div className="flex items-center gap-2 mb-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200">{p.image ? <img src={resolveImg(p.image)} alt="" className="w-10 h-10 rounded object-cover" /> : <ShoppingBag className="h-5 w-5 text-slate-400" />}<div className="min-w-0"><p className="text-xs font-semibold truncate max-w-[140px]">{p.name}</p><p className="text-xs text-violet-600 font-bold">${p.price}</p></div></div>;
    }
    return null;
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]" data-testid="admin-all-conversations">
        <div className="bg-white border-b px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0">
          {!showList && selected && (
            <button onClick={() => setShowList(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
          )}
          <MessagesSquare className="h-5 w-5 text-violet-600" />
          <h1 className="text-xl lg:text-2xl font-heading font-bold">All Conversations</h1>
          <span className="ml-auto text-xs text-slate-400">{conversations.length} total</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* List */}
          <div className={`${showList ? 'flex' : 'hidden'} lg:flex w-full lg:w-96 flex-col bg-white border-r border-slate-200 flex-shrink-0`}>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search by participant..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm rounded-xl bg-slate-50" data-testid="all-conv-search" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" /><p className="text-sm">No conversations</p></div>
              ) : filtered.map((conv) => (
                <button key={conv.conversation_id} onClick={() => openConversation(conv)} className={`w-full text-left p-3.5 border-b border-slate-100 transition-colors ${selected?.conversation_id === conv.conversation_id ? 'bg-violet-50' : 'hover:bg-slate-50'}`} data-testid={`all-conv-${conv.conversation_id}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 min-w-0">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] flex-shrink-0">{partyIcon(conv.party_a?.type)}</span>
                      <span className="truncate">{conv.party_a?.name}</span>
                      <span className="text-slate-300">↔</span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] flex-shrink-0">{partyIcon(conv.party_b?.type)}</span>
                      <span className="truncate">{conv.party_b?.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(conv.last_message_time)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conv.last_message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">{conv.message_count} messages</span>
                    {conv.unread_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{conv.unread_count} unread</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Thread */}
          <div className={`${!showList || !selected ? '' : 'hidden lg:flex'} flex-1 flex flex-col bg-slate-50`}>
            {selected ? (
              <>
                <div className="px-4 py-3 bg-white border-b flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{partyIcon(selected.party_a?.type)} {selected.party_a?.name}</span>
                    <span className="text-slate-300">↔</span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{partyIcon(selected.party_b?.type)} {selected.party_b?.name}</span>
                  </div>
                </div>
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const fromA = m.sender_id === selected.party_a?.id;
                    return (
                      <div key={m.id} className={`group flex items-center gap-1 ${fromA ? 'justify-start' : 'justify-end'}`}>
                        {!m.is_deleted && !fromA && <DeleteBtn m={m} />}
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${fromA ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm' : 'bg-violet-600 text-white rounded-br-md'}`}>
                          <p className={`text-[10px] font-semibold mb-1 ${fromA ? 'text-slate-400' : 'text-violet-200'}`}>{m.sender_name} <span className="capitalize">({m.sender_type})</span></p>
                          {m.is_deleted ? (
                            <div>
                              <p className={`text-sm italic flex items-center gap-1 ${fromA ? 'text-slate-400' : 'text-violet-100'}`}>
                                <Trash2 className="h-3 w-3" /> Deleted by {m.deleted_by || 'user'}
                              </p>
                              {(m.deleted_original || m.deleted_attachment_url) && (
                                <button onClick={() => setRevealed(r => ({ ...r, [m.id]: !r[m.id] }))} className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${fromA ? 'text-violet-600 hover:text-violet-800' : 'text-white/90 hover:text-white'}`} data-testid={`reveal-msg-${m.id}`}>
                                  {revealed[m.id] ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show deleted message</>}
                                </button>
                              )}
                              {revealed[m.id] && (
                                <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-sm ${fromA ? 'bg-slate-100 text-slate-700' : 'bg-white/15 text-white'}`}>
                                  {m.deleted_original || <span className="italic opacity-70">(no text)</span>}
                                  {m.deleted_attachment_url && <a href={m.deleted_attachment_url} target="_blank" rel="noreferrer" className="block text-[11px] underline mt-1 break-all">view attachment</a>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              {renderAttachment(m)}
                              {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                            </>
                          )}
                          <p className={`text-[10px] mt-1 ${fromA ? 'text-slate-400' : 'text-violet-200'}`}>{formatTime(m.created_at)}{m.is_edited && !m.is_deleted && <span className="italic ml-1">· edited</span>}</p>
                        </div>
                        {!m.is_deleted && fromA && <DeleteBtn m={m} />}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4"><MessageSquare className="h-8 w-8 text-violet-400" /></div>
                  <p className="text-slate-500 font-medium">Select a conversation</p>
                  <p className="text-sm text-slate-400 mt-1">View any conversation across the platform.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent data-testid="admin-confirm-delete-message-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be shown as “Deleted by admin”. You can still reveal the original content from here afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="admin-confirm-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const m = confirmDelete; setConfirmDelete(null); if (m) adminDelete(m); }} className="bg-red-600 hover:bg-red-700" data-testid="admin-confirm-delete-confirm">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminAllConversations;
