"use client";
/**
 * Profit — the P&L, per-platform paid performance, per-product margin, scorecard.
 *
 * Lives as a component rather than a page because it renders in two places: the
 * Profitability tab of Command Center (`/`), and its own route at `/profitability`
 * so existing deep links keep working. The two differ only in which query
 * parameter carries the inner dashboard/costs tab — see `subTabParam`.
 *
 * DESIGN RULE THIS COMPONENT ENFORCES
 * -----------------------------------
 * The API returns three states per figure: measured, estimated, unavailable. This
 * page renders all three distinctly and never fills an unavailable figure with a
 * placeholder number. When gross margin is withheld because unit-cost coverage is
 * too thin, the hero says so and points at the fix — it does not show a margin.
 *
 * That is not a degraded state to design around; on 2026-07-28 it was the real
 * state of the business (4.0% cost coverage), so it is the state the page must be
 * best at communicating.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiggyBank, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Target,
  DollarSign, Package, Megaphone, ChevronRight, Check, Loader2,
  ArrowRight, Info, SlidersHorizontal, BarChart3, Wrench,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Palette ───────────────────────────────────────────────────────────────────
// Status colours are reserved and never reused for a series. Channel hues are
// stepped for the dark surface so adjacent pairs stay separable for CVD readers.
const GOOD = "#22c55e", WARN = "#f59e0b", CRIT = "#f43f5e", BRAND = "#e98d20";
const CHANNEL_COLOR: Record<string, string> = {
  meta: "#3d82db", google: "#c97818", other: "#8b6ee8",
};
const STATUS_COLOR: Record<string, string> = {
  healthy: GOOD, warning: WARN, critical: CRIT, unrated: "#6b7280", no_data: "#3f3f46",
};

/** The healthy ROAS threshold from metric_registry. Shared by the platform bars
 *  and the campaign drill-down so the two never disagree about what "target" is. */
const TARGET_ROAS = 2.8;

// ── Types ────────────────────────────────────────────────────────────────────
interface PnlLine {
  key: string; label: string; amount: number | null; pctOfNet: number | null;
  status: "measured" | "estimated" | "unavailable"; basis: string;
  subtotal: boolean; blockedBy?: string;
}
interface Blocker { code: string; message: string; fix: string; severity: "critical" | "warning" }
interface Pacing {
  target: number; targetBasis: string; actual: number;
  dayOfQuarter: number; daysInQuarter: number; onPaceRevenue: number;
  varianceToPace: number; pctOfTarget: number; projectedTotal: number;
  requiredPerDay: number; actualPerDay: number;
}
interface PnlResponse {
  period: { start: string; end: string; label: string };
  coverageFloor: number;
  summary: {
    netRevenue: number; grossProfit: number | null; grossMarginPct: number | null;
    contributionMargin: number | null; contributionMarginPct: number | null;
    netProfit: number | null; netMarginPct: number | null;
    orders: number; aov: number; mer: number | null; cac: number | null;
    newCustomers: number; cogsCoverage: number; coverageSufficient: boolean; adSpend: number;
  };
  lines: PnlLine[]; pacing: Pacing | null; blockers: Blocker[];
  crossCheck: { tripleWhale: { roas: number | null; spend: number | null } | null; attributedRevenue: number; note: string };
}
interface Channel {
  channel: string; spend: number; impressions: number; clicks: number;
  conversions: number; revenue: number; cpm: number | null; cpc: number | null;
  ctr: number | null; costPerConversion: number | null; attributedRoas: number | null;
  daysMissing: number;
}
interface ProductRow {
  variantId: string | null; sku: string; title: string; variantTitle: string;
  unitPrice: number; unitCost: number | null; costSource: string;
  quantity: number; revenue: number; cogs: number | null;
  grossProfit: number | null; marginPct: number | null; excludedBy: string | null;
}
interface Metric {
  key: string; label: string; unit: string; value: number | null; status: string;
  benchmarkLow: number | null; benchmarkHigh: number | null; confidence: string | null;
  valueBasis: string | null; delta: number | null; series: number[];
  notes: string | null; impact: string; dimensionedOnly: boolean;
  grain: string; periodStart: string | null; periodEnd: string | null;
}
interface Lever {
  key: string; title: string; mechanism: string; quarterlyValue: number | null;
  status: string; blockedBy?: string; basis: string;
}
interface Assumption {
  key: string; label: string; category: string; value: number; unit: string;
  basis: string; notes: string | null; configured: boolean; sortOrder: number;
}
interface VariantCost {
  variantId: string; sku: string; productTitle: string; variantTitle: string;
  unitCost: number | null; price: number | null; source: string;
}

// ── Formatters ────────────────────────────────────────────────────────────────
const money = (n: number | null | undefined, dp = 0) =>
  n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const pctStr = (n: number | null | undefined, dp = 1) => n == null ? "—" : `${n.toFixed(dp)}%`;
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

const fmtMetric = (m: Metric) =>
  m.value == null ? "—"
    : m.unit === "usd" ? money(m.value, m.value < 100 ? 2 : 0)
    : m.unit === "percent" ? `${m.value.toFixed(1)}%`
    : m.unit === "ratio" ? `${m.value.toFixed(2)}×`
    : m.unit === "days" ? `${m.value.toFixed(1)}d`
    : m.value.toFixed(2);

// ── Shared shells ─────────────────────────────────────────────────────────────
function Panel({ title, right, children, accent }: {
  title: string; right?: React.ReactNode; children: React.ReactNode; accent?: string;
}) {
  return (
    <section style={{
      background: "var(--bg-card)", border: `1px solid ${accent ?? "var(--glass-border)"}`,
      borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.35)", overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap",
        padding: ".8rem 1.05rem", borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        <h2 style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: ".5rem" }}>{right}</div>
      </header>
      <div style={{ padding: "1rem 1.05rem" }}>{children}</div>
    </section>
  );
}

function Pill({ tone, children }: { tone: "good" | "warn" | "crit" | "off"; children: React.ReactNode }) {
  const c = tone === "good" ? GOOD : tone === "warn" ? WARN : tone === "crit" ? CRIT : "#6b7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800,
      letterSpacing: ".05em", textTransform: "uppercase", borderRadius: 5, padding: "2px 6px",
      color: c, background: `${c}1f`, border: `1px solid ${c}44`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

/** Provenance chip. The whole point of the page is that this is never absent. */
function Src({ status }: { status: PnlLine["status"] }) {
  const map = {
    measured:    { label: "measured",  c: "#8fd3a6", bg: "rgba(34,197,94,.10)" },
    estimated:   { label: "estimate",  c: "#e3b872", bg: "rgba(245,158,11,.11)" },
    unavailable: { label: "no data",   c: "#eb8a99", bg: "rgba(244,63,94,.11)" },
  }[status];
  return (
    <span style={{
      fontFamily: "var(--mono, 'JetBrains Mono', monospace)", fontSize: 9.5,
      borderRadius: 4, padding: "1px 5px", color: map.c, background: map.bg, whiteSpace: "nowrap",
    }}>{map.label}</span>
  );
}

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen(o => !o)} onBlur={() => setOpen(false)}
        aria-label="Where this number comes from"
        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 2 }}>
        <Info size={11} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)",
              width: 280, zIndex: 30, background: "#101012", border: "1px solid var(--glass-border)",
              borderRadius: 8, padding: ".5rem .6rem", fontSize: 11, lineHeight: 1.5,
              color: "var(--text-secondary)", boxShadow: "0 8px 24px rgba(0,0,0,.6)",
            }}>{text}</motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Blockers: the most important thing on the page when coverage is thin ───────
