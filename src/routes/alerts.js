'use strict';

/**
 * /api/alerts — CRUD + preview + history + dead-letter
 *
 * GET    /api/alerts/:workspaceId              — lista alertova
 * POST   /api/alerts/:workspaceId              — kreiraj alert
 * PUT    /api/alerts/:workspaceId/:alertId     — update alert
 * DELETE /api/alerts/:workspaceId/:alertId     — obriši alert
 * POST   /api/alerts/:workspaceId/:alertId/preview  — preview (koliko bi se okinuo)
 * POST   /api/alerts/:workspaceId/:alertId/test     — test fire
 * GET    /api/alerts/:workspaceId/:alertId/history  — historija firing-a
 * GET    /api/alerts/:workspaceId/dead-letter        — failed deliveries
 */

const express = require('express');
const router = express.Router();
const AlertModel = require('../models/Alert');
const AlertHistory = require('../models/AlertHistory');
const DeadLetterLog = require('../models/DeadLetterLog');
const { previewAlert, evaluateAlert } = require('../alerts/engine');
const alertDelivery = require('../services/alertDelivery');
const { getHistory } = require('../db/queries');
const AuditLog = require('../models/AuditLog');

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  if (key !== process.env.API_KEY && key !== 'dev_key')
    return res.status(403).json({ error: 'Invalid API key' });
  req.workspaceId = key === 'dev_key' ? 'dev_workspace' : 'production_workspace';
  next();
}

// Lista alertova
router.get('/:workspaceId', auth, (req, res) => {
  const alerts = AlertModel.list(req.params.workspaceId);
  res.json({ alerts, count: alerts.length });
});

// Kreiraj alert
router.post('/:workspaceId', auth, (req, res) => {
  try {
    const alert = AlertModel.create(req.params.workspaceId, req.body);
    AuditLog.record({
      workspace_id: req.params.workspaceId,
      actor: req.headers['x-api-key'],
      action: 'alert.created',
      target: alert.id,
      metadata: { metric_name: alert.metric_name, threshold: alert.threshold },
    });
    res.status(201).json({ alert });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update alert
router.put('/:workspaceId/:alertId', auth, (req, res) => {
  const updated = AlertModel.update(req.params.workspaceId, req.params.alertId, req.body);
  if (!updated) return res.status(404).json({ error: 'Alert not found' });
  AuditLog.record({
    workspace_id: req.params.workspaceId,
    actor: req.headers['x-api-key'],
    action: 'alert.updated',
    target: req.params.alertId,
  });
  res.json({ alert: updated });
});

// Obriši alert
router.delete('/:workspaceId/:alertId', auth, (req, res) => {
  const deleted = AlertModel.delete(req.params.workspaceId, req.params.alertId);
  if (!deleted) return res.status(404).json({ error: 'Alert not found' });
  AuditLog.record({
    workspace_id: req.params.workspaceId,
    actor: req.headers['x-api-key'],
    action: 'alert.deleted',
    target: req.params.alertId,
  });
  res.json({ message: 'Alert deleted.' });
});

// Preview — koliko puta bi se okinuo u poslednjih N dana
router.post('/:workspaceId/:alertId/preview', auth, async (req, res) => {
  const alert = AlertModel.get(req.params.workspaceId, req.params.alertId);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  const days = Number(req.query.days) || 30;
  try {
    const historyData = await getHistory(alert.metric_name, req.params.workspaceId, days);
    const dataPoints = historyData.data_points || [];
    const preview = previewAlert(alert, dataPoints);
    res.json({ alert_id: alert.id, alert_name: alert.name, days, ...preview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test fire — pošalji test alert
router.post('/:workspaceId/:alertId/test', auth, async (req, res) => {
  const alert = AlertModel.get(req.params.workspaceId, req.params.alertId);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  const testPayload = {
    alert_name: `[TEST] ${alert.name}`,
    metric_name: alert.metric_name,
    value: alert.threshold + (alert.condition === 'above' ? 1 : -1),
    threshold: alert.threshold,
    severity: alert.severity,
    workspace_id: alert.workspace_id,
    timestamp: new Date().toISOString(),
    is_test: true,
  };

  try {
    await alertDelivery.dispatch(alert, testPayload);
    res.json({ message: 'Test alert dispatched.', payload: testPayload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historija firing-a za alert
router.get('/:workspaceId/:alertId/history', auth, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const history = AlertHistory.getByAlert(req.params.alertId, limit);
  res.json({ alert_id: req.params.alertId, history, count: history.length });
});

// Dead-letter log
router.get('/:workspaceId/dead-letter', auth, (req, res) => {
  const log = DeadLetterLog.getByWorkspace(req.params.workspaceId);
  res.json({ dead_letter: log, count: log.length });
});

module.exports = router;
