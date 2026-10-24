/**
 * Global input refinement — patches React Native's <TextInput> ONCE at startup so
 * every text field across the whole app is smaller, simpler and consistent, without
 * having to touch ~200 inputs spread across 65 screens.
 *
 * What every input gets, app-wide:
 *   • Smaller text  — font size is capped (never enlarged), so both the typed text
 *     and the placeholder (which inherits the input's font size) shrink and read simpler.
 *   • Unified placeholder — one muted brand token instead of the grab-bag of colors.
 *   • A creative, branded touch — the caret + text-selection highlight use the admin
 *     primary color everywhere (looks intentional, updates live with the palette).
 *
 * Single-character boxes (maxLength === 1, e.g. OTP / PIN digits) are left at their
 * own size on purpose. All defaults use `??` so any input that sets its own value wins.
 *
 * Imported for its side effect at the very top of App.js (before any screen renders).
 * `colors` is read live inside render, so brand-color changes are always reflected.
 */
import { TextInput, StyleSheet, Platform } from 'react-native';
import { colors } from './theme';

const MAX_FONT = 13.5; // inputs never render larger than this → smaller, simpler everywhere

if (!TextInput.__omlInputPatched) {
  TextInput.__omlInputPatched = true;

  if (typeof TextInput.render === 'function') {
    const base = TextInput.render;
    TextInput.render = function patchedRender(props, ref) {
      const singleChar = props.maxLength === 1; // OTP / PIN digit boxes keep their size
      const flat = StyleSheet.flatten(props.style) || {};
      const size = typeof flat.fontSize === 'number' ? flat.fontSize : 15;
      const patched = {
        ...props,
        placeholderTextColor: props.placeholderTextColor ?? colors.textMuted,
        selectionColor: props.selectionColor ?? colors.primary,
        ...(Platform.OS === 'android' && props.cursorColor == null ? { cursorColor: colors.primary } : null),
        style: [props.style, singleChar ? null : { fontSize: Math.min(size, MAX_FONT) }],
      };
      return base.call(this, patched, ref);
    };
  } else {
    // Fallback for RN internals without a patchable render: still unify the light touches.
    TextInput.defaultProps = {
      ...(TextInput.defaultProps || {}),
      placeholderTextColor: colors.textMuted,
      selectionColor: colors.primary,
    };
  }
}