function BlockerBanner({ blockers, onGoToCosts }: { blockers: Blocker[]; onGoToCosts: () => void }) {
  const criticals = blockers.filter(b => b.severity === "critical");
  const warnings  = blockers.filter(b => b.severity === "warning");
  if (!blockers.length) return null;

  return (
    <div style={{
      background: criticals.length ? "rgba(244,63,94,.06)" : "rgba(245,158,11,.05)",
      border: `1px solid ${criticals.length ? "rgba(244,63,94,.28)" : "rgba(245,158,11,.24)"}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: ".8rem 1.05rem", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
        <AlertTriangle size={14} color={criticals.length ? CRIT : WARN} />
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: criticals.length ? CRIT : WARN }}>
          {criticals.length > 0
            ? `${criticals.length} thing${criticals.length > 1 ? "s" : ""} must be fixed before these numbers mean anything`
            : `${warnings.length} caveat${warnings.length > 1 ? "s" : ""} on the figures below`}
        </p>
        {criticals.length > 0 && (
          <button onClick={onGoToCosts} style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
            background: `${CRIT}1f`, border: `1px solid ${CRIT}55`, color: CRIT,
            borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>Fix now <ArrowRight size={11} /></button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {[...criticals, ...warnings].map((b, i) => (
          <div key={b.code + i} style={{ padding: ".65rem 1.05rem", borderTop: i ? "1px solid rgba(255,255,255,.04)" : undefined }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.5 }}>
              <Pill tone={b.severity === "critical" ? "crit" : "warn"}>{b.severity}</Pill>{" "}{b.message}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>→ {b.fix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Verdict ───────────────────────────────────────────────────────────────────
function Verdict({ data, onGoToCosts }: { data: PnlResponse; onGoToCosts: () => void }) {
  const s = data.summary;
  const netKnown = s.netProfit != null;
  const heroColor = !netKnown ? "var(--text-muted)" : s.netProfit! >= 0 ? GOOD : CRIT;

  return (
    <Panel
      title="Are we profitable?"
      right={netKnown
        ? <Pill tone={s.netProfit! >= 0 ? "good" : "crit"}>{s.netProfit! >= 0 ? "Yes" : "Not yet"}</Pill>
        : <Pill tone="off">Can&apos;t tell yet</Pill>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.1fr) minmax(260px, 1fr)", gap: "1.1rem" }}>
        {/* Hero */}
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, margin: 0 }}>
            Net profit · {data.period.label.toLowerCase()}
          </p>

          {netKnown ? (
            <>
              <p style={{
                fontFamily: "var(--mono, 'JetBrains Mono', monospace)", fontVariantNumeric: "tabular-nums",
                fontSize: "clamp(2.2rem, 6vw, 3.1rem)", fontWeight: 700, lineHeight: 1.03,
                letterSpacing: "-.03em", color: heroColor, margin: "2px 0 0",
              }}>{money(s.netProfit)}</p>
              <p style={{ fontSize: "1.05rem", fontWeight: 700, color: heroColor, margin: 0, fontFamily: "var(--mono, monospace)" }}>
                {pctStr(s.netMarginPct)} net margin
              </p>
            </>
          ) : (
            <div style={{
              marginTop: ".5rem", background: "rgba(255,255,255,.03)",
              border: "1px dashed rgba(255,255,255,.12)", borderRadius: 12, padding: ".85rem .95rem",
            }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                Not measurable yet — and that is the honest answer.
              </p>
              <p style={{ margin: ".4rem 0 0", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {s.coverageSufficient
                  ? "Revenue and costs are in, but overhead has never been entered. Without it, subtracting zero would report contribution margin as profit."
                  : `Only ${(s.cogsCoverage * 100).toFixed(1)}% of revenue has a known unit cost, so there is no trustworthy gross margin to build a profit figure on.`}
              </p>
              <button onClick={onGoToCosts} style={{
                marginTop: ".65rem", display: "inline-flex", alignItems: "center", gap: 5,
                background: `${BRAND}22`, border: `1px solid ${BRAND}55`, color: BRAND,
                borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              }}><Wrench size={11} /> Enter the missing costs</button>
            </div>
          )}

          {/* What IS known */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: ".5rem", marginTop: ".9rem" }}>
            {[
              { label: "Net revenue", value: money(s.netRevenue), sub: `${s.orders} orders`, color: undefined as string | undefined },
              { label: "AOV", value: money(s.aov, 2), sub: "per order", color: undefined },
              {
                label: "Gross margin",
                value: s.grossMarginPct != null ? pctStr(s.grossMarginPct) : "withheld",
                sub: s.grossMarginPct != null ? "healthy ≥ 48%" : `${(s.cogsCoverage * 100).toFixed(1)}% cost coverage`,
                color: s.grossMarginPct == null ? "var(--text-dim)" : s.grossMarginPct >= 48 ? GOOD : WARN,
              },
              {
                label: "MER",
                value: s.mer != null ? `${s.mer.toFixed(2)}×` : "—",
                sub: s.adSpend > 0 ? `on ${money(s.adSpend)} spend` : "no ad spend recorded",
                color: undefined,
              },
            ].map(t => (
              <div key={t.label} style={{
                background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 10, padding: ".55rem .7rem",
              }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-dim)", margin: 0 }}>{t.label}</p>
                <p style={{
                  fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
                  fontSize: "1.02rem", fontWeight: 700, margin: "2px 0 0",
                  color: t.color ?? "var(--text-primary)",
                }}>{t.value}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "1px 0 0" }}>{t.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pacing */}
        {data.pacing ? <PacingCard p={data.pacing} /> : (
          <div style={{
            background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 12, padding: ".95rem 1rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.55 }}>
              Pacing shows on the quarter-to-date view.<br />
              A 7- or 30-day window can&apos;t be paced against a quarterly target.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function PacingCard({ p }: { p: Pacing }) {
  const behind = p.varianceToPace < 0;
  const pacePos = Math.min(100, (p.dayOfQuarter / p.daysInQuarter) * 100);
  const fillPos = Math.min(100, Math.max(0, p.pctOfTarget));

  return (
    <div style={{
      background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.06)",
      borderRadius: 12, padding: ".95rem 1rem", display: "flex", flexDirection: "column", gap: ".55rem",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: ".5rem" }}>
        <p style={{ fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums", fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
          {money(p.actual)}
        </p>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono, monospace)" }}>
          of {money(p.target)}
          <Tip text={`Target basis: ${p.targetBasis}`} />
        </span>
      </div>

      <div style={{ position: "relative", height: 26, marginTop: 14, borderRadius: 7, background: "rgba(255,255,255,.05)" }}>
        <div style={{
          position: "absolute", inset: "0 auto 0 0", width: `${fillPos}%`,
          borderRadius: "7px 3px 3px 7px", background: `linear-gradient(90deg, #c97818, ${BRAND})`,
        }} />
        <div style={{ position: "absolute", top: -4, bottom: -4, left: `${pacePos}%`, width: 2, background: "var(--text-secondary)" }}>
          <span style={{
            position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)",
            fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
            color: "var(--text-secondary)", whiteSpace: "nowrap",
          }}>on pace</span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem 1rem", fontSize: 11, color: "var(--text-muted)" }}>
        <span>Day <b style={{ color: "var(--text-primary)", fontFamily: "var(--mono, monospace)" }}>{p.dayOfQuarter}</b> of {p.daysInQuarter}</span>
        <span>{behind ? "Behind by" : "Ahead by"} <b style={{ color: behind ? CRIT : GOOD, fontFamily: "var(--mono, monospace)" }}>{money(Math.abs(p.varianceToPace))}</b></span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem 1rem", fontSize: 11, color: "var(--text-muted)", borderTop: "1px dashed rgba(255,255,255,.07)", paddingTop: ".5rem" }}>
        <span>Projecting <b style={{ color: "var(--text-primary)", fontFamily: "var(--mono, monospace)" }}>{money(p.projectedTotal)}</b></span>
        <span>Needs <b style={{ color: "var(--text-primary)", fontFamily: "var(--mono, monospace)" }}>{money(p.requiredPerDay)}</b>/day</span>
        <span>Running <b style={{ color: "var(--text-primary)", fontFamily: "var(--mono, monospace)" }}>{money(p.actualPerDay)}</b>/day</span>
      </div>
    </div>
  );
}

