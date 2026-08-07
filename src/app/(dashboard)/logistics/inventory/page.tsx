"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import {
  type Degraded, type InventoryRow, type InventorySummary, type LeadTimes,
  type Priority,
  DegradedBar, ErrorBox, Metric, Panel, Pill, PRIORITY_META, Spinner, WindowPicker,
  errMessage, getJSON, orDash,
} from "../shared";

interface InventoryResponse {
  ok: true;
  window: { days: number; since: string };
  summary: InventorySummary;
  leadTimes: LeadTimes;
  rows: InventoryRow[];
  degraded: Degraded[];
}

const FILTERS: { key: Priority | "all"; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "critical",  label: PRIORITY_META.critical.label },
  { key: "high",      label: PRIORITY_META.high.label },
  { key: "medium",    label: PRIORITY_META.medium.label },
  { key: "ok",        label: PRIORITY_META.ok.label },
  { key: "no-demand", label: PRIORITY_META["no-demand"].label },
];

type SortKey = "priority" | "stock" | "daysToStockout" | "velocity" | "product";

export default function LogisticsInventory() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Priority | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<InventoryResponse>(`/admin/logistics/inventory?days=${days}`));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    let out = data?.rows ?? [];
    if (filter !== "all") out = out.filter(r => r.priority === filter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(r =>
        r.product.toLowerCase().includes(needle) ||
        r.variantTitle.toLowerCase().includes(needle) ||
        r.sku.toLowerCase().includes(needle),
      );
    }
    if (sort === "stock") out = [...out].sort((a, b) => a.stock - b.stock);
    if (sort === "velocity") out = [...out].sort((a, b) => b.dailySales - a.dailySales);
    if (sort === "product") out = [...out].sort((a, b) => a.product.localeCompare(b.product));
    if (sort === "daysToStockout") {
      // Nulls last: no velocity means no clock, not "runs out today".
      out = [...out].sort((a, b) => {
        if (a.daysToStockout === null) return 1;
        if (b.daysToStockout === null) return -1;
        return a.daysToStockout - b.daysToStockout;
      });
    }
    // "priority" is the server's own order — leave it untouched.
    return out;
  }, [data, filter, q, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.rows.length ?? 0 };
    for (const r of data?.rows ?? []) c[r.priority] = (c[r.priority] ?? 0) + 1;
    return c;
  }, [data]);

  const s = data?.summary;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <WindowPicker days={days} onChange={setDays} />
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <Search size={12} color="#475569" style={{ position: "absolute", left: 9, top: 8 }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Product or SKU"
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8, padding: "0.3rem 0.6rem 0.3rem 1.6rem", fontSize: 11.5,
              color: "#e2e8f0", width: 190, outline: "none",
            }}
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 8, padding: "0.3rem 0.5rem", fontSize: 11.5, color: "#e2e8f0", outline: "none",
          }}
        >
          <option value="priority">Sort: urgency</option>
          <option value="daysToStockout">Sort: days to stockout</option>
          <option value="stock">Sort: stock level</option>
          <option value="velocity">Sort: sales velocity</option>
          <option value="product">Sort: product name</option>
        </select>
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

      {data && s && (
        <>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Metric label="Tracked SKUs" value={s.trackedSkus} sub={`${s.untrackedSkus} untracked`} />
            <Metric label="Out of stock" value={s.outOfStock}
              color={s.outOfStock ? "#f43f5e" : "#22c55e"}
              sub={`${s.sellingStockoutRatePct}% of selling SKUs · ${s.stockoutRatePct}% of all tracked`} />
            <Metric label="Units on hand" value={s.unitsOnHand.toLocaleString()}
              sub={`${s.dailyUnits} sold/day`} />
            <Metric label="Days on hand" value={orDash(s.daysOnHand)} unit={s.daysOnHand === null ? "" : "d"}
              target="Target 30–60 days" />
          </div>

          {/* Priority filter */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            {FILTERS.map(f => {
              const color = f.key === "all" ? "#94a3b8" : PRIORITY_META[f.key as Priority].color;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    background: active ? `${color}18` : "rgba(255,255,255,0.04)",
                    border: active ? `1px solid ${color}35` : "1px solid rgba(255,255,255,0.07)",
                    color: active ? color : "#64748b",
                    borderRadius: 7, padding: "0.25rem 0.6rem",
                    fontSize: 10.5, fontWeight: 800, cursor: "pointer",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}
                >
                  {f.label} {counts[f.key] ?? 0}
                </button>
              );
            })}
          </div>

          <Panel
            title={`${rows.length} SKU${rows.length === 1 ? "" : "s"}`}
            subtitle={`Reorder point = (daily sales × lead time) + safety stock, safety stock = ${s.serviceLevelZ} × √lead-time × σ of daily demand. Velocity and σ come from the last ${data.window.days} days of orders.`}
            accent="#38bdf8"
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Product", "SKU", "Stock", "Sold/day", "σ", "Lead", "Safety", "ROP", "Days left", "Status"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i <= 1 ? "left" : i === 9 ? "right" : "right",
                        padding: "0.45rem 0.5rem", fontSize: 9.5, fontWeight: 800, color: "#64748b",
                        textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const { color } = PRIORITY_META[r.priority];
                    const emphasise = r.priority === "critical" || r.priority === "high";
                    return (
                      <tr key={r.variantId} style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: emphasise ? `${color}0a` : "transparent",
                      }}>
                        <td style={{ padding: "0.45rem 0.5rem", minWidth: 180 }}>
                          <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{r.product}</div>
                          {r.variantTitle && (
                            <div style={{ fontSize: 10.5, color: "#64748b" }}>{r.variantTitle}</div>
                          )}
                          <div style={{ fontSize: 10.5, color: "#475569" }}>{r.reason}</div>
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#94a3b8", fontSize: 10.5, whiteSpace: "nowrap" }}>
                          {r.sku || "—"}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", fontWeight: 800, color: r.stock <= 0 ? "#f43f5e" : "#e2e8f0" }}>
                          {r.stock}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: "#94a3b8" }}>{r.dailySales}</td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: "#64748b" }}>{r.dailySigma}</td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: r.leadTimeSource === "sku" ? "#94a3b8" : "#64748b" }}>
                          {r.leadTimeDays}d{r.leadTimeSource === "default" ? "*" : ""}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: "#64748b" }}>{r.safetyStock}</td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>{r.rop}</td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: r.daysToStockout !== null && r.daysToStockout < r.leadTimeDays ? "#f59e0b" : "#94a3b8" }}>
                          {orDash(r.daysToStockout)}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>
                          <Pill priority={r.priority} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div style={{ padding: "1.5rem 0", textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
                Nothing matches that filter.
              </div>
            )}

            <div style={{ fontSize: 10.5, color: "#475569", marginTop: "0.8rem", lineHeight: 1.6 }}>
              * using the {s.defaultLeadTimeDays}-day default lead time — set a supplier lead time on the
              Reorder tab to make this SKU&apos;s reorder point real. σ is the standard deviation of daily
              demand; a spiky seller earns more safety stock than a steady one at the same average.
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
