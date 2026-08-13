/**
 * Discord OAuth — the primary way in.
 *
 * Access is decided by Discord server roles, so adding or removing a person is done
 * in Discord and nowhere else. There is no user table here on purpose: a role removed
 * in Discord takes effect the next time that person signs in, and there is no second
 * list to keep in sync.
 *
 *   "Admin" role     -> admin     (Profit, Costs, Quick Run, Agents)
 *   "Teammate" role  -> teammate  (the operational dashboard)
 *   anyone else      -> guest     (a lobby: overview, tasks, research, brand)
 *
 * Guest requires no role and not even guild membership — completing a Discord
 * sign-in is enough. See tierForSignIn, and GUEST_PATHS in lib/access.ts for the
 * (short) list of what that actually opens.
 *
 * We read the member's roles with the *user's own* OAuth token via the
 * `guilds.members.read` scope, not with the gravity-claw bot token. This service
 * therefore never holds a credential that can act as the bot, and a leak here cannot
 * post to Discord or read channels.
 *
 * Env:
 *   DISCORD_CLIENT_ID      the gravity-claw application's client id
 *   DISCORD_CLIENT_SECRET  from the Developer Portal -> OAuth2
 *   DISCORD_GUILD_ID       the server whose roles decide access
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
    guildId: string;
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

    return {
        clientId,
        clientSecret,
        guildId,
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

/**
 * Decide the tier for someone who has just signed in.
 *
 * `roleIds` is null when they are not in the guild at all — which is not a refusal
 * any more: everyone who completes a Discord sign-in is at least a guest.
 *
 *   DISCORD_ADMIN_USER_IDS  -> admin   (checked first, see below)
 *   "Admin" role            -> admin
 *   "Teammate" role         -> teammate
 *   anything else           -> guest
 *
 * The user-id allowlist is checked before roles and exists because **a Discord guild
 * owner holds no roles**. Owners have implicit permission over their server without
 * ever being granted a role, so the owner of this guild was denied by a mapping that
 * only reads roles — locked out of their own dashboard while four other people were
 * admins. It doubles as the escape hatch if the Admin role is ever deleted or
 * renamed: no role in Discord can lock out an id named here.
 */
export function tierForSignIn(
    cfg: DiscordConfig,
    userId: string,
    roleIds: string[] | null,
): Role {
    if (cfg.adminUserIds.includes(userId)) return "admin";
    const roles = roleIds ?? [];
    if (roles.includes(cfg.adminRoleId)) return "admin";
    if (roles.includes(cfg.viewerRoleId)) return "teammate";
    return "guest";
}

/** Discord CDN avatar, or null to fall back to initials. */
export function avatarUrl(user: SessionUser, size = 64): string | null {
    if (!user.avatar) return null;
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}
