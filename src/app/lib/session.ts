/**
 * Session tokens — shared by the middleware (edge runtime) and the /api/auth routes.
 *
 * Web Crypto only: no Node built-ins, because middleware runs on the edge.
 *
 * A token is `<payload>.<base64url hmac>`. Everything the server trusts lives *inside*
 * the signed payload, so none of it can be edited by the client — flipping "viewer" to
 * "admin" invalidates the signature. Never derive the role from anything outside it.
 *
 * Two payload formats are accepted:
 *
 *   v2  gc2.<base64url JSON>      { r, id, u, a, t }   — carries the Discord identity
 *   v1  gc-auth-admin-<stamp>     -> admin             — password-era, no identity
 *   v1  gc-auth-<stamp>           -> viewer
 *
 * v1 is still verified so that sessions issued before Discord login keep working; it is
 * never *issued* any more. Both encodings sign the payload the same way, so the only
 * difference is how the payload is read.
 */

export const COOKIE_NAME = "gc_session";
export const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Three tiers. "viewer" is the retired name for "teammate" — it is still accepted
 * when reading a token so sessions issued before the guest tier existed keep working,
 * but it is never written. See sessionFromToken.
 */
export type Role = "guest" | "teammate" | "admin";

/** Who the session belongs to. Absent on v1 tokens and on break-glass logins. */
export interface SessionUser {
    /** Discord snowflake. */
    id: string;
    /** Discord username at the time of sign-in — display only, it can change. */
    username: string;
    /** Discord avatar hash, or null if they use a default avatar. */
    avatar: string | null;
}

export interface Session {
    role: Role;
    user: SessionUser | null;
    /** Issued-at, ms. */
    issued: number;
}

const V2_PREFIX = "gc2.";
const ADMIN_PREFIX = "gc-auth-admin-";
const VIEWER_PREFIX = "gc-auth-";

/* ── base64url ─────────────────────────────────────────────────────────────
   btoa/atob only speak standard base64, but `+` and `/` are awkward in cookie
   values. Encode to base64url, and normalise on the way back in so signatures
   written by the old build (standard base64, padded) still verify. */

function toB64Url(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Uint8Array is generic over its buffer since TS 5.7, and crypto.subtle wants the
// ArrayBuffer form specifically — the bare `Uint8Array` alias does not satisfy it.
function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: "sign" | "verify") {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        [usage],
    );
}

async function sign(payload: string, secret: string): Promise<string> {
    const key = await hmacKey(secret, "sign");
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return `${payload}.${toB64Url(new Uint8Array(sig))}`;
}

/**
 * Mint a signed token. `stamp` is injectable so tests are deterministic.
 *
 * Always emits v2, including for password logins — those simply carry a null user.
 */
export async function createToken(
    role: Role,
    secret: string,
    user: SessionUser | null = null,
    stamp: number = Date.now(),
): Promise<string> {
    const claims = {
        r: role,
        t: stamp,
        ...(user ? { id: user.id, u: user.username, a: user.avatar } : {}),
    };
    // TextEncoder first: usernames are arbitrary Unicode and btoa throws on it.
    const json = toB64Url(new TextEncoder().encode(JSON.stringify(claims)));
    return sign(`${V2_PREFIX}${json}`, secret);
}

/**
 * Verify a token and return the session it carries, or null if it is missing,
 * malformed, or not signed by `secret`.
 */
export async function sessionFromToken(
    token: string | undefined,
    secret: string,
): Promise<Session | null> {
    if (!token || !secret) return null;
    try {
        const dotIndex = token.lastIndexOf(".");
        if (dotIndex === -1) return null;

        const payload = token.slice(0, dotIndex);
        const sigBytes = fromB64Url(token.slice(dotIndex + 1));

        const key = await hmacKey(secret, "verify");
        const ok = await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            new TextEncoder().encode(payload),
        );
        if (!ok) return null;

        if (payload.startsWith(V2_PREFIX)) {
            const raw = new TextDecoder().decode(fromB64Url(payload.slice(V2_PREFIX.length)));
            const c = JSON.parse(raw) as {
                r?: unknown; t?: unknown; id?: unknown; u?: unknown; a?: unknown;
            };
            // The signature proves we wrote it, but a shape change between deploys
            // should fail closed rather than produce a half-built session.
            // "viewer" predates the guest tier and meant "everything but admin",
            // which is exactly what teammate means now — so it maps forward rather
            // than being rejected, and nobody is signed out by this deploy.
            const raw_r = c.r === "viewer" ? "teammate" : c.r;
            if (raw_r !== "guest" && raw_r !== "teammate" && raw_r !== "admin") return null;
            const user: SessionUser | null =
                typeof c.id === "string" && typeof c.u === "string"
                    ? { id: c.id, username: c.u, avatar: typeof c.a === "string" ? c.a : null }
                    : null;
            return { role: raw_r, user, issued: typeof c.t === "number" ? c.t : 0 };
        }

        // Order matters: the admin prefix also starts with the viewer prefix.
        const legacyStamp = (p: string) => Number(p.slice(p.lastIndexOf("-") + 1)) || 0;
        if (payload.startsWith(ADMIN_PREFIX)) {
            return { role: "admin", user: null, issued: legacyStamp(payload) };
        }
        if (payload.startsWith(VIEWER_PREFIX)) {
            // Password-era viewer == teammate. See the note above.
            return { role: "teammate", user: null, issued: legacyStamp(payload) };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Just the role. The middleware and anything that only gates on tier use this;
 * it is `sessionFromToken` with the identity dropped.
 */
export async function roleFromToken(
    token: string | undefined,
    secret: string,
): Promise<Role | null> {
    return (await sessionFromToken(token, secret))?.role ?? null;
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
