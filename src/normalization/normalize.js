'use strict';

/**
 * Normalizacija dolaznog metric payloada
 *
 * Garantuje konzistentni schema bez obzira na source format.
 * Non-goals: nije schema registry, nije type coercion za nested objekte
 */

const logger = require('../utils/logger');

function normalizeMetric(raw) {
  // Sanitizacija metric name-a
  const rawName = String(raw.metric || raw.metric_name || 'unknown');
  const metricName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '');

  const value = parseFloat(raw.value);
  if (isNaN(value)) {
    logger.warn('normalizeMetric: non-numeric value received', {
      metric: metricName,
      raw_value: raw.value,
    });
  }

  const normalized = {
    metric:           metricName,
    value:            isNaN(value) ? 0 : value,
    source:           String(raw.source || 'unknown'),
    producer_version: raw.producer_version || null,
    unit:             raw.unit || raw.metadata?.unit || null,
    timestamp:        raw.timestamp || new Date().toISOString(),
    version:          raw.version || '1',
    metadata:         raw.metadata || {},
  };

  // Dodaj unit u metadata radi backwards compat
  if (normalized.unit && !normalized.metadata.unit) {
    normalized.metadata.unit = normalized.unit;
  }

  return normalized;
}

module.exports = { normalizeMetric };
