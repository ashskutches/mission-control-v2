"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, ExternalLink,
  Loader2, MapPin, MessageSquare, Package, RefreshCw, Send, Tag as TagIcon, Truck, User,
} from "lucide-react";
import {
  type OrderDetail, type Address,
  errMessage, money, severityColor, statusLabel,
} from "../types";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

// ── Small building blocks ─────────────────────────────────────────────────────
function Card({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "1rem 1.15rem", marginBottom: "0.85rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.75rem",
        fontSize: 10, fontWeight: 800, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.09em",
      }}>
        <Icon size={12} />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: "1rem",
      fontSize: 12.5, padding: "0.22rem 0",
      color: strong ? "#f1f5f9" : "#cbd5e1",
      fontWeight: strong ? 800 : 500,
    }}>
      <span style={{ color: strong ? "#f1f5f9" : "#64748b" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

function formatAddress(a: Address | null): string[] {
  if (!a) return [];
  return [
    a.name,
    a.address1,
    a.address2,
    [a.city, a.provinceCode, a.zip].filter(Boolean).join(", "),
    a.country,
  ].filter(Boolean) as string[];
}

/** Default SMS body — mirrors the tone of the Backorders composer. */
function buildDefaultMessage(order: OrderDetail): string {
  const first = order.customer?.firstName || "there";
  const lead  = [...order.exceptions].sort((a, b) => b.severity - a.severity)[0];

  if (lead?.code === "backordered") {
    const items = order.lineItems
      .map(li => `${li.name}${li.variantTitle ? ` (${li.variantTitle})` : ""} x${li.quantity}`)
      .join(", ");
    return `Hi ${first}! Your order ${order.name} (${items}) is currently on backorder. Would you like to switch to a different variant, or are you happy to keep waiting? Reply here and we'll sort it out! 😊`;
  }
  if (lead?.code === "delivery_exception" || lead?.code === "stalled_in_transit") {
    return `Hi ${first}! We're checking on your order ${order.name} — the carrier hasn't updated it in a while. We're chasing it now and will let you know as soon as we have news. Sorry for the wait!`;
  }
  if (lead?.code === "payment_failed" || lead?.code === "payment_pending") {
    return `Hi ${first}! We had trouble processing payment for your order ${order.name}, so it hasn't shipped yet. Reply here and we'll get it sorted right away.`;
  }
  return `Hi ${first}! Quick update on your order ${order.name} — we're on it and will follow up shortly. Reply here if you have any questions!`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [newTag,  setNewTag]  = useState("");
  const [tagging, setTagging] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/orders/${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setOrder(json);
      setMessage(buildDefaultMessage(json));
    } catch (err) {
      setError(errMessage(err, "Failed to load order"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const sendSms = async () => {
    if (!order?.phone || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/orders/${encodeURIComponent(order.legacyId)}/sms`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phone: order.phone, message,
          orderName: order.name, existingTags: order.tags,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      // A tag failure is a warning, not a failure — the SMS already went out.
      showToast(
        json.tagError
          ? `✓ SMS sent to ${json.to} — ⚠ tagging failed: ${json.tagError}`
          : `✓ SMS sent to ${json.to} · order tagged`,
        json.tagError ? "error" : "success",
      );
      if (json.tags) setOrder(o => (o ? { ...o, tags: json.tags } : o));
    } catch (err) {
      showToast(errMessage(err, "Send failed"), "error");
    } finally {
      setSending(false);
    }
  };

  const addTag = async () => {
    if (!order || !newTag.trim()) return;
    setTagging(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/orders/${encodeURIComponent(order.legacyId)}/tag`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tags: [newTag.trim()], existingTags: order.tags }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setOrder(o => (o ? { ...o, tags: json.tags } : o));
      setNewTag("");
      showToast(`✓ Tagged ${newTag.trim()}`);
    } catch (err) {
      showToast(errMessage(err, "Tagging failed"), "error");
    } finally {
      setTagging(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 0", color: "#475569" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
        <p style={{ fontSize: 14 }}>Loading order…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{
        padding: "2rem", borderRadius: 12,
        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
        color: "#f87171", textAlign: "center",
      }}>
        <AlertCircle size={24} style={{ margin: "0 auto 0.75rem" }} />
        <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Couldn&apos;t load this order</p>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>{error}</p>
        <Link href="/orders" style={{ color: "#fb923c", fontSize: 13, fontWeight: 700, display: "inline-block", marginTop: "1rem" }}>
          ← Back to queue
        </Link>
      </div>
    );
  }

  const color = severityColor(order.severity);
  const exceptions = [...order.exceptions].sort((a, b) => b.severity - a.severity);

  return (
    <div>
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed", top: 20, right: 20, zIndex: 9999,
              padding: "0.75rem 1.25rem", borderRadius: 10, maxWidth: 400,
              background: toast.type === "success" ? "rgba(6,182,212,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.type === "success" ? "rgba(6,182,212,0.35)" : "rgba(239,68,68,0.35)"}`,
              color: toast.type === "success" ? "#06b6d4" : "#f87171",
              fontSize: 13, fontWeight: 700, backdropFilter: "blur(12px)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back + refresh */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <Link href="/orders" style={{
          display: "inline-flex", alignItems: "center", gap: "0.35rem",
          color: "#64748b", fontSize: 12, fontWeight: 700, textDecoration: "none",
        }}>
          <ArrowLeft size={13} /> Back to queue
        </Link>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={fetchOrder} style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.35rem 0.8rem", borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#94a3b8", fontSize: 12, fontWeight: 700,
          }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <a href={order.adminUrl} target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.35rem 0.8rem", borderRadius: 8, textDecoration: "none",
            background: "rgba(233,141,32,0.12)", border: "1px solid rgba(233,141,32,0.3)",
            color: "#e98d20", fontSize: 12, fontWeight: 700,
          }}>
            <ExternalLink size={12} /> Open in Shopify
          </a>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: "#f1f5f9", margin: 0 }}>{order.name}</h2>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
          background: "rgba(255,255,255,0.05)", color: "#94a3b8",
          border: "1px solid rgba(255,255,255,0.09)", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {statusLabel(order.fulfillmentStatus)}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
          background: "rgba(255,255,255,0.05)", color: "#94a3b8",
          border: "1px solid rgba(255,255,255,0.09)", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {statusLabel(order.financialStatus)}
        </span>
        {order.returnStatus !== "NO_RETURN" && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
            background: "rgba(244,63,94,0.12)", color: "#fb7185",
            border: "1px solid rgba(244,63,94,0.3)", textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {statusLabel(order.returnStatus)}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: "1rem" }}>
        Placed {new Date(order.createdAt).toLocaleString()} · {order.ageDays} days ago
        {order.cancelledAt && ` · CANCELLED ${new Date(order.cancelledAt).toLocaleDateString()}`}
      </p>

      {/* Why it's in the queue */}
      {exceptions.length > 0 && (
        <div style={{
          padding: "0.85rem 1.1rem", borderRadius: 12, marginBottom: "1rem",
          background: `${color}0d`, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.5rem",
            color, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <AlertTriangle size={13} /> Why this is in the queue
          </div>
          {exceptions.map(e => (
            <div key={e.code} style={{ display: "flex", gap: "0.5rem", fontSize: 12.5, color: "#cbd5e1", padding: "0.15rem 0" }}>
              <span style={{ color: severityColor(e.severity), fontWeight: 800, minWidth: 130 }}>{e.label}</span>
              <span>{e.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: "0.85rem" }}
           className="orders-detail-grid">

        {/* ── Left ────────────────────────────────────────────────────────── */}
        <div>
          <Card title="Items" icon={Package}>
            {order.lineItems.map(li => (
              <div key={li.id} style={{
                display: "flex", gap: "0.75rem", alignItems: "center",
                padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                {li.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={li.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: 7, flexShrink: 0,
                    background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Package size={15} color="#475569" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{li.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {li.sku ? `${li.sku} · ` : ""}Qty {li.quantity}
                    {li.unfulfilledQuantity > 0 && (
                      <span style={{ color: "#fb923c", fontWeight: 700 }}> · {li.unfulfilledQuantity} unfulfilled</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>{money(li.lineTotal)}</div>
              </div>
            ))}
            <div style={{ marginTop: "0.65rem" }}>
              <Row label="Subtotal" value={money(order.totals.subtotal)} />
              <Row label={`Shipping${order.shippingMethod ? ` · ${order.shippingMethod}` : ""}`} value={money(order.totals.shipping)} />
              <Row label="Tax" value={money(order.totals.tax)} />
              {Number(order.totals.refunded.amount) > 0 && (
                <Row label="Refunded" value={<span style={{ color: "#fb7185" }}>−{money(order.totals.refunded)}</span>} />
              )}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "0.4rem", paddingTop: "0.4rem" }}>
                <Row label="Total" value={money(order.totals.total)} strong />
              </div>
            </div>
          </Card>

          <Card title="Payment" icon={CreditCard}>
            {order.payment ? (
              <>
                <Row label="Method" value={
                  `${order.payment.brand ?? order.payment.gateway ?? "Card"}${
                    order.payment.number ? ` ${order.payment.number}` : ""
                  }${order.payment.wallet ? ` · ${statusLabel(order.payment.wallet)}` : ""}`
                } />
                <Row label="Paid" value={order.payment.paidAt ? new Date(order.payment.paidAt).toLocaleString() : "—"} />
                <Row label="Amount" value={money(order.payment.amount)} />
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: "#fb923c" }}>
                No successful payment on this order — status is {statusLabel(order.financialStatus)}.
              </p>
            )}
          </Card>

          {/* ── Action rail ─────────────────────────────────────────────── */}
          <Card title="Actions" icon={Send}>
            {order.phone ? (
              <>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: "0.35rem" }}>
                  Text {order.phone}
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, resize: "vertical",
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.5, fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: 10.5, color: "#475569" }}>
                    {message.length} chars · {Math.ceil(message.length / 160) || 1} segment(s) · sends immediately
                  </span>
                  <button
                    onClick={sendSms}
                    disabled={sending || !message.trim()}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      padding: "0.4rem 1rem", borderRadius: 8,
                      cursor: sending || !message.trim() ? "not-allowed" : "pointer",
                      background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.35)",
                      color: "#06b6d4", fontSize: 12, fontWeight: 800,
                      opacity: sending || !message.trim() ? 0.5 : 1,
                    }}
                  >
                    {sending ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <MessageSquare size={12} />}
                    {sending ? "Sending…" : "Send SMS"}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: "#64748b" }}>
                No phone number on this order — reach the customer at{" "}
                {order.email ? <span style={{ color: "#94a3b8" }}>{order.email}</span> : "…no email either"}.
              </p>
            )}

            {/* Tags */}
            <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                {order.tags.length === 0 && <span style={{ fontSize: 11.5, color: "#475569" }}>No tags</span>}
                {order.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addTag(); }}
                  placeholder="Add a tag…"
                  style={{
                    flex: 1, padding: "0.35rem 0.6rem", borderRadius: 8,
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0", fontSize: 12,
                  }}
                />
                <button
                  onClick={addTag}
                  disabled={tagging || !newTag.trim()}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.3rem",
                    padding: "0.35rem 0.75rem", borderRadius: 8,
                    cursor: tagging || !newTag.trim() ? "not-allowed" : "pointer",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#94a3b8", fontSize: 12, fontWeight: 700,
                    opacity: tagging || !newTag.trim() ? 0.5 : 1,
                  }}
                >
                  <TagIcon size={11} /> Tag
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right ───────────────────────────────────────────────────────── */}
        <div>
          <Card title="Customer" icon={User}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#f1f5f9", marginBottom: "0.15rem" }}>
              {order.customer
                ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Guest checkout"
                : "Guest checkout"}
            </div>
            {order.email && <div style={{ fontSize: 12, color: "#94a3b8" }}>{order.email}</div>}
            {order.phone && <div style={{ fontSize: 12, color: "#94a3b8" }}>{order.phone}</div>}
            {order.customer && (
              <div style={{ marginTop: "0.6rem" }}>
                <Row label="Orders placed" value={order.customer.orderCount ?? "—"} />
                <Row label="Lifetime spend" value={money(order.customer.lifetimeSpend)} />
                {order.customer.since && (
                  <Row label="Customer since" value={new Date(order.customer.since).toLocaleDateString()} />
                )}
              </div>
            )}
          </Card>

          <Card title="Shipping" icon={MapPin}>
            {formatAddress(order.shippingAddress).length ? (
              formatAddress(order.shippingAddress).map((l, i) => (
                <div key={i} style={{ fontSize: 12.5, color: i === 0 ? "#f1f5f9" : "#cbd5e1", fontWeight: i === 0 ? 700 : 500 }}>{l}</div>
              ))
            ) : (
              <p style={{ fontSize: 12.5, color: "#64748b" }}>No shipping address (digital or pickup order).</p>
            )}
          </Card>

          <Card title="Tracking" icon={Truck}>
            {order.fulfillments.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#64748b" }}>
                Nothing shipped yet — no fulfillment has been created.
              </p>
            ) : order.fulfillments.map(f => (
              <div key={f.id} style={{ marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9" }}>
                    {statusLabel(f.displayStatus)}
                  </span>
                  {f.carrier && <span style={{ fontSize: 11, color: "#64748b" }}>· {f.carrier}</span>}
                </div>
                {f.trackingNumber && (
                  <div style={{ fontSize: 11.5, marginBottom: "0.35rem" }}>
                    {f.trackingUrl ? (
                      <a href={f.trackingUrl} target="_blank" rel="noreferrer"
                         style={{ color: "#06b6d4", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {f.trackingNumber} <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>{f.trackingNumber}</span>
                    )}
                  </div>
                )}
                {f.estimatedDeliveryAt && !f.deliveredAt && (
                  <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: "0.35rem" }}>
                    Est. delivery {new Date(f.estimatedDeliveryAt).toLocaleDateString()}
                  </div>
                )}
                {f.deliveredAt && (
                  <div style={{ fontSize: 11.5, color: "#10b981", marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={11} /> Delivered {new Date(f.deliveredAt).toLocaleString()}
                  </div>
                )}

                {/* Carrier timeline, newest first */}
                {f.events.length > 0 && (
                  <div style={{ borderLeft: "1px solid rgba(255,255,255,0.09)", paddingLeft: "0.7rem", marginTop: "0.5rem" }}>
                    {f.events.map(ev => (
                      <div key={ev.id} style={{ position: "relative", paddingBottom: "0.5rem" }}>
                        <span style={{
                          position: "absolute", left: -14, top: 4, width: 6, height: 6, borderRadius: "50%",
                          background: "#475569",
                        }} />
                        <div style={{ fontSize: 11.5, color: "#cbd5e1", fontWeight: 600 }}>
                          {ev.message || statusLabel(ev.status)}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#475569" }}>
                          {new Date(ev.happenedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>

          {order.note && (
            <Card title="Order note" icon={MessageSquare}>
              <p style={{ fontSize: 12.5, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{order.note}</p>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .orders-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
