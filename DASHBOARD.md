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

### Content (new)
| Page | Route | Purpose |
|---|---|---|
| **Content Hub** | `/content` | Dashboard: video job stats, quick-nav to all tools, agent panel |
| Video Agent | `/content/video` | Universal video planner — prompt → storyboard (hermes3:8b + clip library) |
| Asset Tagger | `/content/assets` | Google Drive file browser with per-file + batch tagging |
| Section Builder | `/content/sections` | AI-generated Shopify Liquid snippets — deploy + register for UCB1 A/B testing |
| Copy Studio | `/content/copy` | AI ad, email, product description, and SMS copy generation |

### Logistics
| Page | Route | Purpose |
|---|---|---|
| **Overview** | `/logistics` | Alerts banner, inventory health, revenue gauge, cycle-time trend |
| Inventory | `/logistics/inventory` | Every tracked SKU with reorder point and days-to-stockout, filterable by urgency |
| Reorder | `/logistics/reorder` | The purchase list, plus the supplier lead-time editor it is computed from |
| Warranty & Returns | `/logistics/returns` | Blocked on Gorgias; shows Shopify returns-in-flight meanwhile |
| Shipping Cost | `/logistics/shipping` | Blocked on `FALCON_API_TOKEN`; renders Falcon's cost analysis once set |

Reads `/admin/logistics` (gravity-claw `routes/logistics.ts`). Sits under SEO in the
sidebar. **Not** `/commerce/ops/logistics` — that is the squad's agent surface (chat,
tasks, routines); this is the operational dashboard. Where a figure cannot be computed
honestly the tab names the env var that would unblock it rather than rendering a zero.

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
