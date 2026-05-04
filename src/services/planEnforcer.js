/**
 * PlanEnforcer — billing scaffold
 * 
 * Plans:
 *   free:     50 metrics, 7d retention, 3 alerts
 *   team:     500 metrics, 90d retention, 25 alerts
 *   business: unlimited metrics, 365d retention, unlimited alerts
 * 
 * Non-goals: nije Stripe integration (scaffold samo)
 */

'use strict';

const PLANS = {
  free: {
    name: 'Free',
    metrics_limit: 50,
    retention_days: 7,
    alerts_limit: 3,
    api_keys_limit: 2,
  },
  team: {
    name: 'Team',
    metrics_limit: 500,
    retention_days: 90,
    alerts_limit: 25,
    api_keys_limit: 10,
  },
  business: {
    name: 'Business',
    metrics_limit: Infinity,
    retention_days: 365,
    alerts_limit: Infinity,
    api_keys_limit: Infinity,
  },
};

// workspace_id → plan_name (iz DB u produkciji)
const workspacePlans = new Map();

const PlanEnforcer = {
  getPlan(workspace_id) {
    const planName = workspacePlans.get(workspace_id) || 'free';
    return { plan_name: planName, ...PLANS[planName] };
  },

  setPlan(workspace_id, plan_name) {
    if (!PLANS[plan_name]) throw new Error(`Unknown plan: ${plan_name}`);
    workspacePlans.set(workspace_id, plan_name);
  },

  async checkMetricsLimit(workspace_id) {
    const plan = this.getPlan(workspace_id);
    const UsageTracker = require('./usageTracker');
    const health = UsageTracker.getWorkspaceHealth(workspace_id);
    const current = health.total_metrics;

    return {
      allowed: current < plan.metrics_limit,
      current,
      limit: plan.metrics_limit,
      plan: plan.plan_name,
    };
  },

  async checkAlertsLimit(workspace_id, currentAlertCount) {
    const plan = this.getPlan(workspace_id);
    return {
      allowed: currentAlertCount < plan.alerts_limit,
      current: currentAlertCount,
      limit: plan.alerts_limit,
      plan: plan.plan_name,
    };
  },

  getRetentionDays(workspace_id) {
    return this.getPlan(workspace_id).retention_days;
  },

  PLANS,
};

module.exports = PlanEnforcer;
