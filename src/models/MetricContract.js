/**
 * MetricContract — formalna specifikacija po metrici
 * Non-goals: nije zamena za schema registry (Confluent, etc.)
 *            nije real-time streaming validator
 */

'use strict';

// In-memory store (zameni sa DB adapterom kada Postgres bude aktivan)
const contracts = new Map(); // key: `${workspace_id}:${metric_name}`

/**
 * @typedef {Object} MetricContract
 * @property {string}   workspace_id
 * @property {string}   metric_name
 * @property {string}   description
 * @property {string}   unit              - npr. "ms", "count", "USD", "%"
 * @property {number}   [allowed_min]     - opciono
 * @property {number}   [allowed_max]     - opciono
 * @property {string}   expected_frequency - "hourly" | "daily" | "weekly" | sekunde kao broj
 * @property {string}   owner             - team ili service
 * @property {Object}   payload_shape     - { required: [], types: {} }
 * @property {string}   versioning_rules  - "breaking_requires_new_version" | "any"
 * @property {string}   violation_policy  - "hard_fail" | "warn"
 * @property {string}   created_at
 * @property {string}   updated_at
 * @property {number}   version
 */

const ContractModel = {
  /**
   * Kreira ili ažurira contract
   */
  upsert(data) {
    const key = `${data.workspace_id}:${data.metric_name}`;
    const existing = contracts.get(key);

    const contract = {
      workspace_id: data.workspace_id,
      metric_name: data.metric_name,
      description: data.description || '',
      unit: data.unit,
      allowed_min: data.allowed_min ?? null,
      allowed_max: data.allowed_max ?? null,
      expected_frequency: data.expected_frequency || 'daily',
      owner: data.owner || 'unknown',
      payload_shape: data.payload_shape || { required: ['value'], types: { value: 'number' } },
      versioning_rules: data.versioning_rules || 'breaking_requires_new_version',
      violation_policy: data.violation_policy || 'hard_fail',
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (existing?.version || 0) + 1,
    };

    contracts.set(key, contract);
    return contract;
  },

  /**
   * Dohvata contract
   */
  get(workspace_id, metric_name) {
    return contracts.get(`${workspace_id}:${metric_name}`) || null;
  },

  /**
   * Lista svih contracta za workspace
   */
  listByWorkspace(workspace_id) {
    const result = [];
    for (const [key, contract] of contracts.entries()) {
      if (key.startsWith(`${workspace_id}:`)) result.push(contract);
    }
    return result;
  },

  /**
   * Briše contract
   */
  delete(workspace_id, metric_name) {
    return contracts.delete(`${workspace_id}:${metric_name}`);
  },

  // Samo za testove
  _clear() { contracts.clear(); },
  _size() { return contracts.size; },
};

module.exports = ContractModel;