// ── Waterfall ─────────────────────────────────────────────────────────────────
function Waterfall({ lines, netRevenue }: { lines: PnlLine[]; netRevenue: number }) {
  const scale = Math.max(netRevenue, ...lines.map(l => Math.abs(l.amount ?? 0)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {lines.map(l => {
        const isTotal = l.key === "net_profit";
        const w = l.amount != null ? Math.min(100, (Math.abs(l.amount) / scale) * 100) : 0;

        // A withheld total must never wear a verdict colour. Green on a null net
        // profit reads as "profitable"; red reads as "losing money". Both are
        // claims the data does not support, so an unknown total stays neutral.
        const totalTone = !isTotal || l.amount == null ? null : l.amount < 0 ? CRIT : GOOD;

        const barColor = l.amount == null ? "transparent"
          : totalTone ?? (l.subtotal ? BRAND : "rgba(255,255,255,.09)");

        return (
          <div key={l.key} style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1.4fr) minmax(0, 2.6fr) 104px 62px 72px",
            alignItems: "center", gap: ".65rem", padding: ".3rem .4rem", borderRadius: 7,
            background: totalTone ? `${totalTone}12` : l.subtotal ? "var(--bg-elevated)" : undefined,
            boxShadow: totalTone ? `inset 0 0 0 1px ${totalTone}38`
              : isTotal ? "inset 0 0 0 1px rgba(255,255,255,.08)" : undefined,
          }}>
            <span style={{
              fontSize: 12.5, display: "flex", alignItems: "center", gap: 4,
              color: totalTone ?? (l.subtotal ? "var(--text-primary)" : "var(--text-secondary)"),
              fontWeight: l.subtotal ? 800 : 400,
            }}>
              {l.label}
              <Tip text={l.basis + (l.blockedBy ? `\n\nBlocked: ${l.blockedBy}` : "")} />
            </span>

            <span style={{ height: 13, borderRadius: "0 4px 4px 0", background: barColor, width: `${w}%`, display: "block" }} />

            <span style={{
              fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
              fontSize: isTotal ? 14 : 12.5, textAlign: "right",
              fontWeight: l.subtotal ? 700 : 400,
              color: l.amount == null ? "var(--text-dim)"
                : totalTone ?? (l.subtotal ? "var(--text-primary)" : "var(--text-secondary)"),
            }}>{l.amount == null ? "no data" : money(l.amount)}</span>

            <span style={{ fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums", fontSize: 11, textAlign: "right", color: "var(--text-dim)" }}>
              {l.pctOfNet != null ? `${l.pctOfNet.toFixed(1)}%` : "—"}
            </span>

            <span style={{ textAlign: "right" }}><Src status={l.status} /></span>
          </div>
        );
      })}
    </div>
  );
}

