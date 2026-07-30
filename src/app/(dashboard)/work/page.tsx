"use client";
/**
 * /work — Agent Work Pipeline
 *
 * Real-time view of what agents are actively working on, what's blocked,
 * and what human tasks have been assigned by agents.
 * Click any card to open the full detail drawer.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, ClipboardList, CheckCircle2, AlertCircle, Loader,
  RefreshCw, Clock, User, ChevronDown, ChevronUp,
  Zap, BarChart2, CircleDot, XCircle, PlayCircle,
  PauseCircle, AlertTriangle, CheckCheck, ExternalLink,
  Plus, X, Send, LayoutList, Columns, Maximize2,
} from "lucide-react";
import dynamic from "next/dynamic";

const WorkDetailDrawer = dynamic(() => import("@/components/WorkDetailDrawer"), { ssr: false });

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const REFRESH_INTERVAL = 20; // seconds

// ── Types ──────────────────────────────────────────────────────────────────────

type WorkStatus = "pending" | "running" | "in_progress" | "blocked" | "needs_human" | "done" | "cancelled";
type TaskStatus = "pending" | "in_progress" | "done" | "blocked" | "cancelled";
type EffortTier = "quick" | "moderate" | "involved" | "epic";

interface AgentWork {
  id: string;
  agent_id: string;
  agent_name: string | null;
  title: string;
  description: string | null;
  status: WorkStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  last_progress: string | null;
  completion_report: string | null;
  milestones: { label: string; done?: boolean }[];
  current_milestone: number;
  run_count: number;
  max_runs: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface HumanTask {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  assigned_to: string;
  assigned_username: string | null;
  created_by_agent: string | null;
  status: TaskStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  due_date: string | null;
  followup_count: number;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkSummary {
  agent_work: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    needs_human: number;
    done: number;
    by_status: Record<string, number>;
  };
  human_tasks: {
    total: number;
    pending: number;
    in_progress: number;
    done: number;
    high_priority_pending: number;
    by_status: Record<string, number>;
  };
}

// ── Status config ──────────────────────────────────────────────────────────────

const WORK_STATUS: Record<WorkStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:      { label: "Pending",     color: "#64748b", icon: CircleDot    },
  running:      { label: "Running",     color: "#38bdf8", icon: PlayCircle   },
  in_progress:  { label: "In Progress", color: "#a78bfa", icon: Loader       },
  blocked:      { label: "Blocked",     color: "#f43f5e", icon: PauseCircle  },
  needs_human:  { label: "Needs You",   color: "#f59e0b", icon: AlertTriangle },
  done:         { label: "Done",        color: "#22c55e", icon: CheckCircle2  },
  cancelled:    { label: "Cancelled",   color: "#475569", icon: XCircle      },
};

const TASK_STATUS: Record<TaskStatus, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#f59e0b" },
  in_progress: { label: "In Progress", color: "#38bdf8" },
  done:        { label: "Done",        color: "#22c55e" },
  blocked:     { label: "Blocked",     color: "#f43f5e" },
  cancelled:   { label: "Cancelled",   color: "#475569" },
};

const EFFORT_LABEL: Record<EffortTier, string> = {
  quick: "Quick", moderate: "Moderate", involved: "Involved", epic: "Epic",
};

const EFFORT_COLOR: Record<EffortTier, string> = {
  quick: "#22c55e", moderate: "#f59e0b", involved: "#f97316", epic: "#f43f5e",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function priorityBar(p: number, color: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${p * 10}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: "#64748b" }}>P{p}</span>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    assigned_to: "ash",
    priority: 5,
    effort_tier: "" as EffortTier | "",
    estimated_hours: "" as number | "",
    due_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.instructions.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/work/human`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          instructions: form.instructions.trim(),
          assigned_to: form.assigned_to.trim() || "ash",
          priority: Number(form.priority),
          effort_tier: form.effort_tier || null,
          estimated_hours: form.estimated_hours !== "" ? Number(form.estimated_hours) : null,
          due_date: form.due_date || null,
          created_by_agent: "human",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create task");
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#e2e8f0", fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "#64748b", marginBottom: 4, display: "block",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        style={{
          width: "100%", maxWidth: 560,
          background: "rgba(13,17,27,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, padding: "1.5rem",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ClipboardList size={18} color="#a78bfa" />
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#e2e8f0", margin: 0 }}>Assign Task</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <span style={label}>Title *</span>
            <input id="task-title" style={inputStyle} value={form.title} onChange={set("title")} placeholder="e.g. Review and approve email draft" required />
          </div>
          <div>
            <span style={label}>Description</span>
            <input id="task-desc" style={inputStyle} value={form.description} onChange={set("description")} placeholder="Brief summary of why this is needed" />
          </div>
          <div>
            <span style={label}>Instructions *</span>
            <textarea
              id="task-instructions"
              style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              value={form.instructions}
              onChange={set("instructions")}
              placeholder="Step-by-step instructions for the assignee…"
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <span style={label}>Assign to</span>
              <input id="task-assignee" style={inputStyle} value={form.assigned_to} onChange={set("assigned_to")} placeholder="ash" />
            </div>
            <div>
              <span style={label}>Priority (1–10)</span>
              <input id="task-priority" style={inputStyle} type="number" min={1} max={10} value={form.priority} onChange={set("priority")} />
            </div>
            <div>
              <span style={label}>Effort Tier</span>
              <select id="task-effort" style={inputStyle} value={form.effort_tier} onChange={set("effort_tier")}>
                <option value="">— optional —</option>
                <option value="quick">Quick (&lt;30 min)</option>
                <option value="moderate">Moderate (30–90 min)</option>
                <option value="involved">Involved (1.5–3 hrs)</option>
                <option value="epic">Epic (3+ hrs)</option>
              </select>
            </div>
            <div>
              <span style={label}>Due Date</span>
              <input id="task-due" style={inputStyle} type="date" value={form.due_date} onChange={set("due_date")} />
            </div>
          </div>

          {error && (
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
              color: "#f43f5e", fontSize: "0.85rem", display: "flex", gap: 8, alignItems: "center",
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, fontSize: "0.875rem", color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>
              Cancel
            </button>
            <motion.button
              type="submit" disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}} whileTap={!saving ? { scale: 0.98 } : {}}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: "0.875rem",
                background: "linear-gradient(135deg, #a78bfa, #818cf8)",
                color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Send size={14} />}
              {saving ? "Creating…" : "Create Task"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Agent Work Card ────────────────────────────────────────────────────────────

// Status → background tint map
const WORK_BG: Record<string, string> = {
  running:      "rgba(56,189,248,0.04)",
  in_progress:  "rgba(56,189,248,0.03)",
  done:         "rgba(34,197,94,0.04)",
  blocked:      "rgba(244,63,94,0.05)",
  needs_human:  "rgba(245,158,11,0.04)",
  pending:      "rgba(255,255,255,0.02)",
  cancelled:    "rgba(255,255,255,0.01)",
};

function WorkCard({ work, onStatusChange, onOpenDrawer }: {
  work: AgentWork;
  onStatusChange: (id: string, status: WorkStatus) => Promise<void>;
  onOpenDrawer: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const statusCfg = WORK_STATUS[work.status] ?? WORK_STATUS.pending;
  const StatusIcon = statusCfg.icon;
  const milestones: { label: string; done?: boolean }[] = Array.isArray(work.milestones) ? work.milestones : [];
  const cardBg = WORK_BG[work.status] ?? "rgba(255,255,255,0.02)";

  const act = async (status: WorkStatus) => {
    setActing(true);
    await onStatusChange(work.id, status);
    setActing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: cardBg,
        border: `1px solid ${statusCfg.color}22`,
        borderLeft: `3px solid ${statusCfg.color}`,
        borderRadius: 12, overflow: "hidden",
        opacity: work.status === "cancelled" ? 0.5 : 1,
        cursor: "pointer",
      }}
      onClick={() => onOpenDrawer(work.id)}
    >
      {/* Progress bar */}
      {(work.status === "running" || work.status === "in_progress") && milestones.length > 0 && (
        <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            style={{ height: "100%", background: statusCfg.color }}
            initial={{ width: 0 }}
            animate={{ width: `${((work.current_milestone ?? 0) / milestones.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      <div style={{ padding: "0.75rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          {/* Status icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${statusCfg.color}15`,
            border: `1px solid ${statusCfg.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <StatusIcon
              size={15} color={statusCfg.color}
              style={(work.status === "running" || work.status === "in_progress") ? { animation: "spin 2s linear infinite" } : {}}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tags row */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: `${statusCfg.color}15`, color: statusCfg.color, textTransform: "uppercase" }}>
                {statusCfg.label}
              </span>
              {work.agent_name && (
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.05)", color: "#64748b" }}>
                  {work.agent_name}
                </span>
              )}
              {work.effort_tier && (
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: `${EFFORT_COLOR[work.effort_tier]}15`, color: EFFORT_COLOR[work.effort_tier] }}>
                  {EFFORT_LABEL[work.effort_tier]}
                </span>
              )}
              {work.estimated_hours && (
                <span style={{ fontSize: 9, color: "#475569" }}>{work.estimated_hours}h est.</span>
              )}
            </div>

            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#e2e8f0", margin: "0 0 4px" }}>
              {work.title}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {priorityBar(work.priority, statusCfg.color)}
              <span style={{ fontSize: 9, color: "#475569" }}>
                Run {work.run_count}/{work.max_runs}
              </span>
              {work.last_run_at && (
                <span style={{ fontSize: 9, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
                  <Clock size={9} /> {timeAgo(work.last_run_at)}
                </span>
              )}
            </div>

            {work.last_progress && (
              <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: 5, lineHeight: 1.5 }}>
                {work.last_progress.slice(0, 180)}{work.last_progress.length > 180 ? "…" : ""}
              </p>
            )}
          </div>

          {/* Expand / detail buttons */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {(work.description || milestones.length > 0 || work.completion_report) && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button
              onClick={() => onOpenDrawer(work.id)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#334155", padding: 4 }}
              aria-label="Open detail panel"
              title="Open detail panel"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                {work.description && (
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    {work.description}
                  </p>
                )}

                {/* Milestones */}
                {milestones.length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: "0.08em", marginBottom: 5 }}>
                      Milestones ({work.current_milestone}/{milestones.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {milestones.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: i < (work.current_milestone ?? 0) ? "#22c55e" : "rgba(255,255,255,0.06)", border: `1px solid ${i < (work.current_milestone ?? 0) ? "#22c55e" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {i < (work.current_milestone ?? 0) && <CheckCheck size={8} color="#fff" />}
                          </div>
                          <span style={{ fontSize: "11px", color: i < (work.current_milestone ?? 0) ? "#22c55e" : i === (work.current_milestone ?? 0) ? "#e2e8f0" : "#64748b" }}>{m.label}</span>
                          {i === (work.current_milestone ?? 0) && <span style={{ fontSize: 8, color: "#38bdf8" }}>← current</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completion report */}
                {work.completion_report && (
                  <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", marginBottom: 3 }}>Completion Report</p>
                    <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.5 }}>{work.completion_report}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action bar */}
        {(work.status !== "done" && work.status !== "cancelled") && (
          <div style={{ display: "flex", gap: 5, marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <motion.button
              onClick={() => act("done")}
              disabled={acting}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: acting ? "wait" : "pointer" }}
            >
              <CheckCircle2 size={10} /> Mark Done
            </motion.button>
            <motion.button
              onClick={() => act("cancelled")}
              disabled={acting}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#475569", cursor: acting ? "wait" : "pointer" }}
            >
              <XCircle size={10} /> Cancel
            </motion.button>
            <a
              href={`/chats?agent=${work.agent_id}&context=${encodeURIComponent(`[Work: ${work.title}] Tell me about this.`)}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", color: "#475569", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", marginLeft: "auto" }}
            >
              <ExternalLink size={9} /> Chat
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Human Task Card ────────────────────────────────────────────────────────────

function HumanTaskCard({ task, onStatusChange, onOpenDrawer }: {
  task: HumanTask;
  onStatusChange: (id: string, status: TaskStatus, notes?: string) => Promise<void>;
  onOpenDrawer: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const statusCfg = TASK_STATUS[task.status] ?? TASK_STATUS.pending;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  const act = async (status: TaskStatus, n?: string) => {
    setActing(true);
    await onStatusChange(task.id, status, n);
    setActing(false);
    setCompleting(false);
  };

  const taskBg = isOverdue ? "rgba(244,63,94,0.05)"
    : task.status === "done" ? "rgba(34,197,94,0.04)"
    : task.status === "in_progress" ? "rgba(56,189,248,0.03)"
    : task.status === "blocked" ? "rgba(244,63,94,0.04)"
    : "rgba(245,158,11,0.03)";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: taskBg,
        border: `1px solid ${isOverdue ? "#f43f5e" : statusCfg.color}22`,
        borderLeft: `3px solid ${isOverdue ? "#f43f5e" : statusCfg.color}`,
        borderRadius: 12, padding: "0.75rem 1rem",
        opacity: task.status === "cancelled" ? 0.5 : 1,
        cursor: "pointer",
      }}
      onClick={() => onOpenDrawer(task.id)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User size={13} color={statusCfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: `${statusCfg.color}15`, color: statusCfg.color, textTransform: "uppercase" }}>
              {statusCfg.label}
            </span>
            {task.created_by_agent && task.created_by_agent !== "human" && (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
                from {task.created_by_agent}
              </span>
            )}
            {task.effort_tier && (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: `${EFFORT_COLOR[task.effort_tier]}15`, color: EFFORT_COLOR[task.effort_tier] }}>
                {EFFORT_LABEL[task.effort_tier]}
              </span>
            )}
            {task.due_date && (
              <span style={{ fontSize: 9, fontWeight: 700, color: isOverdue ? "#f43f5e" : "#f59e0b" }}>
                {isOverdue ? "⚠ Overdue" : `Due ${new Date(task.due_date).toLocaleDateString()}`}
              </span>
            )}
            {task.followup_count > 0 && (
              <span style={{ fontSize: 9, color: "#475569" }}>
                {task.followup_count} reminder{task.followup_count > 1 ? "s" : ""} sent
              </span>
            )}
          </div>
          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f0ede8", margin: "0 0 3px" }}>{task.title}</p>
          {task.description && (
            <p style={{ fontSize: "10px", color: "#64748b", margin: 0 }}>{task.description}</p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: 4, flexWrap: "wrap" }}>
            {priorityBar(task.priority, statusCfg.color)}
            <span style={{ fontSize: 9, color: "#334155" }}>
              → <span style={{ color: "#94a3b8" }}>{task.assigned_username ?? task.assigned_to}</span>
            </span>
            <span style={{ fontSize: 9, color: "#334155" }}>{timeAgo(task.created_at)}</span>
          </div>
        </div>

        {task.instructions && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", padding: 4, flexShrink: 0 }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Instructions */}
      <AnimatePresence>
        {expanded && task.instructions && (
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
      {task.status !== "done" && task.status !== "cancelled" && (
        <div style={{ marginTop: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {completing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <input
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Completion notes (optional)"
                style={{ width: "100%", padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: "11px", outline: "none" }}
                autoFocus
              />
              <div style={{ display: "flex", gap: 5 }}>
                <motion.button
                  onClick={() => act("done", notes || undefined)}
                  disabled={acting}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 6, fontSize: "11px", fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: "pointer" }}
                >
                  <CheckCircle2 size={11} /> Confirm Done
                </motion.button>
                <button onClick={() => setCompleting(false)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: "11px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {task.status === "pending" && (
                <motion.button
                  onClick={() => act("in_progress")}
                  disabled={acting}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", cursor: "pointer" }}
                >
                  <PlayCircle size={10} /> Start
                </motion.button>
              )}
              <motion.button
                onClick={() => setCompleting(true)}
                disabled={acting}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", cursor: "pointer" }}
              >
                <CheckCircle2 size={10} /> Done
              </motion.button>
              <motion.button
                onClick={() => act("blocked")}
                disabled={acting}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 600, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", color: "#f43f5e", cursor: "pointer" }}
              >
                <AlertCircle size={10} /> Blocked
              </motion.button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, color, urgent }: { label: string; value: number | string; color: string; urgent?: boolean }) {
  return (
    <div style={{ padding: "8px 14px", borderRadius: 9, background: `${color}08`, border: `1px solid ${urgent ? color : color + "20"}`, textAlign: "center", minWidth: 80, position: "relative" }}>
      {urgent && Number(value) > 0 && (
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}
          style={{ position: "absolute", top: 6, right: 6, width: 5, height: 5, borderRadius: "50%", background: color }}
        />
      )}
      <div style={{ fontSize: "1.4rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Runner Cycle Progress Bar ───────────────────────────────────────────────────
// Shows time elapsed since last run as a fill toward the 15-min cycle window.
// Ticks every second; glows green as it approaches the next fire time.

function RunnerCycleBar({ lastRunAt, cycleMinutes }: { lastRunAt: string | null; cycleMinutes: number }) {
  const [pct, setPct] = useState(0);
  const [secLeft, setSecLeft] = useState(cycleMinutes * 60);

  useEffect(() => {
    const tick = () => {
      if (!lastRunAt) { setPct(0); setSecLeft(cycleMinutes * 60); return; }
      const elapsed = (Date.now() - new Date(lastRunAt).getTime()) / 1000;
      const total   = cycleMinutes * 60;
      const p       = Math.min(100, (elapsed / total) * 100);
      const left    = Math.max(0, total - elapsed);
      setPct(p);
      setSecLeft(Math.round(left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastRunAt, cycleMinutes]);

  const imminent  = pct >= 90;
  const minsLeft  = Math.floor(secLeft / 60);
  const secsLeft  = secLeft % 60;
  const label     = secLeft <= 0 ? "Running…" : `${minsLeft}m ${String(secsLeft).padStart(2, "0")}s`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Next Run
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {imminent && (
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }}
            />
          )}
          <span style={{ fontSize: "9px", color: imminent ? "#22c55e" : "#64748b", fontVariantNumeric: "tabular-nums" }}>
            {!lastRunAt ? "—" : label}
          </span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "linear" }}
          style={{
            height: "100%", borderRadius: 4,
            background: imminent
              ? "linear-gradient(90deg, #22c55e, #4ade80)"
              : "linear-gradient(90deg, #1e3a5f, #38bdf8)",
            boxShadow: imminent ? "0 0 8px rgba(34,197,94,0.5)" : "none",
          }}
        />
      </div>
    </div>
  );
}



const PIPELINE_COLUMNS: { id: WorkStatus[]; label: string; color: string }[] = [
  { id: ['pending'],                  label: 'Pending',    color: '#64748b' },
  { id: ['running', 'in_progress'],   label: 'Active',     color: '#38bdf8' },
  { id: ['blocked'],                  label: 'Blocked',    color: '#f43f5e' },
  { id: ['needs_human'],              label: 'Needs You',  color: '#f59e0b' },
  { id: ['done', 'cancelled'],        label: 'Done',       color: '#22c55e' },
];

function WorkPipeline({ work, onStatusChange }: {
  work: AgentWork[];
  onStatusChange: (id: string, status: WorkStatus) => Promise<void>;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
      {PIPELINE_COLUMNS.map(col => {
        const items = work.filter(w => col.id.includes(w.status));
        return (
          <div key={col.label} style={{
            minWidth: 240, width: 240, flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderTop: `3px solid ${col.color}`,
            borderRadius: 12, padding: '0.75rem',
          }}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: col.color }}>
                {col.label}
              </span>
              {items.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: `${col.color}20`, color: col.color }}>
                  {items.length}
                </span>
              )}
            </div>
            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '68vh', overflowY: 'auto' }}>
              <AnimatePresence mode="popLayout">
                {items.length === 0 && (
                  <p style={{ fontSize: '10px', color: '#334155', textAlign: 'center', padding: '1rem 0' }}>—</p>
                )}
                {items.map(w => {
                  const cfg = WORK_STATUS[w.status] ?? WORK_STATUS.pending;
                  const pct = w.milestones.length > 0
                    ? Math.round((w.current_milestone / w.milestones.length) * 100)
                    : null;
                  return (
                    <motion.div
                      key={w.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${cfg.color}18`,
                        borderLeft: `3px solid ${cfg.color}`,
                        borderRadius: 9, padding: '0.6rem 0.75rem',
                        cursor: 'default',
                      }}
                    >
                      {/* Agent tag */}
                      {w.agent_name && (
                        <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, fontWeight: 600 }}>
                          {w.agent_name}
                        </div>
                      )}
                      {/* Title */}
                      <p style={{
                        fontWeight: 700, fontSize: '0.78rem', color: '#e2e8f0', margin: '0 0 5px',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {w.title}
                      </p>
                      {/* Progress bar */}
                      {pct !== null && (
                        <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', marginBottom: 6 }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: cfg.color, transition: 'width 0.4s' }} />
                        </div>
                      )}
                      {/* Priority + run count */}
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: w.priority >= 8 ? '#f43f5e' : w.priority >= 6 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>
                          P{w.priority}
                        </span>
                        {w.run_count > 0 && (
                          <span style={{ fontSize: 9, color: '#334155' }}>run {w.run_count}/{w.max_runs}</span>
                        )}
                        {/* Quick action: move to next status */}
                        {w.status === 'pending' && (
                          <button
                            onClick={() => onStatusChange(w.id, 'in_progress')}
                            style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 7px', borderRadius: 5, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Start
                          </button>
                        )}
                        {(w.status === 'running' || w.status === 'in_progress') && (
                          <button
                            onClick={() => onStatusChange(w.id, 'done')}
                            style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 7px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Done
                          </button>
                        )}
                      </div>
                      {/* Last progress snippet */}
                      {w.last_progress && col.id.includes('in_progress' as WorkStatus) && (
                        <p style={{ fontSize: 9, color: '#475569', marginTop: 5, lineHeight: 1.4 }}>
                          {w.last_progress.slice(0, 80)}{w.last_progress.length > 80 ? '…' : ''}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WorkPage() {
  const [work, setWork] = useState<AgentWork[]>([]);
  const [humanTasks, setHumanTasks] = useState<HumanTask[]>([]);
  const [summary, setSummary] = useState<WorkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [workTab, setWorkTab] = useState<"active" | "pending" | "blocked" | "done" | "all">("active");
  const [workView, setWorkView] = useState<'list' | 'pipeline'>('list');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [runnerEnabled, setRunnerEnabled] = useState<boolean | null>(null);
  const [runnerLastRun, setRunnerLastRun] = useState<string | null>(null);
  const [runnerLastCount, setRunnerLastCount] = useState<number | null>(null);
  const [runnerToggling, setRunnerToggling] = useState(false);
  // Detail drawer
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [drawerItemType, setDrawerItemType] = useState<"work" | "task" | "agent_task">("work");
  const openDrawer = (id: string, type: "work" | "task") => { setDrawerItemId(id); setDrawerItemType(type); };
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [wRes, hRes, sRes, rRes] = await Promise.all([
        // ?kind=task — research investigations live at /research now. Mixing them
        // here meant recurring SEO audits and market analyses crowded out the
        // one-off actions this queue exists to clear.
        fetch(`${BOT_URL}/admin/work?kind=task&limit=150`),
        fetch(`${BOT_URL}/admin/work/human?limit=100`),
        fetch(`${BOT_URL}/admin/work/summary?kind=task`),
        fetch(`${BOT_URL}/admin/work/runner/status`),
      ]);
      if (wRes.ok) setWork(await wRes.json());
      if (hRes.ok) setHumanTasks(await hRes.json());
      if (sRes.ok) setSummary(await sRes.json());
      if (rRes.ok) {
        const r = await rRes.json();
        setRunnerEnabled(r.enabled);
        setRunnerLastRun(r.last_run_at);
        setRunnerLastCount(r.last_items_processed);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(() => {
      fetchData(true);
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);

    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const manualRefresh = () => {
    fetchData();
    setCountdown(REFRESH_INTERVAL);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchData(true);
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);
  };

  const updateWorkStatus = async (id: string, status: WorkStatus) => {
    await fetch(`${BOT_URL}/admin/work/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setWork(prev => prev.map(w => w.id === id ? { ...w, status } : w));
    fetchData(true);
  };

  const updateTaskStatus = async (id: string, status: TaskStatus, notes?: string) => {
    await fetch(`${BOT_URL}/admin/work/human/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(notes ? { completion_notes: notes } : {}) }),
    });
    setHumanTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    fetchData(true);
  };

  const toggleRunner = async () => {
    if (runnerToggling || runnerEnabled === null) return;
    const newVal = !runnerEnabled;
    setRunnerToggling(true);
    setRunnerEnabled(newVal); // optimistic
    try {
      await fetch(`${BOT_URL}/admin/work/runner/toggle`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newVal }),
      });
    } catch {
      setRunnerEnabled(!newVal); // revert on error
    } finally {
      setRunnerToggling(false);
    }
  };

  // Filter agent work by tab
  const filteredWork = work.filter(w => {
    if (workTab === "active")  return ["running", "in_progress"].includes(w.status);
    if (workTab === "blocked") return ["blocked", "needs_human"].includes(w.status);
    if (workTab === "pending") return w.status === "pending";
    if (workTab === "done")    return w.status === "done" || w.status === "cancelled";
    return true;
  });

  const filteredHuman = humanTasks.filter(t =>
    showDoneTasks ? true : (t.status !== "done" && t.status !== "cancelled")
  );

  const blockedCount = (summary?.agent_work.blocked ?? 0) + (summary?.agent_work.needs_human ?? 0);

  const agentWorkTabs: { id: typeof workTab; label: string; count: number; color: string }[] = [
    { id: "active",  label: "Active",   count: summary?.agent_work.active  ?? 0, color: "#38bdf8" },
    { id: "blocked", label: "Blocked",  count: blockedCount,                     color: "#f43f5e" },
    { id: "pending", label: "Pending",  count: summary?.agent_work.pending ?? 0, color: "#64748b" },
    { id: "done",    label: "Done",     count: summary?.agent_work.done    ?? 0, color: "#22c55e" },
    { id: "all",     label: "All",      count: summary?.agent_work.total   ?? 0, color: "#475569" },
  ];

  return (
    <div className="px-4 py-5" style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.08))", border: "1px solid rgba(56,189,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Cpu size={20} color="#38bdf8" />
            </div>
            <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>Work Queue</h1>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Live view of agent tasks and items that need your attention.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#334155" }}>auto-refresh in {countdown}s</span>
          <button
            onClick={manualRefresh}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: "12px", cursor: "pointer" }}
            aria-label="Refresh"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      {summary && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
          <StatPill label="Active" value={summary.agent_work.active} color="#38bdf8" />
          <StatPill label="Blocked" value={blockedCount} color="#f43f5e" urgent={blockedCount > 0} />
          <StatPill label="Done" value={summary.agent_work.done} color="#22c55e" />
          <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />
          <StatPill label="Your Tasks" value={summary.human_tasks.pending + summary.human_tasks.in_progress} color="#a78bfa" />
          {summary.human_tasks.high_priority_pending > 0 && (
            <StatPill label="Urgent" value={summary.human_tasks.high_priority_pending} color="#f43f5e" urgent />
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem" }}>

        {/* ── Agent Work ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {/* Live pulse */}
              {summary && summary.agent_work.active > 0 && (
                <motion.div
                  animate={{ opacity: [1, 0.2, 1], scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8" }}
                />
              )}
              <Cpu size={14} color="#38bdf8" />
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#38bdf8" }}>Agent Work</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {agentWorkTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setWorkTab(tab.id)}
                    style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: "10px", fontWeight: 700,
                      background: workTab === tab.id ? `${tab.color}15` : "transparent",
                      color: workTab === tab.id ? tab.color : "#475569",
                      border: workTab === tab.id ? `1px solid ${tab.color}30` : "1px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label} {tab.count > 0 && <span style={{ fontSize: 9, marginLeft: 2 }}>{tab.count}</span>}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={() => setWorkView('list')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, fontSize: '11px', fontWeight: 700, background: workView === 'list' ? 'rgba(56,189,248,0.15)' : 'transparent', border: `1px solid ${workView === 'list' ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.07)'}`, color: workView === 'list' ? '#38bdf8' : '#475569', cursor: 'pointer' }}
                  aria-label="List view"
                >
                  <LayoutList size={12} /> List
                </button>
                <button
                  onClick={() => setWorkView('pipeline')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, fontSize: '11px', fontWeight: 700, background: workView === 'pipeline' ? 'rgba(56,189,248,0.15)' : 'transparent', border: `1px solid ${workView === 'pipeline' ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.07)'}`, color: workView === 'pipeline' ? '#38bdf8' : '#475569', cursor: 'pointer' }}
                  aria-label="Pipeline view"
                >
                  <Columns size={12} /> Pipeline
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", padding: "2rem 0" }}>
              <Loader size={16} className="spin" /> Loading…
            </div>
          ) : filteredWork.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <BarChart2 size={32} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                {workTab === "active" ? "No active work — agents are idle." :
                 workTab === "blocked" ? "Nothing blocked. 🎉" : "No items in this view."}
              </p>
            </div>
          ) : workView === 'pipeline' ? (
            <WorkPipeline work={work} onStatusChange={updateWorkStatus} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <AnimatePresence mode="popLayout">
                {filteredWork.map(w => (
                  <WorkCard key={w.id} work={w} onStatusChange={updateWorkStatus} onOpenDrawer={(id) => openDrawer(id, "work")} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Work Runner Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${runnerEnabled ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: "1rem", transition: "border-color 0.3s" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Live dot */}
              {runnerEnabled ? (
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}
                  style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#475569", flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "0.02em" }}>
                  Work Runner
                </div>
                <div style={{ fontSize: "10px", color: runnerEnabled ? "#22c55e" : "#64748b", marginTop: 1 }}>
                  {runnerEnabled === null ? "Loading…" : runnerEnabled ? "Running · agents execute every 15 min" : "Paused · agents won't auto-execute"}
                </div>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              id="work-runner-toggle"
              onClick={toggleRunner}
              disabled={runnerToggling || runnerEnabled === null}
              aria-label={runnerEnabled ? "Disable work runner" : "Enable work runner"}
              style={{ position: "relative", width: 44, height: 24, borderRadius: 12, background: runnerEnabled ? "rgba(34,197,94,0.35)" : "rgba(71,85,105,0.4)", border: `1px solid ${runnerEnabled ? "rgba(34,197,94,0.5)" : "rgba(71,85,105,0.5)"}`, cursor: runnerToggling ? "wait" : "pointer", transition: "background 0.25s, border-color 0.25s", flexShrink: 0, outline: "none" }}
            >
              <motion.div
                animate={{ x: runnerEnabled ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%", background: runnerEnabled ? "#22c55e" : "#64748b", boxShadow: runnerEnabled ? "0 0 8px rgba(34,197,94,0.6)" : "none" }}
              />
            </button>
          </div>

          {/* ── Threshold bars ── */}
          {runnerEnabled && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Next-run countdown bar */}
              <RunnerCycleBar lastRunAt={runnerLastRun} cycleMinutes={15} />

              {/* Jobs processed in last cycle */}
              {runnerLastCount !== null && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last Cycle</span>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>{runnerLastCount} job{runnerLastCount !== 1 ? "s" : ""} processed</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (runnerLastCount / 20) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ height: "100%", borderRadius: 4, background: runnerLastCount > 0 ? "linear-gradient(90deg, #38bdf8, #818cf8)" : "#334155" }}
                    />
                  </div>
                </div>
              )}

              {/* Last-run timestamp */}
              {runnerLastRun && (
                <div style={{ fontSize: "9px", color: "#334155" }}>
                  Last run: <span style={{ color: "#475569" }}>{new Date(runnerLastRun).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              )}
            </div>
          )}

          {/* When paused, just show last run */}
          {!runnerEnabled && runnerLastRun && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "10px", color: "#475569" }}>
                Last run: <span style={{ color: "#64748b" }}>{new Date(runnerLastRun).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          )}
        </motion.div>


        {/* ── Human Tasks ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ClipboardList size={14} color="#a78bfa" />
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a78bfa" }}>Your Tasks</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "9px", color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={showDoneTasks} onChange={e => setShowDoneTasks(e.target.checked)} style={{ width: 11, height: 11 }} />
                Show done
              </label>
              <motion.button
                onClick={() => setShowCreateTask(true)}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                aria-label="Create task"
                style={{
                  width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(167,139,250,0.3)",
                  background: "rgba(167,139,250,0.1)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa",
                }}
              >
                <Plus size={13} />
              </motion.button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
              <Loader size={14} className="spin" /> Loading…
            </div>
          ) : filteredHuman.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <Zap size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.82rem", color: "#475569" }}>No tasks assigned — you&apos;re clear! 🎉</p>
              <button
                onClick={() => setShowCreateTask(true)}
                style={{ marginTop: "0.75rem", padding: "5px 14px", borderRadius: 7, fontSize: "11px", fontWeight: 700, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa", cursor: "pointer" }}
              >
                + Assign a task
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <AnimatePresence mode="popLayout">
                {filteredHuman.map(t => (
                  <HumanTaskCard key={t.id} task={t} onStatusChange={updateTaskStatus} onOpenDrawer={(id) => openDrawer(id, "task")} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTask && (
          <CreateTaskModal
            onClose={() => setShowCreateTask(false)}
            onCreated={() => fetchData(true)}
          />
        )}
      </AnimatePresence>

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
    </div>
  );
}
