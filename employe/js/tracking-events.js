/**
 * JobsitePro employé — Enregistrement des changements de statut GPS (onsite / offsite / afterhours)
 */
(function (global) {
  'use strict';

  const Trk = global.ChantierTrackTracking;
  let lastStatus = null;
  let lastTrailPointAt = 0;
  /** Un point de parcours toutes les 60 s tant que hors chantier / après heures */
  const TRAIL_POINT_MS = 60 * 1000;
  let workHoursCache = null;

  function resetTrackingSession() {
    lastStatus = null;
    lastTrailPointAt = 0;
    workHoursCache = null;
  }

  async function classifyForActiveEntry(ctx) {
    if (!Trk || !ctx?.pos) return 'onsite';
    const workHours = await loadWorkHours(ctx.api, ctx.currentUser?.company);
    const site = ctx.site || ctx.activeEntry?.expand?.site || null;
    return Trk.classifyTrackingStatus({
      lat: ctx.pos.lat,
      lng: ctx.pos.lng,
      site,
      workHours,
      at: new Date().toISOString(),
    });
  }

  async function loadWorkHours(api, companyId) {
    if (workHoursCache) return workHoursCache;
    const fallback = {
      start: localStorage.getItem('ct_work_day_start') || '07:00',
      end: localStorage.getItem('ct_work_day_end') || '16:30',
    };
    if (!api || !companyId) {
      workHoursCache = fallback;
      return workHoursCache;
    }
    try {
      const c = await api('GET', `/api/collections/companies/records/${companyId}`);
      workHoursCache = {
        start: c.work_day_start || fallback.start,
        end: c.work_day_end || fallback.end,
      };
      localStorage.setItem('ct_work_day_start', workHoursCache.start);
      localStorage.setItem('ct_work_day_end', workHoursCache.end);
    } catch {
      workHoursCache = fallback;
    }
    return workHoursCache;
  }

  /**
   * Enregistre un point dans tracking_events :
   * - changement de statut (vert ↔ orange ↔ rouge)
   * - puis 1 point / minute tant que orange ou rouge → tracé « parcours » sur la carte patron
   */
  async function recordTrackingPoint(ctx) {
    if (!Trk || !ctx?.activeEntry?.id || !ctx?.pos) return;
    const { api, activeEntry, currentUser, pos, site } = ctx;
    const workHours = await loadWorkHours(api, currentUser?.company);
    const status = Trk.classifyTrackingStatus({
      lat: pos.lat,
      lng: pos.lng,
      site,
      workHours,
      at: new Date().toISOString(),
    });
    const isAlert = status === 'offsite' || status === 'afterhours';
    const now = Date.now();
    const statusChanged = status !== lastStatus;
    const trailDue = isAlert && now - lastTrailPointAt >= TRAIL_POINT_MS;

    if (!statusChanged && !trailDue) return;

    lastStatus = status;
    if (isAlert) lastTrailPointAt = now;

    const day = Trk.todayKey();
    const body = {
      company: currentUser.company,
      employee: currentUser.id,
      time_entry: activeEntry.id,
      site: activeEntry.site || site?.id || '',
      status,
      latitude: pos.lat,
      longitude: pos.lng,
      day,
    };
    try {
      await api('POST', '/api/collections/tracking_events/records', body);
    } catch (e) {
      console.warn('tracking_events', e?.message || e);
    }
  }

  global.ChantierTrackTrackingEvents = {
    recordTrackingPoint,
    classifyForActiveEntry,
    resetTrackingSession,
    loadWorkHours,
  };
})(typeof window !== 'undefined' ? window : global);
