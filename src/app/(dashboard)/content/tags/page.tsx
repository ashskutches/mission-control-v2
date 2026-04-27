"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Plus, RefreshCw, Trash2, Play, X,
  Loader2, History, List, Database,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface TagDef {
  tag: string;
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
}

// ── Coverage Bar ───────────────────────────────────────────────────────────────

function CoverageBar({ pct, tagged, total }: { pct: number; tagged: number; total: number }) {
  const color = pct > 70 ? "#10b981" : pct > 30 ? "#f59e0b" : "#f43f5e";
  return (
    <div style={{ ...CARD, marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Tag size={13} color={color} />
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tag Coverage</span>
        </div>
        <div style={{ display: "flex", gap: "1.25rem" }}>
          <span style={{ fontSize: 12, color: "#10b981", fontWeight: 800 }}>{tagged.toLocaleString()} tagged</span>
          <span style={{ fontSize: 12, color: "#f43f5e", fontWeight: 800 }}>{(total - tagged).toLocaleString()} untagged</span>
          <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 800 }}>{total.toLocaleString()} total</span>
          <span style={{ fontSize: 13, color, fontWeight: 900 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: `linear-gradient(90deg, ${color}, ${color}99)`, borderRadius: 99 }}
        />
      </div>
    </div>
  );
}

// ── Tag Chip ───────────────────────────────────────────────────────────────────

