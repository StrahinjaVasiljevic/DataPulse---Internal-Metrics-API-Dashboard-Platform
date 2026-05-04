'use strict';

const { v4: uuidv4 } = require('uuid');

const events = [];

const MetricEvent = {
  create(payload) {
    const event = {
      id: uuidv4(),
      ...payload,
      created_at: new Date().toISOString(),
    };
    events.push(event);
    return Promise.resolve(event);
  },

  getLatest(workspace_id, metric_name) {
    const filtered = events.filter(
      e => e.workspace_id === workspace_id && e.metric_name === metric_name
    );
    return Promise.resolve(filtered[filtered.length - 1] || null);
  },

  getHistory(workspace_id, metric_name, days = 30) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = events.filter(
      e =>
        e.workspace_id === workspace_id &&
        e.metric_name === metric_name &&
        new Date(e.event_timestamp || e.created_at).getTime() >= since
    );
    return Promise.resolve(filtered);
  },

  _clear() { events.length = 0; },
};

module.exports = MetricEvent;
