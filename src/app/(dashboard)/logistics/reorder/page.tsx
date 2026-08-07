"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, RefreshCw, Timer } from "lucide-react";
import {
  type Degraded, type InventoryRow, type InventorySummary, type LeadTimes,
  BOT_URL, DegradedBar, ErrorBox, Metric, Panel, Pill, Spinner, WindowPicker,
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

/**
 * The Reorder tab. Two things, in the order they need doing:
 *
 *   1. the purchase list — what to buy, how much, and when it lands
 *   2. the lead times that list is computed from
 *
 * The lead-time editor is on the same page rather than in settings because the
 * numbers above it are only as real as the lead times below it, and the report's
 * own blocker list has "no supplier lead time database" as the one thing nobody
 * else can supply for us. Seeing the recommendation move when you fix a lead time
 * is the whole point.
 *
 * PO generation (the report's Phase 3) is deliberately not here. Copying the list
 * out is honest about where purchasing actually happens today; a "Generate PO"
 * button that only writes a task would look like it ordered something.
 */
export default function LogisticsReorder() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Lead-time editor state. `edits` holds only what the user touched, so a reload
  // underneath an open editor cannot silently revert a field they are typing in.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [defaultEdit, setDefaultEdit] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJSON<InventoryResponse>(`/admin/logistics/inventory?days=${days}`);
      setData(res);
      setDefaultEdit(String(res.leadTimes.default));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const toOrder = useMemo(
    () => (data?.rows ?? []).filter(r => r.priority === "critical" || r.priority === "high"),
    [data],
  );

  // Every SKU that has its own lead time, plus every SKU we are recommending a
  // purchase for — the two sets you would want to edit.
  const editable = useMemo(() => {
    const rows = data?.rows ?? [];
    const withOwn = new Set(Object.keys(data?.leadTimes.bySku ?? {}));
    return rows
      .filter(r => r.sku && (withOwn.has(r.sku) || r.priority === "critical" || r.priority === "high"))
      .filter((r, i, all) => all.findIndex(x => x.sku === r.sku) === i);
  }, [data]);

  const dirty = Object.keys(edits).length > 0 ||
    (data ? defaultEdit !== String(data.leadTimes.default) : false);

  async function save() {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const bySku: Record<string, number | null> = {};
      for (const [sku, raw] of Object.entries(edits)) {
        bySku[sku] = raw.trim() === "" ? null : Number(raw);
      }
      const res = await fetch(`${BOT_URL}/admin/logistics/lead-times`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default: Number(defaultEdit), bySku }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error ?? `${res.status} ${res.statusText}`);
      setEdits({});
      setSaved(true);
      // Reload so every reorder point recomputes against the lead times just saved.
      await load();
    } catch (err) {
      setSaveError(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function copyList() {
    if (!toOrder.length) return;
    const lines = [
      "Product\tVariant\tSKU\tOn hand\tROP\tOrder qty\tLead days\tEst. arrival\tWhy",
      ...toOrder.map(r => [
        r.product, r.variantTitle, r.sku, r.stock, r.rop, r.reorderQty,
        r.leadTimeDays, r.estArrival, r.reason,
      ].join("\t")),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const s = data?.summary;
  const unitsToOrder = toOrder.reduce((a, r) => a + r.reorderQty, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <WindowPicker days={days} onChange={setDays} />
        <div style={{ flex: 1 }} />
        <button
          onClick={copyList}
          disabled={!toOrder.length}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.35rem",
            background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
            border: copied ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.1)",
            color: copied ? "#22c55e" : "#94a3b8", borderRadius: 8, padding: "0.3rem 0.7rem",
            fontSize: 10.5, fontWeight: 800, cursor: toOrder.length ? "pointer" : "default",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          {copied ? <Check size={11} /> : <ClipboardCopy size={11} />}
          {copied ? "Copied" : "Copy purchase list"}
        </button>
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
            <Metric label="SKUs to order" value={toOrder.length}
              color={toOrder.length ? "#f59e0b" : "#22c55e"}
              sub={`${s.atOrBelowRop} at or below ROP`} />
            <Metric label="Units to order" value={unitsToOrder.toLocaleString()}
              sub="One month of cover per SKU, minimum back to ROP" />
            <Metric label="Default lead time" value={s.defaultLeadTimeDays} unit="d" icon={Timer}
              sub={`${s.skusWithOwnLeadTime} SKUs have their own`} />
            <Metric label="Service level" value={`${Math.round(95)}`} unit="%"
              sub={`Z = ${s.serviceLevelZ} in the safety-stock term`} />
          </div>

          {/* ── Purchase list ───────────────────────────────────────────────── */}
          <Panel
            title="Buy now"
            subtitle="Everything at or below its reorder point, plus everything that reaches it inside 10 days. Estimated arrival is today plus the lead time — it assumes the PO goes out today."
            accent="#f59e0b"
          >
            {toOrder.length === 0 ? (
              <div style={{ padding: "1.2rem 0", color: "#22c55e", fontSize: 12.5, fontWeight: 600 }}>
                Nothing is at its reorder point. Every tracked SKU has more than 10 days of cover
                above ROP at the current sales rate.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Product", "On hand", "ROP", "Order qty", "Lead", "Est. arrival", "Days left", "Priority"].map((h, i) => (
                        <th key={h} style={{
                          textAlign: i === 0 ? "left" : i === 5 || i === 7 ? "left" : "right",
                          padding: "0.45rem 0.5rem", fontSize: 9.5, fontWeight: 800, color: "#64748b",
                          textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {toOrder.map(r => (
                      <tr key={r.variantId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.5rem", minWidth: 190 }}>
                          <div style={{ fontWeight: 700, color: "#f1f5f9" }}>
                            {r.product}{r.variantTitle ? ` — ${r.variantTitle}` : ""}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#475569" }}>
                            {r.sku || "no SKU"} · {r.reason}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 800, color: r.stock <= 0 ? "#f43f5e" : "#e2e8f0" }}>{r.stock}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#94a3b8" }}>{r.rop}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 800, color: "#f59e0b" }}>{r.reorderQty}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: r.leadTimeSource === "sku" ? "#94a3b8" : "#64748b" }}>
                          {r.leadTimeDays}d{r.leadTimeSource === "default" ? "*" : ""}
                        </td>
                        <td style={{ padding: "0.5rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{r.estArrival}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#94a3b8" }}>{orDash(r.daysToStockout)}</td>
                        <td style={{ padding: "0.5rem" }}><Pill priority={r.priority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Lead times ──────────────────────────────────────────────────── */}
          <Panel
            title="Supplier lead times"
            subtitle="Days from placing a PO to stock on the shelf. Reorder points cannot be right without these — a SKU with no entry falls back to the default and is marked * above. Blank a field to return it to the default."
            accent="#a78bfa"
            right={
              <button
                onClick={save}
                disabled={!dirty || saving}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.35rem",
                  background: dirty ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)",
                  border: dirty ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  color: dirty ? "#a78bfa" : "#475569", borderRadius: 8, padding: "0.3rem 0.8rem",
                  fontSize: 10.5, fontWeight: 800, cursor: dirty && !saving ? "pointer" : "default",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save lead times"}
              </button>
            }
          >
            {saveError && <ErrorBox message={saveError} />}

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>Default for every other SKU</span>
              <input
                type="number" min={1} max={365}
                value={defaultEdit}
                onChange={e => setDefaultEdit(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "0.25rem 0.5rem", fontSize: 12, color: "#e2e8f0",
                  width: 70, outline: "none",
                }}
              />
              <span style={{ fontSize: 11.5, color: "#64748b" }}>days</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["SKU", "Product", "Lead time (days)", "In use", "Effect on ROP"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i >= 2 ? "left" : "left",
                        padding: "0.45rem 0.5rem", fontSize: 9.5, fontWeight: 800, color: "#64748b",
                        textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editable.map(r => {
                    const stored = data.leadTimes.bySku[r.sku];
                    const value = edits[r.sku] ?? (stored !== undefined ? String(stored) : "");
                    return (
                      <tr key={r.sku} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{r.sku}</td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#94a3b8" }}>
                          {r.product}{r.variantTitle ? ` — ${r.variantTitle}` : ""}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem" }}>
                          <input
                            type="number" min={1} max={365}
                            value={value}
                            placeholder={String(data.leadTimes.default)}
                            onChange={e => setEdits(prev => ({ ...prev, [r.sku]: e.target.value }))}
                            style={{
                              background: "rgba(255,255,255,0.05)", border: `1px solid ${edits[r.sku] !== undefined ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.1)"}`,
                              borderRadius: 7, padding: "0.2rem 0.45rem", fontSize: 12, color: "#e2e8f0",
                              width: 72, outline: "none",
                            }}
                          />
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", color: r.leadTimeSource === "sku" ? "#a78bfa" : "#64748b", fontSize: 11 }}>
                          {r.leadTimeDays}d {r.leadTimeSource === "sku" ? "(own)" : "(default)"}
                        </td>
                        <td style={{ padding: "0.45rem 0.5rem", color: "#64748b", fontSize: 11 }}>
                          ROP {r.rop} = {r.dailySales}/day × {r.leadTimeDays}d + {r.safetyStock} safety
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editable.length === 0 && (
              <div style={{ padding: "1.2rem 0", color: "#64748b", fontSize: 12.5 }}>
                No SKU needs a lead time yet — nothing is near its reorder point. Any SKU that
                appears in the purchase list becomes editable here.
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
