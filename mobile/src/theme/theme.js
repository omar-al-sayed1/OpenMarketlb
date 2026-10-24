/**
 * OpenMarketlb design system — encoded from the web CSS (frontend/src).
 * Screens must consume these tokens only; never hardcode colors/sizes/shadows.
 *
 * Brand: PRIMARY = violet-600 -> indigo-600. Seller/eco = emerald-500 -> teal-500.
 * (Note: this replaces the earlier emerald-primary scaffold palette.)
 */

// ---- Font families (loaded in App.js via expo-font) ----
export const fonts = {
  // Body — Manrope. Heading — Clash Display (falls back to Manrope-Extrabold
  // until the Fontshare TTFs are dropped into assets/fonts).
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  // Headings: to use Clash Display, drop the Fontshare TTFs into assets/fonts,
  // register them in App.js useFonts, then set these to the Clash family names.
  heading: 'Manrope_800ExtraBold',
  headingExtra: 'Manrope_800ExtraBold',
};

export const colors = {
  // ---- Primary (cyan) + Secondary (lime) brand ----
  primary: '#3bf4fb',        // brand cyan
  primaryAlt: '#caff8a',     // brand lime (secondary)
  primaryPressed: '#5df6fc', // cyan-400
  primaryAltPressed: '#b4f56a', // lime-400
  primarySoft: '#d9feff',    // cyan-100
  primarySoftText: '#0d949b',// cyan-800
  secondary: '#caff8a',      // lime (secondary)
  secondarySoft: '#f0ffdd',
  secondaryText: '#5f8d30',
  // ---- Accents (yellow + pink) ----
  accentYellow: '#fce883',
  accentPink: '#ffc0cb',
  accentPinkSoft: '#fff0f3',
  // ---- Dock (bottom nav) semantic tokens — all admin-palette-driven ----
  primaryGradient: ['#3bf4fb', '#caff8a'], // active accent [from,to] (remapped by applyBrandColors)
  accentGradient: ['#caff8a', '#3bf4fb'],
  onPrimary: '#06303a',   // icon/label on the active pill — contrast-picked at runtime
  iconInactive: '#94a3b8',
  iconActive: '#0d949b',  // = primary-dark (remapped)
  badge: '#f43f5e',
  onBadge: '#ffffff',
  dockShadow: '#0b1220',
  // ---- Top-bar (chrome) semantic tokens ----
  barShadow: '#0b1220',
  searchFocusRing: '#3bf4fb', // = primary (remapped at runtime)
  pillActive: '#d9feff',      // = primary-soft (remapped)
  textPrimary: '#1e293b',     // neutral ink (mode-swapped in useTheme)
  // ---- Full brand ramps (tokens for every shade) — remapped at runtime by applyBrandColors.
  //      Screens reference these instead of inline hexes so admin colors reach everywhere. ----
  p50: '#eefdff', p100: '#d9feff', p200: '#c4fcfe', p300: '#a8fafd', p400: '#85f8fd', p450: '#5df6fc',
  p500: '#3bf4fb', p600: '#1fd8df', p700: '#16bcc3', p800: '#0d949b', p900: '#09767c', p925: '#065458', p950: '#04383b',
  s50: '#f6ffe9', s100: '#f0ffdd', s200: '#e6ffc8', s300: '#daffab', s500: '#caff8a',
  s600: '#b4f56a', s700: '#82b347', s800: '#5f8d30', s900: '#4c7626', s950: '#213510',
  violet: '#3bf4fb',
  violet500: '#5df6fc',
  violet700: '#0d949b',
  indigo: '#caff8a',
  violetSoft: '#d9feff',

  // Back-compat aliases (older screens referenced these)
  primaryDark: '#caff8a',
  primaryDarker: '#82b347',
  primaryLight: '#5df6fc',

  // ---- Seller / eco (emerald -> teal) ----
  seller: '#10b981',
  sellerAlt: '#14b8a6',
  sellerSoft: '#d1fae5',     // emerald-100
  sellerSoftText: '#047857', // emerald-700
  teal: '#14b8a6',

  // ---- Accent status colors ----
  sale: '#f43f5e',           // rose-500
  saleAlt: '#ef4444',        // red-500
  saleSoft: '#ffe4e6',
  amber: '#f59e0b',
  orange: '#f97316',
  amberSoft: '#fef3c7',
  gift: '#ec4899',           // pink-500
  giftAlt: '#f43f5e',
  sponsored: '#fbbf24',      // amber-400
  sponsoredMid: '#fce883',   // yellow-300
  sponsoredText: '#78350f',  // amber-900
  rose: '#f43f5e',
  red: '#ef4444',
  roseSoft: '#ffe4e6',
  success: '#10b981',

  // ---- Neutrals (slate) ----
  ink: '#0f172a',            // slate-900
  text: '#1e293b',           // slate-800
  textSecondary: '#475569',  // slate-600
  textMuted: '#94a3b8',      // slate-400
  textFaint: '#94a3b8',
  border: '#e2e8f0',         // slate-200
  borderLight: '#f1f5f9',    // slate-100
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',   // slate-50
  bg: '#f8fafc',
  bgAlt: '#f1f5f9',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(15,23,42,0.5)',

  // ---- Dark mode ----
  darkBg: '#020617',         // slate-950
  darkSurface: '#0f172a',    // slate-900
  darkBorder: 'rgba(255,255,255,0.1)',

  // ---- Type-filter accents (Men / Women / Kids) ----
  men: '#3b82f6', menAlt: '#caff8a', menSoft: '#eff6ff', menText: '#1d4ed8',
  women: '#ec4899', womenAlt: '#e11d48', womenSoft: '#fdf2f8', womenText: '#be185d',
  kids: '#fbbf24', kidsAlt: '#f97316', kidsSoft: '#fffbeb', kidsText: '#b45309',

  // ---- Loyalty tiers ----
  bronzeBg: '#fef3c7', bronzeText: '#b45309',
  silverBg: '#e2e8f0', silverText: '#475569',
  goldBg: '#fef9c3', goldText: '#ca8a04',

  // ---- Logo wordmark ----
  logoOpen: '#16a34a',   // green-600
  logoMarket: '#1fd8df', // purple-600
};

