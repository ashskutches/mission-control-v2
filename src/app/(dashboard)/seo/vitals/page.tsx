"use client";
/**
 * SEO → Vitals
 *
 * Core Web Vitals across the pages that actually get seen — field data only.
 *
 * WHY THERE IS NO LIGHTHOUSE SCORE ON THIS SCREEN
 * ----------------------------------------------
 * The report that prompted this page priced "$65,076/year of CWV-suppressed ranking" off a
 * throttled Lighthouse lab run. On the article it flagged, the lab measured LCP 51,319ms.
 * Real Chrome users on that same page measured 1,301ms — FAST. Both flagged pages pass
 * Core Web Vitals in the field, which is the measurement page experience actually reads,
 * so the entire line was empty.
 *
 * The lab run is still useful — it is the only thing that tells you *why* a page is slow —
 * but it answers a different question and it is far too slow to run across a list. So it
 * lives one click away, per page, on the drill-down, and this screen shows only what real
 * users measured.
 *
 * ORDERED BY IMPRESSIONS, AND FAILURES ARE COUNTED IN IMPRESSIONS
 * --------------------------------------------------------------
 * A slow page nobody sees costs nothing. The summary reports failing pages *and* the
 * impressions behind them, because those two numbers routinely tell opposite stories.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Gauge, Zap, MousePointerClick, Eye, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Smartphone, Monitor, ArrowRight, HelpCircle,
} from "lucide-react";
import {
  BOT_URL, CARD, LABEL, TH, TD, MetricCard, Panel, EmptyState, num,
} from "@/components/MarketingShared";

// ── Types ─────────────────────────────────────────────────────────────────────

type Cat = "FAST" | "AVERAGE" | "SLOW" | null;
interface FieldMetric { percentile: number | null; category: Cat }
interface Field {
  scope: "url" | "origin";
  lcp_ms: FieldMetric; inp_ms: FieldMetric; cls: FieldMetric;
  fcp_ms: FieldMetric; ttfb_ms: FieldMetric;
  passes_cwv: boolean | null;
}
interface VitalsRow {
  url: string; path: string;
  clicks: number; impressions: number; position: number;
  field: Field | null; error: string | null;
}
interface VitalsResponse {
  period_days: number; strategy: "mobile" | "desktop"; pages_checked: number;
  summary: {
    measured: number; passing: number; failing: number;
    no_field_record: number; origin_fallback: number;
    failing_impressions: number; total_impressions: number;
  };
  pages: VitalsRow[];
  keyless: boolean;
  caveats: string[];
  fetched_at: string; cache_age_seconds: number;
  error?: string;
}

const CAT_COLOR: Record<string, string> = { FAST: "#22c55e", AVERAGE: "#e98d20", SLOW: "#f43f5e" };

/** CLS is a unitless ratio; everything else is milliseconds. */
function fmtMetric(m: FieldMetric | undefined, unit: "ms" | "ratio"): string {
  if (!m || m.percentile == null) return "—";
  return unit === "ratio" ? m.percentile.toFixed(3) : `${(m.percentile / 1000).toFixed(2)}s`;
}

