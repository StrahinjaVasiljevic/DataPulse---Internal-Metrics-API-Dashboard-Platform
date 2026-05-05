const path = require('path');
const fetch = require('node-fetch');

const { MetricSubmissionsRepo } = require('./repositories/metricSubmissionsRepo');
const { makeRouter: makeUiMetricSubmissionsRouter } = require('./routes/uiMetricSubmissions');
const fetch = require('node-fetch');
``
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();
const startTime = Date.now();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization', 'X-Idempotency-Key'],
}));

app.options('*', cors());
app.use(express.json() 
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.set('trust proxy', 1););

// Request logging middleware
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method:  req.method,
      path:    req.path,
      status:  res.statusCode,
      ms:      Date.now() - t,
      ws:      req.workspace_id || null,
    });
  });
  next();
});

// Routes
app.use('/api',             require('./api/routes'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/contracts',   require('./routes/contracts'));
app.use('/api/onboarding',  require('./routes/onboarding'));
app.use('/api/usage',       require('./routes/usage'));
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/audit',       require('./routes/audit'));
app.use('/api/billing',     require('./routes/billing'));
const submissionsRepo = new MetricSubmissionsRepo();

app.use(
  '/ui/metric-submissions',
  makeUiMetricSubmissionsRouter({
    repo: submissionsRepo,
    forwardToIngestion,
  })
);
// Root
app.get('/', (req, res) => {
  res.json({
    name:    'DataPulse API',
    version: '2.0.0',
    status:  'running',
    docs:    'https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform',
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
      billing:    'GET    /api/billing/:workspaceId',
    },
  });
});

// Health endpoint — proširen
app.get('/api/health', (req, res) => {
  const db = require('./db/client');
  const dbStatus = db.getStatus();

  res.json({
    status:       'ok',
    version:      '2.0.0',
    uptime_ms:    Date.now() - startTime,
    uptime_human: _formatUptime(Date.now() - startTime),
    database:     dbStatus,
    memory_mb:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    node_version: process.version,
    timestamp:    new Date().toISOString(),
  });
});
async function forwardToIngestion(req, submission) {
  const apiKey = process.env.INTERNAL_API_KEY || process.env.API_KEY;
  if (!apiKey) return { ok: false, error: 'Missing API key' };

  const base =
    process.env.INTERNAL_API_BASE ||
    `${req.protocol}://${req.get('host')}`;

  const r = await fetch(`${base}/api/metrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      name: submission.name,
      value: submission.value,
      source: submission.source,
      timestamp: submission.timestamp,
    }),
  });

  if (!r.ok) {
    return { ok: false, status: r.status };
  }

  return { ok: true };
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error:  err.message,
    path:   req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

function _formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info('DataPulse API started', { port: PORT, node: process.version });
});
