'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../backend/models/User');

const NAME_RE = /^[\p{L}\p{M}' .-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789012',
  'qwertyuiop', 'qwerty123456', 'iloveyou1234',
  'administrator', 'welcome12345', 'letmein12345',
  'abc123456789', 'passwordpassword', '111111111111',
  'football1234', 'monkey123456', 'sunshine1234'
]);

async function createAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Missing administrator account details.');
  }

  if (name.length > 80 || !NAME_RE.test(name)) {
    throw new Error('Invalid administrator name.');
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new Error('Invalid administrator email address.');
  }

  const emailName = email.split('@')[0];

  if (
    password.length < 12 ||
    bcrypt.truncates(password) ||
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    (emailName.length >= 3 && password.toLowerCase().includes(emailName))
  ) {
    throw new Error('The administrator password does not meet the password policy.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await User.create({
    name,
    email,
    passwordHash,
    role: 'admin',
    status: 'active'
  });

  console.log('Administrator account created successfully.');
  console.log(`Administrator email: ${email}`);
}

createAdmin()
  .catch(err => {
    console.error('Administrator provisioning failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });