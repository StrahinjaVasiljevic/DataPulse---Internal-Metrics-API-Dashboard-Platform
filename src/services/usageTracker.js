'use strict';

/**
 * UsageTracker — meta-metrike o korišćenju DataPulse-a
 *
 * Prati:
 * - ingestion count po metrici
 * - stale metrike (7d / 30d / 90d)
 * - dashboard views
 * - validation errors + error rate
 * - ingestion trend (poslednjih 7 dana po danu)
 *
 * Non-goals: nije time-series baza, nije billing metering
 */

const snapshots = new Map(); // workspace_id → workspace state

function _getOrInit(workspace_id) {
  if (!snapshots.has(workspace_id)) {
    snapshots.set(workspace_id, {
      metrics: {},           // metric_name → { count, last_seen, first_seen }
      dashboard_views: 0,
      validation_errors: 0,
      total_ingestions: 0,
      daily_ingestions: {},  // 'YYYY-MM-DD' → count (za trend)
      created_at: new Date().toISOString(),
    });
  }
  return snapshots.get(workspace_id);
}

function _todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

const STALE_THRESHOLDS = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

function _staleness(last_seen) {
  if (!last_seen) return '90d+';
  const age = Date.now() - new Date(last_seen).getTime();
  if (age > STALE_THRESHOLDS['90d']) return '90d+';
  if (age > STALE_THRESHOLDS['30d']) return '30d+';
  if (age > STALE_THRESHOLDS['7d'])  return '7d+';
  return 'fresh';
}

const UsageTracker = {
  recordIngestion(workspace_id, metric_name) {
    const ws = _getOrInit(workspace_id);
    ws.total_ingestions++;

    // Po metrici
    if (!ws.metrics[metric_name]) {
      ws.metrics[metric_name] = { count: 0, last_seen: null, first_seen: new Date().toISOString() };
    }
    ws.metrics[metric_name].count++;
    ws.metrics[metric_name].last_seen = new Date().toISOString();

    // Dnevni trend
    const day = _todayKey();
    ws.daily_ingestions[day] = (ws.daily_ingestions[day] || 0) + 1;
  },

  recordDashboardView(workspace_id) {
    _getOrInit(workspace_id).dashboard_views++;
  },

  recordValidationError(workspace_id) {
    const ws = _getOrInit(workspace_id);
    ws.validation_errors++;
    ws.total_ingestions++; // greška je i dalje pokušaj ingestion-a
  },

  getWorkspaceHealth(workspace_id) {
    const ws = _getOrInit(workspace_id);

    const metrics_summary = Object.entries(ws.metrics).map(([name, data]) => ({
      name,
      ingestion_count: data.count,
      last_seen:       data.last_seen,
      first_seen:      data.first_seen,
      staleness:       _staleness(data.last_seen),
    }));

    const stale_count  = metrics_summary.filter(m => m.staleness !== 'fresh').length;
    const fresh_count  = metrics_summary.filter(m => m.staleness === 'fresh').length;
    const error_rate   = ws.total_ingestions > 0
      ? ((ws.validation_errors / ws.total_ingestions) * 100).toFixed(1) + '%'
      : '0%';

    // Trend: poslednjih 7 dana
    const ingestion_trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      ingestion_trend.push({ date: d, count: ws.daily_ingestions[d] || 0 });
    }

    return {
      workspace_id,
      total_metrics:      metrics_summary.length,
      fresh_metrics:      fresh_count,
      stale_metrics:      stale_count,
      total_ingestions:   ws.total_ingestions,
      dashboard_views:    ws.dashboard_views,
      validation_errors:  ws.validation_errors,
      error_rate,
      ingestion_trend,
      metrics:            metrics_summary,
      generated_at:       new Date().toISOString(),
    };
  },

  // Samo stale metrike za workspace
  getStaleMetrics(workspace_id, threshold = '7d') {
    const health = this.getWorkspaceHealth(workspace_id);
    const order = ['fresh', '7d+', '30d+', '90d+'];
    const minIdx = order.indexOf(threshold + (threshold.endsWith('+') ? '' : '+'));
    return health.metrics.filter(m => {
      const idx = order.indexOf(m.staleness);
      return idx >= (minIdx === -1 ? 1 : minIdx);
    });
  },

  // Admin: svi workspaceovi
  getAllWorkspacesSummary() {
    return [...snapshots.keys()].map(id => this.getWorkspaceHealth(id));
  },

  _clear() { snapshots.clear(); },
  _size()  { return snapshots.size; },
};

module.exports = UsageTracker;
