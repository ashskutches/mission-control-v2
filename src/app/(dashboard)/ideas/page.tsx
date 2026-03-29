"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb, Plus, Trash2, Pencil, X, ChevronDown, Bot, AlertTriangle, Bug,
  Workflow, BarChart2, ShoppingBag, Megaphone, Database, Rocket, Sparkles, Check, Wrench,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

type IdeaStatus = "new" | "in-review" | "planned" | "done" | "dismissed";
type IdeaCategory = "workflow" | "content" | "data" | "marketing" | "product" | "outreach" | "general" | "limitation" | "bug";

interface Idea {
  id: string;
  title: string;
  description?: string;
  category: IdeaCategory;
  status: IdeaStatus;
  source: "human" | "agent";
  agent_id?: string;
  agent_name?: string;
  created_at: string;
  updated_at: string;
}

const CATEGORY_META: Record<IdeaCategory, { label: string; color: string; icon: React.ElementType }> = {
  workflow:    { label: "Workflow",    color: "#ff8c00", icon: Workflow },
  content:     { label: "Content",     color: "#38bdf8", icon: Sparkles },
  data:        { label: "Data",        color: "#a78bfa", icon: Database },
  marketing:   { label: "Marketing",   color: "#f43f5e", icon: Megaphone },
  product:     { label: "Product",     color: "#22c55e", icon: ShoppingBag },
  outreach:    { label: "Outreach",    color: "#f59e0b", icon: Rocket },
  general:     { label: "General",     color: "#6366f1", icon: Lightbulb },
  limitation:  { label: "Limitation",  color: "#fb923c", icon: Wrench },
  bug:         { label: "Bug",         color: "#ef4444", icon: Bug },
};

const STATUS_META: Record<IdeaStatus, { label: string; color: string }> = {
  "new":       { label: "New",        color: "#a78bfa" },
  "in-review": { label: "In Review",  color: "#38bdf8" },
  "planned":   { label: "Planned",    color: "#f59e0b" },
  "done":      { label: "Done",       color: "#22c55e" },
  "dismissed": { label: "Dismissed",  color: "#555" },
};

const STATUSES: IdeaStatus[] = ["new", "in-review", "planned", "done", "dismissed"];
// limitation and bug shown first so agent-reported issues are easily filterable
const CATEGORIES: IdeaCategory[] = ["limitation", "bug", "workflow", "content", "data", "marketing", "product", "outreach", "general"];

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box",
};

// ── Idea Form Modal ──────────────────────────────────────────────────────────
function IdeaModal({
  initial, onClose, onSaved,
}: {
  initial?: Partial<Idea>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: (initial?.category ?? "general") as IdeaCategory,
    status: (initial?.status ?? "new") as IdeaStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true); setError(null);
    try {
      const url = isEdit ? `${BOT_URL}/admin/ideas/${initial!.id}` : `${BOT_URL}/admin/ideas`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "human" }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 480, padding: "1.5rem" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontWeight: 900, color: "#fff", fontSize: 15, margin: 0 }}>{isEdit ? "Edit Idea" : "New Idea"}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Title *</label>
            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Build a weekly inventory report spreadsheet" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What is this idea? Why is it valuable? What would it involve?"
              rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as IdeaCategory }))} style={{ ...inputStyle, cursor: "pointer" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as IdeaStatus }))} style={{ ...inputStyle, cursor: "pointer" }}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#aaa", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: "9px", background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.4)", borderRadius: 8, color: "#ff8c00", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Idea"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Idea Card ────────────────────────────────────────────────────────────────
