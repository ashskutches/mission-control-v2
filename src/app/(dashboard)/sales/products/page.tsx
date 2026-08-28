"use client";
/**
 * Sales → Products
 *
 * Every product line that sold in the window, ranked by revenue, through the
 * DEMAND lens: units, orders, basket size, price. Margin rides along where a unit
 * cost resolved, but it is not what this table sorts or reasons about.
 *
 * THIS IS NOT A SECOND COPY OF THE PROFIT TAB'S PRODUCT TABLE.
 * -----------------------------------------------------------
 * The Profit tab renders the same rows from /admin/profitability/products asking a
 * different question: how much of our revenue has a cost behind it, and which
 * missing costs would move coverage the most. That table exists to be emptied —
 * its work list is `topMissing`. This one exists to be read: what is actually
 * selling, in what quantity, at what price, and how many units go in a basket.
 *
 * Same relationship as Marketing → Ads and Profit → Campaigns, which read one
 * endpoint through two lenses on purpose. If the two tables ever need the same
 * column for the same reason, that is the signal to merge them — not before.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, ArrowRight, Package } from "lucide-react";
import {
  BOT_URL, TH, TD, Panel, EmptyState, ShareBar, PeriodPicker,
  money, num, pct, type PeriodKey,
} from "@/components/MarketingShared";

interface Row {
  variantId: string | null;
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  orders: number;
  revenue: number;
  revenueSharePct: number | null;
  unitPrice: number;
  unitCost: number | null;
  costSource: string;
  marginPct: number | null;
  unitsPerOrder: number | null;
}

interface Payload {
  period: { start: string; end: string; label: string };
  coverageFloor: number;
  orders: { orders: number; units: number };
  revenue: { netRevenue: number };
  topProducts: Row[];
  cogsCoverage: number;
  coverageSufficient: boolean;
}

const ACCENT = "#38bdf8";

type SortKey = "revenue" | "quantity" | "orders" | "unitsPerOrder" | "unitPrice";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "revenue",       label: "Revenue" },
  { key: "quantity",      label: "Units" },
  { key: "orders",        label: "Orders" },
  { key: "unitsPerOrder", label: "Units / order" },
  { key: "unitPrice",     label: "Price" },
];

export default function SalesProductsPage() {
  const [period, setPeriod] = useState<PeriodKey>("qtd");
  const [sort, setSort] = useState<SortKey>("revenue");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // limit=100 rather than the dashboard's 15 — this is the full-window read.
      const res = await fetch(`${BOT_URL}/admin/sales/overview?period=${period}&limit=100`);
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Sorted client-side. The server returns revenue order; re-sorting 100 rows in the
  // browser is cheaper than another live Shopify pull per column click.
  const rows = [...(data?.topProducts ?? [])].sort((a, b) => {
    const av = a[sort] ?? -Infinity;
    const bv = b[sort] ?? -Infinity;
    return (bv as number) - (av as number);
  });

  const coveragePct = data ? data.cogsCoverage * 100 : null;

  return (
    <div>
      <PeriodPicker
        value={period}
        onChange={setPeriod}
        right={
          <>
            <span style={{ fontSize: 10, color: "#475569" }}>
              {data ? `${num(rows.length)} products · ${num(data.orders.units)} units` : ""}
            </span>
            <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh products">
              <RefreshCw size={12} className={loading ? "spin" : ""} />
            </button>
          </>
        }
      />

      <Panel
        title="What sold"
        note="Net revenue per product line after line-level and allocated order-level discounts, with the units and baskets behind it. Margin is present only where a unit cost has been entered — an unpriced product reads 'not set', because a zero cost would render as 100% margin."
        right={
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            {SORTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  background: sort === key ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                  color: sort === key ? ACCENT : "#64748b",
                  border: sort === key ? `1px solid ${ACCENT}30` : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 7, padding: "0.2rem 0.6rem", cursor: "pointer",
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {loading && !data ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
        ) : !data ? (
          <EmptyState reason="The sales endpoint returned nothing. It is a live Shopify pull on every request — check /admin/sales/overview before concluding nothing sold." />
        ) : rows.length === 0 ? (
          <EmptyState reason="No product lines in this window. Non-product entries (financing, card rewards) are excluded by design and would not appear here even if they were the only orders." />
        ) : (
          <>
            {!data.coverageSufficient && (
              <div style={{ marginBottom: "0.85rem" }}>
                <EmptyState
                  reason={`Unit-cost coverage is ${pct(coveragePct, 1)}, below the ${pct(data.coverageFloor * 100, 0)} floor. Revenue, units and baskets below are measured; the margin column is only as complete as the costs behind it.`}
                  action={
                    <Link href="/costs" style={{ color: ACCENT, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                      Fill unit costs <ArrowRight size={11} style={{ verticalAlign: "middle" }} />
                    </Link>
                  }
                />
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Product</th>
                    <th style={{ ...TH, textAlign: "left" }}>SKU</th>
                    <th style={TH}>Revenue</th>
                    <th style={TH}>Share</th>
                    <th style={TH}>Units</th>
                    <th style={TH}>Orders</th>
                    <th style={TH}>Units/Order</th>
                    <th style={TH}>Price</th>
                    <th style={TH}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.variantId ?? row.sku}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...TD, textAlign: "left", maxWidth: 260, whiteSpace: "normal" }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{row.title}</div>
                        {row.variantTitle && <div style={{ fontSize: 10, color: "#64748b" }}>{row.variantTitle}</div>}
                        <ShareBar pct={row.revenueSharePct ?? 0} color={ACCENT} />
                      </td>
                      <td style={{ ...TD, textAlign: "left", fontSize: 10, color: "#64748b" }}>{row.sku || "—"}</td>
                      <td style={{ ...TD, color: ACCENT, fontWeight: 700 }}>{money(row.revenue)}</td>
                      <td style={TD}>{pct(row.revenueSharePct, 1)}</td>
                      <td style={TD}>{num(row.quantity)}</td>
                      <td style={TD}>{num(row.orders)}</td>
                      <td style={TD}>{row.unitsPerOrder?.toFixed(2) ?? "—"}</td>
                      <td style={TD}>{money(row.unitPrice, 2)}</td>
                      <td style={TD}>
                        {row.marginPct == null
                          ? <span style={{ color: "#b45309", fontSize: 10 }}>not set</span>
                          : pct(row.marginPct, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 10, color: "#475569", marginTop: "0.85rem", lineHeight: 1.5 }}>
              Capped at the top 100 lines by revenue. Cost coverage and the list of missing
              unit costs — the work list, rather than this read — live on the{" "}
              <Link href="/sales/profit" style={{ color: ACCENT, textDecoration: "none", fontWeight: 700 }}>Profit tab</Link>.
            </p>
          </>
        )}
      </Panel>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: 11, color: "#475569" }}>
        <Package size={13} />
        <span>
          Stock, reorder points and days-to-stockout for these same SKUs are in{" "}
          <Link href="/logistics/inventory" style={{ color: "#22c55e", textDecoration: "none", fontWeight: 700 }}>Logistics → Inventory</Link>.
          What customers buy together is in{" "}
          <Link href="/orders/patterns" style={{ color: "#fb923c", textDecoration: "none", fontWeight: 700 }}>Orders → Patterns</Link>.
        </span>
      </div>
    </div>
  );
}
