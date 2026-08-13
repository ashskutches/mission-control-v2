/**
 * Who can reach what. Three tiers.
 *
 *   guest    — anyone signed in with Discord. No role needed, not even membership
 *              of the guild. A lobby: the overview, tasks, research, brand.
 *   teammate — the "Teammate" Discord role. The whole operational dashboard.
 *   admin    — the "Admin" Discord role. Adds money and agent control.
 *
 * ONE policy, read by three places, so a page can never be hidden in the sidebar but
 * left reachable by URL (or the reverse):
 *   - src/middleware.ts        the actual gate
 *   - src/components/Sidebar   hides the nav entries
 *   - (dashboard)/page.tsx     hides the Profitability tab of Command Center
 *
 * GUEST_PATHS is an **allowlist** and ADMIN_PATHS a denylist, deliberately. A page
 * added later is invisible to guests until someone opts it in, but visible to
 * teammates by default — so forgetting to touch this file fails closed for the
 * untrusted tier and open for the trusted one.
 *
 * Matching is exact-or-subtree: "/costs" covers "/costs" and "/costs/anything", but
 * NOT "/costsomething". "/" is special-cased to exact, or it would match everything.
 */

export type Tier = "guest" | "teammate" | "admin";

/** Admin only. Money, and anything that spends it. */
export const ADMIN_PATHS = [
    "/profitability",   // Profit — the P&L
    "/costs",           // Agent cost breakdown
    "/quick-run",       // fires an agent — spends API credits
    "/agents",          // agent roster + per-agent config
] as const;

/**
 * The guest lobby. Everything NOT listed here needs at least Teammate.
 *
 * Nothing with customer PII belongs in this list — no /orders, /support, /chats,
 * /customer. Those are the pages the tier exists to keep people out of.
 */
export const GUEST_PATHS = [
    "/",            // Command Center overview (money widgets hidden — see below)
    "/work",        // Tasks
    "/research",    // Research reports
    "/brand",       // Brand guide
] as const;

const matches = (p: string, pathname: string) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/");

export function isAdminPath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return ADMIN_PATHS.some((p) => matches(p, pathname));
}

export function isGuestPath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return GUEST_PATHS.some((p) => matches(p, pathname));
}

/**
 * The whole rule, in one place. Admin outranks teammate outranks guest, so a higher
 * tier never loses access by being promoted.
 */
export function canAccess(tier: Tier, pathname: string): boolean {
    if (isAdminPath(pathname)) return tier === "admin";
    if (tier === "guest") return isGuestPath(pathname);
    return true;   // teammate and admin reach everything that isn't admin-only
}

/**
 * Command Center renders the Profit dashboard as a tab at /?tab=profitability from
 * the same component /profitability uses. The route gate cannot see a query string,
 * so that tab is hidden client-side by tier instead — see (dashboard)/page.tsx.
 */
export const ADMIN_CC_TABS = ["profitability"] as const;

/**
 * Overview widgets a guest must not be shown: revenue, AOV, forecast, spend.
 *
 * ⚠️ This is presentation only. The Overview page fetches /admin/overview, which
 * returns the revenue figures in one payload — hiding the widget does not stop a
 * guest reading the response. Real enforcement needs the bot API to withhold the
 * numbers by tier, which lands with the /api/bot proxy rollout. Until then treat
 * this as tidiness, not security. (As of 2026-08-12 that endpoint answers
 * unauthenticated requests anyway, so the data is public regardless of this flag.)
 */
export const GUEST_HIDDEN_OVERVIEW = ["revenue", "costs", "profit"] as const;
