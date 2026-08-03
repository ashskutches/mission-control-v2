"use client";
/**
 * SEO → Dashboard
 *
 * Organic search on one screen, in the order you'd act on it:
 *   1. Headline — clicks, impressions, CTR, average position
 *   2. Striking distance — queries at position 5–20, the cheapest wins on the page
 *   3. Fix what exists — /admin/blog/recommendations, risk-tiered
 *   4. Write what's missing — /admin/blog/opportunities, demand with no article
 *   5. Library coverage — how much of the blog Google actually sends traffic to
 *   6. Feed status — /admin/seo/status, the live GSC + GA4 credential check
 *
 * TWO THINGS ABOUT THE GSC NUMBERS THAT THE UI HAS TO SAY OUT LOUD
 * ---------------------------------------------------------------
 * `runGSCReport` sums the rows it returned, and its row limit is capped at 100. So
 * the totals here are "across the top 100 queries", never the whole property, and
 * asking for fewer rows would silently shrink them. `avg_position` is a plain mean
 * of those rows rather than impression-weighted, so a long tail of position-80
 * queries drags it down more than it drags real traffic down. Both are captioned
 * rather than quietly presented as sitewide truth.
 *
 * The blog panels read the same cached GSC+GA4 snapshot the Blog tab uses (15-minute
 * TTL, in-memory in gravity-claw), so opening both costs one round of Google calls.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MousePointerClick, Eye, Percent, Gauge, Target, Wrench, Lightbulb,
  BookOpen, RefreshCw, ArrowRight, CheckCircle2, XCircle, FileSearch,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import ChatBox from "@/components/ChatBox";
import {
  BOT_URL, CARD, LABEL, TH, TD, MetricCard, Panel, EmptyState, ShareBar,
  money, num, pct,
} from "@/components/MarketingShared";

// ── Types (only the fields this page reads) ───────────────────────────────────

interface GscRow { keyword?: string; page?: string; clicks: number; impressions: number; ctr_pct: number; position: number }
interface GscTotals { clicks: number; impressions: number; ctr_pct: number; avg_position: number }
interface GscResponse { period: { start: string; end: string }; totals: GscTotals; keywords?: GscRow[]; pages?: GscRow[] }

interface RecTarget { shopify_article_id: string; title: string; handle: string; blog_handle: string; path: string }
interface Recommendation {
  code: string; target: RecTarget; action: string; why: string;
  risk: "safe" | "review" | "high_risk"; risk_note: string;
  est_clicks_gain: number | null; priority: number;
}
interface RecResponse {
  total: number; by_risk: Record<string, number>;
  recommendations: Recommendation[]; caveats: string[];
}

interface Opportunity {
  primary_query: string; queries: string[];
  impressions: number; clicks: number; avg_position: number;
  verdict: "create" | "improve_existing" | "already_covered";
  rationale: string;
  brief: { working_title: string; target_keyword: string; blog_handle: string } | null;
  est_clicks_gain: number | null; priority: number;
}
interface OppResponse {
  counts: Record<string, number>; library_size: number;
  opportunities: Opportunity[]; caveats: string[];
}

interface PerfResponse {
  coverage: {
    total_articles: number; with_search_data: number; with_engagement_data: number;
    with_clicks: number; unmatched_search_rows: number;
  };
  totals: { clicks: number; impressions: number; sessions: number; ctr_pct: number | null; measured_revenue: number | null };
}

interface SeoStatus {
  credentials: { configured: boolean; source: string | null; service_account_email: string | null; error?: string };
  gsc: { configured: boolean; site_url: string | null; live_test: string | null; error: string | null };
  ga4: { configured: boolean; property_id: string | null; live_test: string | null; error: string | null };
}

// ── Agent context ─────────────────────────────────────────────────────────────

const SEO_HINT = `
You are the lead agent for the **SEO** surface of Mission Control.
Your domain is organic search for leapsandrebounds.com:

- Search Console performance — clicks, impressions, CTR, position, by query and by page
- The blog library — 700+ mirrored Shopify articles, scored for on-page quality and search performance
- Recommendations — risk-tiered fixes for articles that already exist
- Opportunities — search demand with no article behind it, checked against the whole mirror first

Rules you must hold to:
1. GSC totals on this page are summed over the top 100 queries, not the whole property,
   and average position is an unweighted mean. Never quote them as sitewide figures.
2. CTR "underperformance" is measured against our own median CTR per position band, not
   a published industry curve. Say which baseline you are using.
3. A recommendation tiered high_risk changes URLs. It needs a human decision per item —
   never describe it as safe to batch.
4. An article with a high content score and no clicks is not a bad article. It is a good
   page with no demand or no visibility, and those need opposite responses.

Prioritise by clicks recoverable per unit of risk. Say which specific article or query,
and what the change is — not "improve internal linking".
`.trim();

const RISK_COLOR: Record<string, string> = {
  safe: "#22c55e",
  review: "#e98d20",
  high_risk: "#f43f5e",
};

const WINDOWS = [7, 28, 90] as const;
type Window = (typeof WINDOWS)[number];

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeoDashboardPage() {
  const [days, setDays] = useState<Window>(28);
  const [loading, setLoading] = useState(true);

  const [gsc, setGsc] = useState<GscResponse | null>(null);
  const [pages, setPages] = useState<GscRow[] | null>(null);
  const [recs, setRecs] = useState<RecResponse | null>(null);
  const [opps, setOpps] = useState<OppResponse | null>(null);
  const [perf, setPerf] = useState<PerfResponse | null>(null);
  const [status, setStatus] = useState<SeoStatus | null>(null);

  const [assignedAgent, setAssignedAgent] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [k, p, r, o, pf, s] = await Promise.all([
      getJson<GscResponse>(`${BOT_URL}/admin/gsc/keywords?days=${days}&limit=100`),
      getJson<GscResponse>(`${BOT_URL}/admin/gsc/pages?days=${days}&limit=25`),
      getJson<RecResponse>(`${BOT_URL}/admin/blog/recommendations?days=${days}&limit=8`),
      // Opportunities intentionally use a wider window than the rest of the page —
      // a content gap is a trend, and the route floors this at 90 days anyway.
      getJson<OppResponse>(`${BOT_URL}/admin/blog/opportunities?days=90&verdict=create&limit=8`),
      getJson<PerfResponse>(`${BOT_URL}/admin/blog/performance?days=${days}&limit=1`),
      getJson<SeoStatus>(`${BOT_URL}/admin/seo/status`),
    ]);
    setGsc(k);
    setPages(p?.pages ?? null);
    setRecs(r);
    setOpps(o);
    setPerf(pf);
    setStatus(s);
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  /**
   * Striking distance: ranking on page one's tail or page two, with real impressions.
   * These are the cheapest wins on the page — the query already surfaces us, so the
   * work is a title/intro/internal-link fix rather than a new article.
   */
  const striking = useMemo(() => {
    return (gsc?.keywords ?? [])
      .filter(k => k.position >= 5 && k.position <= 20 && k.impressions >= 50)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);
  }, [gsc]);

  const t = gsc?.totals;
  const cov = perf?.coverage;
  const covPct = cov && cov.total_articles > 0 ? (cov.with_clicks / cov.total_articles) * 100 : null;

  const agentMetrics = [
    { label: "Clicks", value: num(t?.clicks), sub: `${days}d, top 100 queries` },
    { label: "Impressions", value: num(t?.impressions) },
    { label: "CTR", value: pct(t?.ctr_pct, 2) },
    { label: "Avg position", value: t?.avg_position?.toFixed(1) ?? "—" },
    { label: "Striking-distance queries", value: String(striking.length), sub: "position 5–20, 50+ impressions" },
    ...(cov ? [{ label: "Articles earning clicks", value: `${cov.with_clicks} / ${cov.total_articles}` }] : []),
    ...(recs ? [{ label: "Open recommendations", value: String(recs.total) }] : []),
    ...(opps ? [{ label: "Uncovered topics", value: String(opps.counts?.create ?? 0) }] : []),
  ];

  const accentColor = assignedAgent?.color ?? "#34d399";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left column ── */}
      <div>
        <div style={{ marginBottom: "1.25rem" }}>
          <SectionAgentPanel
            sectionId="seo"
            sectionName="SEO"
            sectionHint={SEO_HINT}
            accentColor="#34d399"
            onAgentAssigned={a => setAssignedAgent(a)}
          />
        </div>

        {/* Window picker */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {WINDOWS.map(w => {
            const active = w === days;
            return (
              <button key={w} onClick={() => setDays(w)}
                style={{
                  background: active ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#34d399" : "#64748b",
                  border: active ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                {w}d
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#475569" }}>
              {gsc?.period ? `${gsc.period.start} → ${gsc.period.end}` : ""}
            </span>
            <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh SEO data">
              <RefreshCw size={12} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Headline ── */}
        <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <MetricCard label="Clicks" icon={MousePointerClick} color="#34d399" value={num(t?.clicks)} sub={`${days} days`} />
          <MetricCard label="Impressions" icon={Eye} color="#38bdf8" value={num(t?.impressions)} />
          <MetricCard label="CTR" icon={Percent} color="#e98d20" value={pct(t?.ctr_pct, 2)} sub="Clicks ÷ impressions" />
          <MetricCard label="Avg Position" icon={Gauge} color="#a78bfa" value={t?.avg_position?.toFixed(1) ?? "—"} sub="Unweighted mean" />
          <MetricCard
            label="Striking Distance" icon={Target} color="#f43f5e"
            value={String(striking.length)} sub="Queries at position 5–20"
          />
        </div>
        <p style={{ fontSize: 10, color: "#475569", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          Totals are summed across the top 100 queries Search Console returned, not the whole property.
          Average position is a plain mean of those rows — a long tail of deep-ranking queries pulls it
          down further than it pulls traffic down.
        </p>

        {/* ── Striking distance ── */}
        <Panel
          title="Striking distance — position 5 to 20"
          note="Queries where we already surface but sit below the clicks. The fix is usually a title, an intro, or an internal link — not a new article. Minimum 50 impressions so the position figure means something."
        >
          {loading && !gsc ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : !gsc ? (
            <EmptyState reason="Search Console returned nothing. Check the Feed status panel at the bottom of this page." />
          ) : striking.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>
              No query in the top 100 sits between position 5 and 20 with 50+ impressions in this window.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Query</th>
                    <th style={TH}>Impr.</th>
                    <th style={TH}>Clicks</th>
                    <th style={TH}>CTR</th>
                    <th style={TH}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {striking.map((k, i) => (
                    <motion.tr
                      key={k.keyword}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td style={{ ...TD, textAlign: "left", maxWidth: 320, whiteSpace: "normal" }}>{k.keyword}</td>
                      <td style={TD}>{num(k.impressions)}</td>
                      <td style={TD}>{num(k.clicks)}</td>
                      <td style={TD}>{pct(k.ctr_pct, 1)}</td>
                      <td style={{ ...TD, fontWeight: 800, color: k.position <= 10 ? "#e98d20" : "#f43f5e" }}>
                        {k.position.toFixed(1)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Recommendations ── */}
        <Panel
          title="Fix what exists"
          note={recs?.caveats?.[0] ?? "Ranked fixes for articles already published, tiered by risk. Nothing here is applied automatically."}
          right={
            recs && (
              <div style={{ display: "flex", gap: "0.35rem" }}>
                {(["safe", "review", "high_risk"] as const).map(r => (
                  <span key={r} style={{
                    fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                    background: `${RISK_COLOR[r]}12`, border: `1px solid ${RISK_COLOR[r]}2b`, color: RISK_COLOR[r],
                    borderRadius: 20, padding: "0.1rem 0.5rem",
                  }}>
                    {recs.by_risk?.[r] ?? 0} {r.replace("_", " ")}
                  </span>
                ))}
              </div>
            )
          }
        >
          {loading && !recs ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading — this reads Google, so the first load is slow…</p>
          ) : !recs ? (
            <EmptyState reason="The recommendations endpoint did not respond. It joins the blog mirror to GSC and GA4 — if either is unconfigured, check Feed status below." />
          ) : recs.recommendations.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>No recommendations for this window.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recs.recommendations.map((r, i) => (
                <motion.div
                  key={`${r.code}:${r.target.shopify_article_id}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ padding: "0.7rem 0.85rem", background: "rgba(255,255,255,0.02)", border: `1px solid ${RISK_COLOR[r.risk]}1f`, borderRadius: 9 }}
                >
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      background: `${RISK_COLOR[r.risk]}14`, color: RISK_COLOR[r.risk],
                      borderRadius: 20, padding: "0.1rem 0.5rem",
                    }}>
                      {r.risk.replace("_", " ")}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", flex: 1, minWidth: 180 }}>{r.action}</span>
                    {r.est_clicks_gain != null && (
                      <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>+{num(r.est_clicks_gain)} clicks est.</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, marginBottom: "0.25rem" }}>{r.why}</p>
                  <p style={{ fontSize: 10, color: "#475569" }}>
                    {r.target.title}
                    {r.risk === "high_risk" && <span style={{ color: "#f43f5e" }}> · {r.risk_note}</span>}
                  </p>
                </motion.div>
              ))}
              <Link href="/seo/blog" style={{ fontSize: 10, color: "#e98d20", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: "0.2rem" }}>
                Open the library <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </Panel>

        {/* ── Opportunities ── */}
        <Panel
          title="Write what's missing"
          note="Search demand with no article behind it. Every candidate is checked against the whole mirror first, so nothing here is something we have already written. 90-day window — a content gap is a trend, not a week."
          right={<Lightbulb size={13} color="#e98d20" />}
        >
          {loading && !opps ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : !opps ? (
            <EmptyState reason="The opportunities endpoint did not respond. It needs both the blog mirror and Search Console." />
          ) : opps.opportunities.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>
              No uncovered topics above the impression floor
              {opps.library_size ? ` across ${num(opps.library_size)} mirrored articles` : ""}.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {opps.opportunities.map((o, i) => (
                <motion.div
                  key={o.primary_query}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ padding: "0.7rem 0.85rem", background: "rgba(233,141,32,0.04)", border: "1px solid rgba(233,141,32,0.15)", borderRadius: 9 }}
                >
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", flex: 1, minWidth: 180 }}>
                      {o.brief?.working_title ?? o.primary_query}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{num(o.impressions)} impr.</span>
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>pos {o.avg_position?.toFixed(1)}</span>
                    {o.est_clicks_gain != null && (
                      <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>+{num(o.est_clicks_gain)} clicks est.</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{o.rationale}</p>
                  {o.queries?.length > 1 && (
                    <p style={{ fontSize: 10, color: "#475569", marginTop: "0.25rem" }}>
                      Folds in {o.queries.length - 1} variant{o.queries.length === 2 ? "" : "s"} — one post, not {o.queries.length}.
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Library coverage ── */}
        <Panel
          title="Library coverage"
          note="How much of the blog Google actually sends traffic to. An article with no search data is not necessarily bad — it may be new, or it may be invisible. The two need opposite responses."
          right={
            <Link href="/seo/blog" style={{ fontSize: 10, color: "#e98d20", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Blog <ArrowRight size={11} />
            </Link>
          }
        >
          {!cov ? (
            <EmptyState reason="The blog performance endpoint did not respond. It joins the Shopify mirror to GSC and GA4." />
          ) : (
            <>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
                {[
                  { l: "Articles", v: num(cov.total_articles), c: "#e2e8f0", icon: BookOpen },
                  { l: "With search data", v: num(cov.with_search_data), c: "#38bdf8", icon: FileSearch },
                  { l: "Earning clicks", v: num(cov.with_clicks), c: "#34d399", icon: MousePointerClick },
                  { l: "With GA4 data", v: num(cov.with_engagement_data), c: "#a78bfa", icon: Eye },
                ].map(({ l, v, c, icon: Icon }) => (
                  <div key={l}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <Icon size={11} color={c} />
                      <p style={{ ...LABEL, fontSize: 9 }}>{l}</p>
                    </div>
                    <p style={{ fontSize: "1.3rem", fontWeight: 800, color: c }}>{v}</p>
                  </div>
                ))}
              </div>
              {covPct != null && (
                <>
                  <ShareBar pct={covPct} color="#34d399" />
                  <p style={{ fontSize: 10, color: "#475569", marginTop: "0.4rem" }}>
                    {covPct.toFixed(0)}% of the library earns at least one click in this window.
                    {cov.unmatched_search_rows > 0 && ` ${num(cov.unmatched_search_rows)} search rows matched no article — other page types or stale URLs.`}
                  </p>
                </>
              )}
              {perf?.totals?.measured_revenue != null && (
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: "0.6rem" }}>
                  Measured revenue attributed to blog sessions: <strong style={{ color: "#22c55e" }}>{money(perf.totals.measured_revenue)}</strong>
                </p>
              )}
            </>
          )}
        </Panel>

        {/* ── Top pages ── */}
        <Panel title="Top pages by clicks" note="Across the whole property, not just the blog.">
          {!pages ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : pages.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>No pages returned for this window.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Page</th>
                    <th style={TH}>Clicks</th>
                    <th style={TH}>Impr.</th>
                    <th style={TH}>CTR</th>
                    <th style={TH}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.slice(0, 12).map(p => (
                    <tr key={p.page} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...TD, textAlign: "left", maxWidth: 380, whiteSpace: "normal", wordBreak: "break-all" }}>
                        <a href={p.page} target="_blank" rel="noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 11.5 }}>
                          {(p.page ?? "").replace(/^https?:\/\/[^/]+/, "") || "/"}
                        </a>
                      </td>
                      <td style={TD}>{num(p.clicks)}</td>
                      <td style={TD}>{num(p.impressions)}</td>
                      <td style={TD}>{pct(p.ctr_pct, 1)}</td>
                      <td style={TD}>{p.position?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Feed status ── */}
        <Panel
          title="Feed status"
          note="The live credential check from /admin/seo/status. Every empty panel above traces back to one of these."
        >
          {!status ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                { label: "Service account", ok: status.credentials.configured, detail: status.credentials.service_account_email ?? status.credentials.error ?? "", extra: status.credentials.source },
                { label: "Search Console", ok: status.gsc.live_test === "pass", detail: status.gsc.error ?? status.gsc.site_url ?? "", extra: status.gsc.live_test },
                { label: "GA4", ok: status.ga4.live_test === "pass", detail: status.ga4.error ?? `Property ${status.ga4.property_id}`, extra: status.ga4.live_test },
              ].map(({ label, ok, detail, extra }) => (
                <div key={label} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  {ok
                    ? <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                    : <XCircle size={14} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                      {label}
                      {extra && <span style={{ fontSize: 9.5, color: "#475569", fontWeight: 500 }}> · {extra}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: ok ? "#64748b" : "#b45309", lineHeight: 1.5, wordBreak: "break-word" }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Jump-offs ── */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { href: "/seo/blog", label: "Blog Library", icon: BookOpen, color: "#e98d20", sub: "Audit, drafts, publish" },
            { href: "/marketing", label: "Marketing", icon: Target, color: "#e98d20", sub: "All channels vs spend" },
            { href: "/content", label: "Content", icon: Wrench, color: "#38bdf8", sub: "Assets, copy, images" },
          ].map(({ href, label, icon: Icon, color, sub }) => (
            <Link key={href} href={href} style={{ ...CARD, flex: 1, minWidth: 160, textDecoration: "none", display: "block", border: `1px solid ${color}18` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={color} />
                </div>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>{label}</span>
              </div>
              <p style={{ fontSize: 10, color: "#475569" }}>{sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Right: agent chat ── */}
      <div style={{ position: "sticky", top: "1rem" }}>
        <div style={{ height: 520 }}>
          {assignedAgent ? (
            <ChatBox
              agentId={assignedAgent.id}
              agentName={assignedAgent.name}
              agentEmoji={assignedAgent.emoji}
              agentColor={accentColor}
              mode="fill"
              showHeader
              showChatLink
              conversationKey={`${assignedAgent.id}-seo`}
              context={{ sectionId: "seo", sectionName: "SEO", metrics: agentMetrics }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
                Assign a lead agent above<br />to enable the SEO chat.
              </p>
            </div>
          )}
        </div>

        {assignedAgent && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              "Which striking-distance query is worth the most?",
              "What are the safe fixes I can batch today?",
              "Which topics should we write next, and why?",
              "Which articles are good pages with no demand?",
            ].map(prompt => (
              <button key={prompt}
                style={{ textAlign: "left", background: `${accentColor}06`, border: `1px solid ${accentColor}15`, borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: 11, color: "#64748b", cursor: "pointer" }}>
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
