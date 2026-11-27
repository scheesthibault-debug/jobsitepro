/**
 * ChantierTrack — Moteur de paie (pur JS, sans UI)
 * Entrées : employé + heures → PaystubResult
 * Branché sur PocketBase via patron/index.html (pay_stubs, time_entries)
 */
(function (global) {
  'use strict';

  const CFG = global.ChantierTrackPayrollConfig;
  if (!CFG) throw new Error('ChantierTrackPayrollConfig manquant — chargez provinces.js avant payroll-engine.js');

  const OT_WEEKLY_MINS = 40 * 60;
  const PAY_PERIODS_PER_YEAR = 26;

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function isoWeekKey(isoDateTime) {
    const d = new Date(isoDateTime);
    if (isNaN(d.getTime())) return 'unknown';
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const w = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
  }

  function durMins(clockIn, clockOut) {
    if (!clockIn || !clockOut) return 0;
    const a = new Date(clockIn).getTime();
    const b = new Date(clockOut).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 60000);
  }

  /** Minutes travaillées (pointage fermé, duration_min manuel, ou durée calculée). */
  function entryMinutesForPayroll(p) {
    let m = Number(p?.duration_min) || 0;
    if (!p?.clock_in) return 0;
    if (p.clock_out) {
      const fromClock = durMins(p.clock_in, p.clock_out);
      if (m <= 0 || m > 24 * 60) m = fromClock;
    } else if (m <= 0) {
      return 0;
    }
    if (m > 24 * 60) m = 24 * 60;
    return Math.max(0, m);
  }

  /**
   * Heures rég. / sup. — 40 h max par semaine ISO (convention Canada)
   */
  function computeEmployeeHoursWeeklyOT(timeEntries, periodStart, periodEnd) {
    const endBound = `${periodEnd} 23:59:59`;
    const byEmpWeek = {};
    for (const p of timeEntries || []) {
      if (!p.clock_in) continue;
      if (p.clock_in < periodStart || p.clock_in > endBound) continue;
      const mins = entryMinutesForPayroll(p);
      if (mins <= 0) continue;
      const wk = isoWeekKey(p.clock_in);
      const key = `${p.employee}|${wk}`;
      if (!byEmpWeek[key]) byEmpWeek[key] = { employee: p.employee, mins: 0 };
      byEmpWeek[key].mins += mins;
    }
    const empHours = {};
    for (const row of Object.values(byEmpWeek)) {
      if (!empHours[row.employee]) empHours[row.employee] = { reg: 0, ot: 0 };
      const reg = Math.min(row.mins, OT_WEEKLY_MINS);
      empHours[row.employee].reg += reg;
      empHours[row.employee].ot += Math.max(0, row.mins - OT_WEEKLY_MINS);
    }
    return empHours;
  }

  /**
   * @param {number} grossAnnual
   * @param {string} provinceCode
   */
  function calcAnnualDeductions(grossAnnual, provinceCode) {
    const rule = CFG.getProvinceRule(provinceCode);
    const isQC = provinceCode === 'QC' || rule.usesRRQ;
    const provRate = rule.provRate ?? CFG.GENERIC.provRate;
    const penR = isQC ? CFG.FEDERAL.rrq : CFG.FEDERAL.cpp;
    const penBase = Math.max(0, Math.min(grossAnnual - penR.basicExemption, penR.maxEarnings - penR.basicExemption));
    const penEmp = round2(penBase * penR.empRate);
    const penEr = round2(penBase * penR.erRate);
    const eiR = isQC ? CFG.FEDERAL.eiQC : CFG.FEDERAL.ei;
    const eiBase = Math.min(grossAnnual, eiR.maxInsurable);
    const eiEmp = round2(eiBase * eiR.empRate);
    const eiEr = round2(eiEmp * eiR.erFactor);
    let rqapEmp = 0;
    let rqapEr = 0;
    if (isQC || rule.usesRQAP) {
      const rb = Math.min(grossAnnual, CFG.FEDERAL.rqap.maxInsurable);
      rqapEmp = round2(rb * CFG.FEDERAL.rqap.empRate);
      rqapEr = round2(rb * CFG.FEDERAL.rqap.erRate);
    }
    const fedRateEff = isQC
      ? CFG.FEDERAL.fedRateDefault * (1 - CFG.FEDERAL.fedQcAbatement)
      : CFG.FEDERAL.fedRateDefault;
    const fedTaxEst = round2(grossAnnual * fedRateEff);
    const provTaxEst = round2(grossAnnual * provRate);
    return {
      penEmp,
      penEr,
      eiEmp,
      eiEr,
      rqapEmp,
      rqapEr,
      fedTaxEst,
      provTaxEst,
      totalEmpDed: round2(penEmp + eiEmp + rqapEmp + fedTaxEst + provTaxEst),
      totalErCost: round2(penEr + eiEr + rqapEr),
      penLabel: isQC ? 'RRQ' : 'RPC',
      eiLabel: isQC ? 'AE (QC)' : 'AE',
      isQC,
      province: provinceCode,
      provinceRule: rule,
    };
  }

  function calcPeriodDeductionsFromGross(grossPeriod, provinceCode, hourlyRate) {
    const grossAnnual = Math.max(0, (grossPeriod || 0) * PAY_PERIODS_PER_YEAR);
    if (grossAnnual <= 0) {
      const isQC = provinceCode === 'QC' || CFG.getProvinceRule(provinceCode).usesRRQ;
      return {
        pen: 0, ei: 0, rqap: 0, fed: 0, prov: 0,
        penLabel: isQC ? 'RRQ' : 'RPC',
        isQC,
        annual: 0,
      };
    }
    const annual = grossAnnual;
    const ded = calcAnnualDeductions(annual, provinceCode);
    const P = PAY_PERIODS_PER_YEAR;
    return {
      pen: round2(ded.penEmp / P),
      ei: round2(ded.eiEmp / P),
      rqap: round2(ded.rqapEmp / P),
      fed: round2(ded.fedTaxEst / P),
      prov: round2(ded.provTaxEst / P),
      penLabel: ded.penLabel,
      isQC: ded.isQC,
      annual,
    };
  }

  /**
   * Salaire brut période
   * @param {{ regularHours: number, overtimeHours: number, hourlyRate: number, overtimeRate?: number, mileagePay?: number }} work
   */
  function computeGrossPay(work) {
    const hr = Number(work.hourlyRate) || 0;
    const otRate = Number(work.overtimeRate) || hr * 1.5;
    const regH = Number(work.regularHours) || 0;
    const otH = Number(work.overtimeHours) || 0;
    const wages = regH * hr + otH * otRate;
    const mileage = Number(work.mileagePay) || 0;
    return round2(wages + mileage);
  }

  /**
   * @param {object} employee — employerName, employeeName, employeeId, province, payPeriodStart, payPeriodEnd, payDate, hrNotes
   * @param {object} work — regularHours, overtimeHours, hourlyRate, overtimeRate?, mileagePay?
   * @returns {object} PaystubResult
   */
  function computePaystub(employee, work) {
    const province = employee.province || 'QC';
    const grossPay = computeGrossPay(work);
    const d = calcPeriodDeductionsFromGross(grossPay, province, work.hourlyRate);
    const deductions = [
      { name: d.penLabel, amount: d.pen, type: 'other' },
      { name: d.isQC ? 'AE (QC)' : 'AE', amount: d.ei, type: 'other' },
    ];
    if (d.isQC) deductions.push({ name: 'RQAP', amount: d.rqap, type: 'other' });
    deductions.push(
      { name: 'Impôt fédéral (est.)', amount: d.fed, type: 'federal' },
      { name: d.isQC ? 'Impôt provincial QC (est.)' : 'Impôt provincial (est.)', amount: d.prov, type: 'provincial' }
    );
    const totalDeductions = round2(deductions.reduce((a, x) => a + x.amount, 0));
    const netPay = round2(Math.max(0, grossPay - totalDeductions));
    return {
      employee,
      work: { ...work, grossBreakdown: { regularHours: work.regularHours, overtimeHours: work.overtimeHours } },
      grossPay,
      deductions,
      totalDeductions,
      netPay,
      mileagePay: round2(work.mileagePay || 0),
      meta: {
        isEstimate: true,
        provinceRule: CFG.getProvinceRule(province),
        periodsPerYear: PAY_PERIODS_PER_YEAR,
      },
    };
  }

  /** Compat pay_stubs PocketBase */
  function payStubPeriodDeductions(stub, rates, province) {
    const gross = stub.gross_pay || 0;
    const r = (rates || []).find(x => x.employee === stub.employee);
    const d = calcPeriodDeductionsFromGross(gross, province, r?.hourly_rate);
    const annual = d.annual || gross * PAY_PERIODS_PER_YEAR;
    const ded = calcAnnualDeductions(annual, province);
    const P = PAY_PERIODS_PER_YEAR;
    return {
      pen: d.pen,
      ei: d.ei,
      rqap: d.rqap,
      fed: d.fed,
      prov: d.prov,
      penLabel: d.penLabel,
      isQC: d.isQC,
      penEr: round2(ded.penEr / P),
      eiEr: round2(ded.eiEr / P),
      rqapEr: round2((ded.rqapEr || 0) / P),
    };
  }

  const api = {
    CA_PAY: CFG.CA_PAY,
    PAY_PERIODS_PER_YEAR,
    isoWeekKey,
    durMins,
    computeEmployeeHoursWeeklyOT,
    calcCADeductions: calcAnnualDeductions,
    calcAnnualDeductions,
    calcPeriodDeductionsFromGross,
    computeGrossPay,
    computePaystub,
    payStubPeriodDeductions,
    getProvinceRule: CFG.getProvinceRule,
  };

  global.ChantierTrackPayroll = api;
  global.CA_PAY = CFG.CA_PAY;
})(typeof window !== 'undefined' ? window : global);
