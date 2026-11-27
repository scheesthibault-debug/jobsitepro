/**
 * JobsitePro — Export PDF rapport coûts chantier
 */
(function (global) {
  'use strict';

  async function exportSiteCostPdf(ctx, site, totals) {
    const { lang, fmtMoney, showToast } = ctx;
    const L = lang === 'fr';
    if (!global.jspdf?.jsPDF) {
      showToast(L ? 'jsPDF non chargé' : 'jsPDF not loaded', false);
      return;
    }
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(L ? 'Rapport de coûts chantier' : 'Job cost report', 14, 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(site?.name || '–', 14, 18);

    let y = 32;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(`${L ? 'Budget prévu' : 'Budget'}: ${fmtMoney(totals.budget)}`, 14, y); y += 7;
    doc.text(`${L ? 'Coût réel' : 'Actual cost'}: ${fmtMoney(totals.total)}`, 14, y); y += 7;
    doc.text(`${L ? 'Utilisation' : 'Used'}: ${totals.pct}%`, 14, y); y += 10;

    const rows = [
      [L ? 'Main-d\'œuvre' : 'Labor', fmtMoney(totals.labor), `${totals.hours.toFixed(1)} h`],
      [L ? 'Dépenses approuvées' : 'Approved expenses', fmtMoney(totals.expensesCost), ''],
      [L ? 'Kilométrage' : 'Mileage', fmtMoney(totals.mileageCost), ''],
    ];
    if (global.jspdf?.autoTable) {
      doc.autoTable({
        startY: y,
        head: [[L ? 'Catégorie' : 'Category', L ? 'Montant' : 'Amount', L ? 'Détail' : 'Detail']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] },
      });
    }
    doc.save(`couts_${(site?.name || 'chantier').replace(/[^\w-]/g, '_')}.pdf`);
    showToast(L ? 'PDF téléchargé' : 'PDF downloaded');
  }

  function exportCurrent() {
    const ctx = global.getPatronModuleCtx?.();
    const totals = global.__jcLastTotals;
    const siteId = global.localStorage?.getItem('jc_site_id');
    if (!ctx || !totals || !siteId) {
      ctx?.showToast?.(ctx.lang === 'fr' ? 'Ouvrez un chantier d\'abord' : 'Select a site first', false);
      return;
    }
    ctx.api('GET', `/api/collections/sites/records/${siteId}`).then(site => {
      exportSiteCostPdf(ctx, site, totals);
    }).catch(e => ctx.showToast(e.message, false));
  }

  global.ChantierTrackJobCostPdf = { exportSiteCostPdf, exportCurrent };
})(typeof window !== 'undefined' ? window : global);
