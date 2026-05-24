"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, AlertTriangle, Lightbulb, Eye, Users, Trophy,
  TrendingUp, Clock, ChevronDown, ChevronUp, ExternalLink, RefreshCw,
  Filter, Bug, ShieldAlert, Plug, Zap, Sparkles,
  ShieldCheck, Shield, Zap as ZapAuto, Loader,
  LayoutList, Columns, CheckCircle2, XCircle,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────

type InsightType =
  | "observation" | "critical_issue" | "suggestion" | "competitor" | "win"
  | "bug" | "blocker" | "integration_request" | "feature_request" | "general";
type InsightStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
type Section = "all" | "seo" | "email" | "content" | "ads" | "product" | "general"
  | "influencing" | "support" | "logistics" | "media" | "pricing"
  | "catalog" | "revenue" | "brand" | "profitability" | "community";

interface Insight {
  id: string;
  created_at: string;
  agent_name: string | null;
  section: string;
  type: InsightType;
  title: string;
  body: string | null;
  priority: number;
  status: InsightStatus;
  estimated_monthly_value: number | null;
  difficulty: string | null;
  effort: string | null;
  metrics: Record<string, any>;
  week_key: string | null;
  tool_name?: string | null;
  error_message?: string | null;
  integration_name?: string | null;
  // Enhanced fields
  approval_status?: string | null;
  risk_tier?: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_score?: number | null;
  stuck_since?: string | null;
  duplicate_of?: string | null;
  occurrences?: number | null;
  // Assignment (set when user assigns insight to an agent)
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
}

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  category?: string;
  specialization?: string;
}

interface Summary {
  total: number;
  totalNew?: number;
  criticalNew: number;
  totalEstimatedMonthlyValue: number;
  byType: Record<string, number>;
  bySection: Record<string, number>;
  openCount: number;
  criticalCount: number;
}

