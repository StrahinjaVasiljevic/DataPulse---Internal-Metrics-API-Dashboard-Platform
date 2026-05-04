/**
 * AlertEngine v2
 * 
 * Features:
 * - Alert preview ("koliko puta bi se okinuo u 30 dana")
 * - Cooldown / dedup (suppression)
 * - Severity: info | warn | critical
 * - Dead-letter log za failed deliveries
 * - Retry logic
 */

'use strict';

const AlertHistory = require('../models/AlertHistory');
const alertDelivery = require('./alertDelivery');
const MetricEvent = require('../models/MetricEvent');

// Aktivni cooldowns: alertId → last_fired_at
const cooldowns = new Map();

const AlertEngine = {
  /**
   * Preview: koliko puta bi se alert okino u poslednjih N dana
   */
  async preview(alert, days = 30) {
    const events = await MetricEvent.getHistory(alert.workspace_id, alert.metric_name, days);
    let fireCount = 0;
    const firings = [];

    for (const event of events) {
      if (this._wouldFire(alert, event.value)) {
        fireCount++;
        firings.push({ timestamp: event.event_timestamp, value: event.value });
      }
    }

    return {
      would_fire_count: fireCount,
      total_events_evaluated: events.length,
      sample_firings: firings.slice(0, 5),
      estimated_noise: fireCount > 50 ? 'high' : fireCount > 10 ? 'medium' : 'low',
    };
  },

  /**
   * Evaluira alert za novu vrednost metrike
   */
  async evaluate(alert, metricValue) {
    if (!this._wouldFire(alert, metricValue)) return;

    // Cooldown check
    const lastFired = cooldowns.get(alert.id);
    const cooldownMs = (alert.cooldown_minutes || 60) * 60 * 1000;
    if (lastFired && Date.now() - lastFired < cooldownMs) {
      AlertHistory.record({
        alert_id: alert.id,
        workspace_id: alert.workspace_id,
        metric_name: alert.metric_name,
        triggered_value: metricValue,
        status: 'suppressed',
        reason: 'cooldown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    cooldowns.set(alert.id, Date.now());

    // Dispatch
    await alertDelivery.dispatch(alert, {
      metric_name: alert.metric_name,
      value: metricValue,
      threshold: alert.threshold,
      severity: alert.severity || 'warn',
      timestamp: new Date().toISOString(),
    });

    AlertHistory.record({
      alert_id: alert.id,
      workspace_id: alert.workspace_id,
      metric_name: alert.metric_name,
      triggered_value: metricValue,
      status: 'fired',
      timestamp: new Date().toISOString(),
    });
  },

  _wouldFire(alert, value) {
    const v = Number(value);
    if (alert.condition === 'above') return v > alert.threshold;
    if (alert.condition === 'below') return v < alert.threshold;
    if (alert.condition === 'equals') return v === alert.threshold;
    return false;
  },
};

module.exports = AlertEngine;
