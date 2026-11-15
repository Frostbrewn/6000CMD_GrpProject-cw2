# Frontend — integration notes (Developer B)

Built against **API_CONTRACT.md v1.0 (Proposed)** and the agreed **PROJECT_BRIEF.md**.
The frontend uses no endpoints outside the contract. Assumptions and proposed additions are listed in §4 for Developer A to confirm.

Status: **implemented and tested against a mock backend that follows the contract. Not yet integrated with the real backend.**

---

## 1. Structure

```
frontend/public/
  index.html            Browse active listings (Visitor)            GET  /api/listings
  listing.html          One listing (Visitor)                       GET  /api/listings/:id
  register.html         Registration (Visitor)                      POST /api/auth/register
  login.html            Login (Visitor)                             POST /api/auth/login
  my-listings.html      Member dashboard: own listings + CRUD       GET  /api/my/listings, POST/PATCH/DELETE /api/listings
  admin-dashboard.html  Analytics tiles + audit log (Admin)         GET  /api/admin/analytics/summary, /api/admin/audit-logs
  admin-users.html      Enable/disable members (Admin)              GET  /api/admin/users, PATCH /api/admin/users/:id/status
  admin-listings.html   All listings, remove/restore (Admin)        GET  /api/admin/listings, PATCH /api/admin/listings/:id/status
  privacy.html          Privacy notice (PDPA 2010)                  —
  security-tips.html    User security education                     —
  css/app.css
  js/api.js             Fetch wrapper: cookie session, CSRF header, contract envelope, errors
  js/ui.js              Safe DOM builder, alerts, nav, page guard, pagination, confirm dialog
  js/validation.js      Client-side rules (mirror of server limits)
  js/password-meter.js  Password strength meter
  js/pages/*.js         One ES module per page
```

All pages call `GET /api/auth/me` (with `GET /api/csrf-token` before any state-changing request) and `POST /api/auth/logout`.

## 2. Wiring into Express (Developer A)

The frontend expects to be served **from the same origin** as `/api` (contract §2), with Bootstrap at `/vendor/bootstrap/`:

```bash
npm install bootstrap@5.3
```

```js
const path = require('path');
// Bootstrap served locally (no CDN), so the CSP can stay 'self'-only.
app.use('/vendor/bootstrap', express.static(path.join(__dirname, '..', 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
// ...then the /api routes
```

Adjust the paths to the backend folder layout. The frontend references `/vendor/bootstrap/css/bootstrap.min.css` and `/vendor/bootstrap/js/bootstrap.bundle.min.js`.

**Recommended Content Security Policy (helmet).** The frontend contains **no inline scripts, inline event handlers or `style=` attributes**, so a strict policy works:

```js
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],   // Bootstrap's CSS uses data: SVG icons
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
```

The pages were tested under exactly this policy (minus `upgrade-insecure-requests`, since the test ran on plain HTTP) with zero violations.

## 3. Frontend security controls (for the report and the viva)

| Control | Where | Threat addressed |
|---|---|---|
| All API data rendered with `textContent` / `createElement`, never `innerHTML` | `ui.js` `el()`; every page | Stored/reflected XSS (OWASP A03 Injection) |
| `javascript:` / `vbscript:` URLs refused in `href`/`src` | `ui.js` `el()` | XSS via links |
| No inline JS/CSS, so CSP `script-src 'self'` and `style-src 'self'` are enforceable | all HTML | XSS defence in depth |
| CSRF token sent as `X-CSRF-Token` on every non-GET request; token refreshed after login/logout; one retry on CSRF failure | `api.js` | CSRF |
| `credentials: 'same-origin'`; no tokens stored in `localStorage` or JS-readable cookies | `api.js` | Session theft via XSS |
| Post-login `next` redirect restricted to same-origin relative paths | `ui.js` `safeNextPath()` | Open redirect / phishing |
| Login notices are fixed strings chosen by a flag, never text echoed from the URL | `login.js` | Content injection |
| MongoDB IDs validated (`/^[a-f0-9]{24}$/`) before use; all path segments `encodeURIComponent`-ed | `listing.js`, admin pages | Path manipulation, malformed input |
| Only contract fields sent; `role`, `ownerId`, `status` never sent from forms | `register.js`, `my-listings.js` | Mass assignment / privilege escalation |
| Client validation mirrors server limits (usability only; server is authoritative) | `validation.js` | Input validation (R2) |
| Password policy guidance: 12+ chars, common-password check, strength meter (NIST SP 800-63B style) | `register.html`, `password-meter.js` | Weak passwords |
| Password fields cleared after every attempt; correct `autocomplete` values for password managers | `login.js`, `register.js` | Credential exposure; encourages password managers |
| Generic, user-friendly errors; the UI shows only the server's safe message | `ui.js` `showError()` | Information disclosure (R2) |
| UI hides admin navigation and pages for members, **but** every rule is enforced by the API | `ui.js` `initPage()` | (Explicitly *not* a security control; see contract §3) |
| Privacy notice + security tips pages; consent checkbox at registration | `privacy.html`, `security-tips.html` | Data protection & user education (R4) |
| Confirmation dialogs for destructive and admin actions; admins cannot act on their own account | admin pages | Accidental misuse |
| `<meta name="referrer" content="strict-origin-when-cross-origin">` | all HTML | Leaking URLs to other sites |

