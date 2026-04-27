"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Plus, RefreshCw, Trash2, Play, X,
  Loader2, History, Zap, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Database,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
  padding: "1.25rem 1.5rem",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface TagDef {
  tag: string;
  label?: string;
  file_count: number;
  is_active: boolean;
  created_at: string;
}

interface TagRun {
  id: string;
  run_type: string;
  trigger?: string;
  status: "running" | "done" | "error";
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
}

// ── Coverage Bar ───────────────────────────────────────────────────────────────

function CoverageBar({ pct, tagged, untagged, total }: { pct: number; tagged: number; untagged: number; total: number }) {
  const color = pct > 70 ? "#10b981" : pct > 30 ? "#f59e0b" : "#f43f5e";
  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "1.5rem" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tag Coverage</span>
          <span style={{ fontSize: 13, color, fontWeight: 900 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ height: "100%", background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 99 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0 }}>
        <Stat label="Total" value={total.toLocaleString()} color="#94a3b8" />
        <Stat label="Tagged" value={tagged.toLocaleString()} color="#10b981" />
        <Stat label="Untagged" value={untagged.toLocaleString()} color="#f43f5e" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

// ── Run Panel ──────────────────────────────────────────────────────────────────

function RunPanel({ onRunStarted }: { onRunStarted: () => void }) {
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ runId: string } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/run-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setLastRun({ runId: data.runId });
      // Poll for completion, then refresh parent
      setTimeout(() => {
        setRunning(false);
        onRunStarted();
      }, 3000);
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
      setRunning(false);
    }
  };

  return (
    <div style={{ ...CARD, marginBottom: "1.5rem", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
        <Zap size={14} color={ACCENT} />
        <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>Batch Tag Run</span>
        <span style={{ fontSize: 11, color: "#475569" }}>— Scan untagged files and auto-apply matching tags by filename</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Files per run</span>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {[50, 100, 250, 500, 1000].map(n => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                style={{
                  padding: "0.3rem 0.65rem", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: limit === n ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${limit === n ? ACCENT + "40" : "rgba(255,255,255,0.08)"}`,
                  color: limit === n ? ACCENT : "#64748b",
                  transition: "all 0.12s",
                }}
              >{n}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "#475569" }}>or</span>
          <input
            type="number"
            min={1}
            max={2000}
            value={limit}
            onChange={e => setLimit(Math.max(1, Math.min(2000, Number(e.target.value))))}
            style={{
              width: 72, padding: "0.3rem 0.5rem", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              color: "#e2e8f0", fontSize: 12, outline: "none", textAlign: "center",
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: running ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ACCENT}, #7c3aed)`,
            border: "none", borderRadius: 10, padding: "0.55rem 1.5rem",
            color: running ? "#64748b" : "#fff", fontSize: 13, fontWeight: 800,
            cursor: running ? "wait" : "pointer",
            boxShadow: running ? "none" : `0 4px 20px ${ACCENT}30`,
            transition: "all 0.2s",
          }}
        >
          {running
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
            : <><Play size={13} fill="#fff" /> Run Now</>
          }
        </button>

        {lastRun && !running && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#10b981" }}
          >
            <CheckCircle2 size={12} /> Run started — see history below
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Tag Chip ───────────────────────────────────────────────────────────────────

function TagChip({ tag, count, onDelete, onApply, applying }: {
  tag: string; count: number;
  onDelete: () => void; onApply: () => void; applying: boolean;
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
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        background: hovered ? `${ACCENT}15` : `${ACCENT}08`,
        border: `1px solid ${hovered ? ACCENT + "35" : ACCENT + "18"}`,
        borderRadius: 99, padding: "0.35rem 0.7rem 0.35rem 0.85rem",
        transition: "all 0.15s", cursor: "default",
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{tag}</span>
      {count > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: `${ACCENT}18`, borderRadius: 99, padding: "1px 7px" }}>
          {count.toLocaleString()}
        </span>
      )}
      <div style={{ display: "flex", gap: "0.15rem", marginLeft: "0.1rem" }}>
        <button
          onClick={onApply}
          disabled={applying}
          title="Auto-apply this tag to all files whose name contains it"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px 3px", cursor: applying ? "wait" : "pointer", color: hovered ? ACCENT : "#475569", transition: "color 0.12s" }}>
          {applying ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={10} />}
        </button>
        <button
          onClick={onDelete}
          title="Remove tag"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px 3px", cursor: "pointer", color: hovered ? "#f43f5e" : "#475569", transition: "color 0.12s" }}>
          <X size={10} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Job History Row ────────────────────────────────────────────────────────────

function JobRow({ run }: { run: TagRun }) {
  const [expanded, setExpanded] = useState(run.status === "running");
  const statusColor = run.status === "done" ? "#10b981" : run.status === "error" ? "#f43f5e" : "#f59e0b";
  const StatusIcon = run.status === "done" ? CheckCircle2 : run.status === "error" ? AlertCircle : Clock;
  const duration = run.finished_at
    ? (() => {
        const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
        return ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
      })()
    : null;
  const topTags = Object.entries(run.tags_applied ?? {}).sort(([, a], [, b]) => b - a).slice(0, 10);
  const isAuto = run.run_type === "auto" || run.run_type === "routine";
  const label = run.trigger?.startsWith("batch:") ? `Batch · ${run.trigger.replace("batch:", "")}` :
                run.trigger?.startsWith("manual:") ? `Tag · ${run.trigger.replace("manual:", "")}` :
                run.trigger ?? run.run_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", cursor: "pointer" }}
      >
        <StatusIcon size={14} color={statusColor} style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap" }}>{label}</span>
          {isAuto && (
            <span style={{ fontSize: 9, background: "#38bdf820", color: "#38bdf8", borderRadius: 6, padding: "1px 6px", fontWeight: 700, textTransform: "uppercase" }}>Auto</span>
          )}
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, textTransform: "uppercase" }}>{run.status}</span>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{run.files_tagged.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>tagged</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>scanned</div>
          </div>
          {duration && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{duration}</div>
              <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>duration</div>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#475569", textAlign: "right", minWidth: 64 }}>
            {new Date(run.started_at).toLocaleDateString()}<br />
            {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          {expanded ? <ChevronUp size={12} color="#475569" /> : <ChevronDown size={12} color="#475569" />}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div style={{ padding: "0.75rem 1rem 1rem" }}>
              {run.error && (
                <div style={{ fontSize: 11, color: "#f43f5e", background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontFamily: "monospace" }}>
                  {run.error}
                </div>
              )}

              {topTags.length > 0 ? (
                <div>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Tags Applied</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {topTags.map(([tag, count]) => (
                      <span key={tag} style={{
                        fontSize: 11, fontWeight: 700,
                        background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`,
                        borderRadius: 8, padding: "2px 10px", color: ACCENT,
                      }}>
                        {tag} <span style={{ opacity: 0.6 }}>({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : run.status === "done" ? (
                <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>No tag matches found — filenames may not contain any tag keywords.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 11, color: "#f59e0b" }}>
                  <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                  Processing files…
                </div>
              )}

              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Scanned: <b style={{ color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Tagged: <b style={{ color: "#10b981" }}>{run.files_tagged.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Skipped: <b style={{ color: "#94a3b8" }}>{run.files_skipped.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Type: <b style={{ color: "#94a3b8" }}>{run.run_type}</b></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const [tags,       setTags]       = useState<TagDef[]>([]);
  const [runs,       setRuns]       = useState<TagRun[]>([]);
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [applying,   setApplying]   = useState<Set<string>>(new Set());
  const [addInput,   setAddInput]   = useState("");
  const [adding,     setAdding]     = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tagsRes, runsRes, statsRes] = await Promise.allSettled([
        fetch(`${BOT_URL}/admin/tags`),
        fetch(`${BOT_URL}/admin/tags/runs?limit=50`),
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

  // Poll while a run is in progress
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === "running");
    if (!hasRunning) return;
    const t = setInterval(() => fetchAll(), 4000);
    return () => clearInterval(t);
  }, [runs, fetchAll]);

  const handleAdd = async () => {
    const raw = addInput.trim();
    if (!raw) return;
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

  const enriched = tags.map(t => ({
    ...t,
    file_count: driveStats?.tagCounts?.[t.tag] ?? t.file_count,
  })).sort((a, b) => b.file_count - a.file_count);

  const total    = driveStats?.total    ?? 0;
  const tagged   = driveStats?.tagged   ?? 0;
  const untagged = driveStats?.untagged ?? 0;
  const coverage = driveStats?.tagCoverage ?? 0;
  const visibleRuns = showAllRuns ? runs : runs.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.15rem", margin: 0 }}>Asset Tagger</h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            {enriched.length} tags · {total.toLocaleString()} Drive files indexed
          </p>
        </div>
        <button onClick={fetchAll}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Coverage bar */}
      {total > 0 && <CoverageBar pct={coverage} tagged={tagged} untagged={untagged} total={total} />}

      {/* ── Run Panel ── */}
      <RunPanel onRunStarted={() => setTimeout(fetchAll, 1500)} />

      {/* ── Tag Library ── */}
      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Tag size={13} color={ACCENT} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tag Library</span>
          <span style={{ fontSize: 11, color: "#475569" }}>— {enriched.length} tags</span>
        </div>

        {/* Add tag */}
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Tag size={12} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              ref={inputRef}
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              placeholder='Add tag — e.g. "Green", "Stability Bar", "Outside"'
              style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: "0.55rem", paddingBottom: "0.55rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${addInput ? ACCENT + "40" : "rgba(255,255,255,0.09)"}`, borderRadius: 10, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!addInput.trim() || adding}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: addInput.trim() ? `${ACCENT}18` : "rgba(255,255,255,0.04)", border: `1px solid ${addInput.trim() ? ACCENT + "30" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "0 1.1rem", color: addInput.trim() ? ACCENT : "#475569", fontSize: 12, fontWeight: 700, cursor: addInput.trim() ? "pointer" : "default", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            {adding ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={12} />}
            Add
          </button>
        </div>

        {/* Chips */}
        {loading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ height: 32, width: 70 + (i % 4) * 25, background: "rgba(255,255,255,0.04)", borderRadius: 99, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : enriched.length === 0 ? (
          <p style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "1.5rem 0" }}>
            No tags yet. Type one above and press Enter.
          </p>
        ) : (
          <motion.div layout style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <AnimatePresence>
              {enriched.map(t => (
                <TagChip
                  key={t.tag}
                  tag={t.label ?? t.tag}
                  count={t.file_count}
                  onDelete={() => handleDelete(t.tag)}
                  onApply={() => handleApply(t.tag)}
                  applying={applying.has(t.tag)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <p style={{ fontSize: 10, color: "#334155", marginTop: "1rem", marginBottom: 0 }}>
          ▷ on a chip = retroactively apply just that tag across all files · ✕ = remove tag from library
        </p>
      </div>

      {/* ── Job History ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <History size={13} color="#64748b" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Job History</span>
            {runs.length > 0 && <span style={{ fontSize: 11, color: "#475569" }}>{runs.length} runs</span>}
          </div>
          {runs.some(r => r.status === "running") && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#f59e0b" }}>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              Run in progress — auto-refreshing
            </div>
          )}
        </div>

        {loading && runs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 52, background: "rgba(255,255,255,0.02)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "2rem", opacity: 0.5 }}>
            <History size={24} color="#475569" style={{ marginBottom: "0.5rem", display: "block", margin: "0 auto 0.5rem" }} />
            <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>No runs yet. Hit Run Now to start your first batch.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {visibleRuns.map(run => <JobRow key={run.id} run={run} />)}
            </div>
            {runs.length > 5 && (
              <button
                onClick={() => setShowAllRuns(s => !s)}
                style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: "0.3rem 0" }}
              >
                {showAllRuns ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllRuns ? "Show less" : `Show all ${runs.length} runs`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
