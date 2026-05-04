/**
 * ContractAutoSuggest — predlaže contract na osnovu poslednjih N payload-a
 * 
 * Non-goals: nije ML, nije statistička analiza distribucije
 *            korisnik mora da pregleda i potvrdi pre primene
 */

'use strict';

const MetricEvent = require('../models/MetricEvent');

async function suggest(workspace_id, metric_name) {
  const events = await MetricEvent.getHistory(workspace_id, metric_name, 30);

  if (events.length < 3) {
    throw new Error('Not enough data points (minimum 3 required for suggestion).');
  }

  const values = events.map(e => Number(e.value)).filter(v => !isNaN(v));
  const units = [...new Set(events.map(e => e.unit).filter(Boolean))];
  const sources = [...new Set(events.map(e => e.source).filter(Boolean))];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.2 || 1;

  // Proceni frekvenciju iz timestamps
  const timestamps = events
    .map(e => new Date(e.event_timestamp || e.ingested_at).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  let expected_frequency = 'daily';
  if (timestamps.length > 1) {
    const avgGapMs = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
    if (avgGapMs < 3600000) expected_frequency = 'hourly';
    else if (avgGapMs < 86400000) expected_frequency = 'daily';
    else expected_frequency = 'weekly';
  }

  return {
    metric_name,
    workspace_id,
    unit: units[0] || 'unknown',
    allowed_min: Math.floor(min - padding),
    allowed_max: Math.ceil(max + padding),
    expected_frequency,
    owner: sources[0] || 'unknown',
    description: `Auto-suggested contract for "${metric_name}" based on ${events.length} recent data points.`,
    payload_shape: {
      required: ['value'],
      types: { value: 'number' },
    },
    versioning_rules: 'breaking_requires_new_version',
    violation_policy: 'warn',
    based_on_events: events.length,
    data_range: { min, max },
    _note: 'Review all fields before applying. This is a suggestion, not a guarantee.',
  };
}

module.exports = { suggest };
