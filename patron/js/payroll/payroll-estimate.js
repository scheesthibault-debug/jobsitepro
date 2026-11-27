/**
 * Estimation paie (non officielle) — brut depuis heures + retenues simplifiées.
 * Ne remplace pas Wagepoint ni un bulletin légal.
 */
(function (global) {
  'use strict';

  const CA = {
    cpp: { empRate: 0.0595, basicExemption: 3500, maxEarnings: 71300 },
    rrq: { empRate: 0.067, basicExemption: 3500, maxEarnings: 73200 },
    ei: { empRate: 0.0164, maxInsurable: 65700 },
    eiQC: { empRate: 0.0132, maxInsurable: 65700 },
    rqap: { empRate: 0.00494, maxInsurable: 94000 },
    provinces: {
      AB: 0.10, BC: 0.0506, MB: 0.108, NB: 0.094, NL: 0.087, NS: 0.0879, NT: 0.059, NU: 0.04,
      ON: 0.0505, PE: 0.0965, QC: 0.14, SK: 0.105, YT: 0.064,
    },
  };

  function estimateGross(regHours, otHours, hourlyRate, overtimeRate) {
    const hr = Number(hourlyRate) || 0;
    const otR = Number(overtimeRate) > 0 ? Number(overtimeRate) : hr * 1.5;
    const reg = Number(regHours) || 0;
    const ot = Number(otHours) || 0;
    return Math.round((reg * hr + ot * otR) * 100) / 100;
  }

  function estimateDeductions(grossPeriod, province) {
    const isQC = province === 'QC';
    const annual = Math.max(0, (Number(grossPeriod) || 0) * 26);
    const penR = isQC ? CA.rrq : CA.cpp;
    const penBase = Math.max(0, Math.min(annual - penR.basicExemption, penR.maxEarnings - penR.basicExemption));
    const penEmp = Math.round(penBase * penR.empRate * 100) / 100 / 26;
    const eiR = isQC ? CA.eiQC : CA.ei;
    const eiEmp = Math.round(Math.min(annual, eiR.maxInsurable) * eiR.empRate * 100) / 100 / 26;
    let rqapEmp = 0;
    if (isQC) {
      rqapEmp = Math.round(Math.min(annual, CA.rqap.maxInsurable) * CA.rqap.empRate * 100) / 100 / 26;
    }
    const provRate = CA.provinces[province] ?? CA.provinces.QC;
    const fedRateEff = isQC ? 0.15 * (1 - 0.165) : 0.15;
    const fed = Math.round(annual * fedRateEff * 100) / 100 / 26;
    const prov = Math.round(annual * provRate * 100) / 100 / 26;
    const totalDed = penEmp + eiEmp + rqapEmp + fed + prov;
    const net = Math.max(0, (Number(grossPeriod) || 0) - totalDed);
    return {
      gross: Number(grossPeriod) || 0,
      penEmp, eiEmp, rqapEmp, fed, prov,
      totalDed: Math.round(totalDed * 100) / 100,
      net: Math.round(net * 100) / 100,
      isQC,
      penLabel: isQC ? 'RRQ' : 'RPC',
    };
  }

  function estimateFromHours(regHours, otHours, hourlyRate, overtimeRate, province) {
    const gross = estimateGross(regHours, otHours, hourlyRate, overtimeRate);
    return { gross, ...estimateDeductions(gross, province || 'QC') };
  }

  /** Période bihebdomadaire (14 jours) se terminant à endDate ou aujourd'hui. */
  function biweeklyPeriod(endDateStr) {
    const endD = endDateStr ? new Date(endDateStr + 'T12:00:00') : new Date();
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - 13);
    return {
      start: startD.toISOString().slice(0, 10),
      end: endD.toISOString().slice(0, 10),
    };
  }

  global.ChantierTrackPayrollEstimate = {
    estimateGross,
    estimateDeductions,
    estimateFromHours,
    biweeklyPeriod,
  };
})(typeof window !== 'undefined' ? window : global);
