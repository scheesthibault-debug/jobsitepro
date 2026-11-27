/**
 * Sidebar — sections repliables (Chantiers, Équipe, CRM, …)
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ct_nav_sections';
  const DEFAULT_OPEN = true;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  function setupNavSections() {
    const nav = document.querySelector('.sb-nav');
    if (!nav || nav.dataset.sectionsReady === '1') return;

    const state = loadState();
    const sections = [];

    nav.querySelectorAll(':scope > .nav-label').forEach((label) => {
      const items = [];
      let el = label.nextElementSibling;
      while (el && !el.classList.contains('nav-label')) {
        if (el.classList.contains('nav-item')) {
          if (el.dataset.navStandalone === 'true') break;
          items.push(el);
        }
        el = el.nextElementSibling;
      }
      if (!items.length) return;

      const section = document.createElement('div');
      section.className = 'nav-section';
      const sectionId = label.dataset.i18n || `sec-${sections.length}`;
      section.dataset.section = sectionId;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-section-toggle';
      toggle.innerHTML =
        '<i class="ti ti-chevron-down nav-section-chevron" aria-hidden="true"></i>' +
        `<span data-i18n="${label.dataset.i18n || ''}">${label.textContent}</span>`;

      const body = document.createElement('div');
      body.className = 'nav-section-items';
      items.forEach((node) => body.appendChild(node));

      section.appendChild(toggle);
      section.appendChild(body);
      label.replaceWith(section);
      sections.push({ section, toggle, sectionId });
    });

    sections.forEach(({ section, toggle, sectionId }) => {
      const open = state[sectionId] !== false && (state[sectionId] === true || DEFAULT_OPEN);
      section.classList.toggle('collapsed', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = section.classList.contains('collapsed');
        section.classList.toggle('collapsed', !willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        state[sectionId] = willOpen;
        saveState(state);
      });
    });

    nav.dataset.sectionsReady = '1';
  }

  global.ChantierTrackNavSections = { setup: setupNavSections };
})(typeof window !== 'undefined' ? window : global);
