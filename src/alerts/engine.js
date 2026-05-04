const RULES = [
  { metric: 'churn_rate', condition: 'above', threshold: 5, label: 'High churn rate' },
  { metric: 'api_error_rate', condition: 'above', threshold: 2, label: 'API error rate elevated' },
  { metric: 'active_users', condition: 'below', threshold: 100, label: 'Active users below threshold' }
];

async function checkAlerts(metric, workspaceId) {
  const rule = RULES.find(r => r.metric === metric.metric);
  if (!rule) return;

  const triggered =
    (rule.condition === 'above' && metric.value > rule.threshold) ||
    (rule.condition === 'below' && metric.value < rule.threshold);

  if (!triggered) return;

  const alert = {
    label: rule.label,
    metric: metric.metric,
    value: metric.value,
    threshold: rule.threshold,
    workspaceId,
    timestamp: new Date().toISOString()
  };

  console.warn(`[ALERT] ${alert.label} — ${metric.metric}: ${metric.value}`);

  if (process.env.ALERT_WEBHOOK_URL) {
    try {
      const fetch = require('node-fetch');
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (err) {
      console.error('[ALERT] Webhook failed:', err.message);
    }
  }
}

module.exports = { checkAlerts };

