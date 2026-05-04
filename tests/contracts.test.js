const ContractModel = require('../src/models/MetricContract');
const { validate } = require('../src/services/contractValidator');
const ViolationLog = require('../src/models/ViolationLog');

beforeEach(() => {
  ContractModel._clear();
  ViolationLog._clear();
});

describe('ContractValidator', () => {
  test('returns warn when no contract exists', () => {
    const result = validate('ws1', { metric_name: 'users', value: 100 });
    expect(result.status).toBe('warn');
    expect(result.warnings[0]).toMatch(/no contract/i);
  });

  test('passes valid metric against contract', () => {
    ContractModel.upsert({
      workspace_id: 'ws1',
      metric_name: 'users',
      unit: 'count',
      allowed_min: 0,
      allowed_max: 10000,
      violation_policy: 'hard_fail',
    });
    const result = validate('ws1', { metric_name: 'users', value: 500, unit: 'count' });
    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
  });

  test('fails on unit mismatch with hard_fail policy', () => {
    ContractModel.upsert({
      workspace_id: 'ws1', metric_name: 'latency', unit: 'ms',
      violation_policy: 'hard_fail',
    });
    const result = validate('ws1', { metric_name: 'latency', value: 50, unit: 'seconds' });
    expect(result.status).toBe('fail');
    expect(result.errors[0]).toMatch(/unit mismatch/i);
  });

  test('warns on unit mismatch with warn policy', () => {
    ContractModel.upsert({
      workspace_id: 'ws1', metric_name: 'latency', unit: 'ms',
      violation_policy: 'warn',
    });
    const result = validate('ws1', { metric_name: 'latency', value: 50, unit: 'seconds' });
    expect(result.status).toBe('warn');
  });

  test('fails when value exceeds allowed_max', () => {
    ContractModel.upsert({
      workspace_id: 'ws1', metric_name: 'error_rate', unit: '%',
      allowed_min: 0, allowed_max: 5, violation_policy: 'hard_fail',
    });
    const result = validate('ws1', { metric_name: 'error_rate', value: 99, unit: '%' });
    expect(result.status).toBe('fail');
    expect(result.errors[0]).toMatch(/exceeds allowed maximum/i);
  });

  test('records violation in ViolationLog', () => {
    ContractModel.upsert({
      workspace_id: 'ws1', metric_name: 'kpi', unit: 'count',
      allowed_max: 100, violation_policy: 'hard_fail',
    });
    validate('ws1', { metric_name: 'kpi', value: 9999, unit: 'count' });
    const violations = ViolationLog.getByWorkspaceAndMetric('ws1', 'kpi');
    expect(violations.length).toBeGreaterThan(0);
  });
});
