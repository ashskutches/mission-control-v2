"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Package, RefreshCw, Truck } from "lucide-react";
import { ErrorBox, Metric, Panel, Spinner, errMessage, getJSON } from "../shared";

/**
 * Stock per SKU per warehouse — the replacement for falcon__get_inventory.
 *
 * Why this is a separate tab from Inventory: Inventory answers "what should we buy",
 * keyed on velocity and using Shopify's aggregate `inventoryQuantity`. That aggregate
 * sums EVERY location, and this store has 17 of them — one that ships (Falcon), a few
 * that only hold, and thirteen Shopify Collective / Dropified partners holding their own
 * dropship goods. Measured 2026-08-18: 3,177 units at Falcon, 36 at Easton House, and
 * 967 belonging to partners. That last number is in Shopify's aggregate and is not ours.
 *
 * Two signals follow from the split and exist nowhere else in the dashboard:
 *   • shippable    — units at a location that actually dispatches
 *   • phantom stock — a SKU with units of ours, none of them shippable. Reads as in
 *                     stock everywhere else in Shopify and cannot leave the building.
 */

type LocationKind = "ships" | "holds" | "partner" | "unknown";

interface LocationStock {
  location: string;
  kind: LocationKind;
  available: number;
  onHand: number;
  committed: number;
  incoming: number;
  reserved: number;
}

interface StockRow {
  sku: string;
  product: string;
  title: string;
  unitCost: number | null;
  weightLb: number | null;
  locations: LocationStock[];
  totalAvailable: number;
  totalCommitted: number;
  shippableAvailable: number;
  heldAvailable: number;
  partnerAvailable: number;
  unclassifiedAvailable: number;
  phantomStock: boolean | null;
}

interface StockResponse {
  ok: true;
  locations: { name: string; kind: LocationKind; source: string }[];
  locationNamesFromApi?: boolean;
  unitCostCoverage: { withCost: number; total: number; pct: number };
  incomingKnown: boolean;
  incomingNote: string | null;
  units?: { shippable: number; held: number; partner: number; unclassified: number; ours: number };
  count: number;
  rows: StockRow[];
  fetchedAt: string;
}

const KIND_META: Record<LocationKind, { label: string; color: string }> = {
  ships:     { label: "ships",     color: "#22c55e" },
  holds:     { label: "holds only", color: "#f59e0b" },
  partner:   { label: "dropship partner", color: "#a78bfa" },
  unknown:   { label: "unclassified", color: "#64748b" },
};

