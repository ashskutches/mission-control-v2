import {
    Bot,
    BookOpen,
    GitBranch,
    LayoutDashboard,
    Library,
    Lightbulb,
    MessageSquare,
    Palette,
    Settings,
    ShoppingBag,
    Zap,
} from 'lucide-react';


export const APP_CONFIG = {
    name: 'Mission Control',
    version: '3.0.0',
    author: 'Gravity Claw',
    navigation: [
        { id: 'overview',   href: '/',           icon: LayoutDashboard, label: 'Overview'   },
        { id: 'agents',     href: '/agents',      icon: Bot,             label: 'Agents',    color: '#38bdf8' },
        { id: 'chats',     href: '/chats',     icon: MessageSquare, label: 'Chats',     color: '#22c55e' },
        { id: 'library',   href: '/library',   icon: BookOpen,      label: 'Library',   color: '#f59e0b' },
        { id: 'templates', href: '/templates', icon: Library,       label: 'Templates', color: '#a855f7' },
        { id: 'workflows',  href: '/workflows',   icon: GitBranch,       label: 'Workflows', color: '#ff8c00' },
        { id: 'ideas',      href: '/ideas',      icon: Lightbulb,       label: 'Ideas',      color: '#a78bfa' },
        { id: 'commerce',  href: '/commerce',   icon: ShoppingBag,     label: 'Commerce'  },
        { id: 'brand',     href: '/brand',      icon: Palette,         label: 'Brand'     },
        { id: 'engine',    href: '/engine',     icon: Zap,             label: 'Engine'    },
        { id: 'settings',  href: '/settings',   icon: Settings,        label: 'Settings'  },
    ],
    theme: {
        accent: 'var(--accent-orange)',
        bg: 'var(--bg-deep)',
    }
};
