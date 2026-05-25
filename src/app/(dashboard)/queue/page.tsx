"use client";
/**
 * /queue — Command Center
 *
 * The single daily page you need. Four sections:
 * 1. Auto-Approval Throttle  — master control bar at the top
 * 2. Approve / Reject        — unified inbox: insights + agent tasks needing a decision
 * 3. Your Tasks              — human tasks assigned to you
 * 4. Resolve Blockages       — open blockages blocking agent work
 * 5. Needs Your Input        — agent work paused waiting on you
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, CheckCircle2, XCircle, AlertTriangle, Loader,
  RefreshCw, Clock, User, ChevronDown, ChevronUp,
  Zap, AlertCircle, Play, Shield, Cpu, ClipboardList,
  ShieldAlert, BrainCircuit, ArrowRight, ExternalLink,
  CheckCheck, CircleDot, Wrench, ShieldCheck, ZapOff,
  ToggleLeft, ToggleRight, Bot,
} from "lucide-react";
import dynamic from "next/dynamic";

const WorkDetailDrawer = dynamic(() => import("@/components/WorkDetailDrawer"), { ssr: false });

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const REFRESH_INTERVAL = 30;

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueInsight {
  id: string;
  title: string;
  section: string;
  type: string;
  priority: number;
  risk_tier: "low" | "medium" | "high" | "critical" | null;
  risk_score: number | null;
  created_at: string;
  status: string;
  approval_status: string;
}

interface AgentTask {
  id: string;
  title: string;
  body: string | null;
  agent_id: string;
  agent_name: string | null;
  section: string;
  tool_name: string;
  priority: number;
  risk_tier: "low" | "medium" | "high" | "critical" | null;
  assigned_to: string;
  status: string;
  created_at: string;
}

interface QueueTask {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  assigned_to: string;
  assigned_username: string | null;
  created_by_agent: string | null;
  status: string;
  priority: number;
  effort_tier: string | null;
  due_date: string | null;
  followup_count: number;
  overdue: boolean;
  created_at: string;
}

interface QueueBlockage {
  id: string;
  type: string;
  title: string;
  description: string;
  instructions: string;
  created_by_agent: string | null;
  assigned_username: string | null;
  followup_count: number;
  created_at: string;
}

interface QueueNeedsHuman {
  id: string;
  title: string;
  agent_name: string | null;
  status: string;
  priority: number;
  last_progress: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueData {
  count: number;
  approvals: QueueInsight[];
  your_tasks: QueueTask[];
  blockages: QueueBlockage[];
  needs_human: QueueNeedsHuman[];
}

// ── Threshold Config ───────────────────────────────────────────────────────────

type Threshold = "manual" | "low" | "medium" | "high" | "full_auto";

const THRESHOLD_PRESETS: {
  id: Threshold;
  label: string;
  desc: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}[] = [
  {
    id: "manual",
    label: "Manual",
    desc: "Everything needs your approval first.",
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.12)",
    icon: ShieldCheck,
  },
  {
    id: "low",
    label: "Low Risk",
    desc: "Auto-approve LOW risk tasks. Approve MEDIUM+ yourself.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    icon: Shield,
  },
  {
    id: "medium",
    label: "Medium Risk",
    desc: "Auto-approve LOW + MEDIUM. Approve HIGH+ yourself.",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.12)",
    icon: Shield,
  },
  {
    id: "high",
    label: "High Risk",
    desc: "Auto-approve everything except CRITICAL risk.",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    icon: Zap,
  },
  {
    id: "full_auto",
    label: "Full Auto",
    desc: "Agents act completely autonomously. Trust fully established.",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    icon: ZapOff,
  },
];

// ── Risk / Priority helpers ────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:      { color: "#22c55e", label: "LOW",      icon: Shield },
  medium:   { color: "#f59e0b", label: "MEDIUM",   icon: AlertTriangle },
  high:     { color: "#f97316", label: "HIGH",     icon: ShieldAlert },
  critical: { color: "#f43f5e", label: "CRITICAL", icon: AlertCircle },
};

const BLOCKAGE_ICONS: Record<string, React.ElementType> = {
  api_key_needed:      Zap,
  integration_missing: Cpu,
  human_action:        User,
  permission_needed:   Shield,
  bug:                 AlertCircle,
  tool_missing:        Wrench,
  external_dependency: ArrowRight,
  waiting_on_decision: BrainCircuit,
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function priorityColor(p: number): string {
  if (p >= 9) return "#f43f5e";
  if (p >= 7) return "#f97316";
  if (p >= 5) return "#f59e0b";
  return "#64748b";
}

// ── Auto-Approval Throttle ─────────────────────────────────────────────────────

function ThrottleControl() {
  const [threshold, setThreshold] = useState<Threshold | null>(null);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseSaving, setPauseSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BOT_URL}/admin/facts/approval_mode_threshold`).then(r => r.ok ? r.json() : null),
      fetch(`${BOT_URL}/admin/facts/work_runner_enabled`).then(r => r.ok ? r.json() : null),
    ]).then(([thresh, runner]) => {
      if (thresh?.value) setThreshold(thresh.value as Threshold);
      else setThreshold("manual");
      if (runner?.value !== undefined) setPaused(runner.value === "false" || runner.value === false);
    }).catch(() => setThreshold("manual"));
  }, []);

  const switchThreshold = async (next: Threshold) => {
    if (next === threshold || saving) return;
    setSaving(true);
    try {
      await fetch(`${BOT_URL}/admin/facts/approval_mode_threshold`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next, priority: "high" }),
      });
      setThreshold(next);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const togglePause = async () => {
    if (pauseSaving) return;
    setPauseSaving(true);
    const nextEnabled = paused; // if paused, we're enabling; if running, we're pausing
    try {
      await fetch(`${BOT_URL}/admin/work/runner/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      setPaused(!paused);
    } catch { /* silent */ }
    finally { setPauseSaving(false); }
  };

  const activeMeta = THRESHOLD_PRESETS.find(p => p.id === threshold);

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${activeMeta?.color ?? "#475569"}22`,
      borderLeft: `3px solid ${activeMeta?.color ?? "#475569"}`,
      borderRadius: 14,
      padding: "1rem 1.25rem",
      marginBottom: "1.75rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Shield size={13} color={activeMeta?.color ?? "#475569"} />
          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: activeMeta?.color ?? "#475569" }}>
            Auto-Approval Threshold
          </span>
        </div>
        {/* Master pause toggle */}
        <motion.button
          onClick={togglePause}
          disabled={pauseSaving}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 7, fontSize: "10px", fontWeight: 700,
            background: paused ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${paused ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}`,
            color: paused ? "#f43f5e" : "#64748b",
            cursor: pauseSaving ? "wait" : "pointer",
          }}
        >
          {pauseSaving ? <Loader size={10} style={{ animation: "spin 1s linear infinite" }} /> : paused ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
          {paused ? "Agents Paused" : "Agents Running"}
        </motion.button>
      </div>

      {/* Threshold pill switcher */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {THRESHOLD_PRESETS.map(p => {
          const isActive = threshold === p.id;
          const Icon = p.icon;
          return (
            <motion.button
              key={p.id}
              onClick={() => switchThreshold(p.id)}
              disabled={saving}
              whileHover={!isActive && !saving ? { scale: 1.03 } : {}}
              whileTap={!saving ? { scale: 0.97 } : {}}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 8,
                border: isActive ? `1px solid ${p.color}40` : "1px solid rgba(255,255,255,0.07)",
                background: isActive ? p.bg : "rgba(255,255,255,0.03)",
                color: isActive ? p.color : "#475569",
                fontWeight: isActive ? 800 : 500,
                fontSize: "12px", cursor: saving ? "wait" : isActive ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {saving && isActive ? <Loader size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Icon size={10} />}
              {p.label}
            </motion.button>
          );
        })}
      </div>

      {/* Description of current mode */}
      {activeMeta && (
        <p style={{ marginTop: "0.6rem", fontSize: "11px", color: "#475569", lineHeight: 1.5 }}>
          <span style={{ color: activeMeta.color, fontWeight: 700 }}>{activeMeta.label}: </span>
          {activeMeta.desc}
        </p>
      )}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, count, color, children }: {
  icon: React.ElementType; label: string; count: number; color: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color }}>
          {label}
        </span>
        {count > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 20,
            background: `${color}20`, color, border: `1px solid ${color}35`,
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Unified Approval Card (Insights + Agent Tasks) ─────────────────────────────

function ApprovalCard({ item, kind, onDecision, onExpand }: {
  item: QueueInsight | AgentTask;
  kind: "insight" | "agent_task";
  onDecision: (id: string, action: "approve" | "approve_assign" | "reject", kind: "insight" | "agent_task") => Promise<void>;
  onExpand: (id: string, kind: "insight" | "agent_task") => void;
}) {
  const [acting, setActing] = useState<"approve" | "approve_assign" | "reject" | null>(null);
  const riskCfg = item.risk_tier ? RISK_CONFIG[item.risk_tier] : null;
  const RiskIcon = riskCfg?.icon ?? BrainCircuit;
  const ageHours = Math.round((Date.now() - new Date(item.created_at).getTime()) / 3_600_000);
  const isStuck = ageHours >= 6 && item.priority >= 8;

  const decide = async (action: "approve" | "approve_assign" | "reject") => {
    setActing(action);
    await onDecision(item.id, action, kind);
    setActing(null);
  };

  const cardBg = isStuck ? "rgba(244,63,94,0.04)" : "rgba(255,255,255,0.02)";
  const borderColor = riskCfg ? riskCfg.color + "25" : "rgba(255,255,255,0.08)";
  const leftBorder = riskCfg?.color ?? "#64748b";

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: cardBg, border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${leftBorder}`, borderRadius: 12, padding: "0.875rem 1rem",
        cursor: "pointer",
      }}
      onClick={() => onExpand(item.id, kind)}
    >
      {isStuck && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontSize: 9, fontWeight: 700, color: "#f43f5e" }}>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>⚠</motion.span>
          STUCK {ageHours}h — NEEDS DECISION NOW
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `${riskCfg?.color ?? "#64748b"}15`,
          border: `1px solid ${riskCfg?.color ?? "#64748b"}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {kind === "insight"
            ? <RiskIcon size={13} color={riskCfg?.color ?? "#64748b"} />
            : <Bot size={13} color={riskCfg?.color ?? "#64748b"} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {kind === "agent_task" && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                AGENT TASK
              </span>
            )}
            {riskCfg && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: `${riskCfg.color}15`, color: riskCfg.color }}>
                {riskCfg.label} RISK
              </span>
            )}
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
              {"section" in item ? item.section : ""}
            </span>
            <span style={{ fontSize: 9, color: priorityColor(item.priority), fontWeight: 700 }}>
              P{item.priority}/10
            </span>
            <span style={{ fontSize: 9, color: "#334155" }}>{ageHours}h old</span>
            {kind === "agent_task" && "tool_name" in item && (
              <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>🔧 {(item as AgentTask).tool_name}</span>
            )}
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#e2e8f0", margin: "0 0 4px" }}>
            {item.title}
          </p>
          {"body" in item && item.body && (
            <p style={{ fontSize: "10px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              {(item.body as string).slice(0, 100)}{(item.body as string).length > 100 ? "…" : ""}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "0.65rem" }} onClick={e => e.stopPropagation()}>
            {kind === "insight" ? (
              <>
                <motion.button
                  onClick={() => decide("approve_assign")} disabled={!!acting}
                  whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 800, background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(56,189,248,0.12))", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", cursor: acting ? "wait" : "pointer", opacity: acting && acting !== "approve_assign" ? 0.4 : 1 }}
                >
                  {acting === "approve_assign" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
                  Approve + Assign
                </motion.button>
                <motion.button
                  onClick={() => decide("approve")} disabled={!!acting}
                  whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 700, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", cursor: acting ? "wait" : "pointer", opacity: acting && acting !== "approve" ? 0.4 : 1 }}
                >
                  {acting === "approve" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
                  Approve
                </motion.button>
              </>
            ) : (
              <motion.button
                onClick={() => decide("approve")} disabled={!!acting}
                whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 800, background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(56,189,248,0.12))", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", cursor: acting ? "wait" : "pointer", opacity: acting && acting !== "approve" ? 0.4 : 1 }}
              >
                {acting === "approve" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
                Approve &amp; Execute
              </motion.button>
            )}
            <motion.button
              onClick={() => decide("reject")} disabled={!!acting}
              whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 700, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e", cursor: acting ? "wait" : "pointer", opacity: acting && acting !== "reject" ? 0.4 : 1 }}
            >
              {acting === "reject" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <XCircle size={11} />}
              Reject
            </motion.button>
            <a
              href={kind === "insight" ? `/intelligence?highlight=${item.id}` : `/work`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, fontSize: "11px", color: "#475569", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", marginLeft: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={9} /> Details
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onAction, onExpand }: {
  task: QueueTask;
  onAction: (id: string, status: string, notes?: string) => Promise<void>;
  onExpand: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const act = async (status: string, n?: string) => {
    setActing(true);
    await onAction(task.id, status, n);
    setActing(false);
    setCompleting(false);
  };

  const pColor = priorityColor(task.priority);
  const bg = task.overdue ? "rgba(244,63,94,0.04)" : task.status === "in_progress" ? "rgba(56,189,248,0.03)" : task.status === "done" ? "rgba(34,197,94,0.03)" : "rgba(167,139,250,0.03)";
  const leftBorder = task.overdue ? "#f43f5e" : task.status === "in_progress" ? "#38bdf8" : task.status === "done" ? "#22c55e" : pColor;

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: bg, border: `1px solid ${leftBorder}22`,
        borderLeft: `3px solid ${leftBorder}`, borderRadius: 12, padding: "0.875rem 1rem",
        cursor: "pointer",
      }}
      onClick={() => onExpand(task.id)}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${task.overdue ? "#f43f5e" : "#a78bfa"}15`, border: `1px solid ${task.overdue ? "#f43f5e" : "#a78bfa"}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ClipboardList size={13} color={task.overdue ? "#f43f5e" : "#a78bfa"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {task.overdue && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: "rgba(244,63,94,0.12)", color: "#f43f5e" }}>⚠ OVERDUE</span>
            )}
            {task.status === "in_progress" && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>IN PROGRESS</span>
            )}
            {task.created_by_agent && task.created_by_agent !== "human" && (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "#64748b" }}>from {task.created_by_agent}</span>
            )}
            {task.effort_tier && (
              <span style={{ fontSize: 9, color: "#64748b" }}>{task.effort_tier}</span>
            )}
            {task.due_date && !task.overdue && (
              <span style={{ fontSize: 9, color: "#f59e0b" }}>due {new Date(task.due_date).toLocaleDateString()}</span>
            )}
            {task.followup_count > 0 && (
              <span style={{ fontSize: 9, color: "#475569" }}>{task.followup_count} reminder{task.followup_count > 1 ? "s" : ""}</span>
            )}
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f0ede8", margin: "0 0 3px" }}>{task.title}</p>
          {task.description && (
            <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 5px" }}>{task.description}</p>
          )}
        </div>
        {task.instructions && (
          <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 5 }}>Instructions</p>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(255,255,255,0.05)" }} onClick={e => e.stopPropagation()}>
        {completing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Completion notes (optional)" autoFocus style={{ width: "100%", padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: "11px", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 5 }}>
              <motion.button onClick={() => act("done", notes || undefined)} disabled={acting} whileHover={{ scale: 1.02 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 6, fontSize: "11px", fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: "pointer" }}>
                <CheckCheck size={11} /> Confirm Done
              </motion.button>
              <button onClick={() => setCompleting(false)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: "11px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {task.status === "pending" && (
              <motion.button onClick={() => act("in_progress")} disabled={acting} whileHover={{ scale: 1.03 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", cursor: "pointer" }}>
                <Play size={10} /> Start
              </motion.button>
            )}
            <motion.button onClick={() => setCompleting(true)} disabled={acting} whileHover={{ scale: 1.03 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: "pointer" }}>
              <CheckCircle2 size={10} /> Done
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Blockage Card ─────────────────────────────────────────────────────────────

function BlockageCard({ blockage, onResolve }: {
  blockage: QueueBlockage;
  onResolve: (id: string, notes: string) => Promise<void>;
}) {
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const Icon = BLOCKAGE_ICONS[blockage.type] ?? AlertTriangle;
  const ageHours = Math.round((Date.now() - new Date(blockage.created_at).getTime()) / 3_600_000);

  const resolve = async () => {
    if (!notes.trim()) return;
    setActing(true);
    await onResolve(blockage.id, notes);
    setActing(false);
    setResolving(false);
  };

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.18)", borderLeft: "3px solid #f59e0b", borderRadius: 12, padding: "0.875rem 1rem" }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color="#f59e0b" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
              {blockage.type.replace(/_/g, " ").toUpperCase()}
            </span>
            {blockage.created_by_agent && (
              <span style={{ fontSize: 9, color: "#64748b" }}>from {blockage.created_by_agent}</span>
            )}
            <span style={{ fontSize: 9, color: ageHours > 72 ? "#f43f5e" : "#475569" }}>{ageHours}h open</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f0ede8", margin: "0 0 3px" }}>{blockage.title}</p>
          <p style={{ fontSize: "10px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            {blockage.description.slice(0, 120)}{blockage.description.length > 120 ? "…" : ""}
          </p>
        </div>
        {blockage.instructions && (
          <button onClick={() => setExpanded(e => !e)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 5 }}>How to resolve</p>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{blockage.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {resolving ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did you resolve this? (required)" autoFocus style={{ width: "100%", padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: "11px", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 5 }}>
              <motion.button onClick={resolve} disabled={acting || !notes.trim()} whileHover={{ scale: 1.02 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 6, fontSize: "11px", fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: notes.trim() ? "pointer" : "not-allowed", opacity: notes.trim() ? 1 : 0.5 }}>
                <CheckCheck size={11} /> Confirm Resolved
              </motion.button>
              <button onClick={() => setResolving(false)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: "11px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            <motion.button onClick={() => { setResolving(true); setExpanded(true); }} whileHover={{ scale: 1.03 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: "pointer" }}>
              <CheckCircle2 size={10} /> Resolve
            </motion.button>
            <a href="/blockages" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", color: "#475569", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", marginLeft: "auto" }}>
              <ExternalLink size={9} /> All Blockages
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Needs Human Card ──────────────────────────────────────────────────────────

function NeedsHumanCard({ item, onExpand }: { item: QueueNeedsHuman; onExpand: (id: string) => void }) {
  const statusColor = item.status === "blocked" ? "#f43f5e" : item.status === "done" ? "#22c55e" : "#f59e0b";
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}22`, borderLeft: `3px solid ${statusColor}`, borderRadius: 12, padding: "0.875rem 1rem", cursor: "pointer" }}
      onClick={() => onExpand(item.id)}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${statusColor}12`, border: `1px solid ${statusColor}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Cpu size={13} color={statusColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
            {item.agent_name && <span style={{ fontSize: 9, color: "#64748b", padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)" }}>{item.agent_name}</span>}
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              style={{ fontSize: 9, fontWeight: 700, color: statusColor }}
            >
              NEEDS YOUR INPUT
            </motion.span>
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f0ede8", margin: "0 0 4px" }}>{item.title}</p>
          {item.last_progress && (
            <p style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.5 }}>
              {item.last_progress.slice(0, 120)}{item.last_progress.length > 120 ? "…" : ""}
            </p>
          )}
        </div>
        <a
          href={`/chats?context=${encodeURIComponent(`[Work: ${item.title}] What do you need from me?`)}`}
          onClick={e => e.stopPropagation()}
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, fontSize: "10px", fontWeight: 700, background: `${statusColor}12`, border: `1px solid ${statusColor}30`, color: statusColor, textDecoration: "none" }}
        >
          Chat <ArrowRight size={10} />
        </a>
      </div>
    </motion.div>
  );
}

// ── All Clear ─────────────────────────────────────────────────────────────────

function AllClear() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "4rem 2rem" }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 3 }}
        style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.06))", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}
      >
        <CheckCheck size={28} color="#22c55e" />
      </motion.div>
      <h2 style={{ fontWeight: 900, fontSize: "1.25rem", color: "#22c55e", marginBottom: "0.5rem" }}>Queue Clear 🎉</h2>
      <p style={{ color: "#475569", fontSize: "0.875rem" }}>No approvals, tasks, or blockages need your attention right now.</p>
      <p style={{ color: "#334155", fontSize: "0.8rem", marginTop: "0.5rem" }}>Agents are running autonomously. You're good.</p>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drawer state
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [drawerItemType, setDrawerItemType] = useState<"work" | "task" | "agent_task">("task");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [queueRes, tasksRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/operations/queue`),
        fetch(`${BOT_URL}/admin/tasks?status=pending&limit=50`),
      ]);
      if (queueRes.ok) setData(await queueRes.json());
      if (tasksRes.ok) setAgentTasks(await tasksRes.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => { fetchData(true); setCountdown(REFRESH_INTERVAL); }, REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const refresh = () => {
    fetchData();
    setCountdown(REFRESH_INTERVAL);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { fetchData(true); setCountdown(REFRESH_INTERVAL); }, REFRESH_INTERVAL * 1000);
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprovalDecision = async (id: string, action: "approve" | "approve_assign" | "reject", kind: "insight" | "agent_task") => {
    if (kind === "insight") {
      const isApprove = action === "approve" || action === "approve_assign";
      await fetch(`${BOT_URL}/admin/insights/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_status: isApprove ? "approved" : "rejected", status: isApprove ? "acknowledged" : "dismissed", approved_at: new Date().toISOString(), approved_by: "ash" }),
      });
      if (action === "approve_assign") {
        await fetch(`${BOT_URL}/admin/insights/${id}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved_by: "ash" }) }).catch(() => {});
      }
    } else {
      if (action === "approve") {
        await fetch(`${BOT_URL}/admin/tasks/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } });
      } else if (action === "reject") {
        await fetch(`${BOT_URL}/admin/tasks/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" } });
      }
    }
    await fetchData(true);
  };

  const handleTaskAction = async (id: string, status: string, notes?: string) => {
    await fetch(`${BOT_URL}/admin/work/human/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(notes ? { completion_notes: notes } : {}) }),
    });
    await fetchData(true);
  };

  const handleResolveBlockage = async (id: string, notes: string) => {
    await fetch(`${BOT_URL}/admin/blockages/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", resolved_by: "ash", resolution_notes: notes }),
    });
    await fetchData(true);
  };

  const openDrawer = (id: string, type: "work" | "task" | "agent_task") => {
    setDrawerItemId(id);
    setDrawerItemType(type);
  };

  // Combine insight approvals + pending agent tasks into unified inbox
  const insightApprovals = data?.approvals ?? [];
  const totalCount = (data?.count ?? 0) + agentTasks.length;

  return (
    <>
      <div className="px-4 py-5" style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: totalCount > 0 ? "linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.08))" : "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
                border: `1px solid ${totalCount > 0 ? "rgba(244,63,94,0.3)" : "rgba(34,197,94,0.25)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <Inbox size={20} color={totalCount > 0 ? "#f43f5e" : "#22c55e"} />
                {totalCount > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#f43f5e", border: "2px solid #0d111b" }}
                  />
                )}
              </div>
              <div>
                <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>Command Center</h1>
                {totalCount > 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#f43f5e", fontWeight: 600, margin: 0 }}>
                    {totalCount} item{totalCount > 1 ? "s" : ""} need{totalCount === 1 ? "s" : ""} your attention
                  </p>
                ) : (
                  <p style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: 600, margin: 0 }}>All clear</p>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", paddingTop: 4 }}>
            <span style={{ fontSize: 10, color: "#334155" }}>in {countdown}s</span>
            <button onClick={refresh} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: "11px", cursor: "pointer" }}>
              <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Auto-Approval Throttle — always visible */}
        <ThrottleControl />

        {loading && !data ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", padding: "4rem 0", justifyContent: "center" }}>
            <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading your queue…
          </div>
        ) : totalCount === 0 && agentTasks.length === 0 ? (
          <AllClear />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* ── Unified Approvals (Insights + Agent Tasks) ── */}
            {(insightApprovals.length > 0 || agentTasks.length > 0) && (
              <section>
                <SectionHeader icon={BrainCircuit} label="Approve / Reject" count={insightApprovals.length + agentTasks.length} color="#f43f5e">
                  <span style={{ fontSize: 9, color: "#334155" }}>
                    {insightApprovals.length} insight{insightApprovals.length !== 1 ? "s" : ""} · {agentTasks.length} agent task{agentTasks.length !== 1 ? "s" : ""}
                  </span>
                </SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <AnimatePresence mode="popLayout">
                    {insightApprovals.map(i => (
                      <ApprovalCard key={`ins-${i.id}`} item={i} kind="insight"
                        onDecision={handleApprovalDecision}
                        onExpand={() => {/* insights open in intelligence page */}} />
                    ))}
                    {agentTasks.map(t => (
                      <ApprovalCard key={`task-${t.id}`} item={t} kind="agent_task"
                        onDecision={handleApprovalDecision}
                        onExpand={(id) => openDrawer(id, "agent_task")} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* ── Your Tasks ── */}
            {(data?.your_tasks ?? []).length > 0 && (
              <section>
                <SectionHeader icon={ClipboardList} label="Your Tasks" count={data!.your_tasks.length} color="#a78bfa" />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <AnimatePresence mode="popLayout">
                    {data!.your_tasks.map(t => (
                      <TaskCard key={t.id} task={t} onAction={handleTaskAction} onExpand={(id) => openDrawer(id, "task")} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* ── Blockages ── */}
            {(data?.blockages ?? []).length > 0 && (
              <section>
                <SectionHeader icon={AlertTriangle} label="Resolve Blockages" count={data!.blockages.length} color="#f59e0b" />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <AnimatePresence mode="popLayout">
                    {data!.blockages.map(b => (
                      <BlockageCard key={b.id} blockage={b} onResolve={handleResolveBlockage} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* ── Needs Input ── */}
            {(data?.needs_human ?? []).length > 0 && (
              <section>
                <SectionHeader icon={Cpu} label="Needs Your Input" count={data!.needs_human.length} color="#38bdf8" />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <AnimatePresence mode="popLayout">
                    {data!.needs_human.map(i => (
                      <NeedsHumanCard key={i.id} item={i} onExpand={(id) => openDrawer(id, "work")} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Work Detail Drawer */}
      <AnimatePresence>
        {drawerItemId && (
          <WorkDetailDrawer
            itemId={drawerItemId}
            itemType={drawerItemType}
            onClose={() => setDrawerItemId(null)}
            onAction={() => { setDrawerItemId(null); fetchData(true); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
