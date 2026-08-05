"use client";
import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, Info, TrendingUp, TrendingDown, Minus, AlertTriangle, PlugZap } from "lucide-react";

export const SUPPORT_ACCENT = "#00c9d7";

// ── Panel ────────────────────────────────────────────────────────────────────
export function Panel({
  title, subtitle, right, children, pad = true,
}: {
  title?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; pad?: boolean;
}) {
  return (
    <div style={{
      background: "var(--bg-darker)", border: "1px solid var(--glass-border)",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
    }}>
      {title && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "1rem", padding: "0.85rem 1.1rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "var(--text-secondary)",
            }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: pad ? "1.1rem" : 0 }}>{children}</div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────
export function Metric({
  label, value, sub, trend, icon: Icon, color = SUPPORT_ACCENT,
  /** Lower is better — flips trend colouring (e.g. response time). */
  invertTrend = false,
  unmeasured = false,
}: {
  label: string; value: string; sub?: string; trend?: number | null;
  icon: LucideIcon; color?: string; invertTrend?: boolean; unmeasured?: boolean;
}) {
  const good = trend == null ? null : (invertTrend ? trend < 0 : trend > 0);
  const TrendIcon = trend == null ? Minus : trend === 0 ? Minus : (trend > 0 ? TrendingUp : TrendingDown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-darker)", border: "1px solid var(--glass-border)",
        borderRadius: 14, padding: "1rem 1.1rem", position: "relative", overflow: "hidden",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--text-muted)", marginBottom: 6,
          }}>{label}</div>
          <div style={{
            fontSize: unmeasured ? 17 : 27, fontWeight: 800, lineHeight: 1.1,
            color: unmeasured ? "var(--text-dim)" : "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}>{value}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${color}18`, color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} />
        </div>
      </div>

      {(sub || trend != null) && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: 10, flexWrap: "wrap" }}>
          {trend != null && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 700,
              color: good == null ? "var(--text-muted)" : good ? "#22c55e" : "#f43f5e",
            }}>
              <TrendIcon size={11} />
              {trend > 0 ? "+" : ""}{trend}%
            </span>
          )}
          {sub && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>}
        </div>
      )}

      <div style={{
        position: "absolute", top: -22, right: -22, width: 64, height: 64,
        background: color, filter: "blur(40px)", opacity: 0.11, pointerEvents: "none",
      }} />
    </motion.div>
  );
}

// ── Sparkline (inline SVG — no chart library in this app, keep it that way) ──
export function Sparkline({ data, color = SUPPORT_ACCENT, height = 34 }: {
  data: number[]; color?: string; height?: number;
}) {
  if (!data.length) return null;
  const w = 100, max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = height - ((v - min) / span) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"
         style={{ width: "100%", height, display: "block" }}>
      <polyline points={`0,${height} ${pts.join(" ")} ${w},${height}`}
                fill={color} opacity={0.1} stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={color}
                strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({
  children, color = "var(--text-muted)", solid = false, onClick, active, title,
}: {
  children: React.ReactNode; color?: string; solid?: boolean;
  onClick?: () => void; active?: boolean; title?: string;
}) {
  const on = solid || active;
  return (
    <span
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
        padding: "0.22rem 0.55rem", borderRadius: 999,
        background: on ? `${color}22` : "rgba(255,255,255,0.04)",
        color: on ? color : "var(--text-muted)",
        border: `1px solid ${on ? `${color}44` : "rgba(255,255,255,0.07)"}`,
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap", transition: "all .15s",
      }}
    >{children}</span>
  );
}

// ── Confidence chip ──────────────────────────────────────────────────────────
export function confidenceColor(c: number) {
  if (c >= 0.8) return "#22c55e";
  if (c >= 0.6) return "#f5a840";
  return "#f43f5e";
}

export function Confidence({ value }: { value: number }) {
  const color = confidenceColor(value);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 44, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${Math.round(value * 100)}%`, height: "100%", background: color }} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{Math.round(value * 100)}%</span>
    </span>
  );
}

// ── Status colours ───────────────────────────────────────────────────────────
export const STATUS_COLOR: Record<string, string> = {
  new: "#4a9eff", triaged: "#4a9eff",
  awaiting_approval: "#f5a840",
  sent: "#22c55e", awaiting_customer: "#00c9d7",
  escalated: "#f43f5e", resolved: "#6b7280",
  needs_human_only: "#a78bfa", spam: "#6b7280",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "New", triaged: "Triaged",
  awaiting_approval: "Awaiting approval",
  sent: "Sent", awaiting_customer: "Awaiting customer",
  escalated: "Escalated", resolved: "Resolved",
  needs_human_only: "Human only", spam: "Spam",
};

// ── Button ───────────────────────────────────────────────────────────────────
export function Btn({
  children, onClick, color = SUPPORT_ACCENT, variant = "solid", disabled, size = "md", full, title,
}: {
  children: React.ReactNode; onClick?: () => void; color?: string;
  variant?: "solid" | "ghost" | "outline"; disabled?: boolean;
  size?: "sm" | "md"; full?: boolean; title?: string;
}) {
  const pad = size === "sm" ? "0.32rem 0.7rem" : "0.5rem 1rem";
  const fs  = size === "sm" ? 11 : 12;
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    fontSize: fs, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
    padding: pad, borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1, width: full ? "100%" : undefined,
    transition: "all .15s", fontFamily: "inherit",
  };
  const styles: Record<string, React.CSSProperties> = {
    solid:   { ...base, background: color, color: "#0f0f10", border: `1px solid ${color}` },
    outline: { ...base, background: `${color}14`, color, border: `1px solid ${color}55` },
    ghost:   { ...base, background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" },
  };
  return (
    <button type="button" title={title} onClick={disabled ? undefined : onClick} disabled={disabled} style={styles[variant]}>
      {children}
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
      <Icon size={30} style={{ opacity: 0.35, marginBottom: 12 }} />
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>{title}</div>
      {body && <div style={{ fontSize: 12, marginTop: 5, maxWidth: 420, marginInline: "auto" }}>{body}</div>}
    </div>
  );
}

// ── Time helper ──────────────────────────────────────────────────────────────
export function ago(mins: number) {
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24)     return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ── Async states ─────────────────────────────────────────────────────────────
// The three things every page needs and that fixtures never made us build.

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 10, padding: "3rem 1rem", color: "var(--text-muted)" }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `2px solid ${SUPPORT_ACCENT}33`, borderTopColor: SUPPORT_ACCENT,
        animation: "support-spin 0.7s linear infinite", display: "inline-block",
      }} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}…</span>
      <style>{`@keyframes support-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.3)",
      borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "1rem",
    }}>
      <AlertTriangle size={15} color="#f43f5e" style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700, marginBottom: 2 }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{error}</div>
      </div>
      {onRetry && <Btn size="sm" variant="ghost" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

/**
 * Banner shown when the mailbox isn't connected — which, until someone answers
 * the Gmail-vs-Gorgias question, is the expected state. It explains why the page
 * is empty rather than letting it look broken.
 */
export function NotConnected({ blockers }: { blockers: string[] }) {
  if (!blockers?.length) return null;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
      borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.25rem",
    }}>
      <PlugZap size={15} color="#f5a840" style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, color: "#f5a840", fontWeight: 700, marginBottom: 4 }}>
          Not connected yet — nothing will arrive and nothing can send
        </div>
        <ul style={{ margin: 0, paddingLeft: "1rem" }}>
          {blockers.map((b, i) => (
            <li key={i} style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return ago(mins);
}
