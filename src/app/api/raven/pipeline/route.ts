/**
 * GET /api/raven/pipeline — the pipeline board, as JSON, for Raven.
 *
 * ## Why this exists
 *
 * Raven (raven-api on Railway) cannot read https://leapsandrebounds.ai/pipeline.
 * The page renders fine, but `src/middleware.ts` gates every path outside
 * /login, /admin, /no-access and /api/auth behind a signed session cookie, so a
 * scraper gets the Discord sign-in wall instead of the board. Confirmed
 * 2026-08-25: the fetch succeeds (HTTP 200) and returns "Operations Hub /
 * Internal Intelligence — Sign in with Discord".
 *
 * The bot proxy at /api/bot/[...path] is deliberately NOT the answer. It holds
 * BOT_API_KEY and forwards arbitrary /admin/* paths and verbs; its own header
 * says it must not become an open relay, and widening it to a machine caller
 * would do exactly that. So this route is the opposite shape: one fixed upstream
 * path, GET only, no caller-supplied query, and a hand-written projection of the
 * response rather than a pass-through.
 *
 * ## Where the data comes from
 *
 * The same place the page gets it. src/components/InsightsBoard calls
 * `GET /admin/insights/board` on gravity-claw; this calls that, server-side,
 * with the admin key. No new query and no new shape — the field names below are
 * the upstream's, minus what is withheld.
 *
 * That call used to live in (dashboard)/pipeline/page.tsx. It moved when every
 * space got its own Insights tab and the board became one shared component; the
 * request this route mirrors is unchanged, and `lane=all` still matches what the
 * board asks for when nothing is filtered.
 *
 * ## Auth
 *
 * `Authorization: Bearer <RAVEN_API_TOKEN>`, compared timing-safely. The token is
 * server-side only and must NOT be prefixed NEXT_PUBLIC_ — that would inline it
 * into the client bundle and publish the credential, the mistake the bot proxy's
 * header warns about. If RAVEN_API_TOKEN is unset the route refuses everything:
 * it never falls open, and it never accepts the session cookie as an alternative
 * (a machine caller has no cookie, and honouring one would make this a second,
 * quieter session surface).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The real bot origin, resolved exactly as the bot proxy resolves it. Never
 * NEXT_PUBLIC_BOT_URL — in production that is the relative path "/api/bot", which
 * from a server-side fetch is not a URL at all.
 */
const BOT_ORIGIN =
    process.env.BOT_ORIGIN ??
    process.env.INTERNAL_BOT_URL ??
    "https://gravity-claw-production-fb9e.up.railway.app";

/**
 * Fixed upstream query. The caller supplies nothing — no sort, no lane, no limit —
 * so there is no path from a request parameter to an upstream query, and none
 * onward to a database. `lane=all` rather than the page's default of `business`
 * because "what is the status of each pipeline item" means every lane; the sort
 * is irrelevant to a machine reader but the upstream requires one.
 */
const UPSTREAM = "/admin/insights/board?sort=risk&lane=all&limit=200";

const json = (body: unknown, status: number) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Constant-time bearer check.
 *
 * Both sides are SHA-256'd first for two reasons: timingSafeEqual throws on
 * length mismatch (which would leak the token length through a 500), and digests
 * are always 32 bytes, so the comparison itself cannot vary with the input.
 */
