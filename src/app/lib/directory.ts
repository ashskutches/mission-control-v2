/**
 * The team directory — where a person's access tier is stored, as of 2026-08-18.
 *
 * ## What changed
 *
 * The tier used to be computed at sign-in from the signer's Discord roles (see the
 * history in lib/discord.ts). It now lives in `team_members.permission_tier` on
 * Supabase, so it can be granted from the Team page instead of from Discord.
 *
 * The split is deliberate and worth stating plainly, because it is now two systems:
 *
 *   Discord   decides whether you may sign in at all (guild membership)
 *   directory decides what you get once you are in (guest / teammate / admin)
 *
 * This is the second source of truth the original design avoided on purpose. The
 * cost is real: a person removed from Discord keeps their row here, which is why
 * `active: false` is honoured as a revocation and why the sync keeps running.
 *
 * ## Fail closed
 *
 * Every failure — bot down, timeout, unknown person, malformed reply — reads as
 * `guest`. It must never fail open: an outage that silently granted admin is a far
 * worse morning than an outage that drops everyone to the lobby. `DISCORD_ADMIN_USER_IDS`
 * is the break-glass that survives it, and the callback checks that BEFORE calling here.
 */

import type { Role } from "./session";

/**
 * Server-side only. Never the relative `/api/bot` proxy path: this runs in a route
 * handler, where a relative URL has no origin to resolve against.
 */
const BOT_ORIGIN =
    process.env.BOT_ORIGIN ??
    process.env.INTERNAL_BOT_URL ??
    "https://gravity-claw-production-fb9e.up.railway.app";

/** Same key the proxy injects. Absent is fine while the bot runs in audit mode. */
const BOT_API_KEY = process.env.BOT_API_KEY ?? "";

/** A sign-in must not hang on a slow bot; the tier is not worth a stalled login. */
const TIMEOUT_MS = 5_000;

export interface DirectoryLookup {
    tier: Role;
    /** False when the lookup failed or the person has no active row — both read as guest. */
    resolved: boolean;
    /** True when a row exists but nobody has granted a tier yet. */
    unset: boolean;
}

const GUEST: DirectoryLookup = { tier: "guest", resolved: false, unset: true };

function isRole(v: unknown): v is Role {
    return v === "guest" || v === "teammate" || v === "admin";
}

/** The stored tier for a Discord user id. Guest on anything unexpected. */
export async function tierFromDirectory(discordId: string): Promise<DirectoryLookup> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
        const headers: Record<string, string> = { "x-forwarded-by": "mission-control" };
        if (BOT_API_KEY) headers["x-admin-key"] = BOT_API_KEY;

        const res = await fetch(
            `${BOT_ORIGIN}/admin/team/permission/${encodeURIComponent(discordId)}`,
            { headers, cache: "no-store", signal: ctl.signal },
        );
        if (!res.ok) {
            console.error("Directory lookup failed", res.status);
            return GUEST;
        }
        const data = (await res.json()) as { tier?: unknown; unset?: unknown };
        if (!isRole(data.tier)) return GUEST;
        return { tier: data.tier, resolved: true, unset: data.unset === true };
    } catch (err) {
        // AbortError included: a timeout is a failure like any other, and fails closed.
        console.error("Directory lookup error", err instanceof Error ? err.message : err);
        return GUEST;
    } finally {
        clearTimeout(timer);
    }
}
