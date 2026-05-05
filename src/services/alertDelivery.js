'use strict';

const DeadLetterLog = require('../models/DeadLetterLog');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 5000, 30000];

async function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function _sendWebhook(url, payload) {
  const fetch = require('node-fetch');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 10000,
  });
  if (!res.ok) throw new Error(`Webhook returned HTTP ${res.status}`);
}

async function _sendSlack(url, payload) {
  const fetch = require('node-fetch');
  const emoji = { info: 'ℹ️', warn: '⚠️', critical: '🚨' }[payload.severity] || '⚠️';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text:
        `${emoji} *DataPulse Alert: ${payload.alert_name}*\n` +
        `Metric: \`${payload.metric_name}\`\n` +
        `Value: *${payload.value}* (threshold: ${payload.threshold})\n` +
        `Severity: ${payload.severity}\n` +
        `Time: ${payload.timestamp}`,
    }),
    timeout: 10000,
  });
  if (!res.ok) throw new Error(`Slack webhook returned HTTP ${res.status}`);
}

async function _sendEmail(to, payload) {
  // Placeholder — pluguj SMTP/SendGrid/Resend provider ovdje
  console.log(`[EMAIL] To: ${to} | Alert: ${payload.alert_name} | Value: ${payload.value}`);
}

async function _deliverWithRetry(type, alert, payload) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (type === 'webhook') await _sendWebhook(alert.webhook_url, payload);
      if (type === 'slack')   await _sendSlack(alert.slack_webhook_url, payload);
      if (type === 'email')   await _sendEmail(alert.email_to, payload);
      return; // uspjeh
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await _sleep(RETRY_DELAYS_MS[attempt]);
      } else {
        DeadLetterLog.record({
          type,
          alert_id: alert.id,
          workspace_id: alert.workspace_id,
          alert_name: alert.name,
          payload,
          error: err.message,
          attempts: MAX_RETRIES,
        });
      }
    }
  }
}

async function dispatch(alert, payload) {
  const deliveries = [];
  if (alert.webhook_url)       deliveries.push(_deliverWithRetry('webhook', alert, payload));
  if (alert.slack_webhook_url) deliveries.push(_deliverWithRetry('slack', alert, payload));
  if (alert.email_to)          deliveries.push(_deliverWithRetry('email', alert, payload));
  if (deliveries.length === 0) {
    // Nema konfigurisan delivery — samo log
    console.warn(`[ALERT] ${payload.severity?.toUpperCase()} | ${alert.name} | ${alert.metric_name}: ${payload.value}`);
  }
  await Promise.allSettled(deliveries);
}

module.exports = { dispatch };
