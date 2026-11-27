/**
 * JobsitePro — Centre carte par province (Carte live)
 */
(function (global) {
  'use strict';

  const CENTERS = {
    QC: { lat: 46.8139, lng: -71.208, zoom: 7 },
    ON: { lat: 43.6532, lng: -79.3832, zoom: 7 },
    AB: { lat: 53.5461, lng: -113.4938, zoom: 6 },
    BC: { lat: 49.2827, lng: -123.1207, zoom: 7 },
    MB: { lat: 49.8954, lng: -97.1385, zoom: 7 },
    SK: { lat: 50.4452, lng: -104.6189, zoom: 7 },
    NB: { lat: 46.0878, lng: -64.7782, zoom: 8 },
    NS: { lat: 44.6488, lng: -63.5752, zoom: 8 },
    PE: { lat: 46.2382, lng: -63.1311, zoom: 9 },
    NL: { lat: 47.5615, lng: -52.7126, zoom: 7 },
    NT: { lat: 62.454, lng: -114.3718, zoom: 5 },
    NU: { lat: 63.7467, lng: -68.517, zoom: 5 },
    YT: { lat: 60.7212, lng: -135.0568, zoom: 6 },
  };

  const DEFAULT = CENTERS.QC;

  function get(provinceCode) {
    const code = String(provinceCode || 'QC').toUpperCase();
    return CENTERS[code] || DEFAULT;
  }

  global.ChantierTrackMapCenters = { get, CENTERS, DEFAULT };
})(typeof window !== 'undefined' ? window : global);
