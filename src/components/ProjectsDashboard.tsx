"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2,
  Clock, AlertTriangle, Loader2, Bot, X, Play, FileText,
  Users, Zap, MessageSquare, RefreshCw, Crown
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Task {
  id: string; project_id: string; title: string; description: string | null;
  status: "pending" | "claimed" | "in_progress" | "done" | "failed" | "blocked";
  priority: 1 | 2 | 3 | 4; assigned_to: string | null; result: string | null;
  context: string | null; claimed_at: string | null; completed_at: string | null; created_at: string;
}

interface Project {
  id: string; name: string; description: string | null; objective: string | null;
  brief: string | null; constraints: string | null; final_report: string | null;
  status: "active" | "paused" | "complete"; lead_agent_id: string | null;
  kicked_off_at: string | null; owner_agent: string | null; created_at: string;
  task_queue: Task[];
}

interface ProjectAgent {
  project_id: string; agent_id: string; role: "lead" | "worker"; joined_at: string;
}

interface LogEntry {
  id: string; project_id: string; agent_id: string; message: string;
  log_type: "update" | "decision" | "blocker" | "result" | "kickoff" | "review_request" | "complete";
  created_at: string;
}

interface Agent { id: string; name: string; }

const STATUS_CONFIG: Record<Task["status"], { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#888" },
  claimed:     { label: "Claimed",     color: "#06b6d4" },
  in_progress: { label: "In Progress", color: "#3b82f6" },
  done:        { label: "Done",        color: "#22c55e" },
  failed:      { label: "Failed",      color: "#ef4444" },
  blocked:     { label: "Blocked",     color: "#f59e0b" },
};

const LOG_CONFIG: Record<string, { color: string; icon: string }> = {
  update:         { color: "#888",    icon: "💬" },
  decision:       { color: "#06b6d4", icon: "🧠" },
  blocker:        { color: "#ef4444", icon: "🚧" },
  result:         { color: "#22c55e", icon: "✅" },
  kickoff:        { color: "#ff8c00", icon: "🚀" },
  review_request: { color: "#bf00ff", icon: "👀" },
  complete:       { color: "#22c55e", icon: "🎉" },
};

const PRIORITY: Record<number, { label: string; color: string }> = {
  1: { label: "Urgent", color: "#ef4444" }, 2: { label: "High", color: "#f59e0b" },
  3: { label: "Normal", color: "#888" },    4: { label: "Low",  color: "#555" },
};

function PriorityDot({ priority }: { priority: number }) {
  const { color, label } = PRIORITY[priority] ?? PRIORITY[3];
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5, flexShrink: 0 }} title={label} />;
}

