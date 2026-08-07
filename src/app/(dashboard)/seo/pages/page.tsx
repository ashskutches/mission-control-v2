"use client";
/**
 * SEO → Pages
 *
 * The drill-down the SEO tab never had. Two states in one route:
 *
 *   no ?url    — every URL Google sent impressions to, sorted by impressions
 *   ?url=/x    — that one page: search, CTR verdict, engagement, on-page, technical
 *
 * SORTED BY IMPRESSIONS, NOT CLICKS
 * ---------------------------------
 * Deliberate. This view exists to find pages that are *seen and not clicked*, and
 * sorting by clicks buries exactly those. The product page is the case in point: 9th
 * by clicks, 2nd by impressions.
 *
 * WHAT THE CTR PANEL IS DOING
 * ---------------------------
 * It never quotes an industry benchmark. A benchmark with no position attached prices a
 * ranking problem as a copy problem — applied to our product page at position 11.8 it
 * produced a $50k/year claim for a meta-title rewrite. Instead the server compares the
 * page to OUR pages at the same rank, and splits the shortfall in two:
 *
 *   snippet gap — recoverable at the current rank, by title/description. Real but small.
 *   rank gap    — only collectable by ranking better. Usually the larger half.
 *
 * Showing one number hides which lever to pull, so both are always shown, and the
 * verdict says which one dominates.
 *
 * WHY TECHNICAL LOADS SEPARATELY
 * ------------------------------
 * PageSpeed runs a live Lighthouse audit on Google's hardware and can exceed a minute on
 * a heavy page. It is fetched on its own so the rest of the view is not held hostage to
 * its worst case, and when it fails it renders why — quota, timeout — with a retry,
 * rather than an error. Each attempt is a fresh audit, so retrying genuinely helps.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MousePointerClick, Eye, Percent, Gauge, ArrowLeft, RefreshCw, Search,
  Target, FileCode2, Zap, TrendingUp, AlertTriangle, CheckCircle2, ExternalLink,
  Users, DollarSign, Timer,
} from "lucide-react";
import {
  BOT_URL, CARD, LABEL, TH, TD, MetricCard, Panel, EmptyState,
  money, num, pct,
} from "@/components/MarketingShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageRow {
  url: string; path: string; clicks: number; impressions: number; ctr_pct: number; position: number;
}
interface PagesResponse {
  period_days: number; total_pages: number; truncated: boolean; pages: PageRow[];
  fetched_at: string; cache_age_seconds: number;
}

interface Band {
  label: string; min: number; max: number; sample_pages: number;
  median_ctr_pct: number | null; weighted_ctr_pct: number | null;
  p25_ctr_pct: number | null; p75_ctr_pct: number | null; measured: boolean;
}
interface Baseline {
  period_days: number; pages_measured: number; pages_below_floor: number;
  min_impressions: number; bands: Band[]; method: string;
}
interface CtrAssessment {
  position: number; impressions: number; clicks: number; actual_ctr_pct: number;
  band: Band | null; expected_clicks_at_rank: number | null; snippet_gap_clicks: number | null;
  target_band: Band | null; rank_gap_clicks: number | null;
  verdict: "rank_limited" | "snippet_limited" | "performing" | "unmeasurable";
  explanation: string;
}
interface QueryRow { keys: string[]; clicks: number; impressions: number; ctr_pct: number; position: number }
interface OnPage {
  title: string | null; title_length: number;
  meta_description: string | null; meta_description_length: number;
  canonical: string | null; h1_count: number; h1_texts: string[]; h2_count: number;
  images_total: number; images_missing_alt: number;
  internal_links: number; external_links: number;
  has_schema_markup: boolean; schema_types: string[];
  has_og_tags: boolean; has_viewport_meta: boolean; has_lang_attr: boolean;
  issues: string[];
}
interface PageDetail {
  url: string; path: string; period: { start: string; end: string }; period_days: number;
  search: {
    totals: { clicks: number; impressions: number; ctr_pct: number; position: number } | null;
    queries: QueryRow[]; query_count: number; queries_truncated: boolean;
    daily: Array<{ date: string; clicks: number; impressions: number; position: number }>;
  };
  ctr: CtrAssessment | null;
  baseline: Baseline;
  engagement: {
    sessions: number; users: number; page_views: number; conversions: number;
    bounce_rate_pct: number | null; avg_duration_sec: number | null;
    path_variants: number; title: string | null;
  } | null;
  landing: { revenue: number; transactions: number; sessions: number; basis: string } | null;
  onpage: OnPage | null;
  warnings: string[];
  property_truncated: boolean;
}

interface FieldMetric { percentile: number | null; category: string | null }
interface Technical {
  url: string;
  unavailable?: boolean; reason?: string; quota_limited?: boolean; timed_out?: boolean; keyless?: boolean;
  audit?: {
    scores: { performance: number | null; accessibility: number | null; best_practices: number | null; seo: number | null };
    core_web_vitals: { lcp_ms: number | null; cls: number | null; tbt_ms: number | null; ttfb_ms: number | null; fcp_ms: number | null };
    passed_cwv: boolean;
  };
  opportunities?: { opportunities: Array<{ id: string; title: string; savings_ms: number | null; impact: string }> };
  field?: {
    scope: string; overall_category: string | null; passes_cwv: boolean | null;
    lcp_ms: FieldMetric; inp_ms: FieldMetric; cls: FieldMetric;
  } | null;
}

const WINDOWS = [7, 28, 90] as const;
type Win = (typeof WINDOWS)[number];

const VERDICT_STYLE: Record<string, { color: string; label: string }> = {
  rank_limited: { color: "#f43f5e", label: "Rank-limited" },
  snippet_limited: { color: "#e98d20", label: "Snippet-limited" },
  performing: { color: "#22c55e", label: "Performing" },
  unmeasurable: { color: "#64748b", label: "Not measurable" },
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const secs = (s: number | null | undefined) =>
  s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeoPagesPage() {
  // Read the URL from location rather than useSearchParams: the hook opts a statically
  // prerendered route into client-only rendering, which has previously replaced a whole
  // page's HTML with a Suspense fallback. Same approach as Command Center.
  const [selected, setSelected] = useState<string | null>(null);
  const [days, setDays] = useState<Win>(28);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(window.location.search);
      setSelected(q.get("url"));
      const d = parseInt(q.get("days") ?? "28", 10);
      setDays((WINDOWS as readonly number[]).includes(d) ? (d as Win) : 28);
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const navigate = useCallback((url: string | null, d: Win) => {
    const q = new URLSearchParams();
    if (url) q.set("url", url);
    if (d !== 28) q.set("days", String(d));
    const qs = q.toString();
    window.history.pushState({}, "", `/seo/pages${qs ? `?${qs}` : ""}`);
    setSelected(url);
    setDays(d);
  }, []);

  if (!ready) return <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>;

  return selected
    ? <PageDetailView path={selected} days={days} onBack={() => navigate(null, days)} onDays={d => navigate(selected, d)} />
    : <PageListView days={days} onOpen={p => navigate(p, days)} onDays={d => navigate(null, d)} />;
}

// ── Window picker ─────────────────────────────────────────────────────────────

function WindowPicker({ days, onDays, right }: { days: Win; onDays: (d: Win) => void; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
      {WINDOWS.map(w => {
        const active = w === days;
        return (
          <button key={w} onClick={() => onDays(w)} style={{
            background: active ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
            color: active ? "#34d399" : "#64748b",
            border: active ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{w}d</button>
        );
      })}
      <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>{right}</div>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

function PageListView({ days, onOpen, onDays }: { days: Win; onOpen: (p: string) => void; onDays: (d: Win) => void }) {
  const [data, setData] = useState<PagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    getJson<PagesResponse>(`${BOT_URL}/admin/seo/pages?days=${days}&limit=500`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [days]);

  const rows = useMemo(() => {
    const all = data?.pages ?? [];
    if (!filter.trim()) return all;
    const f = filter.toLowerCase();
    return all.filter(r => r.path.toLowerCase().includes(f));
  }, [data, filter]);

  return (
    <div>
      <WindowPicker days={days} onDays={onDays} right={
        <span style={{ fontSize: 10, color: "#475569" }}>
          {data ? `${num(data.total_pages)} URLs with impressions` : ""}
        </span>
      } />

      <Panel
        title="Every page Google sent impressions to"
        note={
          `Sorted by impressions, not clicks — this view exists to find pages that are seen and not clicked, ` +
          `and sorting by clicks buries exactly those. Read from a paged Search Console call, so this is the ` +
          `whole property rather than the top 100 rows the Dashboard headline sums.`
        }
        right={
          <div style={{ position: "relative" }}>
            <Search size={11} color="#475569" style={{ position: "absolute", left: 8, top: 7 }} />
            <input
              value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter path…"
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 7, padding: "0.25rem 0.5rem 0.25rem 1.6rem", fontSize: 11, color: "#e2e8f0", width: 200,
              }}
            />
          </div>
        }
      >
        {loading ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Loading — this reads Search Console…</p>
        ) : !data ? (
          <EmptyState reason="The pages endpoint did not respond. Check Feed status on the SEO Dashboard." />
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#475569" }}>No page matches “{filter}”.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Page</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>CTR</th>
                  <th style={TH}>Position</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map(r => (
                  <tr key={r.url} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onClick={() => onOpen(r.path)}>
                    <td style={{ ...TD, textAlign: "left", maxWidth: 420, whiteSpace: "normal", wordBreak: "break-all" }}>
                      <span style={{ color: "#94a3b8", fontSize: 11.5 }}>{r.path}</span>
                    </td>
                    <td style={TD}>{num(r.impressions)}</td>
                    <td style={TD}>{num(r.clicks)}</td>
                    <td style={{ ...TD, color: r.ctr_pct < 0.5 ? "#f43f5e" : "#94a3b8" }}>{pct(r.ctr_pct, 1)}</td>
                    <td style={{ ...TD, fontWeight: 700, color: r.position <= 10 ? "#e98d20" : "#f43f5e" }}>
                      {r.position?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.5rem" }}>
                Showing the first 200 of {num(rows.length)} matching pages. Narrow with the filter.
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ── Detail ────────────────────────────────────────────────────────────────────

const TABS = ["search", "engagement", "onpage", "technical"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  search: "Search", engagement: "Engagement", onpage: "On-page", technical: "Technical",
};
const TAB_ICON: Record<Tab, any> = {
  search: Target, engagement: Users, onpage: FileCode2, technical: Zap,
};

function PageDetailView({ path, days, onBack, onDays }: {
  path: string; days: Win; onBack: () => void; onDays: (d: Win) => void;
}) {
  const [data, setData] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("search");
  const [tech, setTech] = useState<Technical | null>(null);
  const [techLoading, setTechLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getJson<PageDetail>(`${BOT_URL}/admin/seo/page?url=${encodeURIComponent(path)}&days=${days}`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [path, days]);

  useEffect(() => { load(); }, [load]);

  // Only when the tab is opened. A live Lighthouse run costs up to 30 seconds and a slot
  // in a small shared quota — spending that on every page view, for a panel most visits
  // never look at, is how the quota gets exhausted for the visits that do need it.
  useEffect(() => {
    if (tab !== "technical" || tech || techLoading) return;
    setTechLoading(true);
    getJson<Technical>(`${BOT_URL}/admin/seo/page/technical?url=${encodeURIComponent(path)}`).then(t => {
      setTech(t);
      setTechLoading(false);
    });
  }, [tab, tech, techLoading, path]);

  const t = data?.search?.totals;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{
          display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "0.25rem 0.6rem",
          fontSize: 11, color: "#64748b", cursor: "pointer",
        }}>
          <ArrowLeft size={11} /> All pages
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", wordBreak: "break-all" }}>{path}</span>
        {data && (
          <a href={data.url} target="_blank" rel="noreferrer" style={{ color: "#475569", display: "inline-flex" }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      <WindowPicker days={days} onDays={onDays} right={
        <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh">
          <RefreshCw size={12} className={loading ? "spin" : ""} />
        </button>
      } />

      {loading && !data ? (
        <p style={{ fontSize: 12, color: "#475569" }}>Loading — this reads Search Console, GA4 and the page itself…</p>
      ) : !data ? (
        <EmptyState reason="The page endpoint did not respond. Check Feed status on the SEO Dashboard." />
      ) : (
        <>
          {/* Headline */}
          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            <MetricCard label="Clicks" icon={MousePointerClick} color="#34d399" value={num(t?.clicks)} sub={`${days} days`} />
            <MetricCard label="Impressions" icon={Eye} color="#38bdf8" value={num(t?.impressions)} />
            <MetricCard label="CTR" icon={Percent} color="#e98d20" value={pct(t?.ctr_pct, 2)} />
            <MetricCard label="Position" icon={Gauge} color="#a78bfa" value={t?.position?.toFixed(1) ?? "—"}
              sub="Google's own aggregate" />
            {data.engagement && (
              <MetricCard label="Sessions" icon={Users} color="#818cf8" value={num(data.engagement.sessions)} sub="GA4, all sources" />
            )}
          </div>
          <p style={{ fontSize: 10, color: "#475569", marginBottom: "1rem", lineHeight: 1.5 }}>
            Position is Search Console&rsquo;s impression-weighted aggregate for this URL, not a mean over its
            query rows — those differ, sometimes by six positions, and only the first is the number Search
            Console itself reports.
          </p>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {data.warnings.map((w, i) => (
                <div key={i} style={{
                  display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.55rem 0.7rem",
                  background: "rgba(233,141,32,0.05)", border: "1px solid rgba(233,141,32,0.16)", borderRadius: 8,
                }}>
                  <AlertTriangle size={12} color="#e98d20" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 11, color: "#b45309", lineHeight: 1.55 }}>{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {TABS.map(k => {
              const active = k === tab;
              const Icon = TAB_ICON[k];
              return (
                <button key={k} onClick={() => setTab(k)} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.35rem",
                  background: active ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#34d399" : "#64748b",
                  border: active ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <Icon size={12} /> {TAB_LABEL[k]}
                </button>
              );
            })}
          </div>

          {tab === "search" && <SearchTab data={data} days={days} />}
          {tab === "engagement" && <EngagementTab data={data} />}
          {tab === "onpage" && <OnPageTab data={data} />}
          {tab === "technical" && <TechnicalTab tech={tech} loading={techLoading} onRetry={() => setTech(null)} />}
        </>
      )}
    </div>
  );
}

