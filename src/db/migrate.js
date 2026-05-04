const db = require('./client');

async function migrate() {
  if (!db.isConnected()) {
    console.log('No DB connection — skipping migration');
    return;
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS metrics (
      id UUID PRIMARY KEY,
      workspace_id VARCHAR(100) NOT NULL,
      metric_name VARCHAR(100) NOT NULL,
      value NUMERIC NOT NULL,
      source VARCHAR(100),
      version VARCHAR(10) DEFAULT '1',
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_lookup
    ON metrics (workspace_id, metric_name, timestamp DESC);
  `);
  console.log('Migration complete');
}

migrate().catch(console.error);

