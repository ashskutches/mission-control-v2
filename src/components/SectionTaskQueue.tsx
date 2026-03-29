"use client";
/**
 * SectionTaskQueue — Agent Action Approval Panel
 *
 * Displays queued agent tasks (proposed live-fire actions) for a given section.
 * Humans can approve, reject, or leave notes. Approving an AI task triggers
 * automatic backend execution; approving a human task marks it for manual action.
 *
 * Tabs: Pending | Approved | Done/Failed
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, Play, AlertTriangle,
  ChevronDown, ChevronUp, User, Bot, RefreshCw, Zap
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentTask {
  id: string;
  section: string;
  title: string;
  body: string | null;
  tool_name: string;
  tool_input: Record<string, unknown>;
  assigned_to: "ai" | "human";
  status: "pending" | "approved" | "rejected" | "running" | "done" | "failed";
  human_note: string | null;
  result: string | null;
  priority: number;
  agent_id: string;
  agent_name: string | null;
  created_at: string;
  updated_at: string;
}

type TabId = "pending" | "active" | "done";

const TAB_STATUSES: Record<TabId, string[]> = {
  pending:  ["pending"],
  active:   ["approved", "running"],
  done:     ["done", "failed", "rejected"],
};

const TOOL_DISPLAY: Record<string, { label: string; color: string }> = {
  "gmail_send":                  { label: "Email Send",      color: "#38bdf8" },
  "sms__send":                   { label: "SMS Send",        color: "#a78bfa" },
  "sms__broadcast":              { label: "SMS Broadcast",   color: "#f43f5e" },
  "call__initiate":              { label: "Voice Call",      color: "#fb923c" },
  "social__schedule-post":       { label: "Social Post",     color: "#22c55e" },
  "klaviyo__create-campaign-draft": { label: "Email Campaign", color: "#f59e0b" },
  "klaviyo__send_campaign":      { label: "Campaign Send",   color: "#f43f5e" },
};
const getToolInfo = (name: string) =>
  TOOL_DISPLAY[name] ?? { label: name.replace(/__/g, " → "), color: "#64748b" };

// ── Priority badge ─────────────────────────────────────────────────────────────
function PriorityBadge({ p }: { p: number }) {
  const color = p >= 9 ? "#f43f5e" : p >= 7 ? "#fb923c" : p >= 5 ? "#f59e0b" : "#64748b";
  const label = p >= 9 ? "Urgent" : p >= 7 ? "High" : p >= 5 ? "Normal" : "Low";
  return (
    <span style={{ fontSize: "9px", fontWeight: 700, color, background: `${color}18`,
      border: `1px solid ${color}30`, borderRadius: 4, padding: "1px 6px" }}>
      {label}
    </span>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onApprove, onReject, accentColor }: {
  task: AgentTask;
  onApprove: (id: string, note?: string) => Promise<void>;
  onReject:  (id: string, note?: string) => Promise<void>;
  accentColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting,   setActing]   = useState(false);
  const [noting,   setNoting]   = useState(false);
  const [note,     setNote]     = useState("");
  const tool = getToolInfo(task.tool_name);
  const isPending = task.status === "pending";
  const isRunning = task.status === "running";

  const statusIcon = {
    pending:  <Clock size={11} color="#f59e0b" />,
    approved: <CheckCircle size={11} color="#22c55e" />,
    running:  <Play size={11} color="#38bdf8" />,
    done:     <CheckCircle size={11} color="#22c55e" />,
    failed:   <AlertTriangle size={11} color="#f43f5e" />,
    rejected: <XCircle size={11} color="#f43f5e" />,
  }[task.status] ?? <Clock size={11} />;

  const approve = async () => {
    setActing(true);
    await onApprove(task.id, note || undefined);
    setActing(false); setNoting(false); setNote("");
  };
  const reject = async () => {
    setActing(true);
    await onReject(task.id, note || undefined);
    setActing(false); setNoting(false); setNote("");
  };

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
      style={{ background: "rgba(255,255,255,0.025)", border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `3px solid ${tool.color}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      {/* Priority bar */}
      <div style={{ height: 2, background: `linear-gradient(to right, ${tool.color}, ${tool.color}30)`, width: `${task.priority * 10}%` }} />

      {/* Header row */}
      <div style={{ padding: "0.65rem 0.9rem", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Tool badge */}
          <span style={{ fontSize: "9px", fontWeight: 700, color: tool.color,
            background: `${tool.color}15`, border: `1px solid ${tool.color}30`,
            borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
            {tool.label}
          </span>
          {/* Assignee icon */}
          {task.assigned_to === "ai"
            ? <Bot size={10} color="#38bdf8" />
            : <User size={10} color="#a78bfa" />}
          {/* Title */}
          <p style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: "0.8rem",
            color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap" }}>
            {task.title}
          </p>
          {/* Right side */}
          <PriorityBadge p={task.priority} />
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#475569", fontSize: "9px" }}>
            {statusIcon} {task.status}
          </span>
          {expanded ? <ChevronUp size={12} color="#475569" /> : <ChevronDown size={12} color="#475569" />}
        </div>
        <p style={{ fontSize: "9px", color: "#334155", margin: "3px 0 0", lineHeight: 1.4 }}>
          {task.agent_name ?? task.agent_id} · {new Date(task.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 0.9rem 0.85rem" }}>
              {/* Body */}
              {task.body && (
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.55, marginBottom: 8,
                  whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {task.body}
                </p>
              )}

              {/* Tool input (collapsible code block) */}
              <details style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: "9px", color: "#475569", cursor: "pointer", marginBottom: 4 }}>
                  Tool input — {task.tool_name}
                </summary>
                <pre style={{ fontSize: "10px", color: "#64748b", background: "rgba(0,0,0,0.3)",
                  borderRadius: 6, padding: "6px 8px", overflow: "auto", maxHeight: 200, margin: 0 }}>
                  {JSON.stringify(task.tool_input, null, 2)}
                </pre>
              </details>

              {/* Result (if done/failed) */}
              {task.result && (
                <div style={{ background: task.status === "done" ? "rgba(34,197,94,0.06)" : "rgba(244,63,94,0.06)",
                  border: `1px solid ${task.status === "done" ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)"}`,
                  borderRadius: 6, padding: "6px 8px", marginBottom: 8 }}>
                  <p style={{ fontSize: "10px", color: task.status === "done" ? "#22c55e" : "#f43f5e",
                    fontWeight: 700, margin: "0 0 2px" }}>
                    Result
                  </p>
                  <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0, whiteSpace: "pre-wrap" }}>
                    {task.result}
                  </p>
                </div>
              )}

              {/* Human note */}
              {task.human_note && (
                <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 8px", fontStyle: "italic" }}>
                  "{task.human_note}"
                </p>
              )}

              {/* Action buttons — only when pending */}
              {isPending && (
                <div>
                  {noting ? (
                    <div>
                      <input placeholder="Optional note for the agent…" value={note}
                        onChange={e => setNote(e.target.value)}
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.10)", borderRadius: 7,
                          color: "#e2e8f0", padding: "5px 8px", fontSize: "11px", marginBottom: 6, outline: "none" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={approve} disabled={acting}
                          style={{ flex: 1, fontSize: "11px", fontWeight: 700, cursor: acting ? "default" : "pointer",
                            background: "rgba(34,197,94,0.12)", color: "#22c55e",
                            border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, padding: "5px",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <CheckCircle size={11} /> {task.assigned_to === "ai" ? "Approve & Run" : "Approve"}
                        </button>
                        <button onClick={reject} disabled={acting}
                          style={{ flex: 1, fontSize: "11px", fontWeight: 700, cursor: acting ? "default" : "pointer",
                            background: "rgba(244,63,94,0.08)", color: "#f43f5e",
                            border: "1px solid rgba(244,63,94,0.2)", borderRadius: 7, padding: "5px",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <XCircle size={11} /> Reject
                        </button>
                        <button onClick={() => { setNoting(false); setNote(""); }} disabled={acting}
                          style={{ fontSize: "11px", color: "#475569", background: "transparent",
                            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "5px 10px" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setNoting(true)} disabled={acting}
                        style={{ flex: 1, fontSize: "11px", fontWeight: 700, cursor: acting ? "default" : "pointer",
                          background: "rgba(34,197,94,0.12)", color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, padding: "5px",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <Zap size={11} /> {task.assigned_to === "ai" ? "Approve & Execute" : "Mark Approved"}
                      </button>
                      <button onClick={() => { setNoting(true); }}  disabled={acting}
                        id={`task-reject-${task.id}`}
                        aria-label="Reject task"
                        style={{ fontSize: "11px", fontWeight: 700, cursor: acting ? "default" : "pointer",
                          background: "rgba(244,63,94,0.08)", color: "#f43f5e",
                          border: "1px solid rgba(244,63,94,0.2)", borderRadius: 7, padding: "5px 12px" }}>
                        <XCircle size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Running indicator */}
              {isRunning && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw size={11} color="#38bdf8" />
                  </motion.div>
                  <span style={{ fontSize: "11px", color: "#38bdf8" }}>Executing…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface SectionTaskQueueProps {
  sectionId: string;
  accentColor: string;
}

export default function SectionTaskQueue({ sectionId, accentColor }: SectionTaskQueueProps) {
  const [tasks, setTasks]     = useState<AgentTask[]>([]);
  const [tab, setTab]         = useState<TabId>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/tasks?section=${sectionId}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTasks(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    fetchTasks();
    const id = setInterval(fetchTasks, 15_000); // poll every 15s
    return () => clearInterval(id);
  }, [fetchTasks]);

  const handleApprove = async (id: string, note?: string) => {
    await fetch(`${BOT_URL}/admin/tasks/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await fetchTasks();
  };

  const handleReject = async (id: string, note?: string) => {
    await fetch(`${BOT_URL}/admin/tasks/${id}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await fetchTasks();
  };

  // Tab counts
  const tabCounts = Object.fromEntries(
    (Object.entries(TAB_STATUSES) as [TabId, string[]][]).map(
      ([k, statuses]) => [k, tasks.filter(t => statuses.includes(t.status)).length]
    )
  ) as Record<TabId, number>;

  const visibleTasks = tasks.filter(t => TAB_STATUSES[tab].includes(t.status))
    .sort((a, b) => b.priority - a.priority || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingCount = tabCounts.pending;

  // Don't render at all if no tasks and not loading
  if (!loading && tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.65rem" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: `${accentColor}18`,
          border: `1px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap size={13} color={accentColor} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1 }}>
            Agent Task Queue
          </p>
          <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 2 }}>
            Actions proposed by agents awaiting your approval
          </p>
        </div>
        {pendingCount > 0 && (
          <span style={{ fontSize: "11px", fontWeight: 700,
            background: "rgba(245,158,11,0.15)", color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "2px 8px" }}>
            {pendingCount} awaiting approval
          </span>
        )}
        <button onClick={fetchTasks} aria-label="Refresh task queue"
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "#475569", display: "flex" }}>
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Panel */}
      <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 1rem", gap: 2 }}>
          {(["pending", "active", "done"] as TabId[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ fontSize: "10px", fontWeight: tab === t ? 700 : 400,
                color: tab === t ? "#e2e8f0" : "#475569",
                background: tab === t ? "rgba(255,255,255,0.07)" : "transparent",
                border: "none", borderBottom: tab === t ? `2px solid ${accentColor}` : "2px solid transparent",
                borderRadius: "6px 6px 0 0", padding: "0.55rem 0.65rem",
                cursor: "pointer", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s" }}>
              {t === "pending" && <Clock size={10} />}
              {t === "active"  && <Play size={10} />}
              {t === "done"    && <CheckCircle size={10} />}
              {t === "pending" ? "Pending" : t === "active" ? "In Progress" : "History"}
              {tabCounts[t] > 0 && (
                <span style={{ fontSize: "9px", fontWeight: 700,
                  background: t === "pending" && tabCounts[t] > 0
                    ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.08)",
                  color: t === "pending" && tabCounts[t] > 0 ? "#f59e0b" : "#64748b",
                  borderRadius: 4, padding: "1px 5px" }}>
                  {tabCounts[t]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "0.85rem 1rem", minHeight: 60 }}>
          {loading ? (
            <p style={{ fontSize: "11px", color: "#475569", textAlign: "center" }}>Loading…</p>
          ) : error ? (
            <p style={{ fontSize: "11px", color: "#f43f5e", textAlign: "center" }}>{error}</p>
          ) : visibleTasks.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#334155", textAlign: "center" }}>
              {tab === "pending" ? "No actions awaiting approval." : `No ${tab} tasks.`}
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {visibleTasks.map(task => (
                <TaskCard key={task.id} task={task} accentColor={accentColor}
                  onApprove={handleApprove} onReject={handleReject} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
