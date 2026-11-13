// ui.js — shared page helpers: safe DOM building, alerts, form errors, nav,
// page guards, formatting, pagination and confirmation dialogs.
//
// XSS rule for the whole frontend: data from the API is only ever inserted
// with textContent / DOM APIs (see el()). Never use innerHTML, insertAdjacentHTML
// or document.write with data. The server's Content Security Policy blocks
// inline scripts as a second layer of defence.

import { api, ApiError, redirectToLogin } from './api.js';

export const APP_NAME = 'SecureMarket';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
export const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);

/* ---------- Safe element builder ---------- */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if ((key === 'href' || key === 'src') && /^\s*(javascript|vbscript):/i.test(String(value))) {
      continue; // never allow script URLs
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const qs = (name) => new URLSearchParams(location.search).get(name);

/* ---------- Alerts and errors ---------- */

export function showAlert(container, message, type = 'danger', { extra } = {}) {
  if (!container) return;
  const box = el('div', { class: `alert alert-${type}`, role: type === 'danger' ? 'alert' : 'status' }, [
    el('span', { text: message }),
    extra || null,
  ]);
  container.replaceChildren(box);
}

export function clearAlert(container) {
  container?.replaceChildren();
}

/** Show an error. Server messages are already generic and safe to display. */
export function showError(container, err, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) {
    showAlert(container, err.message || fallback, 'danger');
  } else {
    console.error(err);
    showAlert(container, fallback);
  }
}

/* ---------- Forms ---------- */

export function clearFieldErrors(form) {
  $$('.is-invalid', form).forEach((i) => {
    i.classList.remove('is-invalid');
    i.removeAttribute('aria-invalid');
  });
  $$('.invalid-feedback', form).forEach((f) => { f.textContent = ''; });
}

export function setFieldError(form, name, message) {
  const input = form.elements.namedItem(name);
  if (!(input instanceof HTMLElement)) return null;
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  const fb = input.closest('.field')?.querySelector('.invalid-feedback');
  if (fb) fb.textContent = message;
  return input;
}

/** errors: { field: message } or [{ field, message }]. Returns number applied. */
export function applyFieldErrors(form, errors) {
  const list = Array.isArray(errors) ? errors : Object.entries(errors).map(([field, message]) => ({ field, message }));
  let first = null;
  let count = 0;
  for (const { field, message } of list) {
    const input = setFieldError(form, field, message);
    if (input) {
      count++;
      first ??= input;
    }
  }
  first?.focus();
  return count;
}

/** Handles an API error for a form: field errors go inline, the rest to the alert box. */
export function handleFormError(form, alertBox, err) {
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.fields.length) {
    const applied = applyFieldErrors(form, err.fields);
    showAlert(alertBox, applied ? 'Please correct the highlighted fields.' : err.message);
    return;
  }
  showError(alertBox, err);
}

/** Reads named form controls. Strings are trimmed except passwords. */
export function readForm(form) {
  const data = {};
  for (const elm of form.elements) {
    if (!elm.name || elm.disabled) continue;
    if (elm.type === 'checkbox') data[elm.name] = elm.checked;
    else if (elm.type === 'password') data[elm.name] = elm.value;
    else data[elm.name] = elm.value.trim();
  }
  return data;
}

export function setBusy(button, busy, busyLabel = 'Please wait…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.dataset.hadFocus = String(document.activeElement === button);
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    // Disabling a focused button drops focus to <body>; give it back for keyboard users.
    if (button.dataset.hadFocus === 'true' && document.activeElement === document.body) button.focus();
  }
}

/* ---------- Formatting ---------- */

const money = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
export const formatPrice = (n) => money.format(Number(n) || 0);

export function formatDate(iso, withTime = true) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-MY', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

export function truncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const BADGES = {
  // listing / account status (contract §6.4, §7.1)
  active: 'text-bg-success', removed: 'text-bg-secondary', disabled: 'text-bg-danger',
  // roles (contract §3)
  member: 'text-bg-light border', admin: 'text-bg-dark',
  // audit outcomes (contract §8)
  success: 'text-bg-success', failure: 'text-bg-danger', failed: 'text-bg-danger', denied: 'text-bg-warning',
};

export function badge(value, label) {
  const v = String(value ?? '');
  return el('span', { class: `badge ${BADGES[v] || 'text-bg-secondary'}`, text: label || capitalise(v) });
}

