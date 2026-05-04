# 001 — API-First Architecture
Date: 2026-04-30 · Status: Accepted

## Decision
Build ingestion and retrieval as a standalone REST API before any dashboard UI.

## Context
The dashboard is a consumer of the API, not the product itself. API-first means any team can build their own visualization layer on top — the platform is composable by design.

## Alternatives Considered
UI-first with backend built to serve it — rejected because it creates tight coupling where API design is driven by frontend needs rather than data model clarity.

