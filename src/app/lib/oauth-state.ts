/**
 * CSRF protection for the Discord round trip.
 *
 * The `state` parameter is signed with SESSION_SECRET *and* bound to a nonce held in a
 * short-lived cookie. Signing alone is not enough: an attacker can start their own real
 * login, take the validly-signed state Discord hands back, and feed the callback to a
 * victim to log them into the attacker's account. Requiring the nonce cookie to match
 * means the callback only completes in the browser that began the flow.
 */

const NONCE_COOKIE = "gc_oauth";
const TEN_MINUTES = 60 * 10;

export { NONCE_COOKIE };

function toB64Url(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// See session.ts — crypto.subtle needs Uint8Array<ArrayBuffer>, not the bare alias.
function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

function key(secret: string, usage: "sign" | "verify") {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        [usage],
    );
}

/**
 * Only ever redirect to a path on this site. A bare `startsWith("/")` still lets
 * `//evil.com` and `/\evil.com` through — browsers read both as protocol-relative
 * absolute URLs, which is an open redirect.
 */
export function safeFrom(from: string | null | undefined): string {
    if (!from || !from.startsWith("/")) return "/";
    if (from.startsWith("//") || from.startsWith("/\\")) return "/";
    return from;
}

export interface StatePayload {
    nonce: string;
    from: string;
}

export async function createState(from: string, secret: string): Promise<{ state: string; nonce: string }> {
    const nonce = crypto.randomUUID();
    const body = toB64Url(new TextEncoder().encode(JSON.stringify({ n: nonce, f: safeFrom(from) })));
    const sig = await crypto.subtle.sign("HMAC", await key(secret, "sign"), new TextEncoder().encode(body));
    return { state: `${body}.${toB64Url(new Uint8Array(sig))}`, nonce };
}

/** Verify signature and nonce binding. Returns the payload, or null if either fails. */
export async function verifyState(
    state: string | null,
    cookieNonce: string | undefined,
    secret: string,
): Promise<StatePayload | null> {
    if (!state || !cookieNonce || !secret) return null;
    try {
        const dot = state.lastIndexOf(".");
        if (dot === -1) return null;
        const body = state.slice(0, dot);

        const ok = await crypto.subtle.verify(
            "HMAC",
            await key(secret, "verify"),
            fromB64Url(state.slice(dot + 1)),
            new TextEncoder().encode(body),
        );
        if (!ok) return null;

        const { n, f } = JSON.parse(new TextDecoder().decode(fromB64Url(body))) as {
            n?: string; f?: string;
        };
        if (!n || n !== cookieNonce) return null;
        return { nonce: n, from: safeFrom(f) };
    } catch {
        return null;
    }
}

export function nonceCookie(nonce: string) {
    return {
        name: NONCE_COOKIE,
        value: nonce,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // The callback is a top-level cross-site GET back from discord.com, so a
        // strict cookie would not be sent and every login would fail.
        sameSite: "lax" as const,
        maxAge: TEN_MINUTES,
        path: "/",
    };
}

/** Clear the nonce once the round trip is over, win or lose. */
export function clearNonceCookie() {
    return { name: NONCE_COOKIE, value: "", httpOnly: true, maxAge: 0, path: "/" };
}
