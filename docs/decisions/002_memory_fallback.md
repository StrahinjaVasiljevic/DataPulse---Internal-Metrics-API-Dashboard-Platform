# 002 — In-Memory Fallback for Development
Date: 2026-04-30 · Status: Accepted

## Decision
When no DATABASE_URL is set, the API falls back to an in-memory store instead of failing.

## Context
Developers evaluating the API should not need to provision Postgres to test ingestion. The fallback allows the full API surface to work in development with zero infrastructure.

## Alternatives Considered
Requiring Postgres for all environments — rejected because it raises the barrier to first-run success, which is the most critical moment in developer tool adoption.

