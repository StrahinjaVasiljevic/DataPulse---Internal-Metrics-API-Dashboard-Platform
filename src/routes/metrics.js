/**
 * /api/metrics — Ingestion + retrieval
 * 
 * IZMENE v2:
 * - Contract validation pri POST
 * - Provenance polja (source, producer_version, ingested_at)
 * - Idempotency key podrška
 * - Backfill podrška (timestamp u prošlosti)
 * - Plan enforcement (metrics limit)
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { checkIdempotency, markProcessed } = require('../middleware/idempotency');
const { validate: validateContract } = require('../services/contractValidator');
const planEnforcer = require('../services/planEnforcer');
const usageTracker = require('../services/usageTracker');
const MetricEvent = require('../models/MetricEvent');

/**
 * POST /api/metrics
 * Ingestion endpoint sa contract validacijom i provenance
 * 
 * Body:
 * {
 *   metric_name: string,          -- obavezno
 *   value: number,                -- obavezno
 *   workspace_id: string,         -- obavezno (ili iz API key-a)
 *   unit: string,                 -- preporučeno
 *   source: string,               -- provenance: odakle dolazi podatak
 *   producer_version: string,     -- provenance: verzija producera
 *   timestamp: ISO string,        -- opciono (backfill); default = now
 *   tags: object,                 -- opciono
 *   version: string,              -- opciono (metric schema version)
 * }
 * 
 * Headers:
 *   X-Idempotency-Key: string     -- opciono, sprečava duplikate
 */
router.post('/', requireAuth, checkIdempotency, async (req, res) => {
  const workspace_id = req.workspace_id; // iz auth middleware-a
  const body = req.body;

  // 1. Osnovna validacija
  if (!body.metric_name || body.value === undefined) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['metric_name', 'value'],
      received: Object.keys(body),
    });
  }

  // 2. Plan enforcement (broj metrika)
  const planCheck = await planEnforcer.checkMetricsLimit(workspace_id);
  if (!planCheck.allowed) {
    return res.status(429).json({
      error: 'Plan limit reached',
      detail: `Your plan allows ${planCheck.limit} metrics. Upgrade to add more.`,
      current_count: planCheck.current,
      limit: planCheck.limit,
      upgrade_url: '/billing/upgrade',
    });
  }

  // 3. Contract validacija
  const validation = validateContract(workspace_id, body);

  if (validation.status === 'fail') {
    return res.status(422).json({
      error: 'Metric contract violation',
      contract_violations: validation.errors,
      metric_name: body.metric_name,
      contract: {
        unit: validation.contract?.unit,
        allowed_min: validation.contract?.allowed_min,
        allowed_max: validation.contract?.allowed_max,
      },
      hint: 'Fix the violations or update the contract if the definition has legitimately changed.',
    });
  }

  // 4. Provenance enrichment
  const ingested_at = new Date().toISOString();
  const event_timestamp = body.timestamp || ingested_at;
  const isBackfill = body.timestamp && body.timestamp < ingested_at;

  const enrichedPayload = {
    ...body,
    workspace_id,
    ingested_at,
    event_timestamp,
    is_backfill: isBackfill,
    source: body.source || 'unknown',
    producer_version: body.producer_version || null,
    ingestion_latency_ms: isBackfill
      ? null
      : Date.now() - new Date(event_timestamp).getTime(),
  };

  // 5. Čuvanje
  const saved = await MetricEvent.create(enrichedPayload);

  // 6. Označi idempotency key kao obrađen
  if (req.idempotencyKey) {
    markProcessed(req.idempotencyKey, saved);
  }

  // 7. Usage tracking
  usageTracker.recordIngestion(workspace_id, body.metric_name);

  // 8. Response
  const response = {
    status: 'accepted',
    metric_id: saved.id,
    metric_name: saved.metric_name,
    value: saved.value,
    ingested_at: saved.ingested_at,
    provenance: {
      source: saved.source,
      producer_version: saved.producer_version,
      event_timestamp: saved.event_timestamp,
      is_backfill: saved.is_backfill,
    },
  };

  // Dodaj warnings u response ako postoje
  if (validation.status === 'warn') {
    response.warnings = validation.warnings;
    response.contract_status = 'warned';
  } else {
    response.contract_status = validation.contract ? 'ok' : 'no_contract';
  }

  res.status(201).json(response);
});

/**
 * GET /api/metrics/:name
 * Trenutna vrednost + provenance + contract status
 */
router.get('/:name', requireAuth, async (req, res) => {
  const workspace_id = req.workspace_id;
  const metric_name = req.params.name;

  const latest = await MetricEvent.getLatest(workspace_id, metric_name);
  if (!latest) {
    return res.status(404).json({
      error: 'Metric not found',
      metric_name,
      workspace_id,
    });
  }

  const contract = require('../models/MetricContract').get(workspace_id, metric_name);
  const violations = require('../models/ViolationLog').getByWorkspaceAndMetric(
    workspace_id, metric_name, 1
  );

  res.json({
    metric_name,
    current_value: latest.value,
    unit: latest.unit || contract?.unit,
    timestamp: latest.event_timestamp,
    ingested_at: latest.ingested_at,
    provenance: {
      source: latest.source,
      producer_version: latest.producer_version,
      ingestion_latency_ms: latest.ingestion_latency_ms,
    },
    contract_status: _deriveContractStatus(contract, violations),
    last_violation: violations[0] || null,
  });
});

/**
 * GET /api/metrics/:name/history
 * Trend + version overlay + source provenance
 */
router.get('/:name/history', requireAuth, async (req, res) => {
  const workspace_id = req.workspace_id;
  const metric_name = req.params.name;
  const days = Number(req.query.days) || 30;

  const history = await MetricEvent.getHistory(workspace_id, metric_name, days);
  const previousPeriod = await MetricEvent.getHistory(workspace_id, metric_name, days * 2);
  const prevSlice = previousPeriod.slice(0, previousPeriod.length - history.length);

  const currentAvg = _avg(history.map(e => e.value));
  const previousAvg = _avg(prevSlice.map(e => e.value));
  const delta = currentAvg - previousAvg;
  const deltaPercent = previousAvg !== 0 ? ((delta / previousAvg) * 100).toFixed(1) : null;

  const violations = require('../models/ViolationLog').getByWorkspaceAndMetric(
    workspace_id, metric_name, 20
  );

  res.json({
    metric_name,
    period_days: days,
    data_points: history,
    summary: {
      current_avg: currentAvg,
      previous_avg: previousAvg,
      delta,
      delta_percent: deltaPercent ? `${deltaPercent}%` : null,
      change_direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
      data_points_count: history.length,
    },
    threshold_breach_history: violations,
    sources: [...new Set(history.map(e => e.source))],
    version_groups: _groupByVersion(history),
  });
});

// --- Helpers ---

function _deriveContractStatus(contract, violations) {
  if (!contract) return 'missing';
  if (violations.length > 0) return 'violated';
  return 'ok';
}

function _avg(nums) {
  if (!nums.length) return null;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4));
}

function _groupByVersion(events) {
  const groups = {};
  for (const e of events) {
    const v = e.version || 'v1';
    if (!groups[v]) groups[v] = [];
    groups[v].push({ timestamp: e.event_timestamp, value: e.value });
  }
  return groups;
}

module.exports = router;
