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
import { COOKIE_NAME, roleFromToken, sessionFromToken } from "@/app/lib/session";

/**
 * The real bot origin. Server-side only — never the relative proxy path.
 *
 * NEXT_PUBLIC_BOT_URL is read as a fallback so a developer pointing the app at a
 * local bot does not have this proxy quietly forward to production; it is used
 * only while it is an absolute URL, since the whole point of setting it to
 * `/api/bot` is to route through here.
 */
const PUBLIC_BOT_URL = (process.env.NEXT_PUBLIC_BOT_URL ?? "").trim();
const BOT_ORIGIN =
    process.env.BOT_ORIGIN ??
    process.env.INTERNAL_BOT_URL ??
    (/^https?:\/\//.test(PUBLIC_BOT_URL) ? PUBLIC_BOT_URL : undefined) ??
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

/**
 * Upstream paths only an admin session may reach through this proxy. Kept as patterns
 * rather than a prefix so widening it is a deliberate edit.
 */
const ADMIN_ONLY = [/^admin\/team\/[^/]+\/permission$/];

/**
 * Insight writes: closed to guests, open to teammate and above.
 *
 * `methods` is the point of the shape — the GETs beside these must stay open, or
 * the detail page cannot render for the person it was built for.
 *
 * ## Why teammate and not admin
 *
 * The obvious-looking rule is "only the owner directs work", and it is wrong here.
 * `/pipeline` was opened to teammates precisely so a teammate DM'd a question by
 * `ask_human` could open the insight and discharge it, and `InsightActions` — Mark
 * done, Hand back, Set a date, Dismiss — is that feature. Every one of those four
 * lands on a path below. Gating them to admin would 403 the assignee on their own
 * assignment and put the follow-up sweep back to re-sending a reminder nobody can
 * act on, which is the exact failure that feature was built to end.
 *
 * What is actually being closed is the tier that cannot see this page at all. A
 * guest has no /pipeline route, but the proxy is a route of its own, and before
 * this it forwarded a guest's POST to any of these with the admin key attached.
 * Membership of the Discord is not authority to close somebody else's finding.
 *
 * ⚠️ This only bites for traffic that comes through this proxy. While
 * NEXT_PUBLIC_BOT_URL points straight at gravity-claw, a write sent the direct way
 * reaches none of it — see the DEPLOY ORDER note at the bottom, still on step 2.
 */
const NOT_GUESTS: { pattern: RegExp; methods?: string[] }[] = [
    // Hand back — to an agent (via /assign, the only route that creates the work
    // row) or to a person by DM.
    { pattern: /^admin\/insights\/[^/]+\/assign$/, methods: ["POST"] },
    { pattern: /^admin\/pipeline\/[^/]+\/reassign$/, methods: ["POST"] },
    // Mark done and Dismiss. /feedback is the path that writes section_id, which
    // is what get_section_feedback filters on.
    { pattern: /^admin\/insights\/[^/]+\/feedback$/, methods: ["POST"] },
    { pattern: /^admin\/pipeline\/[^/]+\/complete$/, methods: ["POST"] },
    // Set a date, and the rest of the editable columns.
    { pattern: /^admin\/insights\/[^/]+$/, methods: ["PATCH", "DELETE"] },
    // Board-wide, and irreversible for everyone. Admin, not teammate.
    { pattern: /^admin\/insights\/(sweep|purge)$/, methods: ["POST"] },
];

/** The two board-wide ones above are owner-only despite living in that list. */
const ADMIN_ONLY_WRITES = [/^admin\/insights\/(sweep|purge)$/];

/**
 * Killing a finding is the owner's call; finishing one is not.
 *
 * Marking an insight done and dismissing it are the same route with a different
 * word in the body — `POST /admin/insights/:id/feedback`, action `completed` or
 * `dismissed` — so this is the one rule that cannot be expressed as a path and a
 * verb. A teammate discharging the ask they were DM'd is the whole reason the
 * page exists; deciding the finding was never worth doing is a judgement about
 * the business, and it is also the one that teaches the filing agent to stop
 * raising that kind of thing. 175 of the last 200 insights ended dismissed, so
 * this is not a rare branch.
 *
 * `rejected` maps to the same terminal status upstream and is gated with it, or
 * the rule would be one synonym from being bypassed.
 */
const ADMIN_ONLY_ACTIONS = new Set(["dismissed", "rejected"]);

/** Does this body dismiss something? True for either route that can. */
function isDismissal(upstreamPath: string, body: Record<string, unknown>): boolean {
    if (/^admin\/insights\/[^/]+\/feedback$/.test(upstreamPath)) {
        return ADMIN_ONLY_ACTIONS.has(String(body.action ?? ""));
    }
    // The board's older path, and anything else setting the column directly.
    if (/^admin\/insights\/[^/]+$/.test(upstreamPath)) {
        return String(body.status ?? "") === "dismissed";
    }
    return false;
}

/**
 * Paths where the proxy stamps WHO is speaking, overriding whatever the client
 * sent.
 *
 * Posting to an insight's conversation attributes words to a person, and a
 * client-supplied name is a client-supplied name: any signed-in teammate could
 * post as the founder, or as an agent. The session cookie carries the Discord
 * identity inside the signed payload, so it cannot be edited without
 * invalidating the signature — that is the only trustworthy source here.
 *
 * Break-glass password sessions carry no user, and are refused rather than
 * attributed to nobody. An unsigned message on a shared record is worse than a
 * missing one.
 */
/**
 * Which field carries the identity, per path. A thread message is authored; an
 * insight a person filed is *recorded by* them — and `suggested_by`, the person
 * whose idea it actually was, is deliberately NOT stamped, because a manager
 * writing down what somebody said in a standup is two different people and
 * flattening them loses the attribution the feature exists to capture.
 */
const IDENTITY_STAMPED: { pattern: RegExp; fields: { id: string; name: string } }[] = [
    { pattern: /^admin\/insights\/[^/]+\/messages$/, fields: { id: "author_id", name: "author_name" } },
    { pattern: /^admin\/insights$/, fields: { id: "recorded_by_id", name: "recorded_by" } },
    // Closing, dismissing or handing back an insight is a decision with a name on
    // it, and the DM'd teammate acting on their own assignment is exactly the
    // person a client-supplied name would misattribute. `completed_by` on the
    // pipeline route defaulted to "ash" server-side, so every close read as the
    // founder's.
    { pattern: /^admin\/insights\/[^/]+\/feedback$/, fields: { id: "actor_id", name: "actor_name" } },
    { pattern: /^admin\/pipeline\/[^/]+\/reassign$/, fields: { id: "actor_id", name: "actor_name" } },
];

async function proxy(req: NextRequest, path: string[]) {
    const secret = process.env.SESSION_SECRET ?? "";
    const session = await sessionFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);
    const role = session?.role ?? (await roleFromToken(req.cookies.get(COOKIE_NAME)?.value, secret));
    if (!role) {
        // JSON, not a redirect: the callers are fetch(), and handing them the
        // login page's HTML surfaces as a JSON parse error three layers away
        // from the actual cause.
        return NextResponse.json(
            { error: "Not signed in", detail: "Dashboard session required." },
            { status: 401 },
        );
    }

    // Some upstream routes are admin-only regardless of what the bot itself enforces.
    //
    // This proxy admits ANY signed-in session, which is correct for almost everything
    // (a guest legitimately reads /admin/agents). Granting an access tier is the
    // exception: without this check a guest could PATCH themselves to admin using the
    // credential this proxy holds — turning the thing built to close a hole into one.
    const upstreamPath = path.join("/");
    if (role !== "admin" && ADMIN_ONLY.some((r) => r.test(upstreamPath))) {
        return NextResponse.json(
            { error: "Forbidden", detail: "Admin access is required to change permissions." },
            { status: 403 },
        );
    }
    if (role !== "admin" && ADMIN_ONLY_WRITES.some((r) => r.test(upstreamPath))) {
        return NextResponse.json(
            { error: "Forbidden", detail: "Only an admin can clear the board." },
            { status: 403 },
        );
    }
    if (
        role === "guest" &&
        NOT_GUESTS.some((r) => r.pattern.test(upstreamPath) && (!r.methods || r.methods.includes(req.method)))
    ) {
        return NextResponse.json(
            {
                error: "Forbidden",
                detail: "Changing an insight needs dashboard access. Ask Ash to add you to the team directory.",
            },
            { status: 403 },
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
        const stamped = req.method === "POST"
            ? IDENTITY_STAMPED.find((r) => r.pattern.test(upstreamPath))
            : undefined;

        // The dismissal rule reads the body, so on the routes that can carry one
        // the body is parsed up front and reused — reading it twice is not an
        // option, `req.arrayBuffer()` can only be consumed once.
        const mayDismiss = /^admin\/insights\/[^/]+(\/feedback)?$/.test(upstreamPath);

        if (stamped || mayDismiss) {
            let parsed: Record<string, unknown> = {};
            try { parsed = JSON.parse(new TextDecoder().decode(await req.arrayBuffer()) || "{}"); }
            catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

            if (role !== "admin" && isDismissal(upstreamPath, parsed)) {
                return NextResponse.json(
                    {
                        error: "Forbidden",
                        detail: "Only an admin can dismiss an insight. Mark it done if you finished it, or hand it back if it is not yours.",
                    },
                    { status: 403 },
                );
            }

            if (stamped) {
                if (!session?.user) {
                    return NextResponse.json(
                        {
                            error: "No identity on this session",
                            detail: "Signing your name to something on an insight requires a Discord sign-in, not a password session.",
                        },
                        { status: 403 },
                    );
                }
                // Overwrite rather than default — a client that sent an author is
                // either confused or lying, and both are corrected the same way.
                parsed[stamped.fields.id] = session.user.id;
                parsed[stamped.fields.name] = session.user.username;
            }

            init.body = JSON.stringify(parsed);
            headers.set("content-type", "application/json");
        } else {
            init.body = await req.arrayBuffer();
        }
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
