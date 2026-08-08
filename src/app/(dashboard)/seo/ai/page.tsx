"use client";
/**
 * SEO → AI Visibility
 *
 * Whether language models can read our pages, and whether there is anything on them worth
 * quoting once they have.
 *
 * WHY THIS SCREEN HAS NO DOLLAR FIGURE ON IT
 * ------------------------------------------
 * The research report this was built from ends at "+$16,920/year". It gets there by taking
 * visibility lifts measured on a 10,000-query academic benchmark (Aggarwal et al., KDD 2024)
 * and running them through our AOV. That is the same move that produced the discredited
 * $50,688/year meta-title claim — a number measured somewhere else, applied to our sessions,
 * and presented as revenue. `seo-ctr-baseline.ts` exists because of the first one.
 *
 * So the lifts appear here as attribution on each lever, next to their source, and nothing
 * multiplies them. The dollar math that holds up already exists on Opportunities, where a
 * page is priced only where GA4 measures that page's own revenue per session. There is a link
 * to it at the bottom.
 *
 * WHY THERE IS NO 0–100 SCORE
 * ---------------------------
 * A composite would have to weight six booleans against each other, and the only weights
 * available are those benchmark lifts. The score would look like a prediction about our
 * traffic while being a weighted sum of checkboxes. "4 of 6 present" cannot be misread that
 * way, and it is the same information.
 *
 * WHAT THE CRAWLER TABLE IS CAREFUL ABOUT
 * ---------------------------------------
 * Two things, both of which read as leaks if you flatten them:
 *   - Training-only crawlers (GPTBot, ClaudeBot, CCBot…) send no referral traffic. Blocking
 *     them is a licensing decision with no SEO cost.
 *   - Shopify's default robots.txt carries ~47 Disallow lines and blocks nothing citable.
 *     Counting rules instead of testing URLs put a red flag beside all five citation crawlers
 *     on a site that blocks none of them.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot, ShieldCheck, ShieldAlert, Quote, FileJson, Hash, CalendarClock, Link2,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronRight, ChevronDown,
  HelpCircle, Target, FileSearch, ListChecks, BookMarked,
} from "lucide-react";
import {
  BOT_URL, CARD, LABEL, TH, TD, MetricCard, Panel, EmptyState, num,
} from "@/components/MarketingShared";

// ── Types (mirror GET /admin/seo/ai) ─────────────────────────────────────────

type CrawlerRole = "citation" | "grounding" | "training";
type CrawlerAccess = "allowed" | "blocked" | "partial";
type LeverKey = "schema" | "citations" | "statistics" | "quotations" | "answer_headings" | "freshness";

interface CrawlerVerdict {
  token: string; operator: string; role: CrawlerRole; note: string;
  access: CrawlerAccess; explicit: boolean; matched_rule: string | null; decided_by: string;
  blocked_content_paths: string[]; non_content_disallows: number;
}
interface LeverSpec {
  key: LeverKey; label: string; measured_lift: string | null; source: string; why: string;
}
interface LeverVerdict { key: LeverKey; present: boolean; detail: string }
interface Signals {
  schema_types: string[];
  external_citations: number; cited_domains: string[];
  statistics: number; statistic_samples: string[];
  quotations: number;
  answer_headings: number; answer_heading_samples: string[];
  date_modified: string | null; date_age_days: number | null;
  words: number;
}
interface PageRow {
  url: string; path: string; clicks: number; impressions: number; position: number;
  signals: Signals | null; levers: LeverVerdict[]; levers_present: number | null;
  fetch_error: string | null;
}
interface AiAction {
  id: string; phase: 1 | 2 | 3; title: string; where: string; why: string;
  effort_hours: [number, number]; pages: string[]; evidence: string;
  unverifiable_here?: boolean;
}
interface AiResponse {
  period_days: number; origin: string;
  access: {
    robots: {
      fetched: boolean; status: number | null; error: string | null;
      crawlers: CrawlerVerdict[];
      content_signal: { present: boolean; raw: string | null; pairs: { key: string; value: string }[]; group: string | null };
      llms_txt: { present: boolean; status: number | null; bytes: number | null; platform_default: boolean };
      sitemaps: string[];
    };
    blocked_traffic_bearing: string[];
    citation_crawlers_allowed: number;
    citation_crawlers_total: number;
  };
  levers: LeverSpec[];
  lever_floors: Record<string, number>;
  pages_requested: number; pages_audited: number; page_list_error: string | null;
  summary: {
    fetch_failed: number; total_impressions: number; levers_present_median: number | null;
    missing_schema: number; missing_citations: number; missing_statistics: number;
    missing_quotations: number; impressions_missing_citations: number;
  };
  pages: PageRow[];
  actions: AiAction[];
  caveats: string[];
  fetched_at?: string; cache_age_seconds?: number;
  error?: string;
}

// ── Presentation constants ───────────────────────────────────────────────────

const ROLE_STYLE: Record<CrawlerRole, { color: string; label: string }> = {
  citation:  { color: "#22d3ee", label: "cites us" },
  grounding: { color: "#a78bfa", label: "grounds answers" },
  // Grey on purpose. A training crawler is not a traffic surface, and colouring it like one
  // is how "we are blocking AI" becomes a finding on a site losing nothing.
  training:  { color: "#64748b", label: "training only" },
};

const LEVER_ICON: Record<LeverKey, React.ComponentType<{ size?: number; color?: string }>> = {
  citations: Link2, statistics: Hash, quotations: Quote,
  schema: FileJson, answer_headings: HelpCircle, freshness: CalendarClock,
};

const LEVER_ORDER: LeverKey[] = ["citations", "statistics", "quotations", "schema", "answer_headings", "freshness"];

const PHASE_STYLE: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "Quick — hours" },
  2: { color: "#e98d20", label: "Copy work — days" },
  3: { color: "#64748b", label: "Ongoing — weeks" },
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      background: `${color}18`, color, borderRadius: 20, padding: "0.1rem 0.45rem",
      border: `1px solid ${color}25`, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

/** The six levers as a compact row of icons — filled when present, outlined when not. */
function LeverStrip({ levers }: { levers: LeverVerdict[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 5 }}>
      {LEVER_ORDER.map(key => {
        const v = levers.find(l => l.key === key);
        const Icon = LEVER_ICON[key];
        const on = !!v?.present;
        return (
          <span key={key} title={v?.detail ?? key} style={{ display: "inline-flex" }}>
            <Icon size={13} color={on ? "#34d399" : "#334155"} />
          </span>
        );
      })}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SeoAiPage() {
  const [limit, setLimit] = useState(12);
  const [data, setData] = useState<AiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showTraining, setShowTraining] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/seo/ai?limit=${limit}${fresh ? "&fresh=1" : ""}`);
      const json = (await res.json()) as AiResponse;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const access = data?.access;
  const robots = access?.robots;
  const cs = robots?.content_signal;

  const crawlers = (robots?.crawlers ?? []).filter(c => showTraining || c.role !== "training");
  const trainingCount = (robots?.crawlers ?? []).filter(c => c.role === "training").length;
  const blockedBearing = access?.blocked_traffic_bearing ?? [];

  const byPhase = (n: 1 | 2 | 3) => (data?.actions ?? []).filter(a => a.phase === n);
  const totalHours = (data?.actions ?? []).reduce((t, a) => t + a.effort_hours[0], 0);

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[12, 20, 30].map(n => {
          const active = limit === n;
          return (
            <button key={n} onClick={() => setLimit(n)}
              style={{
                background: active ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.04)",
                color: active ? "#22d3ee" : "#64748b",
                border: active ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
              Top {n} pages
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {data?.cache_age_seconds != null && (
            <span style={{ fontSize: 10, color: "#475569" }}>
              cached {Math.round(data.cache_age_seconds / 60)}m ago · one HTTP fetch per page
            </span>
          )}
          <button onClick={() => load(true)} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Re-audit pages">
            <RefreshCw size={12} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason={`The AI visibility endpoint failed: ${error}.`} />
        </div>
      )}

      {/* A page list we could not build is a credential problem, and it says so above the
          numbers. The access half below does not depend on Search Console. */}
      {data?.page_list_error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason={data.page_list_error} />
        </div>
      )}

      {robots?.error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason={`robots.txt could not be read: ${robots.error} — every crawler below therefore reads as unrestricted, which is what a missing robots.txt means, but it has no rules behind it.`} />
        </div>
      )}

      {/* ── Headline ── */}
      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <MetricCard
          label="Crawlers that can cite us"
          icon={blockedBearing.length ? ShieldAlert : ShieldCheck}
          color={blockedBearing.length ? "#f43f5e" : "#22c55e"}
          value={access ? `${access.citation_crawlers_allowed} / ${access.citation_crawlers_total}` : "—"}
          sub={blockedBearing.length ? `Blocked: ${blockedBearing.join(", ")}` : "Training-only bots excluded — they send no traffic"}
        />
        <MetricCard
          label="Content-Signal"
          icon={Bot} color={cs?.present ? "#22c55e" : "#e98d20"}
          value={cs?.present ? "Declared" : "Absent"}
          sub={cs?.present
            ? cs.pairs.map(p => `${p.key}=${p.value}`).join(" · ")
            : "No stated position on search vs AI input vs training"}
        />
        <MetricCard
          label="Levers present (median)"
          icon={ListChecks} color="#22d3ee"
          value={s?.levers_present_median != null ? `${s.levers_present_median} / 6` : "—"}
          sub={data ? `Across ${data.pages_audited} audited page(s)` : undefined}
        />
        <MetricCard
          label="Exposure without citations"
          icon={Link2} color={s?.impressions_missing_citations ? "#e98d20" : "#22c55e"}
          value={s ? num(s.impressions_missing_citations) : "—"}
          sub="Impressions on pages citing no external source"
        />
      </div>

      <p style={{ fontSize: 10.5, color: "#475569", marginBottom: "1.25rem", lineHeight: 1.55 }}>
        Two questions, kept apart because they fail apart and have different owners. <strong style={{ color: "#94a3b8" }}>Access</strong> is
        one read of robots.txt and a theme change — an hour of work. <strong style={{ color: "#94a3b8" }}>Quotability</strong> is one read per
        page and it is copywriting. No figure on this screen is a revenue projection; see the sourcing panel below.
      </p>

      {/* ── Access ── */}
      <Panel
        title="Access — can the models fetch us"
        note="Verdicts come from testing real content URLs against the rules, not from counting Disallow lines. Shopify's default file has ~47 of them and blocks nothing citable."
        right={
          trainingCount > 0 ? (
            <button onClick={() => setShowTraining(v => !v)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
              {showTraining ? "Hide" : "Show"} {trainingCount} training-only
            </button>
          ) : undefined
        }
      >
        {!data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Reading robots.txt…</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Crawler</th>
                    <th style={{ ...TH, textAlign: "left" }}>Operator</th>
                    <th style={{ ...TH, textAlign: "left" }}>What it is</th>
                    <th style={TH}>Access</th>
                    <th style={{ ...TH, textAlign: "left" }}>Decided by</th>
                  </tr>
                </thead>
                <tbody>
                  {crawlers.map((c, i) => {
                    const role = ROLE_STYLE[c.role];
                    const bad = c.access !== "allowed" && c.role !== "training";
                    return (
                      <motion.tr key={c.token}
                        initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 14) * 0.02 }}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: c.role === "training" ? "#64748b" : "#e2e8f0" }}>
                          {c.token}
                        </td>
                        <td style={{ ...TD, textAlign: "left", fontSize: 11, color: "#64748b" }}>{c.operator}</td>
                        <td style={{ ...TD, textAlign: "left", maxWidth: 340, whiteSpace: "normal" }}>
                          <Pill color={role.color}>{role.label}</Pill>
                          <p style={{ fontSize: 10.5, color: "#64748b", margin: "0.25rem 0 0", lineHeight: 1.5 }}>{c.note}</p>
                        </td>
                        <td style={TD}>
                          {c.access === "allowed" ? (
                            <CheckCircle2 size={14} color={c.role === "training" ? "#475569" : "#22c55e"} />
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: bad ? "#f43f5e" : "#64748b", fontSize: 10, fontWeight: 700 }}>
                              <XCircle size={12} /> {c.access}
                            </span>
                          )}
                        </td>
                        <td style={{ ...TD, textAlign: "left", fontSize: 10, color: "#475569", maxWidth: 260, whiteSpace: "normal" }}>
                          {c.explicit ? "named explicitly" : `fell through to ${c.decided_by}`}
                          {c.blocked_content_paths.length > 0 && (
                            <span style={{ display: "block", color: "#f43f5e", marginTop: 2 }}>
                              blocks {c.blocked_content_paths.join(", ")} — {c.matched_rule}
                            </span>
                          )}
                          {/* Said out loud so "allowed" beside a wall of rules does not look
                              like a parser that gave up on the file. */}
                          {c.blocked_content_paths.length === 0 && c.non_content_disallows > 0 && (
                            <span style={{ display: "block", marginTop: 2 }}>
                              {c.non_content_disallows} rule(s), none reaching content
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Site-level facts that are not per-crawler. */}
            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "1rem", paddingTop: "0.9rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ minWidth: 260, flex: 1 }}>
                <p style={{ ...LABEL, fontSize: 9, color: cs?.present ? "#22c55e" : "#e98d20" }}>Content-Signal directive</p>
                <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.55 }}>
                  {cs?.present
                    ? <code style={{ fontSize: 10.5, color: "#22d3ee" }}>{cs.raw}</code>
                    : "Absent. Adding it states separately whether the site permits search indexing, AI answer input, and AI training — without it a plain Allow is the only position we express, and there is no way to permit citation while declining training."}
                </p>
              </div>
              <div style={{ minWidth: 260, flex: 1 }}>
                <p style={{ ...LABEL, fontSize: 9, color: robots?.llms_txt.platform_default ? "#e98d20" : robots?.llms_txt.present ? "#22c55e" : "#64748b" }}>
                  /llms.txt
                </p>
                <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.55 }}>
                  {robots?.llms_txt.platform_default
                    // A presence check reads as done here while nothing we chose is in the file.
                    ? `Returns 200, but it is Shopify's own default file pointing agents at shop.app's purchasing skill. Nothing in it is ours.`
                    : robots?.llms_txt.present
                      ? `Present (${robots.llms_txt.bytes} bytes).`
                      : `Absent. A proposed convention no major operator has committed to honouring — cheap optionality, not a gap costing anything today.`}
                </p>
              </div>
              <div style={{ minWidth: 200, flex: 1 }}>
                <p style={{ ...LABEL, fontSize: 9 }}>Sitemaps declared</p>
                <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.55, wordBreak: "break-all" }}>
                  {robots?.sitemaps.length ? robots.sitemaps.join(", ") : "None declared in robots.txt."}
                </p>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* ── Quotability ── */}
      <Panel
        title="Quotability — is there anything here to quote"
        note="Ordered by impressions. Click a row for what was counted on it. Six levers: citations, statistics, quotations, schema, question headings, a date."
        right={<Bot size={13} color="#22d3ee" />}
      >
        {loading && !data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Fetching and analysing each page…</p>
        ) : !data || data.pages.length === 0 ? (
          <EmptyState reason={data?.page_list_error ?? "No pages returned. This needs Search Console for the impression-ordered page list."} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Page</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>Levers</th>
                  <th style={TH}>Present</th>
                  <th style={TH}>Words</th>
                  <th style={TH} />
                </tr>
              </thead>
              <tbody>
                {data.pages.map((p, i) => {
                  const isOpen = open === p.path;
                  return (
                    <React.Fragment key={p.path}>
                      <motion.tr
                        initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                        onClick={() => setOpen(isOpen ? null : p.path)}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      >
                        <td style={{ ...TD, textAlign: "left", maxWidth: 300, whiteSpace: "normal", wordBreak: "break-all" }}>
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.path}</span>
                        </td>
                        <td style={TD}>{num(p.impressions)}</td>
                        <td style={TD}>{num(p.clicks)}</td>
                        <td style={TD}>
                          {/* A page we could not fetch has an UNKNOWN state. Rendering it as
                              zero levers would float it to the top of the work list on the
                              strength of a network timeout. */}
                          {p.fetch_error ? (
                            <span title={p.fetch_error} style={{ fontSize: 10, color: "#f43f5e" }}>fetch failed</span>
                          ) : (
                            <LeverStrip levers={p.levers} />
                          )}
                        </td>
                        <td style={{ ...TD, fontWeight: 800, color: p.levers_present == null ? "#475569" : p.levers_present >= 4 ? "#22c55e" : p.levers_present >= 2 ? "#e98d20" : "#f43f5e" }}>
                          {p.levers_present == null ? "—" : `${p.levers_present}/6`}
                        </td>
                        <td style={{ ...TD, color: "#64748b" }}>{p.signals ? num(p.signals.words) : "—"}</td>
                        <td style={TD}>
                          {isOpen ? <ChevronDown size={12} color="#64748b" /> : <ChevronRight size={12} color="#475569" />}
                        </td>
                      </motion.tr>

                      {isOpen && p.signals && (
                        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <td colSpan={7} style={{ padding: "0.9rem 0.6rem", background: "rgba(255,255,255,0.015)" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem", marginBottom: "0.85rem" }}>
                              {LEVER_ORDER.map(key => {
                                const v = p.levers.find(l => l.key === key)!;
                                const spec = data.levers.find(l => l.key === key)!;
                                const Icon = LEVER_ICON[key];
                                return (
                                  <div key={key} style={{ minWidth: 250, flex: 1, display: "flex", gap: "0.5rem" }}>
                                    <Icon size={13} color={v.present ? "#34d399" : "#334155"} />
                                    <div>
                                      <p style={{ fontSize: 11, fontWeight: 700, color: v.present ? "#e2e8f0" : "#64748b" }}>
                                        {spec.label}
                                        {spec.measured_lift && (
                                          <span style={{ marginLeft: 6 }}><Pill color="#22d3ee">{spec.measured_lift}</Pill></span>
                                        )}
                                      </p>
                                      <p style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>{v.detail}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
                              <div style={{ minWidth: 240, flex: 1 }}>
                                <p style={{ ...LABEL, fontSize: 9 }}>Cited domains</p>
                                <p style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>
                                  {p.signals.cited_domains.length ? p.signals.cited_domains.join(", ") : "none"}
                                </p>
                              </div>
                              <div style={{ minWidth: 240, flex: 1 }}>
                                <p style={{ ...LABEL, fontSize: 9 }}>Schema types</p>
                                <p style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {p.signals.schema_types.length ? p.signals.schema_types.join(", ") : "none"}
                                </p>
                              </div>
                              {p.signals.statistic_samples.length > 0 && (
                                <div style={{ minWidth: 280, flex: 2 }}>
                                  <p style={{ ...LABEL, fontSize: 9 }}>Quantitative claims found</p>
                                  <ul>
                                    {p.signals.statistic_samples.map(x => (
                                      <li key={x} style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5 }}>· {x}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {p.signals.answer_heading_samples.length > 0 && (
                                <div style={{ minWidth: 280, flex: 2 }}>
                                  <p style={{ ...LABEL, fontSize: 9 }}>Question-shaped headings</p>
                                  <ul>
                                    {p.signals.answer_heading_samples.map(x => (
                                      <li key={x} style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5 }}>· {x}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.75rem" }}>
                              <Link href={`/seo/pages?url=${encodeURIComponent(p.path)}`} style={{ fontSize: 10.5, color: "#38bdf8" }}>
                                Search & on-page detail →
                              </Link>
                              <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#64748b" }}>
                                Open page →
                              </a>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {s && s.fetch_failed > 0 && (
              <p style={{ fontSize: 10.5, color: "#e98d20", marginTop: "0.75rem" }}>
                {s.fetch_failed} page(s) could not be fetched. Those are left as unknown rather than scored zero — a
                timeout is not a missing lever.
              </p>
            )}
          </div>
        )}
      </Panel>

      {/* ── The work list ── */}
      <Panel
        title="What to do next"
        note={data ? `Derived from what was measured above, not transcribed from a plan — an item disappears when its check starts passing. ${totalHours}+ hours of work listed.` : undefined}
        right={<ListChecks size={13} color="#34d399" />}
      >
        {!data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Waiting on the audit…</p>
        ) : data.actions.length === 0 ? (
          <EmptyState reason="Every check on this screen is passing. That is not the same as being cited — off-site brand mentions are the remaining lever and nothing here can measure them." />
        ) : (
          ([1, 2, 3] as const).map(phase => {
            const items = byPhase(phase);
            if (items.length === 0) return null;
            const st = PHASE_STYLE[phase]!;
            return (
              <div key={phase} style={{ marginBottom: "1.1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  <Pill color={st.color}>Phase {phase}</Pill>
                  <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {items.map(a => (
                    <div key={a.id} style={{ ...CARD, borderLeft: `2px solid ${st.color}40` }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#e2e8f0" }}>{a.title}</span>
                        <span style={{ fontSize: 10, color: "#475569" }}>
                          {a.effort_hours[0] === a.effort_hours[1] ? `${a.effort_hours[0]}h` : `${a.effort_hours[0]}–${a.effort_hours[1]}h`}
                        </span>
                        {a.unverifiable_here && <Pill color="#64748b">not measurable here</Pill>}
                      </div>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "0.4rem 0 0", lineHeight: 1.6 }}>{a.why}</p>
                      <p style={{ fontSize: 10.5, color: "#64748b", margin: "0.35rem 0 0", lineHeight: 1.55 }}>
                        <strong style={{ color: "#475569" }}>Where:</strong> {a.where}
                      </p>
                      <p style={{ fontSize: 10.5, color: "#64748b", margin: "0.2rem 0 0", lineHeight: 1.55 }}>
                        <strong style={{ color: "#475569" }}>Measured:</strong> {a.evidence}
                      </p>
                      {a.pages.length > 0 && (
                        <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {a.pages.map(path => (
                            <Link key={path} href={`/seo/pages?url=${encodeURIComponent(path)}`}
                              style={{
                                fontSize: 9.5, color: "#38bdf8", textDecoration: "none",
                                background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)",
                                borderRadius: 6, padding: "0.1rem 0.4rem", wordBreak: "break-all",
                              }}>
                              {path}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Panel>

      {/* ── Sourcing ── */}
      {data && (
        <Panel
          title="The levers, and where the numbers come from"
          note="Every lift figure on this screen is attributed. None of them is multiplied by our revenue."
          right={<BookMarked size={13} color="#22d3ee" />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {LEVER_ORDER.map(key => {
              const l = data.levers.find(x => x.key === key)!;
              const Icon = LEVER_ICON[key];
              return (
                <div key={key} style={{ display: "flex", gap: "0.6rem" }}>
                  <Icon size={13} color="#475569" />
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: "#e2e8f0" }}>
                      {l.label}
                      <span style={{ marginLeft: 6 }}>
                        {l.measured_lift
                          ? <Pill color="#22d3ee">{l.measured_lift}</Pill>
                          // Absence of a figure is stated rather than left blank, so an
                          // unmeasured lever is not read as a weak one.
                          : <Pill color="#64748b">no published lift</Pill>}
                      </span>
                    </p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "0.2rem 0 0", lineHeight: 1.6 }}>{l.why}</p>
                    <p style={{ fontSize: 10, color: "#475569", margin: "0.15rem 0 0" }}>{l.source}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ── Reading this ── */}
      {data && (
        <Panel title="Reading this screen" right={<HelpCircle size={13} color="#64748b" />}>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {data.caveats.map(c => (
              <li key={c} style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, display: "flex", gap: "0.5rem" }}>
                <AlertTriangle size={12} color="#475569" style={{ flexShrink: 0, marginTop: 3 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/seo/opportunities" style={{ ...CARD, flex: 1, minWidth: 180, textDecoration: "none", display: "block", border: "1px solid rgba(244,63,94,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(244,63,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Target size={13} color="#f43f5e" />
            </div>
            <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>Opportunities</span>
          </div>
          <p style={{ fontSize: 10, color: "#475569" }}>The priced ledger — recoverable clicks, in dollars only where GA4 measures that page&apos;s own revenue</p>
        </Link>
        <Link href="/seo/pages" style={{ ...CARD, flex: 1, minWidth: 180, textDecoration: "none", display: "block", border: "1px solid rgba(56,189,248,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSearch size={13} color="#38bdf8" />
            </div>
            <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>Pages</span>
          </div>
          <p style={{ fontSize: 10, color: "#475569" }}>One URL at a time: search performance, CTR verdict against our own curve, on-page audit</p>
        </Link>
      </div>
    </div>
  );
}
