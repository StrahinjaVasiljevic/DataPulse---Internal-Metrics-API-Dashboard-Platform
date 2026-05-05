'use strict';

/**
 * /api/onboarding — Guided first-run flow + demo mode
 *
 * POST /api/onboarding/init          — korak 1+2: workspace + API key
 * GET  /api/onboarding/status/:wsId  — provjeri onboarding progress
 * POST /api/onboarding/test-metric   — korak 3: pošalji test metriku
 * POST /api/onboarding/demo          — demo mode sa 30d seed podataka
 *
 * Non-goals: nije multi-step wizard sa state mašinom
 *            nije billing flow
 */

const express = require('express');
const router = express.Router();
const ApiKeyModel = require('../models/ApiKey');
const UserModel = require('../models/User');
const ContractModel = require('../models/MetricContract');
const AuditLog = require('../models/AuditLog');
const { ingestMetric } = require('../ingestion/ingest');
const { getDashboard } = require('../db/queries');
const usageTracker = require('../services/usageTracker');
const db = require('../db/client');

// Korak 1+2: Inicijalizuj workspace — generiši API key, kreiraj ownera
router.post('/init', async (req, res) => {
  const { workspace_id, email } = req.body;

  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  // Kreiraj owner usera ako je email proslijeđen
  let user = null;
  if (email) {
    user = UserModel.findOrCreate(email, workspace_id, 'owner');
  }

  // Generiši API key
  const apiKey = ApiKeyModel.generate(workspace_id, { name: 'default', role: 'editor' });

  AuditLog.record({
    workspace_id,
    actor: email || 'anonymous',
    action: 'workspace.initialized',
    target: workspace_id,
    metadata: { api_key_prefix: apiKey.key_prefix },
  });

  res.status(201).json({
    workspace_id,
    api_key: apiKey.raw_key,
    api_key_prefix: apiKey.key_prefix,
    message: 'Workspace initialized. Save your API key — it will not be shown again.',
    user: user ? { email: user.email, role: user.role } : null,
    next_steps: [
      { step: 1, done: true,  label: 'Create workspace' },
      { step: 2, done: true,  label: 'Generate API key' },
      { step: 3, done: false, label: 'Send test metric', hint: 'POST /api/onboarding/test-metric' },
      { step: 4, done: false, label: 'View dashboard',   hint: `GET /api/dashboard/${workspace_id}` },
    ],
  });
});

// Status: koliko koraka je onboarding završen
router.get('/status/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;

  const hasApiKey = ApiKeyModel.listByWorkspace(workspaceId).length > 0;
  const dashboard = await getDashboard(workspaceId);
  const hasMetrics = dashboard.metrics.length > 0;
  const hasContracts = ContractModel.listByWorkspace(workspaceId).length > 0;
  const health = usageTracker.getWorkspaceHealth(workspaceId);

  const steps = [
    { step: 1, label: 'Create workspace',    done: true },
    { step: 2, label: 'Generate API key',    done: hasApiKey },
    { step: 3, label: 'Send first metric',   done: hasMetrics },
    { step: 4, label: 'View dashboard',      done: hasMetrics },
    { step: 5, label: 'Create a contract',   done: hasContracts },
  ];

  const completedCount = steps.filter(s => s.done).length;

  res.json({
    workspace_id: workspaceId,
    onboarding_complete: completedCount === steps.length,
    progress: `${completedCount}/${steps.length}`,
    steps,
    workspace_health: {
      total_metrics: health.total_metrics,
      total_ingestions: health.total_ingestions,
    },
  });
});

// Korak 3: Pošalji test metriku (ugrađeno dugme u UI)
router.post('/test-metric', async (req, res) => {
  const { workspace_id } = req.body;
  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const result = await ingestMetric(
      {
        metric: 'test_active_users',
        value: Math.floor(Math.random() * 400 + 100),
        source: 'datapulse_onboarding',
        producer_version: '1.0.0',
        metadata: { environment: 'onboarding' },
      },
      workspace_id
    );

    usageTracker.recordIngestion(workspace_id, 'test_active_users');

    res.json({
      message: '✅ Test metric received!',
      metric_name: result.metric_name,
      value: result.value,
      provenance: {
        source: result.source,
        ingested_at: result.ingested_at,
      },
      next_step: `View your dashboard: GET /api/dashboard/${workspace_id}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo mode: seed sa realističnim podacima (30 dana historije)
router.post('/demo', async (req, res) => {
  const { workspace_id = 'demo_workspace' } = req.body;

  const DEMO_METRICS = [
    { name: 'active_users',    unit: 'count', baseValue: 320,   source: 'mixpanel' },
    { name: 'api_latency_p99', unit: 'ms',    baseValue: 142,   source: 'datadog' },
    { name: 'monthly_revenue', unit: 'USD',   baseValue: 12400, source: 'stripe' },
    { name: 'error_rate',      unit: '%',     baseValue: 1.2,   source: 'sentry' },
    { name: 'db_query_time',   unit: 'ms',    baseValue: 35,    source: 'pg-monitor' },
  ];

  const seeded = [];

  for (const metric of DEMO_METRICS) {
    // Kreiraj contract za svaku metriku
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

    // Seed 30 dana podataka direktno u memoryStore (bypass normalizacije za seed)
    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      const ts = new Date(Date.now() - daysAgo * 86400000);
      const variation = (Math.random() - 0.5) * 0.2 * metric.baseValue;
      const value = parseFloat((metric.baseValue + variation).toFixed(2));

      const record = {
        id: `demo_${metric.name}_${daysAgo}_${Date.now()}`,
        workspace_id,
        metric_name: metric.name,
        value,
        source: metric.source,
        producer_version: '1.0.0',
        version: '1',
        unit: metric.unit,
        timestamp: ts,
        ingested_at: ts,
        is_backfill: true,
        ingestion_latency_ms: null,
        metadata: { demo: true },
      };

      db.memoryStore.push(record);
      usageTracker.recordIngestion(workspace_id, metric.name);
    }

    seeded.push(metric.name);
  }

  // Generiši demo API key
  const apiKey = ApiKeyModel.generate(workspace_id, { name: 'demo-key', role: 'editor' });

  AuditLog.record({
    workspace_id,
    actor: 'system',
    action: 'demo.seeded',
    target: workspace_id,
    metadata: { metrics_seeded: seeded.length },
  });

  res.json({
    message: '🎉 Demo workspace ready!',
    workspace_id,
    api_key: apiKey.raw_key,
    seeded_metrics: seeded,
    data_points_per_metric: 31,
    contracts_created: seeded.length,
    dashboard_url: `/api/dashboard/${workspace_id}`,
    status_url: `/api/onboarding/status/${workspace_id}`,
    note: 'Demo data includes 30 days of history, contracts, and provenance for each metric.',
  });
});

module.exports = router;
