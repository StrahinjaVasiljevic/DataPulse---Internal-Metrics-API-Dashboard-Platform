'use strict';

const usageTracker = require('../src/services/usageTracker');

beforeEach(() => {
  usageTracker._clear();
});

describe('UsageTracker — recordIngestion', () => {
  test('broji ukupne ingestion-e', () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'revenue');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.total_ingestions).toBe(3);
  });

  test('prati zasebne metrike', () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'revenue');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.total_metrics).toBe(2);
  });

  test('azurira last_seen', () => {
    usageTracker.recordIngestion('ws1', 'latency');
    const health = usageTracker.getWorkspaceHealth('ws1');
    const metric = health.metrics.find(m => m.name === 'latency');
    expect(metric.last_seen).toBeDefined();
    expect(metric.staleness).toBe('fresh');
  });

  test('izolacija izmedju workspaceova', () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws2', 'revenue');
    expect(usageTracker.getWorkspaceHealth('ws1').total_metrics).toBe(1);
    expect(usageTracker.getWorkspaceHealth('ws2').total_metrics).toBe(1);
  });

  test('prati dnevni trend', () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'users');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.ingestion_trend).toHaveLength(7);
    const today = health.ingestion_trend[health.ingestion_trend.length - 1];
    expect(today.count).toBe(2);
  });
});

describe('UsageTracker — recordDashboardView', () => {
  test('broji prikaze dashboarda', () => {
    usageTracker.recordDashboardView('ws1');
    usageTracker.recordDashboardView('ws1');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.dashboard_views).toBe(2);
  });
});

describe('UsageTracker — recordValidationError', () => {
  test('broji greske i racuna error rate', () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordValidationError('ws1');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.validation_errors).toBe(1);
    expect(health.total_ingestions).toBe(3);
    expect(health.error_rate).toBe('33.3%');
  });

  test('error rate je 0% bez gresaka', () => {
    usageTracker.recordIngestion('ws1', 'users');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.error_rate).toBe('0.0%');
  });
});

describe('UsageTracker — staleness', () => {
  test('svjeze metrike su staleness fresh', () => {
    usageTracker.recordIngestion('ws1', 'dau');
    const health = usageTracker.getWorkspaceHealth('ws1');
    const metric = health.metrics.find(m => m.name === 'dau');
    expect(metric.staleness).toBe('fresh');
  });

  test('fresh i stale se sabiraju na total', () => {
    usageTracker.recordIngestion('ws1', 'a');
    usageTracker.recordIngestion('ws1', 'b');
    const health = usageTracker.getWorkspaceHealth('ws1');
    expect(health.fresh_metrics + health.stale_metrics).toBe(health.total_metrics);
  });
});

describe('UsageTracker — getStaleMetrics', () => {
  test('vraca praznu listu kada nema stale metrika', () => {
    usageTracker.recordIngestion('ws1', 'users');
    const stale = usageTracker.getStaleMetrics('ws1', '7d');
    expect(stale).toHaveLength(0);
  });
});

describe('UsageTracker — getAllWorkspacesSummary', () => {
  test('vraca health za sve workspaceove', () => {
    usageTracker.recordIngestion('ws1', 'a');
    usageTracker.recordIngestion('ws2', 'b');
    usageTracker.recordIngestion('ws3', 'c');
    const all = usageTracker.getAllWorkspacesSummary();
    expect(all.length).toBe(3);
    expect(all.every(w => w.workspace_id)).toBe(true);
  });
});
