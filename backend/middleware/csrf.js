
'use strict';

const { csrfSync } = require('csrf-sync');

const {
  csrfSynchronisedProtection,
  generateToken
} = csrfSync({
  errorConfig: {
    statusCode: 403,
    message: 'Invalid or missing CSRF token.',
    code: 'CSRF_INVALID'
  }
});

module.exports = {
  csrfSynchronisedProtection,
  generateToken
};
