/**
 * Runtime brand theming.
 *
 * The Tailwind config maps the `violet`/`purple` (primary) and `indigo` (secondary)
 * color scales to CSS variables (`--v-500`, `--s-500`, …). This module turns the two
 * admin-chosen hex colors into full 50→950 ramps and writes them onto <html>, so every
 * existing `violet-*` / `indigo-*` utility class recolors live — no per-page edits.
 *
 * Defaults live in index.css, so the app renders correctly before settings load.
 */

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const mix = (a, b, t) => ({ r: a.r * (1 - t) + b.r * t, g: a.g * (1 - t) + b.g * t, b: a.b * (1 - t) + b.b * t });
const channels = (c) => `${clamp(c.r)} ${clamp(c.g)} ${clamp(c.b)}`;

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

// Tint (toward white) for light shades, shade (toward black) for dark shades.
const STOPS = {
  50: ['w', 0.92], 100: ['w', 0.84], 200: ['w', 0.68], 300: ['w', 0.48], 400: ['w', 0.24],
  500: ['b', 0], 600: ['k', 0.12], 700: ['k', 0.28], 800: ['k', 0.44], 900: ['k', 0.58], 950: ['k', 0.74],
};

/** Build a { 50:"R G B", … 950:"R G B" } ramp from a base hex (base sits at 500). */
export function buildRamp(hex) {
  const base = hexToRgb(hex);
  if (!base) return null;
  const out = {};
  for (const [shade, [dir, t]] of Object.entries(STOPS)) {
    const c = dir === 'w' ? mix(base, WHITE, t) : dir === 'k' ? mix(base, BLACK, t) : base;
    out[shade] = channels(c);
  }
  return out;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hslStr = (c) => { const { h, s, l } = rgbToHsl(c); return `${h} ${s}% ${l}%`; };
// WCAG relative luminance → pick dark or light foreground text on a filled brand color.
const luminance = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Write the primary/secondary ramps + shadcn vars onto :root. Safe to call repeatedly. */
export function applyBrandColors(primary, secondary) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const p = buildRamp(primary);
  const s = buildRamp(secondary);
  if (p) Object.entries(p).forEach(([k, v]) => root.style.setProperty(`--v-${k}`, v));
  if (s) Object.entries(s).forEach(([k, v]) => root.style.setProperty(`--s-${k}`, v));
  const prgb = hexToRgb(primary);
  if (prgb) {
    root.style.setProperty('--primary', hslStr(prgb));
    root.style.setProperty('--ring', hslStr(prgb));
    // Auto-contrast foreground so text on primary fills stays readable.
    root.style.setProperty('--primary-foreground', luminance(prgb) > 150 ? '195 45% 12%' : '0 0% 100%');
  }
}

/** Fetch admin brand colors and apply them. Call once at app startup. */
export async function loadBrandColors(api) {
  try {
    const { data } = await api.getPlatformSettings();
    if (data?.primary_color || data?.secondary_color) {
      applyBrandColors(data.primary_color || '#000052', data.secondary_color || '#AA1233');
    }
  } catch (_) { /* keep index.css defaults */ }
}