function MetricCell({ m, unit }: { m: FieldMetric | undefined; unit: "ms" | "ratio" }) {
  const color = m?.category ? CAT_COLOR[m.category] : "#475569";
  return (
    <td style={{ ...TD, color, fontWeight: m?.category === "SLOW" ? 800 : 600 }}>
      {fmtMetric(m, unit)}
    </td>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeoVitalsPage() {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [data, setData] = useState<VitalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/seo/vitals?limit=20&strategy=${strategy}${fresh ? "&fresh=1" : ""}`);
      const json = (await res.json()) as VitalsResponse;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [strategy]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const failShare = s && s.total_impressions > 0
    ? (s.failing_impressions / s.total_impressions) * 100
    : null;

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {([
          { k: "mobile" as const, label: "Mobile", icon: Smartphone },
          { k: "desktop" as const, label: "Desktop", icon: Monitor },
        ]).map(({ k, label, icon: Icon }) => {
          const active = strategy === k;
          return (
            <button key={k} onClick={() => setStrategy(k)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: active ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.04)",
                color: active ? "#a78bfa" : "#64748b",
                border: active ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
              <Icon size={12} /> {label}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {data && (
            <span style={{ fontSize: 10, color: "#475569" }}>
              cached {Math.round(data.cache_age_seconds / 60)}m ago · CrUX updates daily
            </span>
          )}
          <button onClick={() => load(true)} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh vitals">
            <RefreshCw size={12} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason={`The vitals endpoint failed: ${error}.`} />
        </div>
      )}

      {data?.keyless && (
        <div style={{ marginBottom: "1.25rem" }}>
          <EmptyState reason="PAGESPEED_API_KEY is not set. The Chrome UX Report requires a key and returns nothing without one, so every row below will read as having no field record. The key is free from Google Cloud and is set in Railway — a local run is expected to look like this." />
        </div>
      )}

      {/* ── Headline ── */}
      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <MetricCard
          label="Passing CWV" icon={CheckCircle2} color="#22c55e"
          value={s ? `${s.passing} / ${s.measured}` : "—"} sub="Real Chrome users, 75th percentile"
        />
        <MetricCard
          label="Failing" icon={XCircle} color={s?.failing ? "#f43f5e" : "#22c55e"}
          value={s ? String(s.failing) : "—"}
          sub={s ? `${num(s.failing_impressions)} impressions behind them` : undefined}
        />
        <MetricCard
          label="Exposure at risk" icon={Eye} color="#e98d20"
          value={failShare != null ? `${failShare.toFixed(1)}%` : "—"}
          sub="Share of checked impressions on a failing page"
        />
        <MetricCard
          label="No field record" icon={Gauge} color="#64748b"
          value={s ? String(s.no_field_record) : "—"} sub="Too little traffic to measure — not slow"
        />
      </div>

      <p style={{ fontSize: 10.5, color: "#475569", marginBottom: "1.25rem", lineHeight: 1.55 }}>
        Field data — what real Chrome users measured over the trailing 28 days, which is what page experience reads.
        A Lighthouse lab score is a throttled simulation and routinely reads an order of magnitude worse; on our
        heaviest article it read LCP 51.3s against a field LCP of 1.3s. The lab run is a diagnostic and lives on
        each page&apos;s drill-down, not here.
      </p>

      {/* ── Table ── */}
      <Panel
        title="Most-seen pages"
        note="Ordered by impressions, because a slow page nobody sees costs nothing. Click a row's drill-down for the Lighthouse run and its opportunities list."
        right={<Zap size={13} color="#a78bfa" />}
      >
        {loading && !data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Looking up the field record for each page…</p>
        ) : !data ? (
          <EmptyState reason="Nothing returned. This needs Search Console for the page list and a PageSpeed API key for the field records." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Page</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>LCP</th>
                  <th style={TH}>INP</th>
                  <th style={TH}>CLS</th>
                  <th style={TH}>TTFB</th>
                  <th style={TH}>CWV</th>
                  <th style={TH} />
                </tr>
              </thead>
              <tbody>
                {data.pages.map((p, i) => (
                  <motion.tr
                    key={p.path}
                    initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td style={{ ...TD, textAlign: "left", maxWidth: 320, whiteSpace: "normal", wordBreak: "break-all" }}>
                      <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.path}</span>
                      {/* An origin-scoped row describes the site, not the page. Saying so
                          on the row is the only thing stopping a fast site from vouching
                          for a slow page. */}
                      {p.field?.scope === "origin" && (
                        <span style={{
                          marginLeft: 6, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.05em", background: "rgba(233,141,32,0.12)", color: "#e98d20",
                          borderRadius: 20, padding: "0.05rem 0.4rem",
                        }}>
                          site-wide record
                        </span>
                      )}
                    </td>
                    <td style={TD}>{num(p.impressions)}</td>
                    <td style={TD}>{num(p.clicks)}</td>
                    <MetricCell m={p.field?.lcp_ms} unit="ms" />
                    <MetricCell m={p.field?.inp_ms} unit="ms" />
                    <MetricCell m={p.field?.cls} unit="ratio" />
                    <MetricCell m={p.field?.ttfb_ms} unit="ms" />
                    <td style={TD}>
                      {p.field?.passes_cwv == null ? (
                        <span style={{ fontSize: 10, color: "#475569" }}>{p.error ? "error" : "no record"}</span>
                      ) : p.field.passes_cwv ? (
                        <CheckCircle2 size={14} color="#22c55e" />
                      ) : (
                        <XCircle size={14} color="#f43f5e" />
                      )}
                    </td>
                    <td style={TD}>
                      <Link
                        href={`/seo/pages?url=${encodeURIComponent(p.path)}`}
                        style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center" }}
                        aria-label={`Open drill-down for ${p.path}`}
                      >
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Reading this ── */}
      {data && (
        <Panel title="Reading this table" right={<HelpCircle size={13} color="#64748b" />}>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            {[
              { l: "LCP", d: "Largest Contentful Paint — FAST ≤ 2.5s", c: "#22c55e" },
              { l: "INP", d: "Interaction to Next Paint — FAST ≤ 200ms", c: "#38bdf8" },
              { l: "CLS", d: "Cumulative Layout Shift — FAST ≤ 0.1", c: "#a78bfa" },
              { l: "TTFB", d: "Time to First Byte — FAST ≤ 0.8s", c: "#e98d20" },
            ].map(({ l, d, c }) => (
              <div key={l} style={{ minWidth: 190 }}>
                <p style={{ ...LABEL, fontSize: 9, color: c }}>{l}</p>
                <p style={{ fontSize: 11, color: "#64748b" }}>{d}</p>
              </div>
            ))}
          </div>
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
        <Link href="/seo/opportunities" style={{ ...CARD, flex: 1, minWidth: 160, textDecoration: "none", display: "block", border: "1px solid rgba(52,211,153,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MousePointerClick size={13} color="#34d399" />
            </div>
            <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>Opportunities</span>
          </div>
          <p style={{ fontSize: 10, color: "#475569" }}>Recoverable clicks, ranked and priced where measurable</p>
        </Link>
      </div>
    </div>
  );
}
