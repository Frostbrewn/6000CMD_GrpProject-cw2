// Admin user management. Contract §7.1:
//   GET /api/admin/users · PATCH /api/admin/users/:userId/status { status: 'active' | 'disabled' }
import { api, toQuery } from '../api.js';
import {
  initPage, el, $, showAlert, clearAlert, showError, badge, formatDate, emptyRow, loadingRow,
  renderPagination, confirmDialog,
} from '../ui.js';

const PAGE_SIZE = 20;
const COLS = 6;

const ctx = await initPage({ auth: 'required', roles: ['admin'] });
if (ctx) {
  const { user: me } = ctx;
  const alertBox = $('#alert');
  let page = 1;
  load();

  async function load() {
    const rows = $('#rows');
    rows.replaceChildren(loadingRow(COLS));
    try {
      const body = await api.get(`/admin/users${toQuery({ page, limit: PAGE_SIZE })}`);
      const items = body.data || [];
      rows.replaceChildren(...(items.length ? items.map(row) : [emptyRow(COLS, 'No users found.')]));
      renderPagination($('#pagination'), body.pagination, (p) => { page = p; load(); });
    } catch (err) {
      rows.replaceChildren();
      showError(alertBox, err, 'Users could not be loaded.');
    }
  }

  function row(u) {
    const isSelf = u.id === me.id;
    // Only member accounts can be enabled/disabled (§3, §7.1). The backend enforces this too.
    let action = null;
    if (isSelf) action = el('span', { class: 'small text-body-secondary', text: 'You' });
    else if (u.role === 'member') {
      const disable = u.status !== 'disabled';
      action = el('button', {
        class: `btn btn-sm ${disable ? 'btn-outline-danger' : 'btn-outline-success'}`, type: 'button',
        text: disable ? 'Disable' : 'Enable',
        onClick: () => setStatus(u, disable ? 'disabled' : 'active'),
      });
    }
    return el('tr', {}, [
      el('td', { text: u.name }),
      el('td', { class: 'small', text: u.email }),
      el('td', {}, badge(u.role)),
      el('td', {}, badge(u.status || 'active')),
      el('td', { class: 'small text-nowrap', text: formatDate(u.createdAt, false) }),
      el('td', { class: 'text-end' }, action),
    ]);
  }

  async function setStatus(u, status) {
    const disabling = status === 'disabled';
    const ok = await confirmDialog({
      title: disabling ? 'Disable account?' : 'Enable account?',
      body: disabling
        ? `${u.name} (${u.email}) will be signed out and unable to log in until re-enabled.`
        : `${u.name} (${u.email}) will be able to log in again.`,
      confirmText: disabling ? 'Disable' : 'Enable',
      danger: disabling,
    });
    if (!ok) return;
    clearAlert(alertBox);
    try {
      await api.patch(`/admin/users/${encodeURIComponent(u.id)}/status`, { status });
      showAlert(alertBox, `Account ${disabling ? 'disabled' : 'enabled'}.`, 'success');
      load();
    } catch (err) {
      showError(alertBox, err);
    }
  }
}
