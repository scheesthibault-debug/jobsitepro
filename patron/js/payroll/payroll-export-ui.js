/**
 * UI export paie — aperçu tableau + synchronisation période (sans calcul fiscal).
 */
(function (global) {
  'use strict';

  const Export = global.ChantierTrackPayrollExport;

  async function refreshPayExportPreview() {
    const host = document.getElementById('pay-export-preview-host');
    if (!host || !Export) return;
    const start = document.getElementById('pay-period-start')?.value || document.getElementById('pay-start')?.value;
    const end = document.getElementById('pay-period-end')?.value || document.getElementById('pay-end')?.value;
    if (!start || !end) {
      host.innerHTML = '<p style="padding:16px;font-size:12px;color:var(--text3)">—</p>';
      return;
    }
    host.innerHTML = `<p style="padding:16px;font-size:12px;color:var(--text3)">${typeof lang !== 'undefined' && lang === 'en' ? 'Loading…' : 'Chargement…'}</p>`;
    try {
      const compiled = await Export.compilePayPeriodExport(start, end);
      host.innerHTML = Export.renderPreviewHtml(compiled);
      const countEl = document.getElementById('pay-export-emp-count');
      const totalEl = document.getElementById('pay-export-emp-total');
      if (countEl) countEl.textContent = String(compiled.employeeCount);
      if (totalEl) totalEl.textContent = String(compiled.employeeTotal ?? compiled.previewRows.length);
    } catch (e) {
      host.innerHTML = `<p style="padding:16px;font-size:12px;color:var(--red)">${e.message || 'Erreur'}</p>`;
    }
  }

  function initPayExportUi() {
    document.getElementById('btn-pay-sync-period')?.addEventListener('click', () => {
      const ps = document.getElementById('pay-start')?.value;
      const pe = document.getElementById('pay-end')?.value;
      if (ps) document.getElementById('pay-period-start').value = ps;
      if (pe) document.getElementById('pay-period-end').value = pe;
      refreshPayExportPreview();
    });

    ['pay-period-start', 'pay-period-end', 'pay-start', 'pay-end'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.payExportBound) return;
      el.dataset.payExportBound = '1';
      el.addEventListener('change', () => {
        if (id === 'pay-start' || id === 'pay-end') {
          const ps = document.getElementById('pay-start')?.value;
          const pe = document.getElementById('pay-end')?.value;
          if (ps) document.getElementById('pay-period-start').value = ps;
          if (pe) document.getElementById('pay-period-end').value = pe;
        }
        refreshPayExportPreview();
      });
    });

    refreshPayExportPreview();
  }

  global.initPayExportUi = initPayExportUi;
  global.refreshPayExportPreview = refreshPayExportPreview;
})(typeof window !== 'undefined' ? window : global);
