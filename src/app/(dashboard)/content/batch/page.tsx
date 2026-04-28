"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Play, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, RefreshCw, History, Trash2,
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

// ── Job Row ────────────────────────────────────────────────────────────────────

function JobRow({ run, onDelete }: { run: TagRun; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(run.status === "running");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this run from history?")) return;
    setDeleting(true);
    try {
      await fetch(`${BOT_URL}/admin/tags/runs/${run.id}`, { method: "DELETE" });
      onDelete(run.id);
    } catch { setDeleting(false); }
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
    run.trigger?.startsWith("batch:")  ? `Batch · ${run.trigger.replace("batch:", "")}` :
    run.trigger?.startsWith("manual:") ? `Tag · ${run.trigger.replace("manual:", "")}` :
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
                  const fileLogs: Array<{ n: string; t: string[]; ok: boolean }> =
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

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // Auto-refresh while a run is in progress
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === "running");
    if (!hasRunning) { setRunning(false); return; }
    const t = setInterval(fetchRuns, 3500);
    return () => clearInterval(t);
  }, [runs, fetchRuns]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/run-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
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
            Auto-tag Drive files by matching filenames against your Tag Library
          </p>
        </div>
        <button onClick={fetchRuns}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* ── Run Panel ── */}
      <div style={{ ...CARD, marginBottom: "1.75rem", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.1rem" }}>
          <Zap size={14} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>Batch Tag Run</span>
          <span style={{ fontSize: 11, color: "#475569" }}>— scans untagged files and applies matching tags by filename</span>
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
                : `linear-gradient(135deg, ${ACCENT}, #059669)`,
              border: "none", borderRadius: 10,
              padding: "0.6rem 1.75rem",
              color: running ? "#64748b" : "#fff",
              fontSize: 13, fontWeight: 800,
              cursor: running ? "wait" : "pointer",
              boxShadow: running ? "none" : `0 4px 20px ${ACCENT}35`,
              transition: "all 0.2s",
            }}
          >
            {running
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
              : <><Play size={13} fill="#fff" /> Run Now</>
            }
          </button>

          {lastRunId && !running && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <CheckCircle2 size={12} /> Run started — see history below
            </motion.span>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: 11, color: "#475569", margin: "0.875rem 0 0" }}>
          Files are matched against every tag in your Tag Library by filename keyword. Only untagged files are processed.
          The agent routine "Batch and Tag Files" also runs this automatically on weekday nights.
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
                {activeRuns.map(run => <JobRow key={run.id} run={run} onDelete={handleDelete} />)}
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
