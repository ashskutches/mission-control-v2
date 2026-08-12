import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, roleFromToken } from "@/app/lib/session";
import { isAdminPath } from "@/app/lib/access";

/**
 * Two tiers on one cookie:
 *   no valid session  -> /login   (Discord, or break-glass password)
 *   viewer            -> everything except ADMIN_PATHS
 *   admin             -> everything
 *
 * An admin token satisfies the viewer check too — elevating never costs you access.
 *
 * The tier comes from the signer's Discord roles at sign-in time (see
 * src/app/lib/discord.ts). This middleware only reads what the cookie says; it never
 * calls Discord, because it runs on every request and an API round trip per navigation
 * would be both slow and rate-limited.
 */

// Exact path or subtree. `/admin` is the break-glass elevation form; it has to be
// reachable by someone holding no session at all, otherwise you would have to log in
// as a viewer first just to reach the admin prompt. `/no-access` is where a valid
// Discord sign-in with no qualifying role lands — gating it would bounce those people
// to /login and make a role problem look like a password problem.
const PUBLIC_PATHS = ["/login", "/admin", "/no-access", "/api/auth"];

const isPublic = (pathname: string) =>
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isPublic(pathname)) return NextResponse.next();

    const token = req.cookies.get(COOKIE_NAME)?.value;
    const secret = process.env.SESSION_SECRET ?? "";
    const role = await roleFromToken(token, secret);

    if (!role) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (role !== "admin" && isAdminPath(pathname)) {
        // Signed in, just not high enough. Send them to the elevation form rather
        // than /login — they already have a session and re-entering the dashboard
        // password would not help.
        const adminUrl = new URL("/admin", req.url);
        adminUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(adminUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Run on all routes except Next.js internals and static files.
    // The trailing extension group excludes public/ assets (hero banner,
    // wordmark, icons, svgs) so they aren't 307-redirected to /login for
    // logged-out visitors — otherwise the login page's own background and
    // logo fail to load.
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|txt|xml|json|woff2?)$).*)",
    ],
};
