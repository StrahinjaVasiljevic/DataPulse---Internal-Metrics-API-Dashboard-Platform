'use strict';

const planEnforcer = require('../src/services/planEnforcer');
const usageTracker = require('../src/services/usageTracker');

beforeEach(() => {
  planEnforcer._clear();
  usageTracker._clear();
});

describe('PlanEnforcer — getPlan', () => {
  test('default plan je free', () => {
    const plan = planEnforcer.getPlan('ws1');
    expect(plan.plan_name).toBe('free');
    expect(plan.metrics_limit).toBe(50);
    expect(plan.retention_days).toBe(7);
  });

  test('setPlan mijenja plan', () => {
    planEnforcer.setPlan('ws1', 'team');
    const plan = planEnforcer.getPlan('ws1');
    expect(plan.plan_name).toBe('team');
    expect(plan.metrics_limit).toBe(500);
    expect(plan.retention_days).toBe(90);
  });

  test('setPlan baca gresku za nepostojeci plan', () => {
    expect(() => planEnforcer.setPlan('ws1', 'enterprise')).toThrow(/Unknown plan/i);
  });

  test('business plan ima unlimited metrike', () => {
    planEnforcer.setPlan('ws1', 'business');
    const plan = planEnforcer.getPlan('ws1');
    expect(plan.metrics_limit).toBe(Infinity);
    expect(plan.alerts_limit).toBe(Infinity);
  });
});

describe('PlanEnforcer — checkMetricsLimit', () => {
  test('dozvoljava kada je ispod limita', async () => {
    usageTracker.recordIngestion('ws1', 'users');
    usageTracker.recordIngestion('ws1', 'revenue');
    const check = await planEnforcer.checkMetricsLimit('ws1');
    expect(check.allowed).toBe(true);
    expect(check.current).toBe(2);
    expect(check.limit).toBe(50);
  });

  test('business plan uvijek dozvoljava', async () => {
    planEnforcer.setPlan('ws1', 'business');
    for (let i = 0; i < 100; i++) {
      usageTracker.recordIngestion('ws1', `metric_${i}`);
    }
    const check = await planEnforcer.checkMetricsLimit('ws1');
    expect(check.allowed).toBe(true);
    expect(check.limit).toBeNull();
  });

  test('upgrade_hint je null kada je limit ok', async () => {
    const check = await planEnforcer.checkMetricsLimit('ws1');
    expect(check.upgrade_hint).toBeNull();
  });
});

describe('PlanEnforcer — checkAlertsLimit', () => {
  test('free plan dozvoljava do 3 alerta', async () => {
    const check1 = await planEnforcer.checkAlertsLimit('ws1', 2);
    expect(check1.allowed).toBe(true);

    const check2 = await planEnforcer.checkAlertsLimit('ws1', 3);
    expect(check2.allowed).toBe(false);
  });

  test('team plan dozvoljava do 25 alerta', async () => {
    planEnforcer.setPlan('ws1', 'team');
    const check = await planEnforcer.checkAlertsLimit('ws1', 24);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(25);
  });

  test('upgrade_hint postoji kada je limit premasен', async () => {
    const check = await planEnforcer.checkAlertsLimit('ws1', 3);
    expect(check.upgrade_hint).toMatch(/upgrade/i);
  });
});

describe('PlanEnforcer — checkApiKeysLimit', () => {
  test('free plan dozvoljava do 2 api kljuca', async () => {
    const check1 = await planEnforcer.checkApiKeysLimit('ws1', 1);
    expect(check1.allowed).toBe(true);

    const check2 = await planEnforcer.checkApiKeysLimit('ws1', 2);
    expect(check2.allowed).toBe(false);
  });
});

describe('PlanEnforcer — getRetentionDays', () => {
  test('free plan ima 7 dana retencije', () => {
    expect(planEnforcer.getRetentionDays('ws1')).toBe(7);
  });

  test('business plan ima 365 dana retencije', () => {
    planEnforcer.setPlan('ws1', 'business');
    expect(planEnforcer.getRetentionDays('ws1')).toBe(365);
  });
});

describe('PlanEnforcer — listPlans', () => {
  test('vraca sva tri plana', () => {
    const plans = planEnforcer.listPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map(p => p.id)).toEqual(['free', 'team', 'business']);
  });

  test('unlimited se prikazuje kao string a ne Infinity', () => {
    const plans = planEnforcer.listPlans();
    const business = plans.find(p => p.id === 'business');
    expect(business.metrics_limit).toBe('unlimited');
    expect(business.alerts_limit).toBe('unlimited');
  });

  test('svaki plan ima price_usd', () => {
    const plans = planEnforcer.listPlans();
    plans.forEach(p => expect(p.price_usd).toBeDefined());
  });
});
