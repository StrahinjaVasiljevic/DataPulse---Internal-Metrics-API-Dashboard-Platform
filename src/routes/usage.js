/**
 * /api/usage — Workspace health + meta-metrike
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const usageTracker = require('../services/usageTracker');
const { calculate: healthScore } = require('../services/metricHealthScore');

// Workspace health overview
router.get('/:workspaceId/health', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const health = usageTracker.getWorkspaceHealth(req.params.workspaceId);
  res.json(health);
});

// Health score za konkretnu metriku
router.get('/:workspaceId/health/:metricName', requireAuth, (req, res) => {
  const score = healthScore(req.params.workspaceId, req.params.metricName);
  res.json(score);
});

// Admin: sve workspace zdravlje
router.get('/admin/all', requireAuth, requireRole(['owner']), (req, res) => {
  const all = usageTracker.getAllWorkspacesSummary();
  res.json({ workspaces: all, count: all.length });
});

module.exports = router;
