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
    Video,
    Copy,
    UserCheck,
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
        // ── Core ──────────────────────────────────────────────────────────────
        { id: 'overview',   href: '/',             icon: LayoutDashboard, label: 'Overview'                   },
        { id: 'north-star', href: '/north-star',   icon: TrendingUp,      label: 'North Star', color: '#a78bfa' },
        { id: 'insights',   href: '/intelligence', icon: BrainCircuit,    label: 'Insights',   color: '#e98d20' },
        { id: 'audience',   href: '/audience',     icon: Layers,          label: 'Audience',   color: '#4a9eff' },
        { id: 'content',    href: '/content',      icon: Film,            label: 'Content',    color: '#e98d20' },
        { id: 'customer',   href: '/customer',     icon: UserCheck,       label: 'Customer',   color: '#4a9eff' },
        { id: 'store',      href: '/commerce',     icon: ShoppingBag,     label: 'Commerce',   color: '#e98d20' },

        // ── Command ────────────────────────────────────────────────────────────
        { id: 'agents',   href: '/agents',    icon: Bot,           label: 'Agents',    color: '#6b7280' },
        { id: 'chats',    href: '/chats',     icon: MessageSquare, label: 'Chats',     color: '#6b7280' },
        { id: 'costs',    href: '/costs',     icon: DollarSign,    label: 'Costs',     color: '#22c55e' },
        { id: 'brand',    href: '/brand',     icon: Palette,       label: 'Brand',     color: '#e98d20' },
        { id: 'system',   href: '/blockages', icon: Bug,           label: 'Blockages', color: '#f43f5e' },
        { id: 'settings', href: '/settings',  icon: Settings,      label: 'Settings'                   },
    ],
    theme: {
        accent: 'var(--accent-orange)',   // L&R #e98d20
        bg: 'var(--bg-deep)',
    }
};
