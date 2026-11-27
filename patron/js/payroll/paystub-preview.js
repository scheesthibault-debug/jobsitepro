/**
 * ChantierTrack — Aperçu HTML fiche de paie style "Talon de paie" québécois
 */
(function (global) {
  'use strict';

  function fmtMoney(n, locale) {
    const v = Number(n) || 0;
    const loc = locale === 'en' ? 'en-CA' : 'fr-CA';
    return new Intl.NumberFormat(loc, { style: 'currency', currency: 'CAD' }).format(v);
  }

  function fmtDate(iso, locale) {
    if (!iso) return '—';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  }

  function esc(s) {
    if (global.JobsiteEscapeHtml && global.JobsiteEscapeHtml.escapeHtml) {
      return global.JobsiteEscapeHtml.escapeHtml(s);
    }
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function numberToWords(n) {
    // Nombre en lettres simplifié (montant)
    const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
      'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
    const tens = ['', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT'];
    function below100(num) {
      if (num < 20) return units[num];
      const t = tens[Math.floor(num / 10)];
      const u = num % 10;
      if (Math.floor(num / 10) === 7) return 'SOIXANTE-' + units[10 + u];
      if (Math.floor(num / 10) === 9) return 'QUATRE-VINGT-' + (u ? units[u] : 'S');
      return t + (u ? '-' + units[u] : (Math.floor(num / 10) === 8 && !u ? 'S' : ''));
    }
    function below1000(num) {
      if (num < 100) return below100(num);
      const h = Math.floor(num / 100);
      const r = num % 100;
      return (h === 1 ? '' : units[h] + ' ') + 'CENT' + (r ? ' ' + below100(r) : (h > 1 ? 'S' : ''));
    }
    const whole = Math.floor(Math.abs(n));
    const cents = Math.round((Math.abs(n) - whole) * 100);
    if (whole === 0) return 'ZÉRO';
    let w = '';
    if (whole >= 1000) { w += below1000(Math.floor(whole / 1000)) + ' MILLE '; }
    w += below1000(whole % 1000);
    return w.trim() + (cents > 0 ? ' ET ' + below100(cents) : '');
  }

  const CSS = `
    .ct-talon{font-family:Arial,sans-serif;font-size:11px;color:#111;width:680px;margin:0 auto;border:1px solid #ccc;background:#fff}
    .ct-talon *{box-sizing:border-box}
    .ct-top{display:flex;background:#fff;padding:12px 16px 8px;border-bottom:2px solid #8B6914}
    .ct-co-info{flex:1;font-size:11px;line-height:1.55}
    .ct-co-name{font-size:14px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
    .ct-co-sub{font-size:12px;font-weight:600;color:#555;text-transform:uppercase;margin-bottom:6px}
    .ct-co-row{display:flex;align-items:flex-start;gap:5px;font-size:10.5px;color:#333;margin:1px 0}
    .ct-title-block{text-align:right;min-width:200px}
    .ct-title-main{font-size:22px;font-weight:700;letter-spacing:1px;color:#8B6914;text-transform:uppercase;border-bottom:2px solid #8B6914;padding-bottom:4px;margin-bottom:8px}
    .ct-ref-row{display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:4px}
    .ct-ref-label{font-size:10px;color:#555;text-transform:uppercase}
    .ct-ref-val{background:#8B6914;color:#fff;font-weight:700;padding:3px 10px;font-size:13px;letter-spacing:1px}
    .ct-pay-date{font-size:10.5px;color:#333;text-align:right;margin-bottom:4px}
    .ct-non-neg{font-size:9px;color:#888;text-align:right;margin-top:4px;font-style:italic}
    .ct-emp-section{display:flex;background:#f8f6f2;border-bottom:1px solid #ddd;padding:8px 16px;gap:24px}
    .ct-emp-col{flex:1;font-size:10.5px;line-height:1.6}
    .ct-emp-label{font-size:9.5px;color:#888;text-transform:uppercase;font-weight:600}
    .ct-amount-bar{display:flex;align-items:center;background:#8B6914;color:#fff;padding:7px 16px;gap:12px}
    .ct-amount-val{font-size:22px;font-weight:700;letter-spacing:1px;min-width:140px}
    .ct-amount-stars{font-size:14px;letter-spacing:2px;color:rgba(255,255,255,.6)}
    .ct-amount-words{font-size:10px;text-transform:uppercase;letter-spacing:.5px;flex:1}
    .ct-avis-header{display:flex;background:#3a3a3a;color:#fff;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    .ct-avis-header span{flex:1;padding:5px 16px;text-align:center}
    .ct-avis-header span+span{border-left:1px solid #555}
    .ct-period-row{display:flex;background:#f0ece4;border-bottom:1px solid #ddd;padding:5px 16px;gap:16px;font-size:10.5px;align-items:center}
    .ct-period-label{font-size:9.5px;color:#666;text-transform:uppercase;font-weight:600;margin-right:4px}
    .ct-note{font-size:9px;color:#777;padding:3px 16px;background:#fafafa;border-bottom:1px solid #eee;font-style:italic}
    .ct-tables{display:flex;border-bottom:1px solid #ccc}
    .ct-tbl-half{flex:1}
    .ct-tbl-half+.ct-tbl-half{border-left:1px solid #ccc}
    .ct-tbl-title{background:#3a3a3a;color:#fff;font-weight:700;font-size:10px;text-transform:uppercase;padding:4px 8px;letter-spacing:.5px}
    .ct-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .ct-tbl th{background:#6b5108;color:#fff;padding:3px 6px;text-align:left;font-size:9.5px;font-weight:600;text-transform:uppercase}
    .ct-tbl th.r,.ct-tbl td.r{text-align:right}
    .ct-tbl td{padding:3px 6px;border-bottom:1px solid #eee}
    .ct-tbl tr:nth-child(even) td{background:#fafaf6}
    .ct-tbl tfoot td{background:#f0ece4;font-weight:700;border-top:2px solid #8B6914;padding:4px 6px}
    .ct-bottom-row{display:flex;border-top:1px solid #ccc;background:#f8f6f2}
    .ct-bottom-half{flex:1;padding:6px 12px;font-size:10.5px}
    .ct-bottom-half+.ct-bottom-half{border-left:1px solid #ccc}
    .ct-net-label{font-size:9.5px;color:#888;text-transform:uppercase}
    .ct-net-val{font-size:15px;font-weight:700}
    .ct-final-bar{display:flex;align-items:center;justify-content:space-between;background:#8B6914;color:#fff;padding:7px 16px}
    .ct-final-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
    .ct-final-val{font-size:20px;font-weight:700;letter-spacing:1px}
    .ct-footer{font-size:9px;color:#888;padding:5px 16px;text-align:center;font-style:italic;background:#fafafa;border-top:1px solid #eee}
  `;

  function renderPaystubHtml(result, opts) {
    const locale = opts?.locale === 'en' ? 'en' : 'fr';
    const L = locale === 'fr';
    const e = result.employee || {};
    const w = result.work || {};
    const rule = result.meta?.provinceRule;
    const provName = rule ? (L ? rule.fr : rule.en) : (e.province || 'QC');
    const isQC = (e.province || 'QC') === 'QC';

    const regPay  = (w.regularHours || 0) * (w.hourlyRate || 0);
    const otRate  = w.overtimeRate || (w.hourlyRate || 0) * 1.5;
    const otPay   = (w.overtimeHours || 0) * otRate;
    const mileage = result.mileagePay || 0;
    const gross   = result.grossPay || 0;
    const net     = result.netPay || 0;

    const penLabel = isQC ? 'RRQ' : 'RPC';
    const penDesc  = isQC ? 'Régime des rentes du Québec' : 'Régime de pensions du Canada';
    const deductions = result.deductions || [];
    const penDed  = deductions.find(d => d.key === 'pen' || d.name?.toUpperCase().includes('RRQ') || d.name?.toUpperCase().includes('RPC'));
    const eiDed   = deductions.find(d => d.key === 'ei'  || d.name?.toUpperCase().includes('AE') || d.name?.toUpperCase().includes('EI'));
    const rqapDed = deductions.find(d => d.key === 'rqap'|| d.name?.toUpperCase().includes('RQAP'));
    const fedDed  = deductions.find(d => d.key === 'fed' || d.name?.toLowerCase().includes('fédéral') || d.name?.toLowerCase().includes('federal') || d.name?.toLowerCase().includes('canada impôt'));
    const provDed = deductions.find(d => d.key === 'prov'|| d.name?.toLowerCase().includes('québec impôt') || d.name?.toLowerCase().includes('provincial'));

    const totalDed = deductions.reduce((a, d) => a + (d.amount || 0), 0);
    const refNum   = 'D-' + String(Math.abs(Math.floor((e.employeeName || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0) + (e.payPeriodStart||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)))).padStart(6, '0');

    return `<style>${CSS}</style>
<div class="ct-talon" id="ct-paystub-print-root">
  <!-- En-tête : info compagnie + titre -->
  <div class="ct-top">
    <div class="ct-co-info">
      <div class="ct-co-name">${esc(e.employerName || 'Employeur')}</div>
      <div class="ct-co-sub">${esc(e.employerTrade || '')}</div>
      ${e.employerAddress ? `<div class="ct-co-row"><span>📍</span><span>${esc(e.employerAddress)}</span></div>` : ''}
      ${e.employerEmail ? `<div class="ct-co-row"><span>✉</span><span>${esc(e.employerEmail)}</span></div>` : ''}
      ${e.employerPhone ? `<div class="ct-co-row"><span>📞</span><span>${esc(e.employerPhone)}</span></div>` : ''}
    </div>
    <div class="ct-title-block">
      <div class="ct-title-main">${L ? 'Talon de paie' : 'Pay Stub'}</div>
      <div class="ct-pay-date">${L ? 'DATE DU PAIEMENT :' : 'PAYMENT DATE:'} <strong>${fmtDate(e.payDate || e.payPeriodEnd, locale)}</strong></div>
      <div class="ct-ref-row">
        <span class="ct-ref-label">${L ? 'N° de référence / N° chèque :' : 'Ref. / Cheque #:'}</span>
        <span class="ct-ref-val">${refNum}</span>
      </div>
      <div class="ct-non-neg">${L ? 'NON NÉGOCIABLE — CECI N\'EST PAS UN CHÈQUE' : 'NON-NEGOTIABLE — NOT A CHEQUE'}</div>
    </div>
  </div>

  <!-- Info employé -->
  <div class="ct-emp-section">
    <div class="ct-emp-col">
      <div class="ct-emp-label">${L ? 'Nom :' : 'Name:'}</div>
      <div><strong>${esc(e.employeeName || '—')}</strong></div>
      ${e.employeeId ? `<div class="ct-emp-label" style="margin-top:4px">${L ? 'Métier :' : 'Trade:'}</div><div>${esc(e.employeeId)}</div>` : ''}
    </div>
    <div class="ct-emp-col">
      <div class="ct-emp-label">${L ? 'Province :' : 'Province:'}</div>
      <div>${esc(e.province || 'QC')} — ${esc(provName)}</div>
      ${e.role ? `<div class="ct-emp-label" style="margin-top:4px">${L ? 'Rôle :' : 'Role:'}</div><div>${esc(e.role)}</div>` : ''}
    </div>
    <div class="ct-emp-col">
      ${e.employeeEmail ? `<div class="ct-emp-label">${L ? 'Courriel :' : 'Email:'}</div><div>${esc(e.employeeEmail)}</div>` : ''}
    </div>
  </div>

  <!-- Barre montant -->
  <div class="ct-amount-bar">
    <span class="ct-amount-stars">****</span>
    <span class="ct-amount-val">${fmtMoney(net, locale)}</span>
    <span class="ct-amount-stars">****</span>
    <span class="ct-amount-words">${numberToWords(net)} <sup style="font-size:9px">${String(Math.round((net % 1) * 100)).padStart(2,'0')}</sup></span>
    <span class="ct-amount-stars">****.${String(Math.round((net % 1) * 100)).padStart(2,'0')}</span>
  </div>

  <!-- Avis de paiement -->
  <div class="ct-avis-header">
    <span>${L ? 'AVIS DE PAIEMENT' : 'PAYMENT NOTICE'}</span>
    <span>${L ? 'POUR LA PAIE' : 'FOR PAYROLL'}</span>
  </div>
  <div class="ct-period-row">
    <span class="ct-period-label">${L ? 'PÉRIODE DE LA PAIE :' : 'PAY PERIOD:'}</span>
    <span><strong>${L ? 'DU :' : 'FROM:'}</strong> ${fmtDate(e.payPeriodStart, locale)}</span>
    <span><strong>${L ? 'AU :' : 'TO:'}</strong> ${fmtDate(e.payPeriodEnd, locale)}</span>
    <span style="margin-left:auto"><span class="ct-period-label">${L ? 'DATE DE LA PAIE :' : 'PAY DATE:'}</span> <strong>${fmtDate(e.payDate || e.payPeriodEnd, locale)}</strong></span>
  </div>
  <div class="ct-note">${L ? 'NB : Les heures sont entrées en format avec décimales : 1/4 hrs = .25 | 1/2 hrs = .50 | 3/4 hrs = .75' : 'NOTE: Hours in decimal format: 1/4 hrs = .25 | 1/2 hrs = .50 | 3/4 hrs = .75'}</div>

  <!-- Tables revenus + retenues -->
  <div class="ct-tables">
    <div class="ct-tbl-half">
      <div class="ct-tbl-title">${L ? 'REVENUS D\'EMPLOI' : 'EMPLOYMENT INCOME'}</div>
      <table class="ct-tbl">
        <thead><tr><th>${L ? 'DESCRIPTION' : 'DESCRIPTION'}</th><th class="r">${L ? 'TAUX' : 'RATE'}</th><th class="r">${L ? 'HEURES' : 'HOURS'}</th><th class="r">${L ? 'TOTAL' : 'TOTAL'}</th></tr></thead>
        <tbody>
          <tr><td>${L ? 'Salaire horaire' : 'Regular wages'}</td><td class="r">${fmtMoney(w.hourlyRate||0,locale)}</td><td class="r">${Number(w.regularHours||0).toFixed(2)}</td><td class="r">${fmtMoney(regPay,locale)}</td></tr>
          ${(w.overtimeHours||0) > 0 ? `<tr><td>${L ? 'Heures supplémentaires' : 'Overtime'}</td><td class="r">${fmtMoney(otRate,locale)}</td><td class="r">${Number(w.overtimeHours||0).toFixed(2)}</td><td class="r">${fmtMoney(otPay,locale)}</td></tr>` : ''}
          ${mileage > 0 ? `<tr><td>${L ? 'Remboursement km' : 'Mileage'}</td><td class="r">—</td><td class="r">—</td><td class="r">${fmtMoney(mileage,locale)}</td></tr>` : ''}
        </tbody>
        <tfoot>
          <tr><td colspan="2"><strong>${L ? 'BRUT PAYÉ :' : 'GROSS PAID:'}</strong></td><td class="r"><strong>${L ? 'DE LA PÉRIODE' : 'THIS PERIOD'}</strong><br>${fmtMoney(gross,locale)}</td><td class="r"><strong>${L ? 'CUMULATIF' : 'YTD'}</strong><br>—</td></tr>
        </tfoot>
      </table>
    </div>
    <div class="ct-tbl-half">
      <div class="ct-tbl-title">${L ? 'RETENUES À LA SOURCE' : 'SOURCE DEDUCTIONS'}</div>
      <table class="ct-tbl">
        <thead><tr><th>${L ? 'DESCRIPTION' : 'DESCRIPTION'}</th><th class="r">${L ? 'PÉRIODE' : 'PERIOD'}</th><th class="r">${L ? 'CUMUL' : 'YTD'}</th></tr></thead>
        <tbody>
          ${penDed ? `<tr><td><strong>${penLabel}</strong><br><span style="font-size:9px;color:#666">${penDesc}</span></td><td class="r">${fmtMoney(penDed.amount,locale)}</td><td class="r">—</td></tr>` : ''}
          ${eiDed  ? `<tr><td><strong>AE</strong><br><span style="font-size:9px;color:#666">${L ? 'Prime d\'assurance-emploi' : 'Employment insurance premium'}</span></td><td class="r">${fmtMoney(eiDed.amount,locale)}</td><td class="r">—</td></tr>` : ''}
          ${rqapDed ? `<tr><td><strong>RQAP</strong><br><span style="font-size:9px;color:#666">${L ? 'Régime québécois d\'assurance parentale' : 'Quebec Parental Insurance'}</span></td><td class="r">${fmtMoney(rqapDed.amount,locale)}</td><td class="r">—</td></tr>` : ''}
          ${provDed ? `<tr><td><strong>${isQC ? (L ? 'QUÉBEC IMPÔT' : 'QC TAX') : (L ? 'IMPÔT PROVINCIAL' : 'PROVINCIAL TAX')}</strong><br><span style="font-size:9px;color:#666">${isQC ? (L ? 'Impôt provincial du Québec par période' : 'QC provincial tax per period') : (L ? 'Impôt provincial par période' : 'Provincial tax per period')}</span></td><td class="r">${fmtMoney(provDed.amount,locale)}</td><td class="r">—</td></tr>` : ''}
          ${fedDed  ? `<tr><td><strong>${L ? 'CANADA IMPÔT' : 'FEDERAL TAX'}</strong><br><span style="font-size:9px;color:#666">${L ? 'Impôt fédéral par période' : 'Federal tax per period'}</span></td><td class="r">${fmtMoney(fedDed.amount,locale)}</td><td class="r">—</td></tr>` : ''}
        </tbody>
        <tfoot>
          <tr><td colspan="2"><strong>${L ? 'TOTAL DES RETENUES :' : 'TOTAL DEDUCTIONS:'}</strong></td><td class="r"><strong>${fmtMoney(totalDed,locale)}</strong></td></tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- Net + AE assurables -->
  <div class="ct-bottom-row">
    <div class="ct-bottom-half">
      <div class="ct-net-label">${L ? 'SALAIRE NET :' : 'NET WAGES:'}</div>
      <div class="ct-net-val">${fmtMoney(net,locale)}</div>
      ${e.hrNotes ? `<div style="margin-top:6px;font-size:10px;color:#555"><strong>${L ? 'Commentaires :' : 'Notes:'}</strong> ${esc(e.hrNotes)}</div>` : ''}
    </div>
    <div class="ct-bottom-half">
      <div class="ct-net-label">${L ? 'H. ASSURABLES AE :' : 'EI INSURABLE HRS:'}</div>
      <div style="font-size:13px;font-weight:700">${Number((w.regularHours||0) + (w.overtimeHours||0)).toFixed(2)}</div>
    </div>
  </div>

  <!-- Barre finale -->
  <div class="ct-final-bar">
    <span class="ct-final-label">${L ? 'PAIE NETTE — MONTANT PAYÉ :' : 'NET PAY — AMOUNT PAID:'}</span>
    <span class="ct-final-val">${fmtMoney(net,locale)}</span>
  </div>

  <div class="ct-footer">${L
    ? 'Estimation uniquement — ne remplace pas un bulletin officiel. Validez avec votre comptable (TD1 / TP-1015 au Québec).'
    : 'Estimate only — not an official pay stub. Validate with your accountant (TD1 / TP-1015 in Quebec).'}</div>
</div>`;
  }

  function printPaystub(containerEl) {
    const root = containerEl?.querySelector?.('.ct-talon') || document.getElementById('ct-paystub-print-root');
    if (!root) return;
    const w = window.open('', '_blank');
    if (!w) { window.print(); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Talon de paie</title>
<style>
@media print{body{margin:0}}
body{background:#eee;display:flex;justify-content:center;padding:20px;font-family:Arial,sans-serif}
</style></head><body>${root.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  global.ChantierTrackPaystubPreview = {
    renderPaystubHtml,
    printPaystub,
    fmtMoney,
    fmtDate,
  };
})(typeof window !== 'undefined' ? window : global);
