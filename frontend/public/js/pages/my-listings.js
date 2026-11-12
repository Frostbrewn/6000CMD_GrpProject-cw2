// Member dashboard: own listings. Contract §6:
//   GET /api/my/listings · POST /api/listings · PATCH /api/listings/:id · DELETE /api/listings/:id
import { api, toQuery } from '../api.js';
import {
  initPage, el, $, showAlert, clearAlert, showError, clearFieldErrors, applyFieldErrors,
  handleFormError, readForm, setBusy, badge, formatPrice, formatDate, emptyRow, loadingRow,
  renderPagination, confirmDialog,
} from '../ui.js';
import { CATEGORIES, validateListing } from '../validation.js';

const PAGE_SIZE = 10;
const COLS = 6;

const ctx = await initPage({ auth: 'required', roles: ['member', 'admin'] });
if (ctx) {
  const { user } = ctx;
  const alertBox = $('#alert');
  const form = $('#listing-form');
  const formAlert = $('#form-alert');
  const modal = new window.bootstrap.Modal($('#listing-modal'));
  const categorySelect = $('#l-category');
  CATEGORIES.forEach((c) => categorySelect.append(el('option', { value: c, text: c })));

  $('#welcome').textContent = `Signed in as ${user.name}`;
  let page = 1;
  let editing = null; // listing being edited, or null when creating

  const descCount = () => { $('#desc-count').textContent = String(form.elements.description.value.length); };
  form.elements.description.addEventListener('input', descCount);

  load();

  async function load() {
    const rows = $('#rows');
    rows.replaceChildren(loadingRow(COLS));
    try {
      const body = await api.get(`/my/listings${toQuery({ page, limit: PAGE_SIZE })}`);
      const items = body.data || [];
      rows.replaceChildren(...(items.length ? items.map(row) : [emptyRow(COLS, 'You have no listings yet. Create one to get started.')]));
      renderPagination($('#pagination'), body.pagination, (p) => { page = p; load(); });
    } catch (err) {
      rows.replaceChildren();
      showError(alertBox, err, 'Your listings could not be loaded.');
    }
  }

  function row(item) {
    const active = item.status === 'active';
    return el('tr', {}, [
      el('td', {}, active
        ? el('a', { href: `/listing.html?id=${encodeURIComponent(item.id)}`, text: item.title })
        : el('span', { text: item.title })),
      el('td', { text: item.category }),
      el('td', { class: 'text-end', text: formatPrice(item.price) }),
      el('td', {}, badge(item.status)),
      el('td', { class: 'small text-nowrap', text: formatDate(item.updatedAt || item.createdAt) }),
      el('td', { class: 'text-end text-nowrap' }, active ? [
        el('button', { class: 'btn btn-sm btn-outline-primary me-1', type: 'button', text: 'Edit', onClick: () => openForm(item) }),
        el('button', { class: 'btn btn-sm btn-outline-danger', type: 'button', text: 'Remove', onClick: () => remove(item) }),
      ] : null),
    ]);
  }

  function openForm(item = null) {
    editing = item;
    form.reset();
    clearFieldErrors(form);
    clearAlert(formAlert);
    $('#listing-modal-title').textContent = item ? 'Edit listing' : 'New listing';
    if (item) {
      form.elements.title.value = item.title;
      form.elements.category.value = CATEGORIES.includes(item.category) ? item.category : '';
      form.elements.price.value = String(item.price);
      form.elements.description.value = item.description;
    }
    descCount();
    modal.show();
  }

  $('#new-listing').addEventListener('click', () => openForm());
  $('#listing-modal').addEventListener('shown.bs.modal', () => form.elements.title.focus());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(formAlert);
    clearFieldErrors(form);
    const { errors, value } = validateListing(readForm(form));
    if (Object.keys(errors).length) { applyFieldErrors(form, errors); return; }

    // Only content fields are sent. ownerId, status and timestamps are set by the backend (§6.1).
    const button = $('#listing-submit');
    setBusy(button, true, 'Saving…');
    try {
      if (editing) await api.patch(`/listings/${encodeURIComponent(editing.id)}`, value);
      else await api.post('/listings', value);
      modal.hide();
      showAlert(alertBox, editing ? 'Listing updated.' : 'Listing created.', 'success');
      if (!editing) page = 1;
      load();
    } catch (err) {
      handleFormError(form, formAlert, err);
    } finally {
      setBusy(button, false);
    }
  });

  async function remove(item) {
    const ok = await confirmDialog({
      title: 'Remove listing?',
      body: `“${item.title}” will be hidden from the public. Only an administrator can restore it.`,
      confirmText: 'Remove', danger: true,
    });
    if (!ok) return;
    clearAlert(alertBox);
    try {
      await api.del(`/listings/${encodeURIComponent(item.id)}`);
      showAlert(alertBox, 'Listing removed.', 'success');
      load();
    } catch (err) {
      showError(alertBox, err);
    }
  }
}
