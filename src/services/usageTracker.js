/**
 * UsageTracker — meta-metrike o korišćenju DataPulse-a
 * 
 * Prati: ingestion count, metrike po workspace, stale metrike, dashboard views, error rate
 */

'use strict';

const snapshots = new Map(); // workspace_id → { metrics: {}, dashboard_views, errors }

function _getOrInit(workspace_id) {
  if (!snapshots.has(workspace_id)) {
    snapshots.set(workspace_id, {
      metrics: {},
      dashboard_views: 0,
      validation_errors: 0,
      total_ingestions: 0,
      created_at: new Date().toISOString(),
    });
  }
  return snapshots.get(workspace_id);
}

const UsageTracker = {
  recordIngestion(workspace_id, metric_name) {
    const ws = _getOrInit(workspace_id);
    ws.total_ingestions++;
    if (!ws.metrics[metric_name]) {
      ws.metrics[metric_name] = { count: 0, last_seen: null };
    }
    ws.metrics[metric_name].count++;
    ws.metrics[metric_name].last_seen = new Date().toISOString();
  },

  recordDashboardView(workspace_id) {
    _getOrInit(workspace_id).dashboard_views++;
  },

  recordValidationError(workspace_id) {
    _getOrInit(workspace_id).validation_errors++;
  },

  getWorkspaceHealth(workspace_id) {
    const ws = _getOrInit(workspace_id);
    const now = Date.now();
    const STALE_THRESHOLDS = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };

    const metrics_summary = Object.entries(ws.metrics).map(([name, data]) => {
      const age = data.last_seen ? now - new Date(data.last_seen).getTime() : Infinity;
      return {
        name,
        ingestion_count: data.count,
        last_seen: data.last_seen,
        staleness: age > STALE_THRESHOLDS['90d'] ? '90d+'
          : age > STALE_THRESHOLDS['30d'] ? '30d+'
          : age > STALE_THRESHOLDS['7d'] ? '7d+'
          : 'fresh',
      };
    });

    const stale_count = metrics_summary.filter(m => m.staleness !== 'fresh').length;
    const error_rate = ws.total_ingestions > 0
      ? ((ws.validation_errors / ws.total_ingestions) * 100).toFixed(1) + '%'
      : '0%';

    return {
      workspace_id,
      total_metrics: metrics_summary.length,
      total_ingestions: ws.total_ingestions,
      dashboard_views: ws.dashboard_views,
      validation_errors: ws.validation_errors,
      error_rate,
      stale_metrics: stale_count,
      metrics: metrics_summary,
      generated_at: new Date().toISOString(),
    };
  },

  getAllWorkspacesSummary() {
    return [...snapshots.keys()].map(id => this.getWorkspaceHealth(id));
  },
};

module.exports = UsageTracker;
