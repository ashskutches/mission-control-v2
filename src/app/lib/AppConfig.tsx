import {
    BarChart3,
    BookOpen,
    Brain,
    BrainCircuit,
    LayoutDashboard,
    Settings,
    ShieldAlert,
    Zap
} from 'lucide-react';

export const APP_CONFIG = {
    name: 'Mission Control',
    version: '3.0.0',
    author: 'Gravity Claw',
    navigation: [
        { id: 'overview', href: '/', icon: LayoutDashboard, label: 'Overview' },
        { id: 'war-room', href: '/war-room', icon: ShieldAlert, label: 'War Room' },
        { id: 'neural-graph', href: '/neural-graph', icon: BrainCircuit, label: 'Neural Graph' },
        { id: 'commerce', href: '/commerce', icon: BarChart3, label: 'Commerce' },
        { id: 'agents', href: '/agents', icon: Brain, label: 'Agents' },
        { id: 'business-context', href: '/business-context', icon: BookOpen, label: 'Brand Guide' },
        { id: 'engine', href: '/engine', icon: Zap, label: 'Engine' },
        { id: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
    ],
    theme: {
        accent: 'var(--accent-orange)',
        bg: 'var(--bg-deep)',
    }
};
