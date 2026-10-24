import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, X, Loader2, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import ProductCard from './ProductCard';

const AISmartSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      const { data } = await api.ai.smartSearch(query);
      setResults(data);
    } catch {
      setResults({ products: [], interpretation: 'Search failed. Try again.', total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Red sneakers under $100',
    'Best electronics deals',
    'Something for kids',
    'Affordable home decor',
  ];

  return (
    <div ref={wrapperRef} className="relative w-full" data-testid="ai-smart-search">
      <form onSubmit={handleSearch} className="relative">
        <div className={`relative flex items-center bg-white border rounded-xl transition-all duration-200 ${
          isOpen ? 'border-violet-400 shadow-lg shadow-violet-500/10' : 'border-slate-200 hover:border-slate-300'
        }`}>
          <div className="pl-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <Search className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder='Try "red dress under $50" or "gifts for kids"...'
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 border-0 py-2.5 px-2.5 outline-none"
            data-testid="ai-search-input"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults(null); setIsOpen(false); }} className="p-1.5 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="m-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] sm:text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1 sm:gap-1.5 min-w-[80px] sm:min-w-[100px] justify-center"
            data-testid="ai-search-btn"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
            <span>AI Search</span>
          </button>
        </div>
      </form>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-[480px] overflow-hidden" data-testid="ai-search-results">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-violet-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">AI is searching...</span>
            </div>
          ) : results ? (
            <div>
              {/* Interpretation */}
              {results.interpretation && (
                <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
                  <p className="text-xs text-violet-700 font-medium">{results.interpretation}</p>
                </div>
              )}

              {results.products?.length > 0 ? (
                <div className="overflow-y-auto max-h-[380px] p-3" style={{ scrollbarWidth: 'none' }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {results.products.slice(0, 6).map(product => (
                      <div key={product.id} className="text-sm" onClick={() => setIsOpen(false)}>
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                  {results.total > 6 && (
                    <div className="text-center pt-3">
                      <Link
                        to={`/products?search=${encodeURIComponent(query)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                        onClick={() => setIsOpen(false)}
                      >
                        View all {results.total} results <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-slate-500 mb-1">No products found</p>
                  <p className="text-xs text-slate-400">Try a different search</p>
                </div>
              )}
            </div>
          ) : (
            /* Suggestions when no search yet */
            <div className="p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Try asking</p>
              <div className="space-y-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(s); setTimeout(() => handleSearch(), 50); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="h-3 w-3 text-violet-400" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AISmartSearch;
