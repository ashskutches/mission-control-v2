"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, ArrowRight, Clock, DollarSign, Info,
  Package, PackageX, RefreshCw, Timer, TrendingUp, Truck, X,
} from "lucide-react";
import {
  type Alert, type Degraded, type Feed, type Fulfillment,
  type InventoryRow, type InventorySummary,
  DegradedBar, ErrorBox, Metric, Panel, Pill, Spinner, WindowPicker,
  errMessage, getJSON, money, orDash,
} from "./shared";

interface Overview {
  ok: true;
  window: { days: number; since: string };
  summary: InventorySummary;
  fulfillment: Fulfillment;
  alerts: Alert[];
  urgent: InventoryRow[];
  blocked: Feed[];
  degraded: Degraded[];
}

const SEV = {
  critical: { color: "#f43f5e", icon: AlertCircle },
  warning:  { color: "#f59e0b", icon: AlertTriangle },
  info:     { color: "#38bdf8", icon: Info },
} as const;

export default function LogisticsOverview() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dismissals are per-session on purpose: an alert is a computed fact, not a task.
  // Persisting the dismissal would hide a stockout that is still a stockout tomorrow.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<Overview>(`/admin/logistics/overview?days=${days}`));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const f = data?.fulfillment;

  const stockoutOk = s ? s.sellingStockoutRatePct <= s.stockoutTargetPct : true;
  const cycle = f?.cycleTime.avgDays7d ?? f?.cycleTime.avgDays ?? null;
  const cycleOk = cycle === null || cycle <= (f?.cycleTime.targetDays ?? 4);
  const del = f?.delivery;
  const slaOk = !del || del.withinSlaPct === null || del.withinSlaPct >= del.slaTargetPct;

  const alerts = (data?.alerts ?? []).filter(a => !dismissed.has(a.title));

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        flexWrap: "wrap", marginBottom: "1rem",
      }}>
        <WindowPicker days={days} onChange={setDays} />
        <div style={{ flex: 1 }} />
        {data && (
          <span style={{ fontSize: 10.5, color: "#475569" }}>
            Live from Shopify · orders since {data.window.since}
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.35rem",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8", borderRadius: 8, padding: "0.3rem 0.7rem",
            fontSize: 10.5, fontWeight: 800, cursor: loading ? "default" : "pointer",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      <DegradedBar degraded={data?.degraded} />

      {loading && !data && <Spinner />}

      {data && s && f && (
        <>
          {/* ── Top alerts banner ───────────────────────────────────────────── */}
          {alerts.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              {alerts.map(a => {
                const { color, icon: Icon } = SEV[a.severity];
                const body = (
                  <div style={{
                    background: `${color}0e`, border: `1px solid ${color}30`,
                    borderLeft: `3px solid ${color}`, borderRadius: 10,
                    padding: "0.6rem 0.9rem", marginBottom: "0.45rem",
                    display: "flex", alignItems: "center", gap: "0.7rem",
                  }}>
                    <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f1f5f9" }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{a.detail}</div>
                    </div>
                    {a.href && <ArrowRight size={13} color={color} style={{ flexShrink: 0 }} />}
                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDismissed(prev => new Set(prev).add(a.title));
                      }}
                      title="Dismiss for this session"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#475569", padding: 2, lineHeight: 1, flexShrink: 0,
                      }}
                    ><X size={13} /></button>
                  </div>
                );
                return (
                  <motion.div key={a.title} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    {a.href
                      ? <Link href={a.href} style={{ textDecoration: "none", display: "block" }}>{body}</Link>
                      : body}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── Inventory health ────────────────────────────────────────────── */}
          <Panel
            title="Inventory health"
            subtitle={`${s.trackedSkus} tracked SKUs${s.untrackedSkus ? ` (${s.untrackedSkus} untracked variants excluded)` : ""} · reorder points at Z=${s.serviceLevelZ} (95% service level)`}
            right={
              <Link href="/logistics/reorder" style={{
                fontSize: 10, fontWeight: 800, color: "#f59e0b", textDecoration: "none",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>Reorder recommendations →</Link>
            }
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              {/*
                Leads with the selling-SKU rate. The catalogue-wide figure the report
                specifies sits underneath it: with 360 tracked variants and most of
                the retired colourways at zero it reads about 42%, which is true,
                unfixable, and not what anyone means by "are we out of stock?".
              */}
              <Metric
                label="Stockout rate (selling SKUs)" icon={PackageX}
                value={s.sellingStockoutRatePct} unit="%"
                color={stockoutOk ? "#22c55e" : "#f43f5e"}
                target={`Target under ${s.stockoutTargetPct}%`}
                sub={`${s.sellingOutOfStock} of ${s.sellingSkus} selling · ${s.stockoutRatePct}% across all ${s.trackedSkus} tracked`}
              />
              <Metric
                label="At / below ROP" icon={AlertTriangle}
                value={s.atOrBelowRop}
                color={s.atOrBelowRop > 0 ? "#f43f5e" : "#22c55e"}
                sub={`${s.approachingRop} more within 10 days`}
              />
              <Metric
                label="Days on hand" icon={Package}
                value={orDash(s.daysOnHand)} unit={s.daysOnHand === null ? "" : "d"}
                target="Target 30–60 days"
                sub={`${s.unitsOnHand.toLocaleString()} units · ${s.dailyUnits}/day`}
              />
              <Metric
                label="Lead times set" icon={Timer}
                value={`${s.skusWithOwnLeadTime}`}
                color={s.skusWithOwnLeadTime > 0 ? "#e2e8f0" : "#f59e0b"}
                sub={`Others use the ${s.defaultLeadTimeDays}-day default`}
              />
            </div>
          </Panel>

          {/* ── Revenue vs logistics cost ───────────────────────────────────── */}
          <Panel
            title="Revenue vs logistics cost"
            subtitle="The report's twin gauges. The left one is live; the right one needs Falcon invoices and COGS before it can be anything but a guess."
            accent="#a78bfa"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <Metric
                label={`Revenue / day (${days}d)`} icon={DollarSign}
                value={money(f.revenue.perDay)}
                color="#22c55e"
                sub={`${money(f.revenue.windowTotal)} across ${f.orders} orders`}
              />
              <Metric
                label="Logistics cost % of revenue" icon={TrendingUp}
                value="—"
                color="#f59e0b"
                target="Target 4–6% of revenue"
                coverage="No feed — needs FALCON_API_TOKEN"
              />
            </div>
          </Panel>

          {/* ── Fulfilment speed ────────────────────────────────────────────── */}
          <Panel
            title="Fulfilment speed"
            subtitle={`${f.cycleTime.coverage} of ${f.orders} orders in the window have shipped; ${f.cycleTime.unfulfilled} are still unfulfilled.`}
            accent="#38bdf8"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: f.cycleTime.trend.length ? "1rem" : 0 }}>
              <Metric
                label="Order cycle time (7d)" icon={Clock}
                value={orDash(f.cycleTime.avgDays7d)} unit={f.cycleTime.avgDays7d === null ? "" : "d"}
                color={cycleOk ? "#22c55e" : "#f59e0b"}
                target={`Target under ${f.cycleTime.targetDays} days`}
                sub={`${orDash(f.cycleTime.avgDays)}d over the full ${days}d window`}
              />
              <Metric
                label={`Delivered inside ${del?.slaDays ?? 7}d`} icon={Truck}
                value={orDash(del?.withinSlaPct)} unit={del?.withinSlaPct === null || del?.withinSlaPct === undefined ? "" : "%"}
                color={slaOk ? "#22c55e" : "#f59e0b"}
                target={`Target ${del?.slaTargetPct}%`}
                sub={del?.coverage ? `${del.breached} slower of ${del.coverage} delivered` : undefined}
              />
              <Metric
                label="Transit time" icon={Truck}
                value={orDash(del?.transitAvgDays)} unit={del?.transitAvgDays === null || del?.transitAvgDays === undefined ? "" : "d"}
                sub={`${orDash(del?.toCustomerAvgDays)}d order to doorstep`}
                coverage={
                  del && del.coveragePct < 60
                    ? `${del.coveragePct}% of window orders delivered so far`
                    : undefined
                }
              />
            </div>

            {/*
              The metric the report asked for and this feed cannot honestly supply.
              Stated on the page rather than only in the code, because the next person
              to ask "where is on-time delivery?" will ask it here.
            */}
            <div style={{
              fontSize: 10.5, color: "#64748b", lineHeight: 1.6,
              marginTop: "0.6rem", paddingTop: "0.6rem",
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}>
              <strong style={{ color: "#94a3b8" }}>On-time delivery against the carrier&apos;s promise
              (KPI 2) is not shown.</strong> Shopify rewrites <code>estimatedDeliveryAt</code> to the
              delivery date on most fulfillments — across a 50-order sample the &ldquo;estimate&rdquo;
              sat four to seven hours before the actual delivery on the same day — so comparing the
              two measures Shopify&apos;s bookkeeping, not the carrier. The real promise dates are on
              Falcon&apos;s side. The {del?.slaDays ?? 7}-day figure above is our own
              order-to-doorstep target, measured end to end.
            </div>

            {f.cycleTime.trend.length > 1 && <CycleTrend trend={f.cycleTime.trend} target={f.cycleTime.targetDays} />}
          </Panel>

          {/* ── Urgent SKUs ─────────────────────────────────────────────────── */}
          {data.urgent.length > 0 && (
            <Panel
              title="Needs a purchase decision"
              accent="#f59e0b"
              right={
                <Link href="/logistics/inventory" style={{
                  fontSize: 10, fontWeight: 800, color: "#38bdf8", textDecoration: "none",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>All SKUs →</Link>
              }
            >
              {data.urgent.map(r => (
                <div key={r.variantId} style={{
                  display: "flex", alignItems: "center", gap: "0.8rem",
                  padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                      {r.product}{r.variantTitle ? ` — ${r.variantTitle}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{r.reason}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", whiteSpace: "nowrap" }}>
                    <strong style={{ color: "#e2e8f0" }}>{r.stock}</strong> in stock · ROP {r.rop}
                  </div>
                  <Pill priority={r.priority} />
                </div>
              ))}
            </Panel>
          )}

          {/* ── Blocked feeds ───────────────────────────────────────────────── */}
          <Panel
            title="What is still missing"
            subtitle="Each of these keeps a specific number blank. Nothing here is estimated in the meantime."
            accent="#64748b"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              {data.blocked.filter(b => !b.configured).map(feed => (
                <div key={feed.key} style={{
                  flex: "1 1 260px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "0.7rem 0.9rem",
                }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5, color: "#f1f5f9", marginBottom: 3 }}>
                    {feed.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    Blocks {feed.blocks.length} metric{feed.blocks.length === 1 ? "" : "s"}
                    {feed.env.length ? ` · ${feed.env.join(", ")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/**
 * Cycle time per day, as bars. Inline SVG rather than a chart library — this is one
 * series against one threshold, and the section has no charting dependency yet.
 */
function CycleTrend({ trend, target }: { trend: { day: string; avgDays: number; orders: number }[]; target: number }) {
  const max = Math.max(target, ...trend.map(t => t.avgDays)) * 1.15;
  const W = 100, H = 34;
  const barW = W / trend.length;

  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 800, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
      }}>
        Days to ship, by order date
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 78, display: "block" }}>
        {/* Target line */}
        <line
          x1={0} x2={W} y1={H - (target / max) * H} y2={H - (target / max) * H}
          stroke="#f59e0b" strokeWidth={0.3} strokeDasharray="1.5 1.5" opacity={0.7}
        />
        {trend.map((t, i) => {
          const h = Math.max(0.5, (t.avgDays / max) * H);
          return (
            <rect
              key={t.day}
              x={i * barW + barW * 0.15}
              y={H - h}
              width={barW * 0.7}
              height={h}
              fill={t.avgDays > target ? "#f59e0b" : "#38bdf8"}
              opacity={0.85}
            >
              <title>{`${t.day}: ${t.avgDays}d across ${t.orders} order${t.orders === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#475569", marginTop: 3 }}>
        <span>{trend[0]?.day}</span>
        <span style={{ color: "#f59e0b" }}>— {target}d target</span>
        <span>{trend[trend.length - 1]?.day}</span>
      </div>
    </div>
  );
}
