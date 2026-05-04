# DataPulse - Internal Metrics API & Dashboard Platform

> **Status:** MVP shipped · Active development
> **Type:** Internal Tool · Platform / API · Data & Analytics
> **Live API:** https://datapulse-metrics-production.up.railway.app/
> **Instructions:** Download Raw test.html file from Github. Open file trough Web browser. Fill in data and Send Metrics. Data Metrics is stored in: https://datapulse-metrics-production.up.railway.app/api/dashboard/dev_workspace
---

## Component Status

| Component | Status |
|---|---|
| Metrics ingestion API | ✅ Live |
| Multi-source data pipeline | ✅ Working |
| Dashboard renderer | ✅ Working |
| Embeddable widget | ✅ Ready |
| Railway deployment | ✅ Auto-deploy on git push |
| README + Roadmap | ✅ On GitHub |
| Architecture documented | ✅ ADR files |

---

## 1. Product Overview

DataPulse is a lightweight internal metrics API and dashboard platform built for engineering and product teams that track KPIs across multiple data sources but lack the bandwidth — or the budget — for a full-scale BI platform like Looker or Tableau. It exposes a single unified API that ingests metrics from any source (database query, third-party API, manual CSV upload), normalizes them into a consistent schema, and renders them in a configurable dashboard that any team member can read without SQL knowledge.

The goal is not to replace a data warehouse. It is to eliminate the "can someone pull this number for me?" request that interrupts data engineers 15 times a week — and replace it with a self-serve layer that product, engineering, and leadership can use independently.

---

## 2. Problem Statement

**Who has the problem:**
Engineering managers, product managers, and founders at companies with 10–200 employees who have data scattered across Postgres, Stripe, Mixpanel, and spreadsheets — but no centralized place to view it.

**How it is solved today:**
Someone writes a SQL query. Someone else exports a CSV. A third person builds a one-off Google Sheet with VLOOKUP formulas that break every time a column changes. The result is a weekly metrics review meeting where 20 minutes are spent debating which number is correct.

**Why that is not optimal:**
- No single source of truth across data sources
- Metrics definitions are tribal knowledge — not documented, not enforced
- Every new dashboard requires engineering time, which competes with product work
- Data is stale by the time it reaches a decision-maker

---

## 3. Proposed Solution

DataPulse provides three layers:

1. **Ingestion API** — accepts metric payloads from any source via REST. One endpoint, consistent schema, versioned.
2. **Normalization engine** — maps incoming data to a unified metric schema regardless of source format.
3. **Dashboard renderer** — renders metrics in a configurable, shareable dashboard. No SQL, no code required.

**Core user behaviors / use cases:**

| Actor | Use Case |
|---|---|
| Data Engineer | Registers a new metric source via API in under 5 minutes |
| Product Manager | Checks weekly KPI dashboard without opening a database |
| Engineering Manager | Sets up an alert when a metric crosses a threshold |
| Founder | Views a single executive dashboard before board meetings |
| Analyst | Exports normalized metric history as CSV for ad-hoc analysis |

---

## 4. Key Product Decisions

### Decision 1 — Single unified schema for all metric types
**Why:** Teams fail at metrics not because of tooling but because every team defines "active user" differently. Enforcing a schema at ingestion time forces explicit metric definitions. This is a product decision disguised as a technical one.

### Decision 2 — API-first, dashboard second
**Why:** The dashboard is a consumer of the API, not the product itself. Building API-first means any team can build their own visualization layer on top. The platform is composable — it plugs into existing workflows rather than replacing them.

### Decision 3 — No drag-and-drop dashboard builder at MVP
**Why:** Custom builders delay validation of whether the core data layer is trusted — which is the only thing that matters at MVP. Every team we spoke to wanted the same three views: current value, trend over time, anomaly flags.

### Decision 4 — Metric versioning from day one
**Why:** Metric definitions change. If you do not version them, historical comparisons break silently and trust collapses. Versioning is cheap to add early and extremely expensive to retrofit.

### Decision 5 — In-memory fallback for development
**Why:** Developers evaluating the API should not need to provision Postgres to test ingestion. Zero-infrastructure first-run lowers the barrier to adoption at the most critical moment — the first 10 minutes.

---

## 5. Alternatives & Trade-offs

### Alternative A — Use Metabase or Redash
**Why we considered it:** Fast to deploy, familiar interface, large community.
**Why we did not choose it:** These tools require a centralized database and SQL literacy for any customization. DataPulse sits one layer below and can feed them if needed — it does not compete with them.

### Alternative B — Build on dbt or Cube.js
**Why we considered it:** Powerful, scalable, industry-standard approach.
**Why we did not choose it:** Both assume a data warehouse exists. Most of our target users are pre-warehouse. The setup cost and learning curve eliminate the segment we are building for.

### Alternative C — Google Sheets + Zapier
**Why we considered it:** Zero infrastructure, teams already use it.
**Why we did not choose it:** Does not scale past 3–4 metric sources, formulas break with schema changes, no API layer for programmatic access. It is where our users are coming from, not where they are going.

---

## 6. MVP Scope

### Included
- REST API for metric ingestion (`POST /api/metrics`)
- Schema validation and normalization engine
- Time-series storage per metric
- `GET /api/metrics/:name` — current value
- `GET /api/metrics/:name/history` — time series (7/30/90 day)
- `GET /api/dashboard/:workspaceId` — dashboard summary
- Threshold-based alert system with webhook delivery
- API key authentication per workspace
- In-memory fallback for development (no Postgres required)
- Embeddable JS widget for manual metric ingestion

### Intentionally excluded from MVP
- Drag-and-drop dashboard builder
- Native database connectors (Postgres, MySQL direct query)
- Metric dependency graph
- User roles and permissions beyond API key
- Slack / email alert delivery (webhook only)
- Multi-tenant billing

---

## Architecture Overview
