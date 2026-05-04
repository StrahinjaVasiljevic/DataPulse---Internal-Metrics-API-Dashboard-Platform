
**Frontend:** React dashboard — reads exclusively from the API layer  
**Backend:** Node.js / Express monolith with modular internal structure  
**Data:** PostgreSQL for metric storage and versioning; Redis for caching; in-memory fallback for dev  
**Architecture:** Monolith with clear module boundaries (ingestion, normalization, alerts, API, db)  
**Hosting:** Railway — zero-config deploys with managed Postgres and Redis

---

## Metrics & Success

### North Star Metric
**Weekly Active Metric Sources** — the number of distinct sources that successfully pushed data to the API in a given week.

*Why this metric:* A source is "active" only if a team has integrated DataPulse into their workflow, data is flowing, and the API is trusted enough to keep sending. It captures adoption, reliability, and stickiness in one number.

### Supporting KPIs

| KPI | What it measures | Why it matters |
|---|---|---|
| API ingestion success rate | % of `POST /api/metrics` calls that pass validation | Measures API quality and integration friction |
| Dashboard weekly active users | Unique users who viewed a dashboard in 7 days | Separates data producers from data consumers |
| Time-to-first-metric (p50) | Time from first run to first successful ingest | Leading indicator of onboarding friction |
| Alert trigger-to-action rate | % of threshold alerts that resulted in a logged action | Whether alerts drive decisions, not just noise |
| CSV export frequency | Exports per workspace per month | Signals when a workspace is outgrowing MVP |

**How these metrics drive decisions:**
- If ingestion success rate drops below 90%, we stop all new feature work and fix the API contract.
- If time-to-first-metric exceeds 10 minutes (p50), we invest in onboarding, not features.
- If alert trigger-to-action rate stagnates, the problem is workflow integration — we add Slack delivery before anything else.

---

## Getting Started

```bash
git clone https://github.com/yourusername/datapulse.git
cd datapulse
npm install
cp .env.example .env
npm run dev
# API running at http://localhost:3000

Repository structure

datapulse/
├── src/
│   ├── index.js           # Entry point, Express setup
│   ├── api/routes.js      # All REST endpoints + auth middleware
│   ├── ingestion/         # Schema validation and ingestion logic
│   ├── normalization/     # Source-agnostic metric normalization
│   ├── alerts/            # Threshold monitoring and webhook delivery
│   └── db/                # Client, queries, migrations
├── dashboard/             # React frontend (metric cards + charts)
├── widget/                # Embeddable JS metric ingestion widget
├── docs/decisions/        # Architecture Decision Records (ADRs)
├── test.html              # Local widget test page
├── roadmap.md
├── .env.example
└── package.json

Built by Strahinja Vasiljevic


---

## FAJL 2 — `roadmap.md`

```markdown
# DataPulse — Product Roadmap

> Timelines are directional. Items move based on metric movement and user feedback, not calendar dates.  
> Every item is tied to a user problem or a KPI we need to move.  
> What we will not build is as important as what we will.

---

## Where We Are Now (MVP — shipped)

The core data loop works end-to-end:  
**ingest → validate → normalize → store → serve → visualize → alert**

Validated that engineering teams will integrate the API in under 5 minutes, that PMs will check the dashboard without SQL access, and that threshold alerts reduce the lag between a metric anomaly and a team response. The in-memory fallback means zero-infrastructure onboarding for new workspaces.

The foundation is solid. Now we reduce integration friction, deepen trust in the data layer, and extend the platform's reach into existing team workflows.

---

## Short-Term: Next Iteration (0–3 months)

**Goal:** Reduce integration friction. Increase the number of active metric sources per workspace.

### 1. Native Postgres connector
- **Problem:** Teams want to push metrics from their own database without writing a custom integration.
- **Approach:** Accept a read-only Postgres connection string. Run a configurable SQL query on a schedule. Auto-push results to the ingestion API.
- **Why now:** The single most requested feature from pilot workspaces. Removes the biggest integration barrier for data-engineering-light teams.

### 2. Metric definition registry
- **Problem:** Teams disagree on what a metric means. "Active user" has three different definitions across three teams.
- **Approach:** Registry where teams define metric name, description, owner, and formula before ingesting data. Enforce consistency at the API level — reject payloads for undefined metrics.
- **Why now:** Trust in the data is the product. Without agreed definitions, dashboards create arguments, not decisions.

### 3. Slack alert delivery
- **Problem:** Webhook-only alerts require engineering setup. Most team members live in Slack and miss alerts that only appear in the dashboard.
- **Approach:** Native Slack destination via OAuth. Configurable channel per alert rule. Webhook remains as fallback.
- **Why now:** Alert trigger-to-action rate stagnates without this. The alert fires but no one acts on it.

