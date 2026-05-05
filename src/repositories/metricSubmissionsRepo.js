const { randomUUID } = require('uuid');

class MetricSubmissionsRepo {
  constructor() {
    this.items = [];
  }

  create(data) {
    const row = {
      id: randomUUID(),
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    this.items.unshift(row);
    return row;
  }

  list({ page = 1, pageSize = 20 }) {
    const start = (page - 1) * pageSize;
    return {
      total: this.items.length,
      rows: this.items.slice(start, start + pageSize),
    };
  }

  get(id) {
    return this.items.find(i => i.id === id);
  }

  update(id, patch) {
    const row = this.get(id);
    if (!row) return null;
    Object.assign(row, patch, {
      updated_at: new Date().toISOString(),
    });
    return row;
  }
}

module.exports = { MetricSubmissionsRepo };
