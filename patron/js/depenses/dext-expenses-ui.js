/**
 * JobsitePro patron — Inbox dépenses (style Dext : miniatures + document)
 */
(function (global) {
  'use strict';

  let selectedId = null;

  const CAT_LABELS = {
    fr: { material: 'Matériaux', tool: 'Outils', fuel: 'Carburant', food: 'Repas', other: 'Autre' },
    en: { material: 'Materials', tool: 'Tools', fuel: 'Fuel', food: 'Meals', other: 'Other' },
  };

  function receiptFileName(e) {
    if (typeof global.receiptFileName === 'function') return global.receiptFileName(e);
    const r = e?.receipt;
    if (Array.isArray(r)) return r[0] || '';
    return r || '';
  }

  function isPdfFile(fn) {
    return /\.pdf$/i.test(fn || '');
  }

  function receiptUrl(e, API_URL, authToken) {
    const fn = receiptFileName(e);
    if (!fn || !e?.id) return '';
    if (typeof global.pbFileUrl === 'function') {
      return global.pbFileUrl('expenses', e.id, fn);
    }
    const tok = (authToken || '').replace(/^Bearer\s+/i, '');
    return `${API_URL}/api/files/expenses/${e.id}/${encodeURIComponent(fn)}${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
  }

  function thumbUrl(e, API_URL, authToken) {
    const fn = receiptFileName(e);
    if (!fn || !e?.id || isPdfFile(fn)) return '';
    if (typeof global.pbFileUrl === 'function') {
      const base = global.pbFileUrl('expenses', e.id, fn);
      return base ? `${base}${base.includes('?') ? '&' : '?'}thumb=120x120` : '';
    }
    const tok = (authToken || '').replace(/^Bearer\s+/i, '');
    return `${API_URL}/api/files/expenses/${e.id}/${encodeURIComponent(fn)}?thumb=120x120${tok ? `&token=${encodeURIComponent(tok)}` : ''}`;
  }

  function statusClass(st) {
    if (st === 'approved') return 'dext-status-approved';
    if (st === 'rejected') return 'dext-status-rejected';
    return 'dext-status-pending';
  }

  function statusLabel(st, lang) {
    const L = lang === 'fr';
    if (st === 'approved') return L ? 'Approuvé' : 'Approved';
    if (st === 'rejected') return L ? 'Refusé' : 'Rejected';
    return L ? 'En attente' : 'Pending';
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function thumbHtml(e, API_URL, authToken, lang) {
    const fn = receiptFileName(e);
    const thumb = thumbUrl(e, API_URL, authToken);
    const L = lang === 'fr';
    if (thumb) {
      return `<div class="dext-row-thumb"><img src="${thumb}" alt="" loading="lazy" onerror="this.parentElement.classList.add('dext-row-thumb--doc');this.remove();this.parentElement.insertAdjacentHTML('beforeend','<i class=\\'ti ti-photo-off\\'></i>')"></div>`;
    }
    if (fn && isPdfFile(fn)) {
      return `<div class="dext-row-thumb dext-row-thumb--pdf" title="PDF"><i class="ti ti-file-type-pdf"></i></div>`;
    }
    if (fn) {
      return `<div class="dext-row-thumb dext-row-thumb--doc" title="${escapeHtml(fn)}"><i class="ti ti-file"></i></div>`;
    }
    return `<div class="dext-row-thumb dext-row-thumb--empty" title="${L ? 'Image archivée' : 'Archived'}"><i class="ti ti-archive"></i></div>`;
  }

  function renderInbox(ctx, items, nameMap) {
    const { lang, fmtMoney, fmtDate, API_URL, authToken } = ctx;
    const cats = CAT_LABELS[lang] || CAT_LABELS.fr;
    const L = lang === 'fr';
    if (!items.length) {
      return `<div class="dext-inbox-empty">
        <i class="ti ti-receipt-off"></i>
        <strong>${L ? 'Aucun reçu' : 'No receipts'}</strong>
        <span>${L ? 'Les scans des employés apparaîtront ici avec la miniature du document.' : 'Employee scans will show here with document thumbnails.'}</span>
      </div>`;
    }
    return items.map(e => {
      const active = selectedId === e.id ? ' active' : '';
      const vendor = e.vendor || e.description?.slice(0, 32) || (L ? 'Sans marchand' : 'No vendor');
      const emp = e.expand?.employee?.name || nameMap[e.employee] || '–';
      const st = e.status || 'pending';
      const cat = cats[e.category] || e.category || '';
      return `<button type="button" class="dext-row${active}" data-id="${e.id}" onclick="ChantierTrackDextExpenses.select('${e.id}')">
        ${thumbHtml(e, API_URL, authToken, lang)}
        <div class="dext-row-main">
          <div class="dext-row-top">
            <span class="dext-row-vendor">${escapeHtml(vendor)}</span>
            <span class="dext-row-amt">${fmtMoney(e.amount)}</span>
          </div>
          <div class="dext-row-meta">
            <span class="dext-pill ${statusClass(st)}">${statusLabel(st, lang)}</span>
            <span>${escapeHtml(emp)}</span>
            <span>·</span>
            <span>${fmtDate(e.expense_date || e.created)}</span>
            ${cat ? `<span>·</span><span>${escapeHtml(cat)}</span>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');
  }

  function renderDetail(ctx, e, nameMap) {
    const { lang, fmtMoney, fmtDate, API_URL, authToken, t } = ctx;
    const L = lang === 'fr';
    if (!e) {
      return `<div class="dext-detail-empty">
        <i class="ti ti-click"></i>
        <strong>${L ? 'Sélectionnez un reçu' : 'Select a receipt'}</strong>
        <span>${L ? 'Cliquez une miniature à gauche pour voir le document et valider.' : 'Click a thumbnail on the left to preview and approve.'}</span>
      </div>`;
    }
    const fn = receiptFileName(e);
    const img = receiptUrl(e, API_URL, authToken);
    const pdf = isPdfFile(fn);
    const site = e.expand?.site?.name || '–';
    const emp = e.expand?.employee?.name || nameMap[e.employee] || '–';
    const st = e.status || 'pending';
    const canApprove = st === 'pending' && !(typeof global.expenseNeedsSiteToApprove === 'function' && global.expenseNeedsSiteToApprove(e) && !e.site);
    const cats = CAT_LABELS[lang] || CAT_LABELS.fr;

    let preview;
    if (img && pdf) {
      preview = `<div class="dext-doc-preview dext-doc-preview--pdf">
        <iframe src="${img}#view=FitH" title="PDF"></iframe>
        <a class="dext-doc-open" href="${img}" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> ${L ? 'Ouvrir le PDF' : 'Open PDF'}</a>
      </div>`;
    } else if (img) {
      preview = `<div class="dext-doc-preview">
        <a href="${img}" target="_blank" rel="noopener" title="${L ? 'Agrandir' : 'Enlarge'}">
          <img src="${img}" alt="receipt" loading="lazy" onerror="this.style.display='none';this.parentElement.parentElement.classList.add('dext-doc-preview--missing');this.parentElement.parentElement.insertAdjacentHTML('beforeend','<div class=\\'dext-doc-fallback\\'><i class=\\'ti ti-photo-off\\'></i><span>${L ? 'Image indisponible' : 'Image unavailable'}</span></div>')">
        </a>
      </div>`;
    } else {
      preview = `<div class="dext-doc-preview dext-doc-preview--missing">
        <div class="dext-doc-fallback">
          <i class="ti ti-archive"></i>
          <span>${L ? 'Photo retirée après archive de paie (fichier dans le ZIP).' : 'Photo removed after pay archive (file is in the ZIP).'}</span>
        </div>
      </div>`;
    }

    return `
      ${preview}
      <div class="dext-detail-body">
        <div class="dext-detail-title">
          <div>
            <h3>${escapeHtml(e.vendor || (L ? 'Sans marchand' : 'No vendor'))}</h3>
            <span class="dext-pill ${statusClass(st)}">${statusLabel(st, lang)}</span>
          </div>
          <div class="dext-detail-total">${fmtMoney(e.amount)}</div>
        </div>
        <div class="dext-detail-grid">
          <div class="dext-detail-row"><span>${L ? 'Taxes' : 'Tax'}</span><span>${e.tax_amount != null ? fmtMoney(e.tax_amount) : '–'}</span></div>
          <div class="dext-detail-row"><span>${L ? 'Catégorie' : 'Category'}</span><span>${escapeHtml(cats[e.category] || e.category || '–')}</span></div>
          <div class="dext-detail-row"><span>${L ? 'Employé' : 'Employee'}</span><span>${escapeHtml(emp)}</span></div>
          <div class="dext-detail-row"><span>${L ? 'Chantier' : 'Site'}</span><span>${escapeHtml(site)}</span></div>
          <div class="dext-detail-row"><span>${L ? 'Paiement' : 'Payment'}</span><span>${typeof global.expensePaymentLabel === 'function' ? escapeHtml(global.expensePaymentLabel(e)) : '–'}</span></div>
          <div class="dext-detail-row"><span>${L ? 'Date' : 'Date'}</span><span>${fmtDate(e.expense_date || e.created)}</span></div>
          <div class="dext-detail-row dext-detail-row--full"><span>${L ? 'Description' : 'Description'}</span><span>${escapeHtml(e.description || '–')}</span></div>
        </div>
      </div>
      <div class="dext-detail-actions">
        ${st === 'pending' && canApprove ? `<button type="button" class="btn btn-g btn-sm" onclick="updateDepenseStatus('${e.id}','approved')"><i class="ti ti-check"></i> ${t('btn_approve')}</button>` : ''}
        ${st === 'pending' ? `<button type="button" class="btn btn-d btn-sm" onclick="updateDepenseStatus('${e.id}','rejected')"><i class="ti ti-x"></i> ${t('btn_reject')}</button>` : ''}
        <button type="button" class="btn btn-sm" onclick="openEditDepense('${e.id}')"><i class="ti ti-edit"></i> ${L ? 'Modifier' : 'Edit'}</button>
        <button type="button" class="btn btn-d btn-sm" onclick="deleteRec('expenses','${e.id}','depenses','')"><i class="ti ti-trash"></i></button>
      </div>`;
  }

  function render(ctx, items, nameMap, summaryHtml) {
    const host = document.getElementById('dep-list');
    if (!host) return;
    const L = ctx.lang === 'fr';
    if (!selectedId && items.length) selectedId = items[0].id;
    if (selectedId && !items.find(x => x.id === selectedId)) selectedId = items[0]?.id || null;
    const sel = items.find(x => x.id === selectedId);
    const pending = items.filter(x => (x.status || 'pending') === 'pending').length;

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero dext-hero">
        <div>
          <h2>${L ? 'Inbox reçus' : 'Receipt inbox'}</h2>
          <p>${L
            ? 'Comme un classeur de documents : miniatures à gauche, reçu en grand à droite — validez en un clic.'
            : 'Document inbox: thumbnails on the left, full receipt on the right — approve in one click.'}</p>
        </div>
        ${pending ? `<div class="dext-hero-badge">${pending} ${L ? 'à traiter' : 'to review'}</div>` : ''}
      </div>
      ${summaryHtml || ''}
      <div class="dext-layout">
        <div class="dext-gallery">
          <div class="dext-gallery-head">
            <span><i class="ti ti-stack-2"></i> ${items.length} ${L ? 'documents' : 'documents'}</span>
            <span class="dext-gallery-hint">${L ? 'Cliquez une vignette' : 'Click a thumbnail'}</span>
          </div>
          <div class="dext-inbox" id="dext-grid">${renderInbox(ctx, items, nameMap)}</div>
        </div>
        <div class="dext-detail" id="dext-detail">${renderDetail(ctx, sel, nameMap)}</div>
      </div>
    </div>`;
    global.__dextExpenseItems = items;
    global.__dextExpenseNameMap = nameMap;
  }

  function select(id) {
    selectedId = id;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const items = global.__dextExpenseItems || [];
    const nameMap = global.__dextExpenseNameMap || {};
    const e = items.find(x => x.id === id);
    document.querySelectorAll('.dext-row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const det = document.getElementById('dext-detail');
    if (det) det.innerHTML = renderDetail(ctx, e, nameMap);
  }

  global.ChantierTrackDextExpenses = { render, select };
})(typeof window !== 'undefined' ? window : global);