export const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* ---------- Navigation and page guard ---------- */

function navLink(href, label) {
  const active = location.pathname === href || (href === '/index.html' && location.pathname === '/');
  return el('li', { class: 'nav-item' },
    el('a', { class: `nav-link${active ? ' active' : ''}`, href, 'aria-current': active ? 'page' : null, text: label }));
}

async function logout() {
  try {
    await api.post('/auth/logout', {}, { redirectOn401: false });
  } catch {
    /* even if the call fails we leave the page; the session expires server-side */
  } finally {
    api.resetCsrf();
    location.assign('/login.html?loggedOut=1');
  }
}

export function renderNav(user) {
  const host = $('#app-nav');
  if (!host) return;

  const left = [navLink('/index.html', 'Browse')];
  if (user) left.push(navLink('/my-listings.html', 'My listings'));
  if (user?.role === 'admin') {
    left.push(
      navLink('/admin-dashboard.html', 'Admin dashboard'),
      navLink('/admin-users.html', 'Users'),
      navLink('/admin-listings.html', 'All listings'),
    );
  }

  let right;
  if (user) {
    right = el('ul', { class: 'navbar-nav ms-auto' },
      el('li', { class: 'nav-item dropdown' }, [
        el('button', {
          class: 'btn btn-link nav-link dropdown-toggle', type: 'button',
          'data-bs-toggle': 'dropdown', 'aria-expanded': 'false',
        }, [el('span', { text: user.name }), ' ', badge(user.role)]),
        el('ul', { class: 'dropdown-menu dropdown-menu-end' }, [
          el('li', {}, el('span', { class: 'dropdown-item-text small text-body-secondary', text: user.email })),
          el('li', {}, el('a', { class: 'dropdown-item', href: '/my-listings.html', text: 'My listings' })),
          el('li', {}, el('a', { class: 'dropdown-item', href: '/security-tips.html', text: 'Security tips' })),
          el('li', {}, el('hr', { class: 'dropdown-divider' })),
          el('li', {}, el('button', { class: 'dropdown-item', type: 'button', text: 'Log out', onClick: logout })),
        ]),
      ]));
  } else {
    right = el('div', { class: 'ms-auto d-flex gap-2' }, [
      el('a', { class: 'btn btn-outline-light btn-sm', href: '/login.html', text: 'Log in' }),
      el('a', { class: 'btn btn-light btn-sm', href: '/register.html', text: 'Register' }),
    ]);
  }

  host.replaceChildren(
    el('nav', { class: 'navbar navbar-expand-lg navbar-dark bg-primary' },
      el('div', { class: 'container' }, [
        el('a', { class: 'navbar-brand fw-semibold', href: '/index.html', text: APP_NAME }),
        el('button', {
          class: 'navbar-toggler', type: 'button', 'data-bs-toggle': 'collapse',
          'data-bs-target': '#mainNav', 'aria-controls': 'mainNav', 'aria-expanded': 'false',
          'aria-label': 'Toggle navigation',
        }, el('span', { class: 'navbar-toggler-icon' })),
        el('div', { class: 'collapse navbar-collapse', id: 'mainNav' }, [
          el('ul', { class: 'navbar-nav me-auto' }, left),
          right,
        ]),
      ])),
  );
}

export function renderFooter() {
  const host = $('#app-footer');
  if (!host) return;
  host.replaceChildren(
    el('div', { class: 'container py-4 small text-body-secondary d-flex flex-wrap gap-3 justify-content-between' }, [
      el('span', { text: `${APP_NAME} — coursework demonstration system. No real payments are processed.` }),
      el('span', { class: 'd-flex gap-3' }, [
        el('a', { href: '/privacy.html', text: 'Privacy notice' }),
        el('a', { href: '/security-tips.html', text: 'Security tips' }),
      ]),
    ]),
  );
}

