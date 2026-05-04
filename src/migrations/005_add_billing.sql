-- Migration 005: Billing scaffold

CREATE TABLE IF NOT EXISTS workspace_plans (
    workspace_id    TEXT PRIMARY KEY,
    plan_name       TEXT NOT NULL DEFAULT 'free' CHECK (plan_name IN ('free', 'team', 'business')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_end TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    TEXT NOT NULL,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    metrics_count   INTEGER NOT NULL DEFAULT 0,
    ingestions_count INTEGER NOT NULL DEFAULT 0,
    alerts_fired    INTEGER NOT NULL DEFAULT 0,
    dashboard_views INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