function tokenMatches(presented: string, expected: string): boolean {
    const a = createHash("sha256").update(presented).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

function bearerFrom(req: NextRequest): string | null {
    const header = req.headers.get("authorization");
    if (!header) return null;
    const [scheme, ...rest] = header.split(" ");
    if (scheme.toLowerCase() !== "bearer") return null;
    const value = rest.join(" ").trim();
    return value.length > 0 ? value : null;
}

/* ── The projection ────────────────────────────────────────────────────────────
   Upstream BoardItem carries more than a status reader needs, and some of it is
   free text of unknown provenance. Withheld deliberately:

     body            — the insight's write-up. Free text assembled from support
                       threads and order data, so it can quote a customer.
     metrics         — Record<string, unknown> straight from upstream; whatever it
                       holds today, nothing here can promise what it holds next week.
     filed_by        — identifies a person.
     work.last_progress — an agent's free-text note; milestone + percent + status
                       already answer "how far along is it".
     assignee.name for humans — a teammate's name. Agent names are kept: knowing
                       an item is with the SEO agent is status, not personal data.

   Everything below is a rating, a state, a count or a timestamp. */

interface UpstreamWork {
    status?: string;
    milestone_label?: string | null;
    milestone_index?: number;
    milestone_total?: number;
    percent?: number;
    next_run_at?: string | null;
    runs?: string;
}

interface UpstreamItem {
    id?: string;
    title?: string;
    section?: string;
    lane?: string;
    type?: string;
    status?: string;
    priority?: number;
    occurrences?: number;
    risk_score?: number;
    risk_tier?: string | null;
    value?: { amount?: number; source?: string; basis?: string } | null;
    effort?: { tier?: string | null; rank?: number } | null;
    assignee?: { kind?: string; id?: string; name?: string } | null;
    work?: UpstreamWork | null;
    human_task?: { status?: string } | null;
    created_at?: string;
    updated_at?: string;
    age_days?: number;
}

interface UpstreamBoard {
    count?: number;
    value_summary?: unknown;
    items?: UpstreamItem[];
}

function projectItem(item: UpstreamItem) {
    const assignee = item.assignee ?? null;
    return {
        id: item.id ?? null,
        title: item.title ?? null,
        section: item.section ?? null,
        lane: item.lane ?? null,
        type: item.type ?? null,
        status: item.status ?? null,
        priority: item.priority ?? null,
        occurrences: item.occurrences ?? null,
        risk_score: item.risk_score ?? null,
        risk_tier: item.risk_tier ?? null,
        // Kept whole: a figure is only meaningful with its basis and its
        // measured/claimed label, and the board never adds the two together.
        value: item.value
            ? {
                  amount: item.value.amount ?? null,
                  source: item.value.source ?? null,
                  basis: item.value.basis ?? null,
              }
            : null,
        effort: item.effort
            ? { tier: item.effort.tier ?? null, rank: item.effort.rank ?? null }
            : null,
        assignee: assignee
            ? {
                  kind: assignee.kind ?? null,
                  // Agents are software and named for what they do; humans are not.
                  name: assignee.kind === "agent" ? assignee.name ?? null : null,
              }
            : null,
        work: item.work
            ? {
                  status: item.work.status ?? null,
                  milestone_label: item.work.milestone_label ?? null,
                  milestone_index: item.work.milestone_index ?? null,
                  milestone_total: item.work.milestone_total ?? null,
                  percent: item.work.percent ?? null,
                  next_run_at: item.work.next_run_at ?? null,
                  runs: item.work.runs ?? null,
              }
            : null,
        human_task: item.human_task ? { status: item.human_task.status ?? null } : null,
        created_at: item.created_at ?? null,
        updated_at: item.updated_at ?? null,
        age_days: item.age_days ?? null,
    };
}

export async function GET(req: NextRequest) {
    const expected = process.env.RAVEN_API_TOKEN ?? "";
    if (!expected) {
        // Unconfigured is a refusal, not a bypass. 503 rather than 401 so the
        // caller can tell "Ash has not set the token yet" from "your token is
        // wrong" — neither answer reveals anything about the token itself.
        return json(
            {
                error: "Not configured",
                detail: "RAVEN_API_TOKEN is not set on this deployment.",
            },
            503,
        );
    }

    const presented = bearerFrom(req);
    if (!presented || !tokenMatches(presented, expected)) {
        return json(
            { error: "Unauthorized", detail: "Send Authorization: Bearer <RAVEN_API_TOKEN>." },
            401,
        );
    }

    const key = process.env.BOT_API_KEY ?? "";
    let upstream: Response;
    try {
        upstream = await fetch(new URL(UPSTREAM, BOT_ORIGIN), {
            method: "GET",
            headers: {
                accept: "application/json",
                ...(key ? { "x-admin-key": key } : {}),
                // Lets the bot's audit log tell this apart from dashboard traffic.
                "x-forwarded-by": "mission-control-raven",
            },
            redirect: "manual",
            cache: "no-store",
        });
    } catch (err: unknown) {
        return json(
            {
                error: "Bot unreachable",
                detail: err instanceof Error ? err.message : String(err),
            },
            502,
        );
    }

    if (!upstream.ok) {
        // The upstream body is not relayed: it is written for the dashboard and
        // may say more about the API than a token holder needs to know.
        return json(
            { error: "Board unavailable", detail: `Upstream returned HTTP ${upstream.status}.` },
            502,
        );
    }

    let board: UpstreamBoard;
    try {
        board = (await upstream.json()) as UpstreamBoard;
    } catch {
        return json(
            { error: "Board unavailable", detail: "Upstream did not return JSON." },
            502,
        );
    }

    const items = Array.isArray(board.items) ? board.items : [];
    return json(
        {
            source: "gravity-claw /admin/insights/board",
            lane: "all",
            count: items.length,
            // Aggregate totals only — no per-item attribution, nothing personal.
            value_summary: board.value_summary ?? null,
            items: items.map(projectItem),
        },
        200,
    );
}

/**
 * Read-only by construction. Next returns 405 for any verb this module does not
 * export, so leaving POST/PUT/PATCH/DELETE unexported is the enforcement — adding
 * one would have to be a deliberate edit to this file.
 */

/** timingSafeEqual is a Node built-in; this route must not be edge-compiled. */
export const runtime = "nodejs";

/** Per-request and credential-gated; never cached, never statically rendered. */
export const dynamic = "force-dynamic";
