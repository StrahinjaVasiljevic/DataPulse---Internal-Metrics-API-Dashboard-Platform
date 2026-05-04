/**
 * AlertDelivery — modularni delivery sistem
 * 
 * Providers: webhook, slack, email
 * Features: retry (max 3), dead-letter log
 * 
 * Non-goals: nije queue/broker (Kafka, SQS), nije template engine
 */

'use strict';

const DeadLetterLog = require('../models/DeadLetterLog');
const fetch = require('node-fetch');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = [1000, 5000, 30000];

const AlertDelivery = {
  async dispatch(alert, payload) {
    const deliveries = [];

    if (alert.webhook_url) {
      deliveries.push(this._deliverWithRetry('webhook', alert, payload));
    }
    if (alert.slack_webhook_url) {
      deliveries.push(this._deliverWithRetry('slack', alert, payload));
    }
    if (alert.email_to) {
      deliveries.push(this._deliverWithRetry('email', alert, payload));
    }

    await Promise.allSettled(deliveries);
  },

  async _deliverWithRetry(type, alert, payload) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this._send(type, alert, payload);
        return; // uspeh
      } catch (err) {
        if (attempt < MAX_RETRIES - 1) {
          await _sleep(RETRY_DELAY_MS[attempt]);
        } else {
          // Dead letter
          DeadLetterLog.record({
            type,
            alert_id: alert.id,
            workspace_id: alert.workspace_id,
            payload,
            error: err.message,
            attempts: MAX_RETRIES,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  },

  async _send(type, alert, payload) {
    if (type === 'webhook') {
      const res = await fetch(alert.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'DataPulse',
          alert_name: alert.name,
          severity: payload.severity,
          metric: payload.metric_name,
          value: payload.value,
          threshold: payload.threshold,
          timestamp: payload.timestamp,
        }),
        timeout: 10000,
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    }

    if (type === 'slack') {
      const severity_emoji = { info: 'ℹ️', warn: '⚠️', critical: '🚨' };
      const emoji = severity_emoji[payload.severity] || '⚠️';
      const res = await fetch(alert.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} *DataPulse Alert: ${alert.name}*\n` +
                `Metric: \`${payload.metric_name}\`\n` +
                `Value: *${payload.value}* (threshold: ${payload.threshold})\n` +
                `Severity: ${payload.severity}\n` +
                `Time: ${payload.timestamp}`,
        }),
        timeout: 10000,
      });
      if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
    }

    if (type === 'email') {
      // Modularno — pluguj SMTP/SendGrid/Resend provider
      const emailProvider = require('./emailProvider');
      await emailProvider.send({
        to: alert.email_to,
        subject: `[DataPulse ${payload.severity?.toUpperCase()}] ${alert.name}`,
        body: `Alert triggered for metric "${payload.metric_name}".\n` +
              `Value: ${payload.value} | Threshold: ${payload.threshold}\n` +
              `Severity: ${payload.severity}\n` +
              `Time: ${payload.timestamp}`,
      });
    }
  },
};

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = AlertDelivery;
