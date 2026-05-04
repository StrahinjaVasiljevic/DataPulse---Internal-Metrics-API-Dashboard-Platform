'use strict';

const db = require('./client');

// --- Helpers ---

function _sortDesc(records) {
  return [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function _buildProvenance(record) {
  if (!record) return null;
  return {
    source: record.source || 'unknown',
    producer_version: record.producer_version || null,
    event_timestamp: record.timestamp,
    ingested_at: record.ingested_at || record.timestamp,
    ingestion_latency_ms: record.ingestion_latency_ms ?? null,
    is_backfill: record.is_backfill || false,
  };
}

function _buildVersionGroups(records) {
  const groups = {};
  for (const r of records) {
    const v = r.version || 'v1';
    if (!groups[v]) groups[v] = [];
    groups[v].push({ timestamp: r.timestamp, value: r.value });
  }
  return groups;
}

function _calcDelta(current, previous) {
  if (!current || !previous) return null;
  const delta = current - previous;
  const pct = previous !== 0 ? ((delta / previous) * 100).toFixed(1) : null;
  return {
    delta: parseFloat(delta.toFixed(4)),
    delta_percent: pct ? `${pct}%` : null,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
  };
}

function _avg(nums) {
  if (!nums.length) return null;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4));
}

// --- Query functions ---

async function getMetric(name, workspaceId) {
  if (!db.isConnected()) {
    const records = db.memoryStore.filter(
      r => r.metric_name === name && r.workspace_id === workspaceId
    );
    if (!records.length) return null;
    const latest = _sortDesc(records)[0];
    return {
      ...latest,
      provenance: _buildProvenance(latest),
    };
  }

  const result = await db.query(
    `SELECT * FROM metrics
     WHERE metric_name=$1 AND workspace_id=$2
     ORDER BY timestamp DESC LIMIT 1`,
    [name, workspaceId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, provenance: _buildProvenance(row) };
}

async function getHistory(name, workspaceId, days) {
  const since = new Date(Date.now() - days * 86400000);
  const prevSince = new Date(Date.now() - days * 2 * 86400000);

  let current, previous;

  if (!db.isConnected()) {
    const all = db.memoryStore.filter(
      r => r.metric_name === name && r.workspace_id === workspaceId
    );
    current = all
      .filter(r => new Date(r.timestamp) >= since)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    previous = all
      .filter(r => new Date(r.timestamp) >= prevSince && new Date(r.timestamp) < since)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } else {
    const [curRes, prevRes] = await Promise.all([
      db.query(
        `SELECT * FROM metrics WHERE metric_name=$1 AND workspace_id=$2 AND timestamp>=$3 ORDER BY timestamp ASC`,
        [name, workspaceId, since]
      ),
      db.query(
        `SELECT * FROM metrics WHERE metric_name=$1 AND workspace_id=$2 AND timestamp>=$3 AND timestamp<$4 ORDER BY timestamp ASC`,
        [name, workspaceId, prevSince, since]
      ),
    ]);
    current = curRes.rows;
    previous = prevRes.rows;
  }

  const currentAvg = _avg(current.map(r => r.value));
  const previousAvg = _avg(previous.map(r => r.value));

  // Latency trend (poslednjih 5 unosa)
  const latencyTrend = current
    .filter(r => r.ingestion_latency_ms !== null && r.ingestion_latency_ms !== undefined)
    .slice(-5)
    .map(r => ({
      timestamp: r.timestamp,
      latency_ms: r.ingestion_latency_ms,
    }));

  // Jedinstveni sources
  const sources = [...new Set(current.map(r => r.source).filter(Boolean))];

  return {
    metric: name,
    workspace_id: workspaceId,
    period_days: days,
    data_points: current.map(r => ({
      timestamp: r.timestamp,
      value: r.value,
      source: r.source,
      version: r.version,
      ingested_at: r.ingested_at,
    })),
    summary: {
      current_avg: currentAvg,
      previous_avg: previousAvg,
      ..._calcDelta(currentAvg, previousAvg),
      data_points_count: current.length,
    },
    provenance: {
      sources,
      latency_trend: latencyTrend,
      avg_latency_ms: latencyTrend.length
        ? _avg(latencyTrend.map(l => l.latency_ms))
        : null,
    },
    version_history: _buildVersionGroups(current),
  };
}

async function getDashboard(workspaceId) {
  if (!db.isConnected()) {
    const map = {};
    for (const r of db.memoryStore.filter(r => r.workspace_id === workspaceId)) {
      if (!map[r.metric_name]) map[r.metric_name] = [];
      map[r.metric_name].push(r);
    }

    const metrics = Object.entries(map).map(([name, records]) => {
      const sorted = _sortDesc(records);
      const latest = sorted[0];
      const prev = sorted[1] || null;

      return {
        name,
        current_value: latest?.value ?? null,
        unit: latest?.metadata?.unit || null,
        change: _calcDelta(latest?.value, prev?.value),
        provenance: _buildProvenance(latest),
        contract_status: 'missing', // popunjava se u routes.js
        data_points: records.length,
      };
    });

    return {
      workspace_id: workspaceId,
      metrics,
      generated: new Date().toISOString(),
    };
  }

  // Postgres verzija
  const result = await db.query(
    `SELECT DISTINCT ON (metric_name)
       metric_name, value, source, producer_version, version,
       timestamp, ingested_at, ingestion_latency_ms, is_backfill, metadata
     FROM metrics
     WHERE workspace_id=$1
     ORDER BY metric_name, timestamp DESC`,
    [workspaceId]
  );

  const metrics = result.rows.map(row => ({
    name: row.metric_name,
    current_value: row.value,
    unit: row.metadata?.unit || null,
    change: null,
    provenance: _buildProvenance(row),
    contract_status: 'missing',
    data_points: null,
  }));

  return {
    workspace_id: workspaceId,
    metrics,
    generated: new Date().toISOString(),
  };
}

module.exports = { getMetric, getHistory, getDashboard };
