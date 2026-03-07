import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gc_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

async function createToken(secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const payload = `gc-auth-${Date.now()}`;
    const sigBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload),
    );
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const correctPassword = process.env.DASHBOARD_PASSWORD;
    const secret = process.env.SESSION_SECRET ?? "";

    if (!correctPassword) {
        console.error("DASHBOARD_PASSWORD is not set in environment variables");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!body.password || body.password !== correctPassword) {
        // Small delay to slow brute force
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await createToken(secret);
    const res = NextResponse.json({ ok: true });

    res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,                                         // JS cannot read it
        secure: process.env.NODE_ENV === "production",          // HTTPS only in prod
        sameSite: "lax",
        maxAge: THIRTY_DAYS,
        path: "/",
    });

    return res;
}
