'use strict';

/**
 * TenantScope middleware
 *
 * Garantuje da svaki request ima workspace_id i da ne može
 * pristupiti podacima drugog workspacea.
 *
 * Poziva se NAKON auth middleware-a koji postavlja req.workspace_id.
 *
 * Non-goals: nije row-level security na DB nivou (to je u SQL migracijama)
 */

const logger = require('../utils/logger');

function tenantScope(req, res, next) {
  // workspace_id mora biti postavljen od strane auth middleware-a
  if (!req.workspace_id) {
    logger.warn('tenantScope: missing workspace_id', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({
      error: 'Workspace context missing',
      hint: 'Authenticate with a valid API key or JWT token.',
    });
  }

  // Provjeri da workspace_id iz URL-a (ako postoji) odgovara autentifikovanom
  const urlWorkspaceId =
    req.params.workspaceId ||
    req.params.workspace_id ||
    req.body?.workspace_id;

  if (urlWorkspaceId && urlWorkspaceId !== req.workspace_id) {
    logger.warn('tenantScope: workspace_id mismatch', {
      authenticated: req.workspace_id,
      requested: urlWorkspaceId,
      path: req.path,
    });
    return res.status(403).json({
      error: 'Cross-workspace access denied',
      hint: 'You can only access your own workspace data.',
    });
  }

  next();
}

module.exports = { tenantScope };
