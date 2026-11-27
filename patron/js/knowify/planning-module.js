/**
 * JobsitePro — Scheduling (Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  function weekDates(base) {
    const d = base ? new Date(base) : new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(mon);
      x.setDate(mon.getDate() + i);
      return x.toISOString().slice(0, 10);
    });
  }

  async function render(ctx) {
    const host = document.getElementById('planning-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    const dates = weekDates();
    const from = dates[0];
    const to = dates[6];
    let shifts = [];
    let emps = [];
    try {
      [shifts, emps] = await Promise.all([
        ctx.apiList('shifts', `company="${c}"&&shift_date>="${from}"&&shift_date<="${to}"`, 'employee,site', 'shift_date', 500).then(r => r.items || []).catch(() => []),
        K().loadEmployees(ctx),
      ]);
    } catch { /* */ }
    const dayLbl = ctx.lang === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const byEmpDate = {};
    for (const s of shifts) {
      const key = `${s.employee}_${s.shift_date}`;
      byEmpDate[key] = s;
    }
    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>Scheduling</h2><p>${L ? 'Vue semaine des shifts — complète l\'écran Horaires' : 'Weekly shift view — complements Schedules'}</p></div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-sm" onclick="nav('horaires')"><i class="ti ti-calendar"></i> ${L ? 'Gérer horaires' : 'Manage schedules'}</button>
        <button class="btn btn-p btn-sm" onclick="openModal('shift')"><i class="ti ti-plus"></i> ${L ? 'Ajouter shift' : 'Add shift'}</button>
      </div>
      <div style="overflow-x:auto"><table class="knowify-lines" style="min-width:700px"><thead><tr>
        <th>${L ? 'Employé' : 'Employee'}</th>
        ${dates.map((dt, i) => `<th style="font-size:10px">${dayLbl[i]}<br>${dt.slice(5)}</th>`).join('')}
      </tr></thead><tbody>
      ${emps.filter(e => e.role !== 'admin').length ? emps.filter(e => e.role !== 'admin').map(emp => `<tr>
        <td style="font-weight:600;font-size:12px;white-space:nowrap">${emp.name || emp.email}</td>
        ${dates.map(dt => {
          const s = byEmpDate[`${emp.id}_${dt}`];
          if (!s) return `<td style="color:var(--text3);font-size:11px">–</td>`;
          const site = s.expand?.site?.name || '';
          return `<td style="font-size:10px;background:var(--orange-bg);border-radius:4px;padding:4px">${s.start_time?.slice(0, 5) || ''}–${s.end_time?.slice(0, 5) || ''}<br><span style="color:var(--text3)">${site}</span></td>`;
        }).join('')}
      </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:#64748b">${L ? 'Aucun employé ou shift cette semaine' : 'No employees or shifts this week'}</td></tr>`}
      </tbody></table></div>
    </div>`;
  }

  global.ChantierTrackPlanning = { render };
})(typeof window !== 'undefined' ? window : global);
