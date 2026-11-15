
'use strict';

const express = require('express');
const Listing = require('../models/Listing');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
