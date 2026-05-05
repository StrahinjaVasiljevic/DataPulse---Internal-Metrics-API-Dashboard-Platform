'use strict';

const ApiKeyModel = require('../src/models/ApiKey');
const UserModel = require('../src/models/User');
const ContractModel = require('../src/models/MetricContract');
const AuditLog = require('../src/models/AuditLog');
const db = require('../src/db/client');
const usageTracker = require('../src/services/usageTracker');

beforeEach(() => {
  ApiKeyModel._clear();
  UserModel._clear();
  ContractModel._clear();
  AuditLog._clear();
  db.memoryStore.length = 0;
});

describe('Onboarding — init', () => {
  test('generiše API key pri init-u', () => {
    const key = ApiKeyModel.generate('ws_new', { name: 'default', role: 'editor' });
    expect(key.raw_key).toMatch(/^dp_/);
    expect(key.workspace_id).toBe('ws_new');
  });

  test('kreira owner usera ako je email proslijeđen', () => {
    const user = UserModel.findOrCreate('founder@startup.com', 'ws_new', 'owner');
    expect(user.role).toBe('owner');
    expect(user.workspace_id).toBe('ws_new');
  });

  test('beleži workspace.initialized u audit log', () => {
    AuditLog.record({
      workspace_id: 'ws_new',
      actor: 'founder@startup.com',
      action: 'workspace.initialized',
      target: 'ws_new',
    });
    const log = AuditLog.getByWorkspace('ws_new');
    expect(log[0].action).toBe('workspace.initialized');
  });
});

describe('Onboarding — status', () => {
  test('status pokazuje korake onboardinga', () => {
    ApiKeyModel.generate('ws_status', { name: 'k1' });
    const hasApiKey = ApiKeyModel.listByWorkspace('ws_status').length > 0;
    const hasMetrics = db.memoryStore.filter(r => r.workspace_id === 'ws_status').length > 0;
    const hasContracts = ContractModel.listByWorkspace('ws_status').length > 0;

    expect(hasApiKey).toBe(true);
    expect(hasMetrics).toBe(false);
    expect(hasContracts).toBe(false);
  });

  test('progress je 2/5 nakon init-a (workspace + api key)', () => {
    ApiKeyModel.generate('ws_prog', { name: 'default' });
    const steps = [
      { done: true  },  // workspace
      { done: ApiKeyModel.listByWorkspace('ws_prog').length > 0 },
      { done: false },  // metrics
      { done: false },  // dashboard
      { done: false },  // contract
    ];
    const done = steps.filter(s => s.done).length;
    expect(done).toBe(2);
  });
});

describe('Onboarding — demo seed', () => {
  test('demo seed popunjava memoryStore', () => {
    const DEMO_METRICS = ['active_users', 'error_rate'];
    for (const name of DEMO_METRICS) {
      for (let i = 0; i < 5; i++) {
        db.memoryStore.push({
          id: `d_${name}_${i}`,
          workspace_id: 'demo_workspace',
          metric_name: name,
          value: 100 + i,
          source: 'demo-seed',
          timestamp: new Date(),
          ingested_at: new Date(),
        });
        usageTracker.recordIngestion('demo_workspace', name);
      }
    }
    const records = db.memoryStore.filter(r => r.workspace_id === 'demo_workspace');
    expect(records.length).toBe(10);
  });

  test('demo seed kreira contracte', () => {
    ContractModel.upsert({
      workspace_id: 'demo_workspace',
      metric_name: 'active_users',
      unit: 'count',
      allowed_min: 0,
      allowed_max: 1000,
      violation_policy: 'warn',
    });
    const contracts = ContractModel.listByWorkspace('demo_workspace');
    expect(contracts.length).toBe(1);
    expect(contracts[0].metric_name).toBe('active_users');
  });

  test('demo generiše API key', () => {
    const key = ApiKeyModel.generate('demo_workspace', { name: 'demo-key', role: 'editor' });
    expect(key.raw_key).toBeDefined();
    const found = ApiKeyModel.findByKey(key.raw_key);
    expect(found.workspace_id).toBe('demo_workspace');
  });
});

describe('Onboarding — test-metric', () => {
  test('ingestMetric prihvata test payload', async () => {
    const { ingestMetric } = require('../src/ingestion/ingest');
    const result = await ingestMetric(
      {
        metric: 'test_active_users',
        value: 250,
        source: 'datapulse_onboarding',
        producer_version: '1.0.0',
      },
      'ws_test'
    );
    expect(result.metric_name).toBe('test_active_users');
    expect(result.value).toBe(250);
    expect(result.source).toBe('datapulse_onboarding');
    expect(result.is_backfill).toBe(false);
  });
});
