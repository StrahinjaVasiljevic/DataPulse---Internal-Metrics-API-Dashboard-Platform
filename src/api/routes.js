const express = require('express');
const router = express.Router();
const { ingestMetric } = require('../ingestion/ingest');
const { normalizeMetric } = require('../normalization/normalize');
const { checkAlerts } = require('../alerts/engine');
const { getMetric, getHistory, getDashboard } = require('../db/queries');

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  if (key !== process.env.API_KEY && key !== 'dev_key')
    return res.status(403).json({ error: 'Invalid API key' });
  req.workspaceId = key === 'dev_key' ? 'dev_workspace' : 'production_workspace';
  next();
}

router.post('/metrics', auth, async (req, res) => {
  try {
    const normalized = normalizeMetric(req.body);
    const result = await ingestMetric(normalized, req.workspaceId);
    await checkAlerts(normalized, req.workspaceId);
    res.status(201).json({ ok: true, metric: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/metrics/:name', auth, async (req, res) => {
  try {
    const metric = await getMetric(req.params.name, req.workspaceId);
    if (!metric) return res.status(404).json({ error: 'Metric not found' });
    res.json(metric);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/metrics/:name/history', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await getHistory(req.params.name, req.workspaceId, days);
    res.json({ metric: req.params.name, days, data: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/:workspaceId', async (req, res) => {
  try {
    const data = await getDashboard(req.params.workspaceId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