const th: React.CSSProperties = {
  textAlign: "left", padding: "0.4rem 0.6rem", fontSize: 9.5, fontWeight: 800,
  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em",
  borderBottom: "1px solid rgba(255,255,255,0.07)", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: 12, color: "#cbd5e1",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

export default function LogisticsWarehouses() {
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "shippable-zero" | "phantom" | "partner">("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJSON<StockResponse>("/admin/logistics/stock"));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    let out = data?.rows ?? [];
    if (filter === "shippable-zero") out = out.filter(r => r.shippableAvailable <= 0 && r.totalAvailable > 0);
    if (filter === "phantom") out = out.filter(r => r.phantomStock === true);
    if (filter === "partner") out = out.filter(r => r.partnerAvailable > 0);
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter(r =>
        r.sku.toLowerCase().includes(needle) || r.product.toLowerCase().includes(needle));
    }
    return [...out].sort((a, b) => b.shippableAvailable - a.shippableAvailable);
  }, [data, filter, q]);

  const perLocation = useMemo(() => {
    const map = new Map<string, { kind: LocationKind; available: number; committed: number; skus: number }>();
    for (const r of data?.rows ?? []) {
      for (const l of r.locations) {
        const row = map.get(l.location) ?? { kind: l.kind, available: 0, committed: 0, skus: 0 };
        row.available += l.available;
        row.committed += l.committed;
        if (l.available > 0) row.skus++;
        map.set(l.location, row);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].available - a[1].available);
  }, [data]);

  const units = data?.units;
  const phantoms = (data?.rows ?? []).filter(r => r.phantomStock === true);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search SKU or product…"
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0", borderRadius: 8, padding: "0.35rem 0.7rem", fontSize: 12, minWidth: 220,
          }}
        />
        {([
          ["all", "All"],
          ["shippable-zero", "Nothing shippable"],
          ["phantom", "Phantom stock"],
          ["partner", "Partner-held"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === key ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.1)"}`,
              color: filter === key ? "#38bdf8" : "#94a3b8",
              borderRadius: 8, padding: "0.3rem 0.7rem", fontSize: 10.5, fontWeight: 800,
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >{label}</button>
        ))}
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
      {loading && !data && <Spinner label="Reading stock from Shopify…" />}

      {data && (
        <>
          <Panel
            title="Where the stock is"
            subtitle="From Shopify's per-location inventory levels — the same data a 3PL API would return, for the warehouse the 3PL runs."
            accent="#22c55e"
          >
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <Metric label="Shippable" value={units?.shippable ?? 0} icon={Truck}
                color="#22c55e" sub="units at a location that dispatches" />
              <Metric label="Held, not shippable" value={units?.held ?? 0} icon={Building2}
                color={(units?.held ?? 0) > 0 ? "#f59e0b" : "#e2e8f0"}
                sub="ours, but it cannot leave by post" />
              <Metric label="Partner dropship" value={units?.partner ?? 0} icon={Package}
                color="#a78bfa" sub="Collective / Dropified — not ours to reorder" />
              <Metric label="Phantom-stock SKUs" value={phantoms.length} icon={AlertTriangle}
                color={phantoms.length > 0 ? "#f43f5e" : "#22c55e"}
                sub="in stock per Shopify, unshippable in fact" />
              <Metric label="Unit cost known" value={data.unitCostCoverage.pct} unit="%"
                sub={`${data.unitCostCoverage.withCost} of ${data.unitCostCoverage.total} SKUs`}
                coverage={data.unitCostCoverage.pct < 50 ? "inventory VALUE not computable" : undefined} />
            </div>

            {data.incomingNote && (
              <div style={{
                marginTop: "0.9rem", background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10,
                padding: "0.7rem 0.9rem", fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.6,
              }}>
                <strong style={{ color: "#f59e0b" }}>Inbound stock is unknown.</strong>{" "}
                {data.incomingNote}
              </div>
            )}

            {data.locationNamesFromApi === false && (
              <div style={{ marginTop: "0.6rem", fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
                Warehouse names come from a local map, not from Shopify — the app&apos;s token lacks the{" "}
                <code style={{ color: "#94a3b8" }}>read_locations</code> scope. Stock numbers are
                unaffected (they key on location id); a location added since the map was written
                would appear as <em>unclassified</em>.
              </div>
            )}
          </Panel>

          <Panel title="Per location" accent="#38bdf8">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={th}>Location</th>
                    <th style={th}>Role</th>
                    <th style={th}>Available</th>
                    <th style={th}>Committed</th>
                    <th style={th}>SKUs in stock</th>
                  </tr>
                </thead>
                <tbody>
                  {perLocation.map(([name, row]) => (
                    <tr key={name}>
                      <td style={{ ...td, fontWeight: 600, color: "#e2e8f0" }}>{name}</td>
                      <td style={td}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                          background: `${KIND_META[row.kind].color}15`,
                          color: KIND_META[row.kind].color,
                          border: `1px solid ${KIND_META[row.kind].color}30`,
                          textTransform: "uppercase", letterSpacing: "0.07em",
                        }}>{KIND_META[row.kind].label}</span>
                      </td>
                      <td style={td}>{row.available}</td>
                      <td style={td}>{row.committed}</td>
                      <td style={td}>{row.skus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {phantoms.length > 0 && filter === "all" && (
            <Panel
              title="Phantom stock"
              subtitle="These SKUs have units we own and none of them at a warehouse that ships, so Shopify's aggregate reads 'in stock' and nothing can actually be sent."
              accent="#f43f5e"
            >
              {phantoms.map(r => (
                <div key={r.sku} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>
                  <code style={{ color: "#f1f5f9" }}>{r.sku}</code> — {r.totalAvailable} units at{" "}
                  {r.locations.filter(l => l.available > 0).map(l => `${l.location} (${l.available})`).join(", ")}
                </div>
              ))}
            </Panel>
          )}

          <Panel title={`Stock by SKU · ${rows.length} of ${data.count}`} accent="#94a3b8">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={th}>SKU</th>
                    <th style={th}>Product</th>
                    <th style={th}>Shippable</th>
                    <th style={th}>Held</th>
                    <th style={th}>Partner</th>
                    <th style={th}>Committed</th>
                    <th style={th}>Where</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 300).map(r => (
                    <tr key={r.sku || r.product}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <code style={{ color: "#f1f5f9" }}>{r.sku || "—"}</code>
                      </td>
                      <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.product, r.title].filter(Boolean).join(" · ")}
                      </td>
                      <td style={{
                        ...td, fontWeight: 700,
                        color: r.shippableAvailable > 0 ? "#22c55e" : r.totalAvailable > 0 ? "#f43f5e" : "#64748b",
                      }}>{r.shippableAvailable}</td>
                      <td style={td}>{r.heldAvailable || "—"}</td>
                      <td style={{ ...td, color: r.partnerAvailable ? "#a78bfa" : "#64748b" }}>
                        {r.partnerAvailable || "—"}
                      </td>
                      <td style={td}>{r.totalCommitted || "—"}</td>
                      <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>
                        {r.locations.filter(l => l.available > 0).map(l => l.location).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 300 && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: "0.6rem" }}>
                Showing the first 300 of {rows.length} — narrow it with the search box.
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
