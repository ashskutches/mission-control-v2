"use client";
import React, { useState, useCallback } from "react";
import {
  AlertCircle, BarChart3, Ban, Boxes, Info, Loader2, Package, RefreshCw,
  ShieldAlert, TrendingUp,
} from "lucide-react";
import { errMessage } from "../types";

/**
 * Orders → Buying Patterns.
 *
 * Reads GET /admin/profitability/observations, which pulls months of orders live from
 * Shopify and turns co-purchase statistics into ranked observations.
 *
 * Two deliberate departures from the other Orders tabs:
 *
 *  1. It does NOT load on mount. The pull is one Shopify request per 50 orders, so a
 *     180-day window is ~17 requests and tens of seconds. Auto-running that every
 *     time someone clicks the tab spends real API budget on a page they may be
 *     passing through, so the run is an explicit button.
 *  2. Every observation shows its arithmetic. The point of this tab is deciding
 *     whether to act on a pattern, and a recommendation whose basis you cannot see
 *     is one you have to take on faith.
 */

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

type Kind = "concentration" | "bundle" | "attach_gap" | "false_signal" | "not_measured";

interface Observation {
  id: string;
  kind: Kind;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: string;
  basis: string;
  evidence: Record<string, number | string | null>;
}

interface Coverage {
  ordersPulled: number;
  basketsAnalysed: number;
  singleItemOrders: number;
  partialSkipped: number;
  products: number;
  pairsFound: number;
  reconciled: boolean;
  lineReconciliationDelta: number;
}

interface Payload {
  periodStart: string;
  periodEnd: string;
  observations: Observation[];
  coverage: Coverage;
}

const KIND_STYLE: Record<Kind, { color: string; icon: React.ElementType; label: string }> = {
  concentration: { color: "#fb923c", icon: Boxes,       label: "Concentration" },
  bundle:        { color: "#34d399", icon: Package,     label: "Real pairing" },
  attach_gap:    { color: "#06b6d4", icon: TrendingUp,  label: "Addressable gap" },
  false_signal:  { color: "#f43f5e", icon: Ban,         label: "Looks real — isn't" },
  not_measured:  { color: "#94a3b8", icon: ShieldAlert, label: "Not measured" },
};

const PRIORITY_LABEL = { high: "Act on this", medium: "Worth a look", low: "Context" };

const WINDOWS = [
  { days: 90,  label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "1 year" },
];

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 800, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: warn ? "#fb923c" : "#f1f5f9" }}>
        {value}
      </div>
    </div>
  );
}

