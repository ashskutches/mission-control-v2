"use client";
/**
 * /queue — My Queue
 *
 * Ash's curated daily action list. Three sections:
 * 1. Approve / Reject   — Pending insights needing a decision
 * 2. Your Tasks         — Human tasks assigned to Ash
 * 3. Resolve Blockages  — Open blockages blocking agent work
 * 4. Needs Your Input   — Agent work items paused waiting on Ash
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, CheckCircle2, XCircle, AlertTriangle, Loader,
  RefreshCw, Clock, User, ChevronDown, ChevronUp,
  Zap, AlertCircle, Play, Shield, Cpu, ClipboardList,
  ShieldAlert, BrainCircuit, ArrowRight, ExternalLink,
  CheckCheck, CircleDot, Wrench,
} from "lucide-react";

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:      { color: "#22c55e", label: "LOW",      icon: Shield     },
  medium:   { color: "#f59e0b", label: "MEDIUM",   icon: AlertTriangle },
  high:     { color: "#f97316", label: "HIGH",     icon: ShieldAlert },
  critical: { color: "#f43f5e", label: "CRITICAL", icon: AlertCircle },
};

const BLOCKAGE_ICONS: Record<string, React.ElementType> = {
  api_key_needed:        Zap,
  integration_missing:   Cpu,
  human_action:          User,
  permission_needed:     Shield,
  bug:                   AlertCircle,
  tool_missing:          Wrench,
  external_dependency:   ArrowRight,
  waiting_on_decision:   BrainCircuit,
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

// ── Insight Approval Card ─────────────────────────────────────────────────────

function InsightCard({ insight, onDecision }: {
  insight: QueueInsight;
  onDecision: (id: string, action: "approve" | "reject") => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const riskCfg = insight.risk_tier ? RISK_CONFIG[insight.risk_tier] : null;
  const RiskIcon = riskCfg?.icon ?? BrainCircuit;
  const ageHours = Math.round((Date.now() - new Date(insight.created_at).getTime()) / 3_600_000);
  const isStuck = ageHours >= 6 && insight.priority >= 8;

  const decide = async (action: "approve" | "reject") => {
    setActing(action);
    await onDecision(insight.id, action);
    setActing(null);
  };

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: isStuck ? "rgba(244,63,94,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${riskCfg ? riskCfg.color + "25" : "rgba(255,255,255,0.08)"}`,
        borderLeft: `3px solid ${riskCfg?.color ?? "#64748b"}`,
        borderRadius: 12, padding: "0.875rem 1rem",
      }}
    >
      {/* Stuck warning */}
      {isStuck && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontSize: 9, fontWeight: 700, color: "#f43f5e" }}>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>⚠</motion.span>
          STUCK {ageHours}h — NEEDS DECISION NOW
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${riskCfg?.color ?? "#64748b"}15`, border: `1px solid ${riskCfg?.color ?? "#64748b"}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiskIcon size={13} color={riskCfg?.color ?? "#64748b"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {riskCfg && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: `${riskCfg.color}15`, color: riskCfg.color }}>
                {riskCfg.label} RISK
              </span>
            )}
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
              {insight.section}
            </span>
            <span style={{ fontSize: 9, color: priorityColor(insight.priority), fontWeight: 700 }}>
              P{insight.priority}/10
            </span>
            <span style={{ fontSize: 9, color: "#334155" }}>{ageHours}h old</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#e2e8f0", margin: "0 0 6px" }}>
            {insight.title}
          </p>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <motion.button
              onClick={() => decide("approve")}
              disabled={!!acting}
              whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 800, background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e", cursor: acting ? "wait" : "pointer", opacity: acting === "reject" ? 0.4 : 1 }}
            >
              {acting === "approve" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
              Approve
            </motion.button>
            <motion.button
              onClick={() => decide("reject")}
              disabled={!!acting}
              whileHover={!acting ? { scale: 1.03 } : {}} whileTap={!acting ? { scale: 0.97 } : {}}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 700, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e", cursor: acting ? "wait" : "pointer", opacity: acting === "approve" ? 0.4 : 1 }}
            >
              {acting === "reject" ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <XCircle size={11} />}
              Reject
            </motion.button>
            <a
              href={`/intelligence?highlight=${insight.id}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, fontSize: "11px", color: "#475569", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}
            >
              <ExternalLink size={9} /> Full view
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onAction }: {
  task: QueueTask;
  onAction: (id: string, status: string, notes?: string) => Promise<void>;
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

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: task.overdue ? "rgba(244,63,94,0.04)" : "rgba(167,139,250,0.03)",
        border: `1px solid ${task.overdue ? "#f43f5e" : pColor}22`,
        borderLeft: `3px solid ${task.overdue ? "#f43f5e" : pColor}`,
        borderRadius: 12, padding: "0.875rem 1rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${task.overdue ? "#f43f5e" : "#a78bfa"}15`, border: `1px solid ${task.overdue ? "#f43f5e" : "#a78bfa"}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ClipboardList size={13} color={task.overdue ? "#f43f5e" : "#a78bfa"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {task.overdue && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: "rgba(244,63,94,0.12)", color: "#f43f5e" }}>
                ⚠ OVERDUE
              </span>
            )}
            {task.created_by_agent && task.created_by_agent !== "human" && (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
                from {task.created_by_agent}
              </span>
            )}
            {task.effort_tier && (
              <span style={{ fontSize: 9, color: "#64748b" }}>{task.effort_tier}</span>
            )}
            {task.due_date && !task.overdue && (
              <span style={{ fontSize: 9, color: "#f59e0b" }}>
                due {new Date(task.due_date).toLocaleDateString()}
              </span>
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
          <button onClick={() => setExpanded(e => !e)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Instructions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 5 }}>Instructions</p>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {completing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Completion notes (optional)" autoFocus style={{ width: "100%", padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: "11px", outline: "none" }} />
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
            <a href="/work" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", color: "#475569", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", marginLeft: "auto" }}>
              <ExternalLink size={9} /> Full Queue
            </a>
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
            {blockage.followup_count > 0 && (
              <span style={{ fontSize: 9, color: "#475569" }}>{blockage.followup_count} reminder{blockage.followup_count > 1 ? "s" : ""} sent</span>
            )}
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
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did you resolve this? (required)" autoFocus style={{ width: "100%", padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: "11px", outline: "none" }} />
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

function NeedsHumanCard({ item }: { item: QueueNeedsHuman }) {
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "rgba(56,189,248,0.02)", border: "1px solid rgba(56,189,248,0.18)", borderLeft: "3px solid #38bdf8", borderRadius: 12, padding: "0.875rem 1rem" }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Cpu size={13} color="#38bdf8" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
            {item.agent_name && <span style={{ fontSize: 9, color: "#64748b", padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)" }}>{item.agent_name}</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b" }}>NEEDS YOUR INPUT</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f0ede8", margin: "0 0 4px" }}>{item.title}</p>
          {item.last_progress && (
            <p style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.5 }}>
              {item.last_progress.slice(0, 140)}{item.last_progress.length > 140 ? "…" : ""}
            </p>
          )}
        </div>
        <a href={`/chats?context=${encodeURIComponent(`[Work: ${item.title}] What do you need from me?`)}`} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, fontSize: "10px", fontWeight: 700, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", textDecoration: "none" }}>
          Chat <ArrowRight size={10} />
        </a>
      </div>
    </motion.div>
  );
}

// ── All Clear ─────────────────────────────────────────────────────────────────

function AllClear() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      style={{ textAlign: "center", padding: "4rem 2rem" }}
    >
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
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/operations/queue`);
      if (res.ok) setData(await res.json());
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

  const handleInsightDecision = async (id: string, action: "approve" | "reject") => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_status: action === "approve" ? "approved" : "rejected",
        ...(action === "approve" ? { status: "approved" } : { status: "rejected" }),
        approved_at: new Date().toISOString(),
        approved_by: "ash",
      }),
    });
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

  const count = data?.count ?? 0;

  return (
    <div className="px-4 py-5" style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: count > 0 ? "linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.08))" : "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))", border: `1px solid ${count > 0 ? "rgba(244,63,94,0.3)" : "rgba(34,197,94,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <Inbox size={20} color={count > 0 ? "#f43f5e" : "#22c55e"} />
              {count > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#f43f5e", border: "2px solid #0d111b" }}
                />
              )}
            </div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>My Queue</h1>
              {count > 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#f43f5e", fontWeight: 600, margin: 0 }}>
                  {count} item{count > 1 ? "s" : ""} need{count === 1 ? "s" : ""} your attention
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

      {loading && !data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", padding: "4rem 0", justifyContent: "center" }}>
          <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading your queue…
        </div>
      ) : count === 0 ? (
        <AllClear />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* ── Approvals ── */}
          {data!.approvals.length > 0 && (
            <section>
              <SectionHeader icon={BrainCircuit} label="Approve / Reject" count={data!.approvals.length} color="#f43f5e" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <AnimatePresence mode="popLayout">
                  {data!.approvals.map(i => (
                    <InsightCard key={i.id} insight={i} onDecision={handleInsightDecision} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* ── Your Tasks ── */}
          {data!.your_tasks.length > 0 && (
            <section>
              <SectionHeader icon={ClipboardList} label="Your Tasks" count={data!.your_tasks.length} color="#a78bfa" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <AnimatePresence mode="popLayout">
                  {data!.your_tasks.map(t => (
                    <TaskCard key={t.id} task={t} onAction={handleTaskAction} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* ── Blockages ── */}
          {data!.blockages.length > 0 && (
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
          {data!.needs_human.length > 0 && (
            <section>
              <SectionHeader icon={Cpu} label="Needs Your Input" count={data!.needs_human.length} color="#38bdf8" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <AnimatePresence mode="popLayout">
                  {data!.needs_human.map(i => (
                    <NeedsHumanCard key={i.id} item={i} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
