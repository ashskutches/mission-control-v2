"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2,
  Clock, AlertTriangle, Loader2, ArrowRight, Bot, X
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "pending" | "claimed" | "in_progress" | "done" | "failed" | "blocked";
  priority: 1 | 2 | 3 | 4;
  assigned_to: string | null;
  result: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "complete";
  owner_agent: string | null;
  created_at: string;
  task_queue: Task[];
}

const STATUS_CONFIG: Record<Task["status"], { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#888" },
  claimed:     { label: "Claimed",     color: "#06b6d4" },
  in_progress: { label: "In Progress", color: "#3b82f6" },
  done:        { label: "Done",        color: "#22c55e" },
  failed:      { label: "Failed",      color: "#ef4444" },
  blocked:     { label: "Blocked",     color: "#f59e0b" },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Urgent", color: "#ef4444" },
  2: { label: "High",   color: "#f59e0b" },
  3: { label: "Normal", color: "#888" },
  4: { label: "Low",    color: "#555" },
};

function StatusPill({ status }: { status: Task["status"] }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", background: `${color}15`, color, border: `1px solid ${color}35` }}>
      {label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const { color, label } = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG[3];
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5, flexShrink: 0 }} title={label} />;
}

function TaskModal({
  projectId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  initial?: Partial<Task>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Task>>(initial ?? { priority: 3, status: "pending" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 480, padding: "1.5rem" }}
        onClick={e => e.stopPropagation()}>
        <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
          <p className="has-text-weight-black is-size-6">{initial?.id ? "Edit Task" : "New Task"}</p>
          <button className="delete" onClick={onClose} />
        </div>
        <form onSubmit={handleSave}>
          <div className="field mb-3">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</label>
            <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              placeholder="e.g. Write product descriptions for Spring drop"
              value={form.title ?? ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="field mb-3">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea className="textarea" rows={3} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
              placeholder="Full context the agent needs to execute this task..."
              value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="field mb-4">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map(p => {
                const { label, color } = PRIORITY_CONFIG[p];
                return (
                  <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p as any }))}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", background: form.priority === p ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${form.priority === p ? color + "50" : "transparent"}`, color: form.priority === p ? color : "#666" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="help is-danger mb-3">{error}</p>}
          <div className="is-flex" style={{ gap: "0.75rem" }}>
            <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
            <button type="submit" className={`button is-info is-fullwidth ${saving ? "is-loading" : ""}`}>
              {initial?.id ? "Save" : "Create Task"}
            </button>
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
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
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

      {/* Kanban-style columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        {COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col || (col === "in_progress" && t.status === "claimed"));
          const { label, color } = STATUS_CONFIG[col];
          return (
            <div key={col} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 10, padding: "0.75rem" }}>
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
                        <span style={{ fontSize: 10, color: "#555" }}>{task.assigned_to.slice(0, 16)}...</span>
                      </div>
                    )}
                    {task.result && col === "done" && (
                      <p style={{ fontSize: 10, color: "#666", lineHeight: 1.4, marginTop: 3 }}>
                        {task.result.slice(0, 60)}{task.result.length > 60 ? "…" : ""}
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

function ProjectModal({ initial, onClose, onSaved }: { initial?: Partial<Project>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Project>>(initial ?? { status: "active" });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${BOT_URL}/admin/projects`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 440, padding: "1.5rem" }}
        onClick={e => e.stopPropagation()}>
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
          <p className="has-text-weight-black is-size-6">{initial?.id ? "Edit Project" : "New Project"}</p>
          <button className="delete" onClick={onClose} />
        </div>
        <form onSubmit={handleSave}>
          <div className="field mb-3">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Project Name</label>
            <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              placeholder="e.g. Q2 Email Campaign"
              value={form.name ?? ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field mb-3">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea className="textarea" rows={3} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              placeholder="What is this project about?"
              value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="field mb-4">
            <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["active", "paused", "complete"] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700, textTransform: "capitalize", background: form.status === s ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${form.status === s ? "rgba(255,140,0,0.4)" : "transparent"}`, color: form.status === s ? "#ff8c00" : "#666" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="is-flex" style={{ gap: "0.75rem" }}>
            <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
            <button type="submit" className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}>
              {initial?.id ? "Save" : "Create Project"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function ProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; initial?: Partial<Project> }>({ open: false });

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/projects`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its tasks?")) return;
    await fetch(`${BOT_URL}/admin/projects/${id}`, { method: "DELETE" });
    fetchProjects();
  };

  const statsFor = (p: Project) => {
    const tasks = p.task_queue ?? [];
    return {
      total: tasks.length,
      done: tasks.filter(t => t.status === "done").length,
      active: tasks.filter(t => ["claimed", "in_progress"].includes(t.status)).length,
      blocked: tasks.filter(t => t.status === "blocked").length,
      pending: tasks.filter(t => t.status === "pending").length,
    };
  };

  if (loading) return <p className="has-text-grey is-size-7 italic">Loading projects...</p>;

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
          <p className="has-text-grey" style={{ fontSize: 11 }}>Create a project, add tasks, and assign agents with the Task Queue feature enabled to start multi-agent work.</p>
        </div>
      )}

      <div className="is-flex is-flex-direction-column" style={{ gap: "0.75rem" }}>
        {projects.map(p => {
          const stats = statsFor(p);
          const isOpen = expanded === p.id;
          const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
          const statusColor = p.status === "active" ? "#22c55e" : p.status === "paused" ? "#f59e0b" : "#888";

          return (
            <div key={p.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
              {/* Header row */}
              <div className="is-flex is-align-items-center is-justify-content-space-between p-4" style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : p.id)}>
                <div className="is-flex is-align-items-center" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="has-text-weight-black has-text-white is-size-7">{p.name}</p>
                    {p.description && <p className="has-text-grey" style={{ fontSize: 11, marginTop: 1 }}>{p.description.slice(0, 80)}{p.description.length > 80 ? "…" : ""}</p>}
                  </div>
                </div>

                <div className="is-flex is-align-items-center" style={{ gap: 12, flexShrink: 0 }}>
                  {/* Progress bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22c55e" : "var(--accent-blue)", borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#555", fontWeight: 700 }}>{pct}%</span>
                  </div>

                  {/* Mini task counts */}
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

              {/* Expanded task board */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "1rem", overflow: "hidden" }}>
                    <TaskBoard project={p} onRefresh={fetchProjects} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {modal.open && (
          <ProjectModal initial={modal.initial} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); fetchProjects(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
