import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gc_session";
const PUBLIC_PATHS = ["/login", "/api/auth"];

// Verify the HMAC-signed session token using the Web Crypto API
async function verifyToken(token: string, secret: string): Promise<boolean> {
    try {
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"],
        );
        const dotIndex = token.lastIndexOf(".");
        if (dotIndex === -1) return false;
        const payload = token.slice(0, dotIndex);
        const sigB64 = token.slice(dotIndex + 1);
        const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
        return await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            new TextEncoder().encode(payload),
        );
    } catch {
        return false;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Always let public paths through
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;
    const secret = process.env.SESSION_SECRET ?? "";

    if (!token || !(await verifyToken(token, secret))) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Run on all routes except Next.js internals and static files
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
