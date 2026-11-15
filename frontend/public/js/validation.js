// Client-side validation for registration and listing forms.
// The server repeats these checks and remains authoritative.

export const LIMITS = {
  nameMax: 80,
  emailMax: 254,
  passwordMin: 12,
  passwordMaxBytes: 72,
  titleMax: 80,          // contract 6.1
  descriptionMax: 1000,  // contract 6.1
  priceMax: 1000000,     // Enforce the same limit on the server.
  searchMax: 100,
};

// Contract 6.1 "Initial accepted categories".
export const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Books', 'Other'];

// Small client-side denylist. Apply a larger check on the server.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop', 'qwerty123456',
  'iloveyou1234', 'administrator', 'welcome12345', 'letmein12345', 'abc123456789',
  'passwordpassword', '111111111111', 'football1234', 'monkey123456', 'sunshine1234',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}' .-]+$/u;
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export function validateEmail(email) {
  if (!email) return 'Email is required.';
  if (email.length > LIMITS.emailMax || !EMAIL_RE.test(email)) return 'Enter a valid email address.';
  return null;
}

export function validateName(name) {
  if (!name) return 'Name is required.';
  if (name.length > LIMITS.nameMax) return `Name must be at most ${LIMITS.nameMax} characters.`;
  if (!NAME_RE.test(name)) return 'Name can contain letters, spaces, apostrophes, dots and hyphens only.';
  return null;
}

/** Unmet password rules: 'length' | 'bytes' | 'common' | 'personal'. */
export function passwordProblems(password, { email = '' } = {}) {
  const problems = [];
  if (password.length < LIMITS.passwordMin) problems.push('length');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push('common');
  if (new TextEncoder().encode(password).length > LIMITS.passwordMaxBytes) {
    problems.push('bytes');
  }
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 3 && password.toLowerCase().includes(local)) problems.push('personal');
  return problems;
}

export function validatePassword(password, ctx) {
  if (!password) return 'Password is required.';
  const p = passwordProblems(password, ctx);
  if (p.includes('bytes')) return `Password must not exceed ${LIMITS.passwordMaxBytes} UTF-8 bytes.`;
  if (p.includes('length')) return `Use at least ${LIMITS.passwordMin} characters.`;
  if (p.includes('common')) return 'This password is too common. Choose something less predictable.';
  if (p.includes('personal')) return 'Do not include your email name in your password.';
  return null;
}

// Heuristic score used by the registration password meter.
export function passwordStrength(password) {
  if (
    !password ||
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    new TextEncoder().encode(password).length > LIMITS.passwordMaxBytes
  ) {
    return 0;
  }
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes >= 3) score++;
  if (password.length >= 20 || (password.length >= 14 && classes === 4)) score++;
  return Math.min(score, 4);
}

/**
 * Validates listing form input (strings from the form).
 * Returns { errors: { field: message }, value: { title, description, category, price } }.
 */
export function validateListing(input) {
  const errors = {};
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) errors.title = 'Title is required.';
  else if (title.length > LIMITS.titleMax) errors.title = `Title must be at most ${LIMITS.titleMax} characters.`;

  if (!description) errors.description = 'Description is required.';
  else if (description.length > LIMITS.descriptionMax) errors.description = `Description must be at most ${LIMITS.descriptionMax} characters.`;

  if (!CATEGORIES.includes(input.category)) errors.category = 'Choose a category.';

  let price = null;
  if (!PRICE_RE.test(input.price.trim())) errors.price = 'Enter a price such as 1200 or 49.90.';
  else {
    price = Number(input.price);
    if (!Number.isFinite(price) || price < 0 || price > LIMITS.priceMax) {
      errors.price = `Price must be between RM 0 and RM ${LIMITS.priceMax.toLocaleString('en-MY')}.`;
    }
  }
  return { errors, value: { title, description, category: input.category, price } };
}
