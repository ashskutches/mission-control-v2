"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Clock,
  Loader2, MessageSquare, Package, RefreshCw, Truck,
} from "lucide-react";
import {
  type QueueOrder, type QueueResponse,
  errMessage, money, severityColor, statusLabel,
} from "./types";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

const DAY_OPTIONS = [7, 30, 60, 90, 180];
const SLA_OPTIONS = [1, 2, 3, 5, 7];

// ── One row in the queue ──────────────────────────────────────────────────────
function OrderRow({ order }: { order: QueueOrder }) {
  const color = severityColor(order.severity);
  // The worst reason leads; the rest are listed under it.
  const [lead, ...rest] = [...order.exceptions].sort((a, b) => b.severity - a.severity);
  const tracked = order.fulfillments.find(f => f.trackingUrl);

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Link
        href={`/orders/${order.legacyId}`}
        style={{ textDecoration: "none", display: "block", marginBottom: "0.6rem" }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: `3px solid ${color}`,
            borderRadius: 12,
            padding: "0.9rem 1.1rem",
            display: "flex", alignItems: "flex-start", gap: "1rem",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        >
          {/* Severity chip */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle size={17} color={color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Line 1 — identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{order.name}</span>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                background: `${color}15`, color, border: `1px solid ${color}30`,
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>
                {lead?.label}
              </span>
              {rest.map(e => (
                <span key={e.code} style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: "rgba(255,255,255,0.04)", color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {e.label}
                </span>
              ))}
              {order.alreadyTexted && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: "rgba(6,182,212,0.12)", color: "#06b6d4",
                  border: "1px solid rgba(6,182,212,0.28)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <MessageSquare size={9} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} />
                  Texted
                </span>
              )}
            </div>

            {/* Line 2 — the reason, in words */}
            <div style={{ fontSize: 12.5, color: "#cbd5e1", marginBottom: 5 }}>
              {lead?.detail}
            </div>

            {/* Line 3 — facts */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
              <span>
                {order.customer
                  ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Guest"
                  : "Guest"}
                {order.customer?.orderCount && order.customer.orderCount > 1
                  ? ` · ${order.customer.orderCount} orders`
                  : ""}
              </span>
              <span>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</span>
              <span style={{ color: "#94a3b8", fontWeight: 700 }}>{money(order.total)}</span>
              <span><Clock size={10} style={{ display: "inline", verticalAlign: -1 }} /> {order.ageDays}d old</span>
              <span>{statusLabel(order.fulfillmentStatus)} · {statusLabel(order.financialStatus)}</span>
              {order.city && <span>{order.city}{order.region ? `, ${order.region}` : ""}</span>}
              {tracked?.carrier && <span><Truck size={10} style={{ display: "inline", verticalAlign: -1 }} /> {tracked.carrier}</span>}
            </div>
          </div>

          <ChevronRight size={18} color="#475569" style={{ flexShrink: 0, marginTop: 10 }} />
        </div>
      </Link>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrdersQueuePage() {
  const [data,      setData]      = useState<QueueResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [days,      setDays]      = useState(60);
  const [slaDays,   setSlaDays]   = useState(2);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/orders/queue?days=${days}&slaDays=${slaDays}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setLastFetch(new Date());
    } catch (err) {
      setError(errMessage(err, "Failed to load the orders queue"));
    } finally {
      setLoading(false);
    }
  }, [days, slaDays]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Filtering is local so switching chips doesn't re-hit Shopify.
  const visible = useMemo(() => {
    if (!data) return [];
    if (!activeCode) return data.orders;
    return data.orders.filter(o => o.exceptions.some(e => e.code === activeCode));
  }, [data, activeCode]);

  const critical = data?.orders.filter(o => o.severity >= 90).length ?? 0;
  const oldest   = data?.orders.reduce((m, o) => Math.max(m, o.ageDays), 0) ?? 0;

  const chips = useMemo(() => {
    if (!data) return [];
    // Label + colour come from the orders themselves so backend and UI can't drift.
    const meta = new Map<string, { label: string; severity: number }>();
    for (const o of data.orders) {
      for (const e of o.exceptions) if (!meta.has(e.code)) meta.set(e.code, { label: e.label, severity: e.severity });
    }
    return Object.entries(data.counts)
      .map(([code, count]) => ({ code, count, ...(meta.get(code) ?? { label: code, severity: 0 }) }))
      .sort((a, b) => b.severity - a.severity);
  }, [data]);

  return (
    <div>
      {/* ── Incompleteness warning ──────────────────────────────────────────────
          A short queue and a broken queue must never look the same. */}
      {data && !data.complete && (
        <div style={{
          padding: "0.85rem 1.1rem", borderRadius: 10, marginBottom: "1rem",
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.28)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fb7185", fontWeight: 800, fontSize: 13 }}>
            <AlertCircle size={15} />
            This queue is incomplete — orders are missing
          </div>
          <ul style={{ margin: "0.5rem 0 0 1.5rem", padding: 0, fontSize: 12, color: "#cbd5e1" }}>
            {data.degraded.map((d, i) => (
              <li key={`${d.bucket}-${i}`} style={{ marginBottom: 2 }}>
                <strong style={{ color: "#f1f5f9" }}>{d.label}:</strong> {d.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Need Attention", value: data?.total ?? 0,  color: "#fb923c", icon: Package },
          { label: "Critical",       value: critical,          color: "#f43f5e", icon: AlertTriangle },
          { label: "Oldest",         value: `${oldest}d`,      color: "#fbbf24", icon: Clock },
          { label: "Orders Scanned", value: data?.scanned ?? 0, color: "#64748b", icon: RefreshCw },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{
            padding: "0.85rem 1.1rem", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: "0.75rem",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `${color}15`, border: `1px solid ${color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Window
          </label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#cbd5e1", borderRadius: 8, padding: "0.3rem 0.6rem", fontSize: 12, fontWeight: 700,
            }}
          >
            {DAY_OPTIONS.map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>

          <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginLeft: "0.5rem" }}>
            Ship target
          </label>
          <select
            value={slaDays}
            onChange={e => setSlaDays(Number(e.target.value))}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#cbd5e1", borderRadius: 8, padding: "0.3rem 0.6rem", fontSize: 12, fontWeight: 700,
            }}
          >
            {SLA_OPTIONS.map(d => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {lastFetch && (
            <span style={{ fontSize: 11, color: "#475569" }}>
              Refreshed {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchQueue}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.4rem 0.9rem", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8", fontSize: 12, fontWeight: 700,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Reason filter chips */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            onClick={() => setActiveCode(null)}
            style={{
              padding: "0.28rem 0.75rem", borderRadius: 20, cursor: "pointer",
              background: !activeCode ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${!activeCode ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: !activeCode ? "#fb923c" : "#94a3b8",
              fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
            }}
          >
            All {data?.total ?? 0}
          </button>
          {chips.map(c => {
            const active = activeCode === c.code;
            const col = severityColor(c.severity);
            return (
              <button
                key={c.code}
                onClick={() => setActiveCode(active ? null : c.code)}
                style={{
                  padding: "0.28rem 0.75rem", borderRadius: 20, cursor: "pointer",
                  background: active ? `${col}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? `${col}45` : "rgba(255,255,255,0.08)"}`,
                  color: active ? col : "#94a3b8",
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
                }}
              >
                {c.label} {c.count}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#475569" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: 14 }}>Scanning Shopify for orders that need attention…</p>
        </div>
      ) : error ? (
        <div style={{
          padding: "2rem", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", textAlign: "center",
        }}>
          <AlertCircle size={24} style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Failed to load the orders queue</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>{error}</p>
          <button
            onClick={fetchQueue}
            style={{
              marginTop: "1rem", padding: "0.5rem 1.25rem", borderRadius: 8,
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          padding: "4rem 2rem", borderRadius: 12,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: "0.25rem" }}>
            {activeCode ? "Nothing under that filter" : "Nothing needs attention"}
          </p>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            {activeCode
              ? "Clear the filter to see the rest of the queue."
              : `Scanned ${data?.scanned ?? 0} orders from the last ${days} days. Every one is paid, on time, and moving. 🎉`}
          </p>
        </div>
      ) : (
        <div>
          {visible.map(o => <OrderRow key={o.id} order={o} />)}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