**Tested (mock backend, headless Chromium, strict CSP):**

- Browse, pagination and search
- An XSS payload (`<img src=x onerror=…>`, `<script>`) stored in a listing renders as plain text, and no script ran
- A malformed listing ID is rejected
- Protected page → login → back to the original page
- Login validation and a generic wrong-password message
- Create, edit and remove a listing, including client validation and a generic 500 message
- A member opening an admin page sees "Access denied"
- Logout, then registration with policy checks and a 409 for a duplicate email
- Admin: `?next=//evil.example` is rejected; dashboard, disable a member, restore a listing
- Mobile navigation

The run produced no CSP violations or script errors.

## 4. Assumptions and questions for Developer A (please confirm or correct)

Contract gaps the frontend had to assume:

1. **CSRF token body:** `GET /api/csrf-token` → `{ "data": { "csrfToken": "…" } }`.
2. **CSRF failure code:** 403 with `error.code` of `CSRF_INVALID` (`api.js` also accepts `INVALID_CSRF_TOKEN` and `EBADCSRFTOKEN`). Tell me which one you use and I'll delete the others.
3. **Identifiers:** every object exposes `id` (string), not `_id`.
4. **Single listing:** `GET /api/listings/:id` → `{ "data": { id, title, description, category, price, ownerId, status, createdAt, updatedAt } }`. `ownerId` is used to show "This is your listing".
5. **Admin users:** `{ id, name, email, role, status, createdAt }`. Never the password hash.
6. **Audit log record names:** `timestamp, actorId, actorRole, action, targetType, targetId, outcome`, with `outcome` values `success` / `failure` (and `denied` for authorization failures). These are rendered in `admin-dashboard.js` `row()`.
7. **Sort order:** all lists newest first (`createdAt` / `timestamp` descending).
8. **Page size:** the frontend requests `limit` of 10, 12, 20 or 50. Suggest the backend caps `limit` at 50.
9. **Roles:** `/auth/me` returns `role` as `"member"` or `"admin"`.

Proposed small additions (the UI already handles them; nothing breaks without them):

10. **Search/filter on `GET /api/listings`:** optional `q` (keyword, max 100 chars, matched as a literal string, never as a regex or operator) and `category` (from the category list). These are only sent when the user searches. If the backend rejects unknown query parameters, either add these two or tell me and I'll hide the search bar.
11. **Field-level validation errors:** optional `error.fields: [{ field, message }]`. The UI highlights the matching inputs.
12. **Shared limits:** name max 80; password 12–128; price at most 2 decimals and ≤ 1,000,000 (the contract only says finite and non-negative). The frontend is never *looser* than the backend, but if the backend is stricter, users get server-side errors the UI didn't warn about.
13. **Consent record (PDPA):** registration has a "read the privacy notice" checkbox. It is client-side only, because the contract body is `{ name, email, password }`. Optionally, the backend could store `privacyNoticeAcceptedAt` as evidence for the report.
14. **Owner display name:** optional `ownerName` on admin listing rows, for readability. The owner ID is shown if it's absent.
15. **Analytics:** the dashboard shows the five §8.1 counters as tiles. A time series (for example `loginFailuresByDay`) would let the dashboard show a trend chart, which better evidences R5 "analytics". It's optional.

## 5. Running locally

Once wired into Express, browse to `https://localhost:<port>/`. No build step is needed: the pages are plain HTML and ES modules.
