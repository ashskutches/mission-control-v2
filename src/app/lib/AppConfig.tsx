import {
    BarChart3,
    Bot,
    FolderKanban,
    LayoutDashboard,
    Lightbulb,
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
        { id: 'overview',  href: '/',          icon: LayoutDashboard, label: 'Overview'  },
        { id: 'agents',    href: '/agents',     icon: Bot,             label: 'Agents',    color: '#38bdf8' },
        { id: 'projects',  href: '/projects',   icon: FolderKanban,    label: 'Projects'  },
        { id: 'ideas',     href: '/ideas',      icon: Lightbulb,       label: 'Ideas',     color: '#a78bfa' },
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
