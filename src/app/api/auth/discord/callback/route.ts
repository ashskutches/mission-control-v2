import { NextRequest, NextResponse } from "next/server";
import {
    discordConfig,
    exchangeCode,
    fetchIdentity,
    publicOrigin,
    redirectUri,
    resolveMembership,
    admitForSignIn,
} from "@/app/lib/discord";
import { tierFromDirectory } from "@/app/lib/directory";
import type { Role } from "@/app/lib/session";
import { clearNonceCookie, NONCE_COOKIE, verifyState } from "@/app/lib/oauth-state";
import { createToken, sessionCookie } from "@/app/lib/session";
import { canAccess, landingFor } from "@/app/lib/access";

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

    // Membership of a configured guild is required. A non-member gets a page that says
    // so — bouncing them to /login instead makes an invite problem look like a broken
    // password, and they retry forever.
    const membership = await resolveMembership(accessToken, cfg);
    const { admitted, breakGlass, reason } = admitForSignIn(cfg, user.id, membership);
    if (!admitted) return bail(`/no-access?reason=${reason}`);

    // Discord said they may come in; the team directory says what they get. Break-glass
    // ids skip the lookup entirely, so a Supabase outage or an empty table cannot lock
    // the owner out of their own dashboard. Everything else fails closed to guest.
    const role: Role = breakGlass ? "admin" : (await tierFromDirectory(user.id)).tier;

    // Any tier can ask for a page above itself, now that teammate is default-deny too
    // — so this is checked for everyone, not just guests. landingFor keeps a guest off
    // "/", which they cannot reach: sending them there turns a good sign-in into a
    // bounce to /no-access.
    const dest = canAccess(role, state.from) ? state.from : landingFor(role);

    const res = NextResponse.redirect(new URL(dest, origin));
    res.cookies.set(sessionCookie(await createToken(role, secret, user)));
    res.cookies.set(clearNonceCookie());
    return res;
}
