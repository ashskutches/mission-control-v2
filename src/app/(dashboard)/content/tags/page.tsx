"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Plus, RefreshCw, CheckCircle2, AlertCircle, Clock,
  Trash2, Edit3, Play, ChevronDown, ChevronRight, X, Save,
  Loader2, Database, BarChart2, List, History,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

const CATEGORIES = [
  { id: "content_type", label: "Content Type", color: "#f59e0b" },
  { id: "product",      label: "Product",      color: "#38bdf8" },
  { id: "person",       label: "Person",       color: "#06b6d4" },
  { id: "campaign",     label: "Campaign",     color: "#f43f5e" },
  { id: "platform",     label: "Platform",     color: "#10b981" },
  { id: "quality",      label: "Quality",      color: "#94a3b8" },
  { id: "general",      label: "General",      color: "#64748b" },
];

const categoryColor = (cat: string) => CATEGORIES.find(c => c.id === cat)?.color ?? "#64748b";
const categoryLabel = (cat: string) => CATEGORIES.find(c => c.id === cat)?.label ?? cat;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TagDef {
  tag: string;
  label: string;
  category: string;
  description?: string;
  color: string;
  rule?: string;
  file_count: number;
  is_active: boolean;
  created_at: string;
}

interface TagRun {
  id: string;
  run_type: string;
  trigger?: string;
  status: string;
  files_scanned: number;
  files_tagged: number;
  files_skipped: number;
  tags_applied: Record<string, number>;
  started_at: string;
  finished_at?: string;
  error?: string;
}

interface DriveStats {
  total: number;
  tagged: number;
  untagged: number;
  tagCoverage: number;
  tagCounts: Record<string, number>;
  indexStatus: string;
  videos: number;
  images: number;
  documents: number;
  other: number;
}

// ── Coverage Ring ──────────────────────────────────────────────────────────────

function CoverageRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct > 50 ? "#10b981" : pct > 20 ? "#f59e0b" : "#f43f5e"}
        strokeWidth={8} strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
        transition={{ duration: 1, ease: "easeOut" }}
        strokeDashoffset={0}
      />
    </svg>
  );
}

// ── Add / Edit Tag Modal ───────────────────────────────────────────────────────

