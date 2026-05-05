'use strict';

/**
 * /api/users — upravljanje korisnicima, rolama i API ključevima
 *
 * GET    /api/users/:workspaceId                     — lista korisnika
 * PUT    /api/users/:workspaceId/:email/role          — promijeni ulogu
 * GET    /api/users/:workspaceId/api-keys             — lista API ključeva
 * POST   /api/users/:workspaceId/api-keys             — generiraj novi API ključ
 * DELETE /api/users/:workspaceId/api-keys/:keyId      — opozovi API ključ
 */

const express = require('express');
const router = express.Router();
const UserModel = require('../models/User');
const ApiKeyModel = require('../models/ApiKey');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/auth');

// Lista korisnika workspacea
router.get('/:workspaceId', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const { workspaceId } = req.params;

  // Skupi sve korisnike koji pripadaju ovom workspaceu
  // (In-memory: skeniramo UserModel interno)
  const users = UserModel._listByWorkspace
    ? UserModel._listByWorkspace(workspaceId)
    : [];

  res.json({ workspace_id: workspaceId, users, count: users.length });
});

// Promijeni ulogu korisnika
router.put('/:workspaceId/:email/role', requireAuth, requireRole(['owner']), (req, res) => {
  const { workspaceId, email } = req.params;
  const { role } = req.body;

  const validRoles = ['owner', 'editor', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: 'Invalid role',
      valid_roles: validRoles,
    });
  }

  const user = UserModel.findByEmail(email);
  if (!user || user.workspace_id !== workspaceId) {
    return res.status(404).json({ error: 'User not found in this workspace' });
  }

  UserModel.updateRole(email, role);

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'unknown',
    action: 'user.role_changed',
    target: email,
    metadata: { new_role: role },
  });

  res.json({ message: `Role updated to "${role}" for ${email}`, email, role });
});

// Lista API ključeva
router.get('/:workspaceId/api-keys', requireAuth, requireRole(['owner']), (req, res) => {
  const keys = ApiKeyModel.listByWorkspace(req.params.workspaceId);
  res.json({ api_keys: keys, count: keys.length });
});

// Generiraj novi API ključ
router.post('/:workspaceId/api-keys', requireAuth, requireRole(['owner']), (req, res) => {
  const { workspaceId } = req.params;
  const { name = 'default', role = 'editor' } = req.body;

  const validRoles = ['owner', 'editor', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role', valid_roles: validRoles });
  }

  const keyRecord = ApiKeyModel.generate(workspaceId, { name, role });

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'unknown',
    action: 'api_key.created',
    target: keyRecord.id,
    metadata: { name, role, prefix: keyRecord.key_prefix },
  });

  res.status(201).json({
    message: 'API key generated. Save it now — it will not be shown again.',
    api_key: keyRecord.raw_key,
    key_id: keyRecord.id,
    prefix: keyRecord.key_prefix,
    role: keyRecord.role,
    workspace_id: workspaceId,
  });
});

// Opozovi API ključ
router.delete('/:workspaceId/api-keys/:keyId', requireAuth, requireRole(['owner']), (req, res) => {
  const { workspaceId, keyId } = req.params;
  const revoked = ApiKeyModel.revoke(workspaceId, keyId);

  if (!revoked) {
    return res.status(404).json({ error: 'API key not found' });
  }

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'unknown',
    action: 'api_key.revoked',
    target: keyId,
  });

  res.json({ message: 'API key revoked successfully.', key_id: keyId });
});

module.exports = router;
