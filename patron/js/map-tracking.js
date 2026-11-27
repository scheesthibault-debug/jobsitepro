/**
 * JobsitePro patron — Historique GPS du jour (Carte live) + parcours hors chantier
 */
(function (global) {
  'use strict';

  const Trk = global.ChantierTrackTracking;
  let trailLayer = null;

  function todayKey() {
    return Trk?.todayKey?.() || new Date().toISOString().slice(0, 10);
  }

  function trailPointsForEmployee(events, empId) {
    return (events || [])
      .filter(e => e.employee === empId && (e.status === 'offsite' || e.status === 'afterhours'))
      .filter(e => e.latitude != null && e.longitude != null)
      .slice()
      .sort((a, b) => new Date(a.created) - new Date(b.created));
  }

  async function cleanupOldTrackingEvents(api, apiList, companyId) {
    if (!api || !apiList || !companyId) return;
    const today = todayKey();
    try {
      const res = await apiList(
        'tracking_events',
        `company="${companyId}"&&day<"${today}"`,
        '',
        '-created',
        300,
      );
      for (const r of res.items || []) {
        try {
          await api('DELETE', `/api/collections/tracking_events/records/${r.id}`);
        } catch { /* ignore */ }
      }
    } catch { /* collection absente */ }
  }

  async function loadTodayTrackingEvents(apiList, companyId) {
    if (!apiList || !companyId) return [];
    const today = todayKey();
    try {
      const res = await apiList(
        'tracking_events',
        `company="${companyId}"&&day="${today}"`,
        'employee,site',
        '-created',
        500,
      );
      return res.items || [];
    } catch {
      return [];
    }
  }

  function renderHistoryHtml(events, nameMap, lang, liveAlerts) {
    const L = lang === 'en';
    const alerts = (events || []).filter(e => e.status === 'offsite' || e.status === 'afterhours');
    const live = liveAlerts || [];
    if (!alerts.length && !live.length) {
      return `<div class="map-history-empty">${L ? 'No off-site or after-hours alerts today.' : 'Aucune alerte hors chantier ou après heures aujourd’hui.'}</div>`;
    }
    const trailCount = (empId) => trailPointsForEmployee(events, empId).length;
    const liveHtml = live.map(e => {
      const color = Trk?.statusColor(e.status) || 'var(--orange)';
      const label = Trk?.statusLabel(e.status, lang) || e.status;
      const tag = L ? ' · live' : ' · en direct';
      const n = trailCount(e.employee);
      const trailHint = n >= 2
        ? (L ? ` · ${n} trail points` : ` · ${n} pts parcours`)
        : (L ? ' · trail on map when GPS active' : ' · parcours sur la carte si GPS actif');
      return `<div class="map-history-item" onclick="focusMapTrackingEvent('${e.employee}', ${e.latitude}, ${e.longitude})">
        <span class="map-history-dot" style="background:${color}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${e.empName || '–'}${tag}</div>
          <div style="font-size:10px;color:${color}">${label}</div>
          <div style="font-size:10px;color:var(--text3)">${e.sub || ''}${trailHint}</div>
        </div>
      </div>`;
    }).join('');
    const sorted = alerts.slice().sort((a, b) => new Date(b.created) - new Date(a.created));
    return liveHtml + sorted.map(e => {
      const empName = e.expand?.employee?.name || e.expand?.employee?.email || nameMap[e.employee] || '–';
      const siteName = e.expand?.site?.name || '–';
      const color = Trk?.statusColor(e.status) || 'var(--text2)';
      const label = Trk?.statusLabel(e.status, lang) || e.status;
      let timeStr = '–';
      try {
        timeStr = new Date(e.created).toLocaleTimeString(L === 'en' ? 'en-CA' : 'fr-CA', { hour: '2-digit', minute: '2-digit' });
      } catch { /* ignore */ }
      const n = trailCount(e.employee);
      const trailHint = n >= 2 ? (L ? ` · ${n} pts` : ` · ${n} pts`) : '';
      return `<div class="map-history-item" onclick="focusMapTrackingEvent('${e.employee}', ${e.latitude}, ${e.longitude})">
        <span class="map-history-dot" style="background:${color}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${empName}</div>
          <div style="font-size:10px;color:${color}">${label}</div>
          <div style="font-size:10px;color:var(--text3)">${siteName} · ${timeStr}${trailHint}</div>
        </div>
      </div>`;
    }).join('');
  }

  function drawTrails(mapObj, events, nameMap) {
    if (!mapObj || typeof L === 'undefined') return;
    if (trailLayer) {
      try { mapObj.removeLayer(trailLayer); } catch { /* ignore */ }
      trailLayer = null;
    }
    trailLayer = L.layerGroup().addTo(mapObj);
    const byEmp = {};
    for (const e of events || []) {
      if (e.latitude == null || e.longitude == null) continue;
      if (e.status !== 'offsite' && e.status !== 'afterhours') continue;
      if (!byEmp[e.employee]) byEmp[e.employee] = [];
      byEmp[e.employee].push(e);
    }
    const Lg = langFromPage();
    Object.keys(byEmp).forEach(empId => {
      const sorted = byEmp[empId].slice().sort((a, b) => new Date(a.created) - new Date(b.created));
      const pts = sorted.map(e => [e.latitude, e.longitude]);
      const name = nameMap[empId] || empId;
      const hasAfter = sorted.some(x => x.status === 'afterhours');
      const hasOff = sorted.some(x => x.status === 'offsite');
      const color = hasAfter && !hasOff ? '#E24B4A' : '#EA8C2A';
      const popupLabel = Lg === 'en'
        ? `${name} — off-site route`
        : `${name} — parcours hors chantier`;

      if (pts.length >= 2) {
        L.polyline(pts, { color, weight: 4, opacity: 0.85, dashArray: '8,6' })
          .addTo(trailLayer)
          .bindPopup(popupLabel);
      }
      sorted.forEach((ev, i) => {
        const c = ev.status === 'afterhours' ? '#E24B4A' : '#EA8C2A';
        const r = i === 0 ? 6 : i === sorted.length - 1 ? 7 : 4;
        L.circleMarker(pts[i], { radius: r, color: c, fillColor: c, fillOpacity: 0.9, weight: 2 })
          .addTo(trailLayer)
          .bindPopup(`${popupLabel}<br><small>${formatTrailTime(ev.created, Lg)}</small>`);
      });
    });
  }

  function formatTrailTime(iso, L) {
    try {
      return new Date(iso).toLocaleTimeString(L === 'en' ? 'en-CA' : 'fr-CA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '–';
    }
  }

  function langFromPage() {
    try {
      return (global.lang || localStorage.getItem('ct_lang') || 'fr');
    } catch {
      return 'fr';
    }
  }

  function focusEmployeeTrail(mapObj, events, empId) {
    const pts = trailPointsForEmployee(events, empId).map(e => [e.latitude, e.longitude]);
    if (!mapObj || !pts.length) return;
    if (pts.length === 1) {
      mapObj.setView(pts[0], 16);
      return;
    }
    try {
      mapObj.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16 });
    } catch { /* ignore */ }
  }

  function clearTrails(mapObj) {
    if (trailLayer && mapObj) {
      try { mapObj.removeLayer(trailLayer); } catch { /* ignore */ }
      trailLayer = null;
    }
  }

  global.ChantierTrackMapTracking = {
    cleanupOldTrackingEvents,
    loadTodayTrackingEvents,
    renderHistoryHtml,
    drawTrails,
    clearTrails,
    focusEmployeeTrail,
    trailPointsForEmployee,
    todayKey,
  };
})(typeof window !== 'undefined' ? window : global);
