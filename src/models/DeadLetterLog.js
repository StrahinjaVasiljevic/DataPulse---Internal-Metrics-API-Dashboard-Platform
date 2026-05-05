'use strict';

const log = [];

const DeadLetterLog = {
  record(entry) {
    log.push({
      id: `dl_${Date.now()}`,
      ...entry,
      recorded_at: new Date().toISOString(),
    });
    if (log.length > 500) log.shift();
  },

  getAll(limit = 50) {
    return log.slice(-limit).reverse();
  },

  getByWorkspace(workspace_id, limit = 50) {
    return log
      .filter(e => e.workspace_id === workspace_id)
      .slice(-limit)
      .reverse();
  },

  _clear() { log.length = 0; },
};

module.exports = DeadLetterLog;
