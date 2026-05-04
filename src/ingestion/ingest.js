const { v4: uuidv4 } = require('uuid');
const db = require('../db/client');

function validate(payload) {
  for (const field of ['metric', 'value', 'source']) {
    if (payload[field] === undefined || payload[field] === null)
      throw new Error(`Missing required field: ${field}`);
  }
  if (typeof payload.value !== 'number')
    throw new Error('Field "value" must be a number');
}

async function ingestMetric(payload, workspaceId) {
  validate(payload);
  const record = {
    id: uuidv4(),
    workspace_id: workspaceId,
    metric_name: payload.metric,
    value: payload.value,
    source: payload.source,
    version: payload.version || '1',
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    metadata: payload.metadata || {}
  };

  if (!db.isConnected()) {
    db.memoryStore.push(record);
    return record;
  }

  await db.query(
    `INSERT INTO metrics (id, workspace_id, metric_name, value, source, version, timestamp, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [record.id, record.workspace_id, record.metric_name, record.value,
     record.source, record.version, record.timestamp, JSON.stringify(record.metadata)]
  );
  return record;
}

module.exports = { ingestMetric };

