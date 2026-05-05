'use strict';

/**
 * PlanEnforcer — billing scaffold
 *
 * Plans:
 *   free:     50 metrics, 7d retention,  3 alerts,   2 api keys
 *   team:     500 metrics, 90d retention, 25 alerts,  10 api keys
 *   business: unlimited,   365d retention, unlimited, unlimited
 *
 * Non-goals: nije Stripe integration (scaffold samo)
 *            nije usage-based metering u realnom vremenu
 */

const PLANS = {
  free: {
    name: 'Free',
    metrics_limit:   50,
    retention_days:  7,
    alerts_limit:    3,
    api_keys_limit:  2,
    price_usd:       0,
  },
  team: {
    name: 'Team',
    metrics_limit:   500,
    retention_days:  90,
    alerts_limit:    25,
    api_keys_limit:  10,
    price_usd:       49,
  },
  business: {
    name: 'Business',
    metrics_limit:   Infinity,
    retention_days:  365,
    alerts_limit:    Infinity,
    api_keys_limit:  Infinity,
    price_usd:       199,
  },
};

// workspace_id → plan_name
const workspacePlans = new Map();

const PlanEnforcer = {
  getPlan(workspace_id) {
    const planName = workspacePlans.get(workspace_id) || 'free';
    return { plan_name: planName, ...PLANS[planName] };
  },

  setPlan(workspace_id, plan_name) {
    if (!PLANS[plan_name]) {
      throw new Error(`Unknown plan: "${plan_name}". Valid: ${Object.keys(PLANS).join(', ')}`);
    }
    workspacePlans.set(workspace_id, plan_name);
    return this.getPlan(workspace_id);
  },

  async checkMetricsLimit(workspace_id) {
    const plan = this.getPlan(workspace_id);
    const UsageTracker = require('./usageTracker');
    const health = UsageTracker.getWorkspaceHealth(workspace_id);
    const current = health.total_metrics;
    const limit = plan.metrics_limit;

    return {
      allowed:  limit === Infinity || current < limit,
      current,
      limit:    limit === Infinity ? null : limit,
      plan:     plan.plan_name,
      upgrade_hint: !( limit === Infinity || current < limit )
        ? `Upgrade to Team or Business to add more metrics.`
        : null,
    };
  },

  async checkAlertsLimit(workspace_id, currentAlertCount) {
    const plan = this.getPlan(workspace_id);
    const limit = plan.alerts_limit;

    return {
      allowed:  limit === Infinity || currentAlertCount < limit,
      current:  currentAlertCount,
      limit:    limit === Infinity ? null : limit,
      plan:     plan.plan_name,
      upgrade_hint: !(limit === Infinity || currentAlertCount < limit)
        ? `Upgrade to Team or Business to add more alerts.`
        : null,
    };
  },

  async checkApiKeysLimit(workspace_id, currentKeyCount) {
    const plan = this.getPlan(workspace_id);
    const limit = plan.api_keys_limit;

    return {
      allowed:  limit === Infinity || currentKeyCount < limit,
      current:  currentKeyCount,
      limit:    limit === Infinity ? null : limit,
      plan:     plan.plan_name,
    };
  },

  getRetentionDays(workspace_id) {
    return this.getPlan(workspace_id).retention_days;
  },

  // Vraća sva dostupna planova (za pricing page)
  listPlans() {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      ...plan,
      metrics_limit:  plan.metrics_limit  === Infinity ? 'unlimited' : plan.metrics_limit,
      alerts_limit:   plan.alerts_limit   === Infinity ? 'unlimited' : plan.alerts_limit,
      api_keys_limit: plan.api_keys_limit === Infinity ? 'unlimited' : plan.api_keys_limit,
    }));
  },

  PLANS,
  _clear()  { workspacePlans.clear(); },
  _size()   { return workspacePlans.size; },
};

module.exports = PlanEnforcer;
