import React, { useState, useRef, useEffect } from 'react';
import BrandName from './BrandName';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [products, setProducts] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
    if (isOpen && products.length === 0) {
      api.products.getAll({ is_active: true }).then(res => setProducts(res.data || [])).catch(() => {});
    }
  }, [isOpen]);

  // Find product mentions in text and make them clickable
  const renderMessageWithLinks = (text) => {
    if (!products.length) return text;
    let result = text;
    const parts = [];
    let lastIndex = 0;

    // Find product names mentioned in the text
    const matchedProducts = products.filter(p => 
      result.toLowerCase().includes(p.name.toLowerCase())
    ).sort((a, b) => b.name.length - a.name.length); // longest first to avoid partial matches

    if (matchedProducts.length === 0) return text;

    // Build regex from product names
    const escaped = matchedProducts.map(p => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const segments = result.split(regex);

    return segments.map((segment, i) => {
      const matchedProduct = matchedProducts.find(p => p.name.toLowerCase() === segment.toLowerCase());
      if (matchedProduct) {
        return (
          <Link
            key={i}
            to={`/products/${matchedProduct.id}`}
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center gap-0.5 text-violet-600 hover:text-violet-700 font-semibold underline decoration-violet-300 underline-offset-2 hover:decoration-violet-500 transition-colors"
          >
            {segment}
            <ExternalLink className="h-2.5 w-2.5 inline" />
          </Link>
        );
      }
      return segment;
    });
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const { data } = await api.ai.chat(text, sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that. Please try again!" }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'What\'s on sale?', icon: '🏷' },
    { label: 'Track my order', icon: '📦' },
    { label: 'Recommend something', icon: '✨' },
  ];

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          data-testid="chatbot-toggle"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" data-testid="chatbot-window">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm"><BrandName showLb /> Assistant</h3>
                <p className="text-white/60 text-[10px]">AI-powered help</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors" data-testid="chatbot-close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50" style={{ scrollbarWidth: 'none' }}>
            {messages.length === 0 && (
              <div className="text-center pt-6 pb-2">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="h-6 w-6 text-violet-600" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">Hi! I'm your shopping assistant</h4>
                <p className="text-xs text-slate-500 mb-4">Ask me about products, orders, or anything!</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(action.label); }}
                      className="text-[11px] bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
                      data-testid={`quick-action-${i}`}
                    >
                      {action.icon} {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md shadow-sm'
                }`}>
                  {msg.role === 'assistant' ? renderMessageWithLinks(msg.content) : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20 transition-colors"
                data-testid="chatbot-input"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
                data-testid="chatbot-send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default AIChatbot;
