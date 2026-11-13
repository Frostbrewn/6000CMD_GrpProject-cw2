// Admin listing moderation. Contract §7.2:
//   GET /api/admin/listings · PATCH /api/admin/listings/:listingId/status { status: 'active' | 'removed' }
import { api, toQuery } from '../api.js';
import {
  initPage, el, $, showAlert, clearAlert, showError, badge, formatPrice, formatDate, emptyRow,
  loadingRow, renderPagination, confirmDialog,
} from '../ui.js';

const PAGE_SIZE = 20;
const COLS = 7;

const ctx = await initPage({ auth: 'required', roles: ['admin'] });
if (ctx) {
  const alertBox = $('#alert');
  let page = 1;
  load();

  async function load() {
    const rows = $('#rows');
    rows.replaceChildren(loadingRow(COLS));
    try {
      const body = await api.get(`/admin/listings${toQuery({ page, limit: PAGE_SIZE })}`);
      const items = body.data || [];
      rows.replaceChildren(...(items.length ? items.map(row) : [emptyRow(COLS, 'No listings yet.')]));
      renderPagination($('#pagination'), body.pagination, (p) => { page = p; load(); });
    } catch (err) {
      rows.replaceChildren();
      showError(alertBox, err, 'Listings could not be loaded.');
    }
  }

  function row(item) {
    const active = item.status === 'active';
    return el('tr', {}, [
      el('td', {}, active
        ? el('a', { href: `/listing.html?id=${encodeURIComponent(item.id)}`, text: item.title })
        : el('span', { text: item.title })),
      // ownerName is optional (not in the contract); fall back to the owner ID.
      el('td', { class: 'small' }, item.ownerName
        ? el('span', { text: item.ownerName })
        : el('span', { class: 'font-monospace text-body-secondary', text: item.ownerId || '—' })),
      el('td', { text: item.category }),
      el('td', { class: 'text-end', text: formatPrice(item.price) }),
      el('td', {}, badge(item.status)),
      el('td', { class: 'small text-nowrap', text: formatDate(item.createdAt, false) }),
      el('td', { class: 'text-end' }, el('button', {
        class: `btn btn-sm ${active ? 'btn-outline-danger' : 'btn-outline-success'}`, type: 'button',
        text: active ? 'Remove' : 'Restore',
        onClick: () => setStatus(item, active ? 'removed' : 'active'),
      })),
    ]);
  }

  async function setStatus(item, status) {
    const removing = status === 'removed';
    const ok = await confirmDialog({
      title: removing ? 'Remove listing?' : 'Restore listing?',
      body: removing
        ? `“${item.title}” will be hidden from the public.`
        : `“${item.title}” will be visible to the public again.`,
      confirmText: removing ? 'Remove' : 'Restore',
      danger: removing,
    });
    if (!ok) return;
    clearAlert(alertBox);
    try {
      await api.patch(`/admin/listings/${encodeURIComponent(item.id)}/status`, { status });
      showAlert(alertBox, removing ? 'Listing removed.' : 'Listing restored.', 'success');
      load();
    } catch (err) {
      showError(alertBox, err);
    }
  }
}
