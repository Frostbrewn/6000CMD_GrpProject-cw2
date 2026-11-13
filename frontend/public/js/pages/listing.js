// One active listing. Contract §6: GET /api/listings/:listingId
import { api, ApiError } from '../api.js';
import { initPage, el, $, qs, isObjectId, showAlert, showError, formatPrice, formatDate } from '../ui.js';

const ctx = await initPage({ auth: 'optional' });
if (ctx) {
  const { user } = ctx;
  const id = qs('id');
  const alertBox = $('#alert');
  const notFound = () => showAlert(alertBox, 'This listing could not be found. It may have been removed.', 'warning');

  // Reject malformed IDs before they reach the API.
  if (!isObjectId(id)) notFound();
  else {
    try {
      const body = await api.get(`/listings/${encodeURIComponent(id)}`, { redirectOn401: false });
      render(body.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) notFound();
      else showError(alertBox, err);
    }
  }

  function render(listing) {
    document.title = `${listing.title} · SecureMarket`;
    $('.breadcrumb-item.active').textContent = listing.title;
    const isOwner = Boolean(user && listing.ownerId === user.id);
    $('#listing').replaceChildren(
      el('div', { class: 'col-lg-8' },
        el('div', { class: 'card' }, el('div', { class: 'card-body p-4' }, [
          el('span', { class: 'badge text-bg-light border mb-2', text: listing.category }),
          el('h1', { class: 'page-title', text: listing.title }),
          el('p', { class: 'fs-4 fw-semibold mb-3', text: formatPrice(listing.price) }),
          // textContent keeps user-written descriptions as plain text (no HTML execution).
          el('p', { class: 'listing-desc', text: listing.description }),
          el('p', { class: 'small text-body-secondary mb-0', text: `Listed ${formatDate(listing.createdAt, false)}` }),
        ]))),
      el('div', { class: 'col-lg-4' },
        el('div', { class: 'card' }, el('div', { class: 'card-body small' }, isOwner
          ? [el('p', { text: 'This is your listing.' }),
            el('a', { class: 'btn btn-outline-primary btn-sm', href: '/my-listings.html', text: 'Manage my listings' })]
          : [el('p', { class: 'mb-0', text: 'Payments and messaging are not part of this demonstration system. Never send money before seeing an item.' })]))),
    );
  }
}