// ── Config ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<InsightType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  // Business intelligence
  critical_issue:      { label: "Critical",      icon: AlertTriangle, color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  suggestion:          { label: "Suggestion",    icon: Lightbulb,     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  observation:         { label: "Observation",   icon: Eye,           color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  competitor:          { label: "Competitor",    icon: Users,         color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  win:                 { label: "Win",           icon: Trophy,        color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  // Operational / blockages
  bug:                 { label: "Bug",           icon: Bug,           color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  blocker:             { label: "Blocker",       icon: ShieldAlert,   color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  integration_request: { label: "Integration",   icon: Plug,          color: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  feature_request:     { label: "Feature Req.",  icon: Zap,           color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
  // App-wide ideas
  general:             { label: "General Idea",  icon: Sparkles,      color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
};

const STATUS_NEXT: Record<InsightStatus, InsightStatus | null> = {
  new: "acknowledged", acknowledged: "in_progress", in_progress: "resolved", resolved: null, dismissed: null,
};
const STATUS_LABEL: Record<InsightStatus, string> = {
  new: "New", acknowledged: "Acknowledged", in_progress: "In Progress", resolved: "Resolved", dismissed: "Dismissed",
};
const STATUS_COLOR: Record<InsightStatus, string> = {
  new: "#f59e0b", acknowledged: "#38bdf8", in_progress: "#a78bfa", resolved: "#22c55e", dismissed: "#64748b",
};
const PRIORITY_BAR_COLOR = (p: number) =>
  p >= 8 ? "#f43f5e" : p >= 6 ? "#f59e0b" : p >= 4 ? "#38bdf8" : "#64748b";
const DIFFICULTY_COLOR: Record<string, string> = { easy: "#22c55e", medium: "#f59e0b", hard: "#f43f5e" };
const EFFORT_COLOR: Record<string, string>     = { low: "#22c55e", medium: "#f59e0b", high: "#f43f5e" };

// ── Approval Mode Toggle ─────────────────────────────────────────────────────

type ApprovalMode = "conservative" | "standard" | "autonomous";

const APPROVAL_MODES: {
  id: ApprovalMode;
  label: string;
  desc: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}[] = [
  {
    id: "conservative",
    label: "Conservative",
    desc: "All agent actions require explicit approval before execution.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    icon: ShieldCheck,
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Agents act on low-risk tasks autonomously; high-impact actions need approval.",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.12)",
    icon: Shield,
  },
  {
    id: "autonomous",
    label: "Autonomous",
    desc: "Agents operate fully autonomously. Use with trusted, well-tested agents only.",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    icon: ZapAuto,
  },
];

function ApprovalToggle() {
  const [mode, setMode] = useState<ApprovalMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    fetch(`${BOT_URL}/admin/facts/approval_mode`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.value) setMode(data.value as ApprovalMode); })
      .catch(() => {});
  }, []);

  const switchMode = async (next: ApprovalMode) => {
    if (next === mode || saving) return;
    setSaving(true);
    try {
      await fetch(`${BOT_URL}/admin/facts/approval_mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next, priority: "high" }),
      });
      setMode(next);
    } catch { /* silent — mode stays unchanged */ }
    finally { setSaving(false); }
  };

  const activeMeta = APPROVAL_MODES.find(m => m.id === mode);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      {/* Mode pill switcher */}
      <div
        style={{
          display: "flex",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: 3, gap: 3,
          position: "relative",
        }}
        onMouseEnter={() => setShowDesc(true)}
        onMouseLeave={() => setShowDesc(false)}
      >
        {APPROVAL_MODES.map(m => {
          const isActive = mode === m.id;
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              onClick={() => switchMode(m.id)}
              disabled={saving}
              whileHover={!isActive && !saving ? { scale: 1.03 } : {}}
              whileTap={!saving ? { scale: 0.97 } : {}}
              aria-label={`Set approval mode to ${m.label}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 7,
                border: isActive ? `1px solid ${m.color}35` : "1px solid transparent",
                background: isActive ? m.bg : "transparent",
                color: isActive ? m.color : "#475569",
                fontWeight: isActive ? 800 : 500,
                fontSize: "11px", cursor: saving ? "wait" : isActive ? "default" : "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
            >
              {saving && isActive
                ? <Loader size={10} className="spin" />
                : <Icon size={10} />
              }
              {m.label}
            </motion.button>
          );
        })}
      </div>

      {/* Tooltip description */}
      <AnimatePresence>
        {showDesc && activeMeta && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "rgba(10,14,24,0.97)",
              border: `1px solid ${activeMeta.color}25`,
              borderRadius: 8, padding: "6px 12px",
              fontSize: "11px", color: "#94a3b8",
              zIndex: 100, pointerEvents: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{ color: activeMeta.color, fontWeight: 700 }}>{activeMeta.label}: </span>
            {activeMeta.desc}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Type Tabs ───────────────────────────────────────────────────────────────

const TYPE_TABS = [
  { id: "all",                 label: "All" },
  // Business
  { id: "critical_issue",      label: "🔴 Critical" },
  { id: "suggestion",          label: "💡 Suggestions" },
  { id: "observation",         label: "👁 Observations" },
  { id: "competitor",          label: "🔬 Competitor" },
  { id: "win",                 label: "🏆 Wins" },
  // Operational
  { id: "bug",                 label: "🐛 Bugs" },
  { id: "blocker",             label: "🚧 Blockers" },
  { id: "integration_request", label: "🔌 Integrations" },
  { id: "feature_request",     label: "⚡ Features" },
  { id: "general",             label: "✨ General" },
];

const SECTION_FILTERS: { id: Section; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "seo",          label: "SEO" },
  { id: "email",        label: "Email" },
  { id: "content",      label: "Content" },
  { id: "ads",          label: "Ads" },
  { id: "product",      label: "Product" },
  { id: "influencing",  label: "Influencing" },
  { id: "support",      label: "Support" },
  { id: "general",      label: "General" },
];

// ── SummaryBar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <div className="columns is-multiline mb-5">
      {[
        { label: "Total Insights",       value: summary.total, color: "#38bdf8", icon: BrainCircuit },
        { label: "🔴 Critical (New)",    value: summary.criticalNew, color: "#f43f5e", icon: AlertTriangle },
        { label: "🚨 Open Blockages",    value: summary.openCount ?? 0, color: "#f97316", icon: ShieldAlert },
        { label: "Est. Monthly Value",   value: `$${(summary.totalEstimatedMonthlyValue ?? 0).toLocaleString()}`, color: "#22c55e", icon: TrendingUp },
      ].map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="column is-3-desktop is-6-tablet">
          <div className="box p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="is-flex is-align-items-center" style={{ gap: "0.6rem", marginBottom: "0.4rem" }}>
              <Icon size={15} color={color} />
              <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_TIER_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)",  label: "LOW" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "MED" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", label: "HIGH" },
  critical: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",  label: "CRIT" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1)  return `${h}h ago`;
  return `${m}m ago`;
}

function isStuckOver6h(stuckSince: string | null | undefined): boolean {
  if (!stuckSince) return false;
  return Date.now() - new Date(stuckSince).getTime() > 6 * 3600_000;
}

// ── InsightCard ───────────────────────────────────────────────────────────────

function InsightCard({ insight, onStatusChange, onDismiss, onAssignApprove, onReject }: {
  insight: Insight;
  onStatusChange: (id: string, status: InsightStatus) => void;
  onDismiss: (id: string) => void;
  onAssignApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.observation;
  const Icon = tc.icon;
  const nextStatus = STATUS_NEXT[insight.status];
  const stuckHours = insight.stuck_since
    ? Math.floor((Date.now() - new Date(insight.stuck_since).getTime()) / 3600_000)
    : 0;
  const isStuck = isStuckOver6h(insight.stuck_since);
  const riskCfg = insight.risk_tier ? RISK_TIER_CONFIG[insight.risk_tier] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="box mb-3 p-4"
      style={{
        background: isStuck ? "rgba(244,63,94,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${tc.color}28`,
        borderLeft: `3px solid ${tc.color}`,
      }}
    >
      {/* Header row */}
      <div className="is-flex is-align-items-flex-start" style={{ gap: "0.75rem" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color={tc.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.4rem", marginBottom: "0.4rem" }}>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: tc.bg, color: tc.color, fontWeight: 700, textTransform: "uppercase" }}>
              {tc.label}
            </span>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
              {insight.section}
            </span>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: `${STATUS_COLOR[insight.status]}18`, color: STATUS_COLOR[insight.status], fontWeight: 700 }}>
              {STATUS_LABEL[insight.status]}
            </span>
            {insight.agent_name && (
              <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
                {insight.agent_name}
              </span>
            )}
            {riskCfg && (
              <span className="tag is-rounded" style={{ fontSize: "9px", background: riskCfg.bg, color: riskCfg.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {riskCfg.label}
              </span>
            )}
            {isStuck && (
              <span
                className="tag is-rounded"
                style={{ fontSize: "9px", background: "rgba(244,63,94,0.15)", color: "#f43f5e", fontWeight: 800, animation: "pulse 2s ease-in-out infinite" }}
              >
                ⚠ STUCK {stuckHours}h
              </span>
            )}
            {(insight.occurrences ?? 0) > 1 && (
              <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700 }}>
                ×{insight.occurrences} occurrences
              </span>
            )}
          </div>

          <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3, marginBottom: "0.5rem" }}>
            {insight.title}
          </p>

          <div className="is-flex is-flex-wrap-wrap" style={{ gap: "1rem", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 56, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${insight.priority * 10}%`, height: "100%", background: PRIORITY_BAR_COLOR(insight.priority), borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>P{insight.priority}</span>
            </div>
            {insight.estimated_monthly_value != null && (
              <span style={{ fontSize: "11px", color: insight.estimated_monthly_value >= 0 ? "#22c55e" : "#f43f5e", fontWeight: 700 }}>
                💰 {insight.estimated_monthly_value >= 0 ? "+" : ""}${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo
              </span>
            )}
            {insight.difficulty && (
              <span style={{ fontSize: "10px", color: DIFFICULTY_COLOR[insight.difficulty] ?? "#94a3b8", fontWeight: 600 }}>
                Difficulty: {insight.difficulty}
              </span>
            )}
            {insight.effort && (
              <span style={{ fontSize: "10px", color: EFFORT_COLOR[insight.effort] ?? "#94a3b8", fontWeight: 600 }}>
                Effort: {insight.effort}
              </span>
            )}
            {/* Bug-specific: tool name */}
            {insight.tool_name && (
              <span style={{ fontSize: "10px", color: "#f43f5e", fontWeight: 600, fontFamily: "monospace" }}>
                🔧 {insight.tool_name}
              </span>
            )}
            <span style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} />
              {new Date(insight.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {(insight.body || insight.error_message) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="button is-ghost is-small"
            style={{ color: "#64748b", padding: "0.25rem" }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (insight.body || insight.error_message) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {insight.error_message && (
                <div className="mb-2 px-3 py-2" style={{ background: "rgba(239,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, marginBottom: "0.25rem", textTransform: "uppercase" }}>Error</p>
                  <p style={{ fontSize: "0.8rem", color: "#fca5a5", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{insight.error_message}</p>
                </div>
              )}
              {insight.body && (
                <p className="has-text-grey-light" style={{ fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {insight.body}
                </p>
              )}
              {Object.keys(insight.metrics ?? {}).length > 0 && (
                <div className="mt-3 is-flex is-flex-wrap-wrap" style={{ gap: "0.5rem" }}>
                  {Object.entries(insight.metrics).map(([k, v]) => (
                    <span key={k} className="tag" style={{ fontSize: "10px", background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="is-flex is-align-items-center mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", gap: "0.5rem", flexWrap: "wrap" }}>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(insight.id, nextStatus)}
            className="button is-small"
            style={{ background: `${STATUS_COLOR[nextStatus]}18`, color: STATUS_COLOR[nextStatus], border: `1px solid ${STATUS_COLOR[nextStatus]}30`, fontSize: "11px", fontWeight: 700 }}
          >
            → {STATUS_LABEL[nextStatus]}
          </button>
        )}
        {/* Assign & Approve — shown for all new/unreviewed insights */}
        {insight.status === "new" && onAssignApprove && onReject && (
          <>
            <button
              onClick={() => onAssignApprove(insight.id)}
              className="button is-small"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
            >
              <CheckCircle2 size={12} /> Assign & Approve →
            </button>
            <button
              onClick={() => onReject(insight.id)}
              className="button is-small"
              style={{ background: "rgba(244,63,94,0.10)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.22)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
            >
              <XCircle size={12} /> Dismiss
            </button>
          </>
        )}
        {/* Show assigned agent if already assigned */}
        {insight.assigned_agent_name && insight.status !== "new" && (
          <span style={{ fontSize: "10px", color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
            🤖 {insight.assigned_agent_name}
          </span>
        )}
        <a
          href={`/chats?agent=${insight.agent_name ?? ""}&context=${encodeURIComponent(`[Insight: ${insight.title}] Let's work on this.`)}`}
          className="button is-small is-ghost"
          style={{ color: "#64748b", fontSize: "11px", gap: "0.3rem" }}
        >
          <ExternalLink size={12} /> Chat
        </a>
        {insight.status !== "dismissed" && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="button is-small is-ghost ml-auto"
            style={{ color: "#475569", fontSize: "11px" }}
          >
            Dismiss
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "new",         label: "NEW",         color: "#f59e0b" },
  { id: "acknowledged",label: "ACKNOWLEDGED", color: "#38bdf8" },
  { id: "in_progress", label: "IN PROGRESS",  color: "#a78bfa" },
  { id: "blocked",     label: "BLOCKED",      color: "#f43f5e" },
  { id: "done",        label: "DONE",         color: "#64748b" },
];

function KanbanMiniCard({ insight, onStatusChange, onAssignApprove, onReject }: {
  insight: Insight;
  onStatusChange: (id: string, status: InsightStatus) => void;
  onAssignApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const tc = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.observation;
  const statusColor = STATUS_COLOR[insight.status];
  const isStuck = isStuckOver6h(insight.stuck_since);
  const stuckHours = insight.stuck_since
    ? Math.floor((Date.now() - new Date(insight.stuck_since).getTime()) / 3600_000)
    : 0;
  const riskCfg = insight.risk_tier ? RISK_TIER_CONFIG[insight.risk_tier] : null;

  return (
    <div
      style={{
        background: isStuck ? "rgba(244,63,94,0.04)" : "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: 8,
        padding: "8px 10px",
        marginBottom: 8,
        cursor: "default",
      }}
    >
      {/* Badges row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
        {riskCfg && (
          <span style={{ fontSize: "8px", background: riskCfg.bg, color: riskCfg.color, fontWeight: 800, padding: "1px 5px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {riskCfg.label}
          </span>
        )}
        {isStuck && (
          <span style={{ fontSize: "8px", background: "rgba(244,63,94,0.15)", color: "#f43f5e", fontWeight: 800, padding: "1px 5px", borderRadius: 4, animation: "pulse 2s ease-in-out infinite" }}>
            ⚠ STUCK {stuckHours}h
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", lineHeight: 1.3, marginBottom: 4,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {insight.title}
      </p>

      {/* Meta */}
      <p style={{ fontSize: "9px", color: "#475569", marginBottom: 4 }}>
        {insight.section}{insight.agent_name ? ` · ${insight.agent_name}` : ""}
      </p>

      {/* Priority bar */}
      <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 4 }}>
        <div style={{ width: `${insight.priority * 10}%`, height: "100%", background: PRIORITY_BAR_COLOR(insight.priority), borderRadius: 2 }} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "9px", color: "#334155" }}>{timeAgo(insight.created_at)}</span>
        {insight.status === "new" && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => onAssignApprove(insight.id)}
              style={{ fontSize: "9px", background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontWeight: 700 }}
              aria-label="Assign & Approve insight"
            >
              ✓ Assign
            </button>
            <button
              onClick={() => onReject(insight.id)}
              style={{ fontSize: "9px", background: "rgba(244,63,94,0.10)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.22)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontWeight: 700 }}
              aria-label="Dismiss insight"
            >
              ✗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanBoard({ insights, onStatusChange, onAssignApprove, onReject }: {
  insights: Insight[];
  onStatusChange: (id: string, status: InsightStatus) => void;
  onAssignApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const buckets: Record<string, Insight[]> = {
    new: [], acknowledged: [], in_progress: [], blocked: [], done: [],
  };

  for (const ins of insights) {
    if (ins.status === "resolved" || ins.status === "dismissed") {
      buckets.done.push(ins);
    } else if (isStuckOver6h(ins.stuck_since)) {
      buckets.blocked.push(ins);
    } else if (buckets[ins.status] !== undefined) {
      buckets[ins.status].push(ins);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
      {KANBAN_COLUMNS.map(col => (
        <div
          key={col.id}
          style={{
            minWidth: 260, width: 260, flexShrink: 0,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "10px 10px 6px",
          }}
        >
          {/* Column header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
            <span style={{ fontSize: "10px", fontWeight: 800, color: col.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {col.label}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: "9px", background: `${col.color}18`, color: col.color,
              borderRadius: 10, padding: "1px 7px", fontWeight: 700,
            }}>
              {buckets[col.id].length}
            </span>
          </div>

          {/* Cards */}
          <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 2 }}>
            {buckets[col.id].length === 0 ? (
              <p style={{ fontSize: "10px", color: "#334155", textAlign: "center", padding: "20px 0" }}>—</p>
            ) : (
              buckets[col.id].map(ins => (
                <KanbanMiniCard
                  key={ins.id}
                  insight={ins}
                  onStatusChange={onStatusChange}
                  onAssignApprove={onAssignApprove}
                  onReject={onReject}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AgentPickerModal ─────────────────────────────────────────────────────────
// Shown when user clicks "Assign & Approve" on an insight. Lets them pick
// a specific agent (or auto-assign by section lead) before approval.

function AgentPickerModal({
  insight,
  onConfirm,
  onCancel,
}: {
  insight: Insight;
  onConfirm: (agentId: string | null, agentName: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const tc = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.observation;
  const Icon = tc.icon;

  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Agent[]) => {
        const filtered = (Array.isArray(data) ? data : [])
          .filter(a => a.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setAgents(filtered);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoadingAgents(false));
  }, []);

  const selected = agents.find(a => a.id === selectedId) ?? null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(selectedId, selected?.name ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{
          background: "rgba(10,14,24,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "1.5rem",
          width: "100%", maxWidth: 520,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={18} color={tc.color} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "10px", color: tc.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
              Assign & Approve Insight
            </p>
            <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem", lineHeight: 1.35, marginBottom: "0.25rem" }}>
              {insight.title}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 4 }}>
                {insight.section}
              </span>
              <span style={{ fontSize: "10px", color: "#64748b" }}>P{insight.priority}</span>
              {insight.estimated_monthly_value != null && (
                <span style={{ fontSize: "10px", color: insight.estimated_monthly_value >= 0 ? "#22c55e" : "#f43f5e", fontWeight: 700 }}>
                  {insight.estimated_monthly_value >= 0 ? "+" : ""}${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Agent picker */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.6rem" }}>
            Who should handle this?
          </p>

          {loadingAgents ? (
            <div style={{ textAlign: "center", padding: "1rem", color: "#475569", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Loader size={14} className="spin" /> Loading agents...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 260, overflowY: "auto", paddingRight: 2 }}>
              {/* Auto-assign option (default) */}
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  gridColumn: "1 / -1",
                  background: selectedId === null ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
                  border: selectedId === null ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.12s",
                }}
              >
                <span style={{ fontSize: "16px" }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: "12px", color: selectedId === null ? "#38bdf8" : "#e2e8f0" }}>Auto-assign by section lead</p>
                  <p style={{ fontSize: "10px", color: "#475569" }}>Picks the lead agent for "{insight.section}"</p>
                </div>
                {selectedId === null && <CheckCircle2 size={14} color="#38bdf8" style={{ flexShrink: 0 }} />}
              </button>

              {/* Individual agents */}
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  style={{
                    background: selectedId === agent.id ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                    border: selectedId === agent.id ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8, padding: "8px 10px",
                    display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontWeight: 700, fontSize: "11px",
                      color: selectedId === agent.id ? "#f59e0b" : "#e2e8f0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {agent.name.split("—")[0].trim()}
                    </p>
                    {agent.specialization && (
                      <p style={{ fontSize: "9px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {agent.specialization}
                      </p>
                    )}
                  </div>
                  {selectedId === agent.id && <CheckCircle2 size={12} color="#f59e0b" style={{ flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "7px 14px", color: "#64748b",
              fontSize: "12px", cursor: "pointer", fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 18px", fontWeight: 800, fontSize: "12px",
              cursor: submitting ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 4px 16px rgba(34,197,94,0.25)",
              opacity: submitting ? 0.8 : 1,
            }}
          >
            {submitting
              ? <Loader size={12} className="spin" />
              : <CheckCircle2 size={12} />
            }
            {selected
              ? `Assign to ${selected.name.split("—")[0].trim()}`
              : "Approve & Auto-assign"
            }
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState("all");
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [sortBy, setSortBy] = useState<"priority" | "value" | "date">("priority");
  const [showResolved, setShowResolved] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  // Assign & Approve modal state
  const [assignModal, setAssignModal] = useState<Insight | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (activeType !== "all") params.set("type", activeType);
      if (activeSection !== "all") params.set("section", activeSection);

      const [insRes, sumRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/insights?${params}`),
        fetch(`${BOT_URL}/admin/insights/summary`),
      ]);

      if (insRes.ok) setInsights(await insRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) {
      console.error("Failed to fetch insights", e);
    } finally {
      setLoading(false);
    }
  }, [activeType, activeSection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: InsightStatus) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const dismiss = async (id: string) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  // Opens the Assign & Approve modal — called when any new insight's button is clicked
  const openAssignModal = (id: string) => {
    const insight = insights.find(i => i.id === id);
    if (insight) setAssignModal(insight);
  };

  // Fires after the user picks an agent in the modal and confirms
  const confirmAssign = async (agentId: string | null, agentName: string | null) => {
    if (!assignModal) return;
    const id = assignModal.id;

    const body: Record<string, unknown> = {
      approval_status: "approved",
      status: "acknowledged",
      approved_at: new Date().toISOString(),
      approved_by: "ash",
    };
    // force_agent_id is NOT stored — forwarded by backend to the /assign route
    if (agentId) {
      body.force_agent_id = agentId;
      body.assigned_agent_id = agentId;
      body.assigned_agent_name = agentName;
    }

    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setInsights(prev => prev.map(i => i.id === id ? {
      ...i,
      approval_status: "approved",
      status: "acknowledged" as InsightStatus,
      assigned_agent_id: agentId ?? undefined,
      assigned_agent_name: agentName ?? undefined,
    } : i));
    setAssignModal(null);
  };

  const rejectInsight = async (id: string) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_status: "rejected", status: "dismissed" }),
    });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, approval_status: "rejected", status: "dismissed" as InsightStatus } : i));
  };

  const filtered = insights
    .filter(i => showResolved || (i.status !== "resolved" && i.status !== "dismissed"))
    .sort((a, b) => {
      if (sortBy === "priority") return b.priority - a.priority;
      if (sortBy === "value") return (b.estimated_monthly_value ?? 0) - (a.estimated_monthly_value ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Group type tabs: business vs. operational
  const businessTabs = TYPE_TABS.filter(t => ["all", "critical_issue", "suggestion", "observation", "competitor", "win"].includes(t.id));
  const operationalTabs = TYPE_TABS.filter(t => ["bug", "blocker", "integration_request", "feature_request", "general"].includes(t.id));

  return (
    <div className="px-5 py-5" style={{ maxWidth: 920, margin: "0 auto" }}>
      {/* Assign & Approve modal — rendered at root so it overlays everything */}
      <AnimatePresence>
        {assignModal && (
          <AgentPickerModal
            insight={assignModal}
            onConfirm={confirmAssign}
            onCancel={() => setAssignModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="is-flex is-justify-content-space-between is-align-items-flex-start mb-5"
        style={{ gap: "1rem", flexWrap: "wrap", position: "relative" }}
      >
        <div>
          <div style={{ gap: "0.75rem", marginBottom: "0.25rem" }} className="is-flex is-align-items-center">
            <BrainCircuit size={22} color="#f59e0b" />
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>Insights</h1>
          </div>
          <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
            Review agent insights and assign them to the right agent for execution.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <ApprovalToggle />
          {/* View mode toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 9px", borderRadius: 5,
                border: viewMode === "list" ? "1px solid rgba(56,189,248,0.35)" : "1px solid transparent",
                background: viewMode === "list" ? "rgba(56,189,248,0.12)" : "transparent",
                color: viewMode === "list" ? "#38bdf8" : "#475569", fontWeight: 700, fontSize: "11px", cursor: "pointer",
              }}
            >
              <LayoutList size={13} /> List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              aria-label="Kanban view"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 9px", borderRadius: 5,
                border: viewMode === "kanban" ? "1px solid rgba(167,139,250,0.35)" : "1px solid transparent",
                background: viewMode === "kanban" ? "rgba(167,139,250,0.12)" : "transparent",
                color: viewMode === "kanban" ? "#a78bfa" : "#475569", fontWeight: 700, fontSize: "11px", cursor: "pointer",
              }}
            >
              <Columns size={13} /> Kanban
            </button>
          </div>
          <button onClick={fetchData} className="button is-small is-ghost" style={{ color: "#64748b" }} aria-label="Refresh">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {summary && <SummaryBar summary={summary} />}

      {/* Business type tabs */}
      <div style={{ marginBottom: "0.25rem" }}>
        <p style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "0.4rem" }}>
          Business Intelligence
        </p>
        <div className="is-flex is-flex-wrap-wrap mb-2" style={{ gap: "0.4rem" }}>
          {businessTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className="button is-small"
              style={{
                background: activeType === t.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                color: activeType === t.id ? "#f59e0b" : "#94a3b8",
                border: activeType === t.id ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.06)",
                fontWeight: 700, fontSize: "11px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Operational type tabs */}
      <div style={{ marginBottom: "0.75rem" }}>
        <p style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "0.4rem" }}>
          Blockages &amp; Ideas
        </p>
        <div className="is-flex is-flex-wrap-wrap mb-2" style={{ gap: "0.4rem" }}>
          {operationalTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className="button is-small"
              style={{
                background: activeType === t.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                color: activeType === t.id ? "#f97316" : "#94a3b8",
                border: activeType === t.id ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
                fontWeight: 700, fontSize: "11px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section filter + sort */}
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4 is-flex-wrap-wrap" style={{ gap: "0.5rem" }}>
        <div className="is-flex" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          {SECTION_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveSection(f.id)}
              className="button is-small"
              style={{
                background: activeSection === f.id ? "rgba(56,189,248,0.12)" : "transparent",
                color: activeSection === f.id ? "#38bdf8" : "#64748b",
                border: activeSection === f.id ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
                fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
          <span style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase" }}>Sort:</span>
          {(["priority", "value", "date"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className="button is-small is-ghost"
              style={{ fontSize: "10px", fontWeight: 700, color: sortBy === s ? "#f59e0b" : "#64748b", textTransform: "capitalize" }}>
              {s}
            </button>
          ))}
          <label style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            Resolved
          </label>
        </div>
      </div>

      {/* Cards / Kanban */}
      {loading ? (
        <p className="has-text-grey has-text-centered py-6">Loading insights...</p>
      ) : filtered.length === 0 ? (
        <div className="box has-text-centered py-6" style={{ background: "rgba(255,255,255,0.02)" }}>
          <BrainCircuit size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p className="has-text-grey">No insights yet — agents will file them as they research.</p>
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          insights={filtered}
          onStatusChange={updateStatus}
          onAssignApprove={openAssignModal}
          onReject={rejectInsight}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          {filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onStatusChange={updateStatus}
              onDismiss={dismiss}
              onAssignApprove={openAssignModal}
              onReject={rejectInsight}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
