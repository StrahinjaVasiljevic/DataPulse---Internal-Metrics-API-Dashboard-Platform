# DataPulse — Internal Metrics API & Dashboard Platform (Case Study)

**Status:** MVP shipped, active development  
**Type:** Internal tool / platform (API-first) for KPI tracking across multiple data sources  
**Live API:** https://datapulse-production.up.railway.app  
**Role:** Product Owner / PM (end-to-end) + execution (hands-on)

---

## 1. Context & Problem

Teams of 10–200 people often track KPIs across Postgres, Stripe, Mixpanel, and spreadsheets, but lack the time and budget for full BI platforms (e.g., Looker/Tableau). The result is recurring “can someone pull this number?” interruptions, fragile spreadsheet workflows, and weekly reviews spent debating which number is correct. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Who has the problem
- Engineering managers, product managers, founders in small/medium teams with scattered data sources. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Why existing solutions fail for this segment
- Requires SQL literacy for customization and/or assumes a data warehouse exists.
- Metric definitions are tribal knowledge (not enforced), leading to trust collapse over time. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 2. Goal (What success looks like)

**Product goal:** Make KPI visibility self-serve and consistent without requiring SQL or a warehouse. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

**North Star Metric (recommended):**
- % of weekly KPI checks done without engineering help (self-serve rate)

**Secondary metrics (recommended):**
- Time-to-add-a-metric-source (target: < 5 minutes) [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)
- Time spent in weekly metrics meeting debating “correct number”
- # of active dashboards / week per workspace
- Trust signal: # of versioned metric definitions vs ad-hoc definitions [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 3. Solution Overview

DataPulse provides three layers:
1) **Ingestion API** — accepts metric payloads from any source via REST, consistent schema, versioned.  
2) **Normalization engine** — maps incoming data to a unified metric schema regardless of source format.  
3) **Dashboard renderer** — configurable, shareable dashboard that anyone can read without SQL. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

**Core user behaviors**
- Data engineer registers a new metric source via API quickly.
- PM checks weekly KPI dashboard without opening a DB.
- EM sets threshold alerts via webhook.
- Founder checks exec dashboard before board meetings.
- Analyst exports normalized metric history as CSV. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 4. Key Product Decisions (and why they matter)

### Decision 1 — Single unified schema for all metric types
**Why:** Teams fail at metrics because “active user” is defined differently across teams. Enforcing a schema at ingestion forces explicit metric definitions. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Decision 2 — API-first, dashboard second
**Why:** Dashboard is a consumer of the API, not the product itself. API-first makes the platform composable and compatible with existing visualization layers. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Decision 3 — No drag-and-drop dashboard builder at MVP
**Why:** Builders delay validation of the core trust layer. MVP focuses on the few views users consistently need: current value, trend, anomaly flags. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Decision 4 — Metric versioning from day one
**Why:** Metric definitions change; without versioning, historical comparisons silently break and trust collapses. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

### Decision 5 — In-memory fallback for development
**Why:** Zero-infrastructure first-run reduces adoption friction in the first 10 minutes. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 5. Alternatives Considered (Trade-offs)

- **Metabase/Redash:** fast, familiar; but requires centralized DB and SQL literacy; DataPulse sits below and can feed them if needed. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)  
- **dbt/Cube.js:** powerful, scalable; but assumes a warehouse; too heavy for the target segment. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)  
- **Sheets + Zapier:** “works” early; breaks at 3–4 sources, formulas are fragile, no programmatic API access. [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 6. MVP Scope (What shipped)

**Included**
- REST ingestion endpoint (POST /api/metrics)
- Schema validation + normalization
- Time-series storage per metric
- GET current value + history
- Dashboard summary endpoint
- Threshold alerts via webhook
- API key auth per workspace
- In-memory fallback
- Embeddable JS widget
- Railway auto-deploy on git push [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

**Intentionally excluded**
- Drag-and-drop builder
- Native DB connectors
- Roles/permissions beyond API key
- Slack/email alerts (webhook only)
- Multi-tenant billing [1](https://github.com/StrahinjaVasiljevic/DataPulse---Internal-Metrics-API-Dashboard-Platform)

---

## 7. Results (Fill with real numbers)

**What we measured (recommended)**
- Time-to-first-dashboard: [X minutes]
- Time-to-add-metric-source: [X minutes] (target < 5 minutes)
- Weekly self-serve KPI checks: [+X%]
- Reduction in “pull this number” requests: [-X%]
- Adoption: [# workspaces], [# active dashboards/week]

**What we learned**
- The trust layer (schema + versioning) is the real product.
- Adoption improves when onboarding is “zero-infra” and demoable in minutes.
- Alerting increases perceived value for engineering leadership.

---

## 8. What’s next (Roadmap themes)

- Native connectors (Postgres/Stripe/Mixpanel) once trust is validated.
- Role-based access & permissions (workspace governance).
- Alert integrations (Slack/email) and anomaly detection.
- Metric dependency graph (only if users ask for it and core usage is strong).

---

## 9. Artifacts (for interview)
- README + Roadmap
- ADR / decision docs
- Architecture diagram
- Live API endpoint demo
