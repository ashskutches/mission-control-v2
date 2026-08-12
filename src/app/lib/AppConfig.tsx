import {
    Bot,
    LayoutDashboard,
    Lightbulb,
    MessageSquare,
    Settings,
    ShoppingBag,
    BrainCircuit,
    SearchCheck,
    Mail,
    Megaphone,
    Users,
    Share2,
    FlaskConical,
    Tag,
    LayoutGrid,
    Zap,
    LifeBuoy,
    Truck,
    MessageCircle,
    LineChart,
    Eye,
    TrendingUp,
    Target,
    ShieldCheck,
    Activity,
    DollarSign,
    Wrench,
    Bug,
    Palette,
    Layers,
    Code2,
    Film,
    Copy,
    Layout,
    Cpu,
    ClipboardList,
    PiggyBank,
    Warehouse,
} from 'lucide-react';

export const SQUADS = [
    {
        id: 'acquisition',
        label: 'Acquisition & Traffic',
        color: '#e98d20',         // L&R brand orange
        icon: TrendingUp,
        description: 'Top-of-funnel growth: paid media, outreach, social, and search.',
    },
    {
        id: 'conversion',
        label: 'Conversion & Merchandising',
        color: '#4a9eff',         // cool blue — data & trust
        icon: Target,
        description: 'The math of the website: CRO, pricing, catalog, and LTV.',
    },
    {
        id: 'ops',
        label: 'Post-Purchase & Ops',
        color: '#22c55e',         // emerald — success & operations
        icon: ShieldCheck,
        description: 'Logic-heavy ops: customer service, logistics, and community.',
    },
    {
        id: 'strategy',
        label: 'Strategy & Finance',
        color: '#a78bfa',         // soft violet — insight & planning
        icon: Activity,
        description: 'The brain layer: profitability, brand, and long-term plays.',
    },
];

