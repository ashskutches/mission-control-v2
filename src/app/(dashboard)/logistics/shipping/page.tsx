"use client";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  type Feed,
  BlockedFeed, ErrorBox, Panel, Spinner, WindowPicker,
  errMessage, getJSON,
} from "../shared";

interface ShippingResponse {
  ok: true;
  configured: boolean;
  feed: Feed;
  window?: { days: number };
  /**
   * Parsed Falcon cost analysis, when the token is present and it answered in JSON.
   * Untyped on purpose: nobody here has seen a live Falcon payload, and a made-up
   * interface would be a claim about its shape rather than a description of it.
   */
  data?: unknown;
  /** Falcon's prose, when it did not. */
  raw?: string | null;
}

/**
 * Shipping cost analytics. Everything on this tab is Falcon-side: freight cost per
 * unit, cost per order, logistics cost as a share of revenue, storage fees. Shopify
 * knows what the customer paid for shipping, which is a price, not a cost — using it
 * as a proxy would invert the sign on every subsidised-shipping order.
 *
 * With a token present, Falcon's cost analysis is rendered as-is. Its integration
 * module answers in text for the agent tools, so the structured version of this tab
 * is the first job of Phase 2 rather than something guessed at now.
 */
export default function LogisticsShipping() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ShippingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<ShippingResponse>(`/admin/logistics/shipping?days=${days}`));
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
      {loading && !data && <Spinner label="Checking Falcon…" />}

      {data && !data.configured && (
        <Panel
          title="No shipping cost feed"
          subtitle="Freight cost per unit, transportation cost per order and logistics cost as a percentage of revenue all come from Falcon invoices. Shopify's shipping revenue is what customers paid, not what fulfilment cost — it cannot stand in."
          accent="#f59e0b"
        >
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <BlockedFeed feed={data.feed} />
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: "1rem", lineHeight: 1.6 }}>
            Falcon is already integrated for the agent tools (<code style={{ color: "#94a3b8" }}>falcon__get_inventory</code>,
            shipment reports, cost analysis) — the only thing missing is the token. Once it is set,
            this tab shows Falcon&apos;s cost analysis for the selected window, and the per-carrier
            and per-order breakdowns the report specifies follow in Phase 2.
          </div>
        </Panel>
      )}

      {data?.configured && (
        <Panel
          title={`Falcon cost analysis · last ${data.window?.days ?? days} days`}
          subtitle="Straight from Falcon. Per-carrier charts and outlier flagging are Phase 2 — this is the raw analysis so the numbers are visible before the visualisation exists."
          accent="#06b6d4"
        >
          {data.data ? (
            <pre style={{
              background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "0.9rem", fontSize: 11.5, color: "#cbd5e1",
              overflowX: "auto", lineHeight: 1.6, margin: 0,
            }}>{JSON.stringify(data.data, null, 2)}</pre>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "0.9rem", fontSize: 12, color: "#cbd5e1",
              whiteSpace: "pre-wrap", lineHeight: 1.6,
            }}>{data.raw}</div>
          )}
        </Panel>
      )}
    </div>
  );
}
