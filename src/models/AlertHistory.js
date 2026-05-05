'use strict';

const history = [];

const AlertHistory = {
  record(entry) {
    history.push({
      id: `ah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...entry,
    });
    if (history.length > 2000) history.shift();
  },

  getByAlert(alert_id, limit = 50) {
    return history
      .filter(h => h.alert_id === alert_id)
      .slice(-limit)
      .reverse();
  },

  getByWorkspace(workspace_id, limit = 100) {
    return history
      .filter(h => h.workspace_id === workspace_id)
      .slice(-limit)
      .reverse();
  },

  _clear() { history.length = 0; },
};

module.exports = AlertHistory;
