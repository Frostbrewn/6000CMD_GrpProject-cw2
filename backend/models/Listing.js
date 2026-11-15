
'use strict';

const mongoose = require('mongoose');

const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home',
  'Books',
  'Other'
];

const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required.'],
    trim: true,
    maxLength: [80, 'Title must not exceed 80 characters.']
  },

  description: {
    type: String,
    required: [true, 'Description is required.'],
    trim: true,
    maxLength: [1000, 'Description must not exceed 1000 characters.']
  },

  category: {
    type: String,
    required: [true, 'Category is required.'],
    enum: CATEGORIES
  },

  price: {
    type: Number,
    required: [true, 'Price is required.'],
    min: [0, 'Price cannot be negative.'],
    max: [1000000, 'Price cannot exceed RM 1,000,000.'],
    validate: [
      {
        validator: Number.isFinite,
        message: 'Price must be a finite number.'
      },
      {
        validator: value => /^\d+(\.\d{1,2})?$/.test(String(value)),
        message: 'Price must have no more than two decimal places.'
      }
    ]
  },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },

  status: {
    type: String,
    enum: ['active', 'removed'],
    default: 'active'
  }
}, {
  timestamps: true,
  versionKey: false,

  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      ret.ownerId = ret.ownerId.toString();
      delete ret._id;
      return ret;
    }
  }
});

// Indexes for member listing retrieval and public browsing
listingSchema.index({ ownerId: 1, createdAt: -1 });
listingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Listing', listingSchema);