export default function BuyingPatternsPage() {
  const [days,    setDays]    = useState(180);
  const [data,    setData]    = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [openBasis, setOpenBasis] = useState<Record<string, boolean>>({});

  const run = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability/observations?days=${windowDays}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as Payload);
    } catch (err) {
      setError(errMessage(err, "Could not read buying patterns"));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap",
        marginBottom: "1rem",
      }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {WINDOWS.map(w => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              disabled={loading}
              style={{
                padding: "0.3rem 0.8rem", borderRadius: 8,
                cursor: loading ? "not-allowed" : "pointer",
                background: days === w.days ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${days === w.days ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: days === w.days ? "#34d399" : "#64748b",
                fontSize: 11, fontWeight: 700,
              }}
            >
              {w.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => run(days)}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.4rem 1rem", borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)",
            color: "#34d399", fontSize: 12, fontWeight: 800,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
            : data ? <RefreshCw size={12} /> : <BarChart3 size={12} />}
          {loading ? "Reading orders…" : data ? "Run again" : "Analyse orders"}
        </button>

        <span style={{ fontSize: 10.5, color: "#475569" }}>
          Reads live from Shopify — roughly one request per 50 orders, so this takes a
          little while.
        </span>
      </div>

      {loading && !data && (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#475569" }}>
          <Loader2 size={30} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: 13 }}>Pulling {days} days of orders and counting baskets…</p>
        </div>
      )}

      {error && (
        <div style={{
          padding: "1rem 1.25rem", borderRadius: 12, marginBottom: "1rem",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", fontSize: 13,
        }}>
          <AlertCircle size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{
          padding: "2.5rem 1.5rem", borderRadius: 12, textAlign: "center",
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
        }}>
          <TrendingUp size={26} color="#334155" style={{ marginBottom: "0.75rem" }} />
          <p style={{ fontSize: 13.5, color: "#94a3b8", fontWeight: 700, marginBottom: "0.35rem" }}>
            Nothing analysed yet
          </p>
          <p style={{ fontSize: 12, color: "#64748b", maxWidth: 520, margin: "0 auto" }}>
            Pick a window and run it. This looks at which products share a basket across
            every order in that period — what genuinely goes together, what only looks
            like it does, and how many orders are leaving without the companion product.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* What the advice rests on */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "1rem", padding: "0.9rem 1.15rem", borderRadius: 12, marginBottom: "1rem",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <Stat label="Orders read"   value={data.coverage.ordersPulled.toLocaleString()} />
            <Stat label="Baskets"       value={data.coverage.basketsAnalysed.toLocaleString()} />
            <Stat label="Single-item"   value={data.coverage.singleItemOrders.toLocaleString()} />
            <Stat label="Products"      value={data.coverage.products} />
            <Stat label="Pairs found"   value={data.coverage.pairsFound} />
            <Stat
              label="Reconciled"
              value={data.coverage.reconciled ? "Yes" : "NO"}
              warn={!data.coverage.reconciled}
            />
          </div>

          {data.coverage.partialSkipped > 0 && (
            <div style={{
              display: "flex", gap: "0.5rem", alignItems: "flex-start",
              padding: "0.6rem 0.9rem", borderRadius: 10, marginBottom: "1rem",
              background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.2)",
              fontSize: 11.5, color: "#fdba74",
            }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {data.coverage.partialSkipped} order(s) had more line items than can be read in
                one page and were left out rather than counted as partial baskets — counting
                them would understate every pairing below.
              </span>
            </div>
          )}

          {/* Observations */}
          {data.observations.map(obs => {
            const s = KIND_STYLE[obs.kind] ?? KIND_STYLE.not_measured;
            const Icon = s.icon;
            const showBasis = !!openBasis[obs.id];
            return (
              <div key={obs.id} style={{
                padding: "1rem 1.15rem", borderRadius: 12, marginBottom: "0.7rem",
                background: `${s.color}0a`,
                border: `1px solid ${s.color}26`, borderLeft: `3px solid ${s.color}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  flexWrap: "wrap", marginBottom: "0.5rem",
                }}>
                  <Icon size={14} color={s.color} />
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, color: s.color,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    {s.label}
                  </span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    {PRIORITY_LABEL[obs.priority]}
                  </span>
                </div>

                <div style={{
                  fontSize: 14, fontWeight: 800, color: "#f1f5f9", marginBottom: "0.4rem",
                  lineHeight: 1.4,
                }}>
                  {obs.title}
                </div>

                <p style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.65, marginBottom: obs.action ? "0.55rem" : 0 }}>
                  {obs.detail}
                </p>

                {obs.action && (
                  <p style={{
                    fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.6, fontWeight: 600,
                    paddingLeft: "0.7rem", borderLeft: `2px solid ${s.color}55`,
                  }}>
                    {obs.action}
                  </p>
                )}

                <button
                  onClick={() => setOpenBasis(p => ({ ...p, [obs.id]: !p[obs.id] }))}
                  style={{
                    marginTop: "0.6rem", padding: 0, background: "none", border: "none",
                    cursor: "pointer", color: "#64748b", fontSize: 10.5, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}
                >
                  {showBasis ? "Hide the maths" : "Show the maths"}
                </button>

                {showBasis && (
                  <div style={{
                    marginTop: "0.5rem", padding: "0.6rem 0.75rem", borderRadius: 8,
                    background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.06)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 11, color: "#a5f3fc", lineHeight: 1.7, whiteSpace: "pre-wrap",
                  }}>
                    {obs.basis}
                  </div>
                )}
              </div>
            );
          })}

          <p style={{ fontSize: 10.5, color: "#475569", marginTop: "1rem" }}>
            Window {data.periodStart.slice(0, 10)} to {data.periodEnd.slice(0, 10)}. Counts only —
            no revenue uplift is projected anywhere on this page, because nothing here can
            support one.
          </p>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
