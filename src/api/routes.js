'use strict';

const express = require('express');
const router = express.Router();
const { ingestMetric } = require('../ingestion/ingest');
const { normalizeMetric } = require('../normalization/normalize');
const { checkAlerts } = require('../alerts/engine');
const { getMetric, getHistory, getDashboard } = require('../db/queries');
const ContractModel = require('../models/MetricContract');
const ViolationLog = require('../models/ViolationLog');
const { validate: validateContract } = require('../services/contractValidator');

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  if (key !== process.env.API_KEY && key !== 'dev_key')
    return res.status(403).json({ error: 'Invalid API key' });
  req.workspaceId = key === 'dev_key' ? 'dev_workspace' : 'production_workspace';
  next();
}

function _contractStatus(workspaceId, metricName) {
  const contract = ContractModel.get(workspaceId, metricName);
  if (!contract) return 'missing';
  const violations = ViolationLog.getByWorkspaceAndMetric(workspaceId, metricName, 1);
  return violations.length > 0 ? 'violated' : 'ok';
}

// POST /api/metrics — ingestion sa contract validacijom
router.post('/metrics', auth, async (req, res) => {
  try {
    const normalized = normalizeMetric(req.body);

    // Contract validacija
    const validation = validateContract(req.workspaceId, {
      metric_name: normalized.metric,
      value: normalized.value,
      unit: normalized.unit || normalized.metadata?.unit,
      source: normalized.source,
    });

    if (validation.status === 'fail') {
      return res.status(422).json({
        error: 'Metric contract violation',
        contract_violations: validation.errors,
        metric_name: normalized.metric,
        hint: 'Fix the violations or update the contract if the definition has legitimately changed.',
      });
    }

    const result = await ingestMetric(normalized, req.workspaceId);
    await checkAlerts(normalized, req.workspaceId);

    const response = {
      ok: true,
      metric: result,
      provenance: {
        source: result.source,
        producer_version: result.producer_version,
        ingested_at: result.ingested_at,
        event_timestamp: result.timestamp,
        ingestion_latency_ms: result.ingestion_latency_ms,
        is_backfill: result.is_backfill,
      },
      contract_status: _contractStatus(req.workspaceId, normalized.metric),
    };

    if (validation.status === 'warn') {
      response.warnings = validation.warnings;
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/metrics/:name — trenutna vrijednost + provenance + contract status
router.get('/metrics/:name', auth, async (req, res) => {
  try {
    const metric = await getMetric(req.params.name, req.workspaceId);
    if (!metric) return res.status(404).json({ error: 'Metric not found' });

    const contract = ContractModel.get(req.workspaceId, req.params.name);
    const violations = ViolationLog.getByWorkspaceAndMetric(req.workspaceId, req.params.name, 1);

    res.json({
      name: metric.metric_name,
      current_value: metric.value,
      unit: metric.metadata?.unit || contract?.unit || null,
      timestamp: metric.timestamp,
      provenance: metric.provenance,
      contract_status: _contractStatus(req.workspaceId, req.params.name),
      contract: contract ? {
        unit: contract.unit,
        owner: contract.owner,
        expected_frequency: contract.expected_frequency,
        allowed_min: contract.allowed_min,
        allowed_max: contract.allowed_max,
      } : null,
      last_violation: violations[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/:name/history — trend + provenance + version overlay
router.get('/metrics/:name/history', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await getHistory(req.params.name, req.workspaceId, days);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:workspaceId — dashboard sa contract statusima i provenancijom
router.get('/dashboard/:workspaceId', async (req, res) => {
  try {
    const data = await getDashboard(req.params.workspaceId);

    // Enrichment: contract_status za svaku metriku
    data.metrics = data.metrics.map(m => ({
      ...m,
      contract_status: _contractStatus(req.params.workspaceId, m.name),
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
