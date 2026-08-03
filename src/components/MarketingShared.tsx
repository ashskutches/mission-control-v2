"use client";
/**
 * Shared primitives for the Marketing section (/marketing, /marketing/ads).
 *
 * Deliberately small: the two Marketing pages read from different endpoints but
 * must look like one surface, so the card chrome, number formatting and the
 * "this feed is empty and here is why" affordance live here rather than being
 * copy-pasted twice and drifting.
 */
import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

export const CARD = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
} as const;

export const LABEL = {
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
} as const;

export type PeriodKey = "7d" | "30d" | "90d" | "qtd";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "qtd", label: "QTD" },
];

// ── Formatting ────────────────────────────────────────────────────────────────
// Every formatter renders null/undefined as an em dash rather than 0. A missing
// feed and a real zero mean opposite things on a marketing page, and the codebase
// treats "unavailable" as a first-class value — these keep that visible in the UI.

export const money = (n: number | null | undefined, dp = 0) =>
  n == null || !isFinite(n)
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const num = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");

export const pct = (n: number | null | undefined, dp = 1) =>
  n == null || !isFinite(n) ? "—" : `${n.toFixed(dp)}%`;

export const mult = (n: number | null | undefined, dp = 2) =>
  n == null || !isFinite(n) ? "—" : `${n.toFixed(dp)}x`;

export const CHANNEL_COLORS: Record<string, string> = {
  meta: "#38bdf8",
  google: "#f59e0b",
  other: "#94a3b8",
};
export const channelColor = (c: string) => CHANNEL_COLORS[c] ?? "#a78bfa";

// ── Period picker ─────────────────────────────────────────────────────────────

export function PeriodPicker({ value, onChange, right }: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
      {PERIODS.map(({ key, label }) => {
        const active = key === value;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              background: active ? "rgba(233,141,32,0.14)" : "rgba(255,255,255,0.04)",
              color: active ? "#e98d20" : "#64748b",
              border: active ? "1px solid rgba(233,141,32,0.3)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: "0.3rem 0.8rem", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >
            {label}
          </button>
        );
      })}
      {right != null && <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", alignItems: "center" }}>{right}</div>}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

export function MetricCard({ label, value, icon: Icon, color, sub, unavailable }: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
  /** Why the value is an em dash. Rendered in place of `sub`, in amber. */
  unavailable?: string | null;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...CARD, flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={LABEL}>{label}</span>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: unavailable ? "#475569" : color }}>{value}</div>
      {unavailable
        ? <p style={{ fontSize: 10, color: "#b45309", marginTop: "0.2rem" }}>{unavailable}</p>
        : sub && <p style={{ fontSize: 10, color: "#475569", marginTop: "0.2rem" }}>{sub}</p>}
    </motion.div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function Panel({ title, note, right, children, style }: {
  title: string;
  note?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...CARD, marginBottom: "1.25rem", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: note ? "0.35rem" : "1rem" }}>
        <p style={LABEL}>{title}</p>
        {right}
      </div>
      {note && <p style={{ fontSize: 11, color: "#475569", marginBottom: "1rem", lineHeight: 1.5 }}>{note}</p>}
      {children}
    </div>
  );
}

// ── Empty / unavailable state ─────────────────────────────────────────────────

/**
 * The house rule from the Profit page, applied here: an empty panel must say
 * whether the business did nothing or nobody plugged the feed in, and what to do.
 */
export function EmptyState({ reason, action }: { reason: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: "0.6rem", alignItems: "flex-start",
      background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.18)",
      borderRadius: 10, padding: "0.85rem",
    }}>
      <AlertTriangle size={14} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>{reason}</p>
        {action && <div style={{ marginTop: "0.6rem" }}>{action}</div>}
      </div>
    </div>
  );
}

// ── Table chrome ──────────────────────────────────────────────────────────────

export const TH: React.CSSProperties = {
  fontSize: 9.5, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em",
  fontWeight: 700, textAlign: "right", padding: "0.4rem 0.5rem", whiteSpace: "nowrap",
};
export const TD: React.CSSProperties = {
  fontSize: 12, color: "#cbd5e1", textAlign: "right", padding: "0.55rem 0.5rem", whiteSpace: "nowrap",
};

export function ChannelPill({ channel }: { channel: string }) {
  const c = channelColor(channel);
  return (
    <span style={{
      display: "inline-block", background: `${c}12`, border: `1px solid ${c}2b`, color: c,
      borderRadius: 20, padding: "0.1rem 0.5rem",
      fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {channel}
    </span>
  );
}

/** Horizontal share bar used under name cells to show budget concentration. */
export function ShareBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, p))}%` }} transition={{ duration: 0.5 }}
        style={{ height: "100%", background: color, borderRadius: 2 }}
      />
    </div>
  );
}
