function toSnakeCase(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^\w]/g, '');
}

function normalizeMetricSubmission(input = {}, defaults = {}) {
  const errors = [];

  if (!input.name && !input.metric_name) {
    errors.push('Missing metric name');
  }

  const nameRaw = input.metric_name || input.name;
  const name = toSnakeCase(nameRaw);

  let value = input.value;
  if (typeof value === 'string') {
    value = value.replace(',', '.');
  }
  value = Number(value);
  if (Number.isNaN(value)) {
    errors.push('Value must be a number');
  }

  const source =
    (input.source && String(input.source).trim()) ||
    defaults.source ||
    'widget';

  const workspace_id =
    input.workspace_id ||
    defaults.workspace_id ||
    'default';

  const timestamp = input.timestamp
    ? new Date(input.timestamp).toISOString()
    : new Date().toISOString();

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      name,
      value,
      source,
      workspace_id,
      timestamp,
    },
  };
}

module.exports = { normalizeMetricSubmission };
