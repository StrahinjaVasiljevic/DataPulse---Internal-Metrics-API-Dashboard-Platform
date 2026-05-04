-- Migration 002: MetricContract + ViolationLog
-- Run after: 001_initial.sql

CREATE TABLE IF NOT EXISTS metric_contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    description     TEXT,
    unit            TEXT NOT NULL,
    allowed_min     NUMERIC,
    allowed_max     NUMERIC,
    expected_frequency TEXT NOT NULL DEFAULT 'daily',
    owner           TEXT NOT NULL DEFAULT 'unknown',
    payload_shape   JSONB NOT NULL DEFAULT '{"required": ["value"], "types": {"value": "number"}}',
    versioning_rules TEXT NOT NULL DEFAULT 'breaking_requires_new_version',
    violation_policy TEXT NOT NULL DEFAULT 'hard_fail' CHECK (violation_policy IN ('hard_fail', 'warn')),
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, metric_name)
);

-- Striktna multi-tenant izolacija
CREATE INDEX idx_contracts_workspace ON metric_contracts (workspace_id);

-- Row-level security (Postgres RLS)
ALTER TABLE metric_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_workspace_isolation ON metric_contracts
    USING (workspace_id = current_setting('app.workspace_id', TRUE));

-- ViolationLog
CREATE TABLE IF NOT EXISTS violation_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('fail', 'warn')),
    errors          JSONB NOT NULL DEFAULT '[]',
    warnings        JSONB NOT NULL DEFAULT '[]',
    payload_snapshot JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_violations_workspace_metric ON violation_log (workspace_id, metric_name);
CREATE INDEX idx_violations_timestamp ON violation_log (timestamp DESC);
