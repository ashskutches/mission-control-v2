/**
 * Discord OAuth — the primary way in.
 *
 * Access is decided by Discord server roles, so adding or removing a person is done
 * in Discord and nowhere else. There is no user table here on purpose: a role removed
 * in Discord takes effect the next time that person signs in, and there is no second
 * list to keep in sync.
 *
 *   "Admin" role     -> admin     (everything)
 *   "Teammate" role  -> teammate  (the operational dashboard)
 *   no role          -> guest     (a lobby: content, research, agents, quick run, chats)
 *   not in the guild -> DENIED
 *
 * **Guest requires guild membership.** Completing a Discord sign-in is not enough:
 * someone who is not in one of the configured guilds is refused outright and sent to
 * /no-access?reason=not_member. That requirement is load-bearing — the guest lobby
 * includes /quick-run (which spends API credits), /agents (system prompts) and /chats
 * (conversation history), and none of that belongs on the open internet. If membership
 * is ever relaxed, GUEST_PATHS in lib/access.ts must shrink in the same commit.
 *
 * We read the member's roles with the *user's own* OAuth token via the
 * `guilds.members.read` scope, not with the gravity-claw bot token. This service
 * therefore never holds a credential that can act as the bot, and a leak here cannot
 * post to Discord or read channels.
 *
 * Env:
 *   DISCORD_CLIENT_ID      the gravity-claw application's client id
 *   DISCORD_CLIENT_SECRET  from the Developer Portal -> OAuth2
 *   DISCORD_GUILD_ID       the primary server, whose roles decide access
 *   DISCORD_EXTRA_GUILD_IDS  optional, comma-separated. Membership of any of these
 *                            also admits someone — see the multi-guild note on
 *                            resolveMembership.
 *   DISCORD_ADMIN_ROLE_ID  role granting admin
 *   DISCORD_VIEWER_ROLE_ID role granting teammate
 *   DISCORD_ADMIN_USER_IDS comma-separated Discord user ids that are always admin
 *   DISCORD_REDIRECT_URI   optional override; otherwise derived from the request
 */

import type { NextRequest } from "next/server";
import type { Role, SessionUser } from "./session";

const API = "https://discord.com/api/v10";

export const DISCORD_SCOPES = "identify guilds.members.read";

export interface DiscordConfig {
    clientId: string;
    clientSecret: string;
    /** The primary guild. Its role ids are the ones below. */
    guildId: string;
    /**
     * Every guild whose members may sign in, primary first. Membership of any one of
     * them admits the signer; only the primary's roles are mapped to tiers.
     */
    guildIds: string[];
    adminRoleId: string;
    viewerRoleId: string;
    redirectUriOverride: string | null;
    /** Discord user ids always treated as admin, whatever their roles say. */
    adminUserIds: string[];
}

/**
 * The config, or null when this deployment has no Discord login set up. Every caller
 * checks for null rather than throwing, so a half-configured deploy degrades to the
 * break-glass password instead of 500ing on the login page.
 */
export function discordConfig(): DiscordConfig | null {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const guildId = process.env.DISCORD_GUILD_ID;
    const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
    const viewerRoleId = process.env.DISCORD_VIEWER_ROLE_ID;

    if (!clientId || !clientSecret || !guildId || !adminRoleId || !viewerRoleId) return null;

    // Comma-separated so a second company's server is an env change, not a deploy of
    // new code. The primary stays first — resolveMembership checks it before the rest.
    const extraGuildIds = (process.env.DISCORD_EXTRA_GUILD_IDS ?? "")
        .split(",").map((s) => s.trim()).filter(Boolean);

    return {
        clientId,
        clientSecret,
        guildId,
        guildIds: [guildId, ...extraGuildIds.filter((g) => g !== guildId)],
        adminRoleId,
        viewerRoleId,
        redirectUriOverride: process.env.DISCORD_REDIRECT_URI ?? null,
        adminUserIds: (process.env.DISCORD_ADMIN_USER_IDS ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean),
    };
}

/**
 * The callback URL, which must match a redirect registered in the Developer Portal
 * byte for byte.
 *
 * Railway terminates TLS ahead of the app, so `req.url` says http and Discord rejects
 * the mismatch. Trust x-forwarded-proto, and let DISCORD_REDIRECT_URI override it
 * outright for anything exotic.
 */
export function redirectUri(req: NextRequest, cfg: DiscordConfig): string {
    if (cfg.redirectUriOverride) return cfg.redirectUriOverride;
    return `${publicOrigin(req)}/api/auth/discord/callback`;
}

/**
 * The origin a browser actually used to reach us.
 *
 * **Never build a redirect from `req.url` in a route handler.** Railway terminates TLS
 * ahead of the app and the container binds 0.0.0.0:3000, so `req.url` is
 * `http://0.0.0.0:3000/...` — and `new URL(path, req.url)` inherits that, producing a
 * Location header pointing at an address the browser cannot reach. This shipped once:
 * a successful Discord sign-in redirected to `https://0.0.0.0:3000/no-access`.
 *
 * Middleware redirects are unaffected because Next resolves those relative to the
 * incoming request itself, which is why only the route handlers broke.
 */
export function publicOrigin(req: NextRequest): string {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto")
        ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
}

export function authorizeUrl(cfg: DiscordConfig, redirect: string, state: string): string {
    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: DISCORD_SCOPES,
        state,
    });
    // The human-facing consent page, not the REST API — deliberately unversioned.
    //
    // `prompt=none` would skip the consent screen for people who have already granted
    // access, which is nicer for a dashboard used daily. It is left off until someone
    // has confirmed the flow end to end with a real account: the parameter's behaviour
    // for a *first-time* signer is the ambiguous case, and getting it wrong breaks the
    // one login that has to work. Add it once the happy path is proven.
    return `https://discord.com/oauth2/authorize?${params}`;
}

