'use strict';

const AlertModel = require('../src/models/Alert');
const AlertHistory = require('../src/models/AlertHistory');
const DeadLetterLog = require('../src/models/DeadLetterLog');
const { evaluateAlert, previewAlert, _wouldFire } = require('../src/alerts/engine');
const { checkAlerts } = require('../src/alerts/engine');

jest.mock('../src/services/alertDelivery', () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  AlertModel._clear();
  AlertHistory._clear();
  DeadLetterLog._clear();
  require('../src/services/alertDelivery').dispatch.mockClear();
});

describe('AlertModel', () => {
  test('kreira alert sa ispravnim poljima', () => {
    const alert = AlertModel.create('ws1', {
      metric_name: 'error_rate',
      condition: 'above',
      threshold: 5,
      severity: 'critical',
      cooldown_minutes: 30,
    });
    expect(alert.id).toBeDefined();
    expect(alert.severity).toBe('critical');
    expect(alert.cooldown_minutes).toBe(30);
    expect(alert.enabled).toBe(true);
  });

  test('baca grešku za nevalidan condition', () => {
    expect(() => AlertModel.create('ws1', {
      metric_name: 'users', condition: 'invalid', threshold: 100,
    })).toThrow(/condition must be one of/i);
  });

  test('lista alertova po workspaceu', () => {
    AlertModel.create('ws1', { metric_name: 'a', condition: 'above', threshold: 1 });
    AlertModel.create('ws1', { metric_name: 'b', condition: 'below', threshold: 2 });
    AlertModel.create('ws2', { metric_name: 'c', condition: 'above', threshold: 3 });
    expect(AlertModel.list('ws1')).toHaveLength(2);
    expect(AlertModel.list('ws2')).toHaveLength(1);
  });

  test('update alert', () => {
    const alert = AlertModel.create('ws1', {
      metric_name: 'dau', condition: 'below', threshold: 100,
    });
    const updated = AlertModel.update('ws1', alert.id, { threshold: 200, severity: 'critical' });
    expect(updated.threshold).toBe(200);
    expect(updated.severity).toBe('critical');
  });

  test('delete alert', () => {
    const alert = AlertModel.create('ws1', {
      metric_name: 'mau', condition: 'below', threshold: 500,
    });
    expect(AlertModel.delete('ws1', alert.id)).toBe(true);
    expect(AlertModel.list('ws1')).toHaveLength(0);
  });

  test('seedDefaults popunjava defaultne alertove', () => {
    AlertModel.seedDefaults('ws_seed');
    expect(AlertModel.list('ws_seed').length).toBeGreaterThanOrEqual(3);
  });
});

describe('_wouldFire', () => {
  const base = { condition: 'above', threshold: 100 };
  test('above — okida kada je vrijednost veća', () => {
    expect(_wouldFire({ ...base, condition: 'above' }, 101)).toBe(true);
    expect(_wouldFire({ ...base, condition: 'above' }, 100)).toBe(false);
  });
  test('below — okida kada je vrijednost manja', () => {
    expect(_wouldFire({ ...base, condition: 'below' }, 99)).toBe(true);
    expect(_wouldFire({ ...base, condition: 'below' }, 100)).toBe(false);
  });
  test('equals — okida samo na tačnu vrijednost', () => {
    expect(_wouldFire({ ...base, condition: 'equals' }, 100)).toBe(true);
    expect(_wouldFire({ ...base, condition: 'equals' }, 101)).toBe(false);
  });
});

describe('evaluateAlert', () => {
  test('okida alert i bilježi u historiju', async () => {
    const alert = AlertModel.create('ws1', {
      metric_name: 'cpu', condition: 'above', threshold: 80,
      severity: 'critical', cooldown_minutes: 0,
    });
    await evaluateAlert(alert, 95);
    const history = AlertHistory.getByAlert(alert.id);
    expect(history[0].status).toBe('fired');
    expect(history[0].triggered_value).toBe(95);
  });

  test('ne okida kada uvjet nije ispunjen', async () => {
    const delivery = require('../src/services/alertDelivery');
    const alert = AlertModel.create('ws1', {
      metric_name: 'cpu', condition: 'above', threshold: 80, cooldown_minutes: 0,
    });
    await evaluateAlert(alert, 50);
    expect(delivery.dispatch).not.toHaveBeenCalled();
  });

  test('suppresses tokom cooldown perioda', async () => {
    const alert = AlertModel.create('ws1', {
      metric_name: 'mem', condition: 'above', threshold: 70, cooldown_minutes: 60,
    });
    await evaluateAlert(alert, 90);
    await evaluateAlert(alert, 91);
    const history = AlertHistory.getByAlert(alert.id);
    expect(history.some(h => h.status === 'suppressed')).toBe(true);
  });

  test('ne okida disabled alert', async () => {
    const delivery = require('../src/services/alertDelivery');
    const alert = AlertModel.create('ws1', {
      metric_name: 'disk', condition: 'above', threshold: 90,
      cooldown_minutes: 0, enabled: false,
    });
    await evaluateAlert(alert, 99);
    expect(delivery.dispatch).not.toHaveBeenCalled();
  });
});

describe('previewAlert', () => {
  test('broji koliko puta bi se okino', () => {
    const alert = { condition: 'above', threshold: 100 };
    const dataPoints = [
      { value: 50, timestamp: '2026-01-01' },
      { value: 120, timestamp: '2026-01-02' },
      { value: 130, timestamp: '2026-01-03' },
      { value: 80, timestamp: '2026-01-04' },
    ];
    const preview = previewAlert(alert, dataPoints);
    expect(preview.would_fire_count).toBe(2);
    expect(preview.total_evaluated).toBe(4);
    expect(preview.noise_level).toBe('low');
  });

  test('vraća sample_firings', () => {
    const alert = { condition: 'below', threshold: 100 };
    const dataPoints = Array.from({ length: 10 }, (_, i) => ({
      value: 50 + i, timestamp: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }));
    const preview = previewAlert(alert, dataPoints);
    expect(preview.sample_firings.length).toBeLessThanOrEqual(5);
  });
});

describe('checkAlerts — backwards compat', () => {
  test('seed-uje defaultne alertove i evaluira', async () => {
    await checkAlerts({ metric: 'churn_rate', value: 99 }, 'ws_compat');
    const alerts = AlertModel.list('ws_compat');
    expect(alerts.length).toBeGreaterThan(0);
  });
});
