"use client";

/**
 * Blog SEO — the three views over /admin/blog/{performance,recommendations,opportunities}.
 *
 *   Performance   every article joined to what search and analytics say it earns
 *   Improve       ranked, risk-tiered fixes for articles we already have
 *   New posts     search demand with no article behind it
 *
 * Two things about this screen are load-bearing, and both are about not lying:
 *
 * 1. Coverage is stated before any total. "How many of our articles does Google send
 *    traffic to" is the first number on the page, next to the size of the library,
 *    because a research report once read a top-25 slice of GSC as the whole blog and
 *    reported 28 indexed articles against a library of 785 — then built a CTR baseline,
 *    a revenue projection and a six-week roadmap on top of it. A page that shows totals
 *    without showing what fraction of the library they cover invites the same mistake.
 *
 * 2. Risk is shown before the action, not after it. Recommendations are grouped by what
 *    happens if you are wrong, high-risk items are collapsed by default and can only be
 *    read one at a time, and nothing on this screen applies anything — every button is
 *    a deep link into Shopify's own editor where a human makes the change.
 *
 * Missing data is drawn as "—" and never as zero. The distinction between "this article
 * earned nothing" and "we have no data for this article" decides whether someone
 * rewrites a page, so it survives all the way to the pixels.
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, AlertTriangle, ExternalLink, ChevronDown, ChevronRight,
  Search, ShieldAlert, ShieldCheck, Shield, Lightbulb,
  RefreshCw, Info, FileWarning, PenLine,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Shared presentation ───────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.12em", margin: 0,
};

const RISK = {
  safe:      { color: "#34d399", label: "Safe",      icon: ShieldCheck,
               blurb: "Additive. Nothing that currently ranks is altered." },
  review:    { color: "#f59e0b", label: "Review",    icon: Shield,
               blurb: "Changes something already live. Reversible, but read it first." },
  high_risk: { color: "#f43f5e", label: "High risk", icon: ShieldAlert,
               blurb: "Changes or removes a URL. This is the only kind that can permanently lose rankings." },
} as const;

type RiskTier = keyof typeof RISK;

const VERDICT = {
  create:           { color: "#34d399", label: "Write it" },
  improve_existing: { color: "#f59e0b", label: "Improve what we have" },
  already_covered:  { color: "#475569", label: "Already covered" },
} as const;

type Verdict = keyof typeof VERDICT;

const GRADE_COLOR: Record<string, string> = {
  A: "#34d399", B: "#a3e635", C: "#f59e0b", D: "#fb923c", F: "#f43f5e",
};

/** Missing data is a dash. Never a zero — see the file header. */
function num(v: number | null | undefined, suffix = ""): string {
  return v === null || v === undefined ? "—" : v.toLocaleString() + suffix;
}

function money(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function liveUrl(path: string): string {
  return `https://leapsandrebounds.com${path}`;
}

function Tile({ label, value, sub, color = "#94a3b8" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ ...PANEL, padding: "14px 16px" }}>
      <p style={LABEL}>{label}</p>
      <p style={{ fontSize: 21, fontWeight: 800, color, margin: "6px 0 0", letterSpacing: "-0.02em" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0", lineHeight: 1.45 }}>{sub}</p>}
    </div>
  );
}

/** Non-fatal problems from the API, shown rather than swallowed. */
function Warnings({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div style={{
      background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)",
      borderRadius: 12, padding: "12px 15px", display: "flex", gap: 11, alignItems: "flex-start",
    }}>
      <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((w, i) => (
          <p key={i} style={{ fontSize: 12, color: "#fcd34d", margin: 0, lineHeight: 1.55 }}>{w}</p>
        ))}
      </div>
    </div>
  );
}

