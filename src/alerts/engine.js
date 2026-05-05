'use strict';

const AlertModel = require('../models/Alert');
const AlertHistory = require('../models/AlertHistory');
const alertDelivery = require('../services/alertDelivery');

// Cooldown tracker: alertId → last_fired_at (timestamp ms)
const cooldowns = new Map();

function _wouldFire(alert, value) {
  const v = Number(value);
  if (alert.condition === 'above')  return v > alert.threshold;
  if (alert.condition === 'below')  return v < alert.threshold;
  if (alert.condition === 'equals') return v === alert.threshold;
  return false;
}

/**
 * Preview — koliko puta bi se alert okino u historiji
 * @param {Object} alert
 * @param {Array}  dataPoints  - [{value, timestamp}]
 */
function previewAlert(alert, dataPoints) {
  let fireCount = 0;
  const firings = [];
  for (const point of dataPoints) {
    if (_wouldFire(alert, point.value)) {
      fireCount++;
      firings.push({ timestamp: point.timestamp, value: point.value });
    }
  }
  return {
    would_fire_count: fireCount,
    total_evaluated: dataPoints.length,
    sample_firings: firings.slice(0, 5),
    noise_level: fireCount > 50 ? 'high' : fireCount > 10 ? 'medium' : 'low',
  };
}

/**
 * Evaluira jedan alert prema novoj vrijednosti
 */
async function evaluateAlert(alert, value) {
  if (!alert.enabled) return;
  if (!_wouldFire(alert, value)) return;

  // Cooldown check
  const lastFired = cooldowns.get(alert.id);
  const cooldownMs = (alert.cooldown_minutes || 60) * 60 * 1000;
  if (lastFired && Date.now() - lastFired < cooldownMs) {
    AlertHistory.record({
      alert_id: alert.id,
      workspace_id: alert.workspace_id,
      metric_name: alert.metric_name,
      triggered_value: value,
      status: 'suppressed',
      reason: 'cooldown',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  cooldowns.set(alert.id, Date.now());

  const payload = {
    alert_name: alert.name,
    metric_name: alert.metric_name,
    value,
    threshold: alert.threshold,
    severity: alert.severity,
    workspace_id: alert.workspace_id,
    timestamp: new Date().toISOString(),
  };

  await alertDelivery.dispatch(alert, payload);

  AlertHistory.record({
    alert_id: alert.id,
    workspace_id: alert.workspace_id,
    metric_name: alert.metric_name,
    triggered_value: value,
    status: 'fired',
    severity: alert.severity,
    timestamp: new Date().toISOString(),
  });
}

/**
 * checkAlerts — poziva se iz api/routes.js
 * Backwards compatible sa starim interfejsom
 */
async function checkAlerts(metric, workspaceId) {
  // Seed defaultnih alertova ako workspace nema ni jednog
  if (AlertModel.list(workspaceId).length === 0) {
    AlertModel.seedDefaults(workspaceId);
  }

  const alerts = AlertModel.list(workspaceId).filter(
    a => a.metric_name === metric.metric && a.enabled
  );

  await Promise.allSettled(
    alerts.map(alert => evaluateAlert(alert, metric.value))
  );
}

module.exports = { checkAlerts, evaluateAlert, previewAlert, _wouldFire };
