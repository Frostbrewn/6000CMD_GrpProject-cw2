// Login. Contract §5.2: POST /api/auth/login
import { api } from '../api.js';
import {
  initPage, $, qs, showAlert, clearAlert, showError, clearFieldErrors, applyFieldErrors,
  readForm, setBusy, safeNextPath, homeFor,
} from '../ui.js';
import { validateEmail } from '../validation.js';

const ctx = await initPage({ auth: 'guest' });
if (ctx) {
  const alertBox = $('#alert');
  const form = $('#login-form');

  // Fixed messages only: text from the URL is never displayed (avoids content injection).
  if (qs('registered')) showAlert(alertBox, 'Account created. You can now log in.', 'success');
  else if (qs('loggedOut')) showAlert(alertBox, 'You have been logged out.', 'info');
  else if (qs('reason') === 'session') showAlert(alertBox, 'Your session has ended. Please log in again.', 'warning');
  else if (qs('reason') === 'auth') showAlert(alertBox, 'Please log in to continue.', 'info');

  form.elements.email.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);
    clearFieldErrors(form);
    const { email, password } = readForm(form);
    const errors = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password) errors.password = 'Password is required.';
    if (Object.keys(errors).length) { applyFieldErrors(form, errors); return; }

    const button = form.querySelector('[type=submit]');
    setBusy(button, true, 'Logging in…');
    try {
      const body = await api.post('/auth/login', { email, password }, { redirectOn401: false });
      api.resetCsrf(); // session regenerated on login, so the old CSRF token is no longer valid
      const user = body?.data?.user;
      location.replace(safeNextPath(qs('next'), homeFor(user)));
    } catch (err) {
      // The backend returns one generic message for wrong email or wrong password (§5.2),
      // and 429 when rate-limited. Shown as-is.
      showError(alertBox, err);
      setBusy(button, false);
    } finally {
      form.elements.password.value = '';
    }
  });
}
