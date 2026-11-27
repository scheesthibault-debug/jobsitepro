/**
 * JobsitePro — PDF soumissions (jsPDF + AutoTable)
 */
(function (global) {
  'use strict';

  async function generatePdf(soumissionId, ctx) {
    const { api, lang, fmtMoney, showToast } = ctx;
    const L = lang === 'fr';
    if (!global.jspdf?.jsPDF) {
      showToast(L ? 'jsPDF non chargé' : 'jsPDF not loaded', false);
      return;
    }
    let rec;
    try {
      rec = await api('GET', `/api/collections/soumissions/records/${soumissionId}?expand=site,company`);
    } catch (e) {
      showToast(e.message, false);
      return;
    }
    const comp = rec.expand?.company || {};
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(comp.name || 'JobsitePro', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(L ? 'Soumission / Estimé' : 'Quote / Estimate', 14, 20);
    doc.text(rec.numero || soumissionId.slice(0, 8), 14, 26);

    let y = 36;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(rec.titre || rec.expand?.site?.name || '–', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${L ? 'Client' : 'Client'}: ${rec.client_nom || '–'}`, 14, y); y += 5;
    if (rec.client_email) { doc.text(`Email: ${rec.client_email}`, 14, y); y += 5; }
    if (rec.client_tel) { doc.text(`${L ? 'Tél' : 'Phone'}: ${rec.client_tel}`, 14, y); y += 5; }
    if (rec.adresse) { doc.text(`${L ? 'Adresse' : 'Address'}: ${rec.adresse}`, 14, y); y += 5; }
    y += 4;

    const phases = rec.phases || [];
    const rows = [];
    for (const ph of phases) {
      for (const ln of ph.lignes || []) {
        let sub = 0;
        let detail = '';
        if (ln.type === 'main_oeuvre') {
          sub = (Number(ln.heures) || 0) * (Number(ln.taux) || 0);
          detail = `${ln.heures || 0} h × ${ln.taux || 0} $/h`;
        } else {
          sub = (Number(ln.quantite) || 0) * (Number(ln.prix_unitaire) || 0);
          detail = `${ln.quantite || 0} ${ln.unite || 'u'} × ${ln.prix_unitaire || 0} $`;
        }
        rows.push([ph.nom || '–', ln.libelle || '–', ln.type === 'main_oeuvre' ? (L ? 'MO' : 'Labor') : (L ? 'Mat.' : 'Mat.'), detail, sub.toFixed(2)]);
      }
    }

    if (global.jspdf?.autoTable && rows.length) {
      doc.autoTable({
        startY: y,
        head: [[L ? 'Phase' : 'Phase', L ? 'Description' : 'Description', L ? 'Type' : 'Type', L ? 'Détail' : 'Detail', 'HT']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55], textColor: 241, 245, 249 },
        styles: { fontSize: 8 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`${L ? 'Sous-total HT' : 'Subtotal'}: ${fmtMoney(rec.montant_ht)}`, 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`TPS: ${fmtMoney(rec.montant_tps)} · TVQ: ${fmtMoney(rec.montant_tvq || 0)}`, 14, y); y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11);
    doc.text(`Total TTC: ${fmtMoney(rec.montant_ttc)}`, 14, y);
    if (rec.notes) {
      y += 10;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(rec.notes, 180);
      doc.text(lines, 14, y);
    }

    const fname = `soumission_${(rec.numero || soumissionId).replace(/[^\w-]/g, '_')}.pdf`;
    doc.save(fname);
    showToast(L ? 'PDF téléchargé' : 'PDF downloaded');
  }

  global.ChantierTrackSoumissionsPdf = { generatePdf };
})(typeof window !== 'undefined' ? window : global);