### 4. API key scoping (read vs. write)
- **Problem:** One API key per workspace — a compromised key exposes all data and all ingestion endpoints.
- **Approach:** Separate read and write scopes. Write keys for data sources, read keys for dashboard consumers and embeds.
- **Why now:** Security is a blocker for enterprise adoption conversations that are already starting.

---

## Mid-Term: Scaling & Deepening Value (3–9 months)

**Goal:** Make DataPulse the connective tissue between data sources and product decisions across the organization.

### 1. Metric dependency graph
- **Problem:** Metrics do not exist in isolation. A drop in active users might be caused by a drop in onboarding completion rate, which is caused by a bug in a specific flow. Teams cannot see these relationships today.
- **Approach:** Allow teams to define metric relationships (A influences B). Visualize as a graph. When an alert fires, surface related metrics automatically as context.
- **Why this matters:** Moves DataPulse from a monitoring tool to a diagnostic tool — a significant step-up in value that justifies higher pricing.

### 2. Native connectors — Stripe, Mixpanel, Segment
- **Problem:** Teams manually push data from common SaaS tools. This breaks silently when someone forgets to update the integration.
- **Approach:** OAuth-based pull connectors for the top 3 sources. Auto-sync on configurable schedule. Field mapping handled by the normalization engine.
- **Dependencies:** Requires metric definition registry (Short-Term item 2) to map source fields to normalized metric names.

### 3. Statistical anomaly detection
- **Problem:** Static thresholds require teams to know what "normal" looks like before setting an alert. New metrics have no baseline.
- **Approach:** After 14 days of data, compute rolling mean and standard deviation per metric. Flag values beyond 2σ as anomalies. Pure statistics — no ML required at this stage.
- **Why mid-term, not short-term:** Needs sufficient historical data to be meaningful. Shipping before we have that data generates noise, not signal — and noise destroys alert credibility.

### 4. Embeddable metric widget (iframe)
- **Problem:** Teams want to surface key metrics inside other internal tools — Notion, Confluence, custom dashboards — without opening DataPulse.
- **Approach:** Iframe-embeddable metric card with current value, trend sparkline, and delta vs. previous period. One script tag or URL to embed.
- **Why this matters:** Distribution without requiring users to change tools is the highest-leverage adoption mechanism available.

### 5. Self-serve workspace onboarding
- **Problem:** Onboarding currently requires a setup call. That does not scale past 20 customers.
- **Approach:** Interactive in-product flow: create workspace → generate API key → send test metric → configure first dashboard. Under 10 minutes, no call required.
- **Why mid-term:** We need to understand the common failure points first. We will have that data by month 3 from time-to-first-metric tracking.

---

## Long-Term: Product Vision (9–24 months)

**Goal:** Become the metrics layer that sits between raw data sources and every business decision at companies that are not yet data warehouse scale.

### Vision statement

Most companies make decisions based on metrics that are stale, inconsistently defined, or siloed in one team's spreadsheet. DataPulse's long-term vision is to make real-time, trusted, consistently-defined metrics the default input to every product, engineering, and business decision — without requiring a data team to mediate every request.

### Strategic bets

**1. Metrics as a shared organizational language**  
Every team defines metrics in their own tool today. DataPulse becomes the canonical registry — the place where "active user" has one agreed definition, one owner, and one auditable history. Other tools query DataPulse; DataPulse does not query them.

**2. Decision audit trail**  
When a metric crosses a threshold, what decision was made? What happened next? Build a lightweight decision log that links metric events to team actions. Over time this becomes a playbook: "when X drops below Y, we do Z — and here is the evidence that it works."

**3. Metrics API as a platform product**  
Expose a public API that third-party tools (project management, CRM, support) query to surface contextual metrics inline. An engineer sees the error rate next to the Jira ticket. A salesperson sees churn risk next to the Salesforce account. Metrics reach the moment of decision, not a separate dashboard tab.

**4. Predictive alerting**  
Move from "this metric crossed a threshold" to "this metric is trending toward a threshold in 72 hours." Teams act before the problem is visible in the dashboard — not after.

### What we will not build (intentionally)
- A full data warehouse or ETL pipeline — we sit on top of those; we do not replace them.
- A BI tool with drag-and-drop report builders — Metabase and Looker do this better at scale.
- A customer-facing analytics product — our buyer is internal teams, not end customers.
- A community or forum product — different modality, different buyer, different motion entirely.

---

## How This Roadmap Is Maintained

- Reviewed and updated every 6 weeks.
- Items move between phases based on KPI movement, not calendar dates.
- Every item removed from the roadmap gets a one-line explanation in the commit message.
- We track our own KPIs using DataPulse.

---

*Last updated: Q2 2026 · Owner: Product*
