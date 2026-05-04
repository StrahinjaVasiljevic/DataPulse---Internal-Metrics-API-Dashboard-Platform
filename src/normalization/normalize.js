function normalizeMetric(raw) {
  const normalized = {
    metric: String(raw.metric || 'unknown'),
    value: parseFloat(raw.value || 0),
    source: String(raw.source || 'default'),
    timestamp: raw.timestamp || new Date().toISOString(),
    version: raw.version || '1',
    metadata: raw.metadata || {}
  };

  normalized.metric = normalized.metric
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return normalized;
}

module.exports = { normalizeMetric };

