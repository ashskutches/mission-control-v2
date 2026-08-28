import {
    Bot,
    LayoutDashboard,
    Lightbulb,
    MessageSquare,
    Settings,
    SearchCheck,
    Megaphone,
    Users,
    Share2,
    FlaskConical,
    Zap,
    LifeBuoy,
    Truck,
    DollarSign,
    Bug,
    Palette,
    Layers,
    Film,
    Layout,
    ClipboardList,
    ShoppingCart,
    Warehouse,
    Users2,
} from 'lucide-react';

export const APP_CONFIG = {
    name: 'Leaps & Rebounds',
    version: '3.0.0',
    author: 'L&R Intelligence',
    navigation: [
        // ── Four groups, in the order you work through them ────────────────────
        //   (ungrouped)  Command Center — the one screen above the split
        //   COMMERCE     the business itself: one entry per `core` space in
        //                lib/spaces.tsx, in that file's order
        //   TOOLS        things you run against the business — the four work-intake
        //                surfaces, plus the queues and ledgers they feed
        //   AGENTS       the workforce: who exists, and the room they argue in
        //   SETTINGS     configuration and people
        //
        // Sidebar draws a divider + label whenever `group` changes and the new group
        // is not `core`, so ORDER IS THE GROUPING — an entry filed out of sequence
        // starts a second heading with the same name rather than joining the first.
        //
        // COMMERCE should stay in lockstep with CORE_SPACES in lib/spaces.tsx. It is
        // not derived from it, because one entry here is not a space at all (Command
        // Center) and a space can be admin-only; but a core space missing from this
        // list is a page with no way to reach it.

        // ── Core (ungrouped) ───────────────────────────────────────────────────
        // Command Center is tabbed — Overview and Profitability today, more to come.
        // Deep-link a tab with /?tab=profitability.
        { id: 'overview',      group: 'core', href: '/',                       icon: LayoutDashboard, label: 'Command Center'             },

        // ── Commerce ───────────────────────────────────────────────────────────
        // Sales is the revenue surface and the successor to the standalone Profit
        // entry, which is gone from this list: the P&L is now /sales/profit, and
        // /profitability still renders the same component for the deep links already
        // out there (the Insights blocker banner points at /profitability?tab=costs,
        // and Command Center renders it at /?tab=profitability). ADMIN-ONLY by
        // construction — lib/access.ts is default-deny and /sales is on neither
        // allowlist, exactly as /profitability was.
        { id: 'sales',         group: 'commerce', href: '/sales',              icon: ShoppingCart,    label: 'Sales',      color: '#22c55e' },
        { id: 'audience',      group: 'commerce', href: '/website',            icon: Layers,          label: 'Website',    color: '#4a9eff' },
        // Marketing sits directly under Website: the same funnel, one step earlier.
        // Website is what a visitor sees once they arrive; Marketing is every channel
        // that got them there, scored against spend. Its Ads tab is the media-buyer
        // view of /admin/profitability/ads — Sales → Profit's Campaigns tab reads the
        // same endpoint through the P&L lens. Same data, two questions; don't merge them.
        { id: 'marketing',     group: 'commerce', href: '/marketing',          icon: Megaphone,       label: 'Marketing',  color: '#e98d20' },
        { id: 'content',       group: 'commerce', href: '/content',            icon: Film,            label: 'Content',    color: '#e98d20' },
        // Social sits next to Content because it publishes what Content produces.
        // WIP and ADMIN-ONLY by construction, not by a flag: lib/access.ts is
        // default-deny, so a path on neither allowlist is admin-only — middleware
        // gates it and Sidebar hides it from the same canAccess() call. Opening it
        // to the team later is one line in TEAMMATE_PATHS.
        //
        // Its Connections tab is live (GET /admin/integrations); Compose, Approvals,
        // Scheduled and Performance are labelled mocks. Nothing on the page sends —
        // the publish path (social__schedule-post) is not wired to this UI yet,
        // pending the aggregator-vs-direct decision.
        { id: 'social',        group: 'commerce', href: '/social',             icon: Share2,          label: 'Social',     color: '#f5a840' },
        // SEO sits under Content because the blog is its main asset — the Blog Library
        // moved from /content/blog to /seo/blog, since everything it is judged on
        // (impressions, position, topic overlap, thin posts) is measured in Search
        // Console. /content/blog redirects rather than 404s.
        { id: 'seo',           group: 'commerce', href: '/seo',                icon: SearchCheck,     label: 'SEO',        color: '#34d399' },
        // Logistics is the inventory-and-supply side of the same store Orders covers
        // order-by-order: what is in stock, what is about to run out, and what to buy.
        // Its Tier 1 KPIs (stockout rate, reorder points, cycle time) come from Shopify
        // alone; the freight-cost and warranty tabs are wired but blocked on Falcon and
        // Gorgias credentials, and say so rather than rendering zeros.
        // This is the Logistics space's operational dashboard. It used to have a
        // twin at /commerce/ops/logistics — the squad's agent surface — which is
        // gone; the agent panel belongs on the space page itself.
        { id: 'logistics',     group: 'commerce', href: '/logistics',          icon: Warehouse,       label: 'Logistics',  color: '#22c55e' },
        // Orders is one section with three tabs (see (dashboard)/orders/layout.tsx):
        //   /orders             Queue       — the exception queue: every order needing a
        //                                     human today, ranked. Healthy orders never
        //                                     appear; cloning Shopify's own order list
        //                                     would be duplication with staler data.
        //   /orders/backorders  Backorders  — the _BACKORDERED slice + its SMS script
        //   /orders/sms         Testing     — hand-send a real SMS
        // This replaced a second top-level entry at /customer that held the last two and
        // was itself labelled "Orders". /customer/* still redirects — it was in the
        // sidebar for months, so it's in bookmarks and agent-written links.
        { id: 'orders',        group: 'commerce', href: '/orders',             icon: Truck,           label: 'Orders',     color: '#fb923c' },
        // Support is the inbound half of the relationship Orders covers outbound: AI drafts
        // every reply, a human approves it, and every correction is kept as a training pair
        // the agent reflects on. Deliberately NOT merged into /orders — that section is
        // order-shaped (a queue you clear), this one is conversation-shaped (a thread you
        // answer). They meet on shopify_order_id, not in the navigation.
        { id: 'support',       group: 'commerce', href: '/support',            icon: LifeBuoy,        label: 'Support',    color: '#00c9d7' },

        // ── Tools ──────────────────────────────────────────────────────────────
        // Things you run AGAINST the business, as opposed to the business itself.
        //
        // The first four are the four ways work reaches an agent, in the order you'd
        // use them:
        //   Insights  — what the agents found, sorted by money/effort/risk, assignable
        //   Research  — ask a question → staged investigation → a cited report
        //   Quick Run — describe an action → one agent → one pass → done
        //   Tasks     — the tracked queue of assigned work (milestones, blockages)
        // Research and Tasks share agent_work, split by its `type` discriminator;
        // Research additionally shows pipeline runs from agent_jobs. Quick Run is the
        // single-shot half of agent_jobs. Research is a library you read, Tasks is a
        // queue you clear, Quick Run is a console you fire.
        //
        // North Star used to be a fifth entry here — a KPI strip over a read-only
        // digest of these same insights, with no way to act on any of them. Its
        // strip now sits on top of the Insights list, where the ranked findings it
        // was summarising can actually be assigned. /north-star is gone.
        { id: 'pipeline',      group: 'tools', href: '/pipeline',      icon: Lightbulb,     label: 'Insights',      color: '#e98d20' },
        { id: 'research',      group: 'tools', href: '/research',      icon: FlaskConical,  label: 'Research',      color: '#a78bfa' },
        { id: 'quick-run',     group: 'tools', href: '/quick-run',     icon: Zap,           label: 'Quick Run',     color: '#4a9eff' },
        { id: 'tasks',         group: 'tools', href: '/work',          icon: ClipboardList, label: 'Tasks',         color: '#4a9eff' },
        { id: 'chats',         group: 'tools', href: '/chats',         icon: MessageSquare, label: 'Chats',         color: '#6b7280' },
        // Blockages sits next to Insights because those two lists are one triage read
        // split by kind: the gate in POST /admin/insights sends every bug, blocker and
        // integration request here instead of onto the board. Its id is 'system' and
        // Sidebar's stuck-agent badge keys on that string — renaming the id silently
        // drops the badge rather than erroring.
        { id: 'system',        group: 'tools', href: '/blockages',     icon: Bug,           label: 'Blockages',     color: '#f43f5e' },
        { id: 'landing-pages', group: 'tools', href: '/landing-pages', icon: Layout,        label: 'Landing Pages', color: '#818cf8' },
        // Costs is the data-entry surface behind every margin on Sales → Profit: unit
        // costs, overhead, fee assumptions. A tool you operate, not a report you read,
        // which is why it left Settings.
        { id: 'costs',         group: 'tools', href: '/costs',         icon: DollarSign,    label: 'Costs',         color: '#22c55e' },

        // ── Agents ─────────────────────────────────────────────────────────────
        // The workforce itself. Deliberately only the roster and the room they argue
        // in — the four surfaces where their work actually lands are in Tools above,
        // because you open those to move work, not to manage an agent.
        { id: 'agents',        group: 'agents', href: '/agents',     icon: Bot,    label: 'Agents',     color: '#6b7280' },
        // Roundtable is the fifth way work could reach an agent, and deliberately the
        // one that produces no work at all: N agents, one question, a transcript and a
        // report. It writes no insight, no blockage and no task — every write tool is
        // blocked for the duration of a run (roundtable/runner.ts).
        //
        // It is an experiment, and the honest outcome may be that the format does not
        // earn its cost. That is why it sits here rather than in the space it discusses,
        // and why it is NOT an entry in lib/spaces.tsx: a lab surface is not an area of
        // the business, and runtime-creatable areas are the mistake spaces.ts exists to
        // prevent.
        { id: 'roundtable',    group: 'agents', href: '/roundtable', icon: Users2, label: 'Roundtable', color: '#a78bfa' },

        // ── Settings ───────────────────────────────────────────────────────────
        { id: 'brand',         group: 'settings', href: '/brand',     icon: Palette,   label: 'Brand',     color: '#e98d20' },
        { id: 'team',          group: 'settings', href: '/team',      icon: Users,     label: 'Team',      color: '#a78bfa' },
        { id: 'settings',      group: 'settings', href: '/settings',  icon: Settings,  label: 'Settings'                   },
    ],
    theme: {
        accent: 'var(--accent-orange)',   // L&R #e98d20
        bg: 'var(--bg-deep)',
    }
};
