/**
 * /api/contracts — CRUD za MetricContract
 * 
 * Endpoints:
 *   GET    /api/contracts/:workspaceId
 *   GET    /api/contracts/:workspaceId/:metricName
 *   POST   /api/contracts/:workspaceId
 *   PUT    /api/contracts/:workspaceId/:metricName
 *   DELETE /api/contracts/:workspaceId/:metricName
 *   GET    /api/contracts/:workspaceId/:metricName/violations
 *   POST   /api/contracts/:workspaceId/:metricName/suggest  (bonus)
 */

'use strict';

const express = require('express');
const router = express.Router();
const ContractModel = require('../models/MetricContract');
const ViolationLog = require('../models/ViolationLog');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/auth');
const contractAutoSuggest = require('../services/contractAutoSuggest');

// Lista svih contracta za workspace
router.get('/:workspaceId', requireAuth, (req, res) => {
  const contracts = ContractModel.listByWorkspace(req.params.workspaceId);
  res.json({ contracts, count: contracts.length });
});

// Detalj jednog contracta
router.get('/:workspaceId/:metricName', requireAuth, (req, res) => {
  const contract = ContractModel.get(req.params.workspaceId, req.params.metricName);
  if (!contract) {
    return res.status(404).json({
      error: 'Contract not found',
      hint: `No contract exists for metric "${req.params.metricName}" in workspace "${req.params.workspaceId}".`,
    });
  }
  res.json({ contract });
});

// Kreiranje contracta
router.post('/:workspaceId', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const { workspaceId } = req.params;
  const body = req.body;

  if (!body.metric_name || !body.unit) {
    return res.status(400).json({
      error: 'Validation failed',
      required: ['metric_name', 'unit'],
      received: Object.keys(body),
    });
  }

  const contract = ContractModel.upsert({ ...body, workspace_id: workspaceId });

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'anonymous',
    action: 'contract.created',
    target: `${workspaceId}:${body.metric_name}`,
    metadata: { contract_version: contract.version },
  });

  res.status(201).json({ contract, message: 'Contract created successfully.' });
});

// Update contracta
router.put('/:workspaceId/:metricName', requireAuth, requireRole(['owner', 'editor']), (req, res) => {
  const { workspaceId, metricName } = req.params;
  const existing = ContractModel.get(workspaceId, metricName);

  if (!existing) {
    return res.status(404).json({ error: 'Contract not found. Use POST to create.' });
  }

  const contract = ContractModel.upsert({
    ...existing,
    ...req.body,
    workspace_id: workspaceId,
    metric_name: metricName,
  });

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'anonymous',
    action: 'contract.updated',
    target: `${workspaceId}:${metricName}`,
    metadata: { new_version: contract.version },
  });

  res.json({ contract, message: 'Contract updated.' });
});

// Brisanje contracta
router.delete('/:workspaceId/:metricName', requireAuth, requireRole(['owner']), (req, res) => {
  const { workspaceId, metricName } = req.params;
  const deleted = ContractModel.delete(workspaceId, metricName);

  if (!deleted) {
    return res.status(404).json({ error: 'Contract not found.' });
  }

  AuditLog.record({
    workspace_id: workspaceId,
    actor: req.user?.email || req.apiKey || 'anonymous',
    action: 'contract.deleted',
    target: `${workspaceId}:${metricName}`,
  });

  res.json({ message: `Contract for "${metricName}" deleted.` });
});

// Violations log za metriku
router.get('/:workspaceId/:metricName/violations', requireAuth, (req, res) => {
  const violations = ViolationLog.getByWorkspaceAndMetric(
    req.params.workspaceId,
    req.params.metricName,
    Number(req.query.limit) || 20
  );
  res.json({ violations, count: violations.length });
});

// Auto-suggest contract (bonus)
router.post('/:workspaceId/:metricName/suggest', requireAuth, requireRole(['owner', 'editor']), async (req, res) => {
  try {
    const suggestion = await contractAutoSuggest.suggest(
      req.params.workspaceId,
      req.params.metricName
    );
    res.json({
      suggestion,
      note: 'This is a suggestion based on recent payloads. Review before applying.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not generate suggestion.', detail: err.message });
  }
});

module.exports = router;
