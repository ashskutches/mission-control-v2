import { NextRequest, NextResponse } from "next/server";
import {
    discordConfig,
    exchangeCode,
    fetchGuildRoles,
    fetchIdentity,
    publicOrigin,
    redirectUri,
    tierForSignIn,
} from "@/app/lib/discord";
import { clearNonceCookie, NONCE_COOKIE, verifyState } from "@/app/lib/oauth-state";
import { createToken, sessionCookie } from "@/app/lib/session";
import { canAccess } from "@/app/lib/access";

/**
 * Where Discord sends people back to. Every failure path lands somewhere that explains
 * itself — a blank redirect to /login with no reason is the thing that makes OAuth
 * feel broken when it is really just a missing role.
 *
 * The nonce cookie is cleared on every exit, success or not, so a stale one cannot be
 * replayed against a later attempt.
 */
export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;

    // publicOrigin, not req.url: inside the container req.url is http://0.0.0.0:3000,
    // and a Location built from it sends the browser somewhere it cannot reach.
    const origin = publicOrigin(req);
    const bail = (path: string) => {
        const res = NextResponse.redirect(new URL(path, origin));
        res.cookies.set(clearNonceCookie());
        return res;
    };

    // The user pressed Cancel on Discord's consent screen, or Discord refused.
    const oauthError = params.get("error");
    if (oauthError) {
        // access_denied is a normal human choice, not a fault worth logging as one.
        if (oauthError !== "access_denied") console.error("Discord returned error:", oauthError);
        return bail("/login?error=denied");
    }

    const cfg = discordConfig();
    const secret = process.env.SESSION_SECRET;
    if (!cfg || !secret) {
        console.error("Discord callback hit without complete configuration");
        return bail("/login?error=discord_unconfigured");
    }

    const state = await verifyState(params.get("state"), req.cookies.get(NONCE_COOKIE)?.value, secret);
    if (!state) {
        // Usually a bookmarked callback URL or a login left open past the 10-minute
        // nonce, not an attack — but it is indistinguishable from one, so it fails.
        return bail("/login?error=state");
    }

    const code = params.get("code");
    if (!code) return bail("/login?error=state");

    const accessToken = await exchangeCode(cfg, code, redirectUri(req, cfg));
    if (!accessToken) return bail("/login?error=exchange");

    const user = await fetchIdentity(accessToken);
    if (!user) return bail("/login?error=identity");

    // null means "not in the guild", which is no longer a refusal — they simply have
    // no roles, and everyone who signs in is at least a guest.
    const guildRoles = await fetchGuildRoles(accessToken, cfg.guildId);
    const role = tierForSignIn(cfg, user.id, guildRoles);

    // A guest landing on a page above their tier would bounce straight back out, so
    // send them somewhere they can actually see rather than to `state.from`.
    const dest = role === "guest" && !canAccess("guest", state.from) ? "/" : state.from;

    const res = NextResponse.redirect(new URL(dest, origin));
    res.cookies.set(sessionCookie(await createToken(role, secret, user)));
    res.cookies.set(clearNonceCookie());
    return res;
}
