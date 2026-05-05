'use strict';

const UserModel = require('../src/models/User');
const ApiKeyModel = require('../src/models/ApiKey');
const AuditLog = require('../src/models/AuditLog');

beforeEach(() => {
  UserModel._clear();
  ApiKeyModel._clear();
  AuditLog._clear();
});

describe('UserModel', () => {
  test('findOrCreate kreira novog korisnika', () => {
    const user = UserModel.findOrCreate('ana@co.com', 'ws1', 'editor');
    expect(user.email).toBe('ana@co.com');
    expect(user.workspace_id).toBe('ws1');
    expect(user.role).toBe('editor');
    expect(user.id).toBeDefined();
  });

  test('findOrCreate vraća postojećeg korisnika', () => {
    const u1 = UserModel.findOrCreate('ana@co.com', 'ws1');
    const u2 = UserModel.findOrCreate('ana@co.com', 'ws1');
    expect(u1.id).toBe(u2.id);
  });

  test('updateRole mijenja ulogu', () => {
    UserModel.findOrCreate('bob@co.com', 'ws1', 'viewer');
    UserModel.updateRole('bob@co.com', 'editor');
    const user = UserModel.findByEmail('bob@co.com');
    expect(user.role).toBe('editor');
  });

  test('_listByWorkspace vraća samo korisnike tog workspacea', () => {
    UserModel.findOrCreate('a@x.com', 'ws1');
    UserModel.findOrCreate('b@x.com', 'ws1');
    UserModel.findOrCreate('c@x.com', 'ws2');
    const list = UserModel._listByWorkspace('ws1');
    expect(list).toHaveLength(2);
    expect(list.every(u => u.workspace_id === 'ws1')).toBe(true);
  });
});

describe('Magic link', () => {
  test('kreira i verifikuje magic link', () => {
    UserModel.findOrCreate('ivan@co.com', 'ws1', 'editor');
    const token = UserModel.createMagicLink('ivan@co.com');
    expect(token).toBeDefined();
    const user = UserModel.verifyMagicLink(token);
    expect(user.email).toBe('ivan@co.com');
    expect(user.last_login).toBeDefined();
  });

  test('magic link je one-time use', () => {
    UserModel.findOrCreate('ivan@co.com', 'ws1');
    const token = UserModel.createMagicLink('ivan@co.com');
    UserModel.verifyMagicLink(token);
    const second = UserModel.verifyMagicLink(token);
    expect(second).toBeNull();
  });

  test('vraća null za nepostojeći token', () => {
    const result = UserModel.verifyMagicLink('nonexistent-token');
    expect(result).toBeNull();
  });
});

describe('ApiKeyModel', () => {
  test('generiše API ključ sa raw_key', () => {
    const key = ApiKeyModel.generate('ws1', { name: 'ci', role: 'editor' });
    expect(key.raw_key).toBeDefined();
    expect(key.raw_key).toMatch(/^dp_/);
    expect(key.workspace_id).toBe('ws1');
    expect(key.role).toBe('editor');
  });

  test('findByKey pronalazi ključ po raw vrijednosti', () => {
    const key = ApiKeyModel.generate('ws1');
    const found = ApiKeyModel.findByKey(key.raw_key);
    expect(found).not.toBeNull();
    expect(found.workspace_id).toBe('ws1');
  });

  test('findByKey vraća null za nevažeći ključ', () => {
    expect(ApiKeyModel.findByKey('invalid_key')).toBeNull();
  });

  test('revoke onemogućava ključ', () => {
    const key = ApiKeyModel.generate('ws1');
    ApiKeyModel.revoke('ws1', key.id);
    const found = ApiKeyModel.findByKey(key.raw_key);
    expect(found.revoked).toBe(true);
  });

  test('listByWorkspace ne vraća hash', () => {
    ApiKeyModel.generate('ws1', { name: 'k1' });
    ApiKeyModel.generate('ws1', { name: 'k2' });
    const list = ApiKeyModel.listByWorkspace('ws1');
    expect(list).toHaveLength(2);
    list.forEach(k => expect(k.hash).toBeUndefined());
  });

  test('recordUsage inkrementuje usage_count', () => {
    const key = ApiKeyModel.generate('ws1');
    ApiKeyModel.recordUsage(key.raw_key);
    ApiKeyModel.recordUsage(key.raw_key);
    const found = ApiKeyModel.findByKey(key.raw_key);
    expect(found.usage_count).toBe(2);
  });
});

describe('AuditLog', () => {
  test('bilježi i dohvaća eventi', () => {
    AuditLog.record({ workspace_id: 'ws1', actor: 'admin@x.com', action: 'key.created', target: 'key_1' });
    AuditLog.record({ workspace_id: 'ws1', actor: 'admin@x.com', action: 'contract.created', target: 'metric_a' });
    AuditLog.record({ workspace_id: 'ws2', actor: 'other@x.com', action: 'key.created', target: 'key_2' });

    const ws1 = AuditLog.getByWorkspace('ws1');
    expect(ws1).toHaveLength(2);
    expect(ws1.every(e => e.workspace_id === 'ws1')).toBe(true);
  });

  test('filtrira po action', () => {
    AuditLog.record({ workspace_id: 'ws1', actor: 'a', action: 'key.created', target: 'k1' });
    AuditLog.record({ workspace_id: 'ws1', actor: 'a', action: 'contract.created', target: 'c1' });
    const filtered = AuditLog.getByWorkspace('ws1', { action: 'key.created' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe('key.created');
  });

  test('svaki zapis ima id i timestamp', () => {
    const entry = AuditLog.record({ workspace_id: 'ws1', actor: 'x', action: 'test', target: 'y' });
    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
  });
});
