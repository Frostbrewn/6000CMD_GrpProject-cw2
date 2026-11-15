// Registration. Contract §5.1: POST /api/auth/register { name, email, password }
import { api } from '../api.js';
import {
  initPage, $, clearAlert, clearFieldErrors, applyFieldErrors, handleFormError, readForm, setBusy,
} from '../ui.js';
import { validateName, validateEmail, validatePassword } from '../validation.js';
import { attachPasswordMeter } from '../password-meter.js';

const ctx = await initPage({ auth: 'guest' });
if (ctx) {
  const form = $('#register-form');
  const alertBox = $('#alert');

  const refreshMeter = attachPasswordMeter({
    input: form.elements.password,
    meter: $('#pw-meter'),
    label: $('#pw-label'),
    rules: $('#pw-help'),
    getEmail: () => form.elements.email.value.trim(),
  });
  form.elements.email.addEventListener('input', refreshMeter);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);
    clearFieldErrors(form);
    const d = readForm(form);

    const errors = {};
    const checks = {
      name: validateName(d.name),
      email: validateEmail(d.email),
      password: validatePassword(d.password, { email: d.email }),
    };
    for (const [k, v] of Object.entries(checks)) if (v) errors[k] = v;
    if (!d.confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (d.password !== d.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (!d.consent) errors.consent = 'Please confirm you have read the privacy notice.';
    if (Object.keys(errors).length) { applyFieldErrors(form, errors); return; }

    const button = form.querySelector('[type=submit]');
    setBusy(button, true, 'Creating account…');
    try {
      // Only the contract's fields are sent. A role is never sent: the backend assigns "member".
      await api.post('/auth/register', { name: d.name, email: d.email, password: d.password }, { redirectOn401: false });
      location.replace('/login.html?registered=1');
    } catch (err) {
      form.elements.password.value = '';
      form.elements.confirmPassword.value = '';
      refreshMeter();
      handleFormError(form, alertBox, err); // 409 = email already registered (§9.1)
      setBusy(button, false);
    }
  });
}
