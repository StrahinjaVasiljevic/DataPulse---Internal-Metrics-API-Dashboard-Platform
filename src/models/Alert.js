'use strict';

const crypto = require('crypto');

// In-memory store alertova po workspace-u
// { workspaceId → [alert, ...] }
const store = new Map();

const AlertModel = {
  create(workspaceId, data) {
    if (!data.metric_name || !data.condition || data.threshold === undefined) {
      throw new Error('Alert requires: metric_name, condition, threshold');
    }
    const validConditions = ['above', 'below', 'equals'];
    if (!validConditions.includes(data.condition)) {
      throw new Error(`condition must be one of: ${validConditions.join(', ')}`);
    }
    const validSeverities = ['info', 'warn', 'critical'];
    const alert = {
      id: `alert_${crypto.randomBytes(6).toString('hex')}`,
      workspace_id: workspaceId,
      metric_name: data.metric_name,
      condition: data.condition,
      threshold: Number(data.threshold),
      severity: validSeverities.includes(data.severity) ? data.severity : 'warn',
      name: data.name || `${data.metric_name} ${data.condition} ${data.threshold}`,
      cooldown_minutes: Number(data.cooldown_minutes) || 60,
      webhook_url: data.webhook_url || process.env.ALERT_WEBHOOK_URL || null,
      slack_webhook_url: data.slack_webhook_url || null,
      email_to: data.email_to || null,
      enabled: data.enabled !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!store.has(workspaceId)) store.set(workspaceId, []);
    store.get(workspaceId).push(alert);
    return alert;
  },

  list(workspaceId) {
    return store.get(workspaceId) || [];
  },

  get(workspaceId, alertId) {
    return (store.get(workspaceId) || []).find(a => a.id === alertId) || null;
  },

  update(workspaceId, alertId, data) {
    const alerts = store.get(workspaceId) || [];
    const idx = alerts.findIndex(a => a.id === alertId);
    if (idx === -1) return null;
    alerts[idx] = { ...alerts[idx], ...data, updated_at: new Date().toISOString() };
    return alerts[idx];
  },

  delete(workspaceId, alertId) {
    const alerts = store.get(workspaceId) || [];
    const idx = alerts.findIndex(a => a.id === alertId);
    if (idx === -1) return false;
    alerts.splice(idx, 1);
    return true;
  },

  // Seed defaultnih RULES iz starog engine-a (backwards compat)
  seedDefaults(workspaceId) {
    const defaults = [
      { metric_name: 'churn_rate', condition: 'above', threshold: 5, severity: 'critical', name: 'High churn rate' },
      { metric_name: 'api_error_rate', condition: 'above', threshold: 2, severity: 'warn', name: 'API error rate elevated' },
      { metric_name: 'active_users', condition: 'below', threshold: 100, severity: 'warn', name: 'Active users below threshold' },
    ];
    for (const d of defaults) {
      if (!this.list(workspaceId).find(a => a.metric_name === d.metric_name)) {
        this.create(workspaceId, d);
      }
    }
  },

  _clear() { store.clear(); },
};

module.exports = AlertModel;
