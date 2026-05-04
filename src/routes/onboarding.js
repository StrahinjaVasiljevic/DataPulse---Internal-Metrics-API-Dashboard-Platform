/**
 * /api/onboarding — Guided first-run flow + demo mode
 */

'use strict';

const express = require('express');
const router = express.Router();
const ApiKeyModel = require('../models/ApiKey');
const MetricEvent = require('../models/MetricEvent');
const ContractModel = require('../models/MetricContract');
const usageTracker = require('../services/usageTracker');

// Korak 1: Inicijalizuj workspace (seed)
router.post('/init', async (req, res) => {
  const { workspace_id, email } = req.body;
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

  // Generiši API key
  const apiKey = ApiKeyModel.generate(workspace_id, { name: 'default', role: 'editor' });

  res.json({
    workspace_id,
    api_key: apiKey.raw_key,
    api_key_prefix: apiKey.key_prefix,
    message: 'Workspace initialized. Save your API key — it will not be shown again.',
    next_steps: [
      { step: 1, done: true, label: 'Create workspace' },
      { step: 2, done: true, label: 'Generate API key' },
      { step: 3, done: false, label: 'Send test metric', endpoint: 'POST /api/metrics' },
      { step: 4, done: false, label: 'View dashboard', url: `/api/dashboard/${workspace_id}` },
    ],
  });
});

// Korak 3: Pošalji test metriku (ugrađeno dugme)
router.post('/test-metric', async (req, res) => {
  const { workspace_id } = req.body;
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

  const testPayload = {
    workspace_id,
    metric_name: 'test_active_users',
    value: Math.floor(Math.random() * 400 + 100),
    unit: 'count',
    source: 'datapulse_onboarding',
    producer_version: '1.0.0',
    timestamp: new Date().toISOString(),
    tags: { environment: 'demo' },
  };

  const saved = await MetricEvent.create({
    ...testPayload,
    ingested_at: new Date().toISOString(),
    event_timestamp: testPayload.timestamp,
    is_backfill: false,
    ingestion_latency_ms: 0,
  });

  usageTracker.recordIngestion(workspace_id, testPayload.metric_name);

  res.json({
    message: '✅ Test metric received!',
    metric: saved,
    next: `View your dashboard at /api/dashboard/${workspace_id}`,
  });
});

// Demo mode: seed sa realisticnim podacima
router.post('/demo', async (req, res) => {
  const { workspace_id = 'demo_workspace' } = req.body;

  const DEMO_METRICS = [
    { name: 'active_users', unit: 'count', baseValue: 320 },
    { name: 'api_latency_p99', unit: 'ms', baseValue: 142 },
    { name: 'monthly_revenue', unit: 'USD', baseValue: 12400 },
    { name: 'error_rate', unit: '%', baseValue: 1.2 },
    { name: 'db_query_time', unit: 'ms', baseValue: 35 },
  ];

  const seeded = [];

  for (const metric of DEMO_METRICS) {
    // Kreiraj contract
    ContractModel.upsert({
      workspace_id,
      metric_name: metric.name,
      unit: metric.unit,
      description: `Demo contract for ${metric.name}`,
      owner: 'demo-team',
      allowed_min: 0,
      allowed_max: metric.baseValue * 3,
      expected_frequency: 'hourly',
      violation_policy: 'warn',
    });

    // Seed 30 dana podataka
    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      const ts = new Date(Date.now() - daysAgo * 86400000);
      const variation = (Math.random() - 0.5) * 0.2 * metric.baseValue;
      const value = parseFloat((metric.baseValue + variation).toFixed(2));

      await MetricEvent.create({
        workspace_id,
        metric_name: metric.name,
        value,
        unit: metric.unit,
        source: 'demo-seed',
        producer_version: '1.0.0',
        ingested_at: ts.toISOString(),
        event_timestamp: ts.toISOString(),
        is_backfill: true,
        ingestion_latency_ms: null,
        tags: { demo: true },
      });

      usageTracker.recordIngestion(workspace_id, metric.name);
    }
    seeded.push(metric.name);
  }

  const apiKey = ApiKeyModel.generate(workspace_id, { name: 'demo', role: 'editor' });

  res.json({
    message: '🎉 Demo workspace ready!',
    workspace_id,
    api_key: apiKey.raw_key,
    seeded_metrics: seeded,
    dashboard_url: `/api/dashboard/${workspace_id}`,
    note: 'Demo data includes 30 days of history, contracts, and provenance.',
  });
});

module.exports = router;
