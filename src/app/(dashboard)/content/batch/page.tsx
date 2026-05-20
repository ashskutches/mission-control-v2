"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Play, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, RefreshCw, History, Trash2,
  Tag, Database, Film, Image as ImageIcon, FileText, X,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#10b981";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
  padding: "1.25rem 1.5rem",
};

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

interface FileLogEntry {
  n: string;
  t: string[];
  ok: boolean;
  src?: "vision" | "filename" | "none";
}

// ── Job Row ────────────────────────────────────────────────────────────────────

function JobRow({ run, onDelete, onCancel }: { run: TagRun; onDelete: (id: string) => void; onCancel?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(run.status === "running");
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
  const isStale = run.status === "running" && Date.now() - new Date(run.started_at).getTime() > STALE_THRESHOLD_MS;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this run from history?")) return;
    setDeleting(true);
    try {
      await fetch(`${BOT_URL}/admin/tags/runs/${run.id}`, { method: "DELETE" });
      onDelete(run.id);
    } catch { setDeleting(false); }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelling(true);
    await onCancel?.(run.id);
    setCancelling(false);
  };
  const isRunning = run.status === "running";
  const statusColor = run.status === "done" ? "#10b981" : run.status === "error" ? "#f43f5e" : "#f59e0b";
  const StatusIcon = run.status === "done" ? CheckCircle2 : run.status === "error" ? AlertCircle : Clock;

  const duration = run.finished_at
    ? (() => {
        const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
        return ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
      })()
    : null;

  const isAuto = run.run_type === "auto" || run.run_type === "routine";

  const label =
    run.trigger?.startsWith("batch:")    ? `Batch · ${run.trigger.replace("batch:", "")}` :
    run.trigger?.startsWith("enrich:")   ? `Enrich · ${run.trigger.replace("enrich:", "")}` :
    run.trigger?.startsWith("manual:")  ? `Tag · ${run.trigger.replace("manual:", "")}` :
    run.trigger?.startsWith("targeted:") ? `Targeted · ${run.trigger.replace("targeted:", "")}` :
    run.trigger ?? run.run_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.8rem 1rem", cursor: "pointer" }}
      >
        <StatusIcon size={14} color={statusColor} style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap" }}>{label}</span>
          {isAuto && (
            <span style={{ fontSize: 9, background: "#38bdf820", color: "#38bdf8", borderRadius: 6, padding: "1px 6px", fontWeight: 700, textTransform: "uppercase" }}>
              Auto
            </span>
          )}
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, textTransform: "uppercase" }}>
            {isRunning ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                Running
              </span>
            ) : run.status}
          </span>
        </div>

        <div style={{ display: "flex", gap: "1.75rem", alignItems: "center", flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#10b981" }}>{run.files_tagged.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>tagged</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>scanned</div>
          </div>
          {duration && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{duration}</div>
              <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>time</div>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#475569", textAlign: "right", minWidth: 68 }}>
            {new Date(run.started_at).toLocaleDateString()}<br />
            {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          {expanded ? <ChevronUp size={12} color="#475569" /> : <ChevronDown size={12} color="#475569" />}
          {!run.status.includes("running") && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete run"
              style={{ display: "flex", alignItems: "center", padding: "4px", background: "none", border: "none", cursor: deleting ? "wait" : "pointer", color: "#334155", transition: "color 0.12s", borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f43f5e")}
              onMouseLeave={e => (e.currentTarget.style.color = "#334155")}
            >
              {deleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
            </button>
          )}
          {isStale && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              title="Force-cancel this stuck run"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, cursor: cancelling ? "wait" : "pointer", color: "#f59e0b", fontSize: 10, fontWeight: 700, transition: "all 0.12s" }}
            >
              {cancelling ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <X size={10} />}
              Cancel
            </button>
          )}
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
            <div style={{ padding: "0.875rem 1rem 1rem" }}>
              {run.error && (
                <div style={{ fontSize: 11, color: "#f43f5e", background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "0.875rem", fontFamily: "monospace" }}>
                  {run.error}
                </div>
              )}

              {isRunning ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12, color: "#f59e0b" }}>
                  <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  Processing files… page will auto-refresh when done.
                </div>
              ) : (() => {
                  // Extract _files log from tags_applied, filter out _ keys for summary
                  const fileLogs: FileLogEntry[] =
                    (run.tags_applied as any)?._files ?? [];
                  const tagSummary = Object.entries(run.tags_applied ?? {})
                    .filter(([k]) => !k.startsWith("_"))
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 12);

                  const tagged  = fileLogs.filter(f => f.ok && f.t.length > 0);
                  const skipped = fileLogs.filter(f => !f.ok || f.t.length === 0);

                  return (
                    <>
                      {/* Tag summary chips */}
                      {tagSummary.length > 0 && (
                        <div style={{ marginBottom: "0.875rem" }}>
                          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: "0.4rem" }}>
                            Tags Applied
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {tagSummary.map(([tag, count]) => (
                              <span key={tag} style={{
                                fontSize: 11, fontWeight: 700,
                                background: `${ACCENT}10`, border: `1px solid ${ACCENT}22`,
                                borderRadius: 8, padding: "2px 10px", color: ACCENT,
                              }}>
                                {tag} <span style={{ opacity: 0.55 }}>({count as number})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File log */}
                      {fileLogs.length > 0 ? (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: "0.4rem" }}>
                            File Output ({fileLogs.length} entries)
                          </div>
                          <div style={{
                            maxHeight: 320, overflowY: "auto",
                            background: "rgba(0,0,0,0.25)", borderRadius: 8,
                            padding: "0.6rem 0.75rem",
                            fontFamily: "ui-monospace, 'Cascadia Code', monospace",
                            fontSize: 11, lineHeight: 1.7,
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}>
                            {tagged.map((f, i) => (
                              <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                                <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>
                                <span style={{ color: "#94a3b8", flex: 1, wordBreak: "break-all" }}>{f.n}</span>
                                {f.src === "vision" && (
                                  <span style={{ fontSize: 9, background: "#818cf820", color: "#818cf8", borderRadius: 4, padding: "1px 5px", fontWeight: 700, flexShrink: 0, textTransform: "uppercase" }}>AI</span>
                                )}
                                <span style={{ color: ACCENT, flexShrink: 0, fontSize: 10 }}>
                                  [{f.t.join(", ")}]
                                </span>
                              </div>
                            ))}
                            {skipped.length > 0 && tagged.length > 0 && (
                              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", margin: "0.4rem 0" }} />
                            )}
                            {skipped.slice(0, 50).map((f, i) => (
                              <div key={`s${i}`} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", opacity: 0.35 }}>
                                <span style={{ color: "#64748b", flexShrink: 0 }}>—</span>
                                <span style={{ color: "#64748b", flex: 1, wordBreak: "break-all" }}>{f.n}</span>
                                <span style={{ color: "#475569", flexShrink: 0, fontSize: 10 }}>no match</span>
                              </div>
                            ))}
                            {skipped.length > 50 && (
                              <div style={{ color: "#475569", fontSize: 10, marginTop: "0.25rem" }}>
                                … and {skipped.length - 50} more skipped files
                              </div>
                            )}
                          </div>
                        </div>
                      ) : run.status === "done" && (
                        <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
                          No matches found. Filenames may not contain any tag keywords — try running a retroactive tag from the Tag Library.
                        </p>
                      )}
                    </>
                  );
                })()
              }

              {/* Footer stats */}
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.875rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Scanned: <b style={{ color: "#94a3b8" }}>{run.files_scanned.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Tagged: <b style={{ color: "#10b981" }}>{run.files_tagged.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Skipped: <b style={{ color: "#94a3b8" }}>{run.files_skipped.toLocaleString()}</b></span>
                <span style={{ fontSize: 11, color: "#64748b" }}>Source: <b style={{ color: "#94a3b8" }}>{run.run_type}</b></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BatchTaggerPage() {
  const [runs,         setRuns]         = useState<TagRun[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [running,      setRunning]      = useState(false);
  const [limit,        setLimit]        = useState(100);
  const [showAll,      setShowAll]      = useState(false);
  const [lastRunId,    setLastRunId]    = useState<string | null>(null);
  const [clearing,     setClearing]     = useState(false);
  const [driveStats,   setDriveStats]   = useState<{
    total: number; tagged: number; untagged: number; taggedPct: number; status: string;
    tagDepth?: { 0: number; 1: number; 2: number; 3: number; 4: number; "5+": number };
  } | null>(null);

  // ── Batch run mode ──
  const [runMode,      setRunMode]      = useState<"untagged" | "enrich">("untagged");
  const [enrichMaxTags, setEnrichMaxTags] = useState(3);
  const [bFileType,    setBFileType]    = useState<string>("all");


  const fetchDriveStats = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/status`);
      if (res.ok) {
        const d = await res.json();
        setDriveStats({
          total: d.total ?? 0,
          tagged: d.tagged ?? 0,
          untagged: d.untagged ?? 0,
          taggedPct: d.taggedPct ?? 0,
          status: d.status,
          tagDepth: d.tagDepth,
        });
      }
    } catch { /* silent */ }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/tags/runs?limit=50`);
      if (res.ok) {
        const d = await res.json();
        setRuns(d.runs ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRuns(); fetchDriveStats(); }, [fetchRuns, fetchDriveStats]);

  // Refresh drive stats every 60s
  useEffect(() => {
    const t = setInterval(fetchDriveStats, 60_000);
    return () => clearInterval(t);
  }, [fetchDriveStats]);

  // Re-fetch stats after a batch run completes
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === "running");
    if (!hasRunning && runs.some(r => r.status === "done")) fetchDriveStats();
  }, [runs, fetchDriveStats]);

  // Auto-refresh while a run is in progress
  useEffect(() => {
    // Treat runs stuck in 'running' for >2h as stale (server likely crashed)
    const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
    const isStale = (r: TagRun) =>
      r.status === "running" &&
      Date.now() - new Date(r.started_at).getTime() > STALE_THRESHOLD_MS;

    const hasActive = runs.some(r => r.status === "running" && !isStale(r));
    if (!hasActive) { setRunning(false); return; }
    const t = setInterval(fetchRuns, 3500);
    return () => clearInterval(t);
  }, [runs, fetchRuns]);

  const forceCompleteRun = async (id: string) => {
    try {
      await fetch(`${BOT_URL}/admin/tags/runs/${id}/cancel`, { method: "POST" });
    } catch { /* ignore — fall through to optimistic update */ }
    // Optimistic: mark it error in local state
    setRuns(prev => prev.map(r =>
      r.id === id ? { ...r, status: "error" as const, error: "Manually cancelled (was stuck)" } : r
    ));
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/run-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, mode: runMode, maxTags: enrichMaxTags, fileType: bFileType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start run");
      setLastRunId(data.runId);
      // Fetch immediately to show the "running" row
      setTimeout(fetchRuns, 800);
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
      setRunning(false);
    }
  };

  const handleDelete = (id: string) => setRuns(prev => prev.filter(r => r.id !== id));

  const activeRuns    = runs.filter(r => r.status === "running");
  const completedRuns = runs.filter(r => r.status !== "running");
  const visibleCompleted = showAll ? completedRuns : completedRuns.slice(0, 8);

  const handleClearAll = async () => {
    if (!confirm(`Clear all ${completedRuns.length} completed run(s) from history?`)) return;
    setClearing(true);
    try {
      await fetch(`${BOT_URL}/admin/tags/runs`, { method: "DELETE" });
      setRuns(prev => prev.filter(r => r.status === "running"));
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setClearing(false); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.15rem", margin: 0 }}>Batch Tagger</h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            Auto-tag Drive files using Gemini vision + folder-path rules
          </p>
        </div>
        <button onClick={() => { fetchRuns(); fetchDriveStats(); }}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* ── Tagging Progress Card ── */}
      {driveStats && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ ...CARD, marginBottom: "1.25rem", background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem" }}>
            <Database size={14} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>Drive Index</span>
            {driveStats.status === "indexing" && (
              <span style={{ fontSize: 9, background: "#f59e0b20", color: "#f59e0b", borderRadius: 6, padding: "1px 6px", fontWeight: 700, textTransform: "uppercase" }}>Indexing…</span>
            )}
            {driveStats.status === "ready" && (
              <span style={{ fontSize: 9, background: "#10b98120", color: "#10b981", borderRadius: 6, padding: "1px 6px", fontWeight: 700, textTransform: "uppercase" }}>Ready</span>
            )}
          </div>

          {/* Top stats row */}
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>{driveStats.total.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Total Files</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981", lineHeight: 1 }}>{driveStats.tagged.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Tagged</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f43f5e", lineHeight: 1 }}>{driveStats.untagged.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Untagged</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#818cf8", lineHeight: 1 }}>{driveStats.taggedPct}%</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Tagged</div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: "1.25rem" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${driveStats.taggedPct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                background: "linear-gradient(90deg, #6366f1, #10b981)",
                borderRadius: 99,
              }}
            />
          </div>

          {/* ── Tag Depth Distribution ── */}
          {driveStats.tagDepth && (() => {
            const depth = driveStats.tagDepth!;
            const buckets: { label: string; key: keyof typeof depth; count: number; color: string; enrichMax: number | null }[] = [
              { label: "0 tags",  key: 0,    count: depth[0],    color: "#f43f5e", enrichMax: null },
              { label: "1 tag",   key: 1,    count: depth[1],    color: "#f59e0b", enrichMax: 1   },
              { label: "2 tags",  key: 2,    count: depth[2],    color: "#eab308", enrichMax: 2   },
              { label: "3 tags",  key: 3,    count: depth[3],    color: "#84cc16", enrichMax: 3   },
              { label: "4 tags",  key: 4,    count: depth[4],    color: "#22d3ee", enrichMax: 4   },
              { label: "5+ tags", key: "5+", count: depth["5+"], color: "#10b981", enrichMax: null },
            ];
            const maxCount = Math.max(...buckets.map(b => b.count), 1);

            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  <Tag size={11} color="#64748b" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Tag Depth Distribution</span>
                  <span style={{ fontSize: 9, color: "#334155" }}>— click a row to launch an Enrich run for that tier</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {buckets.map(b => {
                    const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
                    const isTarget = b.enrichMax !== null && runMode === "enrich" && enrichMaxTags === b.enrichMax;
                    const canEnrich = b.enrichMax !== null && b.count > 0;
                    return (
                      <motion.div
                        key={String(b.key)}
                        whileHover={canEnrich ? { scale: 1.01 } : {}}
                        onClick={() => {
                          if (!canEnrich) return;
                          setRunMode("enrich");
                          setEnrichMaxTags(b.enrichMax!);
                          // scroll down to the Batch Tag Run card
                          document.getElementById("batch-run-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.6rem",
                          cursor: canEnrich ? "pointer" : "default",
                          background: isTarget ? `${b.color}12` : "transparent",
                          border: `1px solid ${isTarget ? b.color + "30" : "transparent"}`,
                          borderRadius: 8, padding: "0.2rem 0.4rem",
                          transition: "all 0.15s",
                        }}
                      >
                        {/* Label */}
                        <span style={{ fontSize: 10, fontWeight: 700, color: b.color, width: 50, flexShrink: 0, textAlign: "right" }}>
                          {b.label}
                        </span>
                        {/* Bar */}
                        <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.05 * buckets.indexOf(b) }}
                            style={{
                              position: "absolute", left: 0, top: 0, height: "100%",
                              background: `linear-gradient(90deg, ${b.color}50, ${b.color}90)`,
                              borderRadius: 6,
                            }}
                          />
                        </div>
                        {/* Count */}
                        <span style={{ fontSize: 11, fontWeight: 800, color: b.count > 0 ? b.color : "#334155", width: 52, flexShrink: 0, textAlign: "right" }}>
                          {b.count.toLocaleString()}
                        </span>
                        {/* Enrich CTA */}
                        {canEnrich ? (
                          <span style={{ fontSize: 9, color: isTarget ? b.color : "#334155", width: 60, flexShrink: 0, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                            {isTarget ? "▶ selected" : "enrich →"}
                          </span>
                        ) : (
                          <span style={{ width: 60, flexShrink: 0 }} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      <div id="batch-run-card" style={{ ...CARD, marginBottom: "1.75rem", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <Zap size={14} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>Batch Tag Run</span>
          <span style={{ fontSize: 11, color: "#475569" }}>
            {runMode === "enrich" ? "— re-analyze under-tagged files and add missing tags" : "— scans untagged files and applies matching tags by filename"}
          </span>
        </div>

        {/* Mode toggle + File Type filter row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>

          {/* Mode */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Mode</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {([
                { id: "untagged" as const, label: "Untagged Only",       icon: "○" },
                { id: "enrich"   as const, label: "Enrich Under-Tagged", icon: "◑" },
              ] as const).map(({ id, label }) => (
                <button key={id} onClick={() => setRunMode(id)}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: runMode === id ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${runMode === id ? ACCENT + "50" : "rgba(255,255,255,0.08)"}`,
                    color: runMode === id ? ACCENT : "#64748b",
                    transition: "all 0.12s",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Sparse shortcut — only shown when enrich or as a quick-jump */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Quick Target</span>
            <button
              id="sparse-one-tag"
              onClick={() => { setRunMode("enrich"); setEnrichMaxTags(1); }}
              title="Enrich only files that currently have exactly 1 tag"
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                padding: "0.3rem 0.75rem", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: runMode === "enrich" && enrichMaxTags === 1 ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${runMode === "enrich" && enrichMaxTags === 1 ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.08)"}`,
                color: runMode === "enrich" && enrichMaxTags === 1 ? "#f59e0b" : "#64748b",
                transition: "all 0.12s",
              }}
            >
              <Tag size={10} />
              Sparse (1 tag only)
            </button>
          </div>

          {/* Max-tags threshold — visible in enrich mode */}
          {runMode === "enrich" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Up To</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setEnrichMaxTags(n)}
                      title={`Enrich files that have ${n} tag${n > 1 ? "s" : ""} or fewer`}
                      style={{
                        width: 28, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer",
                        background: enrichMaxTags === n ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${enrichMaxTags === n ? "#818cf840" : "rgba(255,255,255,0.08)"}`,
                        color: enrichMaxTags === n ? "#818cf8" : "#64748b",
                        transition: "all 0.12s",
                      }}
                    >{n}</button>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: "#475569" }}>tag{enrichMaxTags > 1 ? "s" : ""}</span>
                <span style={{ fontSize: 10, color: "#334155", marginLeft: 4 }}>
                  (1-tag files first, then 2s, 3s…)
                </span>
              </div>
            </div>
          )}

          {/* File Type filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>File Type</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {([{id:"all",label:"All",Icon:Database,c:"#64748b"},{id:"image",label:"Image",Icon:ImageIcon,c:"#38bdf8"},{id:"video",label:"Video",Icon:Film,c:"#f59e0b"},{id:"document",label:"Doc",Icon:FileText,c:"#10b981"}] as const).map(({id,label,Icon,c}) => (
                <button key={id} onClick={() => setBFileType(id)}
                  style={{ display:"flex",alignItems:"center",gap:"0.3rem",padding:"0.3rem 0.65rem",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",
                    background: bFileType===id ? `${c}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${bFileType===id ? c+"40" : "rgba(255,255,255,0.08)"}`,
                    color: bFileType===id ? c : "#64748b", transition:"all 0.12s" }}>
                  <Icon size={11}/>{label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Preset sizes */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Files per run</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {[50, 100, 250, 500, 1000].map(n => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  style={{
                    padding: "0.3rem 0.7rem", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: limit === n ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${limit === n ? ACCENT + "50" : "rgba(255,255,255,0.08)"}`,
                    color: limit === n ? ACCENT : "#64748b",
                    transition: "all 0.12s",
                  }}
                >{n.toLocaleString()}</button>
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
                width: 76, padding: "0.3rem 0.5rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#e2e8f0", fontSize: 12,
                outline: "none", textAlign: "center",
              }}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: running
                ? "rgba(255,255,255,0.05)"
                : runMode === "enrich"
                  ? "linear-gradient(135deg, #6366f1, #818cf8)"
                  : `linear-gradient(135deg, ${ACCENT}, #059669)`,
              border: "none", borderRadius: 10,
              padding: "0.6rem 1.75rem",
              color: running ? "#64748b" : "#fff",
              fontSize: 13, fontWeight: 800,
              cursor: running ? "wait" : "pointer",
              boxShadow: running ? "none" : runMode === "enrich" ? "0 4px 20px rgba(99,102,241,0.35)" : `0 4px 20px ${ACCENT}35`,
              transition: "all 0.2s",
            }}
          >
            {running
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
              : <><Play size={13} fill="#fff" /> {runMode === "enrich" ? "Enrich Now" : "Run Now"}</>
            }
          </button>

          {lastRunId && !running && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ fontSize: 11, color: runMode === "enrich" ? "#818cf8" : "#10b981", display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <CheckCircle2 size={12} /> Run started — see history below
            </motion.span>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: 11, color: "#475569", margin: "0.875rem 0 0" }}>
          {runMode === "enrich"
            ? `Targets files with 1${enrichMaxTags > 1 ? `–${enrichMaxTags}` : ""} tag${enrichMaxTags > 1 ? "s" : ""} (${bFileType !== "all" ? bFileType + "s only, " : ""}processing most under-tagged first). Vision re-runs on each file and new tags are merged (existing ones are never removed).`
            : `Files are matched against every tag in your Tag Library by filename keyword. Only${bFileType !== "all" ? ` ${bFileType}` : " untagged"} files are processed. The agent routine "Batch and Tag Files" also runs this automatically on weekday nights.`
          }
        </p>
      </div>

      {/* ── Job History ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <History size={13} color="#64748b" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Job History</span>
            {runs.length > 0 && <span style={{ fontSize: 11, color: "#475569" }}>{runs.length} runs total</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {activeRuns.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#f59e0b" }}>
                <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                {activeRuns.length} run{activeRuns.length > 1 ? "s" : ""} in progress
              </div>
            )}
            {completedRuns.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "none", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "0.25rem 0.65rem", color: "#64748b", fontSize: 11, cursor: clearing ? "wait" : "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}
              >
                {clearing ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                Clear All
              </button>
            )}
          </div>
        </div>

        {loading && runs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 56, background: "rgba(255,255,255,0.02)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
            <History size={28} color="#475569" style={{ display: "block", margin: "0 auto 0.75rem" }} />
            <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>No runs yet. Hit Run Now to start your first batch.</p>
          </div>
        ) : (
          <>
            {/* Active runs always shown at top */}
            {activeRuns.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {activeRuns.map(run => <JobRow key={run.id} run={run} onDelete={handleDelete} onCancel={forceCompleteRun} />)}
              </div>
            )}

            {/* Completed runs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {visibleCompleted.map(run => <JobRow key={run.id} run={run} onDelete={handleDelete} />)}
            </div>

            {completedRuns.length > 8 && (
              <button
                onClick={() => setShowAll(s => !s)}
                style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: "0.3rem 0" }}
              >
                {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAll ? "Show less" : `Show all ${completedRuns.length} completed runs`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
