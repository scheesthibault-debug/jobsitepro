/**
 * Agrégation heures 40h/semaine — même logique que patron.
 */
(function (global) {
  'use strict';
  const OT_WEEKLY_MINS = 40 * 60;
  function durMins(a, b) {
    try { return Math.round((new Date(b) - new Date(a)) / 60000); } catch { return 0; }
  }
  function entryMinutes(p) {
    let m = Number(p?.duration_min) || 0;
    if (p?.clock_in) {
      const end = p.clock_out || new Date().toISOString();
      const fromClock = durMins(p.clock_in, end);
      if (!p.clock_out) m = fromClock;
      else if (m <= 0 || m > 24 * 60) m = fromClock;
    }
    if (m > 24 * 60) m = 24 * 60;
    return Math.max(0, m);
  }
  function isoWeekKey(iso) {
    const d = new Date(iso);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  function employeeIdFromEntry(p) {
    if (!p) return '';
    if (typeof p.employee === 'string') return p.employee;
    if (p.expand?.employee?.id) return p.expand.employee.id;
    if (p.employee?.id) return p.employee.id;
    return '';
  }
  function normalizePeriodDate(val) {
    if (!val) return '';
    const s = String(val).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  function computeEmployeeHoursWeeklyOT(timeEntries, periodStart, periodEnd) {
    const pStart = normalizePeriodDate(periodStart);
    const pEnd = normalizePeriodDate(periodEnd);
    if (!pStart || !pEnd) return {};
    const endBound = `${pEnd} 23:59:59`;
    const byEmpWeek = {};
    for (const p of timeEntries || []) {
      if (!p.clock_in || p.clock_in < pStart || p.clock_in > endBound) continue;
      const empId = employeeIdFromEntry(p);
      if (!empId) continue;
      const mins = entryMinutes(p);
      if (mins <= 0) continue;
      const key = `${empId}|${isoWeekKey(p.clock_in)}`;
      if (!byEmpWeek[key]) byEmpWeek[key] = { employee: empId, mins: 0 };
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
  global.ChantierTrackPayrollHours = {
    computeEmployeeHoursWeeklyOT,
    minsToHours: m => Math.round((m / 60) * 100) / 100,
  };
})(typeof window !== 'undefined' ? window : global);
