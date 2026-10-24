import { colors, gradients, radius, spacing, motion, shadow, blur, fonts, getScheme } from './theme';

/**
 * Runtime theme resolver. Returns the live token objects (which `applyBrandColors`
 * hydrates from the admin palette) plus scheme-aware dock tokens. Read tokens ONLY
 * through this hook so a palette / light-dark change re-renders correctly — never
 * hardcode a color in a component.
 */
export function useTheme() {
  const scheme = getScheme(); // the scheme applied at startup (content + chrome stay in sync)
  const dark = scheme === 'dark';
  return {
    scheme,
    dark,
    fonts,
    gradients,
    radius,
    spacing,
    motion,
    shadow,
    blur,
    colors: {
      ...colors,
      // primaryGradient always resolves to the live brand gradient
      primaryGradient: colors.primaryGradient || gradients.primary,
      accentGradient: colors.accentGradient || gradients.primary,
      // Glass surface / border pick their translucency per mode, both palette-neutral
      dockSurface: dark ? 'rgba(17,20,27,0.55)' : 'rgba(255,255,255,0.55)',
      dockTint: dark ? 'rgba(17,20,27,0.35)' : 'rgba(255,255,255,0.38)',
      dockBorder: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)',
      iconInactive: dark ? 'rgba(255,255,255,0.55)' : colors.iconInactive,
      dockGloss: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.85)',
      // Top-bar chrome (per-mode glass)
      barSurface: dark ? 'rgba(15,18,24,0.72)' : 'rgba(255,255,255,0.72)',
      barBorder: dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.07)',
      searchField: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)',
      textPrimary: dark ? '#f1f5f9' : (colors.textPrimary || colors.text),
      barShadow: colors.barShadow,
    },
    blurTint: dark ? 'dark' : 'light',
  };
}
