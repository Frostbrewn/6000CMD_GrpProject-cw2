// api.js — the single place the frontend talks to the backend (API_CONTRACT.md v1.0).
//
// Handled here so individual pages cannot forget them:
//   * Same-origin requests with the session cookie (credentials: 'same-origin').
//   * CSRF token in the X-CSRF-Token header on every state-changing request (§9).
//   * Responses follow the contract envelope: { data, pagination? } or { error: { code, message } } (§4).
//   * HTTP 401 on a protected call sends the user to the login page.
//
// The browser is not a security boundary. The backend enforces every rule;
// this file only makes the legitimate path work smoothly.

const API_BASE = '/api';
let csrfToken = null;

// Contract §9.1 says CSRF failures return 403 but does not name the error code.
// TODO(team): confirm the code Developer A uses and keep only that one.
const CSRF_ERROR_CODES = new Set(['CSRF_INVALID', 'INVALID_CSRF_TOKEN', 'EBADCSRFTOKEN']);

export class ApiError extends Error {
  constructor(status, body) {
    const err = (body && body.error) || {};
    super(err.message || defaultMessage(status));
    this.name = 'ApiError';
    this.status = status;
    this.code = err.code || 'UNKNOWN_ERROR';
    // Optional extension (not yet in the contract): [{ field, message }]
    this.fields = Array.isArray(err.fields) ? err.fields : [];
  }
}

function defaultMessage(status) {
  switch (status) {
    case 0: return 'Cannot reach the server. Check your connection and try again.';
    case 400: return 'Please check the submitted information.';
    case 401: return 'Please log in to continue.';
    case 403: return 'You do not have permission to do that.';
    case 404: return 'The requested item was not found.';
    case 409: return 'That conflicts with existing information.';
    case 429: return 'Too many attempts. Please wait a moment and try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

async function safeJson(res) {
  if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  let res;
  try {
    res = await fetch(`${API_BASE}/csrf-token`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, null);
  }
  const body = await safeJson(res);
  // Contract §5 lists the endpoint but not its body; we expect { data: { csrfToken } }.
  const token = body?.data?.csrfToken;
  if (!res.ok || typeof token !== 'string') throw new ApiError(res.status || 500, body);
  csrfToken = token;
  return csrfToken;
}

export function redirectToLogin(reason = 'session') {
  if (location.pathname === '/login.html') return;
  const params = new URLSearchParams({ next: location.pathname + location.search, reason });
  location.assign(`/login.html?${params}`);
}

async function request(method, path, body, options = {}) {
  const { redirectOn401 = true, retryCsrf = true } = options;
  const headers = { Accept: 'application/json' };
  const init = { method, credentials: 'same-origin', headers, cache: 'no-store' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();

  let res;
  try {
    res = await fetch(API_BASE + path, init);
  } catch {
    throw new ApiError(0, null);
  }
  if (res.status === 204) return { data: null };
  const json = await safeJson(res);
  if (res.ok) return json ?? { data: null };

  const error = new ApiError(res.status, json);
  // The token is bound to the session, which is regenerated on login/logout.
  // Fetch a fresh token and retry once.
  if (res.status === 403 && CSRF_ERROR_CODES.has(error.code) && retryCsrf) {
    csrfToken = null;
    return request(method, path, body, { ...options, retryCsrf: false });
  }
  if (res.status === 401 && redirectOn401) redirectToLogin('session');
  throw error;
}

/** Each call resolves to the full response body: { data, pagination? }. */
export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body = {}, opts) => request('POST', path, body, opts),
  patch: (path, body = {}, opts) => request('PATCH', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
  /** Call after login and logout: the server issues a new session, so the old token is invalid. */
  resetCsrf() {
    csrfToken = null;
  },
};

/** Builds a query string, skipping empty values. */
export function toQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
