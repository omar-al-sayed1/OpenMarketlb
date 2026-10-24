import React from 'react';

/**
 * Brand wordmark — "Open" in the theme PRIMARY color, "Marketlb" in the theme SECONDARY.
 *
 * Colors come from the live CSS theme variables (`--v-*` primary ramp, `--s-*` secondary
 * ramp) that the admin palette drives, so the wordmark re-tints with the brand instead of
 * the old hardcoded green/purple. Pass `className` for sizing/weight, `showLb` to include
 * the superscript "lb", and `dim` for a faded footer/copyright treatment.
 */
export default function BrandName({ className = '', showLb = true, dim = false, lbClassName = '' }) {
  const primary = { color: 'rgb(var(--v-500))', opacity: dim ? 0.7 : 1 };
  const secondary = { color: 'rgb(var(--s-500))', opacity: dim ? 0.7 : 1 };
  return (
    <span className={className}>
      <span style={primary}>Open</span>
      <span style={secondary}>Market</span>
      {showLb && (
        <sup className={lbClassName} style={{ ...secondary, fontSize: '0.5em', verticalAlign: 'super', fontWeight: 700 }}>lb</sup>
      )}
    </span>
  );
}
