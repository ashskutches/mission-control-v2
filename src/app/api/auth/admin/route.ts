import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createToken, sessionCookie, sessionFromToken } from "@/app/lib/session";

/**
 * Break-glass admin elevation by password.
 *
 * Discord roles are the normal way to become an admin — see /api/auth/discord. This
 * stays because a broken client secret, an expired OAuth app, or a Discord outage
 * would otherwise lock everyone out of production with no way back in. Unset
 * ADMIN_PASSWORD to remove the path entirely; no code change needed.
 *
 * POST — elevate to admin with ADMIN_PASSWORD.
 * DELETE — step back down to viewer, keeping the session (that is the difference
 *          between this and /api/auth/logout, which drops the session entirely).
 *
 * Both preserve whatever Discord identity the session already carries, so elevating
 * does not turn a named session into an anonymous one.
 */

export async function POST(req: NextRequest) {
    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    const secret = process.env.SESSION_SECRET ?? "";

    if (!adminPassword) {
        console.error("ADMIN_PASSWORD is not set in environment variables");
        return NextResponse.json(
            { error: "Admin access is not configured on this server" },
            { status: 500 },
        );
    }

    if (!body.password || body.password !== adminPassword) {
        // Small delay to slow brute force
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }

    const existing = await sessionFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);
    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(sessionCookie(await createToken("admin", secret, existing?.user ?? null)));
    return res;
}

export async function DELETE(req: NextRequest) {
    const secret = process.env.SESSION_SECRET ?? "";
    const existing = await sessionFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);

    // No valid session to downgrade — say so rather than minting a viewer session
    // out of nothing, which would be a free login.
    if (!existing) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const res = NextResponse.json({ ok: true, role: "viewer" });
    res.cookies.set(sessionCookie(await createToken("viewer", secret, existing.user)));
    return res;
}
