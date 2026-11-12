// Browse active listings (public). Contract §6: GET /api/listings
import { api, toQuery } from '../api.js';
import { initPage, el, $, qs, showError, formatPrice, truncate, renderPagination } from '../ui.js';
import { CATEGORIES, LIMITS } from '../validation.js';

const PAGE_SIZE = 12;

const ctx = await initPage({ auth: 'optional' });
if (ctx) {
  const select = $('#category');
  CATEGORIES.forEach((c) => select.append(el('option', { value: c, text: c })));

  // Sanity-check URL parameters before using them.
  const q = (qs('q') || '').trim().slice(0, LIMITS.searchMax);
  const category = CATEGORIES.includes(qs('category')) ? qs('category') : '';
  const n = Number.parseInt(qs('page'), 10);
  const page = Number.isInteger(n) && n > 0 && n <= 1000 ? n : 1;
  $('#q').value = q;
  select.value = category;

  load();

  async function load() {
    const results = $('#results');
    results.replaceChildren(el('p', { class: 'text-body-secondary', text: 'Loading…' }));
    try {
      // q and category are proposed additions to the contract (see FRONTEND_NOTES.md),
      // so they are only sent when the user actually uses them.
      const body = await api.get(`/listings${toQuery({ page, limit: PAGE_SIZE, q, category })}`, { redirectOn401: false });
      render(body.data || [], body.pagination);
    } catch (err) {
      results.replaceChildren();
      showError($('#alert'), err, 'Listings could not be loaded. Please try again.');
    }
  }

  function render(items, pagination) {
    const total = pagination?.total ?? items.length;
    $('#result-summary').textContent = total
      ? `${total} listing${total === 1 ? '' : 's'}${q ? ` matching “${q}”` : ''}${category ? ` in ${category}` : ''}.`
      : '';
    $('#results').replaceChildren(...(items.length
      ? items.map(card)
      : [el('div', { class: 'col-12' }, el('div', { class: 'alert alert-light border', text: 'No listings match your search.' }))]));
    renderPagination($('#pagination'), pagination, (p) => {
      const url = new URL(location.href);
      url.searchParams.set('page', String(p));
      location.assign(url.pathname + url.search);
    });
  }

  function card(item) {
    const href = `/listing.html?id=${encodeURIComponent(item.id)}`;
    return el('div', { class: 'col-sm-6 col-lg-4 col-xl-3' },
      el('div', { class: 'card h-100 listing-card position-relative' }, [
        el('div', { class: 'card-body d-flex flex-column' }, [
          el('span', { class: 'badge text-bg-light border align-self-start mb-2', text: item.category }),
          el('h2', { class: 'card-title h6' }, el('a', { href, text: item.title })),
          el('p', { class: 'card-text small text-body-secondary flex-grow-1', text: truncate(item.description, 110) }),
          el('span', { class: 'fw-semibold', text: formatPrice(item.price) }),
        ]),
      ]));
  }
}
