const { Pool } = require('pg');

const memoryStore = [];
let pool = null;
let connected = false;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.connect()
    .then(() => { connected = true; console.log('PostgreSQL connected'); })
    .catch(err => console.warn('PostgreSQL unavailable, using memory store:', err.message));
}

async function query(text, params) {
  if (!connected) throw new Error('No database connection');
  return pool.query(text, params);
}

module.exports = { query, isConnected: () => connected, memoryStore };