export const APP_CONFIG = {
    name: 'Leaps & Rebounds',
    version: '3.0.0',
    author: 'L&R Intelligence',
    navigation: [
        // ── Core (ungrouped) ───────────────────────────────────────────────────
        // Command Center is tabbed — Overview and Profitability today, more to come.
        // Deep-link a tab with /?tab=profitability.
        { id: 'overview',      group: 'core', href: '/',                       icon: LayoutDashboard, label: 'Command Center'             },
        { id: 'audience',      group: 'core', href: '/website',                icon: Layers,          label: 'Website',    color: '#4a9eff' },
        // Marketing sits directly under Website: the same funnel, one step earlier.
        // Website is what a visitor sees once they arrive; Marketing is every channel
        // that got them there, scored against spend. Its Ads tab is the media-buyer
        // view of /admin/profitability/ads — Profit's Campaigns tab reads the same
        // endpoint through the P&L lens. Same data, two questions; don't merge them.
        { id: 'marketing',     group: 'core', href: '/marketing',              icon: Megaphone,       label: 'Marketing',  color: '#e98d20' },
        { id: 'content',       group: 'core', href: '/content',                icon: Film,            label: 'Content',    color: '#e98d20' },
        // SEO sits under Content because the blog is its main asset — the Blog Library
        // moved from /content/blog to /seo/blog, since everything it is judged on
        // (impressions, position, topic overlap, thin posts) is measured in Search
        // Console. /content/blog redirects rather than 404s.
        { id: 'seo',           group: 'core', href: '/seo',                    icon: SearchCheck,     label: 'SEO',        color: '#34d399' },
        // Logistics is the inventory-and-supply side of the same store Orders covers
        // order-by-order: what is in stock, what is about to run out, and what to buy.
        // Its Tier 1 KPIs (stockout rate, reorder points, cycle time) come from Shopify
        // alone; the freight-cost and warranty tabs are wired but blocked on Falcon and
        // Gorgias credentials, and say so rather than rendering zeros.
        // Not the same page as /commerce/ops/logistics — that is the squad's agent
        // surface (chat, tasks, routines); this is the operational dashboard.
        { id: 'logistics',     group: 'core', href: '/logistics',              icon: Warehouse,       label: 'Logistics',  color: '#22c55e' },
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
        { id: 'orders',        group: 'core', href: '/orders',                 icon: Truck,           label: 'Orders',     color: '#fb923c' },
        // Support is the inbound half of the relationship Orders covers outbound: AI drafts
        // every reply, a human approves it, and every correction is kept as a training pair
        // the agent reflects on. Deliberately NOT merged into /orders — that section is
        // order-shaped (a queue you clear), this one is conversation-shaped (a thread you
        // answer). They meet on shopify_order_id, not in the navigation.
        { id: 'support',       group: 'core', href: '/support',                icon: LifeBuoy,        label: 'Support',    color: '#00c9d7' },
        { id: 'landing-pages', group: 'core', href: '/commerce/landing-pages', icon: Layout,          label: 'Landing Pages', color: '#818cf8' },

        // ── Agentic ─────────────────────────────────────────────────────────────────────────
        // Four ways work reaches an agent, in the order you'd use them:
        //   Insights  — what the agents found, sorted by money/effort/risk, assignable
        //   Research  — ask a question → staged investigation → a cited report
        //   Quick Run — describe an action → one agent → one pass → done
        //   Tasks     — the tracked queue of assigned work (milestones, blockages)
        // Research and Tasks share agent_work, split by its `type` discriminator;
        // Research additionally shows pipeline runs from agent_jobs. Quick Run is the
        // single-shot half of agent_jobs. Research is a library you read, Tasks is a
        // queue you clear, Quick Run is a console you fire.
        //
        // North Star used to be a sixth entry here — a KPI strip over a read-only
        // digest of these same insights, with no way to act on any of them. Its
        // strip now sits on top of the Insights list, where the ranked findings it
        // was summarising can actually be assigned. /north-star is gone.
        { id: 'pipeline',  group: 'agentic', href: '/pipeline',  icon: Lightbulb,     label: 'Insights',  color: '#e98d20' },
        { id: 'research',  group: 'agentic', href: '/research',  icon: FlaskConical,  label: 'Research',  color: '#a78bfa' },
        { id: 'quick-run', group: 'agentic', href: '/quick-run', icon: Zap,           label: 'Quick Run', color: '#4a9eff' },
        { id: 'tasks',     group: 'agentic', href: '/work',      icon: ClipboardList, label: 'Tasks',     color: '#4a9eff' },
        { id: 'agents',   group: 'agentic', href: '/agents',   icon: Bot,           label: 'Agents',     color: '#6b7280' },
        // Profit renders in two places from one component: this full-width route,
        // and the Profitability tab of Command Center (/?tab=profitability).
        // The href stays a real path — Sidebar's activeId matches on pathname only,
        // so a query-string href would never highlight.
        { id: 'profit',   group: 'agentic', href: '/profitability', icon: PiggyBank, label: 'Profit',     color: '#22c55e' },
        { id: 'store',    group: 'agentic', href: '/commerce', icon: ShoppingBag,   label: 'Commerce',   color: '#e98d20' },
        { id: 'chats',    group: 'agentic', href: '/chats',    icon: MessageSquare, label: 'Chats',      color: '#6b7280' },

        // ── Settings ───────────────────────────────────────────────────────────
        { id: 'brand',    group: 'settings', href: '/brand',     icon: Palette,   label: 'Brand',     color: '#e98d20' },
        { id: 'system',   group: 'settings', href: '/blockages', icon: Bug,       label: 'Blockages', color: '#f43f5e' },
        { id: 'costs',    group: 'settings', href: '/costs',     icon: DollarSign,label: 'Costs',     color: '#22c55e' },
        { id: 'team',     group: 'settings', href: '/team',      icon: Users,     label: 'Team',      color: '#a78bfa' },
        { id: 'settings', group: 'settings', href: '/settings',  icon: Settings,  label: 'Settings'                   },
    ],
    theme: {
        accent: 'var(--accent-orange)',   // L&R #e98d20
        bg: 'var(--bg-deep)',
    }
};
