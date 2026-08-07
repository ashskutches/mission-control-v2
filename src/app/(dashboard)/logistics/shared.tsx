"use client";
import React from "react";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";

/**
 * Shared types and chrome for the Logistics section.
 *
 * Every type here mirrors a payload from /admin/logistics (gravity-claw
 * src/routes/logistics.ts). When a field's meaning is non-obvious the explanation
 * lives on the server next to the arithmetic — this file only names the shape.
 */

export const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

export const DAY_OPTIONS = [7, 30, 60, 90];

export type Priority = "critical" | "high" | "medium" | "ok" | "no-demand";

export interface InventoryRow {
  variantId: string;
  productId: string;
  product: string;
  variantTitle: string;
  sku: string;
  stock: number;
  tracked: boolean;
  dailySales: number;
  dailySigma: number;
  unitsSold: number;
  leadTimeDays: number;
  leadTimeSource: "sku" | "default";
  safetyStock: number;
  rop: number;
  daysToStockout: number | null;
  daysCoverAfterRop: number | null;
  reorderQty: number;
  estArrival: string;
  priority: Priority;
  reason: string;
}

export interface InventorySummary {
  trackedSkus: number;
  untrackedSkus: number;
  outOfStock: number;
  atOrBelowRop: number;
  approachingRop: number;
  /** KPI 1 over the whole tracked catalogue — includes retired colourways. */
  stockoutRatePct: number;
  stockoutTargetPct: number;
  /** KPI 1 over SKUs with sales in the window. This is the one worth acting on. */
  sellingSkus: number;
  sellingOutOfStock: number;
  sellingStockoutRatePct: number;
  unitsOnHand: number;
  dailyUnits: number;
  daysOnHand: number | null;
  serviceLevelZ: number;
  defaultLeadTimeDays: number;
  skusWithOwnLeadTime: number;
}

export interface LeadTimes {
  default: number;
  bySku: Record<string, number>;
}

export interface Fulfillment {
  orders: number;
  cancelled: number;
  cycleTime: {
    avgDays: number | null;
    avgDays7d: number | null;
    targetDays: number;
    coverage: number;
    unfulfilled: number;
    trend: { day: string; avgDays: number; orders: number }[];
  };
  /**
   * Delivery speed as Shopify can actually measure it. There is no on-time-vs-carrier
   * -promise field here on purpose: Shopify rewrites estimatedDeliveryAt to the
   * delivery date, so that comparison measures its bookkeeping, not the carrier.
   * KPI 2 stays on the blocked list until Falcon is connected.
   */
  delivery: {
    transitAvgDays: number | null;
    toCustomerAvgDays: number | null;
    slaDays: number;
    slaTargetPct: number;
    withinSlaPct: number | null;
    breached: number;
    coverage: number;
    coveragePct: number;
    note: string;
  };
  revenue: { windowTotal: number; perDay: number };
}

export interface Feed {
  key: string;
  label: string;
  configured: boolean;
  env: string[];
  blocks: string[];
  how: string;
}

export interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href?: string;
}

