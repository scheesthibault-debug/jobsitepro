/**
 * JobsitePro — Coûts par chantier (dashboard)
 */
(function (global) {
  'use strict';

  async function renderJobCostSite(ctx) {
    const {
      apiList, api, co, lang, fmtMoney, fmtDate, t, emptyStateHtml,
      entryMinutes, distanceMeters,
    } = ctx;
    const host = document.getElementById('jc-dashboard');
    const sel = document.getElementById('jc-site-select');
    if (!host) return;

    const c = co();
    const sites = await apiList('sites', `company="${c}"`, '', 'name', 100).catch(() => ({ items: [] }));
    const items = sites.items || [];
    if (sel && !sel.dataset.filled) {
      sel.innerHTML = `<option value="">${lang === 'fr' ? 'Choisir un chantier' : 'Select site'}</option>`
        + items.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      sel.dataset.filled = '1';
    }
    const siteId = sel?.value || localStorage.getItem('jc_site_id') || items[0]?.id;
    if (siteId && sel) sel.value = siteId;
    if (!siteId) {
      host.innerHTML = emptyStateHtml('chart-pie', 'no_sites', 'no_sites_sub');
      return;
    }
    localStorage.setItem('jc_site_id', siteId);
    let site = items.find(s => s.id === siteId);
    try {
      site = await api('GET', `/api/collections/sites/records/${siteId}?expand=soumission`);
    } catch {
      site = site || null;
    }

    const [ptg, exps, miles, emps] = await Promise.all([
      apiList('time_entries', `company="${c}"&&site="${siteId}"`, 'employee', '-clock_in', 500).catch(() => ({ items: [] })),
      apiList('expenses', `company="${c}"&&site="${siteId}"&&status="approved"`, '', '-expense_date', 300).catch(() => ({ items: [] })),
      apiList('mileage_entries', `company="${c}"&&site="${siteId}"`, 'employee', '-created', 200).catch(() => ({ items: [] })),
      apiList('users', `company="${c}"`, '', '', 200).catch(() => ({ items: [] })),
    ]);

    const rateByUser = {};
    (emps.items || []).forEach(u => { rateByUser[u.id] = Number(u.hourly_rate) || 0; });

    let labor = 0;
    let hours = 0;
    for (const p of ptg.items || []) {
      const m = entryMinutes(p);
      hours += m / 60;
      const rate = rateByUser[p.employee] || 0;
      labor += (m / 60) * rate;
    }

    let mileageCost = 0;
    let comp = null;
    try { comp = await api('GET', `/api/collections/companies/records/${c}`); } catch { /* ignore */ }
    const kmRate = Number(comp?.mileage_rate) || 0.7;
    for (const m of miles.items || []) {
      mileageCost += (Number(m.km) || Number(m.distance_km) || 0) * kmRate;
    }

    const expensesCost = (exps.items || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const total = labor + mileageCost + expensesCost;
    let budget = Number(site?.budget) || 0;
    if (!budget) {
      budget = (Number(site?.budget_labor) || 0) + (Number(site?.budget_materials) || 0) + (Number(site?.budget_expenses) || 0);
    }
    const sou = site?.expand?.soumission;
    if (!budget && sou?.montant_ttc) budget = Number(sou.montant_ttc);
    const budgetSource = sou?.montant_ttc && budget === Number(sou.montant_ttc)
      ? (lang === 'fr' ? ' (soumission acceptée)' : ' (from quote)')
      : '';
    const pct = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0;
    const barColor = pct >= 100 ? '#f87171' : pct >= 80 ? '#f59e0b' : '#34d399';

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero jc-hero">
        <div>
          <h2>${site?.name || '–'}</h2>
          <p>${site?.address || (lang === 'fr' ? 'Coûts réels vs budget' : 'Actual vs budget')}${budgetSource}</p>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div>
            <div style="font-size:11px;color:#64748b">${lang === 'fr' ? 'Coût total' : 'Total cost'}</div>
            <div style="font-size:22px;font-weight:700;color:#f59e0b">${fmtMoney(total)}</div>
          </div>
          <button type="button" class="btn btn-sm btn-p" onclick="ChantierTrackJobCostPdf.exportCurrent()"><i class="ti ti-file-pdf"></i> PDF</button>
        </div>
      </div>
      <div class="dext-gallery" style="margin-bottom:14px">
        <div class="dext-gallery-head"><span>${lang === 'fr' ? 'Budget vs réel' : 'Budget vs actual'}</span><strong style="color:#f1f5f9">${budget > 0 ? `${pct}%` : '–'}</strong></div>
        <div style="padding:14px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:#94a3b8">
            <span>${lang === 'fr' ? 'Budget prévu' : 'Budget'}</span><strong style="color:#f1f5f9">${budget > 0 ? fmtMoney(budget) : '–'}</strong>
          </div>
          <div class="jc-budget-bar"><div class="jc-budget-fill" style="width:${budget > 0 ? pct : 0}%;background:${barColor}"></div></div>
          ${pct >= 80 && budget > 0 ? `<div style="margin-top:10px;padding:8px 10px;background:rgba(248,113,113,.12);border:1px solid #f87171;border-radius:8px;font-size:11px;color:#f87171">⚠ ${lang === 'fr' ? 'Alerte : plus de 80 % du budget utilisé' : 'Alert: over 80% of budget used'}</div>` : ''}
        </div>
      </div>
      <div class="jc-cats">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${lang === 'fr' ? 'Main-d\'œuvre' : 'Labor'}</div><div class="fin-kpi-val">${fmtMoney(labor)}</div><div style="font-size:10px;color:#64748b;margin-top:4px">${hours.toFixed(1)} h</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${lang === 'fr' ? 'Dépenses' : 'Expenses'}</div><div class="fin-kpi-val accent">${fmtMoney(expensesCost)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${lang === 'fr' ? 'Kilométrage' : 'Mileage'}</div><div class="fin-kpi-val">${fmtMoney(mileageCost)}</div><div style="font-size:10px;color:#64748b;margin-top:4px">${kmRate.toFixed(2)} $/km</div></div>
      </div>
      <div class="dext-gallery"><div class="dext-gallery-head"><span>${lang === 'fr' ? 'Évolution des coûts' : 'Cost trend'}</span></div>
        <div style="padding:12px"><canvas id="jc-cost-chart" height="120"></canvas></div>
      </div>
    </div>`;

    global.__jcLastTotals = { budget, total, labor, expensesCost, mileageCost, hours, pct };

    const canvas = document.getElementById('jc-cost-chart');
    if (canvas && global.Chart) {
      const byWeek = {};
      for (const p of ptg.items || []) {
        const d = (p.clock_in || '').slice(0, 10);
        if (!d) continue;
        const wk = d.slice(0, 7);
        if (!byWeek[wk]) byWeek[wk] = 0;
        byWeek[wk] += ((entryMinutes(p) / 60) * (rateByUser[p.employee] || 0));
      }
      for (const e of exps.items || []) {
        const d = (e.expense_date || e.created || '').slice(0, 10);
        const wk = d.slice(0, 7);
        if (!byWeek[wk]) byWeek[wk] = 0;
        byWeek[wk] += Number(e.amount) || 0;
      }
      const labels = Object.keys(byWeek).sort();
      const data = labels.map(k => Math.round(byWeek[k] * 100) / 100);
      if (global._jcChart) { global._jcChart.destroy(); global._jcChart = null; }
      global._jcChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [{ label: lang === 'fr' ? 'Coût ($)' : 'Cost ($)', data, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      });
    }
  }

  global.ChantierTrackJobCosting = { renderJobCostSite };
})(typeof window !== 'undefined' ? window : global);
