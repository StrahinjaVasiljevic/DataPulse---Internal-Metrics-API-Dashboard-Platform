'use strict';

/**
 * /api/usage — Workspace health + meta-metrike
 *
 * GET /api/usage/:workspaceId/health          — kompletan health report
 * GET /api/usage/:workspaceId/stale           — samo stale metrike
 * GET /api/usage/:workspaceId/metrics/:name   — health score za jednu metriku
 * GET /api/usage/admin/all                    — svi workspaceovi (owner only)
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const usageTracker = require('../services/usageTracker');
const { calculate: healthScore } = require('../services/metricHealthScore');

// Workspace health overview
router.get('/:workspaceId/health', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const health = usageTracker.getWorkspaceHealth(req.params.workspaceId);

  // Dashboard view tracking
  usageTracker.recordDashboardView(req.params.workspaceId);

  res.json(health);
});

// Samo stale metrike
router.get('/:workspaceId/stale', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const { threshold = '7d' } = req.query;
  const validThresholds = ['7d', '30d', '90d'];

  if (!validThresholds.includes(threshold)) {
    return res.status(400).json({
      error: 'Invalid threshold',
      valid_values: validThresholds,
    });
  }

  const stale = usageTracker.getStaleMetrics(req.params.workspaceId, threshold);

  res.json({
    workspace_id: req.params.workspaceId,
    threshold,
    stale_metrics: stale,
    count: stale.length,
  });
});

// Health score za konkretnu metriku
router.get('/:workspaceId/metrics/:metricName', requireAuth, (req, res) => {
  const score = healthScore(req.params.workspaceId, req.params.metricName);
  res.json(score);
});

// Admin: svi workspaceovi
router.get('/admin/all', requireAuth, requireRole(['owner']), (req, res) => {
  const all = usageTracker.getAllWorkspacesSummary();
  res.json({ workspaces: all, count: all.length });
});

module.exports = router;
