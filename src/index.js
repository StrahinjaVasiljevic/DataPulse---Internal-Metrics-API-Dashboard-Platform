require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.options('*', cors());
app.use(express.json());

// Core API (stari auth helper interno)
app.use('/api', require('./api/routes'));

// Novi routeri
app.use('/api/alerts',     require('./routes/alerts'));
app.use('/api/contracts',  require('./routes/contracts'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/usage',      require('./routes/usage'));
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/audit',      require('./routes/audit'));

app.get('/', (req, res) => {
  res.json({
    status: 'DataPulse API is running',
    version: '2.0.0',
    endpoints: {
      ingest:     'POST   /api/metrics',
      retrieve:   'GET    /api/metrics/:name',
      history:    'GET    /api/metrics/:name/history',
      dashboard:  'GET    /api/dashboard/:workspaceId',
      health:     'GET    /api/health',
      alerts:     'GET    /api/alerts/:workspaceId',
      contracts:  'GET    /api/contracts/:workspaceId',
      users:      'GET    /api/users/:workspaceId',
      audit:      'GET    /api/audit/:workspaceId',
      onboarding: 'POST   /api/onboarding/init',
      usage:      'GET    /api/usage/:workspaceId/health',
      auth:       'POST   /api/auth/magic-link',
    },
  });
});

app.get('/api/health', (req, res) => {
  const db = require('./db/client');
  res.json({
    status: 'ok',
    database: db.isConnected() ? 'postgres' : 'memory',
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DataPulse API running on port ${PORT}`);
});
