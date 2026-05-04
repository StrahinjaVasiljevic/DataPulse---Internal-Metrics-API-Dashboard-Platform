/**
 * Auth middleware v2
 * 
 * Podržava:
 * 1. API key auth (X-API-Key header ili ?api_key= query) — workspace-scoped
 * 2. Bearer token (JWT) za UI sesije
 * 
 * Postavlja req.workspace_id, req.user, req.role
 */

'use strict';

const ApiKeyModel = require('../models/ApiKey');
const UserModel = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'datapulse-dev-secret-change-in-prod';

async function requireAuth(req, res, next) {
  // 1. API Key iz headera ili query
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey) {
    const keyRecord = await ApiKeyModel.findByKey(apiKey);
    if (!keyRecord || keyRecord.revoked) {
      return res.status(401).json({
        error: 'Invalid or revoked API key',
        hint: 'Generate a new API key from the workspace settings.',
      });
    }
    req.workspace_id = keyRecord.workspace_id;
    req.apiKey = apiKey;
    req.role = keyRecord.role || 'editor';
    ApiKeyModel.recordUsage(apiKey);
    return next();
  }

  // 2. Bearer JWT
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.workspace_id = decoded.workspace_id;
      req.user = decoded;
      req.role = decoded.role || 'viewer';
      return next();
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        hint: 'Please log in again.',
      });
    }
  }

  return res.status(401).json({
    error: 'Authentication required',
    hint: 'Provide X-API-Key header or Authorization: Bearer <token>',
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
    const userLevel = roleHierarchy[req.role] || 0;
    const minRequired = Math.min(...allowedRoles.map(r => roleHierarchy[r] || 0));

    if (userLevel < minRequired) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required_role: allowedRoles,
        your_role: req.role,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
