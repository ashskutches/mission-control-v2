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
        { id: 'overview',     href: '/',             icon: LayoutDashboard, label: 'Overview',     group: 'core' },
        { id: 'north-star',   href: '/north-star',   icon: TrendingUp,      label: 'North Star',   color: '#a78bfa', group: 'core' },
        { id: 'insights',     href: '/intelligence', icon: BrainCircuit,    label: 'Insights',     color: '#e98d20', group: 'core' },
        { id: 'audience',     href: '/audience',     icon: Layers,          label: 'Audience',     color: '#4a9eff', group: 'core' },

        // ── Content ───────────────────────────────────────────────────────────
        { id: 'content',          href: '/content',          icon: Film,    label: 'Content',          color: '#e98d20', group: 'content' },
        { id: 'content-video',    href: '/content/video',    icon: Video,   label: 'Video Agent',      color: '#e98d20', group: 'content', squad: 'content' },
        { id: 'content-assets',   href: '/content/assets',   icon: Tag,     label: 'Asset Tagger',     color: '#4a9eff', group: 'content', squad: 'content' },
        { id: 'content-sections', href: '/content/sections', icon: Code2,   label: 'Snippets',         color: '#a78bfa', group: 'content', squad: 'content' },
        { id: 'content-copy',     href: '/content/copy',     icon: Copy,    label: 'Copy Studio',      color: '#22c55e', group: 'content', squad: 'content' },

        // ── Customer ──────────────────────────────────────────────────────────
        { id: 'customer', href: '/customer', icon: UserCheck, label: 'Customer', color: '#4a9eff', group: 'customer' },

        // ── Commerce: Overview ────────────────────────────────────────────────
        { id: 'store', href: '/commerce', icon: ShoppingBag, label: 'Commerce', color: '#e98d20', group: 'commerce' },

        // ── Commerce: Acquisition & Traffic ───────────────────────────────────
        { id: 'media-buying',       href: '/commerce/acquisition/media-buying',       icon: Megaphone,   label: 'Media Buying',      color: '#e98d20', group: 'commerce', squad: 'acquisition' },
        { id: 'creator-outreach',   href: '/commerce/acquisition/creator-outreach',   icon: Users,       label: 'Creator Outreach',  color: '#e98d20', group: 'commerce', squad: 'acquisition' },
        { id: 'social-presence',    href: '/commerce/acquisition/social-presence',    icon: Share2,      label: 'Social Presence',   color: '#e98d20', group: 'commerce', squad: 'acquisition' },
        { id: 'search-visibility',  href: '/commerce/acquisition/search-visibility',  icon: SearchCheck, label: 'Search Visibility', color: '#e98d20', group: 'commerce', squad: 'acquisition' },

        // ── Commerce: Conversion & Merchandising ──────────────────────────────
        { id: 'experimentation',    href: '/commerce/conversion/experimentation',   icon: FlaskConical, label: 'Experimentation',   color: '#4a9eff', group: 'commerce', squad: 'conversion' },
        { id: 'pricing-intel',      href: '/commerce/conversion/pricing-intel',     icon: Tag,          label: 'Pricing & Intel',   color: '#4a9eff', group: 'commerce', squad: 'conversion' },
        { id: 'catalog-architect',  href: '/commerce/conversion/catalog-architect', icon: LayoutGrid,   label: 'Catalog Architect', color: '#4a9eff', group: 'commerce', squad: 'conversion' },
        { id: 'revenue-max',        href: '/commerce/conversion/revenue-max',       icon: Zap,          label: 'Revenue Max',       color: '#4a9eff', group: 'commerce', squad: 'conversion' },

        // ── Commerce: Post-Purchase & Ops ─────────────────────────────────────
        { id: 'resolution',         href: '/commerce/ops/resolution',         icon: LifeBuoy,     label: 'Resolution',          color: '#22c55e', group: 'commerce', squad: 'ops' },
        { id: 'logistics',          href: '/commerce/ops/logistics',          icon: Truck,        label: 'Logistics',           color: '#22c55e', group: 'commerce', squad: 'ops' },
        { id: 'community-support',  href: '/commerce/ops/community-support',  icon: MessageCircle,label: 'Community Support',   color: '#22c55e', group: 'commerce', squad: 'ops' },
        { id: 'email-crm',          href: '/commerce/email',                  icon: Mail,         label: 'Email & CRM',         color: '#22c55e', group: 'commerce', squad: 'ops' },

        // ── Commerce: Strategy & Finance ──────────────────────────────────────
        { id: 'profitability',      href: '/commerce/strategy/profitability',   icon: LineChart,    label: 'Profitability',       color: '#a78bfa', group: 'commerce', squad: 'strategy' },
        { id: 'brand-sentinel',     href: '/commerce/strategy/brand-sentinel',  icon: Eye,          label: 'Brand Sentinel',      color: '#a78bfa', group: 'commerce', squad: 'strategy' },

        // ── Command ────────────────────────────────────────────────────────────
        { id: 'agents',   href: '/agents',    icon: Bot,          label: 'Agents',    color: '#6b7280', group: 'command' },
        { id: 'chats',    href: '/chats',     icon: MessageSquare,label: 'Chats',     color: '#6b7280', group: 'command' },
        { id: 'costs',    href: '/costs',     icon: DollarSign,   label: 'Costs',     color: '#22c55e', group: 'command' },
        { id: 'brand',    href: '/brand',     icon: Palette,      label: 'Brand',     color: '#e98d20', group: 'command' },
        { id: 'system',   href: '/blockages', icon: Bug,          label: 'Blockages', color: '#f43f5e', group: 'command' },
        { id: 'settings', href: '/settings',  icon: Settings,     label: 'Settings',                   group: 'command' },
    ],
    theme: {
        accent: 'var(--accent-orange)',   // L&R #e98d20
        bg: 'var(--bg-deep)',
    }
};