/** Trade the one-time code for an access token. Returns null on any Discord-side refusal. */
export async function exchangeCode(
    cfg: DiscordConfig,
    code: string,
    redirect: string,
): Promise<string | null> {
    const res = await fetch(`${API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirect,
        }),
        cache: "no-store",
    });
    if (!res.ok) {
        console.error("Discord token exchange failed", res.status, await res.text().catch(() => ""));
        return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
}

/** GET /users/@me — who signed in. */
export async function fetchIdentity(accessToken: string): Promise<SessionUser | null> {
    const res = await fetch(`${API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
    });
    if (!res.ok) return null;
    const u = (await res.json()) as {
        id?: string; username?: string; global_name?: string | null; avatar?: string | null;
    };
    if (!u.id || !u.username) return null;
    return {
        id: u.id,
        // global_name is the display name people actually recognise; username is the handle.
        username: u.global_name || u.username,
        avatar: u.avatar ?? null,
    };
}

/**
 * The signer's roles in our guild, or null if they are not a member.
 *
 * Discord returns 404 for a non-member, which is the "not in the server" case and is
 * indistinguishable in effect from having no role — both are denied.
 */
export async function fetchGuildRoles(
    accessToken: string,
    guildId: string,
): Promise<string[] | null> {
    const res = await fetch(`${API}/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
    });
    if (!res.ok) {
        if (res.status !== 404) {
            console.error("Discord member lookup failed", res.status, await res.text().catch(() => ""));
        }
        return null;
    }
    const m = (await res.json()) as { roles?: string[] };
    return Array.isArray(m.roles) ? m.roles : [];
}

/** Which guild the signer turned out to be in, and what they hold there. */
export interface Membership {
    guildId: string;
    roleIds: string[];
}

/**
 * Find the first configured guild the signer actually belongs to, or null if none.
 *
 * Guilds are checked in order and the search stops at the first hit, so the primary
 * costs one request for the common case. A non-member is a 404 from Discord, which
 * fetchGuildRoles already reports as null.
 *
 * ## Multi-guild, and what is deliberately NOT built yet
 *
 * Membership of any configured guild admits the signer, but only the primary guild's
 * role ids are mapped to tiers (there is one DISCORD_ADMIN_ROLE_ID, not one per
 * guild). So someone whose only membership is a secondary guild signs in as a **guest**
 * no matter what roles they hold there. That is the intended behaviour for now — the
 * second company's server grants the lobby and nothing more. Giving it its own admin
 * and teammate roles means a per-guild role map, which is a deliberate next step and
 * not an accident of this shape.
 */
export async function resolveMembership(
    accessToken: string,
    cfg: DiscordConfig,
): Promise<Membership | null> {
    for (const guildId of cfg.guildIds) {
        const roleIds = await fetchGuildRoles(accessToken, guildId);
        if (roleIds !== null) return { guildId, roleIds };
    }
    return null;
}

/**
 * The outcome of a sign-in. A refusal carries its reason so the callback can send the
 * person somewhere that explains itself rather than to a bare /login.
 *
 * Deliberately one object with nullable fields rather than the discriminated union
 * (`{ok:true,...} | {ok:false,...}`) this obviously wants to be: this project compiles
 * with `strict: false`, and without strictNullChecks TypeScript does not narrow a
 * union by a boolean discriminant — `if (!d.ok)` left `d.reason` an error on the
 * success member. Both fields exist on the one type, so no narrowing is required.
 */
export interface SignInDecision {
    /** The granted tier, or null if the sign-in was refused. */
    tier: Role | null;
    /** Why it was refused. Null on success. */
    reason: "not_member" | null;
}

/**
 * Decide the tier for someone who has just signed in.
 *
 *   DISCORD_ADMIN_USER_IDS       -> admin           (checked first, see below)
 *   not in any configured guild  -> refused         ("not_member")
 *   "Admin" role in primary      -> admin
 *   "Teammate" role in primary   -> teammate
 *   anything else                -> guest
 *
 * Membership is required, but the user-id allowlist is checked *before* it, because
 * **a Discord guild owner holds no roles** — owners have implicit permission over
 * their server without ever being granted one, and a mapping that only reads roles
 * locked the owner out of their own dashboard while four other people were admins.
 * Checking it ahead of the membership test also means a wrong DISCORD_GUILD_ID cannot
 * lock out the ids named there: it is the escape hatch of last resort, and it has to
 * survive the failure of everything else.
 *
 * Roles are only read from the primary guild — see resolveMembership.
 */
export function tierForSignIn(
    cfg: DiscordConfig,
    userId: string,
    membership: Membership | null,
): SignInDecision {
    const granted = (tier: Role): SignInDecision => ({ tier, reason: null });

    if (cfg.adminUserIds.includes(userId)) return granted("admin");
    if (!membership) return { tier: null, reason: "not_member" };

    // A secondary guild carries no role mapping, so it can only ever yield guest.
    const roles = membership.guildId === cfg.guildId ? membership.roleIds : [];
    if (roles.includes(cfg.adminRoleId)) return granted("admin");
    if (roles.includes(cfg.viewerRoleId)) return granted("teammate");
    return granted("guest");
}

/** Discord CDN avatar, or null to fall back to initials. */
export function avatarUrl(user: SessionUser, size = 64): string | null {
    if (!user.avatar) return null;
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}
