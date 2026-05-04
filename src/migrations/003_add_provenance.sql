-- Migration 003: Provenance polja na metric_events

ALTER TABLE metric_events
    ADD COLUMN IF NOT EXISTS source              TEXT,
    ADD COLUMN IF NOT EXISTS producer_version    TEXT,
    ADD COLUMN IF NOT EXISTS event_timestamp     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS is_backfill         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ingestion_latency_ms INTEGER,
    ADD COLUMN IF NOT EXISTS idempotency_key     TEXT UNIQUE;

-- Backfill starih redova
UPDATE metric_events SET event_timestamp = created_at WHERE event_timestamp IS NULL;
UPDATE metric_events SET ingested_at = created_at WHERE ingested_at IS NULL;

-- Indexi za provenance upite
CREATE INDEX idx_events_source ON metric_events (workspace_id, source);
CREATE INDEX idx_events_event_timestamp ON metric_events (workspace_id, metric_name, event_timestamp DESC);
CREATE UNIQUE INDEX idx_events_idempotency ON metric_events (idempotency_key) WHERE idempotency_key IS NOT NULL;
