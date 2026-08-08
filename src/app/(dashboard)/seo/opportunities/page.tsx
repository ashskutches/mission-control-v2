"use client";
/**
 * SEO → Opportunities
 *
 * One ranked list of where organic search is leaving clicks, and what those clicks are
 * worth on the pages we can actually measure.
 *
 * WHAT THIS SCREEN IS ANSWERING, AND WHAT IT REFUSES TO
 * ----------------------------------------------------
 * The agent report this was built from led with "$127,644/year of opportunity", assembled
 * from an industry CTR benchmark, a throttled Lighthouse score, and GA4 zeros that were an
 * artefact of Shopify's checkout URL. Each line multiplied a real number by a rate nobody
 * had measured here.
 *
 * So this page separates the two halves and shows both:
 *
 *   CLICKS   — always shown, for every page. Measured against our own CTR-by-position
 *              curve, and split into the snippet gap (winnable at today's rank) and the
 *              rank gap (not winnable by rewriting anything).
 *   DOLLARS  — shown only for pages GA4 credits same-session purchase revenue to, on
 *              enough landing sessions to divide. Everything else says "unpriced", and
 *              unpriced pages are counted in the header rather than quietly dropped or
 *              quietly filled in from a site average.
 *
 * The headline total is therefore smaller than the ledger's real value, and says so. That
 * is the intended failure direction.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MousePointerClick, DollarSign, FileSearch, RefreshCw, Pencil, TrendingUp,
  AlertTriangle, ArrowRight, HelpCircle,
} from "lucide-react";
import {
  BOT_URL, CARD, LABEL, TH, TD, MetricCard, Panel, EmptyState,
  money, num, pct,
} from "@/components/MarketingShared";

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict = "rank_limited" | "snippet_limited" | "performing" | "unmeasurable";

interface LedgerItem {
  url: string; path: string;
  clicks: number; impressions: number; position: number; ctr_pct: number;
  verdict: Verdict; explanation: string; band_label: string | null;
  snippet_gap_clicks: number; rank_gap_clicks: number; total_gap_clicks: number;
  value_per_session: number | null; value_basis: string;
  est_revenue: number | null;
  landing: { revenue: number; transactions: number; sessions: number } | null;
}

interface LedgerTotals {
  pages_considered: number; pages_below_floor: number; pages_with_gap: number;
  snippet_gap_clicks: number; rank_gap_clicks: number; total_gap_clicks: number;
  pages_priced: number; pages_unpriced: number;
  measured_revenue_in_window: number; annualized_if_sustained: number;
  period_days: number;
}

interface LedgerResponse {
  period_days: number; min_impressions: number; min_sessions_for_value: number;
  items: LedgerItem[]; items_returned: number;
  totals: LedgerTotals; caveats: string[]; method: string;
  landing_totals: { revenue: number; transactions: number; pages_with_revenue: number } | null;
  warnings: string[];
  property_truncated: boolean;
  fetched_at: string; cache_age_seconds: number;
  error?: string;
}

const WINDOWS = [28, 90] as const;
type Win = (typeof WINDOWS)[number];

const VERDICT_STYLE: Record<Verdict, { color: string; label: string }> = {
  snippet_limited: { color: "#e98d20", label: "Snippet" },
  rank_limited: { color: "#38bdf8", label: "Rank" },
  performing: { color: "#22c55e", label: "Performing" },
  unmeasurable: { color: "#64748b", label: "Unmeasured" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeoOpportunitiesPage() {
  const [days, setDays] = useState<Win>(28);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [lever, setLever] = useState<"all" | "snippet" | "rank">("all");

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BOT_URL}/admin/seo/opportunities?days=${days}&limit=100${fresh ? "&fresh=1" : ""}`
      );
      const json = (await res.json()) as LedgerResponse;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (lever === "snippet") {
      // Sorted by the snippet gap specifically — this is the "what can I ship today"
      // filter, and ordering it by the total would float rank-limited pages to the top.
      return [...all].filter(i => i.snippet_gap_clicks > 0).sort((a, b) => b.snippet_gap_clicks - a.snippet_gap_clicks);
    }
    if (lever === "rank") {
      return [...all].filter(i => i.rank_gap_clicks > 0).sort((a, b) => b.rank_gap_clicks - a.rank_gap_clicks);
    }
    return all;
  }, [data, lever]);

  const t = data?.totals;

  return (
    <div>
      {/* ── Controls ── */}
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
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {data && (
            <span style={{ fontSize: 10, color: "#475569" }}>
              cached {Math.round(data.cache_age_seconds / 60)}m ago
            </span>
          )}
          <button onClick={() => load(true)} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh ledger">
            <RefreshCw size={12} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason={`The ledger endpoint failed: ${error}. It needs Search Console; without GA4 it still returns clicks.`} />
        </div>
      )}

      {/* ── Headline ── */}
      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <MetricCard
          label="Recoverable clicks" icon={MousePointerClick} color="#34d399"
          value={num(t?.total_gap_clicks)} sub={`${days} days, across ${num(t?.pages_with_gap)} pages`}
        />
        <MetricCard
          label="Snippet gap" icon={Pencil} color="#e98d20"
          value={num(t?.snippet_gap_clicks)} sub="Winnable at today's rank"
        />
        <MetricCard
          label="Rank gap" icon={TrendingUp} color="#38bdf8"
          value={num(t?.rank_gap_clicks)} sub="Only by ranking better"
        />
        <MetricCard
          label="Measured value" icon={DollarSign} color="#22c55e"
          value={t ? money(t.measured_revenue_in_window) : "—"}
          sub={t ? `${t.pages_priced} of ${t.pages_with_gap} pages priced` : undefined}
          unavailable={t && t.pages_priced === 0 ? "No page had measurable revenue per session" : null}
        />
      </div>

      {/* The sentence the report needed and did not have. */}
      {t && (
        <div style={{
          ...CARD, marginBottom: "1.25rem",
          border: "1px solid rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.03)",
        }}>
          <p style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6 }}>
            <strong style={{ color: "#22c55e" }}>{money(t.measured_revenue_in_window)}</strong> over {days} days
            {" "}({money(t.annualized_if_sustained)} annualised) is what the recoverable clicks are worth
            {" "}<em>on the {t.pages_priced} page{t.pages_priced === 1 ? "" : "s"} GA4 can price</em>.
            {t.pages_unpriced > 0 && (
              <> The other <strong style={{ color: "#e98d20" }}>{t.pages_unpriced}</strong> pages with a real click
              gap carry no dollar figure — GA4 credits them no same-session purchase revenue, or too few sessions to
              divide by. Their clicks are counted above; their dollars are in nobody&apos;s total.</>
            )}
          </p>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.55, marginTop: "0.5rem" }}>
            The annualised figure assumes this window&apos;s rank, demand and conversion rate hold for twelve months.
            None of those is measured here, and rebounder demand is seasonal — the {days}-day number is the
            measurement, the annual one is an if.
          </p>
        </div>
      )}

      {data?.warnings?.map(w => (
        <div key={w} style={{ marginBottom: "0.75rem" }}>
          <EmptyState reason={w} />
        </div>
      ))}

      {/* ── Lever filter ── */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {([
          { k: "all", label: "Everything", color: "#94a3b8" },
          { k: "snippet", label: "Ship today — snippet", color: "#e98d20" },
          { k: "rank", label: "Ranking work", color: "#38bdf8" },
        ] as const).map(({ k, label, color }) => {
          const active = lever === k;
          return (
            <button key={k} onClick={() => setLever(k)}
              style={{
                background: active ? `${color}18` : "rgba(255,255,255,0.04)",
                color: active ? color : "#64748b",
                border: active ? `1px solid ${color}35` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
                fontSize: 11, fontWeight: 700,
              }}>
              {label}
            </button>
          );
        })}
        <span style={{ fontSize: 10.5, color: "#475569", marginLeft: "auto" }}>
          {items.length} page{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* ── Ledger ── */}
      <Panel
        title="Where the clicks are"
        note={data?.method ?? "Every URL Search Console reported impressions for, assessed against our own CTR curve at the same rank."}
      >
        {loading && !data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Reading the whole property from Google — the first load is slow…</p>
        ) : !data ? (
          <EmptyState reason="Nothing returned. Check Feed status on the SEO dashboard — this needs Search Console at minimum." />
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12, color: "#475569" }}>
            No page above {num(data.min_impressions)} impressions has a measurable gap in this window under this filter.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Page</th>
                  <th style={TH}>Pos</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>Snippet</th>
                  <th style={TH}>Rank</th>
                  <th style={TH}>Total</th>
                  <th style={TH}>Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => {
                  const v = VERDICT_STYLE[i.verdict];
                  const isOpen = open === i.path;
                  return (
                    <React.Fragment key={i.path}>
                      <motion.tr
                        initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 20) * 0.015 }}
                        onClick={() => setOpen(isOpen ? null : i.path)}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: isOpen ? "rgba(255,255,255,0.02)" : undefined }}
                      >
                        <td style={{ ...TD, textAlign: "left", maxWidth: 340, whiteSpace: "normal", wordBreak: "break-all" }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            background: `${v.color}14`, color: v.color, borderRadius: 20,
                            padding: "0.05rem 0.4rem", marginRight: 6,
                          }}>
                            {v.label}
                          </span>
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{i.path}</span>
                        </td>
                        <td style={TD}>{i.position.toFixed(1)}</td>
                        <td style={TD}>{num(i.impressions)}</td>
                        <td style={TD}>{num(i.clicks)}</td>
                        <td style={{ ...TD, color: i.snippet_gap_clicks > 0 ? "#e98d20" : "#475569" }}>
                          {i.snippet_gap_clicks > 0 ? `+${num(i.snippet_gap_clicks)}` : "—"}
                        </td>
                        <td style={{ ...TD, color: i.rank_gap_clicks > 0 ? "#38bdf8" : "#475569" }}>
                          {i.rank_gap_clicks > 0 ? `+${num(i.rank_gap_clicks)}` : "—"}
                        </td>
                        <td style={{ ...TD, fontWeight: 800, color: "#e2e8f0" }}>+{num(i.total_gap_clicks)}</td>
                        <td style={{ ...TD, color: i.est_revenue != null ? "#22c55e" : "#475569" }}>
                          {i.est_revenue != null ? money(i.est_revenue) : "unpriced"}
                        </td>
                      </motion.tr>

                      {isOpen && (
                        <tr style={{ background: "rgba(0,0,0,0.18)" }}>
                          <td colSpan={8} style={{ padding: "0.85rem 0.75rem" }}>
                            <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6, marginBottom: "0.6rem" }}>
                              {i.explanation}
                            </p>
                            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.55, marginBottom: "0.6rem" }}>
                              <DollarSign size={10} style={{ display: "inline", marginRight: 3 }} />
                              {i.value_basis}
                            </p>
                            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                              {[
                                { l: "CTR now", v: pct(i.ctr_pct, 2) },
                                { l: "Band", v: i.band_label ?? "—" },
                                { l: "Value / session", v: i.value_per_session != null ? money(i.value_per_session, 2) : "—" },
                                { l: "Landing sessions", v: i.landing ? num(i.landing.sessions) : "—" },
                                { l: "Landing revenue", v: i.landing ? money(i.landing.revenue) : "—" },
                              ].map(({ l, v }) => (
                                <div key={l}>
                                  <p style={{ ...LABEL, fontSize: 9 }}>{l}</p>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{v}</p>
                                </div>
                              ))}
                            </div>
                            <Link
                              href={`/seo/pages?url=${encodeURIComponent(i.path)}&days=${days}`}
                              style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              Open the drill-down <ArrowRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── How this is built ── */}
      {data && (
        <Panel
          title="How these numbers are built"
          note="Read once. Every figure above is a consequence of these four rules."
          right={<HelpCircle size={13} color="#64748b" />}
        >
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {data.caveats.map(c => (
              <li key={c} style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, display: "flex", gap: "0.5rem" }}>
                <AlertTriangle size={12} color="#475569" style={{ flexShrink: 0, marginTop: 3 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 10.5, color: "#475569", marginTop: "0.85rem", lineHeight: 1.55 }}>
            Pages need {num(data.min_impressions)}+ impressions to be assessed
            ({num(data.totals.pages_below_floor)} fell below that) and {data.min_sessions_for_value}+ landing sessions
            before revenue per session is divided.
            {data.property_truncated && " Search Console truncated the property read — totals are a floor."}
            {data.landing_totals && ` GA4 credits ${money(data.landing_totals.revenue)} of same-session purchase revenue across ${num(data.landing_totals.pages_with_revenue)} landing pages in this window.`}
          </p>
        </Panel>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {[
          { href: "/seo/pages", label: "Pages", icon: FileSearch, color: "#38bdf8", sub: "Per-URL drill-down" },
          { href: "/seo/vitals", label: "Vitals", icon: TrendingUp, color: "#a78bfa", sub: "Field CWV, most-seen pages" },
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
  );
}