// ── Project Log Feed ──────────────────────────────────────────────────────────
function ProjectLogFeed({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLog = useCallback(async () => {
    const res = await fetch(`${BOT_URL}/admin/projects/${projectId}/log?limit=30`);
    if (res.ok) { const data = await res.json(); setEntries([...data].reverse()); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchLog(); const t = setInterval(fetchLog, 8000); return () => clearInterval(t); }, [fetchLog]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [entries.length]);

  if (loading) return <p style={{ fontSize: 11, color: "#555", padding: "0.5rem" }}>Loading log…</p>;
  if (!entries.length) return <p style={{ fontSize: 11, color: "#444", padding: "0.75rem", textAlign: "center" }}>No log entries yet. Start the project to see agent activity here.</p>;

  return (
    <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "0.5rem" }}>
      {entries.map(e => {
        const cfg = LOG_CONFIG[e.log_type] ?? LOG_CONFIG.update;
        return (
          <div key={e.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${cfg.color}20`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 8, padding: "0.5rem 0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 12 }}>{cfg.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, textTransform: "uppercase" }}>{e.log_type}</span>
              <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
            <p style={{ fontSize: 11, color: "#ccc", margin: 0, lineHeight: 1.5 }}>{e.message}</p>
            <p style={{ fontSize: 9, color: "#444", margin: "3px 0 0", fontFamily: "monospace" }}>{e.agent_id}</p>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Agent Assignment Panel ────────────────────────────────────────────────────
function AgentAssignmentPanel({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [assigned, setAssigned] = useState<ProjectAgent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedRole, setSelectedRole] = useState<"lead" | "worker">("worker");

  const fetchAssigned = useCallback(async () => {
    const res = await fetch(`${BOT_URL}/admin/projects/${project.id}/agents`);
    if (res.ok) setAssigned(await res.json());
  }, [project.id]);

  const fetchAgents = useCallback(async () => {
    const res = await fetch(`${BOT_URL}/admin/agents`);
    if (res.ok) setAllAgents(await res.json());
  }, []);

  useEffect(() => { fetchAssigned(); fetchAgents(); }, [fetchAssigned, fetchAgents]);

  const addAgent = async () => {
    if (!selectedAgent) return;
    setAdding(true);
    await fetch(`${BOT_URL}/admin/projects/${project.id}/agents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: selectedAgent, role: selectedRole }),
    });
    if (selectedRole === "lead") {
      await fetch(`${BOT_URL}/admin/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_agent_id: selectedAgent }),
      });
    }
    setSelectedAgent(""); setAdding(false);
    fetchAssigned(); onUpdate();
  };

  const removeAgent = async (agentId: string) => {
    await fetch(`${BOT_URL}/admin/projects/${project.id}/agents/${agentId}`, { method: "DELETE" });
    fetchAssigned(); onUpdate();
  };

  const unassigned = allAgents.filter(a => !assigned.find(pa => pa.agent_id === a.id));

  return (
    <div>
      <p className="is-size-7 has-text-grey-light has-text-weight-bold mb-3" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Team</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "0.75rem" }}>
        {assigned.map(pa => (
          <div key={pa.agent_id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.4rem 0.75rem" }}>
            {pa.role === "lead" ? <Crown size={12} style={{ color: "#ff8c00", flexShrink: 0 }} /> : <Bot size={12} style={{ color: "#555", flexShrink: 0 }} />}
            <span style={{ fontSize: 12, color: "#ccc", flex: 1 }}>{pa.agent_id}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: pa.role === "lead" ? "#ff8c00" : "#888", textTransform: "uppercase" }}>{pa.role}</span>
            <button onClick={() => removeAgent(pa.agent_id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0 }}><X size={11} /></button>
          </div>
        ))}
        {!assigned.length && <p style={{ fontSize: 11, color: "#444" }}>No agents assigned yet.</p>}
      </div>
      {unassigned.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
            style={{ flex: 1, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", borderRadius: 6, padding: "4px 8px" }}>
            <option value="">Select agent…</option>
            {unassigned.map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
          </select>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as any)}
            style={{ fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", borderRadius: 6, padding: "4px 8px" }}>
            <option value="worker">Worker</option>
            <option value="lead">Lead</option>
          </select>
          <button className={`button is-small is-info ${adding ? "is-loading" : ""}`} onClick={addAgent} disabled={!selectedAgent || adding}>
            <Plus size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Task Board (Kanban) ───────────────────────────────────────────────────────
function TaskModal({ projectId, initial, onClose, onSaved }: { projectId: string; initial?: Partial<Task>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Task>>(initial ?? { priority: 3, status: "pending" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/projects/${projectId}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 520, padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
          <p className="has-text-weight-black is-size-6">{initial?.id ? "Edit Task" : "New Task"}</p>
          <button className="delete" onClick={onClose} />
        </div>
        <form onSubmit={handleSave}>
          <div className="field mb-3">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Title</label>
            <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              placeholder="e.g. Audit competitor website" value={form.title ?? ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field mb-3">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Description</label>
            <textarea className="textarea" rows={3} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
              placeholder="Full instructions for the agent…" value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="field mb-3">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Context (brief excerpt)</label>
            <textarea className="textarea" rows={2} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
              placeholder="Relevant portion of the project brief the agent needs to understand their task…" value={form.context ?? ""} onChange={e => setForm(p => ({ ...p, context: e.target.value }))} />
          </div>
          <div className="field mb-3">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Assign To (agent ID)</label>
            <input className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              placeholder="agent-id-here" value={form.assigned_to ?? ""} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value || null }))} />
          </div>
          <div className="field mb-4">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map(p => {
                const { label, color } = PRIORITY[p];
                return (
                  <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p as any }))}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", background: form.priority === p ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${form.priority === p ? color + "50" : "transparent"}`, color: form.priority === p ? color : "#666" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="help is-danger mb-3" style={{ background: "rgba(239,68,68,0.1)", padding: "0.5rem 0.75rem", borderRadius: 6 }}>⚠️ {error}</p>}
          <div className="is-flex" style={{ gap: "0.75rem" }}>
            <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
            <button type="submit" className={`button is-info is-fullwidth ${saving ? "is-loading" : ""}`}>{initial?.id ? "Save" : "Create Task"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TaskBoard({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const [tasks, setTasks] = useState<Task[]>(project.task_queue ?? []);
  const [taskModal, setTaskModal] = useState<{ open: boolean; initial?: Partial<Task> }>({ open: false });

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`${BOT_URL}/admin/projects/${project.id}/tasks`);
    if (res.ok) { const data = await res.json(); setTasks(Array.isArray(data) ? data : []); }
  }, [project.id]);

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`${BOT_URL}/admin/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const COLS: Task["status"][] = ["pending", "in_progress", "done", "blocked"];
  return (
    <div>
      <div className="is-flex is-justify-content-flex-end mb-3">
        <button className="button is-info is-small" onClick={() => setTaskModal({ open: true })}>
          <Plus size={12} style={{ marginRight: 4 }} />Add Task
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        {COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col || (col === "in_progress" && t.status === "claimed"));
          const { label, color } = STATUS_CONFIG[col];
          return (
            <div key={col} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "0.75rem" }}>
              <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color }}>{label}</span>
                <span style={{ fontSize: 11, color: "#555", fontWeight: 700 }}>{colTasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minHeight: 40 }}>
                {colTasks.map(task => (
                  <div key={task.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                    <div className="is-flex is-align-items-center mb-1" style={{ gap: 5 }}>
                      <PriorityDot priority={task.priority} />
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e5e5", lineHeight: 1.3 }}>{task.title}</p>
                    </div>
                    {task.assigned_to && (
                      <div className="is-flex is-align-items-center mb-1" style={{ gap: 4 }}>
                        <Bot size={9} style={{ color: "#555" }} />
                        <span style={{ fontSize: 10, color: "#555" }}>{task.assigned_to.slice(0, 18)}…</span>
                      </div>
                    )}
                    {task.result && col === "done" && (
                      <p style={{ fontSize: 10, color: "#666", lineHeight: 1.4, marginTop: 3 }}>
                        {task.result.slice(0, 80)}{task.result.length > 80 ? "…" : ""}
                      </p>
                    )}
                    <div className="is-flex is-justify-content-flex-end mt-1" style={{ gap: 4 }}>
                      <button className="button is-dark" style={{ padding: "2px 6px", fontSize: 10, height: "auto" }} onClick={() => setTaskModal({ open: true, initial: task })}>Edit</button>
                      <button className="button is-danger is-light" style={{ padding: "2px 6px", fontSize: 10, height: "auto" }} onClick={() => deleteTask(task.id)}><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && <p style={{ fontSize: 10, color: "#333", textAlign: "center", padding: "0.5rem 0" }}>Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {taskModal.open && (
          <TaskModal projectId={project.id} initial={taskModal.initial}
            onClose={() => setTaskModal({ open: false })}
            onSaved={() => { setTaskModal({ open: false }); fetchTasks(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Project Create/Edit Modal ─────────────────────────────────────────────────
function ProjectModal({ initial, onClose, onSaved }: { initial?: Partial<Project>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Project>>(initial ?? { status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial?.id;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const url = isEdit ? `${BOT_URL}/admin/projects/${initial!.id}` : `${BOT_URL}/admin/projects`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 540, padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
          <p className="has-text-weight-black is-size-6">{isEdit ? "Edit Project" : "New Project"}</p>
          <button className="delete" onClick={onClose} />
        </div>
        <form onSubmit={handleSave}>
          {[
            { key: "name",        label: "Project Name *",        ph: "e.g. Q2 Market Analysis",           required: true,  type: "input" },
            { key: "objective",   label: "Objective",             ph: "One-liner goal (what success looks like)", required: false, type: "input" },
          ].map(({ key, label, ph, required, type }) => (
            <div className="field mb-3" key={key}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>{label}</label>
              <input required={required} className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                placeholder={ph} value={(form as any)[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))} />
            </div>
          ))}
          {[
            { key: "brief",       label: "Full Brief",  ph: "Detailed requirements, available resources, background context. The more detail the better — agents will use this." },
            { key: "constraints", label: "Constraints", ph: "What NOT to do, budget limits, timeline, guardrails…" },
            { key: "description", label: "Short Description (optional)", ph: "Brief summary for the project card" },
          ].map(({ key, label, ph }) => (
            <div className="field mb-3" key={key}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>{label}</label>
              <textarea className="textarea" rows={key === "brief" ? 5 : 2} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
                placeholder={ph} value={(form as any)[key] ?? ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))} />
            </div>
          ))}
          <div className="field mb-4">
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: 4 }}>Status</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["active", "paused", "complete"] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700, textTransform: "capitalize", background: form.status === s ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${form.status === s ? "rgba(255,140,0,0.4)" : "transparent"}`, color: form.status === s ? "#ff8c00" : "#666" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="help is-danger mb-3" style={{ background: "rgba(239,68,68,0.1)", padding: "0.5rem 0.75rem", borderRadius: 6 }}>⚠️ {error}</p>}
          <div className="is-flex" style={{ gap: "0.75rem" }}>
            <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
            <button type="submit" className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}>{isEdit ? "Save" : "Create Project"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main ProjectsDashboard ────────────────────────────────────────────────────
export function ProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, "tasks" | "log" | "team" | "report">>({});
  const [modal, setModal] = useState<{ open: boolean; initial?: Partial<Project> }>({ open: false });
  const [kickingOff, setKickingOff] = useState<string | null>(null);
  const [kickoffError, setKickoffError] = useState<Record<string, string>>({});

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/projects`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its tasks?")) return;
    await fetch(`${BOT_URL}/admin/projects/${id}`, { method: "DELETE" });
    fetchProjects();
  };

  const kickoff = async (project: Project) => {
    if (!project.lead_agent_id) { setKickoffError(e => ({ ...e, [project.id]: "Assign a lead agent first (Team tab)." })); return; }
    setKickingOff(project.id);
    setKickoffError(e => ({ ...e, [project.id]: "" }));
    try {
      const res = await fetch(`${BOT_URL}/admin/projects/${project.id}/kickoff`, { method: "POST" });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
      fetchProjects();
    } catch (e: any) {
      setKickoffError(err => ({ ...err, [project.id]: e.message }));
    } finally { setKickingOff(null); }
  };

  const statsFor = (p: Project) => {
    const tasks = p.task_queue ?? [];
    return { total: tasks.length, done: tasks.filter(t => t.status === "done").length, active: tasks.filter(t => ["claimed", "in_progress"].includes(t.status)).length, blocked: tasks.filter(t => t.status === "blocked").length };
  };

  const getTab = (id: string) => activeTab[id] ?? "tasks";
  const setTab = (id: string, tab: "tasks" | "log" | "team" | "report") => setActiveTab(p => ({ ...p, [id]: tab }));

  if (loading) return <p className="has-text-grey is-size-7 italic">Loading projects…</p>;

  return (
    <div>
      <div className="is-flex is-align-items-center is-justify-content-space-between mb-5">
        <div className="is-flex is-align-items-center" style={{ gap: 8 }}>
          <Layers size={16} style={{ color: "var(--accent-orange)" }} />
          <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey" style={{ letterSpacing: "0.1em" }}>Projects</p>
        </div>
        <button className="button is-warning is-small" onClick={() => setModal({ open: true })}>
          <Plus size={12} style={{ marginRight: 4 }} />New Project
        </button>
      </div>

      {projects.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.06)" }}>
          <Layers size={32} style={{ color: "#333", marginBottom: "1rem" }} />
          <p className="has-text-grey is-size-7 mb-2">No projects yet.</p>
          <p className="has-text-grey" style={{ fontSize: 11 }}>Create a project, write a brief, assign a lead agent and workers, then click Start Project.</p>
        </div>
      )}

      <div className="is-flex is-flex-direction-column" style={{ gap: "0.75rem" }}>
        {projects.map(p => {
          const stats = statsFor(p);
          const isOpen = expanded === p.id;
          const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
          const statusColor = p.status === "active" ? "#22c55e" : p.status === "paused" ? "#f59e0b" : "#888";
          const tab = getTab(p.id);

          return (
            <div key={p.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
              {/* Header */}
              <div className="is-flex is-align-items-center is-justify-content-space-between p-4" style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : p.id)}>
                <div className="is-flex is-align-items-center" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="has-text-weight-black has-text-white is-size-7">{p.name}</p>
                    {p.objective && <p className="has-text-grey" style={{ fontSize: 11, marginTop: 1 }}>{p.objective.slice(0, 80)}</p>}
                    {p.lead_agent_id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Crown size={9} style={{ color: "#ff8c00" }} />
                        <span style={{ fontSize: 9, color: "#ff8c00", fontWeight: 700 }}>{p.lead_agent_id}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="is-flex is-align-items-center" style={{ gap: 10, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22c55e" : "var(--accent-blue)", borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#555", fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div className="is-flex is-align-items-center" style={{ gap: 5 }}>
                    {stats.active > 0 && <span style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700 }}>{stats.active} active</span>}
                    {stats.blocked > 0 && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{stats.blocked} blocked</span>}
                    <span style={{ fontSize: 10, color: "#555" }}>{stats.done}/{stats.total}</span>
                  </div>
                  <button className="button is-small is-dark" onClick={e => { e.stopPropagation(); setModal({ open: true, initial: p }); }}>Edit</button>
                  <button className="button is-small is-danger is-light" onClick={e => { e.stopPropagation(); deleteProject(p.id); }}><Trash2 size={11} /></button>
                  {isOpen ? <ChevronUp size={14} style={{ color: "#555" }} /> : <ChevronDown size={14} style={{ color: "#555" }} />}
                </div>
              </div>

              {/* Expanded panel */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ padding: "1rem" }}>

                      {/* Kickoff bar */}
                      {!p.kicked_off_at && (
                        <div style={{ background: "rgba(255,140,0,0.06)", border: "1px solid rgba(255,140,0,0.15)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#ff8c00" }}>Ready to start?</p>
                            <p style={{ fontSize: 10, color: "#888" }}>Assign a lead agent in the Team tab, then kick off the project.</p>
                          </div>
                          <button
                            onClick={() => kickoff(p)}
                            disabled={kickingOff === p.id}
                            className={`button is-warning is-small ${kickingOff === p.id ? "is-loading" : ""}`}
                            style={{ flexShrink: 0 }}
                          >
                            <Play size={11} style={{ marginRight: 4 }} />Start Project
                          </button>
                        </div>
                      )}
                      {p.kicked_off_at && !p.final_report && (
                        <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                          <RefreshCw size={11} style={{ color: "#00ff88" }} />
                          <p style={{ fontSize: 11, color: "#00ff88" }}>Project running — started {new Date(p.kicked_off_at).toLocaleString()}</p>
                        </div>
                      )}
                      {p.final_report && (
                        <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                          <CheckCircle2 size={11} style={{ color: "#22c55e" }} />
                          <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Project complete — see Final Report tab</p>
                        </div>
                      )}
                      {kickoffError[p.id] && (
                        <p style={{ fontSize: 11, color: "#ef4444", marginBottom: "0.75rem", background: "rgba(239,68,68,0.08)", padding: "0.5rem 0.75rem", borderRadius: 6 }}>⚠️ {kickoffError[p.id]}</p>
                      )}

                      {/* Tabs */}
                      <div style={{ display: "flex", gap: 4, marginBottom: "1rem" }}>
                        {([
                          { id: "tasks", label: "Tasks", icon: <Zap size={10} /> },
                          { id: "log",   label: "Live Log", icon: <MessageSquare size={10} /> },
                          { id: "team",  label: "Team", icon: <Users size={10} /> },
                          ...(p.final_report ? [{ id: "report", label: "Report", icon: <FileText size={10} /> }] : []),
                        ] as Array<{ id: string; label: string; icon: React.ReactNode }>).map(t => (
                          <button key={t.id} onClick={() => setTab(p.id, t.id as any)}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid", textTransform: "uppercase", letterSpacing: "0.05em",
                              background: tab === t.id ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.03)",
                              borderColor: tab === t.id ? "rgba(255,140,0,0.4)" : "rgba(255,255,255,0.06)",
                              color: tab === t.id ? "#ff8c00" : "#666" }}>
                            {t.icon}{t.label}
                          </button>
                        ))}
                      </div>

                      {tab === "tasks"  && <TaskBoard project={p} onRefresh={fetchProjects} />}
                      {tab === "log"    && <ProjectLogFeed projectId={p.id} />}
                      {tab === "team"   && <AgentAssignmentPanel project={p} onUpdate={fetchProjects} />}
                      {tab === "report" && p.final_report && (
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "1rem" }}>
                          <p style={{ fontSize: 11, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{p.final_report}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {modal.open && (
          <ProjectModal initial={modal.initial} onClose={() => setModal({ open: false })}
            onSaved={() => { setModal({ open: false }); fetchProjects(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
