# Mission Control Dashboard (v3)

A glassmorphic business intelligence dashboard built with **Next.js**. Real-time interface for monitoring and managing the Gravity Claw agent network for Leaps & Rebounds.

---

## Navigation Structure

### Core
| Page | Route | Purpose |
|---|---|---|
| Overview | `/` | KPI summary, recent activity |
| **North Star** | `/north-star` | Growth Admin command layer — cross-dept synthesis, The Whale, commander chat |
| Insights | `/intelligence` | Global insight inbox — all agent findings across all departments |

### Commerce (by squad)
**Acquisition**: Media Buying, Creator Outreach, Social Presence, Search Visibility
**Conversion**: Experimentation, Pricing & Intel, Catalog Architect, Revenue Max
**Ops**: Resolution, Logistics, Community Support
**Strategy**: Profitability, Brand Sentinel

Each commerce page: `SectionAgentPanel` (auto-assign agent + run analysis) → Live KPIs → Metrics → Insight cards → Task queue → Embedded chat

### Command
Agents, Chats, Ideas, Costs, System, Settings

---

## Key Components (`src/components/`)

| Component | Purpose |
|---|---|
| `CommerceSectionPage` | Shared layout for all `/commerce/*` pages |
| `SectionAgentPanel` | Auto-assign agent + trigger analysis run |
| `SectionMetricsPanel` | Agent-managed KPI widgets per section |
| `SectionLiveKPIs` | Live KPI auto-refresh bar |
| `SectionTaskQueue` | Human-approval action queue per section |
| `InsightReviewPanel` | Slide-out panel for rich insight review (drafts, replies) |
| `AgentCRUD` | Create/edit/delete agents — role presets, skill config |
| `AgentRoutines` | Cron routine management per agent |
| `AgentRequestsPanel` | System tab — triage queue for bugs/limits/integration asks |
| `CostSummaryPanel` | System tab — 30-day spend by agent + cost alerts |
| `IntegrationsPanel` | System tab — all API connections, status, credentials |

---

## Data Flow

```
Agent runs routine / chat
  └─→ Calls tools (log_insight, upsert_section_metric, log_bug, etc.)
        └─→ Gravity Claw writes to Supabase
              └─→ Mission Control polls / fetches on load
                    └─→ Renders on relevant page
```

- **`NEXT_PUBLIC_BOT_URL`** — the deployed gravity-claw Railway URL. Used by ALL frontend components.
- No components should use `NEXT_PUBLIC_API_URL` — it is not set in production.

---

## North Star Page (`/north-star`)

The strategic command layer. Unique to all other pages — not a `CommerceSectionPage` wrapper.

| Panel | What |
|---|---|
| Agent Panel | Auto-assign a Growth Admin 📈 agent |
| KPI Strip | Total revenue opportunity, new insights, critical requests, 30-day LLM spend |
| The Whale 🐋 | Highest-priority item synthesised across all departments |
| Cross-Dept Intel | All insights, filterable by type. Sorted by priority. |
| Cost Anomalies | Agents spending >$0.50/run flagged automatically |
| System Requests | P8+ critical agent requests with link to /system |
| Commander Chat | Business context pre-loaded. Quick prompts. Supports discord_dm briefings. |

---

## System Page (`/system`)

Admin-only operations view. Three panels:

1. **Agent Requests** (`AgentRequestsPanel`) — bugs, limitations, integration asks, feature requests filed by agents → `agent_requests` table
2. **Cost Center** (`CostSummaryPanel`) — 30-day spend by agent, cost alerts → `cost_log` / views
3. **Integrations Registry** (`IntegrationsPanel`) — all APIs/services status → `integrations_registry` table