// ── Search tab ────────────────────────────────────────────────────────────────

function SearchTab({ data, days }: { data: PageDetail; days: Win }) {
  const c = data.ctr;
  const style = c ? VERDICT_STYLE[c.verdict]! : VERDICT_STYLE.unmeasurable!;

  return (
    <>
      {/* The verdict */}
      <Panel
        title="What is actually limiting this page"
        note="Measured against our own pages at the same rank, never an industry benchmark — a benchmark with no position attached prices a ranking problem as a copy problem."
        right={
          <span style={{
            fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
            background: `${style.color}14`, border: `1px solid ${style.color}2b`, color: style.color,
            borderRadius: 20, padding: "0.15rem 0.6rem",
          }}>{style.label}</span>
        }
      >
        {!c ? (
          <EmptyState reason="No Search Console rows for this URL in the window, so there is nothing to assess." />
        ) : (
          <>
            <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
              {[
                { l: "Actual CTR", v: pct(c.actual_ctr_pct, 2), c: "#e2e8f0" },
                { l: `Our median at ${c.band?.label ?? "—"}`, v: pct(c.band?.median_ctr_pct, 2), c: "#38bdf8",
                  s: `${c.band?.sample_pages ?? 0} of our pages` },
                { l: "Snippet gap", v: c.snippet_gap_clicks != null ? `${c.snippet_gap_clicks > 0 ? "+" : ""}${num(c.snippet_gap_clicks)}` : "—",
                  c: "#e98d20", s: `clicks / ${days}d — title & description` },
                { l: "Rank gap", v: c.rank_gap_clicks != null ? `+${num(c.rank_gap_clicks)}` : "none",
                  c: "#f43f5e", s: c.target_band ? `clicks / ${days}d — reaching ${c.target_band.label}` : "no better band earns more" },
              ].map(({ l, v, c: col, s }) => (
                <div key={l}>
                  <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{l}</p>
                  <p style={{ fontSize: "1.4rem", fontWeight: 800, color: col }}>{v}</p>
                  {s && <p style={{ fontSize: 9.5, color: "#475569", marginTop: 2 }}>{s}</p>}
                </div>
              ))}
            </div>
            <p style={{
              fontSize: 12, color: "#94a3b8", lineHeight: 1.65, padding: "0.7rem 0.85rem",
              background: `${style.color}08`, border: `1px solid ${style.color}1c`, borderRadius: 9,
            }}>{c.explanation}</p>
          </>
        )}
      </Panel>

      {/* The curve */}
      <Panel title="Our CTR curve" note={data.baseline.method}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: "left" }}>Position band</th>
                <th style={TH}>Pages</th>
                <th style={TH}>Median CTR</th>
                <th style={TH}>Weighted CTR</th>
                <th style={TH}>p25 – p75</th>
              </tr>
            </thead>
            <tbody>
              {data.baseline.bands.map(b => {
                const here = data.ctr?.band?.label === b.label;
                const target = data.ctr?.target_band?.label === b.label;
                return (
                  <tr key={b.label} style={{
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    background: here ? "rgba(244,63,94,0.06)" : target ? "rgba(52,211,153,0.05)" : undefined,
                  }}>
                    <td style={{ ...TD, textAlign: "left", fontWeight: here || target ? 800 : 500 }}>
                      {b.label}
                      {here && <span style={{ color: "#f43f5e", fontSize: 9.5, marginLeft: 6 }}>THIS PAGE</span>}
                      {target && <span style={{ color: "#34d399", fontSize: 9.5, marginLeft: 6 }}>TARGET</span>}
                    </td>
                    <td style={TD}>{b.measured ? num(b.sample_pages) : <span style={{ color: "#475569" }}>{b.sample_pages}</span>}</td>
                    <td style={TD}>{b.measured ? pct(b.median_ctr_pct, 1) : "—"}</td>
                    <td style={TD}>{b.measured ? pct(b.weighted_ctr_pct, 1) : "—"}</td>
                    <td style={TD}>{b.measured ? `${pct(b.p25_ctr_pct, 1)} – ${pct(b.p75_ctr_pct, 1)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10, color: "#475569", marginTop: "0.6rem", lineHeight: 1.5 }}>
          Bands with fewer than 5 pages above the {data.baseline.min_impressions}-impression floor are left
          unmeasured rather than given a confident-looking number from a handful of rows.
        </p>
      </Panel>

      {/* Queries */}
      <Panel
        title="Queries this page ranks for"
        note={
          `${num(data.search.query_count)} queries surface this URL. Filtered server-side to this page, so ` +
          `this is the page's complete query set rather than whatever survived a top-N cut across the site.` +
          (data.search.queries_truncated ? " Truncated at the request cap." : "")
        }
      >
        {data.search.queries.length === 0 ? (
          <p style={{ fontSize: 12, color: "#475569" }}>No queries returned for this URL in the window.</p>
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
                {data.search.queries.slice(0, 40).map((q, i) => (
                  <motion.tr key={q.keys[0] ?? i}
                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.015 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ ...TD, textAlign: "left", maxWidth: 340, whiteSpace: "normal" }}>{q.keys[0]}</td>
                    <td style={TD}>{num(q.impressions)}</td>
                    <td style={{ ...TD, color: q.clicks === 0 && q.impressions > 200 ? "#f43f5e" : undefined }}>{num(q.clicks)}</td>
                    <td style={TD}>{pct(q.ctr_pct, 1)}</td>
                    <td style={{ ...TD, fontWeight: 700, color: q.position <= 10 ? "#e98d20" : "#f43f5e" }}>
                      {q.position?.toFixed(1)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Engagement tab ────────────────────────────────────────────────────────────

function EngagementTab({ data }: { data: PageDetail }) {
  const e = data.engagement;
  const l = data.landing;

  return (
    <>
      <Panel title="On-page behaviour" note="GA4, all traffic sources — not organic only. Search Console above is organic; these two never reconcile exactly and are not meant to.">
        {!e ? (
          <EmptyState reason="GA4 returned no rows for this exact path. It may have no sessions in the window, or GA4 may be unconfigured — check Feed status on the SEO Dashboard." />
        ) : (
          <>
            <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
              {[
                { l: "Sessions", v: num(e.sessions), c: "#34d399", icon: Users },
                { l: "Users", v: num(e.users), c: "#38bdf8", icon: Users },
                { l: "Page views", v: num(e.page_views), c: "#a78bfa", icon: Eye },
                { l: "Bounce rate", v: pct(e.bounce_rate_pct, 1), c: "#e98d20", icon: TrendingUp },
                { l: "Avg duration", v: secs(e.avg_duration_sec), c: "#818cf8", icon: Timer },
              ].map(({ l: lab, v, c, icon: Icon }) => (
                <div key={lab}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <Icon size={11} color={c} />
                    <p style={{ ...LABEL, fontSize: 9 }}>{lab}</p>
                  </div>
                  <p style={{ fontSize: "1.3rem", fontWeight: 800, color: c }}>{v}</p>
                </div>
              ))}
            </div>
            {e.path_variants > 1 && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.7rem" }}>
                Summed across {e.path_variants} query-string variants of this path. Rates are session-weighted,
                so a 3-session variant does not count equally with a 900-session one.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        title="Revenue this page started"
        note={l?.basis ?? "Session-scoped attribution — the only read that can credit revenue to a content page."}
        right={<DollarSign size={13} color="#22c55e" />}
      >
        {!l ? (
          <EmptyState reason="GA4 is not configured, so no revenue can be attributed." />
        ) : (
          <>
            <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
              {[
                { l: "Revenue", v: money(l.revenue), c: "#22c55e" },
                { l: "Transactions", v: num(l.transactions), c: "#34d399" },
                { l: "Entry sessions", v: num(l.sessions), c: "#38bdf8" },
              ].map(({ l: lab, v, c }) => (
                <div key={lab}>
                  <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{lab}</p>
                  <p style={{ fontSize: "1.4rem", fontWeight: 800, color: c }}>{v}</p>
                </div>
              ))}
            </div>
            {e && e.conversions === 0 && (
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: "0.8rem", lineHeight: 1.6 }}>
                The conversion count on this page reads zero, and that is expected rather than a tracking fault.
                GA4 credits a purchase to the page the event fired on, which on Shopify is always the checkout
                URL — so <strong style={{ color: "#e2e8f0" }}>every</strong> content page reads zero there by
                construction. The figures above are the session-scoped read, which is the one that can credit
                this page.
              </p>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

// ── On-page tab ───────────────────────────────────────────────────────────────

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
      {ok ? <CheckCircle2 size={13} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
          : <AlertTriangle size={13} color="#e98d20" style={{ flexShrink: 0, marginTop: 1 }} />}
      <span style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function OnPageTab({ data }: { data: PageDetail }) {
  const o = data.onpage;
  if (!o) return <EmptyState reason="The on-page audit could not fetch this URL. See the warnings above." />;

  return (
    <>
      <Panel
        title="What Google sees in the SERP"
        note="Fetched from the live server-rendered HTML and measured after decoding HTML entities — an ampersand is five characters in source and one on screen, and Google truncates on the rendered string."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div>
            <p style={{ ...LABEL, fontSize: 9, marginBottom: 4 }}>
              Title — {o.title_length} chars {o.title_length > 60 && <span style={{ color: "#e98d20" }}>(Google shows ~60)</span>}
            </p>
            <p style={{ fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.5, wordBreak: "break-word" }}>{o.title ?? "—"}</p>
            {o.title && o.title_length > 60 && (
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Likely visible: <span style={{ color: "#94a3b8" }}>{o.title.slice(0, 60)}…</span>
              </p>
            )}
          </div>
          <div>
            <p style={{ ...LABEL, fontSize: 9, marginBottom: 4 }}>
              Meta description — {o.meta_description_length} chars
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>{o.meta_description ?? "—"}</p>
          </div>
          <div>
            <p style={{ ...LABEL, fontSize: 9, marginBottom: 4 }}>H1 ×{o.h1_count}</p>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{o.h1_texts.join(" | ") || "—"}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Structure & markup">
        <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {[
            { l: "H2 sections", v: num(o.h2_count), c: "#38bdf8" },
            { l: "Internal links", v: num(o.internal_links), c: "#34d399" },
            { l: "External links", v: num(o.external_links), c: "#a78bfa" },
            { l: "Images", v: num(o.images_total), c: "#818cf8" },
            { l: "Missing alt", v: num(o.images_missing_alt), c: o.images_missing_alt > 0 ? "#e98d20" : "#22c55e" },
          ].map(({ l, v, c }) => (
            <div key={l}>
              <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{l}</p>
              <p style={{ fontSize: "1.3rem", fontWeight: 800, color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Check ok={o.has_schema_markup}>
            {o.has_schema_markup ? `Structured data: ${o.schema_types.join(", ")}` : "No JSON-LD structured data found"}
          </Check>
          <Check ok={!!o.canonical}>{o.canonical ? `Canonical: ${o.canonical}` : "No canonical URL"}</Check>
          <Check ok={o.has_og_tags}>{o.has_og_tags ? "Open Graph tags present" : "No Open Graph tags"}</Check>
          <Check ok={o.has_viewport_meta}>{o.has_viewport_meta ? "Viewport meta present" : "No viewport meta"}</Check>
          <Check ok={o.has_lang_attr}>{o.has_lang_attr ? "lang attribute set" : "No lang attribute on <html>"}</Check>
        </div>
      </Panel>

      <Panel title="Issues" note="Rule-based checks against the fetched HTML. Nothing here is applied automatically.">
        {o.issues.length === 0 ? (
          <p style={{ fontSize: 12, color: "#22c55e" }}>No issues found by the on-page checks.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {o.issues.map((i, n) => <Check key={n} ok={false}>{i}</Check>)}
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Technical tab ─────────────────────────────────────────────────────────────

function scoreColor(s: number | null | undefined) {
  if (s == null) return "#64748b";
  return s >= 90 ? "#22c55e" : s >= 50 ? "#e98d20" : "#f43f5e";
}
const CATEGORY_COLOR: Record<string, string> = { FAST: "#22c55e", AVERAGE: "#e98d20", SLOW: "#f43f5e" };

function TechnicalTab({ tech, loading, onRetry }: { tech: Technical | null; loading: boolean; onRetry?: () => void }) {
  if (loading) return <p style={{ fontSize: 12, color: "#475569" }}>Running a live Lighthouse audit on Google’s hardware — a heavy page can take a minute…</p>;
  if (!tech) return <EmptyState reason="The technical endpoint did not respond." />;

  if (tech.unavailable) {
    return (
      <Panel title="PageSpeed unavailable" right={onRetry && (
        <button onClick={onRetry} style={{
          display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "0.2rem 0.6rem",
          fontSize: 10.5, color: "#94a3b8", cursor: "pointer",
        }}><RefreshCw size={10} /> Retry</button>
      )}>
        <p style={{ fontSize: 12, color: "#b45309", lineHeight: 1.6 }}>{tech.reason}</p>
      </Panel>
    );
  }

  const f = tech.field;
  const a = tech.audit;

  return (
    <>
      <Panel
        title="Field data — what real Chrome users measured"
        note="Chrome UX Report, trailing 28 days. This is what Google's page-experience signal actually reads. Lead with this, not the lab run below."
      >
        {!f ? (
          <EmptyState reason="This URL does not have enough Chrome traffic for CrUX to report field data. Only the lab run below is available, and a lab number is not a user experience." />
        ) : (
          <>
            <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
              {[
                { l: "LCP", m: f.lcp_ms, fmt: (v: number) => `${(v / 1000).toFixed(1)}s`, target: "≤ 2.5s" },
                { l: "INP", m: f.inp_ms, fmt: (v: number) => `${Math.round(v)}ms`, target: "≤ 200ms" },
                { l: "CLS", m: f.cls, fmt: (v: number) => v.toFixed(3), target: "≤ 0.1" },
              ].map(({ l, m, fmt, target }) => (
                <div key={l}>
                  <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{l}</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 800, color: CATEGORY_COLOR[m.category ?? ""] ?? "#64748b" }}>
                    {m.percentile != null ? fmt(m.percentile) : "—"}
                  </p>
                  <p style={{ fontSize: 9.5, color: "#475569", marginTop: 2 }}>{m.category ?? "no data"} · {target}</p>
                </div>
              ))}
              <div>
                <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>Passes CWV</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: f.passes_cwv ? "#22c55e" : "#f43f5e" }}>
                  {f.passes_cwv == null ? "—" : f.passes_cwv ? "Yes" : "No"}
                </p>
              </div>
            </div>
            {f.scope === "origin" && (
              <p style={{ fontSize: 10.5, color: "#b45309", marginTop: "0.7rem", lineHeight: 1.55 }}>
                This URL has too little Chrome traffic for its own CrUX record, so these are the whole
                origin&rsquo;s numbers. They describe the site, not this page.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        title="Lab run — Lighthouse"
        note="One simulated mid-tier phone on a throttled connection with a cold cache. Reproducible and diagnostic; not what your visitors experienced. A lab LCP many times the field LCP is the throttling profile, not a crisis."
      >
        {!a ? <EmptyState reason="No Lighthouse result returned." /> : (
          <>
            <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {[
                { l: "Performance", v: a.scores.performance },
                { l: "SEO", v: a.scores.seo },
                { l: "Accessibility", v: a.scores.accessibility },
                { l: "Best practices", v: a.scores.best_practices },
              ].map(({ l, v }) => (
                <div key={l}>
                  <p style={{ ...LABEL, fontSize: 9, marginBottom: 3 }}>{l}</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 800, color: scoreColor(v) }}>{v ?? "—"}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[
                { l: "LCP (lab)", v: a.core_web_vitals.lcp_ms != null ? `${(a.core_web_vitals.lcp_ms / 1000).toFixed(1)}s` : "—" },
                { l: "TBT", v: a.core_web_vitals.tbt_ms != null ? `${a.core_web_vitals.tbt_ms}ms` : "—" },
                { l: "CLS (lab)", v: a.core_web_vitals.cls ?? "—" },
                { l: "TTFB", v: a.core_web_vitals.ttfb_ms != null ? `${a.core_web_vitals.ttfb_ms}ms` : "—" },
              ].map(({ l, v }) => (
                <div key={l}>
                  <p style={{ ...LABEL, fontSize: 9, marginBottom: 2 }}>{l}</p>
                  <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "#94a3b8" }}>{v}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel title="Opportunities" note="Lighthouse's own estimated savings, largest first.">
        {!tech.opportunities?.opportunities?.length ? (
          <p style={{ fontSize: 12, color: "#22c55e" }}>Lighthouse flagged no savings opportunities.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {tech.opportunities.opportunities.slice(0, 10).map(o => (
              <div key={o.id} style={{
                display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.5rem 0.7rem",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 11.5, color: "#e2e8f0", flex: 1 }}>{o.title}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
                  color: o.impact === "high" ? "#f43f5e" : o.impact === "medium" ? "#e98d20" : "#64748b",
                }}>{o.impact}</span>
                <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700, minWidth: 70, textAlign: "right" }}>
                  {o.savings_ms != null ? `${num(o.savings_ms)}ms` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
