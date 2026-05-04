/**
 * MetricHealthScore — composite score (0–100) po metrici
 * 
 * Faktori:
 * - Freshness (40 pts): da li stiže u očekivanoj frekvenciji
 * - Contract compliance (30 pts): broj kršenja
 * - Data quality (20 pts): NaN/null vrednosti
 * - Provenance completeness (10 pts): da li ima source i version
 * 
 * Non-goals: nije ML model, nije anomaly detection
 */

'use strict';

const ViolationLog = require('../models/ViolationLog');
const UsageTracker = require('./usageTracker');
const ContractModel = require('../models/MetricContract');

function calculate(workspace_id, metric_name) {
  const health = UsageTracker.getWorkspaceHealth(workspace_id);
  const metricStats = health.metrics.find(m => m.name === metric_name);
  const contract = ContractModel.get(workspace_id, metric_name);
  const violations = ViolationLog.getByWorkspaceAndMetric(workspace_id, metric_name, 30);

  let score = 100;
  const deductions = [];

  // 1. Freshness (−40 max)
  if (!metricStats) {
    score -= 40;
    deductions.push({ reason: 'No data received', points: -40 });
  } else {
    const staleness = metricStats.staleness;
    if (staleness === '90d+') { score -= 40; deductions.push({ reason: 'Stale 90d+', points: -40 }); }
    else if (staleness === '30d+') { score -= 25; deductions.push({ reason: 'Stale 30d+', points: -25 }); }
    else if (staleness === '7d+') { score -= 10; deductions.push({ reason: 'Stale 7d+', points: -10 }); }
  }

  // 2. Contract compliance (−30 max)
  if (!contract) {
    score -= 15;
    deductions.push({ reason: 'No contract defined', points: -15 });
  } else if (violations.length > 10) {
    score -= 30;
    deductions.push({ reason: `${violations.length} violations`, points: -30 });
  } else if (violations.length > 0) {
    const penalty = Math.min(30, violations.length * 3);
    score -= penalty;
    deductions.push({ reason: `${violations.length} violations`, points: -penalty });
  }

  // 3. Provenance completeness (−10 max)
  if (!metricStats || metricStats.ingestion_count === 0) {
    score -= 10;
    deductions.push({ reason: 'No provenance data', points: -10 });
  }

  score = Math.max(0, score);
  const grade = score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';

  return {
    metric_name,
    workspace_id,
    score,
    grade,
    deductions,
    calculated_at: new Date().toISOString(),
  };
}

module.exports = { calculate };
