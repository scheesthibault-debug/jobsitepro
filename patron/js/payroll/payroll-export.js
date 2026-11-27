/**
 * JobsitePro — Export CSV paie pour services tiers (Wagepoint, etc.)
 * Génération côté client uniquement — rien n'est enregistré sur le serveur.
 */
(function (global) {
  'use strict';

  const Hours = global.ChantierTrackPayrollHours;
  const Estimate = global.ChantierTrackPayrollEstimate;

  /** En-têtes proches du modèle Wagepoint (import heures .CSV). */
  const WAGEPOINT_HEADER = ['Employee Name', 'Regular Pay', 'Overtime Pay'];

  function csvEscape(v) {
    const s = String(v ?? '');
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function buildCsv(rows, sep) {
    const delimiter = sep || ';';
    const bom = '\uFEFF';
    return bom + rows.map(r => r.map(csvEscape).join(delimiter)).join('\r\n');
  }

  function downloadCsvText(csvText, filename) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadCsv(rows, filename, sep) {
    downloadCsvText(buildCsv(rows, sep), filename);
  }

  function downloadCsvLegacy(rows, filename) {
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Excel structuré (colonnes séparées) — compatible Excel FR/EN. */
  function downloadXlsx(rows, filename, sheetName) {
    if (typeof XLSX === 'undefined') {
      throw new Error(typeof lang !== 'undefined' && lang === 'en'
        ? 'Excel library not loaded'
        : 'Librairie Excel non chargée');
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const header = rows[0] || [];
    ws['!cols'] = header.map((_, i) => {
      let w = 12;
      for (let r = 0; r < rows.length && r < 100; r++) {
        w = Math.max(w, String(rows[r][i] ?? '').length + 1);
      }
      return { wch: Math.min(36, w) };
    });
    const safeSheet = String(sheetName || 'Heures').slice(0, 31).replace(/[\\/?*[\]:]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, safeSheet);
    const out = filename.endsWith('.xlsx') ? filename : filename.replace(/\.csv$/i, '.xlsx');
    XLSX.writeFile(wb, out);
  }

  /**
   * Compile les heures par employé pour une période (lecture PocketBase seulement).
   * @returns {Promise<{ rows: string[][], periodStart: string, periodEnd: string, employees: object[] }>}
   */
  async function compilePayPeriodExport(periodStart, periodEnd) {
    if (!periodStart || !periodEnd) throw new Error('Période invalide');
    const c = typeof co === 'function' ? co() : '';
    const companyFilter = c ? `company="${c}"` : '';

    const province = typeof currentCompanyProvince === 'function' ? currentCompanyProvince() : 'QC';

    const [ptg, emps, ratesRes, nameMapRes] = await Promise.all([
      typeof apiList === 'function'
        ? apiList(
            'time_entries',
            `${companyFilter}${companyFilter ? '&&' : ''}clock_in>="${periodStart}"&&clock_in<="${periodEnd} 23:59:59"`,
            'employee',
            '-clock_in',
            800,
          ).catch(() => ({ items: [] }))
        : { items: [] },
      typeof apiList === 'function'
        ? apiList('users', companyFilter, '', '-created', 200).catch(() => ({ items: [] }))
        : { items: [] },
      typeof apiList === 'function'
        ? apiList('pay_rates', companyFilter, 'employee', '-created', 200).catch(() => ({ items: [] }))
        : { items: [] },
      typeof loadEmployeeNameMap === 'function' ? loadEmployeeNameMap() : {},
    ]);

    const nameMap = nameMapRes || {};
    const entries = ptg.items || [];
    const empHours = Hours ? Hours.computeEmployeeHoursWeeklyOT(entries, periodStart, periodEnd) : {};
    const rawByEmp = Hours?.computeEmployeeRawMinutes
      ? Hours.computeEmployeeRawMinutes(entries, periodStart, periodEnd)
      : {};

    const empList = (emps.items || []).filter(e => e.role !== 'admin');
    const rates = ratesRes?.items || [];
    const summaryHeader = ['nom_employe', 'heures_régulières', 'heures_supplémentaires', 'date_début', 'date_fin'];
    const summaryRows = [];
    const wagepointRows = [];
    const previewRows = [];

    for (const emp of empList) {
      const h = empHours[emp.id] || { reg: 0, ot: 0 };
      const regH = Hours ? Hours.minsToHours(h.reg) : 0;
      const otH = Hours ? Hours.minsToHours(h.ot) : 0;
      const nom = emp.name || emp.email || nameMap[emp.id] || emp.id;
      const rate = rates.find(r => r.employee === emp.id);
      const hasHours = regH + otH > 0;
      const est = hasHours && Estimate
        ? Estimate.estimateFromHours(regH, otH, rate?.hourly_rate, rate?.overtime_rate, province)
        : { gross: 0, net: 0 };

      if (hasHours) {
        summaryRows.push([
          nom,
          regH.toFixed(2).replace('.', ','),
          otH.toFixed(2).replace('.', ','),
          periodStart,
          periodEnd,
        ]);
        wagepointRows.push([nom, regH.toFixed(2), otH.toFixed(2)]);
      }
      const rawH = Hours ? Hours.minsToHours(rawByEmp[emp.id] || 0) : regH + otH;
      previewRows.push({
        nom, regH, otH, rawH, gross: est.gross, net: est.net, hasHours,
      });
    }

    previewRows.sort((a, b) => {
      if (a.hasHours !== b.hasHours) return a.hasHours ? -1 : 1;
      return String(a.nom).localeCompare(String(b.nom), undefined, { sensitivity: 'base' });
    });

    return {
      summaryHeader,
      summaryRows,
      wagepointHeader: WAGEPOINT_HEADER,
      wagepointRows,
      previewRows,
      rows: [summaryHeader, ...summaryRows],
      wagepointCsvRows: [WAGEPOINT_HEADER, ...wagepointRows],
      periodStart,
      periodEnd,
      employeeCount: summaryRows.length,
      employeeTotal: empList.length,
      province,
    };
  }

  function exportPayPeriodCsv(periodStart, periodEnd) {
    return compilePayPeriodExport(periodStart, periodEnd).then(compiled => {
      if (!compiled.summaryRows.length) {
        throw new Error(typeof lang !== 'undefined' && lang === 'en'
          ? 'No hours to export for this period'
          : 'Aucune heure à exporter pour cette période');
      }
      const fname = `export_paie_${periodStart}_${periodEnd}.xlsx`;
      const sheet = typeof lang !== 'undefined' && lang === 'en' ? 'Payroll hours' : 'Heures paie';
      downloadXlsx([compiled.summaryHeader, ...compiled.summaryRows], fname, sheet);
      return compiled;
    });
  }

  /** Colonnes Wagepoint (EN) — fichier Excel pour recopier dans leur modèle. */
  function exportPayPeriodWagepointCsv(periodStart, periodEnd) {
    return compilePayPeriodExport(periodStart, periodEnd).then(compiled => {
      if (!compiled.wagepointRows.length) throw new Error('Aucune heure');
      downloadXlsx(
        compiled.wagepointCsvRows,
        `wagepoint_heures_${periodStart}_${periodEnd}.xlsx`,
        'Wagepoint',
      );
      return compiled;
    });
  }

  function exportPayPeriodSummaryCsv(periodStart, periodEnd) {
    return compilePayPeriodExport(periodStart, periodEnd).then(compiled => {
      if (!compiled.summaryRows.length) throw new Error('Aucune heure');
      const sheet = typeof lang !== 'undefined' && lang === 'en' ? 'Hours' : 'Heures';
      downloadXlsx(
        [compiled.summaryHeader, ...compiled.summaryRows],
        `jobsitepro_heures_${periodStart}_${periodEnd}.xlsx`,
        sheet,
      );
      return compiled;
    });
  }

  function renderPreviewHtml(compiled) {
    if (!compiled.previewRows.length) {
      return `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">
        ${typeof lang !== 'undefined' && lang === 'en' ? 'No employees in this company.' : 'Aucun employé dans cette entreprise.'}
      </div>`;
    }
    const fmt = typeof fmtMoney === 'function' ? fmtMoney : n => String(n);
    const noH = typeof lang !== 'undefined' && lang === 'en' ? 'No hours this period' : 'Aucune heure sur la période';
    const th = (typeof lang !== 'undefined' && lang === 'en'
      ? ['Employee', 'Clocked', 'Reg. h', 'OT h', 'Gross est.', 'Net est.']
      : ['Employé', 'Pointé', 'H. rég.', 'H. supp.', 'Brut approx.', 'Net approx.']
    ).map(h => `<th style="padding:8px 10px;text-align:left;font-size:10px">${h}</th>`).join('');
    const body = compiled.previewRows.map(r => {
      const dim = r.hasHours ? '' : 'opacity:.55';
      const grossCell = r.hasHours
        ? `<td style="padding:6px 10px;font-size:11px;color:var(--green-l)">${fmt(r.gross)}</td>`
        : `<td style="padding:6px 10px;font-size:10px;color:var(--text3)">${noH}</td>`;
      const netCell = r.hasHours
        ? `<td style="padding:6px 10px;font-size:11px;font-weight:600">${fmt(r.net)}</td>`
        : `<td style="padding:6px 10px;font-size:11px;color:var(--text3)">—</td>`;
      return `<tr style="${dim}">
      <td style="padding:6px 10px;font-size:11px">${String(r.nom).replace(/</g, '&lt;')}</td>
      <td style="padding:6px 10px;font-size:11px;font-weight:600">${r.rawH.toFixed(2)}</td>
      <td style="padding:6px 10px;font-size:11px">${r.regH.toFixed(2)}</td>
      <td style="padding:6px 10px;font-size:11px">${r.otH.toFixed(2)}</td>
      ${grossCell}
      ${netCell}
    </tr>`;
    }).join('');
    const wpNote = typeof lang !== 'undefined' && lang === 'en'
      ? 'Excel export uses Wagepoint columns: Employee Name, Regular Pay, Overtime Pay. Copy into your Wagepoint template if names differ.'
      : 'Export Excel : colonnes Wagepoint (Employee Name, Regular Pay, Overtime Pay). Recopiez dans le modèle téléchargé depuis Wagepoint si besoin.';
    return `<p style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.45">${wpNote}</p>
      <div style="overflow:auto;max-height:420px">
      <table class="data-table" style="width:100%"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
    </div>`;
  }

  global.ChantierTrackPayrollExport = {
    compilePayPeriodExport,
    exportPayPeriodCsv,
    exportPayPeriodWagepointCsv,
    exportPayPeriodSummaryCsv,
    renderPreviewHtml,
    downloadCsv,
    downloadXlsx,
    WAGEPOINT_HEADER,
  };
})(typeof window !== 'undefined' ? window : global);