/** Returns the logged-in user, or null if not logged in. */
export async function fetchCurrentUser() {
  try {
    const body = await api.get('/auth/me', { redirectOn401: false });
    return body?.data?.user || null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

function showPageMessage(title, message, type = 'warning', action = null) {
  const main = $('#main');
  main.replaceChildren(
    el('div', { class: 'row justify-content-center' },
      el('div', { class: 'col-lg-6' },
        el('div', { class: `alert alert-${type}`, role: 'alert' }, [
          el('h1', { class: 'h5', text: title }),
          el('p', { class: 'mb-0', text: message }),
          action,
        ]))),
  );
}

/**
 * Initialises a page.
 *   auth: 'optional' | 'required' | 'guest' (guest = only for logged-out users)
 *   roles: optional list of roles allowed to see the page
 * Returns { user } when the page may render, otherwise null.
 *
 * Role checks here only decide what to SHOW. The server enforces RBAC on every
 * API call, so bypassing this check in the browser gains nothing.
 */
export async function initPage({ auth = 'optional', roles = null } = {}) {
  renderFooter();
  let user;
  try {
    user = await fetchCurrentUser();
  } catch (err) {
    renderNav(null);
    showPageMessage('Service unavailable', err.message || 'Please try again shortly.', 'danger');
    return null;
  }
  renderNav(user);

  if (auth === 'guest' && user) {
    location.replace(homeFor(user));
    return null;
  }
  if (auth === 'required' && !user) {
    redirectToLogin('auth');
    return null;
  }
  if (roles && (!user || !roles.includes(user.role))) {
    showPageMessage('Access denied', 'Your account does not have permission to view this page.', 'warning',
      el('a', { class: 'btn btn-sm btn-outline-dark mt-3', href: '/index.html', text: 'Back to listings' }));
    return null;
  }
  $('#page-content')?.removeAttribute('hidden');
  return { user };
}

/** Default landing page after login for each role. */
export const homeFor = (user) => (user?.role === 'admin' ? '/admin-dashboard.html' : '/my-listings.html');

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(raw, fallback = '/my-listings.html') {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  try {
    const u = new URL(raw, location.origin);
    if (u.origin !== location.origin) return fallback;
    if (['/login.html', '/register.html'].includes(u.pathname)) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/* ---------- Tables, pagination, empty states ---------- */

export function emptyRow(colspan, message) {
  return el('tr', {}, el('td', { colspan, class: 'text-center text-body-secondary py-4', text: message }));
}

export function loadingRow(colspan) {
  return el('tr', {}, el('td', { colspan, class: 'text-center text-body-secondary py-4', text: 'Loading…' }));
}

/** pagination: the contract's { page, limit, total, totalPages } object. */
export function renderPagination(container, pagination, onPage) {
  if (!container) return;
  const page = Number(pagination?.page) || 1;
  const pages = Number(pagination?.totalPages) || 1;
  if (pages <= 1) {
    container.replaceChildren();
    return;
  }
  const item = (label, target, disabled, active) =>
    el('li', { class: `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}` },
      el('button', {
        class: 'page-link', type: 'button', text: label, disabled,
        'aria-current': active ? 'page' : null,
        onClick: () => onPage(target),
      }));
  const items = [item('Previous', page - 1, page <= 1, false)];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let p = start; p <= end; p++) items.push(item(String(p), p, false, p === page));
  items.push(item('Next', page + 1, page >= pages, false));
  container.replaceChildren(el('nav', { 'aria-label': 'Pagination' }, el('ul', { class: 'pagination justify-content-center mb-0' }, items)));
}

/* ---------- Confirmation dialog ---------- */

/** Bootstrap modal confirmation. Resolves true/false. */
export function confirmDialog({ title, body, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const modalEl = el('div', { class: 'modal fade', tabindex: '-1', 'aria-hidden': 'true' },
      el('div', { class: 'modal-dialog modal-dialog-centered' },
        el('div', { class: 'modal-content' }, [
          el('div', { class: 'modal-header' }, [
            el('h2', { class: 'modal-title h5', text: title }),
            el('button', { type: 'button', class: 'btn-close', 'data-bs-dismiss': 'modal', 'aria-label': 'Close' }),
          ]),
          el('div', { class: 'modal-body' }, el('p', { class: 'mb-0', text: body })),
          el('div', { class: 'modal-footer' }, [
            el('button', { type: 'button', class: 'btn btn-outline-secondary', 'data-bs-dismiss': 'modal', text: 'Cancel' }),
            el('button', {
              type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: confirmText,
              onClick: () => { confirmed = true; modal.hide(); },
            }),
          ]),
        ])));
    document.body.append(modalEl);
    const modal = new window.bootstrap.Modal(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalEl.remove();
      resolve(confirmed);
    });
    modal.show();
  });
}
