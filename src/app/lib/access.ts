/**
 * Which routes require an admin session.
 *
 * ONE list, read by three places, so a page can never be hidden in the sidebar but
 * left reachable by URL (or the reverse):
 *   - src/middleware.ts        the actual gate — redirects non-admins to /admin
 *   - src/components/Sidebar   hides the nav entries
 *   - (dashboard)/page.tsx     hides the Profitability tab of Command Center
 *
 * To put another page behind the admin login, add its path here and nothing else.
 *
 * Matching is exact-or-subtree: "/costs" covers "/costs" and "/costs/anything",
 * but NOT "/costsomething". Plain `startsWith` would gate the latter by accident.
 */
export const ADMIN_PATHS = [
    "/profitability",   // Profit — the P&L
    "/costs",           // Agent cost breakdown
    "/quick-run",       // fires an agent — spends API credits
    "/agents",          // agent roster + per-agent config
] as const;

export function isAdminPath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Command Center renders the Profit dashboard as a tab at /?tab=profitability from
 * the same component /profitability uses. The route gate cannot see a query string,
 * so that tab is hidden client-side by role instead — see (dashboard)/page.tsx.
 */
export const ADMIN_CC_TABS = ["profitability"] as const;
