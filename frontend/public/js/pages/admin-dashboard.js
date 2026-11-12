// Admin analytics + audit log. Contract §8:
//   GET /api/admin/analytics/summary · GET /api/admin/audit-logs?page&limit
import { api, toQuery } from '../api.js';
import {
  initPage, el, $, showError, badge, formatDate, emptyRow, loadingRow, renderPagination, capitalise,
} from '../ui.js';

const COLS = 5;

// Tiles for the fields in the contract's §8.1 example response.
const TILES = [
  ['totalUsers', 'Registered users'],
  ['activeListings', 'Active listings'],
  ['removedListings', 'Removed listings'],
  ['listingViewsToday', 'Listing views today'],
  ['actionsToday', 'Logged actions today'],
];

const ctx = await initPage({ auth: 'required', roles: ['admin'] });
if (ctx) {
  const alertBox = $('#alert');
  let page = 1;

  loadSummary();
  loadAudit();
  $('#refresh').addEventListener('click', () => { loadSummary(); loadAudit(); });
  $('#page-size').addEventListener('change', () => { page = 1; loadAudit(); });

  async function loadSummary() {
    try {
      const { data } = await api.get('/admin/analytics/summary');
      $('#tiles').replaceChildren(...TILES.map(([key, label]) =>
        el('div', { class: 'col-6 col-md-4 col-xl' },
          el('div', { class: 'card stat-tile h-100' }, el('div', { class: 'card-body' }, [
            el('div', { class: 'stat-value', text: Number.isFinite(data?.[key]) ? data[key].toLocaleString('en-MY') : '—' }),
            el('div', { class: 'stat-label', text: label }),
          ])))));
    } catch (err) {
      showError(alertBox, err, 'The activity summary could not be loaded.');
    }
  }

  async function loadAudit() {
    const rows = $('#audit-rows');
    rows.replaceChildren(loadingRow(COLS));
    const limit = Number($('#page-size').value) || 20;
    try {
      const body = await api.get(`/admin/audit-logs${toQuery({ page, limit })}`);
      const items = body.data || [];
      rows.replaceChildren(...(items.length ? items.map(row) : [emptyRow(COLS, 'No activity has been recorded yet.')]));
      renderPagination($('#audit-pagination'), body.pagination, (p) => { page = p; loadAudit(); });
    } catch (err) {
      rows.replaceChildren();
      showError(alertBox, err, 'The audit log could not be loaded.');
    }
  }

  // Audit record field names follow contract §8 ("timestamp, actor ID, actor role, action,
  // target type and identifier, outcome"). TODO(team): confirm exact JSON names with Developer A.
  function row(r) {
    const failed = ['failure', 'failed', 'denied'].includes(r.outcome) || /failed|denied/.test(r.action || '');
    return el('tr', { class: failed ? 'table-warning' : null }, [
      el('td', { class: 'small text-nowrap', text: formatDate(r.timestamp) }),
      el('td', {}, el('code', { text: r.action || '—' })),
      el('td', {}, r.outcome ? badge(r.outcome) : '—'),
      el('td', { class: 'small' }, [
        el('div', { text: r.actorRole ? capitalise(r.actorRole) : 'Visitor' }),
        r.actorId ? el('div', { class: 'text-body-secondary font-monospace', text: r.actorId }) : null,
      ]),
      el('td', { class: 'small' }, r.targetType
        ? [el('div', { text: capitalise(r.targetType) }),
          r.targetId ? el('div', { class: 'text-body-secondary font-monospace', text: r.targetId }) : null]
        : '—'),
    ]);
  }
}
