/// <reference path="../pb_data/types.d.ts" />
/**
 * OAuth QuickBooks + Wagepoint — routes JobsitePro
 *
 * IMPORTANT PocketBase : chaque handler routerAdd s'exécute dans un runtime
 * goja ISOLÉ. Les fonctions/variables définies au niveau module ne sont PAS
 * visibles dans les handlers. Tout helper doit donc être défini DANS le handler.
 */

routerAdd('GET', '/api/jobsitepro/oauth/quickbooks/start', function (e) {
  try {
    var getParam = function (name) {
      try {
        var q = e.request.url.query();
        if (q) {
          var v = q.get(name);
          if (v != null && String(v) !== '') return String(v);
        }
      } catch (er) { /* */ }
      return '';
    };
    var patronUrl = $os.getenv('PATRON_APP_URL') || 'https://jobsitepro.example.com/patron/';
    var patronRedirect = function (status, errorMsg) {
      var url = patronUrl.replace(/\/?$/, '/') + '?page=quickbooks&oauth=quickbooks&status=' + status;
      if (errorMsg) url += '&error=' + encodeURIComponent(String(errorMsg).slice(0, 120));
      return url;
    };

    var companyId = getParam('company');
    if (!companyId) return e.json(400, { error: 'company requis' });

    var clientId = $os.getenv('QUICKBOOKS_CLIENT_ID') || '';
    if (!clientId) {
      return e.redirect(302, patronRedirect('error', 'QUICKBOOKS_CLIENT_ID manquant sur le serveur'));
    }

    var pub = $os.getenv('PUBLIC_URL') || 'https://jobsitepro.example.com';
    var redirectUri = $os.getenv('QUICKBOOKS_REDIRECT_URI') || pub + '/api/jobsitepro/oauth/quickbooks/callback';
    var scope = encodeURIComponent('com.intuit.quickbooks.accounting openid profile email');
    var url =
      'https://appcenter.intuit.com/connect/oauth2?client_id=' +
      encodeURIComponent(clientId) +
      '&response_type=code&scope=' +
      scope +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&state=' +
      encodeURIComponent(companyId);
    return e.redirect(302, url);
  } catch (err) {
    console.log('[oauth/qb/start]', String(err));
    return e.json(500, { error: String(err) });
  }
});

routerAdd('GET', '/api/jobsitepro/oauth/quickbooks/callback', function (e) {
  var getParam = function (name) {
    try {
      var q = e.request.url.query();
      if (q) {
        var v = q.get(name);
        if (v != null && String(v) !== '') return String(v);
      }
    } catch (er) { /* */ }
    return '';
  };
  var patronUrl = $os.getenv('PATRON_APP_URL') || 'https://jobsitepro.example.com/patron/';
  var patronRedirect = function (status, errorMsg) {
    var url = patronUrl.replace(/\/?$/, '/') + '?page=quickbooks&oauth=quickbooks&status=' + status;
    if (errorMsg) url += '&error=' + encodeURIComponent(String(errorMsg).slice(0, 120));
    return url;
  };

  var qCode = getParam('code');
  var companyId = getParam('state');
  var qError = getParam('error');
  var qRealm = getParam('realmId');

  if (qError) return e.redirect(302, patronRedirect('error', qError));
  if (!qCode || !companyId) return e.redirect(302, patronRedirect('error', 'code OAuth manquant'));

  var env = String($os.getenv('QUICKBOOKS_ENVIRONMENT') || 'sandbox').toLowerCase();
  if (env !== 'production') env = 'sandbox';

  var email = '';
  var tok = {};
  try {
    var clientId = $os.getenv('QUICKBOOKS_CLIENT_ID') || '';
    var secret = $os.getenv('QUICKBOOKS_CLIENT_SECRET') || '';
    if (clientId && secret) {
      var pub = $os.getenv('PUBLIC_URL') || 'https://jobsitepro.example.com';
      var redirectUri = $os.getenv('QUICKBOOKS_REDIRECT_URI') || pub + '/api/jobsitepro/oauth/quickbooks/callback';
      var body =
        'grant_type=authorization_code&code=' +
        encodeURIComponent(qCode) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri);
      var basicAuth = $os.base64Encode ? $os.base64Encode(clientId + ':' + secret) : '';
      var tokenRes = $http.send({
        url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          Authorization: basicAuth ? 'Basic ' + basicAuth : '',
        },
        body: body,
        timeout: 30,
      });
      tok = tokenRes.json || {};
      if (tok.access_token) {
        var userRes = $http.send({
          url: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + tok.access_token },
          timeout: 15,
        });
        email = (userRes.json && userRes.json.email) || '';
      }
    }
  } catch (err) {
    console.log('[oauth/qb/callback]', String(err));
  }

  if (tok.access_token) {
    try {
      var col = $app.findCollectionByNameOrId('integration_tokens');
      var existing = null;
      try {
        var rows = $app.findRecordsByFilter(
          'integration_tokens',
          'company = {:co} && provider = {:pr}',
          { co: companyId, pr: 'quickbooks' }
        );
        if (rows && rows.length) existing = rows[0];
      } catch (er) { /* */ }
      var rec = existing || new Record(col);
      rec.set('company', companyId);
      rec.set('provider', 'quickbooks');
      rec.set('environment', env);
      rec.set('access_token', tok.access_token);
      rec.set('refresh_token', tok.refresh_token || '');
      var sec = Number(tok.expires_in) || 3600;
      rec.set('expires_at', new Date(Date.now() + sec * 1000).toISOString());
      rec.set('realm_id', qRealm || '');
      rec.set('metadata', { email: email || '', token_type: tok.token_type || 'bearer' });
      $app.save(rec);
    } catch (err) {
      console.log('[oauth/qb/token-save]', String(err));
    }
  }

  try {
    var company = $app.findRecordById('companies', companyId);
    if (company) {
      var cfg = {};
      try {
        var raw = company.get('integrations_config');
        if (raw) cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (er) { /* */ }
      cfg.quickbooks = {
        connected: true,
        email: email || 'quickbooks@connected',
        connected_at: new Date().toISOString(),
        realm_id: qRealm || '',
      };
      if (!cfg.wagepoint) cfg.wagepoint = {};
      company.set('integrations_config', cfg);
      $app.save(company);
    }
  } catch (err) {
    console.log('[oauth/qb/company-save]', String(err));
  }

  return e.redirect(302, patronRedirect('ok'));
});

