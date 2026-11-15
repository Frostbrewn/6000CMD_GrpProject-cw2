
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const crypto = require('node:crypto');

const User = require('../models/User');

const router = express.Router();

// Return the currently authenticated user.
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user || user.status !== 'active') {
      return req.session.destroy((err) => {
        if (err) return next(err);

        res.clearCookie('securemarket.sid', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });

        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required.'
          }
        });
      });
    }

    return res.status(200).json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

const NAME_RE = /^[\p{L}\p{M}' .-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789012',
  'qwertyuiop', 'qwerty123456', 'iloveyou1234',
  'administrator', 'welcome12345', 'letmein12345',
  'abc123456789', 'passwordpassword', '111111111111',
  'football1234', 'monkey123456', 'sunshine1234',
  'changeme123456', 'adminadmin123', 'password123456',
  'iloveyouiloveyou', 'trustno1trustno1', 'welcomehome123'
]);

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  crypto.randomBytes(32).toString('hex'),
  12
);

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many registration attempts. Please try again later.'
      }
    });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.'
      }
    });
  }
});

// Authenticate a member or administrator.
router.post('/login', loginLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};

  const normalizedEmail = typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';

  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !EMAIL_RE.test(normalizedEmail) ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please enter a valid email address and password.'
      }
    });
  }

  try {
    const user = await User.findOne({
      email: normalizedEmail
    }).select('+passwordHash');

    const hashToCheck = user
      ? user.passwordHash
      : DUMMY_PASSWORD_HASH;

    const passwordMatches = !bcrypt.truncates(password) &&
      await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatches || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.'
        }
      });
    }

    // Replace the existing session after successful authentication.
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.session.userId = user.id;

    // Save the new session before responding to the browser.
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/register', registrationLimiter, async (req, res, next) => {
  const { name, email, password } = req.body || {};

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';

  const errors = [];

  if (!normalizedName) {
    errors.push({ field: 'name', message: 'Name is required.' });
  } else if (
    normalizedName.length > 80 ||
    !NAME_RE.test(normalizedName)
  ) {
    errors.push({
      field: 'name',
      message: 'Enter a valid name of no more than 80 characters.'
    });
  }

  if (!normalizedEmail) {
    errors.push({ field: 'email', message: 'Email is required.' });
  } else if (
    normalizedEmail.length > 254 ||
    !EMAIL_RE.test(normalizedEmail)
  ) {
    errors.push({
      field: 'email',
      message: 'Enter a valid email address.'
    });
  }

  if (typeof password !== 'string' || password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else {
    if (password.length < 12) {
      errors.push({
        field: 'password',
        message: 'Use at least 12 characters.'
      });
    }

    if (bcrypt.truncates(password)) {
      errors.push({
        field: 'password',
        message: 'Password must not exceed 72 UTF-8 bytes.'
      });
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push({
        field: 'password',
        message: 'This password is too common. Choose something less predictable.'
      });
    }

    const emailName = normalizedEmail.split('@')[0];

    if (
      emailName.length >= 3 &&
      password.toLowerCase().includes(emailName)
    ) {
      errors.push({
        field: 'password',
        message: 'Do not include your email name in your password.'
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields.',
        fields: errors
      }
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      role: 'member',
      status: 'active'
    });

    return res.status(201).json({
      data: {
        message: 'Account registered successfully.'
      }
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email address already exists.'
        }
      });
    }

    return next(err);
  }
});

module.exports = router;
