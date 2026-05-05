'use strict';

/**
 * DB client — PostgreSQL sa in-memory fallback
 *
 * Features:
 * - Connection pool sa konfigurisanim limitima
 * - Structured error logging
 * - isConnected() health check
 * - memoryStore za dev/test
 *
 * Non-goals: nije ORM, nije query builder
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

const memoryStore = [];
let pool = null;
let connected = false;
const startTime = Date.now();

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                // max connections u pool-u
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });

  pool.connect()
    .then(client => {
      connected = true;
      client.release();
      logger.info('PostgreSQL connected', { url: process.env.DATABASE_URL.split('@')[1] });
    })
    .catch(err => {
      logger.warn('PostgreSQL unavailable, using memory store', { error: err.message });
    });

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error', { error: err.message });
    connected = false;
  });
}

async function query(text, params) {
  if (!connected) throw new Error('No database connection');
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn('Slow query detected', { duration_ms: duration, query: text.slice(0, 80) });
    }
    return result;
  } catch (err) {
    logger.error('Query failed', { error: err.message, query: text.slice(0, 80) });
    throw err;
  }
}

function getStatus() {
  return {
    connected,
    mode:          connected ? 'postgres' : 'memory',
    memory_records: memoryStore.length,
    uptime_ms:     Date.now() - startTime,
    pool_total:    pool?.totalCount    ?? 0,
    pool_idle:     pool?.idleCount     ?? 0,
    pool_waiting:  pool?.waitingCount  ?? 0,
  };
}

module.exports = {
  query,
  isConnected: () => connected,
  getStatus,
  memoryStore,
};
