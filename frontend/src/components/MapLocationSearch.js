import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, MapPin, X } from 'lucide-react';

/**
 * Reusable location search bar for any Leaflet map surface.
 * Uses OpenStreetMap Nominatim (forward geocoding), biased to Lebanon.
 *
 * Props:
 *  - onSelect({ lat, lng, label }) : called when a result is chosen
 *  - placeholder (string)
 *  - accent ('violet' | 'emerald')
 *  - className (string)
 *  - countryCodes (string)         : default 'lb'
 */
const MapLocationSearch = ({
  onSelect,
  placeholder = 'Search a location, city, area...',
  accent = 'violet',
  className = '',
  countryCodes = 'lb',
  'data-testid': dataTestId = 'map-location-search',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const ring = accent === 'emerald' ? 'focus-within:border-emerald-400' : 'focus-within:border-violet-400';
  const btn = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700';
  const iconHover = accent === 'emerald' ? 'text-emerald-500' : 'text-violet-500';

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const runSearch = async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: q.trim(),
        limit: '6',
        addressdetails: '1',
      });
      if (countryCodes) params.set('countrycodes', countryCodes);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  };

  const choose = (r) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setQuery(r.display_name?.split(',').slice(0, 2).join(',') || query);
    setOpen(false);
    setResults([]);
    if (onSelect) onSelect({ lat, lng, label: r.display_name });
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} data-testid={dataTestId}>
      <form onSubmit={handleSubmit}>
        <div className={`flex items-center bg-white rounded-xl border border-slate-200 transition-all ${ring} shadow-sm`}>
          <Search className={`ml-3 h-4 w-4 flex-shrink-0 text-slate-400`} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
            data-testid={`${dataTestId}-input`}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
              className="p-1.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            className={`m-1 px-3 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 ${btn} transition-colors`}
            data-testid={`${dataTestId}-button`}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </form>

      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-[1200] max-h-72 overflow-y-auto"
          data-testid={`${dataTestId}-results`}
        >
          {results.map((r, i) => (
            <button
              key={`${r.place_id}-${i}`}
              type="button"
              onClick={() => choose(r)}
              className="w-full flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
            >
              <MapPin className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconHover}`} />
              <div className="min-w-0">
                <p className="text-sm text-slate-700 font-medium truncate">
                  {r.display_name?.split(',').slice(0, 2).join(', ')}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{r.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapLocationSearch;
