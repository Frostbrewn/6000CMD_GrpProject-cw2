
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required.'],
    trim: true,
    maxLength: [80, 'Name must not exceed 80 characters.'],
    match: [
      /^[\p{L}\p{M}' .-]+$/u,
      'Name contains unsupported characters.'
    ]
  },

  email: {
    type: String,
    required: [true, 'Email is required.'],
    trim: true,
    lowercase: true,
    maxLength: [254, 'Email must not exceed 254 characters.'],
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      'Enter a valid email address.'
    ]
  },

  passwordHash: {
    type: String,
    required: [true, 'Password hash is required.'],
    select: false
  },

  role: {
    type: String,
    enum: ['member', 'admin'],
    default: 'member'
  },

  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },

  sessionVersion: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  versionKey: false,

  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    }
  }
});

// Enforce unique email addresses at database level.
userSchema.index({ email: 1 }, { unique: true });

// Compare a submitted password against the stored hash.
userSchema.methods.comparePassword = function (candidatePassword) {
  if (
    typeof candidatePassword !== 'string' ||
    !this.passwordHash ||
    bcrypt.truncates(candidatePassword)
  ) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
