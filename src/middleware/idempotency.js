/**
 * Idempotency middleware
 * Sprečava duplikate pri retries
 * Header: X-Idempotency-Key
 * TTL: 24h (in-memory; zameni sa Redis u produkciji)
 */

'use strict';

const processed = new Map(); // key → { result, timestamp }
const TTL_MS = 24 * 60 * 60 * 1000;

function checkIdempotency(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  req.idempotencyKey = key;

  const cached = processed.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < TTL_MS) {
      return res.status(200).json({
        ...cached.result,
        idempotent_replay: true,
      });
    }
    processed.delete(key); // Expired
  }

  next();
}

function markProcessed(key, result) {
  processed.set(key, { result, timestamp: Date.now() });
  // Cleanup starih ključeva
  for (const [k, v] of processed.entries()) {
    if (Date.now() - v.timestamp > TTL_MS) processed.delete(k);
  }
}

module.exports = { checkIdempotency, markProcessed };
