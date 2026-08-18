import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, roleFromToken } from "@/app/lib/session";
import { canAccess, isAdminPath, landingFor } from "@/app/lib/access";

/**
 * Three tiers on one cookie:
 *   no valid session  -> /login   (Discord, or break-glass password)
 *   guest             -> GUEST_PATHS only (the lobby)
 *   teammate          -> GUEST_PATHS + TEAMMATE_PATHS
 *   admin             -> everything
 *
 * Both lower tiers are allowlists, so a page nobody opted in is admin-only. See
 * lib/access.ts.
 *
 * The policy itself lives in lib/access.ts so the sidebar cannot drift from the gate.
 * A higher tier never loses access to a lower tier's pages.
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

    // An /api/ caller is fetch(), not a browser following redirects. Sending it to
    // the login page means it parses HTML as JSON and reports the failure somewhere
    // unrelated to the expired session that caused it. /api/bot in particular builds
    // its own JSON 401 for exactly this reason, and a redirect here would preempt it.
    const isApi = pathname.startsWith("/api/");

    if (!role) {
        if (isApi) {
            return NextResponse.json(
                { error: "Not signed in", detail: "Dashboard session required." },
                { status: 401 },
            );
        }
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (canAccess(role, pathname)) return NextResponse.next();

    if (isApi) {
        return NextResponse.json(
            {
                error: isAdminPath(pathname) ? "Admin required" : "Insufficient access",
                detail: `This endpoint needs a higher tier than "${role}".`,
            },
            { status: 403 },
        );
    }

    // "/" is teammate+, so a guest who opens the bare domain — a bookmark, or just
    // typing the host — is not making a mistake worth an error page. Send them to
    // their own landing page instead of /no-access.
    if (pathname === "/") {
        return NextResponse.redirect(new URL(landingFor(role), req.url));
    }

    // Signed in, just not high enough. Where we send them depends on what would
    // actually help: a guest needs a role from an admin, whereas a teammate short of
    // an admin page can still get there with the break-glass password.
    if (role === "guest") {
        const denied = new URL("/no-access", req.url);
        denied.searchParams.set("reason", "need_role");
        denied.searchParams.set("from", pathname);
        return NextResponse.redirect(denied);
    }

    const adminUrl = new URL("/admin", req.url);
    adminUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(adminUrl);
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
