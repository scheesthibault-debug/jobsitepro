/**
 * JobsitePro — Timeline journalière (vert / orange / rouge) pour la page Horaires
 */
(function (global) {
  'use strict';

  const DEFAULT_WORK = { start: '07:00', end: '16:30' };
  const TIMELINE_START = 6;
  const TIMELINE_END = 19;

  function parseHm(hm) {
    const p = String(hm || '07:00').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!p) return { h: 7, m: 0 };
    return { h: Math.min(23, parseInt(p[1], 10)), m: Math.min(59, parseInt(p[2], 10)) };
  }

  function msOnDay(dateStr, hm) {
    const { h, m } = parseHm(hm);
    const d = new Date(`${dateStr}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  function clampSeg(seg, dayStartMs, dayEndMs) {
    const s = Math.max(seg.start, dayStartMs);
    const e = Math.min(seg.end, dayEndMs);
    if (e <= s) return null;
    return { start: s, end: e, type: seg.type };
  }

  function distanceMeters(lat1, lng1, lat2, lng2) {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
    const R = 6371000;
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function isOnSite(lat, lng, site) {
    if (!site?.latitude || !site?.longitude || lat == null || lng == null) return null;
    const dist = distanceMeters(lat, lng, site.latitude, site.longitude);
    const radius = site.gps_radius || 200;
    return dist !== null && dist <= radius;
  }

  function entrySiteOnSite(entry, site) {
    if (!site) return null;
    const lat = entry.last_lat ?? entry.lat_in;
    const lng = entry.last_lng ?? entry.lng_in;
    if (lat == null || lng == null) return entry.gps_valid === false ? null : true;
    return isOnSite(lat, lng, site);
  }

  function entryEndMs(entry) {
    if (entry.clock_out) return new Date(entry.clock_out).getTime();
    return Date.now();
  }

  /** Segments pour une entrée sur une journée */
  function segmentsForEntry(entry, site, dateStr, workStart, workEnd) {
    if (!entry?.clock_in) return [];
    const dayStart = msOnDay(dateStr, '00:00');
    const dayEnd = msOnDay(dateStr, '23:59') + 59999;
    const ws = msOnDay(dateStr, workStart);
    const we = msOnDay(dateStr, workEnd);

    const cin = new Date(entry.clock_in).getTime();
    const cout = entryEndMs(entry);
    let start = Math.max(cin, dayStart);
    let end = Math.min(cout, dayEnd);
    if (start >= end) return [];

    const onSite = entrySiteOnSite(entry, site);
    const onSiteFlag = onSite === null ? true : onSite;
    const out = [];

    const push = (a, b, type) => {
      const seg = clampSeg({ start: a, end: b, type }, dayStart, dayEnd);
      if (seg) out.push(seg);
    };

    if (start < ws) {
      push(start, Math.min(end, ws), onSiteFlag ? 'onsite' : 'offsite');
      start = Math.max(start, ws);
    }
    if (start < end && start < we) {
      const workEnd = Math.min(end, we);
      if (start < workEnd) {
        push(start, workEnd, onSiteFlag ? 'onsite' : 'offsite');
        start = workEnd;
      }
    }
    if (start < end && end > we) {
      push(Math.max(start, we), end, 'afterhours');
    }
    return out;
  }

  function mergeSegments(segments) {
    if (!segments.length) return [];
    const sorted = segments.slice().sort((a, b) => a.start - b.start);
    const out = [];
    for (const seg of sorted) {
      const last = out[out.length - 1];
      if (last && last.type === seg.type && seg.start <= last.end + 60000) {
        last.end = Math.max(last.end, seg.end);
      } else {
        out.push({ ...seg });
      }
    }
    return out;
  }

  function buildDayTimeline(entries, sitesById, dateStr, workHours) {
    const workStart = workHours?.start || DEFAULT_WORK.start;
    const workEnd = workHours?.end || DEFAULT_WORK.end;
    const dayEntries = (entries || []).filter(e => String(e.clock_in || '').slice(0, 10) === dateStr);
    let segments = [];
    for (const entry of dayEntries) {
      const site = entry.expand?.site || sitesById[entry.site] || null;
      segments = segments.concat(segmentsForEntry(entry, site, dateStr, workStart, workEnd));
    }
    return {
      segments: mergeSegments(segments),
      workStart,
      workEnd,
      totalMins: dayEntries.reduce((s, e) => {
        const fn = global.entryMinutes;
        return s + (typeof fn === 'function' ? fn(e) : 0);
      }, 0),
    };
  }

  function pctOnTimeline(ms, dateStr) {
    const t0 = msOnDay(dateStr, `${String(TIMELINE_START).padStart(2, '0')}:00`);
    const t1 = msOnDay(dateStr, `${String(TIMELINE_END).padStart(2, '0')}:00`);
    const span = t1 - t0;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(100, ((ms - t0) / span) * 100));
  }

  function renderTimelineHtml(timeline, dateStr, lang) {
    const L = lang === 'en';
    const { segments, workStart, workEnd, totalMins } = timeline;
    const t0 = msOnDay(dateStr, `${String(TIMELINE_START).padStart(2, '0')}:00`);
    const t1 = msOnDay(dateStr, `${String(TIMELINE_END).padStart(2, '0')}:00`);

    const segHtml = segments.map(seg => {
      const left = pctOnTimeline(seg.start, dateStr);
      const right = pctOnTimeline(seg.end, dateStr);
      const w = Math.max(0.4, right - left);
      const cls = seg.type === 'onsite' ? 'hr-seg-onsite'
        : seg.type === 'offsite' ? 'hr-seg-offsite' : 'hr-seg-after';
      const title = `${new Date(seg.start).toLocaleTimeString(L ? 'en-CA' : 'fr-CA', { hour: '2-digit', minute: '2-digit' })} – ${new Date(seg.end).toLocaleTimeString(L ? 'en-CA' : 'fr-CA', { hour: '2-digit', minute: '2-digit' })}`;
      return `<div class="hr-timeline-seg ${cls}" style="left:${left}%;width:${w}%" title="${title}"></div>`;
    }).join('');

    const wsPct = pctOnTimeline(msOnDay(dateStr, workStart), dateStr);
    const wePct = pctOnTimeline(msOnDay(dateStr, workEnd), dateStr);

    const hoursLabel = totalMins > 0
      ? `${Math.floor(totalMins / 60)}h${String(totalMins % 60).padStart(2, '0')}`
      : '0h00';

    return `<div class="hr-timeline-wrap">
      <div class="hr-timeline-meta">
        <span>${L ? 'Day total (clocked)' : 'Total journée (pointé)'}: <strong>${hoursLabel}</strong></span>
        <span class="hr-timeline-meta-sub">${L ? 'Work window' : 'Plage patron'}: ${workStart} – ${workEnd}</span>
      </div>
      <div class="hr-timeline-axis">
        <span>${TIMELINE_START}h</span>
        <span style="left:${wsPct}%">${workStart}</span>
        <span style="left:${wePct}%">${workEnd}</span>
        <span>${TIMELINE_END}h</span>
      </div>
      <div class="hr-timeline-track">
        <div class="hr-timeline-workband" style="left:${wsPct}%;width:${Math.max(0, wePct - wsPct)}%"></div>
        ${segHtml}
        <div class="hr-timeline-now" style="left:${pctOnTimeline(Date.now(), dateStr)}%;display:${dateStr === new Date().toISOString().slice(0, 10) ? 'block' : 'none'}"></div>
      </div>
      <div class="hr-timeline-legend">
        <span><i class="hr-leg hr-seg-onsite"></i> ${L ? 'On job site (work hours)' : 'Sur chantier (heures de travail)'}</span>
        <span><i class="hr-leg hr-seg-offsite"></i> ${L ? 'Clocked in, off site' : 'Pointé, hors chantier'}</span>
        <span><i class="hr-leg hr-seg-after"></i> ${L ? 'After work hours (app still on)' : 'Après heures de travail (app encore active)'}</span>
      </div>
      <p class="hr-timeline-note">${L
        ? 'Based on clock-in/out and last GPS position. For exact minute-by-minute history, keep the employee app open on site.'
        : 'Basé sur les pointages et la dernière position GPS. Pour un historique minute par minute, l’app employé doit rester ouverte sur le chantier.'}</p>
    </div>`;
  }

  function normalizeWorkHours(company) {
    const start = (company?.work_day_start || localStorage.getItem('ct_work_day_start') || DEFAULT_WORK.start).trim();
    const end = (company?.work_day_end || localStorage.getItem('ct_work_day_end') || DEFAULT_WORK.end).trim();
    return { start, end };
  }

  global.ChantierTrackHorairesTimeline = {
    DEFAULT_WORK,
    normalizeWorkHours,
    buildDayTimeline,
    renderTimelineHtml,
    segmentsForEntry,
  };
})(typeof window !== 'undefined' ? window : global);