function TagFormModal({ existing, onSave, onClose }: {
  existing?: TagDef | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    tag:         existing?.tag ?? "",
    label:       existing?.label ?? "",
    category:    existing?.category ?? "content_type",
    description: existing?.description ?? "",
    color:       existing?.color ?? "#a78bfa",
    rule:        existing?.rule ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.tag || !form.label) { setError("Tag ID and label are required."); return; }
    setSaving(true); setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.75rem", width: 480, maxWidth: "95vw" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h3 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 15, margin: 0 }}>
            {existing ? "Edit Tag" : "New Tag"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {[
            { key: "tag",   label: "Tag ID (slug)",    placeholder: "stability-bar",       disabled: !!existing },
            { key: "label", label: "Display Name",     placeholder: "Stability Bar" },
          ].map(({ key, label, placeholder, disabled }) => (
            <div key={key}>
              <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
              <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder} disabled={disabled}
                style={{ width: "100%", background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", color: disabled ? "#475569" : "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none" }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>
              Auto-Rule (regex — files matching this pattern get this tag)
            </label>
            <input value={form.rule} onChange={e => setForm(p => ({ ...p, rule: e.target.value }))}
              placeholder="stability.?bar|handle"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
            <p style={{ fontSize: 10, color: "#475569", marginTop: "0.25rem" }}>Case-insensitive. Leave blank for manual tagging only.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Color</label>
              <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                style={{ width: 42, height: 32, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.3rem" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: form.color }} />
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{form.color}</span>
            </div>
          </div>

          {error && <p style={{ fontSize: 11, color: "#f43f5e", margin: 0 }}>{error}</p>}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 1rem", color: "#64748b", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "0.5rem 1.25rem", color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Tag Row ────────────────────────────────────────────────────────────────────

function TagRow({ tag, totalFiles, onEdit, onDelete, onRetroactive, retroRunning }: {
  tag: TagDef;
  totalFiles: number;
  onEdit: () => void;
  onDelete: () => void;
  onRetroactive: () => void;
  retroRunning: boolean;
}) {
  const color = tag.color;
  const pct = totalFiles > 0 ? Math.round((tag.file_count / totalFiles) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid rgba(255,255,255,0.05)`, transition: "all 0.12s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}>

      {/* Color dot */}
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />

      {/* Tag name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13 }}>{tag.label}</span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "#475569", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1px 5px" }}>{tag.tag}</span>
          {!tag.is_active && <span style={{ fontSize: 9, color: "#f43f5e", background: "rgba(244,63,94,0.1)", borderRadius: 4, padding: "1px 5px" }}>INACTIVE</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ fontSize: 10, color: categoryColor(tag.category), background: `${categoryColor(tag.category)}12`, borderRadius: 6, padding: "0px 6px", fontWeight: 700 }}>{categoryLabel(tag.category)}</span>
          {tag.rule && <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tag.rule}>/{tag.rule}/i</span>}
          {tag.description && <span style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{tag.description}</span>}
        </div>
      </div>

      {/* Usage bar */}
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
          <span style={{ fontSize: 9, color: "#64748b" }}>{tag.file_count.toLocaleString()} files</span>
          <span style={{ fontSize: 9, color: color, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
        {tag.rule && (
          <button onClick={onRetroactive} disabled={retroRunning} title="Run retroactive tag for all matching files"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 7, padding: "0.3rem 0.6rem", color, fontWeight: 700, fontSize: 10, cursor: retroRunning ? "wait" : "pointer", opacity: retroRunning ? 0.6 : 1 }}>
            {retroRunning ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={10} />}
            Apply
          </button>
        )}
        <button onClick={onEdit} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "0.3rem 0.5rem", color: "#64748b", cursor: "pointer" }} title="Edit tag">
          <Edit3 size={12} />
        </button>
        <button onClick={onDelete} style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 7, padding: "0.3rem 0.5rem", color: "#f43f5e", cursor: "pointer" }} title="Deactivate tag">
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Run History Row ────────────────────────────────────────────────────────────

function RunRow({ run }: { run: TagRun }) {
  const statusColor = run.status === "done" ? "#10b981" : run.status === "error" ? "#f43f5e" : "#f59e0b";
  const duration = run.finished_at
    ? `${((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
    : "—";
  const topTags = Object.entries(run.tags_applied ?? {}).sort(([,a],[,b]) => b - a).slice(0, 4);

  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `3px solid ${statusColor}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.2rem" }}>
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, textTransform: "uppercase" }}>{run.status}</span>
          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>{run.run_type}</span>
          {run.trigger && <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{run.trigger}</span>}
        </div>
        <div style={{ display: "flex", gap: "1rem", fontSize: 11, color: "#64748b" }}>
          <span>Scanned: <b style={{ color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</b></span>
          <span>Tagged: <b style={{ color: "#10b981" }}>{run.files_tagged.toLocaleString()}</b></span>
          <span>Skipped: <b style={{ color: "#94a3b8" }}>{run.files_skipped.toLocaleString()}</b></span>
          <span>⏱ {duration}</span>
        </div>
        {topTags.length > 0 && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
            {topTags.map(([tag, count]) => (
              <span key={tag} style={{ fontSize: 9, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, padding: "1px 6px", color: ACCENT }}>
                {tag}: {count}
              </span>
            ))}
          </div>
        )}
        {run.error && <p style={{ fontSize: 10, color: "#f43f5e", marginTop: "0.2rem", margin: 0 }}>{run.error}</p>}
      </div>
      <span style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap" }}>
        {new Date(run.started_at).toLocaleDateString()} {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ── Main Tags Page ─────────────────────────────────────────────────────────────

export default function TagsPage() {
  const [tags, setTags] = useState<TagDef[]>([]);
  const [runs, setRuns] = useState<TagRun[]>([]);
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<TagDef | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [retroRunning, setRetroRunning] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"library" | "history">("library");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tagsRes, runsRes, statsRes] = await Promise.allSettled([
        fetch(`${BOT_URL}/admin/tags`),
        fetch(`${BOT_URL}/admin/tags/runs`),
        fetch(`${BOT_URL}/admin/drive/stats`),
      ]);
      if (tagsRes.status === "fulfilled" && tagsRes.value.ok) {
        const d = await tagsRes.value.json();
        setTags(d.tags ?? []);
      }
      if (runsRes.status === "fulfilled" && runsRes.value.ok) {
        const d = await runsRes.value.json();
        setRuns(d.runs ?? []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        setDriveStats(await statsRes.value.json());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (data: any) => {
    const res = await fetch(`${BOT_URL}/admin/tags`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create tag");
    await fetchAll();
  };

  const handleEdit = async (data: any) => {
    const res = await fetch(`${BOT_URL}/admin/tags/${editTarget!.tag}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update tag");
    await fetchAll();
  };

  const handleDelete = async (tag: string) => {
    if (!confirm(`Deactivate tag "${tag}"? Files keep their existing tags; this just prevents new tagging.`)) return;
    await fetch(`${BOT_URL}/admin/tags/${tag}`, { method: "DELETE" });
    await fetchAll();
  };

  const handleRetroactive = async (tag: string) => {
    setRetroRunning(s => new Set([...s, tag]));
    try {
      const res = await fetch(`${BOT_URL}/admin/tags/${tag}/retroactive`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      // Poll for run completion
      setTimeout(async () => {
        await fetchAll();
        setRetroRunning(s => { const n = new Set(s); n.delete(tag); return n; });
      }, 3000);
    } catch (err: any) {
      alert(`Retroactive tag failed: ${err.message}`);
      setRetroRunning(s => { const n = new Set(s); n.delete(tag); return n; });
    }
  };

  // Group tags by category
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    tags: tags.filter(t => t.category === cat.id && (activeCategory === null || activeCategory === cat.id)),
  })).filter(g => g.tags.length > 0 || activeCategory === g.id);

  const totalFiles = driveStats?.total ?? 0;
  const coverage   = driveStats?.tagCoverage ?? 0;
  const taggedCount = driveStats?.tagged ?? 0;

  // Update file_count on tags from driveStats.tagCounts
  const enrichedTags = tags.map(t => ({
    ...t,
    file_count: driveStats?.tagCounts?.[t.tag] ?? t.file_count,
  }));
  const enrichedGrouped = CATEGORIES.map(cat => ({
    ...cat,
    tags: enrichedTags.filter(t => t.category === cat.id && (activeCategory === null || activeCategory === cat.id)),
  })).filter(g => g.tags.length > 0);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.15rem", margin: 0 }}>Tag Library</h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            {tags.filter(t => t.is_active).length} active tags · {totalFiles.toLocaleString()} total Drive files
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={fetchAll} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
            <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button onClick={() => { setEditTarget(null); setModal("add"); }}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 10, padding: "0.45rem 1rem", color: ACCENT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            <Plus size={13} /> New Tag
          </button>
        </div>
      </div>

      {/* Coverage stats row */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {/* Coverage ring */}
        <div style={{ ...CARD, display: "flex", alignItems: "center", gap: "1.25rem", flex: "0 0 auto" }}>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <CoverageRing pct={coverage} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: coverage > 50 ? "#10b981" : coverage > 20 ? "#f59e0b" : "#f43f5e" }}>{coverage}%</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, margin: 0 }}>Tag Coverage</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>{taggedCount.toLocaleString()}</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>of {totalFiles.toLocaleString()} files tagged</p>
            {driveStats?.indexStatus === "indexing" && (
              <p style={{ fontSize: 10, color: "#f59e0b", marginTop: "0.2rem" }}>⟳ Drive still indexing…</p>
            )}
          </div>
        </div>

        {/* File type breakdown */}
        {[
          { label: "Videos",    value: driveStats?.videos    ?? 0, color: "#f59e0b" },
          { label: "Images",    value: driveStats?.images    ?? 0, color: "#38bdf8" },
          { label: "Documents", value: driveStats?.documents ?? 0, color: "#10b981" },
          { label: "Other",     value: driveStats?.other     ?? 0, color: "#94a3b8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...CARD, flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color, lineHeight: 1 }}>{value.toLocaleString()}</div>
            <div style={{ fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: 0.8, marginTop: "0.2rem" }}>{label}</div>
          </div>
        ))}

        {/* Untagged alert */}
        {(driveStats?.untagged ?? 0) > 0 && (
          <div style={{ ...CARD, flex: 1, minWidth: 140, border: "1px solid rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.04)" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f43f5e", lineHeight: 1 }}>{(driveStats?.untagged ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: 0.8, marginTop: "0.2rem" }}>Untagged Files</div>
            <a href="/content/assets?untaggedOnly=true" style={{ fontSize: 10, color: "#f43f5e", textDecoration: "none", fontWeight: 700, display: "block", marginTop: "0.3rem" }}>Tag them →</a>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
        {[
          { id: "library", label: "Tag Library",   icon: List },
          { id: "history", label: "Run History",   icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: activeTab === id ? `${ACCENT}15` : "rgba(255,255,255,0.04)", border: `1px solid ${activeTab === id ? ACCENT + "30" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "0.3rem 0.85rem", color: activeTab === id ? ACCENT : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Icon size={11} /> {label}
          </button>
        ))}

        {/* Category filter (library tab only) */}
        {activeTab === "library" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            <button onClick={() => setActiveCategory(null)}
              style={{ fontSize: 9, background: activeCategory === null ? "rgba(255,255,255,0.08)" : "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 8px", color: activeCategory === null ? "#e2e8f0" : "#64748b", cursor: "pointer", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              All
            </button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                style={{ fontSize: 9, background: activeCategory === c.id ? `${c.color}15` : "none", border: `1px solid ${activeCategory === c.id ? c.color + "30" : "rgba(255,255,255,0.06)"}`, borderRadius: 6, padding: "2px 8px", color: activeCategory === c.id ? c.color : "#64748b", cursor: "pointer", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag Library */}
      {activeTab === "library" && (
        loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(8)].map((_, i) => <div key={i} style={{ height: 56, background: "rgba(255,255,255,0.03)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />)}
          </div>
        ) : enrichedGrouped.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
            <Tag size={28} color="#475569" style={{ marginBottom: "0.75rem" }} />
            <p style={{ color: "#475569", fontSize: 13 }}>No tags yet. Click "New Tag" to create your first one.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {enrichedGrouped.map(group => (
              <div key={group.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: group.color }} />
                  <span style={{ fontSize: 10, color: group.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.label}</span>
                  <span style={{ fontSize: 10, color: "#475569" }}>({group.tags.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {group.tags.map(tag => (
                    <TagRow
                      key={tag.tag}
                      tag={tag}
                      totalFiles={totalFiles}
                      onEdit={() => { setEditTarget(tag); setModal("edit"); }}
                      onDelete={() => handleDelete(tag.tag)}
                      onRetroactive={() => handleRetroactive(tag.tag)}
                      retroRunning={retroRunning.has(tag.tag)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Run History */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} style={{ height: 64, background: "rgba(255,255,255,0.03)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />)
          ) : runs.length === 0 ? (
            <div style={{ ...CARD, textAlign: "center", padding: "2rem", opacity: 0.5 }}>
              <History size={24} color="#475569" style={{ marginBottom: "0.5rem" }} />
              <p style={{ color: "#475569", fontSize: 12 }}>No tag runs yet. Use "Apply" on a tag to start a retroactive batch.</p>
            </div>
          ) : runs.map(run => <RunRow key={run.id} run={run} />)}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === "add" && (
          <TagFormModal onSave={handleCreate} onClose={() => setModal(null)} />
        )}
        {modal === "edit" && editTarget && (
          <TagFormModal existing={editTarget} onSave={handleEdit} onClose={() => { setModal(null); setEditTarget(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
