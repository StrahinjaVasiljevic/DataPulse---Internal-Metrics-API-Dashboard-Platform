'use strict';

const { normalizeMetric } = require('../src/normalization/normalize');
const logger = require('../src/utils/logger');
const { tenantScope } = require('../src/middleware/tenantScope');
const db = require('../src/db/client');

describe('normalizeMetric — hardening', () => {
  test('sanitizuje metric name', () => {
    const result = normalizeMetric({ metric: 'Active Users!!', value: 100, source: 'web' });
    expect(result.metric).toBe('active_users');
  });

  test('uklanja visestruke underscoreove', () => {
    const result = normalizeMetric({ metric: 'api__error___rate', value: 1, source: 'api' });
    expect(result.metric).toBe('api_error_rate');
  });

  test('prihvata metric_name kao alternativu', () => {
    const result = normalizeMetric({ metric_name: 'dau', value: 500, source: 'app' });
    expect(result.metric).toBe('dau');
  });

  test('cuva producer_version', () => {
    const result = normalizeMetric({ metric: 'users', value: 10, source: 'api', producer_version: '3.1.0' });
    expect(result.producer_version).toBe('3.1.0');
  });

  test('cuva unit i propaguje u metadata', () => {
    const result = normalizeMetric({ metric: 'latency', value: 45, source: 'gw', unit: 'ms' });
    expect(result.unit).toBe('ms');
    expect(result.metadata.unit).toBe('ms');
  });

  test('NaN value se defaultuje na 0', () => {
    const result = normalizeMetric({ metric: 'broken', value: 'abc', source: 'x' });
    expect(result.value).toBe(0);
  });

  test('timestamp se defaultuje na now ako nije proslijedjen', () => {
    const before = new Date().toISOString();
    const result = normalizeMetric({ metric: 'test', value: 1, source: 'x' });
    expect(result.timestamp >= before).toBe(true);
  });
});

describe('Logger', () => {
  test('logger ima sve metode', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('logger ne baca gresku pri pozivu', () => {
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
    expect(() => logger.warn('test warning')).not.toThrow();
    expect(() => logger.error('test error', { code: 500 })).not.toThrow();
  });
});

describe('TenantScope middleware', () => {
  function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
  }

  test('propusta request sa workspace_id', () => {
    const req  = { workspace_id: 'ws1', params: {}, body: {}, path: '/test', method: 'GET', ip: '127.0.0.1' };
    const res  = makeRes();
    const next = jest.fn();
    tenantScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blokira request bez workspace_id', () => {
    const req  = { params: {}, body: {}, path: '/test', method: 'GET', ip: '127.0.0.1' };
    const res  = makeRes();
    const next = jest.fn();
    tenantScope(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('blokira cross-workspace pristup', () => {
    const req  = {
      workspace_id: 'ws1',
      params: { workspaceId: 'ws2' },
      body: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    const res  = makeRes();
    const next = jest.fn();
    tenantScope(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('propusta kada URL workspace_id odgovara autentifikovanom', () => {
    const req  = {
      workspace_id: 'ws1',
      params: { workspaceId: 'ws1' },
      body: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    const res  = makeRes();
    const next = jest.fn();
    tenantScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('DB client', () => {
  test('isConnected vraca boolean', () => {
    expect(typeof db.isConnected()).toBe('boolean');
  });

  test('getStatus vraca strukturirani objekat', () => {
    const status = db.getStatus();
    expect(status).toHaveProperty('connected');
    expect(status).toHaveProperty('mode');
    expect(status).toHaveProperty('memory_records');
    expect(status).toHaveProperty('uptime_ms');
    expect(typeof status.uptime_ms).toBe('number');
  });

  test('memoryStore je array', () => {
    expect(Array.isArray(db.memoryStore)).toBe(true);
  });
});
