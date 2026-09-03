/**
 * Who can reach what. Three tiers.
 *
 *   guest    — signed in with Discord AND a member of a configured guild, but holding
 *              no access role. A lobby: content, research, agents, quick run, chats.
 *   teammate — the "Teammate" Discord role. Adds the operational dashboard.
 *   admin    — the "Admin" Discord role. Everything.
 *
 * ONE policy, read by four places, so a page can never be hidden in the sidebar but
 * left reachable by URL (or the reverse):
 *   - src/middleware.ts                     the actual gate
 *   - src/components/Sidebar                hides the nav entries
 *   - api/auth/discord/callback             where a sign-in lands
 *   - (dashboard)/page.tsx                  hides the Profitability tab of Command Center
 *
 * ## Both lower tiers are allowlists — this is default-deny
 *
 * guest and teammate each get an explicit list; admin gets everything. A page added
 * later is therefore **admin-only until someone opts it in**, which is the safe
 * direction: forgetting to touch this file hides a new page from everyone but the
 * owner rather than quietly publishing it.
 *
 * That is a change from the earlier model, where teammate meant "everything that is
 * not admin-only" and a new page was teammate-visible by default. If you add a page
 * and your team says they cannot see it, this file is why.
 *
 * Matching is exact-or-subtree: "/orders" covers "/orders" and "/orders/anything", but
 * NOT "/ordersomething". "/" is special-cased to exact, or it would match everything.
 */

export type Tier = "guest" | "teammate" | "admin";

/**
 * The guest lobby. Reachable by anyone in the Discord who has no role yet.
 *
 * Guest is NOT anonymous — sign-in requires membership of a configured guild (see
 * tierForSignIn in lib/discord.ts). That membership requirement is what makes it
 * reasonable for this list to include /agents (system prompts), /quick-run (spends
 * API credits) and /chats (conversation history). If guild membership is ever
 * relaxed, this list has to shrink in the same commit.
 *
 * Nothing with customer PII belongs here — no /orders, /support, /customer.
 */
export const GUEST_PATHS = [
    "/content",     // Content
    "/research",    // Research
    "/agents",      // Agents
    "/quick-run",   // Quick Run — fires agents, spends API credits
    "/chats",       // Chats
] as const;

/**
 * What the "Teammate" role adds on top of the guest lobby. The operational dashboard.
 *
 * "/" is here and not in GUEST_PATHS deliberately: Command Center is the page every
 * signed-in teammate lands on, so it cannot be admin-only, but its payload carries
 * revenue figures that a guest should not be handed. A guest lands on /content
 * instead — see landingFor().
 */
export const TEAMMATE_PATHS = [
    "/",                          // Command Center — the landing page for teammate+
    "/website",                   // Website
    "/marketing",                 // Marketing
    "/seo",                       // SEO
    "/logistics",                 // Logistics
    "/orders",                    // Orders
    "/support",                   // Support
    "/landing-pages",             // Landing Pages — moved out of the deleted /commerce tree
    "/work",                      // Tasks
    "/blockages",                 // Blockages
    // Insights — and specifically /pipeline/<id>, the conversation on one insight.
    //
    // This was admin-only by default (default-deny: a page is admin-only until it
    // is listed here), which made the whole agent→human loop unreachable for the
    // people it exists for. An agent DMs a teammate a question and a link to the
    // insight; before this, Ryan (teammate) clicking that link landed on
    // /no-access. A question nobody can open is not a question.
    //
    // The board carries dollar figures, so this is a real widening and not a
    // formality — but every one of those figures is labelled `measured` or
    // `claimed` and the same teammates already see /profitability-adjacent
    // numbers on Command Center, which is in this list. Narrowing it later means
    // splitting the detail page out from the board, not removing this line.
    "/pipeline",                  // Insights + per-insight conversation
    // Agent Behaviour — where the agents get stuck and how much of it they say
    // themselves.
    //
    // Opted in rather than left admin-only by default, because it is the same
    // class of information as /blockages and /work, which are both on this list:
    // agent operational state, no customer data, no revenue figures. And the
    // people most likely to notice that an agent has been quietly stuck for a
    // week are the ones being DM'd by it, not the owner.
    //
    // The one write on the page — closing a limitation out — is admin-only, and
    // enforced by the proxy rather than by hiding the button. Asserting that a
    // capability gap is gone is a claim only the person who built or granted the
    // thing can make.
    "/agent-behavior",            // Agent Behaviour
    "/settings",                  // Settings
] as const;

