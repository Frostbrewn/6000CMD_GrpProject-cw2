
'use strict';

const User = require('../models/User');

function requireAuth(req, res, next) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.'
      }
    });
  }

  User.findById(userId)
    .then(user => {
      if (!user || user.status !== 'active') {
        return req.session.destroy(err => {
          if (err) return next(err);

          res.clearCookie('securemarket.sid', {
            path: '/',
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

      req.user = user;
      next();
    })
    .catch(next);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.'
        }
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
