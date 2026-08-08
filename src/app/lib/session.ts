/**
 * Session tokens — shared by the middleware (edge runtime) and the /api/auth routes.
 *
 * Web Crypto only: no Node built-ins, because middleware runs on the edge.
 *
 * A token is `<payload>.<base64 hmac>`. The role lives *inside* the signed payload,
 * so it cannot be edited by the client — flipping "viewer" to "admin" invalidates
 * the signature. Never derive the role from anything outside the payload.
 *
 *   gc-auth-1712345678         -> viewer
 *   gc-auth-admin-1712345678   -> admin
 *
 * The viewer form is exactly what shipped before roles existed, so sessions issued
 * by the old build keep working and nobody is forced to log in again.
 */

export const COOKIE_NAME = "gc_session";
export const THIRTY_DAYS = 60 * 60 * 24 * 30;

export type Role = "viewer" | "admin";

const ADMIN_PREFIX = "gc-auth-admin-";
const VIEWER_PREFIX = "gc-auth-";

async function hmacKey(secret: string, usage: "sign" | "verify") {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        [usage],
    );
}

/** Mint a signed token for `role`. `stamp` is injectable so tests are deterministic. */
export async function createToken(
    role: Role,
    secret: string,
    stamp: number = Date.now(),
): Promise<string> {
    const payload = role === "admin" ? `${ADMIN_PREFIX}${stamp}` : `${VIEWER_PREFIX}${stamp}`;
    const key = await hmacKey(secret, "sign");
    const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    return `${payload}.${sig}`;
}

/**
 * Verify a token and return the role it carries, or null if it is missing,
 * malformed, or not signed by `secret`.
 */
export async function roleFromToken(
    token: string | undefined,
    secret: string,
): Promise<Role | null> {
    if (!token || !secret) return null;
    try {
        const dotIndex = token.lastIndexOf(".");
        if (dotIndex === -1) return null;

        const payload = token.slice(0, dotIndex);
        const sigB64 = token.slice(dotIndex + 1);
        const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));

        const key = await hmacKey(secret, "verify");
        const ok = await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            new TextEncoder().encode(payload),
        );
        if (!ok) return null;

        // Order matters: the admin prefix also starts with the viewer prefix.
        if (payload.startsWith(ADMIN_PREFIX)) return "admin";
        if (payload.startsWith(VIEWER_PREFIX)) return "viewer";
        return null;
    } catch {
        return null;
    }
}

/** Cookie options shared by every route that sets the session. */
export function sessionCookie(token: string) {
    return {
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,                                  // JS cannot read it
        secure: process.env.NODE_ENV === "production",   // HTTPS only in prod
        sameSite: "lax" as const,
        maxAge: THIRTY_DAYS,
        path: "/",
    };
}
