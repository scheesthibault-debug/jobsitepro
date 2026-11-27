/**
 * JobsitePro — Daily Logs (Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  async function aggregateDay(ctx, siteId, logDate) {
    const c = ctx.co();
    const dayStart = logDate + ' 00:00:00';
    const dayEnd = logDate + ' 23:59:59';
    const entries = [];
    const [ptg, exps, photos] = await Promise.all([
      ctx.apiList('time_entries', `company="${c}"&&site="${siteId}"&&clock_in>="${dayStart}"&&clock_in<="${dayEnd}"`, 'employee', '-clock_in', 100).catch(() => ({ items: [] })),
      ctx.apiList('expenses', `company="${c}"&&site="${siteId}"&&expense_date="${logDate}"`, 'employee', '-created', 50).catch(() => ({ items: [] })),
      ctx.apiList('photos', `company="${c}"&&site="${siteId}"&&created>="${dayStart}"&&created<="${dayEnd}"`, 'uploaded_by', '-created', 30).catch(() => ({ items: [] })),
    ]);
    for (const p of ptg.items || []) {
      const name = p.expand?.employee?.name || p.employee;
      const mins = ctx.entryMinutes?.(p) || p.duration_min || 0;
      entries.push({ type: 'time', description: `${name} — ${(mins / 60).toFixed(1)} h`, source_id: p.id });
    }
    for (const e of exps.items || []) {
      entries.push({ type: 'expense', description: `${e.vendor || e.description || 'Dépense'} — ${ctx.fmtMoney(e.amount)}`, source_id: e.id });
    }
    for (const ph of photos.items || []) {
      entries.push({ type: 'photo', description: ph.caption || ph.type || 'Photo', source_id: ph.id });
    }
    return entries;
  }

  async function render(ctx) {
    const host = document.getElementById('journal-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    const sites = await K().loadSites(ctx);
    const today = new Date().toISOString().slice(0, 10);
    let logs = [];
    try {
      const res = await ctx.apiList('daily_logs', `company="${c}"`, 'site,created_by', '-log_date', 60);
      logs = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, 'Daily Logs');
      return;
    }
    const siteOpts = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>Daily Logs</h2><p>${L ? 'Logs auto alimentés depuis pointages, dépenses et photos' : 'Auto-filled from time, expenses and photos'}</p></div>
      <div class="card" style="margin-bottom:14px"><div class="card-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
          <div class="form-group" style="margin:0"><label class="form-label">${L ? 'Chantier' : 'Site'}</label><select class="form-input" id="jl-site" style="min-width:180px">${siteOpts}</select></div>
          <div class="form-group" style="margin:0"><label class="form-label">${L ? 'Date' : 'Date'}</label><input class="form-input" id="jl-date" type="date" value="${today}"></div>
          <button class="btn btn-p" onclick="ChantierTrackJournal.generateToday()"><i class="ti ti-refresh"></i> ${L ? 'Générer / actualiser' : 'Generate / refresh'}</button>
        </div>
      </div></div>
      <div class="dext-gallery"><div class="dext-gallery-head"><span>${L ? 'Journaux récents' : 'Recent logs'}</span></div>
        ${logs.length ? logs.map(log => {
          const entries = log.entries || [];
          return `<div style="padding:12px 14px;border-bottom:0.5px solid var(--border)">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong>${log.expand?.site?.name || '–'}</strong>
              <span style="font-size:11px;color:var(--text3)">${ctx.fmtDate(log.log_date)} ${log.auto_genere ? '· auto' : ''}</span>
            </div>
            ${log.resume ? `<p style="font-size:12px;color:var(--text2);margin-bottom:6px">${log.resume}</p>` : ''}
            <div style="font-size:11px;color:var(--text3)">${entries.length} ${L ? 'entrées' : 'entries'}</div>
            <ul style="margin:6px 0 0;padding-left:18px;font-size:12px">${entries.slice(0, 5).map(e => `<li>${e.description || e.type}</li>`).join('')}${entries.length > 5 ? `<li>…</li>` : ''}</ul>
          </div>`;
        }).join('') : `<div style="padding:32px;text-align:center;color:#64748b">${L ? 'Générez le journal du jour pour un chantier' : 'Generate today\'s log for a site'}</div>`}
      </div>
    </div>`;
  }

  async function generateToday() {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const siteId = document.getElementById('jl-site')?.value;
    const logDate = document.getElementById('jl-date')?.value || new Date().toISOString().slice(0, 10);
    if (!siteId) { ctx.showToast(L ? 'Choisissez un chantier' : 'Select a site', false); return; }
    try {
      const entries = await aggregateDay(ctx, siteId, logDate);
      const existing = await ctx.apiList('daily_logs', `company="${ctx.co()}"&&site="${siteId}"&&log_date="${logDate}"`, '', '', 1);
      const body = {
        company: ctx.co(),
        site: siteId,
        log_date: logDate,
        entries,
        auto_genere: true,
        resume: `${entries.length} ${L ? 'activités' : 'activities'}`,
        created_by: ctx.uid(),
      };
      let id;
      if (existing.items?.[0]) {
        id = existing.items[0].id;
        await ctx.api('PATCH', `/api/collections/daily_logs/records/${id}`, body);
      } else {
        const created = await ctx.api('POST', '/api/collections/daily_logs/records', body);
        id = created.id;
      }
      await K().logActivity(ctx, { entityType: 'daily_log', entityId: id, activity: 'created', message: `${logDate} — ${entries.length} entrées` });
      ctx.showToast(L ? 'Journal généré' : 'Log generated');
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackJournal = { render, generateToday, aggregateDay };
})(typeof window !== 'undefined' ? window : global);
