import {
    Layers, Megaphone, Film, Share2, SearchCheck, Warehouse, Truck, LifeBuoy,
    Palette, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Spaces — the hard-coded areas of the business.
 *
 * This is the display half of gravity-claw's `src/utils/spaces.ts`. **The `id`
 * strings must match that file exactly**: they key `agent_insights.section` and
 * `business_sections`, so a mismatch here does not error — it silently renders a
 * space that can never show its own insights.
 *
 * It replaced the Commerce architecture: a `commerce_areas` table, four "squad"
 * rows, and a /commerce subtree of 38 files where 25 of the pages were one shared
 * component wrapped in a config object. Areas were creatable at runtime, including
 * by an LLM, so the live taxonomy drifted out of agreement with both its own seed
 * and the section list the insight tools would accept.
 *
 * Adding a space means editing this file, its gravity-claw twin, and building the
 * page — which is the point. An area of the business with no page cannot silently
 * start collecting insights.
 *
 * `id` is the insight key and `href` is the page; they differ only for Website,
 * whose id is `audience` because that predates the page's rename and is stamped on
 * the agent and its business_sections row. See the note in the gravity-claw twin.
 */
export interface Space {
    /** Matches `agent_insights.section` and `business_sections.id`. */
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly icon: LucideIcon;
    readonly color: string;
    /**
     * `core` spaces are the operating surface and make up Command Center's health
     * grid. `settings` spaces are real spaces that are not part of the daily read.
     */
    readonly group: 'core' | 'settings';
}

export const SPACES: readonly Space[] = [
    { id: 'audience',  label: 'Website',   href: '/website',   icon: Layers,      color: '#4a9eff', group: 'core' },
    { id: 'marketing', label: 'Marketing', href: '/marketing', icon: Megaphone,   color: '#e98d20', group: 'core' },
    { id: 'content',   label: 'Content',   href: '/content',   icon: Film,        color: '#e98d20', group: 'core' },
    { id: 'social',    label: 'Social',    href: '/social',    icon: Share2,      color: '#f5a840', group: 'core' },
    { id: 'seo',       label: 'SEO',       href: '/seo',       icon: SearchCheck, color: '#34d399', group: 'core' },
    { id: 'logistics', label: 'Logistics', href: '/logistics', icon: Warehouse,   color: '#22c55e', group: 'core' },
    { id: 'orders',    label: 'Orders',    href: '/orders',    icon: Truck,       color: '#fb923c', group: 'core' },
    { id: 'support',   label: 'Support',   href: '/support',   icon: LifeBuoy,    color: '#00c9d7', group: 'core' },
    { id: 'brand',     label: 'Brand',     href: '/brand',     icon: Palette,     color: '#e98d20', group: 'settings' },
    { id: 'team',      label: 'Team',      href: '/team',      icon: Users,       color: '#a78bfa', group: 'settings' },
] as const;

/** What Command Center's health grid renders, in this order. */
export const CORE_SPACES: readonly Space[] = SPACES.filter(s => s.group === 'core');

export function getSpace(id: string): Space | undefined {
    return SPACES.find(s => s.id === id);
}

/**
 * Where a space's own Insights board lives, or null if it has no tab yet.
 *
 * Every `core` space has one; the two `settings` spaces (Brand, Team) do not, so
 * anything linking to "this space's insights" has to handle null rather than
 * assume `${href}/insights` resolves. Linking a Team agent's run at /team/insights
 * would 404 — that is the bug this function exists to prevent.
 *
 * Social is the exception to the URL shape. It has no layout.tsx and no child
 * routes: it is one page with its own in-page tab strip, which reads ?tab= on
 * mount. So its board is a query param, not a path segment.
 */
export function insightsHrefFor(id: string): string | null {
    const space = getSpace(id);
    if (!space || space.group !== 'core') return null;
    return space.id === 'social' ? '/social?tab=insights' : `${space.href}/insights`;
}
