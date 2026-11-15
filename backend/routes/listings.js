
'use strict';

const express = require('express');
const Listing = require('../models/Listing');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function readPageNumber(value, defaultValue, maximum) {
  if (value === undefined) return defaultValue;

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number <= maximum
    ? number
    : null;
}

router.get('/listings', async (req, res, next) => {
  const page = readPageNumber(req.query.page, 1, 1000);
  const limit = readPageNumber(req.query.limit, 12, 50);

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string'
    ? req.query.category.trim()
    : '';

  const categories = ['Electronics', 'Fashion', 'Home', 'Books', 'Other'];

  if (
    page === null ||
    limit === null ||
    (req.query.q !== undefined && typeof req.query.q !== 'string') ||
    (req.query.category !== undefined && typeof req.query.category !== 'string') ||
    q.length > 100 ||
    (category && !categories.includes(category))
  ) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid listing search or pagination parameters.'
      }
    });
  }

  try {
    const filter = { status: 'active' };

    if (category) {
      filter.category = category;
    }

    if (q) {
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchPattern = new RegExp(escapedQuery, 'i');

      filter.$or = [
        { title: searchPattern },
        { description: searchPattern }
      ];
    }

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Listing.countDocuments(filter)
    ]);

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      data: listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/listings/:listingId', async (req, res, next) => {
  const { listingId } = req.params;

  if (!/^[a-f\d]{24}$/i.test(listingId)) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Listing not found.'
      }
    });
  }

  try {
    const listing = await Listing.findOne({
      _id: listingId,
      status: 'active'
    });

    if (!listing) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found.'
        }
      });
    }

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      data: listing
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/my/listings', requireAuth, async (req, res, next) => {
  const page = readPageNumber(req.query.page, 1, 1000);
  const limit = readPageNumber(req.query.limit, 10, 50);

  if (page === null || limit === null) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid pagination parameters.'
      }
    });
  }

  try {
    const filter = { ownerId: req.user._id };

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Listing.countDocuments(filter)
    ]);

    return res.status(200).json({
      data: listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/listings', requireAuth, requireRole('member', 'admin'), async (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid listing information.'
      }
    });
  }

  const allowedFields = ['title', 'description', 'category', 'price'];
  const unexpectedFields = Object.keys(body).filter(field => !allowedFields.includes(field));

  if (unexpectedFields.length) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only title, description, category and price may be submitted.'
      }
    });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const price = body.price;

  const fields = [];
  const categories = ['Electronics', 'Fashion', 'Home', 'Books', 'Other'];

  if (!title) {
    fields.push({ field: 'title', message: 'Title is required.' });
  } else if (title.length > 80) {
    fields.push({ field: 'title', message: 'Title must not exceed 80 characters.' });
  }

  if (!description) {
    fields.push({ field: 'description', message: 'Description is required.' });
  } else if (description.length > 1000) {
    fields.push({ field: 'description', message: 'Description must not exceed 1000 characters.' });
  }

  if (!categories.includes(category)) {
    fields.push({ field: 'category', message: 'Choose a valid category.' });
  }

  if (typeof price !== 'number' || !Number.isFinite(price)) {
    fields.push({ field: 'price', message: 'Enter a valid price.' });
  } else if (price < 0 || price > 1000000) {
    fields.push({ field: 'price', message: 'Price must be between RM 0 and RM 1,000,000.' });
  } else if (Number(price.toFixed(2)) !== price) {
    fields.push({ field: 'price', message: 'Price must have no more than two decimal places.' });
  }

  if (fields.length) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted information.',
        fields
      }
    });
  }

  try {
    const listing = await Listing.create({
      title,
      description,
      category,
      price,
      ownerId: req.user._id,
      status: 'active'
    });

    res.set('Cache-Control', 'no-store');

    return res.status(201).json({
      data: listing
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const validationFields = Object.entries(err.errors).map(([field, error]) => ({
        field,
        message: error.message
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted information.',
          fields: validationFields
        }
      });
    }

    return next(err);
  }
});

router.patch('/listings/:listingId', requireAuth, async (req, res, next) => {
  const { listingId } = req.params;

  if (!/^[a-f\d]{24}$/i.test(listingId)) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Listing not found.'
      }
    });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid listing information.'
      }
    });
  }

  const allowedFields = ['title', 'description', 'category', 'price'];
  const unexpectedFields = Object.keys(body).filter(field => !allowedFields.includes(field));

  if (unexpectedFields.length) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only title, description, category and price may be updated.'
      }
    });
  }

  if (Object.keys(body).length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one listing field must be provided.'
      }
    });
  }

  const updates = {};
  const fields = [];
  const categories = ['Electronics', 'Fashion', 'Home', 'Books', 'Other'];

  if (Object.hasOwn(body, 'title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!title) {
      fields.push({ field: 'title', message: 'Title is required.' });
    } else if (title.length > 80) {
      fields.push({ field: 'title', message: 'Title must not exceed 80 characters.' });
    } else {
      updates.title = title;
    }
  }

  if (Object.hasOwn(body, 'description')) {
    const description = typeof body.description === 'string'
      ? body.description.trim()
      : '';

    if (!description) {
      fields.push({ field: 'description', message: 'Description is required.' });
    } else if (description.length > 1000) {
      fields.push({ field: 'description', message: 'Description must not exceed 1000 characters.' });
    } else {
      updates.description = description;
    }
  }

  if (Object.hasOwn(body, 'category')) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';

    if (!categories.includes(category)) {
      fields.push({ field: 'category', message: 'Choose a valid category.' });
    } else {
      updates.category = category;
    }
  }

  if (Object.hasOwn(body, 'price')) {
    const price = body.price;

    if (typeof price !== 'number' || !Number.isFinite(price)) {
      fields.push({ field: 'price', message: 'Enter a valid price.' });
    } else if (price < 0 || price > 1000000) {
      fields.push({ field: 'price', message: 'Price must be between RM 0 and RM 1,000,000.' });
    } else if (Number(price.toFixed(2)) !== price) {
      fields.push({ field: 'price', message: 'Price must have no more than two decimal places.' });
    } else {
      updates.price = price;
    }
  }

  if (fields.length) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted information.',
        fields
      }
    });
  }

  try {
    const listing = await Listing.findOneAndUpdate(
      {
        _id: listingId,
        ownerId: req.user._id,
        status: 'active'
      },
      { $set: updates },
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    if (!listing) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found.'
        }
      });
    }

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      data: listing
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const validationFields = Object.entries(err.errors).map(([field, error]) => ({
        field,
        message: error.message
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted information.',
          fields: validationFields
        }
      });
    }

    return next(err);
  }
});

router.delete('/listings/:listingId', requireAuth, async (req, res, next) => {
  const { listingId } = req.params;

  if (!/^[a-f\d]{24}$/i.test(listingId)) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Listing not found.'
      }
    });
  }

  try {
    const listing = await Listing.findOneAndUpdate(
      {
        _id: listingId,
        ownerId: req.user._id,
        status: 'active'
      },
      { $set: { status: 'removed' } },
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    if (!listing) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found.'
        }
      });
    }

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      data: listing
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
