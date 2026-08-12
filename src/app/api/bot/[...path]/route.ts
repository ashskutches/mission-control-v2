/**
 * Server-side proxy to the gravity-claw API.
 *
 * ## Why this exists
 *
 * `/admin/*` on gravity-claw had no authentication and CORS `*`. Measured
 * 2026-08-11, `GET /admin/logistics/warranty` returned real customer email
 * addresses to an unauthenticated curl. DASHBOARD_PASSWORD gates this dashboard,
 * not the API the dashboard calls — and because `NEXT_PUBLIC_BOT_URL` is
 * client-exposed, every one of the ~410 call sites in this app talks to the bot
 * straight from the browser, which is exactly why the API had to stay open.
 *
 * The admin key therefore cannot live in the browser. It lives here, server-side,
 * in `BOT_API_KEY` — deliberately NOT prefixed `NEXT_PUBLIC_`, or Next would
 * inline it into the client bundle and we would have published the key instead of
 * the data.
 *
 * ## How the 410 call sites move over without being edited
 *
 * They all read `process.env.NEXT_PUBLIC_BOT_URL`. Setting that to the relative
 * path `/api/bot` makes every existing `${BOT_URL}/admin/…` resolve to this route
 * on our own origin. No component changes, no import churn, and any call site
 * added later inherits it. Deploy order matters — see the note at the bottom.
 *
 * ## This must not become an open relay
 *
 * A proxy that forwards anything to anyone is the hole it was built to close, so
 * it refuses without a valid dashboard session, and it only ever forwards to
 * `/admin/*` on the configured bot host. `middleware.ts` already redirects
 * sessionless traffic, but a redirect is not a check: middleware config changes,
 * and a proxy holding a credential should not depend on someone else's matcher.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, roleFromToken } from "@/app/lib/session";

/** The real bot origin. Server-side only — never the relative proxy path. */
const BOT_ORIGIN =
    process.env.BOT_ORIGIN ??
    process.env.INTERNAL_BOT_URL ??
    "https://gravity-claw-production-fb9e.up.railway.app";

const BOT_API_KEY = process.env.BOT_API_KEY ?? "";

/**
 * Hop-by-hop and identity headers that must not be copied through. `host` in
 * particular: forwarding the dashboard's Host to Railway routes the request to
 * the wrong service.
 */
const STRIP_REQUEST = new Set([
    "host", "connection", "content-length", "accept-encoding",
    "cookie", "x-admin-key", "authorization",
]);
const STRIP_RESPONSE = new Set([
    "content-encoding", "content-length", "transfer-encoding", "connection",
]);

async function proxy(req: NextRequest, path: string[]) {
    const role = await roleFromToken(
        req.cookies.get(COOKIE_NAME)?.value,
        process.env.SESSION_SECRET ?? "",
    );
    if (!role) {
        // JSON, not a redirect: the callers are fetch(), and handing them the
        // login page's HTML surfaces as a JSON parse error three layers away
        // from the actual cause.
        return NextResponse.json(
            { error: "Not signed in", detail: "Dashboard session required." },
            { status: 401 },
        );
    }

    // Only /admin/* is reachable. The bot also serves /message (remote exec,
    // keyed on the Telegram token) and the OAuth callbacks; neither should be
    // reachable through a browser-facing proxy.
    if (path[0] !== "admin") {
        return NextResponse.json(
            { error: "Forbidden", detail: "This proxy only forwards /admin/* requests." },
            { status: 403 },
        );
    }

    const target = new URL(`/${path.join("/")}`, BOT_ORIGIN);
    target.search = req.nextUrl.search;

    const headers = new Headers();
    req.headers.forEach((v, k) => { if (!STRIP_REQUEST.has(k.toLowerCase())) headers.set(k, v); });
    if (BOT_API_KEY) headers.set("x-admin-key", BOT_API_KEY);
    // Lets the bot's audit log tell dashboard traffic from a stray script.
    headers.set("x-forwarded-by", "mission-control");

    const init: RequestInit = { method: req.method, headers, redirect: "manual" };
    if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = await req.arrayBuffer();
    }

    let upstream: Response;
    try {
        upstream = await fetch(target, init);
    } catch (err: unknown) {
        // A dead bot must read as a bad gateway, not as a dashboard bug.
        return NextResponse.json(
            { error: "Bot unreachable", detail: err instanceof Error ? err.message : String(err) },
            { status: 502 },
        );
    }

    const out = new Headers();
    upstream.headers.forEach((v, k) => { if (!STRIP_RESPONSE.has(k.toLowerCase())) out.set(k, v); });

    // Streamed through rather than buffered — /admin/drive/img/* serves images
    // and some exports are large.
    return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => proxy(req, (await ctx.params).path ?? []);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

/** Proxied responses are per-session and per-request; never cache them. */
export const dynamic = "force-dynamic";

/**
 * ⚠️ DEPLOY ORDER
 *
 * 1. gravity-claw with ADMIN_AUTH_MODE=audit (blocks nothing, logs what it would)
 * 2. this proxy + BOT_API_KEY here, and the same value as ADMIN_API_KEY there
 * 3. NEXT_PUBLIC_BOT_URL=/api/bot on mission-control-v2 — traffic moves onto the
 *    proxy while the bot is still permissive, so a mistake shows up as a broken
 *    panel rather than a broken dashboard
 * 4. only once the audit log is clean: ADMIN_AUTH_MODE=enforce
 *
 * Flipping 4 before 3 401s the whole dashboard. The storefront is unaffected
 * throughout — it calls the bot directly on allowlisted paths and never touches
 * this proxy.
 */
