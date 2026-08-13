import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, discordConfig, publicOrigin, redirectUri } from "@/app/lib/discord";
import { createState, nonceCookie } from "@/app/lib/oauth-state";

/**
 * Start the Discord login. GET so it can be a plain link from /login.
 *
 * ?from=<path> is carried through the round trip inside the signed state, so the
 * callback can drop you back where the middleware interrupted you.
 */
export async function GET(req: NextRequest) {
    const cfg = discordConfig();
    if (!cfg) {
        console.error("Discord login attempted but DISCORD_* env vars are incomplete");
        return NextResponse.redirect(new URL("/login?error=discord_unconfigured", publicOrigin(req)));
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        console.error("SESSION_SECRET is not set — refusing to start an unsigned OAuth flow");
        return NextResponse.redirect(new URL("/login?error=server", publicOrigin(req)));
    }

    const { state, nonce } = await createState(req.nextUrl.searchParams.get("from") ?? "/", secret);
    const res = NextResponse.redirect(authorizeUrl(cfg, redirectUri(req, cfg), state));
    res.cookies.set(nonceCookie(nonce));
    return res;
}
