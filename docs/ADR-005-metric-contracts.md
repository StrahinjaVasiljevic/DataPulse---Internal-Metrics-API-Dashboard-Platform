# ADR-005: Metric Contracts

**Status:** Accepted  
**Date:** 2026-05-04  
**Deciders:** Engineering team

## Context

Metrics arrive from multiple sources without formal specification. This leads to:
- Silent schema drift (unit changes, value range changes)
- Trust erosion ("which number is correct?")
- No way to detect producer errors programmatically

## Decision

Introduce MetricContract as a formal per-metric specification stored server-side. Validated on every ingestion.

## Consequences

**Positive:**
- Explicit trust signals on dashboard
- Automatic detection of producer-side regressions
- Audit trail of contract changes

**Negative:**
- Small ingestion overhead (~1ms per validation)
- Teams must define contracts (but can start in warn mode)

## Non-goals

- Not a replacement for Confluent Schema Registry
- Not a runtime streaming validator
- Not a type system for arbitrary nested schemas