function TagChip({ tag, count, onDelete, onApply, applying }: {
  tag: string;
  count: number;
  onDelete: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.5rem",
        background: hovered ? `${ACCENT}15` : `${ACCENT}08`,
        border: `1px solid ${hovered ? ACCENT + "35" : ACCENT + "18"}`,
        borderRadius: 99, padding: "0.35rem 0.75rem 0.35rem 0.9rem",
        transition: "all 0.15s", cursor: "default",
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{tag}</span>
      {count > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: `${ACCENT}15`, borderRadius: 99, padding: "1px 7px" }}>
          {count.toLocaleString()}
        </span>
      )}
      <div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.1rem" }}>
        <button
          onClick={onApply}
          disabled={applying}
          title="Retroactively tag files where the filename contains this tag"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px", cursor: applying ? "wait" : "pointer", color: hovered ? "#a78bfa" : "#475569", transition: "color 0.12s" }}>
          {applying ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={11} />}
        </button>
        <button
          onClick={onDelete}
          title="Remove tag"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px", cursor: "pointer", color: hovered ? "#f43f5e" : "#475569", transition: "color 0.12s" }}>
          <X size={11} />
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
    : "running…";
  const topTags = Object.entries(run.tags_applied ?? {}).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `3px solid ${statusColor}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.2rem" }}>
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 800, textTransform: "uppercase" }}>{run.status}</span>
          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>{run.run_type}</span>
          {run.trigger && <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{run.trigger}</span>}
          <span style={{ fontSize: 10, color: "#475569" }}>⏱ {duration}</span>
        </div>
        <div style={{ display: "flex", gap: "1rem", fontSize: 11, color: "#64748b" }}>
          <span>Scanned: <b style={{ color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</b></span>
          <span>Tagged: <b style={{ color: "#10b981" }}>{run.files_tagged.toLocaleString()}</b></span>
          <span>Skipped: <b style={{ color: "#94a3b8" }}>{run.files_skipped.toLocaleString()}</b></span>
        </div>
        {topTags.length > 0 && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
            {topTags.map(([tag, count]) => (
              <span key={tag} style={{ fontSize: 9, background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, borderRadius: 6, padding: "1px 6px", color: ACCENT }}>
                {tag}: {count}
              </span>
            ))}
          </div>
        )}
        {run.error && <p style={{ fontSize: 10, color: "#f43f5e", margin: "0.2rem 0 0" }}>{run.error}</p>}
      </div>
      <span style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
        {new Date(run.started_at).toLocaleDateString()} {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const [tags, setTags] = useState<TagDef[]>([]);
  const [runs, setRuns] = useState<TagRun[]>([]);
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"library" | "history">("library");
  const [applying, setApplying] = useState<Set<string>>(new Set());

  // Add-tag state
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setTags((d.tags ?? []).filter((t: TagDef) => t.is_active));
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

  // Add a tag — tag slug is auto-generated from display name
  const handleAdd = async () => {
    const raw = addInput.trim();
    if (!raw) return;
    // Slug: lowercase, spaces→hyphens, remove non-alphanumeric except hyphens
    const slug = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (tags.some(t => t.tag === slug)) { setAddInput(""); return; }

    setAdding(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: slug, label: raw }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setAddInput("");
      await fetchAll();
      inputRef.current?.focus();
    } catch (err: any) {
      alert(`Failed to add tag: ${err.message}`);
    } finally { setAdding(false); }
  };

  const handleDelete = async (tag: string) => {
    if (!confirm(`Remove tag "${tag}"?`)) return;
    await fetch(`${BOT_URL}/admin/tags/${tag}`, { method: "DELETE" });
    setTags(prev => prev.filter(t => t.tag !== tag));
  };

  const handleApply = async (tag: string) => {
    setApplying(s => new Set([...s, tag]));
    try {
      await fetch(`${BOT_URL}/admin/tags/${tag}/retroactive`, { method: "POST" });
      setTimeout(async () => {
        await fetchAll();
        setApplying(s => { const n = new Set(s); n.delete(tag); return n; });
      }, 4000);
    } catch (err: any) {
      alert(`Apply failed: ${err.message}`);
      setApplying(s => { const n = new Set(s); n.delete(tag); return n; });
    }
  };

  // Enrich with drive stats counts
  const enriched = tags.map(t => ({
    ...t,
    file_count: driveStats?.tagCounts?.[t.tag] ?? t.file_count,
  })).sort((a, b) => b.file_count - a.file_count);

  const total   = driveStats?.total ?? 0;
  const tagged  = driveStats?.tagged ?? 0;
  const coverage = driveStats?.tagCoverage ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.15rem", margin: 0 }}>Tag Library</h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            {enriched.length} tags · agents and humans use these to find content
          </p>
        </div>
        <button onClick={fetchAll}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Coverage bar */}
      {total > 0 && <CoverageBar pct={coverage} tagged={tagged} total={total} />}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
        {[
          { id: "library", label: "Tags",        icon: List },
          { id: "history", label: "Run History", icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: activeTab === id ? `${ACCENT}15` : "rgba(255,255,255,0.04)", border: `1px solid ${activeTab === id ? ACCENT + "30" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "0.3rem 0.85rem", color: activeTab === id ? ACCENT : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* Tag Library tab */}
      {activeTab === "library" && (
        <>
          {/* Add tag input */}
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Tag size={13} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                ref={inputRef}
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                placeholder='Add a tag — e.g. "Outside", "Stability Bar", "Green"'
                style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: "0.6rem", paddingBottom: "0.6rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${addInput ? ACCENT + "40" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addInput.trim() || adding}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: addInput.trim() ? `${ACCENT}18` : "rgba(255,255,255,0.04)", border: `1px solid ${addInput.trim() ? ACCENT + "30" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "0 1.25rem", color: addInput.trim() ? ACCENT : "#475569", fontSize: 12, fontWeight: 700, cursor: addInput.trim() ? "pointer" : "default", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {adding ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
              Add Tag
            </button>
          </div>

          {/* Tag chips */}
          {loading ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              {[...Array(12)].map((_, i) => (
                <div key={i} style={{ height: 34, width: 80 + (i % 3) * 30, background: "rgba(255,255,255,0.04)", borderRadius: 99, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : enriched.length === 0 ? (
            <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
              <Tag size={28} color="#475569" style={{ marginBottom: "0.75rem", display: "block", margin: "0 auto 0.75rem" }} />
              <p style={{ color: "#475569", fontSize: 13 }}>No tags yet. Type a tag above and press Enter to add it.</p>
            </div>
          ) : (
            <>
              <motion.div layout style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                <AnimatePresence>
                  {enriched.map(t => (
                    <TagChip
                      key={t.tag}
                      tag={t.tag}
                      count={t.file_count}
                      onDelete={() => handleDelete(t.tag)}
                      onApply={() => handleApply(t.tag)}
                      applying={applying.has(t.tag)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>

              <p style={{ fontSize: 10, color: "#334155", marginTop: "1.25rem" }}>
                Click <Play size={9} style={{ display: "inline", verticalAlign: "middle" }} /> to retroactively apply a tag to all Drive files whose filename contains that tag's name.
                The number badge shows how many files currently have that tag.
              </p>
            </>
          )}
        </>
      )}

      {/* Run History tab */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} style={{ height: 64, background: "rgba(255,255,255,0.03)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />)
          ) : runs.length === 0 ? (
            <div style={{ ...CARD, textAlign: "center", padding: "2rem", opacity: 0.5 }}>
              <History size={24} color="#475569" style={{ marginBottom: "0.5rem", display: "block", margin: "0 auto 0.5rem" }} />
              <p style={{ color: "#475569", fontSize: 12 }}>No runs yet. Click ▷ on any tag to start a retroactive batch.</p>
            </div>
          ) : runs.map(run => <RunRow key={run.id} run={run} />)}
        </div>
      )}
    </div>
  );
}
