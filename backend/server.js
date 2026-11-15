
'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const helmet = require('helmet');
const User = require('./models/User');
const Listing = require('./models/Listing');

const {
  csrfSynchronisedProtection,
  generateToken
} = require('./middleware/csrf');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

if (!MONGODB_URI || !SESSION_SECRET) {
  throw new Error('Missing required environment configuration.');
}

if (isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// HTTP security headers and Content Security Policy
app.use(helmet({
  strictTransportSecurity: isProduction
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,

  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));

// Restrict incoming request body sizes.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Serve the Bootstrap distribution installed through npm
app.use(
  '/vendor/bootstrap',
  express.static(path.join(__dirname, '../node_modules/bootstrap/dist'))
);

// Serve the submitted frontend.
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Health endpoint for checking the backend.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok'
    }
  });
});

// Session middleware is configured after MongoDB connects
async function startServer() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  console.log('MongoDB connection established.');

  await User.init();
  console.log('User indexes initialised.');

  await Listing.init();
  console.log('Listing indexes initialised.');

  app.use(session({
    name: 'securemarket.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: 'sessions',
      ttl: 2 * 60 * 60
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    }
  }));

  // Issue a CSRF token for the current session.
  app.get('/api/csrf-token', (req, res) => {
    const csrfToken = generateToken(req);

    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      data: { csrfToken }
    });
  });

  // Protect state-changing API requests
  app.use('/api', csrfSynchronisedProtection);

  // Authentication endpoints
  app.use('/api/auth', require('./routes/auth'));

  // Listing endpoints
  app.use('/api', require('./routes/listings'));

  // Return safe responses for unknown API routes
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API endpoint was not found.'
      }
    });
  });

  // Handle requests for missing frontend resources
  app.use((req, res) => {
    res.status(404).send('Page not found.');
  });

  // Central error handler
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err.code === 'CSRF_INVALID') {
      return res.status(403).json({
        error: {
          code: 'CSRF_INVALID',
          message: 'Invalid or missing CSRF token.'
        }
      });
    }

    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'The request contains invalid JSON.'
        }
      });
    }

    console.error('Unhandled request error:', err.message);

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`SecureMarket running at http://localhost:${PORT}`);
  });
}


startServer().catch((err) => {
  console.error('Server startup failed:', err.message);
  process.exit(1);
});
