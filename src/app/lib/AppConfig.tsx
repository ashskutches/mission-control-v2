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
    UserCheck,
    Cpu,
    GitMerge,
    ClipboardList,
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
        { id: 'overview',      group: 'core', href: '/',                       icon: LayoutDashboard, label: 'Overview'                   },
        { id: 'audience',      group: 'core', href: '/website',                icon: Layers,          label: 'Website',    color: '#4a9eff' },
        { id: 'content',       group: 'core', href: '/content',                icon: Film,            label: 'Content',    color: '#e98d20' },
        { id: 'customer',      group: 'core', href: '/customer',               icon: UserCheck,       label: 'Orders',     color: '#4a9eff' },
        { id: 'landing-pages', group: 'core', href: '/commerce/landing-pages', icon: Layout,          label: 'Landing Pages', color: '#818cf8' },

        // ── Agentic ─────────────────────────────────────────────────────────────────────────
        { id: 'pipeline', group: 'agentic', href: '/pipeline', icon: GitMerge,      label: 'Pipeline',   color: '#e98d20' },
        { id: 'tasks',    group: 'agentic', href: '/work',     icon: ClipboardList, label: 'Tasks',      color: '#4a9eff' },
        { id: 'agents',   group: 'agentic', href: '/agents',   icon: Bot,           label: 'Agents',     color: '#6b7280' },
        { id: 'north-star', group: 'agentic', href: '/north-star', icon: TrendingUp, label: 'North Star', color: '#a78bfa' },
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
