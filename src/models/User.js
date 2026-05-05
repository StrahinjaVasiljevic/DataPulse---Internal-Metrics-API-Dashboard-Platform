'use strict';

const crypto = require('crypto');

const users = new Map();    // email → user
const magicLinks = new Map(); // token → { email, expires_at }

const UserModel = {
  findOrCreate(email, workspace_id, role = 'viewer') {
    if (users.has(email)) return users.get(email);
    const user = {
      id: `user_${crypto.randomBytes(8).toString('hex')}`,
      email,
      workspace_id,
      role,
      created_at: new Date().toISOString(),
      last_login: null,
    };
    users.set(email, user);
    return user;
  },

  findByEmail(email) {
    return users.get(email) || null;
  },

  updateRole(email, role) {
    const user = users.get(email);
    if (user) user.role = role;
    return user;
  },

  _listByWorkspace(workspace_id) {
    return [...users.values()].filter(u => u.workspace_id === workspace_id);
  },

  createMagicLink(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = Date.now() + 15 * 60 * 1000; // 15 min
    magicLinks.set(token, { email, expires_at });
    return token;
  },

  verifyMagicLink(token) {
    const link = magicLinks.get(token);
    if (!link) return null;
    if (Date.now() > link.expires_at) {
      magicLinks.delete(token);
      return null;
    }
    magicLinks.delete(token);
    const user = users.get(link.email);
    if (user) user.last_login = new Date().toISOString();
    return user;
  },

  _clear() {
    users.clear();
    magicLinks.clear();
  },
};

module.exports = UserModel;
