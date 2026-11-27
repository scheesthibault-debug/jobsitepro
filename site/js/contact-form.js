/**
 * JobsitePro — formulaire contact → /contact/api/send (Resend)
 */
(function () {
  'use strict';

  const SERVER_API = '/contact/api/send';

  function apiUrl() {
    const meta = document.querySelector('meta[name="contact-api"]')?.content?.trim();
    if (meta && meta.startsWith('http') && !meta.includes('TONCOMPTE')) return meta;
    return SERVER_API;
  }

  function getLang() {
    try {
      return localStorage.getItem('ct_site_lang') === 'en' ? 'en' : 'fr';
    } catch {
      return 'fr';
    }
  }

  function t(key) {
    const L = getLang();
    const fr = {
      title: 'Discutons de ',
      titleEm: 'votre projet',
      pageTitle: 'Nous contacter',
      pageSub: 'Une question sur JobsitePro ? Écrivez-nous — nous répondons sous 24 h.',
      name: 'Nom',
      namePh: 'Votre nom',
      email: 'Courriel *',
      emailPh: 'Votre adresse courriel',
      message: 'Message *',
      messagePh: 'Comment pouvons-nous vous aider ?',
      send: 'Envoyer votre demande',
      sending: 'Envoi…',
      success: 'Merci ! Votre demande a été envoyée. Nous vous répondrons sous peu.',
      error: 'Impossible d\'envoyer pour le moment. Écrivez-nous à contact@example.com',
      close: 'Fermer',
    };
    const en = {
      title: 'Let\'s talk about ',
      titleEm: 'your project',
      pageTitle: 'Contact us',
      pageSub: 'Questions about JobsitePro? Email us — we reply within 24 hours.',
      name: 'Name',
      namePh: 'Your name',
      email: 'Email *',
      emailPh: 'Your email address',
      message: 'Message *',
      messagePh: 'How can we help?',
      send: 'Send your request',
      sending: 'Sending…',
      success: 'Thank you! Your message was sent. We will reply shortly.',
      error: 'Unable to send right now. Email us at contact@example.com',
      close: 'Close',
    };
    return (L === 'en' ? en : fr)[key] || key;
  }

  function sendOk(data) {
    return data && (data.ok === true || data.success === true);
  }

  function applyTranslations() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      const prefix = modal.querySelector('#contact-title-prefix');
      const em = modal.querySelector('#contact-title-em');
      if (prefix) prefix.textContent = t('title');
      if (em) em.textContent = t('titleEm');
    }
    document.querySelectorAll('[data-contact-label="name"]').forEach((el) => { el.textContent = t('name'); });
    document.querySelectorAll('[data-contact-label="email"]').forEach((el) => { el.textContent = t('email'); });
    document.querySelectorAll('[data-contact-label="message"]').forEach((el) => { el.textContent = t('message'); });
    document.querySelectorAll('[data-contact-ph="name"]').forEach((el) => { el.placeholder = t('namePh'); });
    document.querySelectorAll('[data-contact-ph="email"]').forEach((el) => { el.placeholder = t('emailPh'); });
    document.querySelectorAll('[data-contact-ph="message"]').forEach((el) => { el.placeholder = t('messagePh'); });
    document.querySelectorAll('[data-contact-label="send"]').forEach((el) => { el.textContent = t('send'); });
    const pageTitle = document.getElementById('contact-page-title');
    const pageSub = document.getElementById('contact-page-sub');
    if (pageTitle) pageTitle.textContent = t('pageTitle');
    if (pageSub) pageSub.textContent = t('pageSub');
    document.getElementById('contact-close')?.setAttribute('aria-label', t('close'));
  }

  function openModal() {
    const m = document.getElementById('contact-modal');
    if (!m) {
      window.location.href = 'contact.html';
      return;
    }
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const status = document.getElementById('contact-status');
    if (status) {
      status.textContent = '';
      status.className = 'contact-status';
    }
    setTimeout(() => document.getElementById('contact-name')?.focus(), 80);
  }

  function closeModal() {
    const m = document.getElementById('contact-modal');
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function handleSubmit(form) {
    const btn = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.contact-status') || document.getElementById('contact-status');
    const name = (form.querySelector('[name="name"]')?.value || '').trim();
    const email = (form.querySelector('[name="email"]')?.value || '').trim();
    const message = (form.querySelector('[name="message"]')?.value || '').trim();
    const website = form.querySelector('[name="website"]')?.value || '';

    const sendLabel = btn?.querySelector('[data-contact-label="send"]') || btn?.querySelector('span');
    const prevLabel = sendLabel?.textContent;

    if (status) {
      status.textContent = '';
      status.className = 'contact-status';
    }
    if (btn) btn.disabled = true;
    if (sendLabel) sendLabel.textContent = t('sending');

    try {
      const res = await fetch(apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website, lang: getLang() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !sendOk(data)) throw new Error(data.error || 'send failed');
      if (status) {
        status.textContent = t('success');
        status.className = 'contact-status ok';
      }
      form.reset();
    } catch {
      if (status) {
        status.textContent = t('error');
        status.className = 'contact-status err';
      }
    } finally {
      if (btn) btn.disabled = false;
      if (sendLabel && prevLabel) sendLabel.textContent = prevLabel;
    }
  }

  function bind() {
    document.querySelectorAll('[data-open-contact]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (el.getAttribute('href') === 'contact.html' || el.getAttribute('href') === '/contact') return;
        e.preventDefault();
        openModal();
      });
    });
    document.getElementById('contact-close')?.addEventListener('click', closeModal);
    document.getElementById('contact-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'contact-modal') closeModal();
    });
    document.querySelector('#contact-modal .contact-card')?.addEventListener('click', (e) => e.stopPropagation());
    document.querySelectorAll('#contact-form, #contact-form-page').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit(form);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  applyTranslations();
  bind();
  document.addEventListener('ct_lang_change', applyTranslations);
})();