export interface Degraded { feed: string; error: string }

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  critical:    { label: "Reorder now", color: "#f43f5e" },
  high:        { label: "Order soon",  color: "#f59e0b" },
  medium:      { label: "Watch",       color: "#38bdf8" },
  ok:          { label: "Healthy",     color: "#22c55e" },
  "no-demand": { label: "No demand",   color: "#64748b" },
};

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BOT_URL}${path}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // An HTML error page from a proxy is the usual cause; the first line of it is
    // far more useful than "Unexpected token <".
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 120)}`);
  }
  const body = json as { error?: string } | null;
  if (!res.ok || body?.error) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return json as T;
}

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** A dash, not a zero. Every "unknown" on this page must be visibly unknown. */
export function orDash(n: number | null | undefined, suffix = ""): string {
  return n === null || n === undefined ? "—" : `${n}${suffix}`;
}

// ── Chrome ────────────────────────────────────────────────────────────────────

export function Panel({
  title, subtitle, right, children, accent = "#22c55e",
}: {
  title?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "1.1rem 1.2rem", marginBottom: "1rem",
    }}>
      {(title || right) && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "1rem",
          marginBottom: subtitle ? "0.15rem" : "0.9rem",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <h2 style={{
                fontSize: 11, fontWeight: 800, color: accent,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>{title}</h2>
            )}
          </div>
          {right}
        </div>
      )}
      {subtitle && (
        <p style={{ color: "#64748b", fontSize: 12, marginBottom: "0.9rem" }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

/**
 * One KPI. `target` is printed next to the value rather than used to colour it —
 * the colour is passed in, because "over target" is bad for cost and good for
 * on-time delivery and the tile cannot know which it is holding.
 */
export function Metric({
  label, value, unit, target, sub, color = "#e2e8f0", icon: Icon, coverage,
}: {
  label: string; value: string | number; unit?: string; target?: string;
  sub?: string; color?: string; icon?: LucideIcon; coverage?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "0.9rem 1rem", flex: "1 1 180px", minWidth: 165,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: 6 }}>
        {Icon && <Icon size={12} color="#64748b" />}
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: "#64748b",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{unit}</span>}
      </div>
      {target && <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>{target}</div>}
      {sub && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
      {coverage && (
        <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>{coverage}</div>
      )}
    </div>
  );
}

export function Pill({ priority }: { priority: Priority }) {
  const { label, color } = PRIORITY_META[priority];
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
      background: `${color}15`, color, border: `1px solid ${color}30`,
      textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function Spinner({ label = "Reading Shopify…" }: { label?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.6rem",
      color: "#64748b", fontSize: 13, padding: "2.5rem 0", justifyContent: "center",
    }}>
      <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.28)",
      borderRadius: 12, padding: "0.9rem 1.1rem", marginBottom: "1rem",
      display: "flex", alignItems: "flex-start", gap: "0.7rem",
    }}>
      <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#fda4af", marginBottom: 2 }}>
          This tab could not load
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", wordBreak: "break-word" }}>{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#e2e8f0", borderRadius: 8, padding: "0.3rem 0.7rem",
          fontSize: 11, fontWeight: 700, cursor: "pointer",
        }}>Retry</button>
      )}
    </div>
  );
}

/**
 * Named partial failures. A short list and a broken list must not look the same —
 * same rule the orders queue follows.
 */
export function DegradedBar({ degraded }: { degraded?: Degraded[] }) {
  if (!degraded?.length) return null;
  return (
    <div style={{
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem", fontSize: 11.5, color: "#fcd34d",
    }}>
      <strong>Partial data.</strong>{" "}
      {degraded.map(d => `${d.feed} failed (${d.error})`).join("; ")}. Figures below are computed
      from what did answer.
    </div>
  );
}

/**
 * A feed we cannot read, the env vars that would fix it, and — the point of the
 * card — the exact figures that stay blank until then.
 */
export function BlockedFeed({ feed }: { feed: Feed }) {
  const color = feed.configured ? "#22c55e" : "#f59e0b";
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}25`, borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: "0.9rem 1.1rem", flex: "1 1 320px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5, color: "#f1f5f9" }}>{feed.label}</span>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20,
          background: `${color}15`, color, border: `1px solid ${color}30`,
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>{feed.configured ? "connected" : "not connected"}</span>
      </div>
      {feed.env.length > 0 && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
          {feed.env.map(e => (
            <code key={e} style={{
              background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 5,
              marginRight: 5, fontSize: 10.5, color: "#e2e8f0",
            }}>{e}</code>
          ))}
        </div>
      )}
      <div style={{
        fontSize: 9.5, fontWeight: 800, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.08em", margin: "0.6rem 0 0.3rem",
      }}>
        {feed.configured ? "Powers" : "Blank until connected"}
      </div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#94a3b8", fontSize: 11.5, lineHeight: 1.6 }}>
        {feed.blocks.map(b => <li key={b}>{b}</li>)}
      </ul>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: "0.6rem", lineHeight: 1.5 }}>{feed.how}</div>
    </div>
  );
}

/** Day-window selector. Same control on every tab so the windows stay comparable. */
export function WindowPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
      <span style={{
        fontSize: 9.5, fontWeight: 800, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 2,
      }}>Window</span>
      {DAY_OPTIONS.map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          style={{
            background: days === d ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
            border: days === d ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.08)",
            color: days === d ? "#22c55e" : "#64748b",
            borderRadius: 7, padding: "0.2rem 0.55rem", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
          }}
        >{d}d</button>
      ))}
    </div>
  );
}
