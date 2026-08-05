"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Phone, Mail, RefreshCw, Send, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, User, ShoppingBag,
  Clock, Loader2, MessageSquare,
} from "lucide-react";
import { errMessage } from "../types";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  name:         string;
  quantity:     number;
  sku:          string | null;
  variantTitle: string | null;
  unitPrice:    { amount: string; currencyCode: string };
}

interface BackorderOrder {
  id:               string;
  name:             string;
  createdAt:        string;
  tags:             string[];
  fulfillmentStatus: string;
  financialStatus:  string;
  totalPrice:       { amount: string; currencyCode: string };
  alreadyTexted:    boolean;
  phone:            string | null;
  customer: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
    phone:     string | null;
    tags:      string[];
  } | null;
  lineItems: LineItem[];
}

// ── Default SMS template ──────────────────────────────────────────────────────
function buildDefaultMessage(order: BackorderOrder): string {
  const firstName = order.customer?.firstName || "there";
  const items = order.lineItems
    .map(li => `${li.name}${li.variantTitle ? ` (${li.variantTitle})` : ""} x${li.quantity}`)
    .join(", ");
  return `Hi ${firstName}! Your order ${order.name} (${items}) is currently on backorder. Would you like to switch to a different variant, or are you happy to keep waiting? Reply here and we'll sort it out! 😊`;
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onSendSms,
}: {
  order:      BackorderOrder;
  onSendSms:  (order: BackorderOrder, message: string) => Promise<void>;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [message,   setMessage]   = useState(() => buildDefaultMessage(order));
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(order.alreadyTexted);
  const [error,     setError]     = useState<string | null>(null);

  const daysOld = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleSend = async () => {
    if (!order.phone) return;
    setSending(true);
    setError(null);
    try {
      await onSendSms(order, message);
      setSent(true);
    } catch (err) {
      setError(errMessage(err, "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: sent
          ? "rgba(6,182,212,0.05)"
          : "rgba(255,255,255,0.03)",
        border: sent
          ? "1px solid rgba(6,182,212,0.25)"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        marginBottom: "0.75rem",
        overflow: "hidden",
        transition: "border-color 0.3s, background 0.3s",
      }}
    >
      {/* Main row */}
      <div style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>

          {/* Order icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: sent ? "rgba(6,182,212,0.12)" : "rgba(251,146,60,0.1)",
            border: `1px solid ${sent ? "rgba(6,182,212,0.3)" : "rgba(251,146,60,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShoppingBag size={18} color={sent ? "#06b6d4" : "#fb923c"} />
          </div>

          {/* Order info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{order.name}</span>
              {sent && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                  background: "rgba(6,182,212,0.15)", color: "#06b6d4",
                  border: "1px solid rgba(6,182,212,0.3)", textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  ✓ Texted
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: "rgba(251,146,60,0.1)", color: "#fb923c",
                border: "1px solid rgba(251,146,60,0.2)", textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                _BACKORDERED
              </span>
              {daysOld >= 3 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: "rgba(239,68,68,0.1)", color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.2)", textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {daysOld}d old
                </span>
              )}
            </div>

            {/* Customer */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              {order.customer && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: 12 }}>
                  <User size={12} />
                  <span>{order.customer.firstName} {order.customer.lastName}</span>
                </div>
              )}
              {order.phone ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: 12 }}>
                  <Phone size={12} />
                  <span>{order.phone}</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#f87171", fontSize: 12 }}>
                  <Phone size={12} />
                  <span>No phone on file</span>
                </div>
              )}
              {order.customer?.email && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: 12 }}>
                  <Mail size={12} />
                  <span>{order.customer.email}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#64748b", fontSize: 12 }}>
                <Clock size={12} />
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                ${parseFloat(order.totalPrice.amount).toFixed(2)}
              </div>
            </div>

            {/* Line items summary */}
            <div style={{ marginTop: "0.4rem", fontSize: 12, color: "#64748b" }}>
              {order.lineItems.slice(0, 2).map((li, i) => (
                <span key={i} style={{ marginRight: "0.5rem" }}>
                  {li.name}{li.variantTitle ? ` · ${li.variantTitle}` : ""} ×{li.quantity}
                  {i < Math.min(order.lineItems.length, 2) - 1 ? "," : ""}
                </span>
              ))}
              {order.lineItems.length > 2 && (
                <span style={{ color: "#475569" }}>+{order.lineItems.length - 2} more</span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "0.4rem 0.75rem", cursor: "pointer",
                color: "#94a3b8", fontSize: 12, display: "flex", alignItems: "center", gap: "0.35rem",
                transition: "all 0.15s",
              }}
            >
              <MessageSquare size={13} />
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {sent ? (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.45rem 1rem", borderRadius: 8,
                background: "rgba(6,182,212,0.1)", color: "#06b6d4",
                border: "1px solid rgba(6,182,212,0.25)", fontSize: 12, fontWeight: 700,
              }}>
                <CheckCircle2 size={14} />
                Contacted
              </div>
            ) : (
              <button
                onClick={handleSend}
                disabled={!order.phone || sending}
                title={!order.phone ? "No phone number on file" : "Send follow-up SMS"}
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.45rem 1rem", borderRadius: 8, cursor: !order.phone ? "not-allowed" : "pointer",
                  background: !order.phone ? "rgba(255,255,255,0.03)" : "rgba(6,182,212,0.15)",
                  color: !order.phone ? "#475569" : "#06b6d4",
                  border: `1px solid ${!order.phone ? "rgba(255,255,255,0.06)" : "rgba(6,182,212,0.3)"}`,
                  fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? "Sending…" : "Send SMS"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: SMS composer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="composer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "0 1.25rem 1rem",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "0.85rem",
            }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
                Message Preview
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                style={{
                  width: "100%", borderRadius: 8, padding: "0.65rem 0.9rem",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0", fontSize: 13, resize: "vertical",
                  fontFamily: "inherit", lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                <span style={{ fontSize: 11, color: "#475569" }}>
                  {message.length} chars · will tag order as <code style={{ color: "#06b6d4", fontSize: 10 }}>_BACKORDERED_TEXT</code>
                </span>
                {!sent && order.phone && (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      padding: "0.4rem 1rem", borderRadius: 8, cursor: "pointer",
                      background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(167,139,250,0.2))",
                      color: "#06b6d4", border: "1px solid rgba(6,182,212,0.35)",
                      fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                    }}
                  >
                    {sending ? <Loader2 size={13} /> : <Send size={13} />}
                    {sending ? "Sending…" : "Send Now"}
                  </button>
                )}
              </div>
              {error && (
                <div style={{
                  marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: 8,
                  background: "rgba(239,68,68,0.1)", color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.2)", fontSize: 12,
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}>
                  <AlertCircle size={13} />
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BackordersPage() {
  const [orders,   setOrders]   = useState<BackorderOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/customer/backorders?limit=50`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setLastFetch(new Date());
    } catch (err) {
      setError(errMessage(err, "Failed to load backorders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSendSms = async (order: BackorderOrder, message: string) => {
    if (!order.phone) throw new Error("No phone number on file for this order");

    const res = await fetch(`${BOT_URL}/admin/customer/backorders/${encodeURIComponent(order.id)}/sms`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        phone:        order.phone,
        message,
        orderName:    order.name,
        existingTags: order.tags,   // backend merges these + _BACKORDERED_TEXT
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    // Surface a non-fatal Shopify tag warning without failing the whole action
    const toastMsg = json.shopifyError
      ? `✓ SMS sent to ${order.phone} — ⚠ Shopify tag failed: ${json.shopifyError}`
      : `✓ SMS sent for ${order.name} → ${order.phone} · tagged _BACKORDERED_TEXT`;

    showToast(toastMsg, json.shopifyError ? "error" : "success");

    // Optimistically update local state
    setOrders(prev =>
      prev.map(o =>
        o.id === order.id ? { ...o, alreadyTexted: true, tags: [...o.tags, "_BACKORDERED_TEXT"] } : o
      )
    );
  };

  // Stats
  const totalOrders    = orders.length;
  const textedOrders   = orders.filter(o => o.alreadyTexted).length;
  const noPhoneOrders  = orders.filter(o => !o.phone).length;
  const urgentOrders   = orders.filter(o => {
    const days = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 3 && !o.alreadyTexted;
  }).length;

  return (
    <div>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed", top: 20, right: 20, zIndex: 9999,
              padding: "0.75rem 1.25rem", borderRadius: 10,
              background: toast.type === "success" ? "rgba(6,182,212,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.type === "success" ? "rgba(6,182,212,0.35)" : "rgba(239,68,68,0.35)"}`,
              color: toast.type === "success" ? "#06b6d4" : "#f87171",
              fontSize: 13, fontWeight: 700,
              backdropFilter: "blur(12px)",
              maxWidth: 380,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Backordered",   value: totalOrders,   color: "#fb923c", icon: Package },
          { label: "Need Follow-Up", value: urgentOrders, color: "#f87171", icon: AlertCircle },
          { label: "Texted",        value: textedOrders,  color: "#06b6d4", icon: CheckCircle2 },
          { label: "No Phone",      value: noPhoneOrders, color: "#64748b", icon: Phone },
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
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9", margin: 0 }}>Backordered Orders</h2>
          {lastFetch && (
            <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>
              Last refreshed {lastFetch.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={fetchOrders}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.4rem 0.9rem", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#475569" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: 14 }}>Loading backordered orders from Shopify…</p>
        </div>
      ) : error ? (
        <div style={{
          padding: "2rem", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", textAlign: "center",
        }}>
          <AlertCircle size={24} style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Failed to load backorders</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>{error}</p>
          <button
            onClick={fetchOrders}
            style={{
              marginTop: "1rem", padding: "0.5rem 1.25rem", borderRadius: 8,
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          padding: "4rem 2rem", borderRadius: 12,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", marginBottom: "0.25rem" }}>No backordered orders</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            No Shopify orders currently tagged <code style={{ color: "#fb923c" }}>_BACKORDERED</code>. 🎉
          </p>
        </div>
      ) : (
        <div>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onSendSms={handleSendSms} />
          ))}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
