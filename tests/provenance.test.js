'use strict';

const { ingestMetric } = require('../src/ingestion/ingest');
const { getMetric, getHistory, getDashboard } = require('../src/db/queries');
const db = require('../src/db/client');

beforeEach(() => {
  db.memoryStore.length = 0;
});

describe('Provenance — ingestMetric', () => {
  test('čuva source i ingested_at', async () => {
    const result = await ingestMetric(
      { metric: 'users', value: 100, source: 'backend-service', producer_version: '2.0.0' },
      'ws1'
    );
    expect(result.source).toBe('backend-service');
    expect(result.producer_version).toBe('2.0.0');
    expect(result.ingested_at).toBeDefined();
    expect(result.is_backfill).toBe(false);
  });

  test('detektuje backfill kada je timestamp u prošlosti', async () => {
    const oldTimestamp = new Date(Date.now() - 86400000 * 3).toISOString();
    const result = await ingestMetric(
      { metric: 'revenue', value: 500, source: 'stripe', timestamp: oldTimestamp },
      'ws1'
    );
    expect(result.is_backfill).toBe(true);
    expect(result.ingestion_latency_ms).toBeNull();
  });

  test('računa ingestion_latency_ms za real-time unose', async () => {
    const result = await ingestMetric(
      { metric: 'latency', value: 45, source: 'api-gateway' },
      'ws1'
    );
    expect(result.ingestion_latency_ms).not.toBeNull();
    expect(result.ingestion_latency_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('Provenance — getMetric', () => {
  test('vraća provenance objekat uz metriku', async () => {
    await ingestMetric({ metric: 'dau', value: 220, source: 'mixpanel' }, 'ws1');
    const metric = await getMetric('dau', 'ws1');
    expect(metric.provenance).toBeDefined();
    expect(metric.provenance.source).toBe('mixpanel');
    expect(metric.provenance.event_timestamp).toBeDefined();
    expect(metric.provenance.ingested_at).toBeDefined();
  });
});

describe('Provenance — getHistory', () => {
  test('vraća sources listu i latency trend', async () => {
    await ingestMetric({ metric: 'orders', value: 10, source: 'shopify' }, 'ws1');
    await ingestMetric({ metric: 'orders', value: 15, source: 'shopify' }, 'ws1');
    await ingestMetric({ metric: 'orders', value: 20, source: 'manual' }, 'ws1');

    const history = await getHistory('orders', 'ws1', 30);
    expect(history.provenance.sources).toContain('shopify');
    expect(history.provenance.sources).toContain('manual');
    expect(history.version_history).toBeDefined();
  });

  test('vraća summary sa delta i direction', async () => {
    await ingestMetric({ metric: 'signups', value: 50, source: 'web' }, 'ws1');
    const history = await getHistory('signups', 'ws1', 30);
    expect(history.summary.current_avg).toBeDefined();
    expect(history.summary.data_points_count).toBe(1);
  });
});

describe('Provenance — getDashboard', () => {
  test('svaka metrika ima provenance i contract_status', async () => {
    await ingestMetric({ metric: 'mau', value: 1000, source: 'analytics' }, 'ws_dash');
    const dashboard = await getDashboard('ws_dash');
    const metric = dashboard.metrics[0];
    expect(metric.provenance).toBeDefined();
    expect(metric.provenance.source).toBe('analytics');
    expect(metric.contract_status).toBeDefined();
  });
});
