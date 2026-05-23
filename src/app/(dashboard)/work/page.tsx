"use client";
/**
 * /work — Agent Work Queue + Human Tasks Dashboard
 *
 * Real-time view of what agents are actively working on, what's blocked,
 * and what human tasks have been assigned by agents.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, ClipboardList, CheckCircle2, AlertCircle, Loader,
  RefreshCw, Clock, User, ChevronDown, ChevronUp,
  Zap, BarChart2, CircleDot, XCircle, PlayCircle,
  PauseCircle, AlertTriangle, CheckCheck, ExternalLink,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

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
  pending:      { label: "Pending",     color: "#64748b", icon: CircleDot   },
  running:      { label: "Running",     color: "#38bdf8", icon: PlayCircle  },
  in_progress:  { label: "In Progress", color: "#a78bfa", icon: Loader      },
  blocked:      { label: "Blocked",     color: "#f43f5e", icon: PauseCircle },
  needs_human:  { label: "Needs You",   color: "#f59e0b", icon: AlertTriangle },
  done:         { label: "Done",        color: "#22c55e", icon: CheckCircle2 },
  cancelled:    { label: "Cancelled",   color: "#475569", icon: XCircle     },
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

// ── Agent Work Card ────────────────────────────────────────────────────────────

function WorkCard({ work, onStatusChange }: {
  work: AgentWork;
  onStatusChange: (id: string, status: WorkStatus) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const statusCfg = WORK_STATUS[work.status] ?? WORK_STATUS.pending;
  const StatusIcon = statusCfg.icon;
  const milestones: { label: string; done?: boolean }[] = Array.isArray(work.milestones) ? work.milestones : [];

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
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${statusCfg.color}22`,
        borderLeft: `3px solid ${statusCfg.color}`,
        borderRadius: 12, overflow: "hidden",
        opacity: work.status === "cancelled" ? 0.5 : 1,
      }}
    >
      {/* Progress bar for running work */}
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

            {/* Priority + run count + timestamps */}
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

            {/* Latest progress */}
            {work.last_progress && (
              <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: 5, lineHeight: 1.5 }}>
                {work.last_progress.slice(0, 160)}{work.last_progress.length > 160 ? "…" : ""}
              </p>
            )}
          </div>

          {/* Expand button */}
          {(work.description || milestones.length > 0 || work.completion_report) && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", padding: 4, flexShrink: 0 }}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
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
                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: "0.08em", marginBottom: 5 }}>Milestones</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {milestones.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: i < (work.current_milestone ?? 0) ? "#22c55e" : "rgba(255,255,255,0.06)", border: `1px solid ${i < (work.current_milestone ?? 0) ? "#22c55e" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {i < (work.current_milestone ?? 0) && <CheckCheck size={8} color="#fff" />}
                          </div>
                          <span style={{ fontSize: "11px", color: i < (work.current_milestone ?? 0) ? "#22c55e" : "#64748b" }}>{m.label}</span>
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

function HumanTaskCard({ task, onStatusChange }: {
  task: HumanTask;
  onStatusChange: (id: string, status: TaskStatus, notes?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const statusCfg = TASK_STATUS[task.status] ?? TASK_STATUS.pending;

  const act = async (status: TaskStatus, n?: string) => {
    setActing(true);
    await onStatusChange(task.id, status, n);
    setActing(false);
    setCompleting(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: "rgba(245,158,11,0.03)",
        border: `1px solid ${statusCfg.color}22`,
        borderLeft: `3px solid ${statusCfg.color}`,
        borderRadius: 12, padding: "0.75rem 1rem",
        opacity: task.status === "done" || task.status === "cancelled" ? 0.6 : 1,
      }}
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
            {task.created_by_agent && (
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
              <span style={{ fontSize: 9, color: new Date(task.due_date) < new Date() ? "#f43f5e" : "#f59e0b" }}>
                Due {new Date(task.due_date).toLocaleDateString()}
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
              Assigned to: <span style={{ color: "#94a3b8" }}>{task.assigned_username ?? task.assigned_to}</span>
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
                value={notes}
                onChange={e => setNotes(e.target.value)}
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

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: "8px 14px", borderRadius: 9, background: `${color}08`, border: `1px solid ${color}20`, textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WorkPage() {
  const [work, setWork] = useState<AgentWork[]>([]);
  const [humanTasks, setHumanTasks] = useState<HumanTask[]>([]);
  const [summary, setSummary] = useState<WorkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [workTab, setWorkTab] = useState<"active" | "pending" | "done" | "all">("active");
  const [showDoneTasks, setShowDoneTasks] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, hRes, sRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/work?limit=150`),
        fetch(`${BOT_URL}/admin/work/human?limit=100`),
        fetch(`${BOT_URL}/admin/work/summary`),
      ]);
      if (wRes.ok) setWork(await wRes.json());
      if (hRes.ok) setHumanTasks(await hRes.json());
      if (sRes.ok) setSummary(await sRes.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateWorkStatus = async (id: string, status: WorkStatus) => {
    await fetch(`${BOT_URL}/admin/work/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setWork(prev => prev.map(w => w.id === id ? { ...w, status } : w));
    fetchData(); // re-fetch summary counts
  };

  const updateTaskStatus = async (id: string, status: TaskStatus, notes?: string) => {
    await fetch(`${BOT_URL}/admin/work/human/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(notes ? { completion_notes: notes } : {}) }),
    });
    setHumanTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    fetchData();
  };

  // Filter agent work by tab
  const filteredWork = work.filter(w => {
    if (workTab === "active") return ["running", "in_progress", "blocked", "needs_human"].includes(w.status);
    if (workTab === "pending") return w.status === "pending";
    if (workTab === "done") return w.status === "done" || w.status === "cancelled";
    return true;
  });

  const filteredHuman = humanTasks.filter(t =>
    showDoneTasks ? true : (t.status !== "done" && t.status !== "cancelled")
  );

  const agentWorkTabs: { id: typeof workTab; label: string; count: number; color: string }[] = [
    { id: "active",  label: "Active",   count: summary?.agent_work.active ?? 0,   color: "#38bdf8" },
    { id: "pending", label: "Pending",  count: summary?.agent_work.pending ?? 0,  color: "#64748b" },
    { id: "done",    label: "Done",     count: summary?.agent_work.done ?? 0,     color: "#22c55e" },
    { id: "all",     label: "All",      count: summary?.agent_work.total ?? 0,    color: "#475569" },
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
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Active agent tasks, pending work, and items that need your attention.</p>
        </div>
        <button
          onClick={fetchData}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: "12px", cursor: "pointer" }}
          aria-label="Refresh"
        >
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      {summary && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
          <StatPill label="Active" value={summary.agent_work.active} color="#38bdf8" />
          <StatPill label="Blocked" value={summary.agent_work.blocked} color="#f43f5e" />
          <StatPill label="Needs You" value={summary.agent_work.needs_human + summary.human_tasks.pending} color="#f59e0b" />
          <StatPill label="Done Today" value={summary.agent_work.done} color="#22c55e" />
          <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />
          <StatPill label="Your Tasks" value={summary.human_tasks.pending + summary.human_tasks.in_progress} color="#a78bfa" />
          {summary.human_tasks.high_priority_pending > 0 && (
            <StatPill label="Urgent" value={summary.human_tasks.high_priority_pending} color="#f43f5e" />
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem" }}>

        {/* ── Agent Work ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Cpu size={14} color="#38bdf8" />
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#38bdf8" }}>Agent Work</span>
            </div>
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
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", padding: "2rem 0" }}>
              <Loader size={16} className="spin" /> Loading…
            </div>
          ) : filteredWork.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <BarChart2 size={32} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                {workTab === "active" ? "No active work — agents are idle or done." : "No items in this view."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <AnimatePresence mode="popLayout">
                {filteredWork.map(w => (
                  <WorkCard key={w.id} work={w} onStatusChange={updateWorkStatus} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Human Tasks ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ClipboardList size={14} color="#a78bfa" />
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a78bfa" }}>Your Tasks</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "9px", color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={showDoneTasks} onChange={e => setShowDoneTasks(e.target.checked)} style={{ width: 11, height: 11 }} />
              Show done
            </label>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
              <Loader size={14} className="spin" /> Loading…
            </div>
          ) : filteredHuman.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <Zap size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.82rem", color: "#475569" }}>No tasks assigned — you&apos;re clear! 🎉</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <AnimatePresence mode="popLayout">
                {filteredHuman.map(t => (
                  <HumanTaskCard key={t.id} task={t} onStatusChange={updateTaskStatus} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
