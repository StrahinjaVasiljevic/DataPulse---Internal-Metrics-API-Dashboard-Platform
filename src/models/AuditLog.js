/**
 * AuditLog — nepromenljiv log akcija
 * 
 * Beleži: contract kreiranje/brisanje, key rotacija, alert promene, role promene
 */

'use strict';

const crypto = require('crypto');
const log = [];

const AuditLog = {
  record({ workspace_id, actor, action, target, metadata = {} }) {
    const entry = {
      id: `audit_${crypto.randomBytes(6).toString('hex')}`,
      workspace_id,
      actor,       // email ili API key prefix
      action,      // "contract.created", "key.rotated", "alert.updated", etc.
      target,      // šta je pogođeno
      metadata,
      timestamp: new Date().toISOString(),
    };
    log.push(entry);
    if (log.length > 5000) log.shift();
    return entry;
  },

  getByWorkspace(workspace_id, { limit = 50, action } = {}) {
    return log
      .filter(e => e.workspace_id === workspace_id && (!action || e.action === action))
      .slice(-limit)
      .reverse();
  },

  _clear() { log.length = 0; },
};

module.exports = AuditLog;
