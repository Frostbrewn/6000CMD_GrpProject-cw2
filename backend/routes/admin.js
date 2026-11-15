'use strict';

const express = require('express');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

function readPageNumber(value, defaultValue, maximum) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;

  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : null;
}

function invalidId(value) {
  return !/^[a-f\d]{24}$/i.test(value);
}

router.get('/users', async (req, res, next) => {
  const page = readPageNumber(req.query.page, 1, 1000);
  const limit = readPageNumber(req.query.limit, 20, 50);

  if (page === null || limit === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid pagination parameters.' }
    });
  }

  try {
    const [users, total] = await Promise.all([
      User.find({})
        .select('name email role status createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments({})
    ]);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      data: users.map(user => ({ ...user, id: user._id.toString(), _id: undefined })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/users/:userId/status', async (req, res, next) => {
  const { userId } = req.params;
  const { status } = req.body || {};

  if (invalidId(userId) || !['active', 'disabled'].includes(status)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid user ID or account status.' }
    });
  }

  try {
    const user = await User.findOneAndUpdate(
      { _id: userId, role: 'member' },
      { $set: { status }, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after', runValidators: true }
    ).select('name email role status createdAt');

    if (!user) {
      const exists = await User.exists({ _id: userId });

      return res.status(exists ? 403 : 404).json({
        error: {
          code: exists ? 'FORBIDDEN' : 'NOT_FOUND',
          message: exists
            ? 'Administrator accounts cannot be modified here.'
            : 'User not found.'
        }
      });
    }

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ data: user });
  } catch (err) {
    return next(err);
  }
});

router.get('/listings', async (req, res, next) => {
  const page = readPageNumber(req.query.page, 1, 1000);
  const limit = readPageNumber(req.query.limit, 20, 50);

  if (page === null || limit === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid pagination parameters.' }
    });
  }

  try {
    const [listings, total] = await Promise.all([
      Listing.find({})
        .populate('ownerId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Listing.countDocuments({})
    ]);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      data: listings.map(item => ({
        id: item._id.toString(),
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price,
        ownerId: item.ownerId?._id?.toString() || null,
        ownerName: item.ownerId?.name || null,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/listings/:listingId/status', async (req, res, next) => {
  const { listingId } = req.params;
  const { status } = req.body || {};

  if (invalidId(listingId) || !['active', 'removed'].includes(status)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid listing ID or status.' }
    });
  }

  try {
    const listing = await Listing.findByIdAndUpdate(
      listingId,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    );

    if (!listing) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Listing not found.' }
      });
    }

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ data: listing });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;