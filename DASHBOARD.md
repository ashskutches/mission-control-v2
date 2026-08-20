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
| **Warehouses** | `/logistics/warehouses` | Stock per SKU per warehouse: shippable vs held vs dropship-partner units, and phantom stock |
| Shipping & Carriers | `/logistics/shipping` | Shipment volume, carrier mix, transit time, on-time-vs-promise. Only the freight/storage FEES still need `FALCON_API_TOKEN` |

Reads `/admin/logistics` (gravity-claw `routes/logistics.ts`). Sits under SEO in the
sidebar. It used to have a twin at `/commerce/ops/logistics` — the squad's agent surface
(chat, tasks, routines) — which went with the rest of that tree. Where a figure cannot be
computed honestly the tab names the env var that would unblock it rather than rendering a
zero.

**The Falcon feed shrank on 2026-08-18.** Falcon Fulfillment is a Shopify *location*
(`48733585558`), so stock by warehouse, the shipment report, carrier mix and transit time
were never Falcon-only, and on-time-vs-promise (KPI 2) needs only that the promise be
recorded before Shopify overwrites it. What still requires Falcon is money: per-shipment
shipping/fulfillment/pick/carton fees and storage. Two things to know before reading these
tabs:

- **Warehouses separates ours from partners'.** The store has 17 locations. One ships
  (Falcon, 3,177 units), a few only hold (Easton House, 36), and thirteen are Shopify
  Collective / Dropified dropship partners holding 967 units of their own goods.
  `variant.inventoryQuantity` — what the Inventory and Reorder tabs use — sums all of them.
- **On-time-vs-promise accumulates forward.** `Fulfillment.estimatedDeliveryAt` is a real
  promise in transit and is rewritten to ~delivery time once it lands, so a 15-minute cron
  snapshots it into `delivery_promises`. The table has no history and reports "still
  filling up" rather than 0% until deliveries land against stored promises.

### Spaces
The hard-coded areas of the business. One page each, listed in `src/app/lib/spaces.tsx`
and mirrored in gravity-claw's `src/utils/spaces.ts` — **the `id` strings must match**,
because they key `agent_insights.section` and `business_sections`.

| Space | id | Page | Group |
|---|---|---|---|
| Website | `audience` | `/website` | core |
| Marketing | `marketing` | `/marketing` | core |
| Content | `content` | `/content` | core |
| Social | `social` | `/social` | core |
| SEO | `seo` | `/seo` | core |
| Logistics | `logistics` | `/logistics` | core |
| Orders | `orders` | `/orders` | core |
| Support | `support` | `/support` | core |
| Brand | `brand` | `/brand` | settings |
| Team | `team` | `/team` | settings |

`core` spaces make up Command Center's health grid. Website's id is `audience` and not
`website`: the id predates the page's rename and is stamped on the agent and its
`business_sections` row — see the note in the gravity-claw twin.

**This replaced `/commerce`.** That tree was 38 files: a dashboard, a `commerce_areas`
CRUD manager, four squad overviews (Acquisition / Conversion / Ops / Strategy), a dynamic
`[squad]/[area]` route, and ~25 thin pages that were all one shared `CommerceSectionPage`
wrapped in a config object. Sections were rows, creatable at runtime — including by an LLM
via `POST /admin/sections/areas/generate` — so the live taxonomy drifted away from the
section list the insight tools would accept, and 6 of Command Center's 13 department cards
pointed at ids no insight could ever carry. Old `/commerce/*` paths 308 to their space (see
`next.config.ts`); anything with no successor lands on Command Center.

Adding a space means editing both registries and building the page. An area of the business
with no page cannot silently start collecting insights.

### Command
Agents, Chats, Ideas, Costs, System, Settings

---

## Key Components (`src/components/`)

| Component | Purpose |
|---|---|
| `SectionAgentPanel` | Auto-assign a lead agent to a space + trigger an analysis run. On `/website`, `/content`, `/marketing`, `/seo`, `/team` — **the other five spaces do not have one yet** |
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

The strategic command layer. Purpose-built rather than a shared section wrapper.

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
