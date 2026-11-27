/**
 * JobsitePro — Rapports PDF (pointages, dépenses, kilométrage, index)
 */
(function (global) {
  'use strict';

  const BRAND = [234, 140, 42];
  const HEAD = [51, 65, 85];
  const MUTED = [100, 116, 139];
  const DOW = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const DOW_FR = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

  function isFr(lang) { return lang !== 'en'; }

  function fmtYmd(d) {
    const dt = new Date(d);
    const p = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }

  function fmtHm(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch { return '—'; }
  }

  function weekRange(baseIso) {
    const d = new Date(baseIso || Date.now());
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmtYmd(monday), end: fmtYmd(sunday), monday };
  }

  function entryMins(p) {
    let m = Number(p?.duration_min) || 0;
    if (p?.clock_in) {
      const end = p.clock_out || new Date().toISOString();
      const fromClock = Math.round((new Date(end) - new Date(p.clock_in)) / 60000);
      if (!p.clock_out) m = fromClock;
      else if (m <= 0 || m > 24 * 60) m = fromClock;
    }
    if (m > 24 * 60) m = 24 * 60;
    return Math.max(0, m);
  }

  function money(n, lang) {
    const v = Number(n) || 0;
    return `${v.toFixed(2)} ${isFr(lang) ? '$' : 'CAD'}`;
  }

  function newDoc() {
    if (!global.jspdf?.jsPDF) throw new Error('jsPDF non chargé');
    return new global.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  }

  function drawBanner(doc, meta, title, lang, periodLine) {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('JobsitePro', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(meta?.name || '', 14, 22);
    doc.setFontSize(9);
    doc.text(meta?.generated || '', 14, 28);

    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    const right = meta?.province ? `${meta.province}` : '';
    if (right) doc.text(right, 196, 14, { align: 'right' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = 52;
    if (periodLine) {
      doc.setTextColor(...MUTED);
      doc.text(periodLine, 14, y);
      y += 7;
    }
    if (meta?.address) {
      doc.setFontSize(9);
      doc.text(meta.address, 14, y);
      y += 5;
    }
    if (meta?.phone) {
      doc.text(meta.phone, 14, y);
      y += 5;
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, y + 2, 196, y + 2);
    return y + 10;
  }

  function autoTable(doc, startY, head, body, opts = {}) {
    doc.autoTable({
      startY,
      head: [head],
      body,
      styles: { fontSize: opts.fontSize || 9, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: HEAD, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      ...opts.tableOpts,
    });
    return doc.lastAutoTable.finalY + 8;
  }

  function groupEntriesByEmployee(entries) {
    const by = {};
    for (const e of entries || []) {
      if (!by[e.employee]) by[e.employee] = [];
      by[e.employee].push(e);
    }
    return by;
  }

  function buildTimesheetRows(empEntries, lang) {
    const first = empEntries[0];
    const wr = weekRange(first?.clock_in || first?.created);
    const labels = isFr(lang) ? DOW_FR : DOW;
    const rows = [];
    let totalH = 0;
    labels.forEach((label, i) => {
      const dayDate = new Date(wr.monday);
      dayDate.setDate(wr.monday.getDate() + i);
      const ds = fmtYmd(dayDate);
      const dayEntries = empEntries.filter(x => String(x.clock_in || '').slice(0, 10) === ds);
      const mins = dayEntries.reduce((a, x) => a + entryMins(x), 0);
      const h = mins ? Math.round((mins / 60) * 100) / 100 : '';
      if (h) totalH += Number(h);
      const site = dayEntries.map(x => x.expand?.site?.name).filter(Boolean)[0] || '';
      rows.push([
        label,
        dayEntries[0]?.clock_in ? fmtHm(dayEntries[0].clock_in) : '—',
        dayEntries.length && dayEntries[dayEntries.length - 1]?.clock_out
          ? fmtHm(dayEntries[dayEntries.length - 1].clock_out) : '—',
        h !== '' ? String(h) : '—',
        site || dayEntries.map(x => x.notes).filter(Boolean).join(' · ') || '—',
      ]);
    });
    return { rows, totalH: Math.round(totalH * 100) / 100, wr };
  }

  /**
   * Fiches de pointage — une section par employé
   */
  function buildPointagesPdf(entries, nameMap, meta, lang, periodStart, periodEnd) {
    const L = isFr(lang);
    const doc = newDoc();
    const title = L ? 'Fiches de pointage' : 'Time sheets';
    const periodLine = periodStart && periodEnd
      ? `${L ? 'Période' : 'Period'}: ${periodStart} → ${periodEnd}`
      : '';
    const byEmp = groupEntriesByEmployee(entries);
    const empIds = Object.keys(byEmp);

    if (!empIds.length) {
      const y0 = drawBanner(doc, meta, title, lang, periodLine);
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text(L ? 'Aucun pointage sur la période.' : 'No time entries for this period.', 14, y0);
      return doc;
    }

    const head = L
      ? ['Jour', 'Arrivée', 'Départ', 'Heures', 'Chantier / notes']
      : ['Day', 'Clock in', 'Clock out', 'Hours', 'Site / notes'];

    empIds.forEach((empId, idx) => {
      if (idx > 0) doc.addPage();
      const empEntries = byEmp[empId];
      const first = empEntries[0];
      const empName = first.expand?.employee?.name || first.expand?.employee?.email || nameMap[empId] || empId;
      const dept = first.expand?.site?.name || '—';
      const { rows, totalH, wr } = buildTimesheetRows(empEntries, lang);
      const subPeriod = `${wr.start} → ${wr.end}`;
      let y = drawBanner(doc, meta, title, lang, periodLine || subPeriod);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`${L ? 'Employé' : 'Employee'}: ${empName}`, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text(`${L ? 'Chantier principal' : 'Main site'}: ${dept}`, 14, y);
      y += 8;
      y = autoTable(doc, y, head, rows);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...BRAND);
      doc.text(`${L ? 'Total semaine' : 'Week total'}: ${totalH} h`, 14, y);
    });

    return doc;
  }

  /**
   * Rapport de dépenses stylé
   */
  function buildDepensesPdf(dataRows, meta, lang) {
    const L = isFr(lang);
    const doc = newDoc();
    const title = L ? 'Rapport de dépenses' : 'Expense report';
    const rows = dataRows || [];
    const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const firstDate = rows.length ? rows[rows.length - 1].date : '—';
    const lastDate = rows.length ? rows[0].date : '—';
    const periodLine = rows.length
      ? `${L ? 'Du' : 'From'} ${firstDate} ${L ? 'au' : 'to'} ${lastDate}`
      : '';

    let y = drawBanner(doc, meta, title, lang, periodLine);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    if (rows[0]?.employee) {
      doc.text(`${L ? 'Employé principal' : 'Main employee'}: ${rows[0].employee}`, 14, y);
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${L ? 'Total' : 'Total'}: ${money(total, lang)}`, 14, y);
    y += 10;

    if (!rows.length) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(L ? 'Aucune dépense.' : 'No expenses.', 14, y);
      return doc;
    }

    const head = L
      ? ['Date', 'Description', 'Payé à', 'Mode', 'Montant', 'Sous-total']
      : ['Date', 'Description', 'Paid to', 'Method', 'Amount', 'Subtotal'];
    let running = 0;
    const body = rows.map(r => {
      running += Number(r.amount) || 0;
      return [
        r.date || '—',
        String(r.description || '—').slice(0, 60),
        r.employee || '—',
        r.paid || '—',
        money(r.amount, lang),
        money(running, lang),
      ];
    });
    autoTable(doc, y, head, body, { fontSize: 8 });
    return doc;
  }

  /**
   * Suivi kilométrage
   */
  function buildMileagePdf(items, meta, lang) {
    const L = isFr(lang);
    const doc = newDoc();
    const title = L ? 'Suivi du kilométrage' : 'Mileage log';
    const list = items || [];
    const totalKm = list.reduce((a, x) => a + (Number(x.km) || 0), 0);
    const totalAmt = list.reduce((a, x) => a + (Number(x.amount) || 0), 0);

    let y = drawBanner(doc, meta, title, lang, '');
    const info = [
      [`${L ? 'Entreprise' : 'Company'}`, meta?.name || '—'],
      [`${L ? 'Conducteur' : 'Driver'}`, list[0]?.empName || '—'],
      [`${L ? 'Kilomètres' : 'Distance'}`, `${totalKm.toFixed(1)} km`],
      [`${L ? 'Indemnité' : 'Compensation'}`, money(totalAmt, lang)],
    ];
    info.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(k + ':', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(String(v), 52, y);
      y += 6;
    });
    y += 4;

    if (!list.length) {
      doc.setTextColor(...MUTED);
      doc.text(L ? 'Aucun trajet.' : 'No trips.', 14, y);
      return doc;
    }

    const head = L
      ? ['Date', 'Trajet', 'Commentaire', 'Km', 'Départ', 'Arrivée']
      : ['Date', 'Trip', 'Comment', 'Km', 'Depart', 'Arrive'];
    const body = list.map(m => [
      m.date || '—',
      String(m.trajet || '—').slice(0, 45),
      String(m.comment || '—').slice(0, 30),
      m.km != null && m.km !== '' ? Number(m.km).toFixed(1) : '—',
      m.startTime || '—',
      m.endTime || '—',
    ]);
    y = autoTable(doc, y, head, body, { fontSize: 8 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text(`${L ? 'Total kilomètres' : 'Total distance'}: ${totalKm.toFixed(1)} km`, 14, y);
    doc.text(`${L ? 'Montant total' : 'Total amount'}: ${money(totalAmt, lang)}`, 14, y + 7);
    return doc;
  }

  /** Index photos / incidents (tableau simple) */
  function buildTablePdf(title, meta, lang, periodLine, head, body) {
    const doc = newDoc();
    let y = drawBanner(doc, meta, title, lang, periodLine);
    if (!body.length) {
      doc.setTextColor(...MUTED);
      doc.text(isFr(lang) ? 'Aucune donnée.' : 'No data.', 14, y);
      return doc;
    }
    autoTable(doc, y, head, body, { fontSize: 8 });
    return doc;
  }

  function toBlob(doc) {
    return doc.output('blob');
  }

  global.ChantierTrackPdfReports = {
    buildPointagesPdf,
    buildDepensesPdf,
    buildMileagePdf,
    buildTablePdf,
    buildPointagesBlob: (e, nm, m, l, ps, pe) => toBlob(buildPointagesPdf(e, nm, m, l, ps, pe)),
    buildDepensesBlob: (rows, m, l) => toBlob(buildDepensesPdf(rows, m, l)),
    buildMileageBlob: (items, m, l) => toBlob(buildMileagePdf(items, m, l)),
    buildTableBlob: (title, m, l, pl, h, b) => toBlob(buildTablePdf(title, m, l, pl, h, b)),
  };
})(typeof window !== 'undefined' ? window : global);