// ── Platforms ─────────────────────────────────────────────────────────────────
function Platforms({ period, nonce }: { period: string; nonce: number }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BOT_URL}/admin/profitability/platforms?period=${period}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then(j => alive && setD(j)).catch(e => alive && setErr(e.message));
    return () => { alive = false; };
  }, [period, nonce]);

  if (err) return <Panel title="Paid traffic by platform"><p style={{ color: CRIT, fontSize: 12 }}>{err}</p></Panel>;
  if (!d)  return <Panel title="Paid traffic by platform"><Skeleton rows={3} /></Panel>;

  const channels: Channel[] = d.channels ?? [];
  const maxRoas = Math.max(TARGET_ROAS * 1.25, ...channels.map(c => c.attributedRoas ?? 0));

  return (
    <Panel title="Paid traffic by platform" right={
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>attributed revenue ÷ spend</span>
    }>
      {channels.length === 0 ? (
        <div style={{ background: "rgba(244,63,94,.05)", border: "1px solid rgba(244,63,94,.2)", borderRadius: 10, padding: ".8rem .95rem" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-primary)", fontWeight: 700 }}>No ad platform returned data for this window.</p>
          <p style={{ margin: ".3rem 0 0", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Ad spend is treated as <strong>unknown</strong>, not as zero — zero would flatter every efficiency ratio that divides by it.
            Run a collection, or check that Meta and Google are still authorised.
          </p>
        </div>
      ) : (
        <>
          {/* ROAS vs target */}
          <div style={{ position: "relative", paddingTop: 14, marginBottom: ".9rem" }}>
            <div style={{ position: "absolute", top: 0, left: "calc(88px + .65rem)", right: 0, height: 14 }}>
              <span style={{
                position: "absolute", left: `${(TARGET_ROAS / maxRoas) * 100}%`, transform: "translateX(-50%)",
                fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                color: "var(--text-muted)", whiteSpace: "nowrap",
              }}>target {TARGET_ROAS}×</span>
            </div>
            {channels.map(c => {
              const roas = c.attributedRoas;
              const w = roas != null ? Math.min(100, (roas / maxRoas) * 100) : 0;
              const col = CHANNEL_COLOR[c.channel] ?? CHANNEL_COLOR.other!;
              return (
                <div key={c.channel} style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1fr)", alignItems: "center", gap: ".65rem", padding: ".22rem 0" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: col, flex: "none" }} />{c.channel}
                  </span>
                  <span style={{ position: "relative", display: "block", height: 22, background: "rgba(255,255,255,.045)", borderRadius: 4 }}>
                    <span style={{ display: "block", height: "100%", width: `${w}%`, background: col, borderRadius: "0 4px 4px 0" }} />
                    <span style={{
                      position: "absolute", top: "50%", left: `${w}%`, transform: "translateY(-50%)", marginLeft: 7,
                      fontFamily: "var(--mono, monospace)", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                      color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5,
                    }}>
                      {roas != null ? `${roas.toFixed(2)}×` : "no data"}
                      {roas != null && roas < 2.5 && <Pill tone="crit">below 2.5</Pill>}
                      {roas != null && roas >= 2.5 && roas < TARGET_ROAS && <Pill tone="warn">caution</Pill>}
                    </span>
                    <span style={{ position: "absolute", top: 0, bottom: 0, left: `${(TARGET_ROAS / maxRoas) * 100}%`, borderLeft: "2px dashed rgba(184,180,174,.5)" }} />
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>{["Platform", "Spend", "Impr.", "Clicks", "CPM", "CPC", "CTR", "Revenue", "ROAS"].map((h, i) => (
                  <th key={h} style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase",
                    color: "var(--text-dim)", textAlign: i === 0 ? "left" : "right",
                    padding: "0 .5rem .5rem", borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {channels.map(c => (
                  <Row key={c.channel} cells={[
                    <span key="n" style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: CHANNEL_COLOR[c.channel] ?? CHANNEL_COLOR.other! }} />
                      {c.channel}{c.daysMissing > 0 && <Pill tone="warn">{c.daysMissing}d missing</Pill>}
                    </span>,
                    money(c.spend), compact(c.impressions), compact(c.clicks),
                    money(c.cpm, 2), c.cpc != null ? money(c.cpc, 2) : "—", pctStr(c.ctr, 2),
                    money(c.revenue),
                    c.attributedRoas != null ? `${c.attributedRoas.toFixed(2)}×` : "—",
                  ]} />
                ))}
                <Row foot cells={[
                  "Blended", money(d.blended.spend), compact(d.blended.impressions), compact(d.blended.clicks),
                  money(d.blended.cpm, 2), d.blended.cpc != null ? money(d.blended.cpc, 2) : "—",
                  pctStr(d.blended.ctr, 2), money(d.blended.netRevenue),
                  d.blended.mer != null ? `${d.blended.mer.toFixed(2)}×` : "—",
                ]} />
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: ".85rem", background: "rgba(139,110,232,.06)", border: "1px solid rgba(139,110,232,.2)",
            borderRadius: 10, padding: ".6rem .8rem",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-primary)" }}>
              <strong>Unattributed: {money(d.unattributed.revenue)}</strong> across ~{d.unattributed.orders} orders
            </p>
            <p style={{ margin: ".2rem 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{d.unattributed.note}</p>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: ".75rem", lineHeight: 1.55, maxWidth: "76ch" }}>
            Two ROAS numbers on purpose. The per-platform figures are each platform&apos;s own claim, and they double-count the
            same conversions. <strong style={{ color: "var(--text-secondary)" }}>MER {d.blended.mer != null ? `${d.blended.mer.toFixed(2)}×` : "—"}</strong>{" "}
            divides Shopify&apos;s own revenue by total spend, so it cannot. Trust MER; use per-platform only to compare channels.
          </p>
        </>
      )}
    </Panel>
  );
}

// ── Campaigns / creative ──────────────────────────────────────────────────────
/**
 * The drill-down under the platform row.
 *
 * WHY THIS EXISTS AS A SEPARATE SECTION
 * -------------------------------------
 * "Meta ROAS is 2.12×" is a mean across campaigns that individually run from
 * under 1× to well above target, and the action it implies — spend less on Meta —
 * is usually the wrong one. The decision lives one level down: which campaigns
 * hold the budget, and which of those are below target.
 *
 * The underperformers list is ranked by spend × shortfall, not by ROAS, so a $40
 * test campaign at 0.2× never outranks a $9,000 campaign at 1.9×.
 */
interface AdEntity {
  channel: string; level: string; entityId: string; entityName: string;
  campaignName: string | null; spend: number; impressions: number; clicks: number;
  conversions: number; revenue: number; cpm: number | null; cpc: number | null;
  ctr: number | null; costPerConversion: number | null; attributedRoas: number | null;
  spendShare: number; activeDays: number;
}

function Campaigns({ period, nonce }: { period: string; nonce: number }) {
  const [level, setLevel] = useState<"campaign" | "ad">("campaign");
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setD(null); setErr(null);
    // Tolerates a non-JSON body: until the backend carrying /ads is deployed this
    // endpoint 404s with an HTML page, and r.json() on that throws a parse error
    // that reads like a bug rather than "not shipped yet".
    fetch(`${BOT_URL}/admin/profitability/ads?period=${period}&level=${level}`)
      .then(async r => {
        const text = await r.text();
        let j: any = null;
        try { j = JSON.parse(text); } catch { /* not JSON */ }
        if (!r.ok) {
          throw new Error(j?.error ?? (r.status === 404
            ? "This view needs a gravity-claw deploy — /admin/profitability/ads is not live yet."
            : `HTTP ${r.status}`));
        }
        return j;
      })
      .then(j => alive && setD(j)).catch(e => alive && setErr(e.message));
    return () => { alive = false; };
  }, [period, level, nonce]);

  const title = level === "campaign" ? "Campaign performance" : "Creative performance";

  const toggle = (
    <div style={{ display: "flex", background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 9, padding: 2 }}>
      {(["campaign", "ad"] as const).map(l => (
        <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l} style={{
          background: level === l ? "var(--bg-elevated)" : "none", border: 0, borderRadius: 7,
          padding: ".25rem .6rem", fontSize: 11, fontWeight: level === l ? 800 : 500, cursor: "pointer",
          color: level === l ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "inherit",
        }}>{l === "campaign" ? "Campaigns" : "Ads"}</button>
      ))}
    </div>
  );

  if (err) return <Panel title={title} right={toggle}><p style={{ color: CRIT, fontSize: 12 }}>{err}</p></Panel>;
  if (!d)  return <Panel title={title} right={toggle}><Skeleton rows={4} /></Panel>;

  const entities: AdEntity[] = d.entities ?? [];
  const under: Array<AdEntity & { wastedSpend: number }> = d.underperformers ?? [];

  if (d.empty) {
    return (
      <Panel title={title} right={toggle}>
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px dashed rgba(255,255,255,.12)", borderRadius: 10, padding: ".9rem 1rem" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
            No campaign-level data stored for this window.
          </p>
          <p style={{ margin: ".35rem 0 0", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55, maxWidth: "72ch" }}>
            {d.emptyReason} Collection runs nightly at 4:15 AM once Meta is connected, and backfills 35 days each
            time — so the first successful night fills this in retroactively.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={title} right={toggle}>
      {under.length > 0 && (
        <div style={{
          background: "rgba(244,63,94,.05)", border: "1px solid rgba(244,63,94,.2)",
          borderRadius: 10, padding: ".7rem .9rem", marginBottom: ".9rem",
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {under.length} below the {TARGET_ROAS}× target, holding {money(under.reduce((s, u) => s + u.spend, 0))} of spend
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: ".45rem" }}>
            {under.slice(0, 3).map(u => (
              <p key={u.entityId} style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-primary)" }}>{u.entityName}</strong>{" "}
                — {money(u.spend)} at {u.attributedRoas?.toFixed(2)}×, {money(u.wastedSpend)} below what target implies
              </p>
            ))}
          </div>
          <p style={{ margin: ".45rem 0 0", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Ranked by spend × shortfall, not by ROAS — the biggest budget below target comes first.
          </p>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>{[level === "campaign" ? "Campaign" : "Ad", "Spend", "Share", "Clicks", "CTR", "Purch.", "CPA", "Revenue", "ROAS"].map((h, i) => (
              <th key={h} style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase",
                color: "var(--text-dim)", textAlign: i === 0 ? "left" : "right",
                padding: "0 .5rem .5rem", borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {entities.map(e => (
              <Row key={`${e.channel}:${e.entityId}`} cells={[
                <span key="n" style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 320 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: CHANNEL_COLOR[e.channel] ?? CHANNEL_COLOR.other!, flex: "none" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.entityName}>{e.entityName}</span>
                  {e.attributedRoas != null && e.attributedRoas < 1 && <Pill tone="crit">under 1×</Pill>}
                </span>,
                money(e.spend), `${e.spendShare.toFixed(0)}%`, compact(e.clicks), pctStr(e.ctr, 2),
                e.conversions.toFixed(0),
                e.costPerConversion != null ? money(e.costPerConversion) : "—",
                money(e.revenue),
                <span key="r" style={{
                  color: e.attributedRoas == null ? "var(--text-muted)"
                    : e.attributedRoas >= TARGET_ROAS ? GOOD
                    : e.attributedRoas >= 2.0 ? WARN : CRIT,
                  fontWeight: 700,
                }}>{e.attributedRoas != null ? `${e.attributedRoas.toFixed(2)}×` : "—"}</span>,
              ]} />
            ))}
            <Row foot cells={[
              `${entities.length} ${level === "campaign" ? "campaigns" : "ads"}`,
              money(d.totalSpend), "100%", "", "", "", "", "", "",
            ]} />
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: ".75rem", lineHeight: 1.55, maxWidth: "76ch" }}>
        {d.note}
      </p>
    </Panel>
  );
}

// ── Connections ───────────────────────────────────────────────────────────────
/**
 * Renders only when something is unconnected, and says which figure each missing
 * feed takes with it. "No data" on a dashboard is ambiguous between "the business
 * did nothing" and "nobody plugged this in"; this removes the ambiguity.
 */
function Connections({ onGoToCosts }: { onGoToCosts: () => void }) {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BOT_URL}/admin/profitability/connections`)
      .then(r => r.ok ? r.json() : null)
      .then(j => alive && setD(j)).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!d) return null;
  const missing = (d.feeds ?? []).filter((f: any) => !f.connected);
  if (missing.length === 0) return null;

  return (
    <Panel title="What is not connected" right={
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.connectedCount} of {d.total} feeds live</span>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: ".55rem" }}>
        {missing.map((f: any) => (
          <div key={f.key} style={{
            display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", gap: ".75rem",
            alignItems: "start", padding: ".55rem 0", borderBottom: "1px solid rgba(255,255,255,.035)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.blocking?.includes(f.key) ? CRIT : WARN, flex: "none" }} />
              {f.label}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.unlocks}</p>
              <p style={{ margin: ".2rem 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {f.howTo}{f.detail ? ` · ${f.detail}` : ""}
              </p>
              {f.kind === "data_entry" && (
                <button onClick={onGoToCosts} style={{
                  marginTop: ".3rem", background: "none", border: 0, padding: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: BRAND,
                  display: "flex", alignItems: "center", gap: 3,
                }}>Enter it on the Costs tab <ArrowRight size={10} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Row({ cells, foot }: { cells: React.ReactNode[]; foot?: boolean }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={{
          padding: foot ? ".55rem .5rem" : ".48rem .5rem", fontSize: 12.5,
          textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap",
          borderBottom: foot ? 0 : "1px solid rgba(255,255,255,.035)",
          borderTop: foot ? "1px solid rgba(255,255,255,.06)" : undefined,
          fontWeight: foot ? 800 : 400,
          color: i === 0 || foot ? "var(--text-primary)" : "var(--text-secondary)",
          fontFamily: i === 0 ? undefined : "var(--mono, monospace)",
          fontVariantNumeric: "tabular-nums",
        }}>{c}</td>
      ))}
    </tr>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 16, borderRadius: 5, background: "rgba(255,255,255,.04)" }} />
      ))}
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────
function Products({ period, nonce, onGoToCosts }: { period: string; nonce: number; onGoToCosts: () => void }) {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BOT_URL}/admin/profitability/products?period=${period}&limit=30`)
      .then(r => r.json()).then(j => alive && setD(j)).catch(() => {});
    return () => { alive = false; };
  }, [period, nonce]);

  if (!d) return <Panel title="Cost and margin by product"><Skeleton rows={6} /></Panel>;
  const rows: ProductRow[] = d.products ?? [];
  const cov = d.coverage;

  return (
    <Panel
      title="Cost and margin by product"
      right={<>
        {!cov.sufficient && <Pill tone="crit">{cov.variantsMissingCost} without a cost</Pill>}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>coverage {(cov.pct * 100).toFixed(1)}%</span>
      </>}
    >
      {!cov.sufficient && (
        <div style={{
          display: "flex", gap: ".6rem", alignItems: "flex-start", marginBottom: ".9rem",
          background: "rgba(244,63,94,.05)", border: "1px solid rgba(244,63,94,.2)", borderRadius: 10, padding: ".65rem .8rem",
        }}>
          <Pill tone="crit">Fix first</Pill>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text-primary)" }}>{money(cov.revenueWithoutCost)} of revenue has no unit cost</strong>, so it sits outside
              every margin number on this page. The products below with <em>not set</em> are the whole gap — the top few usually cover most of it.
            </p>
            <button onClick={onGoToCosts} style={{
              marginTop: ".5rem", display: "inline-flex", alignItems: "center", gap: 5,
              background: `${CRIT}1f`, border: `1px solid ${CRIT}55`, color: CRIT,
              borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>Enter unit costs <ArrowRight size={11} /></button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
          <thead>
            <tr>{["Product", "Price", "Unit cost", "Margin %", "Units", "Revenue", "Gross profit"].map((h, i) => (
              <th key={h} style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase",
                color: "var(--text-dim)", textAlign: i === 0 ? "left" : "right",
                padding: "0 .5rem .5rem", borderBottom: "1px solid rgba(255,255,255,.06)", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={(p.variantId ?? p.sku) + i}>
                <td style={{ padding: ".48rem .5rem", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,.035)", color: "var(--text-primary)", maxWidth: 280 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}{p.variantTitle ? ` · ${p.variantTitle}` : ""}
                  </span>
                  {p.excludedBy && (
                    <span style={{ display: "inline-flex", marginTop: 3 }}>
                      <Pill tone="off">excluded</Pill>
                      <Tip text={p.excludedBy} />
                    </span>
                  )}
                </td>
                {[
                  money(p.unitPrice, 2),
                  p.unitCost != null ? money(p.unitCost, 2) : <span style={{ color: CRIT }}>not set</span>,
                  p.marginPct != null
                    ? <span style={{ color: p.marginPct >= 48 ? GOOD : p.marginPct >= 42 ? WARN : CRIT }}>{pctStr(p.marginPct)}</span>
                    : <span style={{ color: "var(--text-dim)" }}>—</span>,
                  String(p.quantity), money(p.revenue),
                  p.grossProfit != null ? money(p.grossProfit) : <span style={{ color: "var(--text-dim)" }}>—</span>,
                ].map((c, j) => (
                  <td key={j} style={{
                    padding: ".48rem .5rem", fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap",
                    borderBottom: "1px solid rgba(255,255,255,.035)", color: "var(--text-secondary)",
                    fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
                  }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Scorecard ─────────────────────────────────────────────────────────────────
function Sparkline({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return <div style={{ height: 26 }} />;
  const W = 100, H = 26, PAD = 3;
  const lo = Math.min(...series), hi = Math.max(...series), span = hi - lo || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const line = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const id = `sp-${color.slice(1)}-${series.length}-${Math.round(series[0]! * 100)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 26 }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".26" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1]!)} r="2.4" fill={color} stroke="var(--bg-card)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiCard({ m }: { m: Metric }) {
  const col = STATUS_COLOR[m.status] ?? "#6b7280";
  const hasData = m.value != null;
  const band = m.benchmarkLow != null && m.benchmarkHigh != null
    ? `benchmark ${m.benchmarkLow}–${m.benchmarkHigh}` : null;

  return (
    <div style={{
      background: !hasData ? "rgba(255,255,255,.02)"
        : m.status === "critical" ? "rgba(244,63,94,.05)"
        : m.status === "warning" ? "rgba(245,158,11,.04)" : "var(--bg-elevated)",
      border: `1px solid ${!hasData ? "rgba(255,255,255,.06)" : `${col}44`}`,
      borderRadius: 11, padding: ".7rem .8rem", display: "flex", flexDirection: "column", gap: ".28rem",
      opacity: hasData ? 1 : 0.72,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".4rem" }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{m.label}</span>
        {hasData
          ? <Pill tone={m.status === "healthy" ? "good" : m.status === "warning" ? "warn" : m.status === "critical" ? "crit" : "off"}>{m.status}</Pill>
          : <Pill tone="off">no data</Pill>}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: ".45rem" }}>
        <span style={{
          fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
          fontSize: "1.45rem", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-.02em",
          color: hasData ? col : "var(--text-dim)",
        }}>{fmtMetric(m)}</span>
        {m.delta != null && (
          <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 2, color: m.delta > 0 ? GOOD : m.delta < 0 ? CRIT : "var(--text-muted)" }}>
            {m.delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {m.delta > 0 ? "+" : ""}{m.delta.toFixed(2)}
          </span>
        )}
        {m.valueBasis && <Tip text={m.valueBasis} />}
      </div>

      {band && <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--mono, monospace)" }}>{band}</span>}
      {hasData && <Sparkline series={m.series} color={col} />}

      {!hasData && m.notes && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45, borderTop: "1px dashed rgba(255,255,255,.07)", paddingTop: ".35rem", margin: ".1rem 0 0" }}>
          {m.notes.slice(0, 150)}{m.notes.length > 150 ? "…" : ""}
        </p>
      )}
      {hasData && m.confidence && m.confidence !== "measured" && (
        <span style={{ fontSize: 10, color: WARN, fontFamily: "var(--mono, monospace)" }}>{m.confidence}</span>
      )}
    </div>
  );
}

// The scorecard is period-scoped like every other panel. It used to fetch with no
// period at all and render whatever the warehouse called "latest" — which was
// always the single-day row — with no window label, directly beside a
// quarter-to-date P&L that disagreed with it on ROAS, CAC and gross margin.
function Scorecard({ period, nonce }: { period: string; nonce: number }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    setD(null);
    fetch(`${BOT_URL}/admin/profitability/scorecard?period=${period}`).then(r => r.json())
      .then(j => alive && setD(j)).catch(() => {});
    return () => { alive = false; };
  }, [period, nonce]);

  if (!d) return <Panel title="Scorecard"><Skeleton rows={4} /></Panel>;

  return (
    <Panel title="Scorecard" right={
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {d.period?.label ? `${d.period.label} · ` : ""}{d.withData} of {d.total} metrics have data
      </span>
    }>
      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".11em", textTransform: "uppercase", color: "var(--text-dim)", margin: "0 0 .5rem" }}>
        The five decision-drivers
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: ".6rem" }}>
        {(d.drivers ?? []).map((m: Metric) => <KpiCard key={m.key} m={m} />)}
      </div>
      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".11em", textTransform: "uppercase", color: "var(--text-dim)", margin: "1rem 0 .5rem" }}>
        Supporting
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: ".6rem" }}>
        {(d.supporting ?? []).map((m: Metric) => <KpiCard key={m.key} m={m} />)}
      </div>
    </Panel>
  );
}

// ── Levers ────────────────────────────────────────────────────────────────────
function Levers() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${BOT_URL}/admin/profitability/levers`).then(r => r.json())
      .then(j => alive && setD(j)).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!d) return <Panel title="What to do next"><Skeleton rows={4} /></Panel>;
  const levers: Lever[] = d.levers ?? [];

  return (
    <Panel title="What to do next" right={
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ranked by quarterly effect</span>
    }>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {levers.map((l, i) => (
          <div key={l.key} style={{
            display: "grid", gridTemplateColumns: "minmax(0,1fr) 112px 104px",
            alignItems: "center", gap: ".8rem", padding: ".65rem .3rem",
            borderTop: i ? "1px solid rgba(255,255,255,.04)" : undefined,
          }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                {l.title}<Tip text={l.basis} />
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>{l.mechanism}</p>
              {l.blockedBy && <p style={{ margin: "2px 0 0", fontSize: 11, color: CRIT }}>{l.blockedBy}</p>}
            </div>
            <p style={{
              margin: 0, textAlign: "right", fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
              fontSize: 13, fontWeight: 700, color: l.quarterlyValue != null ? GOOD : "var(--text-dim)",
            }}>{l.quarterlyValue != null ? `+${money(l.quarterlyValue)}` : "unlocks data"}</p>
            <div style={{ textAlign: "right" }}>
              <Pill tone={l.status === "blocking" ? "crit" : l.status === "reference" ? "off" : "warn"}>
                {l.status.replace("_", " ")}
              </Pill>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: ".8rem", lineHeight: 1.5, maxWidth: "76ch" }}>{d.note}</p>
    </Panel>
  );
}

// ── Costs tab ─────────────────────────────────────────────────────────────────
function CostsTab() {
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [variants, setVariants] = useState<VariantCost[]>([]);
  const [missingOnly, setMissingOnly] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    const [a, v] = await Promise.all([
      fetch(`${BOT_URL}/admin/profitability/assumptions`).then(r => r.json()),
      fetch(`${BOT_URL}/admin/profitability/variant-costs`).then(r => r.json()),
    ]);
    setAssumptions(a.assumptions ?? []);
    setVariants(v.variants ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveAssumption = async (a: Assumption, value: number, basis: string) => {
    setBusy(a.key);
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability/assumptions/${a.key}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, basis, updatedBy: "dashboard" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg({ text: `Saved ${a.label}`, ok: true });
      await loadAll();
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally { setBusy(null); }
  };

  const saveVariants = async () => {
    const updates = Object.entries(drafts)
      .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
      .map(([variantId, v]) => ({ variantId, unitCost: Number(v) }));
    if (!updates.length) { setMsg({ text: "Nothing to save", ok: false }); return; }

    setBusy("variants");
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability/variant-costs`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, updatedBy: "dashboard" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg({ text: `Saved ${j.updated} unit cost${j.updated === 1 ? "" : "s"}${j.failed?.length ? `, ${j.failed.length} failed` : ""}`, ok: true });
      setDrafts({});
      await loadAll();
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally { setBusy(null); }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability/sync-variants`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg({ text: `${j.variantsSeen} variants seen, ${j.inserted} new, ${j.withShopifyCost} with a Shopify cost, ${j.manualPreserved} manual kept`, ok: true });
      await loadAll();
    } catch (e: any) { setMsg({ text: e.message, ok: false }); }
    finally { setBusy(null); }
  };

  const shown = useMemo(() => {
    let v = missingOnly ? variants.filter(x => x.unitCost == null) : variants;
    if (q.trim()) {
      const needle = q.toLowerCase();
      v = v.filter(x => x.productTitle.toLowerCase().includes(needle) || (x.sku ?? "").toLowerCase().includes(needle));
    }
    return v.slice(0, 150);
  }, [variants, missingOnly, q]);

  const withCost = variants.filter(v => v.unitCost != null).length;
  const byCat = useMemo(() => {
    const g: Record<string, Assumption[]> = {};
    for (const a of assumptions) (g[a.category] ??= []).push(a);
    return g;
  }, [assumptions]);

  const CATEGORY_BLURB: Record<string, string> = {
    opex: "Monthly fixed cost. Net profit stays unavailable until at least one of these is filled in — a zero here would report contribution margin as profit.",
    variable: "Charged per order or as a share of sales. Defaults are the published Shopify Payments rates; a Plus contract usually beats them.",
    fulfillment: "Per-order cost of getting goods out and back. Falcon Fulfillment would make these measured instead of estimated.",
    goal: "Targets. These colour the page and drive pacing — they are never used to compute a result.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onAnimationComplete={() => setTimeout(() => setMsg(null), 3500)}
            style={{
              background: msg.ok ? "rgba(34,197,94,.08)" : "rgba(244,63,94,.08)",
              border: `1px solid ${msg.ok ? "rgba(34,197,94,.3)" : "rgba(244,63,94,.3)"}`,
              borderRadius: 10, padding: ".6rem .85rem", display: "flex", alignItems: "center", gap: 8,
            }}>
            {msg.ok ? <Check size={13} color={GOOD} /> : <AlertTriangle size={13} color={CRIT} />}
            <span style={{ fontSize: 12.5, color: msg.ok ? GOOD : CRIT }}>{msg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unit costs — the 96% gap */}
      <Panel
        title="Unit costs"
        accent={withCost / Math.max(variants.length, 1) < 0.8 ? "rgba(244,63,94,.3)" : undefined}
        right={<>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{withCost} of {variants.length} set</span>
          <button onClick={sync} disabled={busy === "sync"} style={btn(BRAND)}>
            {busy === "sync" ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} Sync from Shopify
          </button>
        </>}
      >
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 .85rem", maxWidth: "78ch" }}>
          A unit cost is the landed cost of one unit — what you pay, including freight and duty. It is the single input that
          unlocks gross margin, contribution margin and net profit. Entering a value here overrides Shopify&apos;s own
          <em> Cost per item</em> field and survives every future sync, because Shopify does not know about freight.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", marginBottom: ".75rem" }}>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Search product or SKU…"
            style={{
              flex: "1 1 220px", background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 8, padding: ".4rem .6rem", color: "var(--text-primary)", fontSize: 12.5, fontFamily: "inherit",
            }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} />
            Only missing
          </label>
          <button onClick={saveVariants} disabled={busy === "variants" || Object.keys(drafts).length === 0} style={btn(GOOD, Object.keys(drafts).length === 0)}>
            {busy === "variants" ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
            Save {Object.keys(drafts).length || ""} change{Object.keys(drafts).length === 1 ? "" : "s"}
          </button>
        </div>

        <div style={{ maxHeight: 460, overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2 }}>
              <tr>{["Product", "SKU", "Price", "Unit cost", "Margin", "Source"].map((h, i) => (
                <th key={h} style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase",
                  color: "var(--text-dim)", textAlign: i === 0 || i === 1 ? "left" : "right",
                  padding: ".3rem .5rem .5rem", borderBottom: "1px solid rgba(255,255,255,.08)", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
                  {missingOnly ? "Every variant has a unit cost. Nothing to fill in." : "No variants match."}
                </td></tr>
              )}
              {shown.map(v => {
                const draft = drafts[v.variantId];
                const effective = draft !== undefined && draft !== "" ? Number(draft) : v.unitCost;
                const margin = effective != null && v.price ? ((v.price - effective) / v.price) * 100 : null;
                return (
                  <tr key={v.variantId}>
                    <td style={cell(true)}>
                      <span style={{ display: "block", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.productTitle}{v.variantTitle && v.variantTitle !== "Default Title" ? ` · ${v.variantTitle}` : ""}
                      </span>
                    </td>
                    <td style={{ ...cell(true), fontFamily: "var(--mono, monospace)", fontSize: 11, color: "var(--text-muted)" }}>{v.sku || "—"}</td>
                    <td style={cell()}>{v.price != null ? money(v.price, 2) : "—"}</td>
                    <td style={{ ...cell(), padding: ".3rem .5rem" }}>
                      <input
                        type="number" min="0" step="0.01"
                        placeholder={v.unitCost != null ? String(v.unitCost) : "—"}
                        value={draft ?? (v.unitCost != null ? String(v.unitCost) : "")}
                        onChange={e => setDrafts(d => ({ ...d, [v.variantId]: e.target.value }))}
                        style={{
                          width: 88, textAlign: "right", background: draft !== undefined ? "rgba(34,197,94,.1)" : "rgba(0,0,0,.3)",
                          border: `1px solid ${draft !== undefined ? "rgba(34,197,94,.4)" : v.unitCost == null ? "rgba(244,63,94,.35)" : "rgba(255,255,255,.1)"}`,
                          borderRadius: 6, padding: "3px 6px", color: "var(--text-primary)",
                          fontSize: 12, fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
                        }} />
                    </td>
                    <td style={{ ...cell(), color: margin == null ? "var(--text-dim)" : margin >= 48 ? GOOD : margin >= 42 ? WARN : CRIT }}>
                      {margin != null ? pctStr(margin) : "—"}
                    </td>
                    <td style={{ ...cell(), fontSize: 10.5, color: "var(--text-muted)" }}>{v.unitCost != null ? v.source : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 150 && (
          <p style={{ fontSize: 11, color: WARN, marginTop: ".6rem" }}>
            Showing the first 150. Narrow with the search box — nothing is hidden silently beyond this.
          </p>
        )}
      </Panel>

      {/* Assumptions */}
      {Object.entries(byCat).map(([cat, rows]) => (
        <Panel key={cat} title={cat === "opex" ? "Overhead" : cat === "variable" ? "Cost of transacting" : cat === "goal" ? "Targets" : "Fulfilment"}
          right={rows.some(r => !r.configured)
            ? <Pill tone="warn">{rows.filter(r => !r.configured).length} not set</Pill>
            : <Pill tone="good">all set</Pill>}
        >
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 .85rem", maxWidth: "78ch" }}>
            {CATEGORY_BLURB[cat]}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: ".55rem" }}>
            {rows.map(a => (
              <AssumptionRow key={a.key} a={a} busy={busy === a.key} onSave={saveAssumption} />
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function AssumptionRow({ a, busy, onSave }: {
  a: Assumption; busy: boolean;
  onSave: (a: Assumption, value: number, basis: string) => Promise<void>;
}) {
  const [value, setValue] = useState(String(a.value));
  const [basis, setBasis] = useState(a.configured ? a.basis : "");
  const dirty = value !== String(a.value) || basis !== (a.configured ? a.basis : "");

  useEffect(() => { setValue(String(a.value)); setBasis(a.configured ? a.basis : ""); }, [a.value, a.basis, a.configured]);

  const suffix = a.unit === "percent" ? "%" : a.unit === "usd_per_month" ? "/mo" : a.unit === "usd_per_order" ? "/order" : "";

  return (
    <div style={{
      background: a.configured ? "var(--bg-elevated)" : "rgba(245,158,11,.05)",
      border: `1px solid ${a.configured ? "rgba(255,255,255,.06)" : "rgba(245,158,11,.25)"}`,
      borderRadius: 10, padding: ".6rem .75rem",
      display: "grid", gridTemplateColumns: "minmax(150px, 1.1fr) 128px minmax(180px, 2fr) auto",
      gap: ".6rem", alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
          {a.label}{a.notes && <Tip text={a.notes} />}
        </p>
        {!a.configured && <span style={{ fontSize: 10, color: WARN, fontWeight: 700 }}>not set</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {a.unit !== "percent" && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>}
        <input
          type="number" min="0" step={a.unit === "percent" ? "0.01" : "1"} value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            width: "100%", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 6, padding: "4px 6px", color: "var(--text-primary)", textAlign: "right",
            fontSize: 12.5, fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
          }} />
        {suffix && <span style={{ fontSize: 10.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>

      <input
        value={basis} onChange={e => setBasis(e.target.value)}
        placeholder="Where did this number come from? (required)"
        style={{
          background: "rgba(0,0,0,.25)", border: `1px solid ${!basis && dirty ? "rgba(244,63,94,.4)" : "rgba(255,255,255,.1)"}`,
          borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)", fontSize: 11.5, fontFamily: "inherit",
        }} />

      <button
        onClick={() => onSave(a, Number(value), basis)}
        disabled={busy || !dirty || !basis.trim()}
        title={!basis.trim() ? "Say where the number came from first" : undefined}
        style={btn(GOOD, busy || !dirty || !basis.trim())}>
        {busy ? <Loader2 size={11} className="spin" /> : <Check size={11} />} Save
      </button>
    </div>
  );
}

const btn = (color: string, disabled = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  background: disabled ? "rgba(255,255,255,.04)" : `${color}22`,
  border: `1px solid ${disabled ? "rgba(255,255,255,.08)" : `${color}55`}`,
  color: disabled ? "var(--text-dim)" : color,
  borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
});

const cell = (left = false): React.CSSProperties => ({
  padding: ".4rem .5rem", fontSize: 12.5, textAlign: left ? "left" : "right",
  whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,.035)",
  color: left ? "var(--text-primary)" : "var(--text-secondary)",
  fontFamily: left ? undefined : "var(--mono, monospace)", fontVariantNumeric: "tabular-nums",
});

// ── Page ──────────────────────────────────────────────────────────────────────
const PERIODS = [
  { id: "7d",  label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "qtd", label: "QTD" },
];

export default function ProfitDashboard({
  subTabParam = "tab",
  showHeading = true,
}: {
  /**
   * Query parameter carrying the inner dashboard/costs tab.
   *
   * Standalone at /profitability it is `tab`, which is what the Insights page's
   * blocker banner already links to (`/profitability?tab=costs`). Embedded in
   * Command Center, `tab` is taken by the outer tab strip, so the host passes
   * `sub` instead and the two do not fight over the same key.
   */
  subTabParam?: string;
  /** The host supplies its own page title when embedded. */
  showHeading?: boolean;
} = {}) {
  const [tab, setTab] = useState<"dashboard" | "costs">("dashboard");
  const [period, setPeriod] = useState("qtd");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get(subTabParam) === "costs") setTab("costs");
    const per = p.get("period");
    if (per && PERIODS.some(x => x.id === per)) setPeriod(per);
  }, [subTabParam]);

  const switchTab = useCallback((t: "dashboard" | "costs") => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "costs") url.searchParams.set(subTabParam, "costs");
    else url.searchParams.delete(subTabParam);
    window.history.replaceState(null, "", url);
  }, [subTabParam]);
  const [pnl, setPnl] = useState<PnlResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [adsWarn, setAdsWarn] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability?period=${period}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setPnl(j);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load, nonce]);

  const collect = async () => {
    setCollecting(true);
    try {
      const body = JSON.stringify({ period });
      const headers = { "Content-Type": "application/json" };

      // Account-level first — it feeds the P&L, and it is the one that must
      // succeed. The entity-level pull is slower and only feeds the campaign
      // drill-down, so a failure there is reported without discarding the P&L
      // refresh that already landed.
      const res = await fetch(`${BOT_URL}/admin/profitability/collect`, { method: "POST", headers, body });
      if (!res.ok) throw new Error((await res.json()).error);

      // Held in its own state, not in `err`: reloading the P&L clears `err` on
      // entry, which would wipe this message before it was ever seen.
      const adsRes = await fetch(`${BOT_URL}/admin/profitability/collect-ads`, { method: "POST", headers, body });
      setAdsWarn(adsRes.ok ? null : `Campaign-level collection failed: ${(await adsRes.json()).error}`);

      setNonce(n => n + 1);
    } catch (e: any) { setErr(e.message); }
    finally { setCollecting(false); }
  };

  return (
    <div style={{
      // Embedded, the host page already supplies the outer gutter.
      padding: showHeading ? "1.25rem 1.5rem" : 0,
      display: "flex", flexDirection: "column", gap: "1.15rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: ".9rem" }}>
        {showHeading ? (
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: `${GOOD}18`, border: `1px solid ${GOOD}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><PiggyBank size={20} color={GOOD} /></div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>Profit</h1>
              <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: "3px 0 0" }}>
                {pnl ? `${pnl.period.label} · ${pnl.period.start.slice(0, 10)} → ${pnl.period.end.slice(0, 10)}` : "loading…"}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: 0 }}>
            {pnl ? `${pnl.period.label} · ${pnl.period.start.slice(0, 10)} → ${pnl.period.end.slice(0, 10)}` : "loading…"}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 2 }}>
            {(["dashboard", "costs"] as const).map(t => (
              <button key={t} onClick={() => switchTab(t)} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: tab === t ? "var(--bg-elevated)" : "none", border: 0, borderRadius: 8,
                padding: ".3rem .7rem", fontSize: 11.5, fontWeight: tab === t ? 800 : 500, cursor: "pointer",
                color: tab === t ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "inherit",
              }}>
                {t === "dashboard" ? <BarChart3 size={11} /> : <SlidersHorizontal size={11} />}
                {t === "dashboard" ? "Dashboard" : "Costs"}
              </button>
            ))}
          </div>

          {tab === "dashboard" && (
            <>
              <div style={{ display: "flex", background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 2 }}>
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id} style={{
                    background: period === p.id ? "var(--bg-elevated)" : "none", border: 0, borderRadius: 8,
                    padding: ".3rem .65rem", fontSize: 11.5, fontWeight: period === p.id ? 800 : 500, cursor: "pointer",
                    color: period === p.id ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "inherit",
                  }}>{p.label}</button>
                ))}
              </div>
              <button onClick={collect} disabled={collecting} style={btn(BRAND, collecting)}>
                {collecting ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} Refresh data
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <div style={{ background: "rgba(244,63,94,.07)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 10, padding: ".7rem .9rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} color={CRIT} />
          <span style={{ fontSize: 12.5, color: CRIT }}>{err}</span>
        </div>
      )}

      {adsWarn && (
        <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, padding: ".7rem .9rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} color={WARN} />
          <span style={{ fontSize: 12.5, color: WARN }}>{adsWarn} — the P&amp;L above still refreshed.</span>
        </div>
      )}

      {tab === "costs" ? <CostsTab /> : (
        <>
          {pnl && <BlockerBanner blockers={pnl.blockers} onGoToCosts={() => switchTab("costs")} />}
          {loading && !pnl ? <Panel title="Are we profitable?"><Skeleton rows={6} /></Panel>
            : pnl ? <Verdict data={pnl} onGoToCosts={() => switchTab("costs")} /> : null}

          {pnl && (
            <Panel title="Where the money goes" right={
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>share of net revenue · hover ⓘ for provenance</span>
            }>
              <Waterfall lines={pnl.lines} netRevenue={pnl.summary.netRevenue} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem .9rem", alignItems: "center", marginTop: ".9rem", borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: ".7rem" }}>
                <Src status="measured" /><Src status="estimated" /><Src status="unavailable" />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Every row says where its number came from, so you always know which parts are measured and which are your assumptions.
                </span>
              </div>
            </Panel>
          )}

          <Platforms period={period} nonce={nonce} />
          <Campaigns period={period} nonce={nonce} />
          <Products period={period} nonce={nonce} onGoToCosts={() => switchTab("costs")} />
          <Scorecard period={period} nonce={nonce} />
          <Levers />
          <Connections onGoToCosts={() => switchTab("costs")} />
        </>
      )}
    </div>
  );
}