export const gradients = {
  primary: ['#3bf4fb', '#caff8a'],       // violet-600 -> indigo-600
  primaryPressed: ['#5df6fc', '#b4f56a'],
  seller: ['#10b981', '#14b8a6'],        // emerald -> teal
  sale: ['#f43f5e', '#ef4444'],          // rose -> red
  shopSale: ['#f59e0b', '#f97316'],      // amber -> orange
  gift: ['#ec4899', '#f43f5e'],          // pink -> rose
  sponsored: ['#fbbf24', '#fce883', '#fbbf24'],
  men: ['#3b82f6', '#caff8a'],
  women: ['#ec4899', '#e11d48'],
  kids: ['#fbbf24', '#f97316'],
  appBg: ['#eefdff', '#ffffff', '#f0fdfa'], // violet-50 -> white -> teal-50
  hero: ['#3bf4fb', '#caff8a'],
  dark: ['#0f172a', '#020617'],
  // back-compat
  primaryBright: ['#5df6fc', '#3bf4fb'],
  violet: ['#3bf4fb', '#caff8a'],
  amber: ['#f59e0b', '#f97316'],
  rose: ['#fb7185', '#f43f5e'],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40, dockInset: 16 };

export const radius = {
  badge: 4,
  sm: 8,
  md: 12,   // rounded-xl
  lg: 16,   // rounded-2xl
  input: 16,
  xl: 20,
  xxl: 28,
  dock: 30, // floating dock pill
  pill: 999,
};

// Real blur intensities (expo-blur).
export const blur = { dockIntensity: 60, barIntensity: 40 };

// Base html font-size is 15px on web.
export const font = {
  base: 15,
  h1: 26, h2: 22, h3: 18, body: 15, small: 13, tiny: 11, micro: 10,
  weightBold: '800', weightSemi: '600', weightMed: '500',
  // convenience: font-family + size presets
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.violet },
  title: { fontFamily: fonts.extrabold, letterSpacing: -0.5, color: colors.ink },
};

