const AlertEngine = require('../src/services/alertEngine');
const AlertHistory = require('../src/models/AlertHistory');

jest.mock('../src/services/alertDelivery', () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  if (AlertHistory._clear) AlertHistory._clear();
});

describe('AlertEngine', () => {
  test('fires alert when condition is met', async () => {
    const alert = {
      id: 'a1', workspace_id: 'ws1', metric_name: 'users',
      condition: 'above', threshold: 500, cooldown_minutes: 0, severity: 'critical',
    };
    await AlertEngine.evaluate(alert, 600);
    const history = AlertHistory.getByAlert('a1');
    expect(history[0].status).toBe('fired');
  });

  test('suppresses alert during cooldown', async () => {
    const alert = {
      id: 'a2', workspace_id: 'ws1', metric_name: 'users',
      condition: 'above', threshold: 500, cooldown_minutes: 60, severity: 'warn',
    };
    await AlertEngine.evaluate(alert, 600);
    await AlertEngine.evaluate(alert, 601);
    const history = AlertHistory.getByAlert('a2');
    expect(history.some(h => h.status === 'suppressed')).toBe(true);
  });

  test('does not fire when condition is not met', async () => {
    const alertDelivery = require('../src/services/alertDelivery');
    alertDelivery.dispatch.mockClear();
    const alert = {
      id: 'a3', workspace_id: 'ws1', metric_name: 'latency',
      condition: 'above', threshold: 1000, cooldown_minutes: 0,
    };
    await AlertEngine.evaluate(alert, 50);
    expect(alertDelivery.dispatch).not.toHaveBeenCalled();
  });
});
