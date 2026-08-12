import { NextRequest, NextResponse } from "next/server";
import { createToken, sessionCookie } from "@/app/lib/session";

/**
 * Break-glass password login. The dashboard password -> a viewer session.
 *
 * Discord is the advertised way in (see /api/auth/discord); this form is only reachable
 * at /login?break-glass=1 and exists so a broken OAuth config cannot lock everyone out
 * of production. Sessions it issues carry no Discord identity, which is why the sidebar
 * shows them as "break-glass session" rather than a name.
 *
 * The admin password is also accepted here and yields an admin session directly.
 * It costs nothing (you already had to know the admin password) and avoids the
 * dead end where an admin types their own password into the normal form and is
 * told it is invalid. /admin remains the explicit way to elevate an existing
 * session; this is the shortcut for signing in cold.
 */
export async function POST(req: NextRequest) {
    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const dashboardPassword = process.env.DASHBOARD_PASSWORD;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const secret = process.env.SESSION_SECRET ?? "";

    if (!dashboardPassword) {
        console.error("DASHBOARD_PASSWORD is not set in environment variables");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const supplied = body.password;
    // An unset ADMIN_PASSWORD must never match an empty submission.
    const role =
        supplied && adminPassword && supplied === adminPassword ? "admin"
        : supplied && supplied === dashboardPassword ? "viewer"
        : null;

    if (!role) {
        // Small delay to slow brute force
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, role });
    res.cookies.set(sessionCookie(await createToken(role, secret)));
    return res;
}
