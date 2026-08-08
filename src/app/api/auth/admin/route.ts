import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createToken, roleFromToken, sessionCookie } from "@/app/lib/session";

/**
 * POST — elevate to admin with ADMIN_PASSWORD.
 * DELETE — step back down to viewer, keeping the session (that is the difference
 *          between this and /api/auth/logout, which drops the session entirely).
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

    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(sessionCookie(await createToken("admin", secret)));
    return res;
}

export async function DELETE(req: NextRequest) {
    const secret = process.env.SESSION_SECRET ?? "";
    const role = await roleFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);

    // No valid session to downgrade — say so rather than minting a viewer session
    // out of nothing, which would be a free login.
    if (!role) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const res = NextResponse.json({ ok: true, role: "viewer" });
    res.cookies.set(sessionCookie(await createToken("viewer", secret)));
    return res;
}
