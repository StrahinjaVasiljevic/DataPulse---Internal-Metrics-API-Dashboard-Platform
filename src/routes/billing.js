'use strict';

/**
 * /api/billing — Plan management scaffold
 *
 * GET  /api/billing/plans                      — lista dostupnih planova
 * GET  /api/billing/:workspaceId               — trenutni plan + limiti
 * POST /api/billing/:workspaceId/upgrade        — promijeni plan (scaffold)
 * GET  /api/billing/:workspaceId/usage          — trenutna iskorištenost limita
 *
 * Non-goals: nije Stripe checkout (scaffold samo)
 *            nije webhook handler za Stripe events
 */

const express = require('express');
const router = express.Router();
const planEnforcer = require('../services/planEnforcer');
const AlertModel = require('../models/Alert');
const ApiKeyModel = require('../models/ApiKey');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/auth');

// Lista svih planova (javno — za pricing stranicu)
router.get('/plans', (req, res) => {
  res.json({
    plans: planEnforcer.listPlans(),
    note: 'Contact sales@datapulse.io for Enterprise pricing.',
  });
});

// Trenutni plan workspacea
router.get('/:workspaceId', requireAuth, requireRole(['owner']), (req, res) => {
  const plan = planEnforcer.getPlan(req.params.workspaceId);
  res.json({
    workspace_id: req.params.workspaceId,
    current_plan: plan,
    upgrade_url: '/api/billing/' + req.params.workspaceId + '/upgrade',
  });
});

// Upgrade/downgrade plana (scaffold — bez Stripe)
router.post('/:workspaceId/upgrade', requireAuth, requireRole(['owner']), (req, res) => {
  const { plan_name } = req.body;

  if (!plan_name) {
    return res.status(400).json({
      error: 'plan_name is required',
      valid_plans: Object.keys(planEnforcer.PLANS),
    });
  }

  try {
    const newPlan = planEnforcer.setPlan(req.params.workspaceId, plan_name);

    AuditLog.record({
      workspace_id: req.params.workspaceId,
      actor: req.user?.email || req.apiKey || 'unknown',
      action: 'billing.plan_changed',
      target: req.params.workspaceId,
      metadata: { new_plan: plan_name },
    });

    // Stripe checkout placeholder
    const stripeCheckoutUrl = process.env.STRIPE_CHECKOUT_URL
      ? `${process.env.STRIPE_CHECKOUT_URL}?plan=${plan_name}&workspace=${req.params.workspaceId}`
      : null;

    res.json({
      message: `Plan updated to "${newPlan.name}".`,
      plan: newPlan,
      stripe_checkout_url: stripeCheckoutUrl,
      note: stripeCheckoutUrl
        ? 'Complete payment via Stripe to activate.'
        : 'Stripe not configured — plan updated locally (dev mode).',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trenutna iskorištenost limita
router.get('/:workspaceId/usage', requireAuth, requireRole(['owner', 'editor']), async (req, res) => {
  const { workspaceId } = req.params;

  const alertCount  = AlertModel.list(workspaceId).length;
  const apiKeyCount = ApiKeyModel.listByWorkspace(workspaceId).length;

  const [metricsCheck, alertsCheck, keysCheck] = await Promise.all([
    planEnforcer.checkMetricsLimit(workspaceId),
    planEnforcer.checkAlertsLimit(workspaceId, alertCount),
    planEnforcer.checkApiKeysLimit(workspaceId, apiKeyCount),
  ]);

  const plan = planEnforcer.getPlan(workspaceId);

  res.json({
    workspace_id: workspaceId,
    plan: plan.plan_name,
    usage: {
      metrics: {
        current: metricsCheck.current,
        limit:   metricsCheck.limit,
        allowed: metricsCheck.allowed,
        percent: metricsCheck.limit
          ? Math.round((metricsCheck.current / metricsCheck.limit) * 100)
          : 0,
      },
      alerts: {
        current: alertsCheck.current,
        limit:   alertsCheck.limit,
        allowed: alertsCheck.allowed,
        percent: alertsCheck.limit
          ? Math.round((alertsCheck.current / alertsCheck.limit) * 100)
          : 0,
      },
      api_keys: {
        current: keysCheck.current,
        limit:   keysCheck.limit,
        allowed: keysCheck.allowed,
        percent: keysCheck.limit
          ? Math.round((keysCheck.current / keysCheck.limit) * 100)
          : 0,
      },
      retention_days: plan.retention_days,
    },
    upgrade_available: plan.plan_name !== 'business',
    upgrade_url: `/api/billing/${workspaceId}/upgrade`,
  });
});

module.exports = router;
