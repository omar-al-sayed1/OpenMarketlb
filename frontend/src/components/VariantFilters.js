import React, { useEffect, useState, useMemo } from 'react';
import { Palette, Ruler, Shapes as ShapesIcon, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Creative variant filters: Colors, Sizes, Shapes
 * - Colors: round chip with hex code, animated ring on select
 * - Sizes: rounded pill chips, sorted properly
 * - Shapes: shape-iconed pills with mini illustration
 *
 * Props:
 *  - selectedColors, selectedSizes, selectedShapes: arrays of selected names
 *  - onColorToggle(name), onSizeToggle(name), onShapeToggle(name)
 *  - filterParams: optional { category_ids, type, shop_id } to scope summary
 *  - darkMode: boolean (for themed shop pages)
 */

const SHAPE_GLYPHS = {
  round: 'rounded-full',
  oval: 'rounded-[40%]',
  square: 'rounded-md',
  rectangle: 'rounded-md',
  cube: 'rounded-sm',
  cylinder: 'rounded-2xl',
  triangle: 'triangle-glyph',
  heart: 'heart-glyph',
  tote: 'rounded-t-lg rounded-b-md',
};

function ShapeGlyph({ name }) {
  const key = (name || '').toLowerCase();
  const cls = SHAPE_GLYPHS[key] || 'rounded-md';
  if (cls === 'triangle-glyph') {
    return (
      <span
        className="inline-block w-4 h-4"
        style={{
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '12px solid currentColor',
        }}
      />
    );
  }
  if (cls === 'heart-glyph') {
    return <span className="inline-block w-4 h-4">♥</span>;
  }
  const isWide = key === 'rectangle' || key === 'tote';
  const isTall = key === 'cylinder';
  return (
    <span
      className={`inline-block bg-current ${cls}`}
      style={{
        width: isWide ? '18px' : '14px',
        height: isTall ? '18px' : isWide ? '12px' : '14px',
      }}
    />
  );
}

const VariantFilters = ({
  selectedColors = [],
  selectedSizes = [],
  selectedShapes = [],
  onColorToggle,
  onSizeToggle,
  onShapeToggle,
  filterParams = {},
  darkMode = false,
  defaultExpanded = true,
  onClearAll,
}) => {
  const [summary, setSummary] = useState({ colors: [], sizes: [], shapes: [] });
  const [loading, setLoading] = useState(true);
  const [openColor, setOpenColor] = useState(defaultExpanded);
  const [openSize, setOpenSize] = useState(defaultExpanded);
  const [openShape, setOpenShape] = useState(defaultExpanded);
  const [showAllColors, setShowAllColors] = useState(false);

  const filterKey = `${filterParams.category_ids || ''}|${filterParams.type || ''}|${filterParams.shop_id || ''}`;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = {};
    if (filterParams.category_ids && filterParams.category_ids.length > 0) {
      params.category_ids = Array.isArray(filterParams.category_ids)
        ? filterParams.category_ids.join(',')
        : filterParams.category_ids;
    }
    if (filterParams.type && filterParams.type !== 'all') params.type = filterParams.type;
    if (filterParams.shop_id) params.shop_id = filterParams.shop_id;

    api.products
      .getVariantSummary(params)
      .then(({ data }) => {
        if (!mounted) return;
        setSummary({
          colors: data.colors || [],
          sizes: data.sizes || [],
          shapes: data.shapes || [],
        });
      })
      .catch(() => {
        if (!mounted) return;
        setSummary({ colors: [], sizes: [], shapes: [] });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const visibleColors = useMemo(
    () => (showAllColors ? summary.colors : summary.colors.slice(0, 10)),
    [summary.colors, showAllColors]
  );

  const totalSelected = selectedColors.length + selectedSizes.length + selectedShapes.length;

  // Show skeleton while loading
  if (loading) {
    return (
      <div className="space-y-4" data-testid="variant-filters-skeleton">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className={`h-3 w-24 ${darkMode ? 'bg-zinc-700' : 'bg-slate-200'} rounded mb-2`} />
            <div className="flex gap-1.5 flex-wrap">
              {[...Array(6)].map((_, j) => (
                <div
                  key={j}
                  className={`h-7 w-12 rounded-full ${darkMode ? 'bg-zinc-700/60' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasAnyVariants =
    summary.colors.length > 0 || summary.sizes.length > 0 || summary.shapes.length > 0;

  if (!hasAnyVariants) return null;

  const labelClass = `text-[11px] font-bold tracking-wider uppercase ${
    darkMode ? 'text-zinc-400' : 'text-slate-400'
  } block`;

  return (
    <div className="space-y-4" data-testid="variant-filters">
      {/* Header with badge */}
      {totalSelected > 0 && onClearAll && (
        <div className="flex items-center justify-between -mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-700">
            <Sparkles className="h-3 w-3" /> {totalSelected} variant{totalSelected !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearAll}
            className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"
            data-testid="clear-variants-btn"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* Colors */}
      {summary.colors.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpenColor((v) => !v)}
            className="flex items-center justify-between w-full mb-2.5 group"
            data-testid="toggle-color-filter"
          >
            <span className="inline-flex items-center gap-1.5">
              <Palette className={`h-3.5 w-3.5 ${darkMode ? 'text-fuchsia-400' : 'text-fuchsia-500'}`} />
              <span className={labelClass}>Color</span>
              {selectedColors.length > 0 && (
                <span className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-100 rounded-full px-1.5 py-px">
                  {selectedColors.length}
                </span>
              )}
            </span>
            {openColor ? (
              <ChevronUp className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            ) : (
              <ChevronDown className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            )}
          </button>
          {openColor && (
            <div
              className={`rounded-xl border p-3 ${
                darkMode ? 'border-zinc-700 bg-zinc-800/40' : 'border-slate-200 bg-gradient-to-br from-fuchsia-50/40 to-pink-50/40'
              }`}
            >
              <div className="grid grid-cols-5 gap-2" data-testid="color-swatch-grid">
                {visibleColors.map((c) => {
                  const isSelected = selectedColors.includes(c.name);
                  const isLight = isLightColor(c.color_code);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onColorToggle && onColorToggle(c.name)}
                      className="group relative flex flex-col items-center gap-1"
                      title={`${c.name} (${c.count})`}
                      data-testid={`color-swatch-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span
                        className={`relative w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-fuchsia-500 scale-110'
                            : isLight ? 'ring-1 ring-slate-200' : ''
                        }`}
                        style={{ backgroundColor: c.color_code, boxShadow: isSelected ? '0 4px 12px -2px rgba(217,70,239,0.5)' : '0 1px 2px rgba(0,0,0,0.06)' }}
                      >
                        {isSelected && (
                          <svg
                            className={`w-4 h-4 ${isLight ? 'text-slate-900' : 'text-white'}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`text-[9px] font-medium text-center leading-tight truncate w-full ${
                          isSelected
                            ? darkMode ? 'text-fuchsia-300' : 'text-fuchsia-700'
                            : darkMode ? 'text-zinc-300' : 'text-slate-600'
                        }`}
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {summary.colors.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllColors((v) => !v)}
                  className={`mt-3 text-[10px] font-bold tracking-wide ${
                    darkMode ? 'text-fuchsia-300 hover:text-fuchsia-200' : 'text-fuchsia-600 hover:text-fuchsia-700'
                  } inline-flex items-center gap-1`}
                  data-testid="toggle-show-all-colors"
                >
                  {showAllColors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showAllColors ? 'Show less' : `+${summary.colors.length - 10} more colors`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sizes */}
      {summary.sizes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpenSize((v) => !v)}
            className="flex items-center justify-between w-full mb-2.5"
            data-testid="toggle-size-filter"
          >
            <span className="inline-flex items-center gap-1.5">
              <Ruler className={`h-3.5 w-3.5 ${darkMode ? 'text-sky-400' : 'text-sky-500'}`} />
              <span className={labelClass}>Size</span>
              {selectedSizes.length > 0 && (
                <span className="text-[10px] font-bold text-sky-600 bg-sky-100 rounded-full px-1.5 py-px">
                  {selectedSizes.length}
                </span>
              )}
            </span>
            {openSize ? (
              <ChevronUp className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            ) : (
              <ChevronDown className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            )}
          </button>
          {openSize && (
            <div
              className={`rounded-xl border p-3 ${
                darkMode ? 'border-zinc-700 bg-zinc-800/40' : 'border-slate-200 bg-gradient-to-br from-sky-50/40 to-cyan-50/40'
              }`}
            >
              <div className="flex flex-wrap gap-1.5" data-testid="size-chip-grid">
                {summary.sizes.map((s) => {
                  const isSelected = selectedSizes.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => onSizeToggle && onSizeToggle(s.name)}
                      className={`min-w-[36px] h-8 px-2.5 rounded-lg border text-[11px] font-bold transition-all duration-150 ${
                        isSelected
                          ? 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white border-sky-500 shadow-md shadow-sky-500/30 scale-105'
                          : darkMode
                          ? 'border-zinc-600 bg-zinc-700/40 text-zinc-200 hover:border-sky-400 hover:bg-zinc-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                      }`}
                      data-testid={`size-chip-${s.name.toLowerCase().replace(/\s+/g, '-')}`}
                      title={`${s.name} (${s.count})`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shapes */}
      {summary.shapes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpenShape((v) => !v)}
            className="flex items-center justify-between w-full mb-2.5"
            data-testid="toggle-shape-filter"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShapesIcon className={`h-3.5 w-3.5 ${darkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
              <span className={labelClass}>Shape</span>
              {selectedShapes.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 rounded-full px-1.5 py-px">
                  {selectedShapes.length}
                </span>
              )}
            </span>
            {openShape ? (
              <ChevronUp className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            ) : (
              <ChevronDown className={`h-3.5 w-3.5 ${darkMode ? 'text-zinc-400' : 'text-slate-400'}`} />
            )}
          </button>
          {openShape && (
            <div
              className={`rounded-xl border p-3 ${
                darkMode ? 'border-zinc-700 bg-zinc-800/40' : 'border-slate-200 bg-gradient-to-br from-emerald-50/40 to-teal-50/40'
              }`}
            >
              <div className="grid grid-cols-2 gap-1.5" data-testid="shape-chip-grid">
                {summary.shapes.map((s) => {
                  const isSelected = selectedShapes.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => onShapeToggle && onShapeToggle(s.name)}
                      className={`flex items-center justify-center gap-2 h-9 px-3 rounded-lg border text-[11px] font-semibold transition-all duration-150 ${
                        isSelected
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30'
                          : darkMode
                          ? 'border-zinc-600 bg-zinc-700/40 text-zinc-200 hover:border-emerald-400'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                      data-testid={`shape-chip-${s.name.toLowerCase().replace(/\s+/g, '-')}`}
                      title={`${s.name} (${s.count})`}
                    >
                      <span className="inline-flex items-center justify-center">
                        <ShapeGlyph name={s.name} />
                      </span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Determines if a color is "light" so we can use a dark check icon
function isLightColor(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Calculate luminance (Rec 709)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.75;
}

export default VariantFilters;
