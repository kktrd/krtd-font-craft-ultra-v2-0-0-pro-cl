import React from 'react';

/**
 * SkipLink — visually hidden until keyboard-focused, then lets keyboard
 * users jump straight to <main id="main-content"> bypassing the sticky
 * header + tab bar on every page load. Real WCAG 2.4.1 (Bypass Blocks).
 */
export default function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
