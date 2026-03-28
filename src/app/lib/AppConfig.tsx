import {
    Bot,
    BookOpen,
    LayoutDashboard,
    Library,
    Lightbulb,
    MessageSquare,
    Palette,
    Settings,
    ShoppingBag,
    Zap,
    BrainCircuit,
    SearchCheck,
    Mail,
    FileText,
    Megaphone,
    Package,
} from 'lucide-react';


export const APP_CONFIG = {
    name: 'Mission Control',
    version: '3.0.0',
    author: 'Gravity Claw',
    navigation: [
        // ── Core ──────────────────────────────────────────────────
        { id: 'overview',      href: '/',              icon: LayoutDashboard, label: 'Overview',      group: 'core' },
        { id: 'intelligence',  href: '/intelligence',  icon: BrainCircuit,    label: 'Intelligence',  color: '#f59e0b', group: 'core' },
        // ── Business Domains ──────────────────────────────────────
        { id: 'seo',           href: '/seo',           icon: SearchCheck,     label: 'SEO',           color: '#38bdf8', group: 'domains' },
        { id: 'email',         href: '/email',         icon: Mail,            label: 'Email & CRM',   color: '#a78bfa', group: 'domains' },
        { id: 'content',       href: '/content',       icon: FileText,        label: 'Content',       color: '#22c55e', group: 'domains' },
        { id: 'ads',           href: '/ads',           icon: Megaphone,       label: 'Ads',           color: '#f43f5e', group: 'domains' },
        { id: 'commerce',      href: '/commerce',      icon: ShoppingBag,     label: 'Commerce',      color: '#fb923c', group: 'domains' },
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