const matches = (p: string, pathname: string) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/");

export function isGuestPath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return GUEST_PATHS.some((p) => matches(p, pathname));
}

/** Reachable by a teammate: their own list, plus the guest lobby they inherit. */
export function isTeammatePath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return isGuestPath(pathname) || TEAMMATE_PATHS.some((p) => matches(p, pathname));
}

/**
 * Admin-only, meaning "on neither allowlist". Derived rather than listed, so it can
 * never disagree with the two lists above.
 *
 * Today that covers Sales (/sales), Profit (/profitability), Costs (/costs),
 * Insights (/pipeline), Social (/social), Brand (/brand), Team (/team),
 * Customer (/customer) and Roundtable (/roundtable) — plus anything added later
 * and not opted in.
 *
 * /sales is admin-only by the same deliberate choice /profitability was: it is the
 * revenue surface, and it absorbed the P&L as its Profit tab, so opening it to the
 * team opens gross margin, CAC and per-product cost with it. One line in
 * TEAMMATE_PATHS if that is wanted — but note that would ALSO have to be a
 * decision about /sales/profit, which is the same numbers /profitability serves.
 *
 * /roundtable is admin-only **on purpose**, not by omission. It fires several
 * agents per run, and its transcripts are unreviewed agent argument about business
 * strategy — readable as settled conclusions by someone who does not know it is an
 * experiment. Opening it to the team is one line in TEAMMATE_PATHS, worth doing
 * once the format has shown it produces something worth reading.
 *
 * Two of those are spaces (see lib/spaces.tsx). A space being admin-only is a real
 * choice, not an oversight: /social is still half mocks, and /brand carries brand
 * strategy. Opening either to the team is one line in TEAMMATE_PATHS.
 */
export function isAdminPath(pathname: string | undefined | null): boolean {
    if (!pathname) return false;
    return !isTeammatePath(pathname);
}

/**
 * The whole rule, in one place.
 *
 * Written so the tiers nest by construction — admin ⊇ teammate ⊇ guest — which is the
 * property that stops a promotion from *removing* access. Do not rewrite this as three
 * independent branches; that is exactly how a higher tier ends up losing a page.
 */
export function canAccess(tier: Tier, pathname: string): boolean {
    if (tier === "admin") return true;
    if (isGuestPath(pathname)) return true;
    if (tier === "teammate") return isTeammatePath(pathname);
    return false;
}

/**
 * Where a tier lands when it has no specific destination, or asked for one it cannot
 * have. Guests cannot reach "/", so sending them there produces an immediate bounce
 * to /no-access and makes a working sign-in look broken — that shipped once.
 */
export function landingFor(tier: Tier): string {
    return tier === "guest" ? "/content" : "/";
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
 * Retained as defence in depth only. Guests can no longer reach Command Center at all
 * ("/" is teammate+), so nothing consults this today. It matters again the moment "/"
 * is reopened to guests — and the warning below still applies if that happens.
 *
 * ⚠️ This is presentation only. The Overview page fetches /admin/overview, which
 * returns the revenue figures in one payload — hiding the widget does not stop a
 * caller reading the response. Real enforcement needs the bot API to withhold the
 * numbers by tier (ADMIN_AUTH_MODE=enforce plus the /api/bot proxy).
 */
export const GUEST_HIDDEN_OVERVIEW = ["revenue", "costs", "profit"] as const;