function Caveats({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div style={{ ...PANEL, padding: "11px 14px" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
        padding: 0, cursor: "pointer", fontFamily: "inherit", width: "100%",
      }}>
        <Info size={13} color="#475569" />
        <span style={{ ...LABEL, color: "#475569" }}>What this does not know</span>
        <div style={{ flex: 1 }} />
        {open ? <ChevronDown size={13} color="#475569" /> : <ChevronRight size={13} color="#475569" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {items.map((c, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.6, marginBottom: 5 }}>{c}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Freshness({ fetchedAt, ageSeconds, onRefresh, busy }: {
  fetchedAt?: string; ageSeconds?: number; onRefresh: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, color: "#475569" }}>
        {fetchedAt
          ? `Google data cached ${ageSeconds && ageSeconds > 60 ? `${Math.round(ageSeconds / 60)}m` : `${ageSeconds ?? 0}s`} ago`
          : ""}
      </span>
      <button onClick={onRefresh} disabled={busy} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        color: busy ? "#475569" : "#94a3b8", fontSize: 11, fontWeight: 700,
        cursor: busy ? "default" : "pointer", fontFamily: "inherit",
      }}>
        {busy ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
        Refresh
      </button>
    </div>
  );
}

/** Shared fetch-with-state, since all three views do exactly this. */
function useEndpoint<T>(path: string, timeoutMs = 120_000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true); setErr(null);
    try {
      const url = `${BOT_URL}${path}${path.includes("?") ? "&" : "?"}${fresh ? "fresh=1" : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.json();
      if (!res.ok) { setErr(body.error || "Request failed"); return; }
      setData(body);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path, timeoutMs]);

  useEffect(() => { void load(false); }, [load]);
  return { data, loading, err, reload: load };
}

function Loading() {
  return (
    <div style={{ ...PANEL, padding: 48, display: "flex", justifyContent: "center" }}>
      <Loader2 size={22} color="#475569" className="spin" />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div style={{
      background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)",
      borderRadius: 12, padding: "13px 16px", display: "flex", gap: 11, alignItems: "flex-start",
    }}>
      <AlertTriangle size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 12, color: "#fda4af", margin: 0, lineHeight: 1.55 }}>{message}</p>
    </div>
  );
}

// ── Performance ───────────────────────────────────────────────────────────────

interface ArticlePerf {
  shopify_article_id: string;
  title: string; handle: string; blog_handle: string; path: string;
  clicks: number | null; impressions: number | null; ctr_pct: number | null; position: number | null;
  sessions: number | null; bounce_rate_pct: number | null;
  value: number | null; value_basis: "measured" | "modelled" | "unavailable"; value_note: string;
  content_score: number; search_score: number | null;
  grade: string | null;
  has_search_data: boolean;
  word_count: number; internal_link_count: number;
}

interface PerfResponse {
  period_days: number;
  coverage: {
    total_articles: number; with_search_data: number; with_engagement_data: number;
    with_clicks: number; unmatched_search_rows: number;
  };
  totals: { clicks: number; impressions: number; sessions: number; ctr_pct: number | null; measured_revenue: number | null };
  articles: ArticlePerf[];
  fetched_at: string; cache_age_seconds: number; warnings: string[];
}

const SORTS = [
  { key: "clicks", label: "Clicks" },
  { key: "impressions", label: "Impressions" },
  { key: "sessions", label: "Sessions" },
  { key: "value", label: "Value" },
  { key: "position", label: "Position" },
  { key: "content_score", label: "Content score" },
] as const;

export function BlogPerformanceView() {
  const [sort, setSort] = useState<string>("clicks");
  const { data, loading, err, reload } = useEndpoint<PerfResponse>(`/admin/blog/performance?sort=${sort}&limit=200`);

  if (loading && !data) return <Loading />;
  if (err) return <ErrorPanel message={err} />;
  if (!data) return null;

  const c = data.coverage;
  const coveragePct = c.total_articles > 0 ? Math.round((c.with_search_data / c.total_articles) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Warnings items={data.warnings} />

      {/* Coverage before totals, always — see the file header. */}
      <div style={{
        ...PANEL, padding: "16px 18px",
        borderColor: coveragePct < 25 ? "rgba(245,158,11,0.28)" : "rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Search size={15} color="#e98d20" />
          <p style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>
            {c.with_search_data.toLocaleString()} of {c.total_articles.toLocaleString()} articles
            get search impressions
          </p>
          <span style={{
            fontSize: 11, fontWeight: 800, color: coveragePct < 25 ? "#f59e0b" : "#34d399",
            background: coveragePct < 25 ? "rgba(245,158,11,0.12)" : "rgba(52,211,153,0.12)",
            padding: "3px 9px", borderRadius: 6,
          }}>
            {coveragePct}%
          </span>
          <div style={{ flex: 1 }} />
          <Freshness fetchedAt={data.fetched_at} ageSeconds={data.cache_age_seconds}
            onRefresh={() => void reload(true)} busy={loading} />
        </div>
        <p style={{ fontSize: 11.5, color: "#64748b", margin: "8px 0 0", lineHeight: 1.6 }}>
          Counted from every page Search Console reports over the last {data.period_days} days, paged to
          exhaustion rather than sampled. {c.with_clicks.toLocaleString()} of them earned at least one click.
          {c.unmatched_search_rows > 0 &&
            ` ${c.unmatched_search_rows.toLocaleString()} search rows matched no mirrored article — those are other page types, or articles the mirror has not synced.`}
        </p>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Tile label="Clicks" value={data.totals.clicks.toLocaleString()} color="#e98d20"
          sub={`${data.period_days}d, blog only`} />
        <Tile label="Impressions" value={data.totals.impressions.toLocaleString()} color="#38bdf8" />
        <Tile label="Blog CTR" value={data.totals.ctr_pct === null ? "—" : `${data.totals.ctr_pct}%`}
          color="#818cf8" sub="clicks ÷ impressions" />
        <Tile label="Sessions" value={data.totals.sessions.toLocaleString()} color="#a78bfa" sub="GA4" />
        <Tile label="Attributed revenue"
          value={data.totals.measured_revenue === null ? "Unknown" : money(data.totals.measured_revenue)}
          color={data.totals.measured_revenue === null ? "#64748b" : "#34d399"}
          sub={data.totals.measured_revenue === null ? "GA4 attributes none — not the same as $0" : "GA4 purchase revenue"} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...LABEL, marginRight: 4 }}>Sort</span>
        {SORTS.map(s => (
          <button key={s.key} onClick={() => setSort(s.key)} style={{
            padding: "5px 11px", borderRadius: 7,
            background: sort === s.key ? "rgba(233,141,32,0.14)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${sort === s.key ? "rgba(233,141,32,0.3)" : "rgba(255,255,255,0.07)"}`,
            color: sort === s.key ? "#e98d20" : "#64748b", fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>{s.label}</button>
        ))}
      </div>

      <div style={{ ...PANEL, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Article", "Clicks", "Impr.", "CTR", "Pos.", "Sessions", "Value", "Content", "Grade"].map((h, i) => (
                  <th key={h} style={{
                    ...LABEL, padding: "11px 13px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.articles.map(a => (
                <tr key={a.shopify_article_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.035)" }}>
                  <td style={{ padding: "10px 13px", maxWidth: 340 }}>
                    <a href={liveUrl(a.path)} target="_blank" rel="noreferrer" style={{
                      color: "#cbd5e1", textDecoration: "none", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300,
                      }}>{a.title}</span>
                      <ExternalLink size={11} color="#334155" style={{ flexShrink: 0 }} />
                    </a>
                    <span style={{ fontSize: 10.5, color: "#475569" }}>
                      {a.blog_handle} · {a.word_count.toLocaleString()}w · {a.internal_link_count} links
                    </span>
                  </td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#e2e8f0", fontWeight: 700 }}>
                    {num(a.clicks)}
                  </td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#94a3b8" }}>{num(a.impressions)}</td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#94a3b8" }}>
                    {a.ctr_pct === null ? "—" : `${a.ctr_pct}%`}
                  </td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#94a3b8" }}>{num(a.position)}</td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#94a3b8" }}>{num(a.sessions)}</td>
                  <td style={{ padding: "10px 13px", textAlign: "right" }} title={a.value_note}>
                    <span style={{ color: a.value === null ? "#475569" : "#34d399", fontWeight: 700 }}>
                      {money(a.value)}
                    </span>
                    {a.value_basis === "modelled" && (
                      <span style={{ fontSize: 9.5, color: "#64748b", display: "block" }}>modelled</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 13px", textAlign: "right", color: "#94a3b8" }}>{a.content_score}</td>
                  <td style={{ padding: "10px 13px", textAlign: "right" }}>
                    <span style={{
                      fontWeight: 800,
                      color: a.grade ? GRADE_COLOR[a.grade] : "#334155",
                    }} title={a.grade ? undefined : "No search data — not graded"}>
                      {a.grade ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
        Showing {data.articles.length.toLocaleString()} of {c.total_articles.toLocaleString()}.
        A dash means no data, not zero.
      </p>
    </div>
  );
}

// ── Improve ───────────────────────────────────────────────────────────────────

interface Recommendation {
  code: string;
  target: { shopify_article_id: string; title: string; handle: string; blog_handle: string; path: string };
  also_affects: Array<{ title: string; path: string }>;
  action: string; why: string;
  risk: RiskTier; risk_note: string;
  evidence: Record<string, string | number | null>;
  est_clicks_gain: number | null;
  priority: number;
}

interface RecResponse {
  period_days: number; total: number;
  by_risk: Record<RiskTier, number>;
  ctr_baseline: Array<{ band: string; median_ctr_pct: number | null; sample: number }>;
  caveats: string[];
  recommendations: Recommendation[];
  fetched_at: string; cache_age_seconds: number; warnings: string[];
}

function RecCard({ r }: { r: Recommendation }) {
  const [open, setOpen] = useState(false);
  const meta = RISK[r.risk];
  const Icon = meta.icon;

  return (
    <div style={{ ...PANEL, borderColor: `${meta.color}22`, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 15px", width: "100%",
        background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        <Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0, lineHeight: 1.5 }}>
            {r.action}
          </p>
          <p style={{
            fontSize: 11.5, color: "#64748b", margin: "4px 0 0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {r.target.title}
            {r.also_affects.length > 0 && ` + ${r.also_affects.length} more`}
          </p>
        </div>
        {r.est_clicks_gain !== null && (
          <span style={{
            fontSize: 11, fontWeight: 800, color: "#34d399", background: "rgba(52,211,153,0.1)",
            padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap",
          }}>
            +{r.est_clicks_gain.toLocaleString()} clicks
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 800, color: meta.color, background: `${meta.color}18`,
          padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}>{meta.label}</span>
        {open ? <ChevronDown size={14} color="#475569" /> : <ChevronRight size={14} color="#475569" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 15px 14px 41px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.65 }}>{r.why}</p>

              <div style={{
                background: `${meta.color}0d`, border: `1px solid ${meta.color}22`,
                borderRadius: 9, padding: "9px 12px",
              }}>
                <p style={{ fontSize: 11.5, color: meta.color, margin: 0, lineHeight: 1.6, fontWeight: 600 }}>
                  {r.risk_note}
                </p>
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {Object.entries(r.evidence).map(([k, v]) => (
                  <div key={k}>
                    <p style={{ ...LABEL, fontSize: 9 }}>{k.replace(/_/g, " ")}</p>
                    <p style={{ fontSize: 12, color: "#cbd5e1", margin: "2px 0 0", fontWeight: 700 }}>
                      {v === null ? "—" : String(v)}
                    </p>
                  </div>
                ))}
              </div>

              {r.also_affects.length > 0 && (
                <div>
                  <p style={{ ...LABEL, marginBottom: 5 }}>Also affects</p>
                  {r.also_affects.map(a => (
                    <a key={a.path} href={liveUrl(a.path)} target="_blank" rel="noreferrer" style={{
                      display: "block", fontSize: 11.5, color: "#64748b", textDecoration: "none",
                      padding: "2px 0",
                    }}>{a.title}</a>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <a href={liveUrl(r.target.path)} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8", fontSize: 11, fontWeight: 700, textDecoration: "none",
                }}>
                  <ExternalLink size={11} /> View live
                </a>
                <a href={`https://admin.shopify.com/store/leaps-rebounds/articles/${r.target.shopify_article_id.split("/").pop()}`}
                  target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                    background: "rgba(233,141,32,0.1)", border: "1px solid rgba(233,141,32,0.25)",
                    color: "#e98d20", fontSize: 11, fontWeight: 700, textDecoration: "none",
                  }}>
                  <PenLine size={11} /> Edit in Shopify
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BlogImproveView() {
  const [risk, setRisk] = useState<RiskTier | "all">("all");
  const { data, loading, err, reload } = useEndpoint<RecResponse>("/admin/blog/recommendations?limit=200");

  if (loading && !data) return <Loading />;
  if (err) return <ErrorPanel message={err} />;
  if (!data) return null;

  const shown = risk === "all" ? data.recommendations : data.recommendations.filter(r => r.risk === risk);
  // High-risk items are never mixed into a scrollable list of easy wins: seeing them
  // in the same rhythm as "add a meta description" is what makes bulk approval feel
  // reasonable. They are opened deliberately.
  const highRisk = shown.filter(r => r.risk === "high_risk");
  const rest = shown.filter(r => r.risk !== "high_risk");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Warnings items={data.warnings} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {(["all", "safe", "review", "high_risk"] as const).map(k => {
          const active = risk === k;
          const meta = k === "all" ? null : RISK[k];
          const count = k === "all" ? data.total : data.by_risk[k];
          return (
            <button key={k} onClick={() => setRisk(k)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9,
              background: active ? `${meta?.color ?? "#e98d20"}1f` : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? `${meta?.color ?? "#e98d20"}55` : "rgba(255,255,255,0.07)"}`,
              color: active ? (meta?.color ?? "#e98d20") : "#64748b",
              fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {meta ? meta.label : "All"}
              <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <Freshness fetchedAt={data.fetched_at} ageSeconds={data.cache_age_seconds}
          onRefresh={() => void reload(true)} busy={loading} />
      </div>

      <div style={{ ...PANEL, padding: "12px 15px", display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Info size={14} color="#475569" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: "#64748b", margin: 0, lineHeight: 1.65 }}>
          Nothing here is applied automatically — every action is a deep link into Shopify&apos;s editor.
          CTR shortfalls are measured against{" "}
          <strong style={{ color: "#94a3b8" }}>our own median CTR at the same position band</strong>
          {data.ctr_baseline.some(b => b.median_ctr_pct !== null)
            ? ` (${data.ctr_baseline.filter(b => b.median_ctr_pct !== null)
                .map(b => `${b.band}: ${b.median_ctr_pct}%`).join(", ")})`
            : " — not yet computable, too few pages with enough impressions"}
          , not an industry curve.
        </p>
      </div>

      {rest.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rest.map((r, i) => <RecCard key={`${r.code}-${r.target.shopify_article_id}-${i}`} r={r} />)}
        </div>
      )}

      {highRisk.length > 0 && <HighRiskSection items={highRisk} />}

      {shown.length === 0 && (
        <div style={{ ...PANEL, padding: "36px", textAlign: "center" }}>
          <ShieldCheck size={22} color="#34d399" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Nothing flagged at this risk level.</p>
        </div>
      )}

      <Caveats items={data.caveats} />
    </div>
  );
}

/** Collapsed by default, with the warning above the list rather than inside each item. */
function HighRiskSection({ items }: { items: Recommendation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "rgba(244,63,94,0.04)", border: "1px solid rgba(244,63,94,0.2)",
      borderRadius: 14, padding: "14px 16px",
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
      }}>
        <ShieldAlert size={16} color="#f43f5e" />
        <p style={{ fontSize: 13, fontWeight: 800, color: "#f43f5e", margin: 0 }}>
          {items.length} proposal{items.length === 1 ? "" : "s"} that would change or remove URLs
        </p>
        <div style={{ flex: 1 }} />
        {open ? <ChevronDown size={14} color="#f43f5e" /> : <ChevronRight size={14} color="#f43f5e" />}
      </button>
      <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "9px 0 0", lineHeight: 1.65 }}>
        Consolidating or redirecting is the only thing on this screen that can permanently lose ranking
        authority. A 301 usually carries most of it across, and &quot;usually&quot; is doing real work in
        that sentence. Do these one at a time, verify each group really is one topic rather than a
        clustering artefact, and never approve them as a batch.
      </p>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {items.map((r, i) => <RecCard key={`${r.code}-${i}`} r={r} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── New posts ─────────────────────────────────────────────────────────────────

interface Opportunity {
  primary_query: string; queries: string[];
  impressions: number; clicks: number; avg_position: number;
  verdict: Verdict;
  covered_by: { title: string; handle: string; blog_handle: string; similarity: number; shared_terms: string[] } | null;
  rationale: string;
  brief: { working_title: string; target_keyword: string; blog_handle: string; supporting_queries: string[] } | null;
  est_clicks_gain: number | null;
  priority: number;
}

interface OppResponse {
  period_days: number;
  counts: Record<Verdict, number>;
  filtered_queries: { below_impression_floor: number; already_winning: number; branded: number };
  caveats: string[];
  library_size: number;
  drafts_considered: number;
  opportunities: Opportunity[];
  fetched_at: string; cache_age_seconds: number; warnings: string[];
}

function OpportunityCard({ o, onDraft, drafting }: {
  o: Opportunity; onDraft: (o: Opportunity) => void; drafting: string | null;
}) {
  const [open, setOpen] = useState(false);
  const meta = VERDICT[o.verdict];

  return (
    <div style={{ ...PANEL, borderColor: `${meta.color}22`, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", width: "100%",
        background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{o.primary_query}</p>
          <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>
            {o.impressions.toLocaleString()} impressions · position {o.avg_position}
            {o.queries.length > 1 && ` · ${o.queries.length} query variants`}
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, color: meta.color, background: `${meta.color}18`,
          padding: "3px 9px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}>{meta.label}</span>
        {open ? <ChevronDown size={14} color="#475569" /> : <ChevronRight size={14} color="#475569" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 15px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.65 }}>{o.rationale}</p>

              {o.covered_by && (
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 9, padding: "9px 12px",
                }}>
                  <p style={{ ...LABEL, marginBottom: 4 }}>Closest existing article</p>
                  <a href={`https://leapsandrebounds.com/blogs/${o.covered_by.blog_handle}/${o.covered_by.handle}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "#cbd5e1", textDecoration: "none", fontWeight: 600 }}>
                    {o.covered_by.title} <ExternalLink size={10} />
                  </a>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>
                    {Math.round(o.covered_by.similarity * 100)}% term overlap
                    {o.covered_by.shared_terms.length > 0 && ` on ${o.covered_by.shared_terms.join(", ")}`}
                  </p>
                </div>
              )}

              {o.queries.length > 1 && (
                <div>
                  <p style={{ ...LABEL, marginBottom: 5 }}>Query variants folded in</p>
                  <p style={{ fontSize: 11.5, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                    {o.queries.join(" · ")}
                  </p>
                </div>
              )}

              {o.brief && (
                <button onClick={() => onDraft(o)} disabled={drafting === o.primary_query} style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
                  background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.28)",
                  color: "#34d399", fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                  fontFamily: "inherit", alignSelf: "flex-start",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {drafting === o.primary_query
                    ? <><Loader2 size={12} className="spin" /> Creating…</>
                    : <><PenLine size={12} /> Create a draft brief</>}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BlogOpportunitiesView() {
  const [verdict, setVerdict] = useState<Verdict | "all">("create");
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const { data, loading, err, reload } = useEndpoint<OppResponse>("/admin/blog/opportunities?limit=100");

  const createDraft = async (o: Opportunity) => {
    if (!o.brief) return;
    setDrafting(o.primary_query); setDraftMsg(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: o.brief.working_title,
          target_keyword: o.brief.target_keyword,
          blog_handle: o.brief.blog_handle,
          angle: `Covers ${o.queries.length} related searches (${o.impressions.toLocaleString()} impressions/window). Nothing in the library covers this.`,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.json();
      setDraftMsg(res.ok
        ? `Brief created for "${o.brief.working_title}". It is a draft — nothing is published.`
        : `Could not create the brief: ${body.error ?? "unknown error"}`);
    } catch (e) {
      setDraftMsg(`Could not create the brief: ${errMessage(e)}`);
    } finally {
      setDrafting(null);
    }
  };

  if (loading && !data) return <Loading />;
  if (err) return <ErrorPanel message={err} />;
  if (!data) return null;

  const shown = verdict === "all" ? data.opportunities : data.opportunities.filter(o => o.verdict === verdict);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Warnings items={data.warnings} />

      <div style={{ ...PANEL, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Lightbulb size={15} color="#e98d20" />
          <p style={{ fontSize: 13.5, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>
            Every candidate checked against all {data.library_size.toLocaleString()} existing articles
          </p>
          <div style={{ flex: 1 }} />
          <Freshness fetchedAt={data.fetched_at} ageSeconds={data.cache_age_seconds}
            onRefresh={() => void reload(true)} busy={loading} />
        </div>
        <p style={{ fontSize: 11.5, color: "#64748b", margin: "8px 0 0", lineHeight: 1.65 }}>
          Ranked by search volume without that check, this list would recommend re-writing our best
          existing posts first — and publishing them would create the self-competing duplicates the
          library audit exists to clean up. {data.drafts_considered > 0 &&
          `${data.drafts_considered} queued draft topics were also treated as coverage. `}
          Over the last {data.period_days} days, {data.filtered_queries.already_winning.toLocaleString()} queries
          were dropped because we already rank top-3,{" "}
          {data.filtered_queries.below_impression_floor.toLocaleString()} as long-tail noise, and{" "}
          {data.filtered_queries.branded.toLocaleString()} as branded.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["create", "improve_existing", "already_covered", "all"] as const).map(k => {
          const active = verdict === k;
          const meta = k === "all" ? null : VERDICT[k];
          const count = k === "all" ? data.opportunities.length : data.counts[k];
          return (
            <button key={k} onClick={() => setVerdict(k)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9,
              background: active ? `${meta?.color ?? "#e98d20"}1f` : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? `${meta?.color ?? "#e98d20"}55` : "rgba(255,255,255,0.07)"}`,
              color: active ? (meta?.color ?? "#e98d20") : "#64748b",
              fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {meta ? meta.label : "All"}
              <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {draftMsg && (
        <div style={{
          background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.22)",
          borderRadius: 11, padding: "11px 14px",
        }}>
          <p style={{ fontSize: 12, color: "#6ee7b7", margin: 0 }}>{draftMsg}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <div style={{ ...PANEL, padding: "36px", textAlign: "center" }}>
          <FileWarning size={22} color="#334155" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
            Nothing in this category for the last {data.period_days} days.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((o, i) => (
            <OpportunityCard key={`${o.primary_query}-${i}`} o={o} onDraft={createDraft} drafting={drafting} />
          ))}
        </div>
      )}

      <Caveats items={data.caveats} />
    </div>
  );
}

export default function BlogSeo() {
  return <BlogPerformanceView />;
}
