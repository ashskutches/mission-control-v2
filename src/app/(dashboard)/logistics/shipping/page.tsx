"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Clock, Package, RefreshCw, Truck, Weight } from "lucide-react";
import {
  type Degraded, type Feed,
  BlockedFeed, DegradedBar, ErrorBox, Metric, Panel, Spinner, WindowPicker,
  errMessage, getJSON, orDash,
} from "../shared";

/**
 * Shipping and carrier performance.
 *
 * This tab used to say "waiting on the Falcon token" and show nothing. That was wrong
 * about how much of it needed Falcon: Falcon is a Shopify LOCATION, so every shipment
 * it dispatches is in the store already with its carrier, tracking, timestamps and
 * contents. Only the FEES are Falcon-side.
 *
 * So the layout follows the evidence: measured things first, the fee gap last and
 * clearly labelled as the one hole. On-time-vs-promise sits in the middle because it is
 * measured but accumulating — the promise table only knows shipments it saw before they
 * were delivered, so it starts empty and says so instead of printing 0%.
 */

interface CarrierRow {
  carrier: string;
  shipments: number;
  units: number;
  sharePct: number;
  avgWeightLb: number | null;
  avgTransitDays: number | null;
  medianTransitDays: number | null;
  transitCoverage: number;
}

interface PromiseStats {
  tracking: {
    snapshotted: number; withPromise: number; withoutPromise: number;
    delivered: number; open: number; overdue: number;
  };
  onTime: {
    byDayPct: number | null; byTimestampPct: number | null;
    late: number; measured: number; targetPct: number;
    avgDaysLate: number | null; worstDaysLate: number | null;
  };
  byCarrier: { carrier: string; delivered: number; onTimeDayPct: number | null; avgDaysLate: number | null }[];
  overdueShipments: {
    orderName: string | null; carrier: string | null; trackingNumber: string | null;
    promisedAt: string | null; daysOverdue: number; status: string | null;
  }[];
  note: string;
}

interface ShippingResponse {
  ok: true;
  configured: boolean;
  window: { days: number; since: string };
  summary: {
    shipments: number; units: number; orders: number; splitShipmentPct: number;
    delivered: number; inTransit: number; avgUnitsPerShipment: number | null;
    totalWeightLb: number | null; avgWeightLb: number | null; weightCoverage: number;
    avgTransitDays: number | null; medianTransitDays: number | null; transitCoverage: number;
  };
  byCarrier: CarrierRow[];
  byLocation: { location: string; shipments: number; units: number }[];
  topStates: { state: string; shipments: number }[];
  statusMix: { status: string; count: number }[];
  labels: {
    sampled: number; shopifyLabels: number; carrierAccountLabels: number;
    shopifyLabelPct: number | null;
    byCarrier: { carrier: string; shopify: number; carrierAccount: number }[];
    note: string;
  } | null;
  fees: null;
  feeGap: { missing: string[]; why: string; unblockedBy: string };
  promises: PromiseStats | null;
  feeFeed: Feed;
  degraded?: Degraded[];
}

const CARRIER_COLOR: Record<string, string> = {
  UPS: "#a78bfa", USPS: "#38bdf8", FedEx: "#f59e0b", DHL: "#f43f5e",
};

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "0.4rem 0.6rem", fontSize: 9.5, fontWeight: 800,
  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em",
  borderBottom: "1px solid rgba(255,255,255,0.07)", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: 12, color: "#cbd5e1",
  borderBottom: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap",
};

