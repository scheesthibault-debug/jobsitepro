/**
 * ChantierTrack — UI simulateur fiche de paie (branché PocketBase / section Paie)
 */
(function (global) {
  'use strict';

  const Engine = global.ChantierTrackPayroll;
  const Preview = global.ChantierTrackPaystubPreview;

  function getLang() {
    return typeof lang !== 'undefined' && lang === 'en' ? 'en' : 'fr';
  }

  function escAttr(s) {
    if (global.JobsiteEscapeHtml && global.JobsiteEscapeHtml.escapeAttr) {
      return global.JobsiteEscapeHtml.escapeAttr(s);
    }
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function provinceOptionsHtml() {
    const L = getLang() === 'fr';
    const cfg = global.ChantierTrackPayrollConfig;
    const codes = Object.keys(cfg.PROVINCE_RULES).sort();
    return codes.map(c => {
      const p = cfg.PROVINCE_RULES[c];
      return `<option value="${c}">${L ? p.fr : p.en} (${c})</option>`;
    }).join('');
  }

  function readSimulatorForm() {
    const g = id => document.getElementById(id);
    // employeeName = nom réel (dropdown), psim-employee = métier, psim-emp-id = courriel
    const pickSel = g('psim-employee-pick');
    const pickedName = pickSel?.selectedOptions?.[0]?.dataset?.name || '';
    return {
      employee: {
        employerName: g('psim-employer')?.value?.trim() || '',
        employeeName: pickedName || g('psim-employee')?.value?.trim() || '',
        employeeId: g('psim-employee')?.value?.trim() || '',  // métier → ligne "Métier" du PDF
        province: g('psim-province')?.value || 'QC',
        payPeriodStart: g('psim-period-start')?.value || g('pay-start')?.value || '',
        payPeriodEnd: g('psim-period-end')?.value || g('pay-end')?.value || '',
        payDate: g('psim-pay-date')?.value || new Date().toISOString().slice(0, 10),
        hrNotes: g('psim-notes')?.value?.trim() || '',
      },
      work: {
        regularHours: parseFloat(g('psim-reg-h')?.value) || 0,
        overtimeHours: parseFloat(g('psim-ot-h')?.value) || 0,
        hourlyRate: parseFloat(g('psim-rate')?.value) || 0,
        overtimeRate: parseFloat(g('psim-ot-rate')?.value) || 0,
        mileagePay: parseFloat(g('psim-mileage')?.value) || 0,
      },
    };
  }

  function syncOtRateDefault() {
    const rate = parseFloat(document.getElementById('psim-rate')?.value) || 0;
    const otEl = document.getElementById('psim-ot-rate');
    if (otEl && !otEl.dataset.userEdited) {
      otEl.value = (rate * 1.5).toFixed(2);
    }
  }

  async function onSimulatorEmployeePick() {
    const sel = document.getElementById('psim-employee-pick');
    const opt = sel?.selectedOptions?.[0];
    if (!opt?.value) {
      refreshPaystubPreview();
      return;
    }
    if (typeof global.fillPayFormFromEmployeeOption === 'function') {
      await global.fillPayFormFromEmployeeOption(opt);
    } else {
      const nameEl = document.getElementById('psim-employee');
      const idEl = document.getElementById('psim-emp-id');
      const rateEl = document.getElementById('psim-rate');
      if (nameEl) nameEl.value = opt.dataset.job   || '';   // métier
      if (idEl)   idEl.value   = opt.dataset.email || '';   // courriel
      const roleEl = document.getElementById('psim-role');
      if (roleEl) roleEl.value = opt.dataset.role || '';    // rôle
      const rate = parseFloat(opt.dataset.rate);
      if (rate > 0 && rateEl) {
        rateEl.value = rate;
        const otEl = document.getElementById('psim-ot-rate');
        if (otEl) delete otEl.dataset.userEdited;
        syncOtRateDefault();
      }
      if (typeof global.loadEmployeeHoursFromPointage === 'function') {
        await global.loadEmployeeHoursFromPointage(opt.value);
      }
    }
    refreshPaystubPreview();
  }

  async function refreshPayrollSimulatorEmployeePick() {
    const sel = document.getElementById('psim-employee-pick');
    if (!sel || typeof apiList !== 'function' || typeof co !== 'function') return;
    const c = co();
    const filter = c ? `company="${c}"` : '';
    let emps = { items: [] };
    let rates = { items: [] };
    try {
      [emps, rates] = await Promise.all([
        apiList('users', filter, '', '-created', 100),
        apiList('pay_rates', filter, 'employee', '', 200),
      ]);
    } catch { /* ignore */ }
    const prev = sel.value;
    const list = (emps.items || []).filter(e => e.role !== 'admin');
    sel.innerHTML = '<option value="">—</option>' + list.map(e => {
      const r = (rates.items || []).find(x => x.employee === e.id);
      const hr = r?.hourly_rate || '';
      const name = e.name || e.email || '';
      return `<option value="${e.id}" data-rate="${hr}" data-name="${escAttr(name)}" data-email="${escAttr(e.email || '')}" data-job="${escAttr(e.job_title || '')}" data-role="${escAttr(e.responsibility_role || '')}">${escAttr(name)}</option>`;
    }).join('');
    if (prev && list.some(e => e.id === prev)) sel.value = prev;
    if (!sel.dataset.psimPickBound) {
      sel.dataset.psimPickBound = '1';
      sel.addEventListener('change', onSimulatorEmployeePick);
    }
  }

  function refreshPaystubPreview() {
    if (!Engine || !Preview) return;
    const el = document.getElementById('paystub-preview-host');
    if (!el) return;
    const { employee, work } = readSimulatorForm();
    if (!work.overtimeRate && work.hourlyRate) {
      work.overtimeRate = work.hourlyRate * 1.5;
    }
    const result = Engine.computePaystub(employee, work);
    el.innerHTML = Preview.renderPaystubHtml(result, { locale: getLang() });
  }

  function initPayrollSimulator() {
    const provSel = document.getElementById('psim-province');
    if (provSel && !provSel.options.length) {
      provSel.innerHTML = provinceOptionsHtml();
    }
    // Auto-sélectionner la province de la compagnie
    if (provSel) {
      const compProv = (typeof currentCompanyProvince === 'function' ? currentCompanyProvince() : null)
        || localStorage.getItem('ct_company_province') || 'QC';
      provSel.value = compProv;
    }
    const empIn = document.getElementById('psim-employer');
    if (empIn && !empIn.value) {
      loadCompanyExportMeta?.().then(m => {
        if (m?.name && !empIn.value) empIn.value = m.name;
        // Aussi mettre à jour la province si disponible dans les métadonnées
        if (m?.province && provSel) provSel.value = m.province;
        refreshPaystubPreview();
      }).catch(() => {});
    }
    const ids = ['psim-employer', 'psim-employee', 'psim-emp-id', 'psim-province', 'psim-period-start', 'psim-period-end', 'psim-pay-date', 'psim-notes', 'psim-reg-h', 'psim-ot-h', 'psim-rate', 'psim-ot-rate', 'psim-mileage'];
    ids.forEach(id => {
      const node = document.getElementById(id);
      if (!node || node.dataset.psimBound) return;
      node.dataset.psimBound = '1';
      node.addEventListener('input', () => {
        if (id === 'psim-rate') syncOtRateDefault();
        refreshPaystubPreview();
      });
      node.addEventListener('change', refreshPaystubPreview);
    });
    const otEl = document.getElementById('psim-ot-rate');
    if (otEl) {
      otEl.addEventListener('input', () => { otEl.dataset.userEdited = '1'; });
    }
    document.getElementById('btn-psim-print')?.addEventListener('click', () => {
      Preview.printPaystub(document.getElementById('paystub-preview-host'));
    });
    document.getElementById('btn-psim-load-period')?.addEventListener('click', async () => {
      const ps = document.getElementById('pay-start')?.value;
      const pe = document.getElementById('pay-end')?.value;
      if (ps) document.getElementById('psim-period-start').value = ps;
      if (pe) document.getElementById('psim-period-end').value = pe;
      const empId = document.getElementById('psim-employee-pick')?.value;
      if (empId && typeof global.loadEmployeeHoursFromPointage === 'function') {
        await global.loadEmployeeHoursFromPointage(empId);
      }
      refreshPaystubPreview();
    });
    refreshPayrollSimulatorEmployeePick().then(() => {
      const ps = document.getElementById('pay-start')?.value;
      const pe = document.getElementById('pay-end')?.value;
      if (ps && !document.getElementById('psim-period-start')?.value) document.getElementById('psim-period-start').value = ps;
      if (pe && !document.getElementById('psim-period-end')?.value) document.getElementById('psim-period-end').value = pe;
      syncOtRateDefault();
      refreshPaystubPreview();
    }).catch(() => {
      syncOtRateDefault();
      refreshPaystubPreview();
    });
  }

  global.initPayrollSimulator = initPayrollSimulator;
  global.refreshPaystubPreview = refreshPaystubPreview;
  global.refreshPayrollSimulatorEmployeePick = refreshPayrollSimulatorEmployeePick;
  global.syncOtRateDefault = syncOtRateDefault;
})(typeof window !== 'undefined' ? window : global);
