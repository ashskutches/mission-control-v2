"use client";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import {
  type Degraded, type Feed,
  BlockedFeed, DegradedBar, ErrorBox, Metric, Panel, Spinner, WindowPicker,
  errMessage, getJSON, money,
} from "../shared";

interface ReturnsResponse {
  ok: true;
  configured: boolean;
  feed: Feed;
  window: { days: number; since: string };
  shopifySignal: {
    count: number;
    rows: { id: string; name: string; createdAt: string; status: string; value: number }[];
    note: string;
  } | null;
  degraded: Degraded[];
}

/**
 * Warranty & Returns. Gorgias is not integrated, so the honest content of this tab
 * is: here is what is missing, here is exactly what it unblocks, and here is the one
 * return signal Shopify does carry on its own.
 *
 * The report's KPI 13 (return rate) is deliberately NOT computed from the Shopify
 * signal below. Returns opened in Shopify are a subset of returns — warranty claims
 * handled by email never appear — so dividing them by units shipped would produce a
 * number that looks like a return rate and reads several points too low.
 */
export default function LogisticsReturns() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ReturnsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<ReturnsResponse>(`/admin/logistics/returns?days=${days}`));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <WindowPicker days={days} onChange={setDays} />
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
      {loading && !data && <Spinner label="Reading Shopify returns…" />}

      {data && (
        <>
          {!data.configured && (
            <Panel
              title="Return rate, defect rate and RMA reasons are not available"
              subtitle="Three of the report's KPIs live in Gorgias, and none of them can be approximated from Shopify. Rather than showing a plausible zero, the tab stays empty until the credentials land."
              accent="#f59e0b"
            >
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                <BlockedFeed feed={data.feed} />
              </div>
              <div style={{
                marginTop: "1rem", background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "0.85rem 1rem",
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 800, color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem",
                }}>Order of operations</div>
                <ol style={{ margin: 0, paddingLeft: "1.2rem", color: "#94a3b8", fontSize: 12, lineHeight: 1.75 }}>
                  <li><code style={{ color: "#e2e8f0" }}>GORGIAS_API_KEY</code> and <code style={{ color: "#e2e8f0" }}>GORGIAS_DOMAIN</code> into Railway variables, then redeploy.</li>
                  <li>
                    Create the <code style={{ color: "#e2e8f0" }}>rma_reason</code> ticket field in Gorgias —
                    Manufacturing defect / Shipping damage / Customer misuse / Wrong item / Other.
                    This is the step that decides whether defect analysis is possible; tickets without it
                    are countable but not explainable.
                  </li>
                  <li>Support starts populating the field. Reason distribution needs a few weeks of tagged tickets before it means anything.</li>
                </ol>
              </div>
            </Panel>
          )}

          {data.shopifySignal && (
            <Panel
              title="Shopify returns in flight"
              subtitle={data.shopifySignal.note}
              accent="#a78bfa"
            >
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: data.shopifySignal.count ? "1rem" : 0 }}>
                <Metric
                  label={`Open returns (${days}d)`} icon={RotateCcw}
                  value={data.shopifySignal.count}
                  color={data.shopifySignal.count ? "#a78bfa" : "#22c55e"}
                  coverage="Not a return rate — see the note above"
                />
                <Metric
                  label="Order value involved"
                  value={money(data.shopifySignal.rows.reduce((a, r) => a + r.value, 0))}
                  sub="Full order totals, not the returned lines"
                />
              </div>

              {data.shopifySignal.count > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Order", "Placed", "Return status", "Order value"].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 3 ? "right" : "left",
                            padding: "0.45rem 0.5rem", fontSize: 9.5, fontWeight: 800, color: "#64748b",
                            textTransform: "uppercase", letterSpacing: "0.07em",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.shopifySignal.rows.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "0.45rem 0.5rem", fontWeight: 700, color: "#f1f5f9" }}>{r.name}</td>
                          <td style={{ padding: "0.45rem 0.5rem", color: "#94a3b8" }}>{r.createdAt.slice(0, 10)}</td>
                          <td style={{ padding: "0.45rem 0.5rem", color: "#94a3b8" }}>
                            {r.status?.toLowerCase().replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: "#e2e8f0" }}>{money(r.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
