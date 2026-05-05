'use strict';

/**
 * Structured logger — JSON format za produkciju, human-readable za dev
 *
 * Non-goals: nije log aggregation (Datadog, Papertrail)
 *            nije async log queue
 */

const IS_PROD = process.env.NODE_ENV === 'production';

function _entry(level, message, meta = {}) {
  if (IS_PROD) {
    process.stdout.write(JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }) + '\n');
  } else {
    const prefix = { info: '✅', warn: '⚠️ ', error: '❌', debug: '🔍' }[level] || '  ';
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    console.log(`${prefix} [${level.toUpperCase()}] ${message}${metaStr}`);
  }
}

const logger = {
  info:  (msg, meta = {}) => _entry('info',  msg, meta),
  warn:  (msg, meta = {}) => _entry('warn',  msg, meta),
  error: (msg, meta = {}) => _entry('error', msg, meta),
  debug: (msg, meta = {}) => _entry('debug', msg, meta),
};

module.exports = logger;
