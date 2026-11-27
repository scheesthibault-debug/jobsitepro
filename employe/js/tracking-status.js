/**
 * JobsitePro — Statut GPS (vert / orange / rouge) partagé patron + employé
 */
(function (global) {
  'use strict';

  const DEFAULT_WORK = { start: '07:00', end: '16:30' };

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

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
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

  function classifyTrackingStatus(opts) {
    const lat = opts?.lat;
    const lng = opts?.lng;
    const site = opts?.site;
    const work = opts?.workHours || DEFAULT_WORK;
    const when = opts?.at ? new Date(opts.at) : new Date();
    const dateStr = opts?.day || when.toISOString().slice(0, 10);
    const ws = msOnDay(dateStr, work.start || DEFAULT_WORK.start);
    const we = msOnDay(dateStr, work.end || DEFAULT_WORK.end);
    const now = when.getTime();

    if (now > we) return 'afterhours';
    if (now >= ws) {
      const onSite = isOnSite(lat, lng, site);
      if (onSite === false) return 'offsite';
      return 'onsite';
    }
    const onSite = isOnSite(lat, lng, site);
    if (onSite === false) return 'offsite';
    return 'onsite';
  }

  function statusLabel(status, lang) {
    const L = lang === 'en';
    if (status === 'offsite') return L ? 'Off job site' : 'Hors chantier';
    if (status === 'afterhours') return L ? 'After work hours' : 'Après heures de travail';
    return L ? 'On job site' : 'Sur chantier';
  }

  function statusColor(status) {
    if (status === 'offsite') return 'var(--orange)';
    if (status === 'afterhours') return 'var(--red)';
    return 'var(--green-l)';
  }

  global.ChantierTrackTracking = {
    classifyTrackingStatus,
    statusLabel,
    statusColor,
    todayKey,
    distanceMeters,
    isOnSite,
    DEFAULT_WORK,
  };
})(typeof window !== 'undefined' ? window : global);
