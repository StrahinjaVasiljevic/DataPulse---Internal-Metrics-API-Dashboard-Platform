'use strict';

const violations = []; // In-memory; zameni sa DB

const ViolationLog = {
  record(entry) {
    violations.push({ id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...entry });
    // Drži poslednjih 1000
    if (violations.length > 1000) violations.shift();
  },

  getByWorkspaceAndMetric(workspace_id, metric_name, limit = 10) {
    return violations
      .filter(v => v.workspace_id === workspace_id && v.metric_name === metric_name)
      .slice(-limit)
      .reverse();
  },

  getByWorkspace(workspace_id, limit = 50) {
    return violations
      .filter(v => v.workspace_id === workspace_id)
      .slice(-limit)
      .reverse();
  },

  _clear() { violations.length = 0; },
};

module.exports = ViolationLog;
