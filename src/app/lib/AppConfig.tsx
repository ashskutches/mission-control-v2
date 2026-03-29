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
    FileText,
    Megaphone,
    Package,
    Star,
    LifeBuoy,
    Heart,
    Share2,
    ShoppingCart,
    BarChart2,
    Award,
    TrendingUp,
} from 'lucide-react';


export const APP_CONFIG = {
    name: 'Mission Control',
    version: '3.0.0',
    author: 'Gravity Claw',
    navigation: [
        // ── Core ──────────────────────────────────────────────────
        { id: 'overview',      href: '/',              icon: LayoutDashboard, label: 'Overview',      group: 'core' },
        { id: 'intelligence',  href: '/intelligence',  icon: BrainCircuit,    label: 'Intelligence',  color: '#f59e0b', group: 'core' },
        // ── Commerce ──────────────────────────────────────────────
        { id: 'store',        href: '/commerce',              icon: ShoppingBag, label: 'Store',        color: '#fb923c', group: 'commerce' },
        { id: 'seo',          href: '/commerce/seo',          icon: SearchCheck, label: 'SEO',          color: '#38bdf8', group: 'commerce' },
        { id: 'email',        href: '/commerce/email',        icon: Mail,        label: 'Email & CRM',  color: '#a78bfa', group: 'commerce' },
        { id: 'content',      href: '/commerce/content',      icon: FileText,    label: 'Content',      color: '#22c55e', group: 'commerce' },
        { id: 'ads',          href: '/commerce/ads',          icon: Megaphone,   label: 'Paid Ads',     color: '#f43f5e', group: 'commerce' },
        { id: 'social',       href: '/commerce/social',       icon: Share2,      label: 'Social',       color: '#e879f9', group: 'commerce' },
        { id: 'influencing',  href: '/commerce/influencing',  icon: Star,        label: 'Influencing',  color: '#f43f5e', group: 'commerce' },
        { id: 'products',     href: '/commerce/products',     icon: Package,     label: 'Products',     color: '#34d399', group: 'commerce' },
        { id: 'orders',       href: '/commerce/orders',       icon: ShoppingCart,label: 'Orders',       color: '#22c55e', group: 'commerce' },
        { id: 'loyalty',      href: '/commerce/loyalty',      icon: Heart,       label: 'Loyalty & LTV',color: '#f43f5e', group: 'commerce' },
        { id: 'reviews',      href: '/commerce/reviews',      icon: Award,       label: 'Reviews',      color: '#fbbf24', group: 'commerce' },
        { id: 'support',      href: '/commerce/support',      icon: LifeBuoy,    label: 'Support',      color: '#10b981', group: 'commerce' },
        { id: 'cro',          href: '/commerce/cro',          icon: TrendingUp,  label: 'CRO',          color: '#818cf8', group: 'commerce' },
        { id: 'amazon',       href: '/commerce/amazon',       icon: BarChart2,   label: 'Amazon',       color: '#fb923c', group: 'commerce' },
        // ── Command ───────────────────────────────────────────────
        { id: 'agents',        href: '/agents',        icon: Bot,             label: 'Agents',        color: '#64748b', group: 'command' },
        { id: 'chats',         href: '/chats',         icon: MessageSquare,   label: 'Chats',         color: '#64748b', group: 'command' },
        { id: 'ideas',         href: '/ideas',         icon: Lightbulb,       label: 'Ideas',         color: '#64748b', group: 'command' },
        { id: 'settings',      href: '/settings',      icon: Settings,        label: 'Settings',      group: 'command' },
    ],
    theme: {
        accent: 'var(--accent-orange)',
        bg: 'var(--bg-deep)',
    }
};
