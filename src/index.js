require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// CORS — dozvoli sve origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

app.options('*', cors());
app.use(express.json());
app.use('/api', require('./api/routes'));

app.get('/', (req, res) => {
  res.json({
    status: 'DataPulse API is running',
    version: '1.0.0',
    endpoints: {
      ingest: 'POST /api/metrics',
      retrieve: 'GET /api/metrics/:name',
      history: 'GET /api/metrics/:name/history',
      dashboard: 'GET /api/dashboard/:workspaceId',
      health: 'GET /api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DataPulse API running on port ${PORT}`);
});