export default function LogisticsShipping() {
  const [days, setDays] = useState(30);
  const [labels, setLabels] = useState(false);
  const [data, setData] = useState<ShippingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<ShippingResponse>(
        `/admin/logistics/shipping?days=${days}${labels ? "&labels=1" : ""}`,
      ));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days, labels]);

  useEffect(() => { load(); }, [load]);

  /** Fills the promise table now rather than waiting for the 15-minute cron. */
  const syncPromises = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000"}/admin/logistics/promises/sync`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      await load();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const s = data?.summary;
  const p = data?.promises;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <WindowPicker days={days} onChange={setDays} />
        <label style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          fontSize: 10.5, fontWeight: 700, color: "#94a3b8", cursor: "pointer",
        }}>
          <input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />
          Sample label sources
        </label>
        <div style={{ flex: 1 }} />
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
      {loading && !data && <Spinner label="Reading shipments from Shopify…" />}

      {data && s && (
        <>
          {/* ── Volume and speed ─────────────────────────────────────────── */}
          <Panel
            title={`Shipments · last ${data.window.days} days`}
            subtitle={`${s.shipments} shipments across ${s.orders} orders, straight from Shopify's fulfillment records. No 3PL credential involved.`}
            accent="#06b6d4"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <Metric label="Shipments" value={s.shipments} icon={Package}
                sub={`${s.units} units · ${orDash(s.avgUnitsPerShipment)} per shipment`} />
              <Metric label="Split shipments" value={s.splitShipmentPct} unit="%" icon={Package}
                sub={`${s.shipments - s.orders} extra parcels beyond one per order`} />
              <Metric label="Avg transit" value={orDash(s.avgTransitDays)} unit="d" icon={Clock}
                sub={`median ${orDash(s.medianTransitDays)} d`}
                coverage={`${s.transitCoverage} of ${s.shipments} delivered`} />
              <Metric label="Avg weight" value={orDash(s.avgWeightLb)} unit="lb" icon={Weight}
                sub={`${orDash(s.totalWeightLb)} lb shipped in the window`} />
              <Metric label="In transit now" value={s.inTransit} icon={Truck}
                sub={`${s.delivered} delivered`} />
            </div>
          </Panel>

          {/* ── Carriers ─────────────────────────────────────────────────── */}
          <Panel
            title="By carrier"
            subtitle="Carrier taken from the tracking record on each fulfillment. Transit is ship-to-doorstep, so it measures the carrier rather than our packing speed."
            accent="#a78bfa"
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={th}>Carrier</th>
                    <th style={th}>Shipments</th>
                    <th style={th}>Share</th>
                    <th style={th}>Avg transit</th>
                    <th style={th}>Median</th>
                    <th style={th}>Avg weight</th>
                    <th style={{ ...th, width: 140 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.byCarrier.map(c => (
                    <tr key={c.carrier}>
                      <td style={{ ...td, fontWeight: 700, color: CARRIER_COLOR[c.carrier] ?? "#e2e8f0" }}>{c.carrier}</td>
                      <td style={td}>{c.shipments}</td>
                      <td style={td}>{c.sharePct}%</td>
                      <td style={td}>{orDash(c.avgTransitDays, " d")}</td>
                      <td style={td}>{orDash(c.medianTransitDays, " d")}</td>
                      <td style={td}>{orDash(c.avgWeightLb, " lb")}</td>
                      <td style={td}><Bar pct={c.sharePct} color={CARRIER_COLOR[c.carrier] ?? "#64748b"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Shipped from
                </div>
                {data.byLocation.map(l => (
                  <div key={l.location} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 3 }}>
                    {l.location} — <span style={{ color: "#94a3b8" }}>{l.shipments} shipments, {l.units} units</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Top destinations
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.8 }}>
                  {data.topStates.map(t => (
                    <span key={t.state} style={{ marginRight: 12 }}>
                      {t.state} <span style={{ color: "#64748b" }}>{t.shipments}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* ── On-time vs promise (KPI 2) ───────────────────────────────── */}
          <Panel
            title="On time vs the carrier's promise · KPI 2"
            subtitle={p?.note ?? "Promise snapshots are unavailable."}
            accent="#22c55e"
            right={
              <button
                onClick={syncPromises}
                disabled={syncing}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.35rem",
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                  color: "#22c55e", borderRadius: 8, padding: "0.3rem 0.7rem",
                  fontSize: 10, fontWeight: 800, cursor: syncing ? "default" : "pointer",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                <RefreshCw size={11} /> {syncing ? "Syncing…" : "Capture now"}
              </button>
            }
          >
            {!p && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                The promise table could not be read. Check the server log for
                <code style={{ color: "#e2e8f0", marginLeft: 4 }}>delivery_promises</code>.
              </div>
            )}

            {p && p.onTime.measured === 0 && (
              <div style={{
                background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: 10, padding: "0.9rem 1.1rem", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6,
              }}>
                <strong style={{ color: "#38bdf8" }}>Still filling up.</strong>{" "}
                {p.tracking.snapshotted} shipments have had their promise captured and{" "}
                {p.tracking.open} are still in transit, so no delivery has landed against a
                stored promise yet. This is <em>no data</em>, not 0% on time — the number
                appears once these shipments arrive.
              </div>
            )}

            {p && p.onTime.measured > 0 && (
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                <Metric
                  label="On time (by day)"
                  value={orDash(p.onTime.byDayPct)} unit="%"
                  color={(p.onTime.byDayPct ?? 0) >= p.onTime.targetPct ? "#22c55e" : "#f59e0b"}
                  target={`target ${p.onTime.targetPct}%`}
                  coverage={`${p.onTime.measured} measured`}
                />
                <Metric
                  label="On time (by timestamp)"
                  value={orDash(p.onTime.byTimestampPct)} unit="%"
                  sub="stricter read of the same rows"
                />
                <Metric label="Late" value={p.onTime.late}
                  sub={`avg ${orDash(p.onTime.avgDaysLate)} d vs promise`} />
                <Metric label="Worst" value={orDash(p.onTime.worstDaysLate)} unit="d"
                  sub="latest single delivery" />
                <Metric label="Overdue now" value={p.tracking.overdue}
                  color={p.tracking.overdue > 0 ? "#f43f5e" : "#22c55e"}
                  sub="past promise, still undelivered" />
              </div>
            )}

            {p && p.byCarrier.length > 0 && (
              <div style={{ marginTop: "1rem", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={th}>Carrier</th>
                      <th style={th}>Delivered</th>
                      <th style={th}>On time</th>
                      <th style={th}>Avg vs promise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.byCarrier.map(c => (
                      <tr key={c.carrier}>
                        <td style={{ ...td, fontWeight: 700, color: CARRIER_COLOR[c.carrier] ?? "#e2e8f0" }}>{c.carrier}</td>
                        <td style={td}>{c.delivered}</td>
                        <td style={td}>{orDash(c.onTimeDayPct, "%")}</td>
                        <td style={td}>{orDash(c.avgDaysLate, " d")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {p && p.overdueShipments.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Past promise, still moving
                </div>
                {p.overdueShipments.slice(0, 8).map(o => (
                  <div key={`${o.orderName}-${o.trackingNumber}`} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 3 }}>
                    {o.orderName} · {o.carrier} · <span style={{ color: "#f43f5e" }}>{o.daysOverdue} d overdue</span>
                    {o.status && <span style={{ color: "#64748b" }}> · {o.status.toLowerCase().replace(/_/g, " ")}</span>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── Label sources ────────────────────────────────────────────── */}
          {data.labels && (
            <Panel
              title="Who buys the label"
              subtitle={data.labels.note}
              accent="#38bdf8"
            >
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                <Metric label="Bought by Shopify" value={data.labels.shopifyLabels}
                  sub="cost recoverable with read_shopify_payments" color="#22c55e" />
                <Metric label="Bought on carrier account" value={data.labels.carrierAccountLabels}
                  sub="only ever on the 3PL invoice" color="#f59e0b" />
                <Metric label="Shopify share" value={orDash(data.labels.shopifyLabelPct)} unit="%"
                  coverage={`${data.labels.sampled} sampled`} />
              </div>
              <div style={{ marginTop: "0.8rem", fontSize: 12, color: "#cbd5e1" }}>
                {data.labels.byCarrier.map(c => (
                  <div key={c.carrier} style={{ marginBottom: 3 }}>
                    {c.carrier} — <span style={{ color: "#22c55e" }}>{c.shopify} via Shopify</span>,{" "}
                    <span style={{ color: "#f59e0b" }}>{c.carrierAccount} via carrier account</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* ── The remaining gap ────────────────────────────────────────── */}
          <Panel
            title="What is still missing: the money"
            subtitle={data.feeGap.why}
            accent="#f59e0b"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <BlockedFeed feed={data.feeFeed} />
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: "0.9rem 1.1rem", flex: "1 1 320px",
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 800, color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                }}>
                  Not obtainable from Shopify
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#94a3b8", fontSize: 11.5, lineHeight: 1.6 }}>
                  {data.feeGap.missing.map(m => <li key={m}>{m}</li>)}
                </ul>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: "0.6rem", lineHeight: 1.5 }}>
                  {data.feeGap.unblockedBy}
                </div>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
