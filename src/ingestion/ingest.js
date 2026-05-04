'use strict';

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

  const now = new Date();
  const eventTimestamp = payload.timestamp ? new Date(payload.timestamp) : now;
  const isBackfill = payload.timestamp && new Date(payload.timestamp) < now;
  const ingestionLatencyMs = isBackfill
    ? null
    : Math.max(0, now.getTime() - eventTimestamp.getTime());

  const record = {
    id: uuidv4(),
    workspace_id: workspaceId,
    metric_name: payload.metric,
    value: payload.value,
    source: payload.source,
    producer_version: payload.producer_version || null,
    version: payload.version || '1',
    timestamp: eventTimestamp,
    ingested_at: now,
    is_backfill: !!isBackfill,
    ingestion_latency_ms: ingestionLatencyMs,
    metadata: payload.metadata || {}
  };

  if (!db.isConnected()) {
    db.memoryStore.push(record);
    return record;
  }

  await db.query(
    `INSERT INTO metrics
      (id, workspace_id, metric_name, value, source, producer_version,
       version, timestamp, ingested_at, is_backfill, ingestion_latency_ms, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      record.id, record.workspace_id, record.metric_name, record.value,
      record.source, record.producer_version, record.version,
      record.timestamp, record.ingested_at, record.is_backfill,
      record.ingestion_latency_ms, JSON.stringify(record.metadata)
    ]
  );
  return record;
}

module.exports = { ingestMetric };
