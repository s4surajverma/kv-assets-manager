require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authenticate = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ======================== GLOBAL MIDDLEWARE ========================
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ======================== HEALTH CHECK ========================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ======================== PUBLIC ROUTES ========================
app.use('/api/v1/auth', require('./routes/auth.routes'));

// ======================== PROTECTED ROUTES ========================
app.use('/api/v1/users', authenticate, require('./routes/users.routes'));
app.use('/api/v1/masters', authenticate, require('./routes/masters.routes'));
app.use('/api/v1/stock', authenticate, require('./routes/stock.routes'));
app.use('/api/v1/assets', authenticate, require('./routes/assets.routes'));
app.use('/api/v1/depreciation', authenticate, require('./routes/depreciation.routes'));
app.use('/api/v1/verifications', authenticate, require('./routes/verification.routes'));
app.use('/api/v1/condemnations', authenticate, require('./routes/condemnation.routes'));
app.use('/api/v1/sanctions', authenticate, require('./routes/sanctions.routes'));
app.use('/api/v1/disposals', authenticate, require('./routes/disposal.routes'));
app.use('/api/v1/consumables', authenticate, require('./routes/consumables.routes'));
app.use('/api/v1/financial-years', authenticate, require('./routes/financialYear.routes'));
app.use('/api/v1/reports', authenticate, require('./routes/reports.routes'));
app.use('/api/v1/audit', authenticate, require('./routes/audit.routes'));
app.use('/api/v1/vidyalayas', authenticate, require('./routes/vidyalaya.routes'));
app.use('/api/v1/transitions', authenticate, require('./routes/stock-transition.routes'));
app.use('/api/v1/onboarding', authenticate, require('./routes/onboarding.routes'));
app.use('/api/v1/non-consumables', authenticate, require('./routes/nonConsumable.routes'));

// ======================== 404 ========================
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ======================== ERROR HANDLER ========================
app.use(errorHandler);

module.exports = app;