routerAdd('GET', '/api/jobsitepro/oauth/wagepoint/start', function (e) {
  var getParam = function (name) {
    try {
      var q = e.request.url.query();
      if (q) {
        var v = q.get(name);
        if (v != null && String(v) !== '') return String(v);
      }
    } catch (er) { /* */ }
    return '';
  };
  var patronUrl = $os.getenv('PATRON_APP_URL') || 'https://jobsitepro.example.com/patron/';
  var patronRedirect = function (status, errorMsg) {
    var url = patronUrl.replace(/\/?$/, '/') + '?page=wagepoint&oauth=wagepoint&status=' + status;
    if (errorMsg) url += '&error=' + encodeURIComponent(String(errorMsg).slice(0, 120));
    return url;
  };

  var companyId = getParam('company');
  if (!companyId) return e.json(400, { error: 'company requis' });

  var wpClient = $os.getenv('WAGEPOINT_CLIENT_ID') || '';
  if (!wpClient) {
    return e.redirect(302, patronRedirect('error', 'WAGEPOINT_CLIENT_ID manquant sur le serveur'));
  }
  var pub = $os.getenv('PUBLIC_URL') || 'https://jobsitepro.example.com';
  var redirectUri = $os.getenv('WAGEPOINT_REDIRECT_URI') || pub + '/api/jobsitepro/oauth/wagepoint/callback';
  var url =
    'https://secure.wagepoint.com/oauth/authorize?client_id=' +
    encodeURIComponent(wpClient) +
    '&response_type=code&redirect_uri=' +
    encodeURIComponent(redirectUri) +
    '&state=' +
    encodeURIComponent(companyId);
  return e.redirect(302, url);
});

routerAdd('GET', '/api/jobsitepro/oauth/wagepoint/callback', function (e) {
  var getParam = function (name) {
    try {
      var q = e.request.url.query();
      if (q) {
        var v = q.get(name);
        if (v != null && String(v) !== '') return String(v);
      }
    } catch (er) { /* */ }
    return '';
  };
  var patronUrl = $os.getenv('PATRON_APP_URL') || 'https://jobsitepro.example.com/patron/';
  var patronRedirect = function (status, errorMsg) {
    var url = patronUrl.replace(/\/?$/, '/') + '?page=wagepoint&oauth=wagepoint&status=' + status;
    if (errorMsg) url += '&error=' + encodeURIComponent(String(errorMsg).slice(0, 120));
    return url;
  };

  var qCode = getParam('code');
  var companyId = getParam('state');
  var qError = getParam('error');

  if (qError) return e.redirect(302, patronRedirect('error', qError));
  if (!companyId) return e.redirect(302, patronRedirect('error', 'state OAuth manquant'));

  var email = '';
  try {
    var wpSecret = $os.getenv('WAGEPOINT_CLIENT_SECRET') || '';
    var wpClient = $os.getenv('WAGEPOINT_CLIENT_ID') || '';
    if (qCode && wpClient && wpSecret) {
      var pub = $os.getenv('PUBLIC_URL') || 'https://jobsitepro.example.com';
      var redirectUri = $os.getenv('WAGEPOINT_REDIRECT_URI') || pub + '/api/jobsitepro/oauth/wagepoint/callback';
      var body =
        'grant_type=authorization_code&code=' +
        encodeURIComponent(qCode) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri) +
        '&client_id=' +
        encodeURIComponent(wpClient) +
        '&client_secret=' +
        encodeURIComponent(wpSecret);
      var tokenRes = $http.send({
        url: 'https://secure.wagepoint.com/oauth/token',
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body,
        timeout: 30,
      });
      var tok = tokenRes.json || {};
      email = tok.email || tok.user_email || '';
    }
  } catch (err) {
    console.log('[oauth/wagepoint/callback]', String(err));
  }

  try {
    var company = $app.findRecordById('companies', companyId);
    if (company) {
      var cfg = {};
      try {
        var raw = company.get('integrations_config');
        if (raw) cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (er) { /* */ }
      cfg.wagepoint = {
        connected: true,
        email: email || 'wagepoint@connected',
        connected_at: new Date().toISOString(),
      };
      if (!cfg.quickbooks) cfg.quickbooks = {};
      company.set('integrations_config', cfg);
      $app.save(company);
    }
  } catch (err) {
    console.log('[oauth/wagepoint/company-save]', String(err));
  }

  return e.redirect(302, patronRedirect('ok'));
});
