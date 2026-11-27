/**
 * JobsitePro — échappement HTML partagé (anti-XSS).
 * Expose window.JobsiteEscapeHtml = { escapeHtml, escapeAttr }
 */
(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  const api = { escapeHtml, escapeAttr };
  global.JobsiteEscapeHtml = api;
  global.escapeHtml = global.escapeHtml || escapeHtml;
  global.escapeAttr = global.escapeAttr || escapeAttr;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
