'use strict';

/**
 * /api/audit — Audit log (read-only)
 *
 * GET /api/audit/:workspaceId         — svi eventi
 * GET /api/audit/:workspaceId?action= — filtriraj po akciji
 */

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/:workspaceId', requireAuth, requireRole(['owner']), (req, res) => {
  const { workspaceId } = req.params;
  const { action, limit = 50 } = req.query;

  const entries = AuditLog.getByWorkspace(workspaceId, {
    limit: Number(limit),
    action: action || undefined,
  });

  res.json({
    workspace_id: workspaceId,
    entries,
    count: entries.length,
    filters: { action: action || null },
  });
});

module.exports = router;
