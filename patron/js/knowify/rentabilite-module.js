/**
 * JobsitePro — Rentabilité avancée (revenus vs coûts)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  async function render(ctx) {
    const host = document.getElementById('rentabilite-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    const sites = await K().loadSites(ctx);
    if (!sites.length) {
      host.innerHTML = `<div class="fin-module fin-hero"><h2>${L ? 'Rentabilité' : 'Profitability'}</h2><p style="color:#64748b">${L ? 'Créez des chantiers d\'abord' : 'Create sites first'}</p></div>`;
      return;
    }

    const [factures, ptgAll, expsAll, emps] = await Promise.all([
      ctx.apiList('factures', `company="${c}"`, 'site', '-created', 500).catch(() => ({ items: [] })),
      ctx.apiList('time_entries', `company="${c}"`, 'employee,site', '-clock_in', 2000).catch(() => ({ items: [] })),
      ctx.apiList('expenses', `company="${c}"&&status="approved"`, 'site', '-expense_date', 1000).catch(() => ({ items: [] })),
      K().loadEmployees(ctx),
    ]);

    const rateByUser = {};
    emps.forEach(u => { rateByUser[u.id] = Number(u.hourly_rate) || 0; });

    const rows = sites.map(site => {
      const rev = (factures.items || []).filter(f => f.site === site.id && ['payee', 'partielle', 'envoyee'].includes(f.statut))
        .reduce((a, f) => a + (Number(f.montant_paye) || Number(f.montant_ttc) || 0), 0);
      let labor = 0;
      for (const p of (ptgAll.items || []).filter(x => x.site === site.id)) {
        const m = ctx.entryMinutes?.(p) || 0;
        labor += (m / 60) * (rateByUser[p.employee] || 0);
      }
      const expCost = (expsAll.items || []).filter(e => e.site === site.id).reduce((a, e) => a + (Number(e.amount) || 0), 0);
      const cost = labor + expCost;
      const margin = rev - cost;
      const pct = rev > 0 ? Math.round((margin / rev) * 100) : (cost > 0 ? -100 : 0);
      return { site, rev, cost, margin, pct };
    }).sort((a, b) => b.margin - a.margin);

    const totalRev = rows.reduce((a, r) => a + r.rev, 0);
    const totalCost = rows.reduce((a, r) => a + r.cost, 0);

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>${L ? 'Rentabilité par chantier' : 'Site profitability'}</h2><p>${L ? 'Revenus facturés vs coûts réels (MO + dépenses)' : 'Invoiced revenue vs actual costs'}</p></div>
      <div class="fin-kpi-row">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Revenus' : 'Revenue'}</div><div class="fin-kpi-val accent">${ctx.fmtMoney(totalRev)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Coûts' : 'Costs'}</div><div class="fin-kpi-val">${ctx.fmtMoney(totalCost)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Marge globale' : 'Overall margin'}</div><div class="fin-kpi-val" style="color:${totalRev - totalCost >= 0 ? '#34d399' : '#f87171'}">${ctx.fmtMoney(totalRev - totalCost)}</div></div>
      </div>
      <div class="dext-gallery"><table class="knowify-lines"><thead><tr>
        <th>${L ? 'Chantier' : 'Site'}</th><th>${L ? 'Revenus' : 'Revenue'}</th><th>${L ? 'Coûts' : 'Costs'}</th><th>${L ? 'Marge' : 'Margin'}</th><th>%</th>
      </tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td style="font-weight:600">${r.site.name}</td>
        <td style="color:#34d399">${ctx.fmtMoney(r.rev)}</td>
        <td>${ctx.fmtMoney(r.cost)}</td>
        <td style="font-weight:700;color:${r.margin >= 0 ? '#34d399' : '#f87171'}">${ctx.fmtMoney(r.margin)}</td>
        <td>${r.pct}%</td>
      </tr>`).join('')}
      </tbody></table></div>
      <p style="font-size:11px;color:var(--text3);margin-top:12px">${L ? 'Astuce : ouvrez Coûts chantier pour le détail budget. QuickBooks sync dans Paramètres.' : 'Tip: open Job costs for budget detail. QuickBooks sync in Settings.'}</p>
    </div>`;
  }

  global.ChantierTrackRentabilite = { render };
})(typeof window !== 'undefined' ? window : global);
