/**
 * ChantierTrack — Exports Excel à partir des modèles (templates/excel/*.xlsx)
 */
(function (global) {
  'use strict';

  const TPL_BASE = 'templates/excel/';

  async function loadTemplate(filename) {
    if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS non chargé');
    const res = await fetch(`${TPL_BASE}${filename}`);
    if (!res.ok) throw new Error(`Modèle Excel manquant: ${filename}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    return wb;
  }

  function findRow(ws, substr, colFrom = 2, colTo = 14, maxRow = 100) {
    const q = String(substr).toLowerCase();
    for (let r = 1; r <= maxRow; r++) {
      for (let c = colFrom; c <= colTo; c++) {
        const v = String(ws.getCell(r, c).value ?? '').toLowerCase();
        if (v.includes(q)) return r;
      }
    }
    return null;
  }

  function cloneWorksheet(wb, sourceWs, newName) {
    const safe = String(newName || 'Sheet').slice(0, 28).replace(/[\\/?*[\]:]/g, '');
    const ws = wb.addWorksheet(safe);
    sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const nr = ws.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const nc = nr.getCell(colNumber);
        nc.value = cell.value;
        if (cell.style) nc.style = JSON.parse(JSON.stringify(cell.style));
      });
      if (row.height) nr.height = row.height;
      nr.commit();
    });
    if (sourceWs.model?.merges) {
      sourceWs.model.merges.forEach(m => {
        try { ws.mergeCells(m); } catch { /* ignore */ }
      });
    }
    sourceWs.columns?.forEach((col, i) => {
      if (col?.width) ws.getColumn(i + 1).width = col.width;
    });
    return ws;
  }

  function clearRows(ws, fromRow, toRow, colFrom = 2, colTo = 13) {
    for (let r = fromRow; r <= toRow; r++) {
      for (let c = colFrom; c <= colTo; c++) ws.getCell(r, c).value = null;
    }
  }

  const dowLabels = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  function fmtDateYmd(d) {
    const dt = new Date(d);
    const p = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }

  function fmtTimeHm(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch { return ''; }
  }

  function weekRange(baseIso) {
    const d = new Date(baseIso || Date.now());
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmtDateYmd(monday), end: fmtDateYmd(sunday), monday };
  }

  function fillTimesheet(ws, empName, dept, startDate, endDate, dailyRows, weekTotal) {
    ws.getCell('B4').value = 'EMPLOYEE NAME:';
    ws.getCell('C4').value = empName || '';
    ws.getCell('E4').value = 'DEPARTMENT:';
    ws.getCell('F4').value = dept || '';
    ws.getCell('B6').value = 'DATE FROM:';
    ws.getCell('C6').value = startDate || '';
    ws.getCell('E6').value = 'DATE TO:';
    ws.getCell('F6').value = endDate || '';
    ws.getCell('B8').value = 'DAYS';
    ws.getCell('C8').value = 'CLOCK IN';
    ws.getCell('D8').value = 'CLOCK OUT';
    ws.getCell('E8').value = 'LUNCH';
    ws.getCell('F8').value = 'TOTAL';
    ws.getCell('G8').value = 'NOTES';
    dailyRows.forEach((r, i) => {
      const row = 9 + i;
      ws.getCell(row, 2).value = r.day;
      ws.getCell(row, 3).value = r.in || '';
      ws.getCell(row, 4).value = r.out || '';
      ws.getCell(row, 5).value = '';
      ws.getCell(row, 6).value = r.total || '';
      ws.getCell(row, 7).value = r.notes || '';
    });
    ws.getCell('B16').value = 'TOTAL';
    ws.getCell('F16').value = weekTotal || '';
  }

  function buildDailyRowsFromEntries(empEntries, wr) {
    const rows = [];
    let totalWeek = 0;
    dowLabels.forEach((label, i) => {
      const dayDate = new Date(wr.monday);
      dayDate.setDate(wr.monday.getDate() + i);
      const ds = fmtDateYmd(dayDate);
      const dayEntries = empEntries.filter(x => String(x.clock_in || '').slice(0, 10) === ds);
      const inVal = dayEntries[0]?.clock_in ? fmtTimeHm(dayEntries[0].clock_in) : '';
      const outVal = dayEntries.length && dayEntries[dayEntries.length - 1]?.clock_out
        ? fmtTimeHm(dayEntries[dayEntries.length - 1].clock_out) : '';
      const mins = dayEntries.reduce((a, x) => {
        const m = Number(x.duration_min) || 0;
        return a + (m > 0 ? m : (x.clock_in && x.clock_out ? Math.round((new Date(x.clock_out) - new Date(x.clock_in)) / 60000) : 0));
      }, 0);
      const h = mins ? Math.round((mins / 60) * 100) / 100 : '';
      if (h) totalWeek += Number(h);
      rows.push({
        day: label,
        in: inVal,
        out: outVal,
        total: h,
        notes: dayEntries.map(x => x.notes).filter(Boolean).join(' | '),
      });
    });
    return { rows, totalWeek: Math.round(totalWeek * 100) / 100 };
  }

  /**
   * @param {{ entries: object[], nameMap: object, lang?: string }} opts
   */
  async function buildPointagesBuffer(opts) {
    const entries = opts.entries || [];
    const nameMap = opts.nameMap || {};
    const wb = await loadTemplate('pointages.xlsx');
    const templateWs = wb.getWorksheet('TimeSheet') || wb.worksheets[0];
    if (!templateWs) throw new Error('Feuille TimeSheet introuvable');

    const byEmp = {};
    for (const e of entries) {
      if (!byEmp[e.employee]) byEmp[e.employee] = [];
      byEmp[e.employee].push(e);
    }
    const employees = Object.keys(byEmp);

    if (!employees.length) {
      fillTimesheet(templateWs, '', '', '', '', dowLabels.map(d => ({ day: d, in: '', out: '', total: '', notes: '' })), '');
      return wb.xlsx.writeBuffer();
    }

    let first = true;
    for (const empId of employees) {
      const empEntries = byEmp[empId];
      const firstEntry = empEntries[0];
      const empName = firstEntry.expand?.employee?.name || firstEntry.expand?.employee?.email || nameMap[empId] || empId;
      const dept = firstEntry.expand?.site?.name || '';
      const wr = weekRange(firstEntry.clock_in || firstEntry.created);
      const { rows, totalWeek } = buildDailyRowsFromEntries(empEntries, wr);
      const sheetName = (empName || 'Employee').slice(0, 28).replace(/[\\/?*[\]:]/g, '') || `Emp_${wb.worksheets.length}`;
      const ws = first ? templateWs : cloneWorksheet(wb, templateWs, sheetName);
      if (first && sheetName !== templateWs.name) {
        try { templateWs.name = sheetName; } catch { /* name taken */ }
      }
      first = false;
      fillTimesheet(ws, empName, dept, wr.start, wr.end, rows, totalWeek);
    }

    return wb.xlsx.writeBuffer();
  }

  /**
   * @param {{ rows: {employee,date,site,category,paid,description,amount}[], meta: object, lang?: string }} opts
   */
  async function buildDepensesBuffer(opts) {
    const L = (opts.lang || 'fr') === 'fr';
    const meta = opts.meta || {};
    const dataRows = opts.rows || [];
    const wb = await loadTemplate('depenses.xlsx');
    const ws = wb.worksheets[0];

    const headerRow = findRow(ws, 'DATE DE PAIEMENT') || findRow(ws, 'PAYMENT DATE') || 22;
    const dataStart = headerRow + 1;

    clearRows(ws, dataStart, dataStart + 80, 2, 13);

    const total = dataRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const firstDate = dataRows.length ? dataRows[dataRows.length - 1].date : '';
    const lastDate = dataRows.length ? dataRows[0].date : '';
    const mainEmployee = dataRows[0]?.employee || '';

    const titleRow = findRow(ws, 'RAPPORT DE DÉPENSES') || findRow(ws, 'EXPENSE REPORT') || 3;
    ws.getCell(titleRow, 2).value = L ? 'RAPPORT DE DÉPENSES DE BASE' : 'BASIC EXPENSE REPORT';

    const periodRow = findRow(ws, 'PÉRIODE DE DÉPENSES') || findRow(ws, 'EXPENSE PERIOD') || 8;
    const totalRow = periodRow;
    const totalCol = findRow(ws, 'TOTAL') === totalRow ? 10 : 10;
    ws.getCell(totalRow, totalCol).value = `${L ? 'TOTAL' : 'TOTAL'}: ${total.toFixed(2)} $`;

    const deRow = findRow(ws, 'De :') || findRow(ws, 'From') || periodRow + 2;
    ws.getCell(deRow, 3).value = `${L ? 'De' : 'From'} : ${firstDate}`;
    ws.getCell(deRow + 1, 3).value = `${L ? 'À' : 'To'} : ${lastDate}`;

    const infoRow = findRow(ws, "INFORMATIONS SUR L'EMPLOYÉ") || findRow(ws, 'EMPLOYEE INFORMATION') || 14;
    ws.getCell(infoRow + 2, 3).value = `${L ? 'Nom' : 'Name'}: ${mainEmployee}`;
    ws.getCell(infoRow + 3, 3).value = `${L ? 'Numéro d\'identification' : 'ID Number'}: -`;
    ws.getCell(infoRow + 4, 3).value = `${L ? 'Responsable' : 'Manager'}: ${meta.name || ''}`;
    ws.getCell(infoRow + 5, 3).value = `${L ? 'Département' : 'Department'}: ${dataRows[0]?.site || '-'}`;

    let running = 0;
    dataRows.forEach((r, i) => {
      const row = dataStart + i;
      running += Number(r.amount) || 0;
      ws.getCell(row, 3).value = r.date;
      ws.getCell(row, 5).value = r.paid || (L ? 'Non payé' : 'Unpaid');
      ws.getCell(row, 7).value = r.description;
      ws.getCell(row, 9).value = r.employee;
      ws.getCell(row, 11).value = Number(r.amount) || 0;
      ws.getCell(row, 13).value = running;
      ws.getCell(row, 11).numFmt = '#,##0.00';
      ws.getCell(row, 13).numFmt = '#,##0.00';
    });

    return wb.xlsx.writeBuffer();
  }

  /**
   * @param {{ items: object[], meta: object, lang?: string }} opts — items: date, trajet, comment, startKm, endKm, km, startTime, endTime, hours, amount, empName
   */
  async function buildMileageBuffer(opts) {
    const L = (opts.lang || 'fr') === 'fr';
    const meta = opts.meta || {};
    const items = opts.items || [];
    const wb = await loadTemplate('kilometrage.xlsx');
    const ws = wb.worksheets[0];

    const headerRow = findRow(ws, 'Trajet') || findRow(ws, 'Trip') || 11;
    const dataStart = headerRow + 1;
    const footerRow = findRow(ws, 'Total KM') || findRow(ws, 'Total KM parcourus') || dataStart + items.length + 2;

    clearRows(ws, dataStart, Math.max(footerRow - 1, dataStart + 60), 2, 10);

    const totalKm = items.reduce((a, x) => a + (Number(x.km) || 0), 0);
    const totalAmt = items.reduce((a, x) => a + (Number(x.amount) || 0), 0);

    const titleRow = findRow(ws, 'Suivi du kilométrage') || findRow(ws, 'Mileage Tracking') || 2;
    ws.getCell(titleRow, 2).value = L ? 'Suivi du kilométrage' : 'Mileage Tracking';

    const entRow = findRow(ws, 'Entreprise') || 5;
    ws.getCell(entRow, 2).value = `${L ? 'Entreprise' : 'Company'} : ${meta.name || ''}`;
    ws.getCell(entRow, 6).value = `${L ? 'Relevé de compteur au départ' : 'Starting odometer'} : ${items[0]?.startKm ?? ''}`;
    ws.getCell(entRow + 1, 2).value = `${L ? 'Nom' : 'Name'} : ${items[0]?.empName || ''}`;
    ws.getCell(entRow + 1, 6).value = `${L ? 'Relevé de compteur à l\'arrivée' : 'Ending odometer'} : ${items[0]?.endKm ?? ''}`;
    ws.getCell(entRow + 2, 2).value = `${L ? 'Type de véhicule' : 'Vehicle type'} : 5 CV`;
    ws.getCell(entRow + 2, 6).value = `${L ? 'Kilomètres parcourus' : 'Distance traveled'} : ${totalKm.toFixed(1)}`;
    ws.getCell(entRow + 3, 2).value = `${L ? 'Année' : 'Year'} : ${new Date().getFullYear()}`;
    ws.getCell(entRow + 3, 6).value = `${L ? 'Compensation' : 'Compensation'} : ${totalAmt.toFixed(2)} $`;

    items.forEach((m, i) => {
      const r = dataStart + i;
      ws.getCell(r, 2).value = m.date;
      ws.getCell(r, 3).value = m.trajet;
      ws.getCell(r, 4).value = m.comment;
      ws.getCell(r, 5).value = m.startKm;
      ws.getCell(r, 6).value = m.endKm;
      ws.getCell(r, 7).value = m.km;
      ws.getCell(r, 8).value = m.startTime;
      ws.getCell(r, 9).value = m.endTime;
      ws.getCell(r, 10).value = m.hours;
    });

    if (footerRow) {
      ws.getCell(footerRow, 2).value = L ? 'Total KM parcourus' : 'Total KM traveled';
      ws.getCell(footerRow, 7).value = totalKm;
      const amtRow = footerRow + 1;
      if (String(ws.getCell(amtRow, 2).value || '').toLowerCase().includes('montant') ||
          String(ws.getCell(amtRow, 2).value || '').toLowerCase().includes('indemn')) {
        ws.getCell(amtRow, 7).value = totalAmt;
      }
    }

    return wb.xlsx.writeBuffer();
  }

  global.ChantierTrackExcelExport = {
    loadTemplate,
    buildPointagesBuffer,
    buildDepensesBuffer,
    buildMileageBuffer,
  };
})(typeof window !== 'undefined' ? window : global);
