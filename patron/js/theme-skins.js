/**
 * JobsitePro — sélection de skin (classique, blueprint, forge, onyx) + mode sombre/clair
 */
(function (global) {
  'use strict';

  const SKIN_DOT = { classic: '#EA8C2A', blueprint: '#4A8EFF', forge: '#F0A832', onyx: '#E88020' };

  const APP_SKINS = [
    { id: 'classic', labelFr: 'Classique', labelEn: 'Classic', swatch: 'linear-gradient(135deg,#EA8C2A 0%,#27272a 55%,#18181b 100%)', themeColor: '#EA8C2A', themeColorLight: '#f4f6fb' },
    { id: 'blueprint', labelFr: 'Blueprint', labelEn: 'Blueprint', swatch: 'linear-gradient(135deg,#4A8EFF 0%,#111D32 55%,#070D1B 100%)', themeColor: '#070D1B', themeColorLight: '#E8EEF8' },
    { id: 'forge', labelFr: 'Forge', labelEn: 'Forge', swatch: 'linear-gradient(135deg,#F0A832 0%,#17181E 55%,#0B0C10 100%)', themeColor: '#0B0C10', themeColorLight: '#F2F2F4' },
    { id: 'onyx', labelFr: 'Onyx', labelEn: 'Onyx', swatch: 'linear-gradient(135deg,#E88020 0%,#141416 55%,#080809 100%)', themeColor: '#080809', themeColorLight: '#F5F5F6' },
  ];

  function getThemeMetaColor(skinId, light) {
    const s = APP_SKINS.find(x => x.id === skinId);
    if (!s) return light ? '#f4f6fb' : '#EA8C2A';
    return light ? (s.themeColorLight || '#f4f6fb') : s.themeColor;
  }

  function skinDotColor(id) {
    return SKIN_DOT[id] || SKIN_DOT.classic;
  }

  function isEn() {
    return typeof lang !== 'undefined' && lang === 'en';
  }

  function uiLabels() {
    const L = isEn();
    return {
      modeSection: L ? 'Display mode' : 'Mode d\'affichage',
      dark: L ? 'Dark' : 'Sombre',
      light: L ? 'Light' : 'Clair',
    };
  }

  function getAppSkin() {
    const s = localStorage.getItem('ct_app_skin') || 'classic';
    return APP_SKINS.some(x => x.id === s) ? s : 'classic';
  }

  function getDisplayMode() {
    if (typeof patronTheme !== 'undefined') return patronTheme;
    if (typeof appTheme !== 'undefined') return appTheme;
    return localStorage.getItem('ct_patron_theme') || localStorage.getItem('ct_emp_theme') || 'dark';
  }

  function syncLightThemeWithSkin() {
    if (typeof applyPatronTheme === 'function') applyPatronTheme();
    else if (typeof applyTheme === 'function') applyTheme();
  }

  function modeSectionHtml(mode) {
    const L = uiLabels();
    const darkActive = mode === 'dark';
    const lightActive = mode === 'light';
    return `<div class="skin-select-divider"></div>
      <div class="skin-select-section">${L.modeSection}</div>
      <button type="button" class="skin-select-item skin-select-mode${darkActive ? ' active' : ''}" data-mode="dark" onclick="pickDisplayMode('dark')">
        <i class="ti ti-moon" style="font-size:14px;opacity:.85;width:10px;text-align:center"></i>
        <span>${L.dark}</span>
        <i class="ti ti-check skin-check"${darkActive ? '' : ' style="display:none"'}></i>
      </button>
      <button type="button" class="skin-select-item skin-select-mode${lightActive ? ' active' : ''}" data-mode="light" onclick="pickDisplayMode('light')">
        <i class="ti ti-sun" style="font-size:14px;opacity:.85;width:10px;text-align:center"></i>
        <span>${L.light}</span>
        <i class="ti ti-check skin-check"${lightActive ? '' : ' style="display:none"'}></i>
      </button>`;
  }

  function updateSkinDropdownUI() {
    const id = getAppSkin();
    const s = APP_SKINS.find(x => x.id === id);
    const L = isEn();
    const label = document.getElementById('skin-select-label');
    const dot = document.getElementById('skin-dot');
    if (label && s) label.textContent = L ? s.labelEn : s.labelFr;
    if (dot) dot.style.background = skinDotColor(id);
    document.querySelectorAll('.skin-select-item[data-skin]').forEach(el => {
      const active = el.dataset.skin === id;
      el.classList.toggle('active', active);
      const check = el.querySelector('.skin-check');
      if (check) check.style.display = active ? '' : 'none';
    });
    const mode = getDisplayMode();
    document.querySelectorAll('.skin-select-mode').forEach(el => {
      const active = el.dataset.mode === mode;
      el.classList.toggle('active', active);
      const check = el.querySelector('.skin-check');
      if (check) check.style.display = active ? '' : 'none';
    });
  }

  function renderSkinDropdownMenu() {
    const menu = document.getElementById('skin-select-menu');
    if (!menu) return;
    const L = isEn();
    const cur = getAppSkin();
    const mode = getDisplayMode();
    const skinsHtml = APP_SKINS.map(s => {
      const active = cur === s.id;
      return `<button type="button" class="skin-select-item${active ? ' active' : ''}" data-skin="${s.id}" role="option" onclick="pickAppSkin('${s.id}')">
        <span class="skin-dot" style="background:${skinDotColor(s.id)}"></span>
        <span>${L ? s.labelEn : s.labelFr}</span>
        <i class="ti ti-check skin-check"${active ? '' : ' style="display:none"'}></i>
      </button>`;
    }).join('');
    menu.innerHTML = skinsHtml + modeSectionHtml(mode);
  }

  function closeSkinMenu() {
    document.getElementById('skin-select')?.classList.remove('open');
    document.removeEventListener('click', closeSkinMenu);
  }

  function toggleSkinMenu(ev) {
    ev?.stopPropagation();
    const wrap = document.getElementById('skin-select');
    if (!wrap) return;
    const willOpen = !wrap.classList.contains('open');
    document.querySelectorAll('.skin-select.open').forEach(el => el.classList.remove('open'));
    if (willOpen) {
      renderSkinDropdownMenu();
      wrap.classList.add('open');
      setTimeout(() => document.addEventListener('click', closeSkinMenu), 0);
    }
  }

  function pickDisplayMode(mode) {
    if (typeof setPatronTheme === 'function') setPatronTheme(mode);
    else if (typeof setTheme === 'function') setTheme(mode);
    renderSkinDropdownMenu();
    updateSkinDropdownUI();
  }

  function pickAppSkin(id) {
    setAppSkin(id);
    renderSkinDropdownMenu();
    closeSkinMenu();
  }

  function applyAppSkin() {
    const id = getAppSkin();
    if (id === 'classic') {
      document.body.removeAttribute('data-skin');
      document.body.style.fontFamily = '';
      document.body.style.letterSpacing = '';
    } else {
      document.body.dataset.skin = id;
      document.body.style.fontFamily = '';
      document.body.style.letterSpacing = id === 'onyx' ? '.01em' : '';
    }
    document.querySelectorAll('.skin-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.skin === id);
    });
    updateSkinDropdownUI();
    syncLightThemeWithSkin();
  }

  function setAppSkin(id) {
    if (!APP_SKINS.some(x => x.id === id)) return;
    localStorage.setItem('ct_app_skin', id);
    applyAppSkin();
    if (typeof showToast === 'function') {
      const s = APP_SKINS.find(x => x.id === id);
      showToast(isEn() ? `Theme: ${s.labelEn}` : `Thème : ${s.labelFr}`);
    }
  }

  function renderSkinPicker(hostId) {
    const host = typeof hostId === 'string' ? document.getElementById(hostId) : hostId;
    if (!host) return;
    const L = isEn();
    const cur = getAppSkin();
    host.innerHTML = `<div class="skin-grid">${APP_SKINS.map(s => `
      <button type="button" class="skin-chip${cur === s.id ? ' active' : ''}" data-skin="${s.id}" onclick="setAppSkin('${s.id}')">
        <span class="skin-swatch" style="background:${s.swatch}"></span>
        <span class="skin-label">${L ? s.labelEn : s.labelFr}</span>
      </button>`).join('')}</div>`;
  }

  function initSkinDropdown() {
    renderSkinDropdownMenu();
    updateSkinDropdownUI();
  }

  global.APP_SKINS = APP_SKINS;
  global.getAppSkin = getAppSkin;
  global.applyAppSkin = applyAppSkin;
  global.setAppSkin = setAppSkin;
  global.renderSkinPicker = renderSkinPicker;
  global.toggleSkinMenu = toggleSkinMenu;
  global.pickAppSkin = pickAppSkin;
  global.pickDisplayMode = pickDisplayMode;
  global.updateSkinDropdownUI = updateSkinDropdownUI;
  global.initSkinDropdown = initSkinDropdown;
  global.getThemeMetaColor = getThemeMetaColor;
})(typeof window !== 'undefined' ? window : global);
