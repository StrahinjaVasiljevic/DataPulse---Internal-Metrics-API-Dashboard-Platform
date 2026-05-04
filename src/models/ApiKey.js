/**
 * ApiKey model — workspace-scoped, rotatable
 */

'use strict';

const crypto = require('crypto');

const keys = new Map(); // key_hash → record

const ApiKeyModel = {
  generate(workspace_id, { name = 'default', role = 'editor' } = {}) {
    const rawKey = `dp_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const record = {
      id: `key_${Date.now()}`,
      workspace_id,
      name,
      role,
      key_prefix: rawKey.slice(0, 8) + '...',
      hash,
      created_at: new Date().toISOString(),
      last_used_at: null,
      usage_count: 0,
      revoked: false,
    };

    keys.set(hash, record);
    // Vraća raw key SAMO pri kreiranju — posle nikad
    return { ...record, raw_key: rawKey };
  },

  findByKey(rawKey) {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return keys.get(hash) || null;
  },

  listByWorkspace(workspace_id) {
    return [...keys.values()]
      .filter(k => k.workspace_id === workspace_id)
      .map(({ hash, ...safe }) => safe); // nikad ne vraćaj hash
  },

  revoke(workspace_id, keyId) {
    for (const [hash, record] of keys.entries()) {
      if (record.workspace_id === workspace_id && record.id === keyId) {
        record.revoked = true;
        record.revoked_at = new Date().toISOString();
        return true;
      }
    }
    return false;
  },

  recordUsage(rawKey) {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const record = keys.get(hash);
    if (record) {
      record.last_used_at = new Date().toISOString();
      record.usage_count++;
    }
  },

  _clear() { keys.clear(); },
};

module.exports = ApiKeyModel;