function IdeaCard({ idea, onEdit, onDelete, onStatusChange }: {
  idea: Idea;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: IdeaStatus) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const cat = CATEGORY_META[idea.category] ?? CATEGORY_META.general;
  const status = STATUS_META[idea.status] ?? STATUS_META.new;
  const CatIcon = cat.icon;
  const isAgent = idea.source === "agent";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setStatusOpen(false); }}
      style={{
        position: "relative", background: hovered ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${hovered ? `${cat.color}44` : `${cat.color}22`}`,
        borderLeft: `3px solid ${cat.color}`, borderRadius: 12, padding: "14px 16px",
        transition: "all 0.15s", cursor: "default",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}18`, border: `1px solid ${cat.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CatIcon size={15} color={cat.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#e5e5e5", fontWeight: 800, fontSize: 13, margin: "0 0 2px", lineHeight: 1.3 }}>{idea.title}</p>
          {idea.description && (
            <p style={{ color: "#777", fontSize: 11, margin: 0, lineHeight: 1.5 }}>{idea.description}</p>
          )}
        </div>
        {hovered && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} title="Edit" style={{ background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)", borderRadius: 6, color: "#ff8c00", cursor: "pointer", padding: "4px 6px", display: "flex" }}><Pencil size={11} /></button>
            <button onClick={onDelete} title="Delete" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "4px 6px", display: "flex" }}><Trash2 size={11} /></button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {/* Category badge */}
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: cat.color, background: `${cat.color}15`, border: `1px solid ${cat.color}30`, borderRadius: 4, padding: "1px 6px" }}>{cat.label}</span>
        {/* Agent badge */}
        {isAgent && (
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7289da", background: "rgba(114,137,218,0.12)", border: "1px solid rgba(114,137,218,0.3)", borderRadius: 4, padding: "1px 6px", display: "flex", alignItems: "center", gap: 3 }}>
            <Bot size={8} /> {idea.agent_name ?? "Agent"}
          </span>
        )}
        {/* Date */}
        <span style={{ fontSize: 9, color: "#444", marginLeft: "auto" }}>{new Date(idea.created_at).toLocaleDateString()}</span>
        {/* Status dropdown */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setStatusOpen(p => !p)}
            style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", color: status.color, background: `${status.color}15`, border: `1px solid ${status.color}30`, borderRadius: 4, padding: "1px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            {status.label} <ChevronDown size={8} />
          </button>
          {statusOpen && (
            <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 100, background: "#0e0e14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, overflow: "hidden", minWidth: 110, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => { onStatusChange(s); setStatusOpen(false); }}
                  style={{ width: "100%", padding: "6px 10px", textAlign: "left", background: s === idea.status ? "rgba(255,255,255,0.05)" : "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: STATUS_META[s].color }}>
                  {s === idea.status && <Check size={10} />}
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Ideas Page ──────────────────────────────────────────────────────────
export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | "all">("all");
  const [filterSource, setFilterSource] = useState<"all" | "human" | "agent">("all");
  const [modal, setModal] = useState<{ open: boolean; initial?: Partial<Idea> }>({ open: false });

  const fetchIdeas = useCallback(async () => {
    try {
      const r = await fetch(`${BOT_URL}/admin/ideas`);
      const data = await r.json();
      setIdeas(Array.isArray(data) ? data : []);
    } catch { setIdeas([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this idea?")) return;
    await fetch(`${BOT_URL}/admin/ideas/${id}`, { method: "DELETE" });
    fetchIdeas();
  };

  const handleStatusChange = async (id: string, status: IdeaStatus) => {
    await fetch(`${BOT_URL}/admin/ideas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    fetchIdeas();
  };

  const filtered = ideas.filter(i => {
    if (filterStatus   !== "all" && i.status   !== filterStatus)   return false;
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    if (filterSource   !== "all" && i.source   !== filterSource)   return false;
    return true;
  });

  const agentCount = ideas.filter(i => i.source === "agent").length;
  const newCount   = ideas.filter(i => i.status === "new").length;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Lightbulb size={20} color="#a78bfa" />
            <h1 style={{ color: "#e5e5e5", fontWeight: 900, fontSize: 20, margin: 0 }}>Ideas Board</h1>
            {newCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 900, color: "#a78bfa", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "1px 8px" }}>
                {newCount} new
              </span>
            )}
          </div>
          <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
            Ideas, limitations, and bugs logged by you or your agents — review, plan, and act on them when ready.
            {agentCount > 0 && ` ${agentCount} from agents.`}
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 8, color: "#a78bfa", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
          <Plus size={14} /> Add Idea
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          style={{ ...inputStyle, width: "auto", fontSize: 11, padding: "5px 10px", cursor: "pointer" }}>
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        {/* Category filter */}
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
          style={{ ...inputStyle, width: "auto", fontSize: 11, padding: "5px 10px", cursor: "pointer" }}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
        {/* Source filter */}
        <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)}
          style={{ ...inputStyle, width: "auto", fontSize: 11, padding: "5px 10px", cursor: "pointer" }}>
          <option value="all">All sources</option>
          <option value="human">👤 Human</option>
          <option value="agent">🤖 Agent</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#555", alignSelf: "center" }}>{filtered.length} idea{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Ideas grid */}
      {loading ? (
        <p style={{ color: "#555", textAlign: "center", fontSize: 13, paddingTop: 60 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 80, opacity: 0.4 }}>
          <Lightbulb size={40} color="#a78bfa" style={{ marginBottom: 12 }} />
          <p style={{ color: "#aaa", fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>No ideas yet</p>
          <p style={{ color: "#555", fontSize: 12, margin: 0 }}>Add one yourself, or let your agents surface them.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {filtered.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={() => setModal({ open: true, initial: idea })}
                onDelete={() => handleDelete(idea.id)}
                onStatusChange={s => handleStatusChange(idea.id, s)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <IdeaModal
            initial={modal.initial}
            onClose={() => setModal({ open: false })}
            onSaved={fetchIdeas}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