export const shadow = {
  card: {
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  emphasis: {
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  violetGlow: {
    shadowColor: '#5df6fc', shadowOpacity: 0.28, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  dropdown: {
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 }, elevation: 16,
  },
  amberGlow: {
    shadowColor: '#f59e0b', shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  // back-compat
  sm: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  glow: { shadowColor: '#5df6fc', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
};

// Motion language (ms) — fade-up entrances, scale-in, float, transitions.
export const motion = {
  fast: 200, base: 300, entrance: 600, stagger: 120,
  floatAmplitude: 6,
  // spring configs (Reanimated) for the dock
  pillSpring: { damping: 18, stiffness: 180, mass: 0.7 },
  pressIn: { damping: 22, stiffness: 420 },
  pressOut: { damping: 12, stiffness: 240 },
  dockSpring: { damping: 16, stiffness: 150, mass: 0.8 },
};

// ---- Shop world tokens (seller cockpit — emerald identity) ----
export const shop = {
  bg: '#f8fafc',
  topBar: ['#059669', '#0d9488', '#0891b2'],        // emerald-600 -> teal-600 -> cyan-600
  activePill: ['#10b981', '#14b8a6'],               // emerald-500 -> teal-500
  heroCover: ['#10b981', '#14b8a6', '#06b6d4'],     // emerald-500 -> teal-500 -> cyan-500
  revenue: ['#059669', '#10b981', '#14b8a6'],       // emerald-600 -> emerald-500 -> teal-500
  wash: ['#f8fafc', '#ffffff', '#ecfdf5'],          // slate-50 -> white -> emerald-50
  washAnalytics: ['#f8fafc', '#ffffff', '#eff6ff'], // slate-50 -> white -> blue-50
  washSpin: ['#f8fafc', '#ffffff', '#eefdff'],      // slate-50 -> white -> violet-50
  subscribe: ['#f59e0b', '#f97316', '#f43f5e'],     // amber-500 -> orange-500 -> rose-500
  plan: ['#3bf4fb', '#1fd8df', '#82b347'],          // violet-600 -> purple-600 -> indigo-700
  spinFab: ['#3bf4fb', '#1fd8df', '#caff8a'],       // violet-600 -> purple-600 -> indigo-600
  adsHero: ['#f06a92', '#3bf4fb', '#82b347'],       // fuchsia-600 -> violet-600 -> indigo-700
  gift: ['#ec4899', '#f43f5e'],                     // pink-500 -> rose-500
  boost: ['#f59e0b', '#f97316'],                    // amber-500 -> orange-500
  onboardHead: ['#0f172a', '#1e293b'],              // slate-900 -> slate-800
  emeraldGlow: {
    shadowColor: '#10b981', shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  tiles: {
    blue: { grad: ['#3b82f6', '#caff8a'], soft: '#eff6ff', text: '#1d4ed8' },
    rose: { grad: ['#f43f5e', '#ef4444'], soft: '#fff1f2', text: '#be123c' },
    amber: { grad: ['#f59e0b', '#f97316'], soft: '#fffbeb', text: '#b45309' },
    violet: { grad: ['#5df6fc', '#85f8fd'], soft: '#eefdff', text: '#0d949b' },
    pink: { grad: ['#ec4899', '#f43f5e'], soft: '#fdf2f8', text: '#be185d' },
    emerald: { grad: ['#10b981', '#14b8a6'], soft: '#ecfdf5', text: '#047857' },
    fuchsia: { grad: ['#ffc0cb', '#3bf4fb'], soft: '#fff0f3', text: '#be3a5c' },
  },
  pills: {
    emerald: ['#d1fae5', '#047857'], amber: ['#fef3c7', '#b45309'],
    red: ['#ffe4e6', '#be123c'], blue: ['#dbeafe', '#1d4ed8'],
    slate: ['#f1f5f9', '#475569'], violet: ['#d9feff', '#0d949b'],
  },
};

// ---- Agent world tokens (referral hustler — violet -> fuchsia neon) ----
export const agent = {
  bg: '#f8fafc',
  topBar: ['#059669', '#0d9488', '#0891b2'],         // shared TopNotificationBar (emerald) for agents
  activePill: ['#5df6fc', '#ffc0cb'],                 // violet-500 -> fuchsia-500
  drawerHead: ['#3bf4fb', '#f06a92'],                 // violet-600 -> fuchsia-600
  hero: ['#3bf4fb', '#1fd8df', '#f06a92'],            // dashboard: violet-600 -> purple-600 -> fuchsia-600
  walletHero: ['#10b981', '#14b8a6', '#0891b2'],      // emerald-500 -> teal-500 -> cyan-600
  shopsHero: ['#2563eb', '#caff8a', '#3bf4fb'],       // blue-600 -> indigo-600 -> violet-600
  commissionsHero: ['#f59e0b', '#f97316', '#f43f5e'], // amber-500 -> orange-500 -> rose-500
  referHero: ['#3bf4fb', '#1fd8df', '#f06a92'],       // violet-600 -> purple-600 -> fuchsia-600
  messagesHead: ['#3bf4fb', '#f06a92', '#1fd8df'],    // violet-600 -> fuchsia-600 -> purple-600
  cashoutHero: ['#f06a92', '#db2777', '#e11d48'],     // fuchsia-600 -> pink-600 -> rose-600
  fuchsiaGlow: {
    shadowColor: '#85f8fd', shadowOpacity: 0.3, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  tiles: {
    emerald: ['#10b981', '#14b8a6'], blue: ['#3b82f6', '#b4f56a'],
    amber: ['#f59e0b', '#f97316'], fuchsia: ['#ffc0cb', '#ec4899'],
    violet: ['#5df6fc', '#ffc0cb'],
  },
};

// ---- Delivery world tokens (courier cockpit — utilitarian blue-600) ----
export const delivery = {
  bg: '#f8fafc',
  header: ['#2563eb', '#caff8a'],                   // blue-600 -> indigo-600
  primary: '#2563eb',
  mapBtn: ['#3bf4fb', '#caff8a'],                   // violet-600 -> indigo-600
  navBtn: ['#2563eb', '#0891b2'],                   // blue-600 -> cyan-600
  success: ['#ecfdf5', '#f0fdfa'],                  // emerald-50 -> teal-50
  blueGlow: { shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  stats: {
    available: { soft: '#fffbeb', border: '#fde68a', tint: '#d97706', icon: 'cube' },
    active: { soft: '#eff6ff', border: '#bfdbfe', tint: '#2563eb', icon: 'car' },
    delivered: { soft: '#ecfdf5', border: '#a7f3d0', tint: '#059669', icon: 'checkmark-circle' },
    earnings: { soft: '#eefdff', border: '#c4fcfe', tint: '#3bf4fb', icon: 'logo-usd' },
  },
  // status color map (bg/fg/icon) — ported verbatim
  status: {
    pending: { bg: '#fef3c7', fg: '#b45309', icon: 'time' },
    assigned: { bg: '#dbeafe', fg: '#1d4ed8', icon: 'cube' },
    picked_up: { bg: '#f0ffdd', fg: '#82b347', icon: 'arrow-up-circle' },
    in_transit: { bg: '#d9feff', fg: '#0d949b', icon: 'car' },
    delivered: { bg: '#d1fae5', fg: '#047857', icon: 'checkmark-circle' },
    failed: { bg: '#fee2e2', fg: '#b91c1c', icon: 'close' },
  },
};

// ---- Admin world tokens ----
export const admin = {
  bg: '#f8fafc',
  topBar: ['#3bf4fb', '#1fd8df', '#caff8a'],       // violet-600 -> purple-600 -> indigo-600
  profit: ['#caff8a', '#3bf4fb', '#09767c'],        // indigo-600 -> violet-600 -> purple-700
  heroTile: ['#caff8a', '#3bf4fb'],                 // indigo-600 -> violet-600
  activePill: ['#5df6fc', '#b4f56a'],               // violet-500 -> indigo-500
  chartPalette: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#5df6fc', '#ec4899'],
  // stat-card icon-tile variants
  tiles: {
    blue: { grad: ['#3b82f6', '#caff8a'], shadow: '#93c5fd' },
    emerald: { grad: ['#10b981', '#14b8a6'], shadow: '#6ee7b7' },
    amber: { grad: ['#f59e0b', '#f97316'], shadow: '#fcd34d' },
    violet: { grad: ['#5df6fc', '#3bf4fb'], shadow: '#a8fafd' },
    rose: { grad: ['#f43f5e', '#ef4444'], shadow: '#fda4af' },
  },
  // status pill variants (bg / text)
  pills: {
    violet: ['#d9feff', '#0d949b'], emerald: ['#d1fae5', '#047857'],
    amber: ['#fef3c7', '#b45309'], red: ['#ffe4e6', '#be123c'],
    slate: ['#f1f5f9', '#475569'], blue: ['#dbeafe', '#1d4ed8'],
  },
};

// ---- Runtime brand theming -------------------------------------------------
// Deep-replaces the default brand hexes across the exported theme objects with
// shades derived from the admin-chosen primary/secondary colors. Call ONCE at
// startup, BEFORE the screens mount (see App.js) — token/gradient-based styles
// then bake the new colors. Inline hardcoded hexes inside individual screens are
// evaluated at module load and won't change (documented limitation).
const _clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const _rgb = (hex) => { let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return /^[0-9a-fA-F]{6}$/.test(h) ? { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) } : null; };
const _hex = (c) => '#' + [c.r, c.g, c.b].map((v) => _clamp(v).toString(16).padStart(2, '0')).join('');
const _mix = (a, b, t) => ({ r: a.r * (1 - t) + b.r * t, g: a.g * (1 - t) + b.g * t, b: a.b * (1 - t) + b.b * t });
const _W = { r: 255, g: 255, b: 255 }, _K = { r: 0, g: 0, b: 0 };
const _shade = (base, dir, t) => (dir === 'b' ? _hex(base) : _hex(_mix(base, dir === 'w' ? _W : _K, t)));

// [defaultHex, direction, amount] — 'b'=base, 'w'=tint toward white, 'k'=shade toward black
const _PRIMARY_STOPS = [
  ['#3bf4fb', 'b', 0], ['#5df6fc', 'w', 0.16], ['#85f8fd', 'w', 0.36], ['#a8fafd', 'w', 0.56],
  ['#c4fcfe', 'w', 0.72], ['#d9feff', 'w', 0.85], ['#eefdff', 'w', 0.94],
  ['#1fd8df', 'k', 0.12], ['#16bcc3', 'k', 0.26], ['#0d949b', 'k', 0.44],
  ['#09767c', 'k', 0.57], ['#065458', 'k', 0.69], ['#04383b', 'k', 0.80],
];
const _SECONDARY_STOPS = [
  ['#caff8a', 'b', 0], ['#b4f56a', 'k', 0.10], ['#daffab', 'w', 0.30], ['#e6ffc8', 'w', 0.55],
  ['#f0ffdd', 'w', 0.75], ['#f6ffe9', 'w', 0.88],
  ['#82b347', 'k', 0.38], ['#5f8d30', 'k', 0.55], ['#4c7626', 'k', 0.66], ['#213510', 'k', 0.84],
];

const _buildMap = (primary, secondary) => {
  const p = _rgb(primary), s = _rgb(secondary), map = {};
  if (p) _PRIMARY_STOPS.forEach(([hex, d, t]) => { map[hex.toLowerCase()] = _shade(p, d, t); });
  if (s) _SECONDARY_STOPS.forEach(([hex, d, t]) => { map[hex.toLowerCase()] = _shade(s, d, t); });
  return map;
};

// Pure transform: returns a NEW structure with brand hexes replaced. Never mutates
// the input — important because React Native freezes style objects/color arrays once
// they've been passed to native (mutating them throws "immutable and has been frozen").
const _transform = (node, map) => {
  if (Array.isArray(node)) return node.map((v) => (typeof v === 'string' ? (map[v.toLowerCase()] || v) : (v && typeof v === 'object' ? _transform(v, map) : v)));
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) { const v = node[k]; out[k] = typeof v === 'string' ? (map[v.toLowerCase()] || v) : (v && typeof v === 'object' ? _transform(v, map) : v); }
    return out;
  }
  return node;
};

const _THEME_OBJS = [colors, gradients, shop, agent, delivery, admin, shadow];
let _defaults = null; // plain (never-frozen) deep snapshot of the ORIGINAL brand values

/**
 * Apply admin-chosen brand colors across the theme. Idempotent and freeze-safe: it
 * snapshots the defaults once, then on every call rebuilds FRESH child objects from
 * that snapshot and reassigns them onto the (unfrozen) top-level theme objects — so
 * it can be run repeatedly (cached colors → network colors → live admin preview)
 * without ever writing into an already-frozen nested object.
 */
export function applyBrandColors(primary, secondary) {
  if (!_defaults) _defaults = JSON.parse(JSON.stringify(_THEME_OBJS)); // capture defaults once (plain objects)
  // Default brand when the admin hasn't chosen colors: #000052 (navy) / #AA1233 (crimson).
  const map = _buildMap(primary || '#000052', secondary || '#AA1233');
  _THEME_OBJS.forEach((live, i) => {
    const fresh = _transform(_defaults[i], map);           // brand-new objects, built from defaults
    for (const k of Object.keys(fresh)) live[k] = fresh[k]; // reassign keys on the unfrozen top-level object
  });
  // Contrast-pick the on-primary color from the resolved primary's luminance
  // (so icon/label on the active pill stays readable for ANY admin hue).
  const pr = _rgb(colors.primary);
  if (pr) colors.onPrimary = (0.2126 * pr.r + 0.7152 * pr.g + 0.0722 * pr.b) > 150 ? colors.ink : colors.white;
  colors.iconActive = colors.primarySoftText;
  colors.iconInactive = colors.textFaint;
  applyColorScheme(_scheme); // re-assert dark neutrals after a brand rebuild
}

/* ============================ Light / Dark scheme ============================ */
let _scheme = 'light';
export const getScheme = () => _scheme;
const _rgba = (hex, a) => { const c = _rgb(hex); return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${a})` : hex; };

/**
 * Overlay dark-mode neutrals + softened accent tints onto the (already brand-applied)
 * `colors`. Neutrals flip to a dark elevation ladder; vivid accents stay; soft accent
 * backgrounds become translucent tints of the LIVE brand/accent hues (so they still
 * track the admin palette). Must run at startup before the lazy navigator loads —
 * stylesheets bake their colors on import, so this can't repaint them after the fact.
 */
export function applyColorScheme(scheme) {
  _scheme = scheme === 'dark' ? 'dark' : 'light';
  if (_scheme !== 'dark') return; // light = the defaults applyBrandColors already set
  const c = colors;
  const soft = (hex) => _rgba(hex, 0.16);
  Object.assign(c, {
    // ---- surfaces (dark elevation ladder) ----
    bg: '#0b1120', bgAlt: '#111a2e',
    surface: '#161f31', surfaceMuted: '#111a2c',
    // ---- text ----
    ink: '#f8fafc', text: '#e6ebf3', textSecondary: '#a7b4c8', textMuted: '#76859c', textFaint: '#76859c', textPrimary: '#f1f5f9',
    // ---- borders / overlay ----
    border: '#2a3550', borderLight: '#1d2740', overlay: 'rgba(2, 6, 23, 0.66)',
    // ---- softened accent backgrounds (translucent, track the live hues) ----
    primarySoft: soft(c.primary), secondarySoft: soft(c.secondary), sellerSoft: soft(c.seller),
    saleSoft: soft(c.sale), roseSoft: soft(c.rose), amberSoft: soft(c.amber), accentPinkSoft: soft(c.accentPink),
    menSoft: soft(c.men), womenSoft: soft(c.women), kidsSoft: soft(c.kids),
    bronzeBg: soft(c.amber), silverBg: 'rgba(148, 163, 184, 0.18)', goldBg: 'rgba(250, 204, 21, 0.16)',
    // ---- text on those soft backgrounds → lighter hues for contrast ----
    primarySoftText: c.p300, secondaryText: c.s300, sellerSoftText: '#6ee7b7',
    bronzeText: '#fbbf24', silverText: '#cbd5e1', goldText: '#fde047',
    menText: '#93c5fd', womenText: '#f9a8d4', kidsText: '#fcd34d',
    // ---- chrome-ish ----
    pillActive: soft(c.primary), iconActive: c.p300, iconInactive: 'rgba(255, 255, 255, 0.5)',
  });
}
