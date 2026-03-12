"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Trash2, Play, Pause, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Terminal } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Routine {
    id: string;
    agent_id: string;
    name: string;
    description: string | null;
    cron: string;
    prompt: string;
    enabled: boolean;
    last_run_at: string | null;
    last_status: "success" | "error" | "running" | null;
    created_at: string;
}

interface RoutineRun {
    id: string;
    status: "running" | "success" | "error";
    triggered_by: "cron" | "manual";
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    agent_output: string | null;
    tool_calls_used: string[] | null;
    error: string | null;
}

const CRON_PRESETS = [
    { label: "Every 15 min",  value: "*/15 * * * *" },
    { label: "Hourly",        value: "0 * * * *" },
    { label: "Daily 9am",     value: "0 9 * * *" },
    { label: "Daily 6pm",     value: "0 18 * * *" },
    { label: "Mon–Fri 9am",   value: "0 9 * * 1-5" },
    { label: "Weekly Mon",    value: "0 9 * * 1" },
    { label: "1st of month",  value: "0 8 1 * *" },
];

function formatRelative(ts: string | null) {
    if (!ts) return "Never run";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status, small }: { status: RoutineRun["status"] | Routine["last_status"]; small?: boolean }) {
    const sz = small ? 10 : 12;
    if (status === "success") return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-emerald)", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, padding: "2px 7px" }}>
            <CheckCircle2 size={sz} />success
        </span>
    );
    if (status === "error") return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "2px 7px" }}>
            <XCircle size={sz} />error
        </span>
    );
    if (status === "running") return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-cyan)", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 6, padding: "2px 7px" }}>
            <Loader2 size={sz} style={{ animation: "spin 1s linear infinite" }} />running
        </span>
    );
    return <span style={{ fontSize: 11, color: "#555" }}>—</span>;
}

// ── Debug Panel ────────────────────────────────────────────────────────────────

function DebugPanel({ routineId, liveRun }: { routineId: string; liveRun: RoutineRun | null }) {
    const [run, setRun] = useState<RoutineRun | null>(liveRun);
    const [history, setHistory] = useState<RoutineRun[]>([]);
    const [tab, setTab] = useState<"current" | "history">("current");
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Poll for updates every 2s while running
    useEffect(() => {
        setRun(liveRun);
    }, [liveRun]);

    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const res = await fetch(`${BOT_URL}/admin/routines/${routineId}/runs/latest`);
                if (res.ok) {
                    const data = await res.json();
                    if (data) setRun(data);
                }
            } catch { /* silent */ }
        };

        const fetchHistory = async () => {
            try {
                const res = await fetch(`${BOT_URL}/admin/routines/${routineId}/runs`);
                if (res.ok) setHistory(await res.json());
            } catch { /* silent */ }
        };

        fetchLatest();
        fetchHistory();

        // Start polling if running
        if (run?.status === "running") {
            pollRef.current = setInterval(async () => {
                await fetchLatest();
                if (run?.status !== "running") clearInterval(pollRef.current!);
            }, 2000);
        }

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [routineId, run?.status]);

    const displayRun = run;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 10 }}
        >
            {/* Tab bar */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {["current", "history"].map(t => (
                    <button key={t} onClick={() => setTab(t as any)}
                        style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
                            background: tab === t ? "rgba(255,255,255,0.12)" : "transparent",
                            color: tab === t ? "#fff" : "#666",
                            textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
                        {t === "current" ? "Latest Run" : "History"}
                    </button>
                ))}
            </div>

            {tab === "current" && (
                <>
                    {!displayRun && (
                        <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No runs yet. Hit ▶ to trigger one.</p>
                    )}
                    {displayRun && (
                        <div>
                            {/* Meta row */}
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                                <StatusBadge status={displayRun.status} />
                                <span style={{ fontSize: 10, color: "#666" }}>
                                    {displayRun.triggered_by === "manual" ? "⚡ Manual trigger" : "⏰ Cron"}
                                </span>
                                {displayRun.duration_ms != null && (
                                    <span style={{ fontSize: 10, color: "#666" }}>
                                        ⏱ {(displayRun.duration_ms / 1000).toFixed(1)}s
                                    </span>
                                )}
                                <span style={{ fontSize: 10, color: "#555" }}>{formatRelative(displayRun.started_at)}</span>
                                {displayRun.status === "running" && (
                                    <span style={{ fontSize: 10, color: "var(--accent-cyan)", animation: "pulse 1.5s infinite" }}>● Live</span>
                                )}
                            </div>

                            {/* Tool chips */}
                            {displayRun.tool_calls_used && displayRun.tool_calls_used.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, color: "#666", marginRight: 2 }}>Tools:</span>
                                    {displayRun.tool_calls_used.map(t => (
                                        <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>{t}</span>
                                    ))}
                                </div>
                            )}

                            {/* Output */}
                            {displayRun.agent_output && (
                                <div>
                                    <p style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Agent Output</p>
                                    <div style={{ background: "#0a0a12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 12px", maxHeight: 220, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                        {displayRun.agent_output}
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {displayRun.error && (
                                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                                    <p style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>ERROR</p>
                                    <p style={{ fontSize: 11, color: "#fca5a5", fontFamily: "monospace" }}>{displayRun.error}</p>
                                </div>
                            )}

                            {displayRun.status === "running" && !displayRun.agent_output && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--accent-cyan)" }}>
                                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                    <span style={{ fontSize: 11 }}>Agent is working... polling every 2s</span>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {tab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {history.length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No run history yet.</p>}
                    {history.map(h => (
                        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", flexWrap: "wrap" }}>
                            <StatusBadge status={h.status} small />
                            <span style={{ fontSize: 10, color: "#777" }}>{new Date(h.started_at).toLocaleString()}</span>
                            {h.duration_ms != null && <span style={{ fontSize: 10, color: "#555" }}>{(h.duration_ms / 1000).toFixed(1)}s</span>}
                            <span style={{ fontSize: 10, color: h.triggered_by === "manual" ? "var(--accent-cyan)" : "#555" }}>
                                {h.triggered_by === "manual" ? "⚡ manual" : "⏰ cron"}
                            </span>
                            {h.error && <span style={{ fontSize: 10, color: "#ef4444" }} title={h.error}>⚠ {h.error.slice(0, 40)}…</span>}
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

function RoutineModal({ agentId, initial, onClose, onSaved }: { agentId: string; initial?: Partial<Routine>; onClose: () => void; onSaved: () => void; }) {
    const [form, setForm] = useState<Partial<Routine>>(initial ?? { agent_id: agentId, enabled: true, cron: "0 9 * * *" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (k: keyof Routine, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/routines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, agent_id: agentId }) });
            if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
            onSaved();
        } catch (e: any) { setError(e.message); } finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 520, padding: "1.5rem" }} onClick={e => e.stopPropagation()}>
                <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                        <Clock size={16} style={{ color: "var(--accent-orange)" }} />
                        <p className="has-text-weight-black is-size-6">{initial?.id ? "Edit Routine" : "New Routine"}</p>
                    </div>
                    <button className="delete" onClick={onClose} />
                </div>

                <form onSubmit={handleSave}>
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Routine Name</label>
                        <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} placeholder="e.g. Weekly Sales Report" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
                    </div>

                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Schedule</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                            {CRON_PRESETS.map(p => (
                                <button key={p.value} type="button" onClick={() => set("cron", p.value)}
                                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: form.cron === p.value ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.05)", border: form.cron === p.value ? "1px solid rgba(255,140,0,0.4)" : "1px solid transparent", color: form.cron === p.value ? "#ff8c00" : "#aaa" }}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <input required className="input is-family-monospace is-small" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#aaa" }} placeholder="cron expression" value={form.cron ?? ""} onChange={e => set("cron", e.target.value)} />
                        <p className="is-size-7 has-text-grey mt-1">All times Eastern. <a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)" }}>crontab.guru ↗</a></p>
                    </div>

                    <div className="field mb-4">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Task Prompt</label>
                        <textarea required className="textarea" rows={4} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }} placeholder="What should the agent do?" value={form.prompt ?? ""} onChange={e => set("prompt", e.target.value)} />
                    </div>

                    <div className="field mb-4 is-flex is-align-items-center" style={{ gap: 10 }}>
                        <input type="checkbox" id="routine-enabled" checked={!!form.enabled} onChange={e => set("enabled", e.target.checked)} />
                        <label htmlFor="routine-enabled" className="is-size-7 has-text-grey-light has-text-weight-bold" style={{ letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Active</label>
                    </div>

                    {error && <p className="help is-danger mb-3">{error}</p>}
                    <div className="is-flex" style={{ gap: "0.75rem" }}>
                        <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
                        <button type="submit" className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}>{initial?.id ? "Save Changes" : "Create Routine"}</button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface AgentRoutinesProps { agentId: string; agentName: string; }

export function AgentRoutines({ agentId, agentName }: AgentRoutinesProps) {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean; initial?: Partial<Routine> }>({ open: false });
    const [debugOpen, setDebugOpen] = useState<Record<string, boolean>>({});
    const [running, setRunning] = useState<Record<string, boolean>>({});
    const [liveRuns, setLiveRuns] = useState<Record<string, RoutineRun>>({});

    const fetch_ = useCallback(async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/routines?agent_id=${agentId}`);
            const data = await res.json();
            setRoutines(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [agentId]);

    useEffect(() => { fetch_(); }, [fetch_]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this routine?")) return;
        await fetch(`${BOT_URL}/admin/routines/${id}`, { method: "DELETE" });
        fetch_();
    };

    const handleToggle = async (r: Routine) => {
        await fetch(`${BOT_URL}/admin/routines/${r.id}/toggle`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !r.enabled }) });
        fetch_();
    };

    const handleRunNow = async (r: Routine) => {
        setRunning(p => ({ ...p, [r.id]: true }));
        // Open debug panel immediately
        setDebugOpen(p => ({ ...p, [r.id]: true }));
        // Set a local "running" state so debug panel shows spinner right away
        setLiveRuns(p => ({ ...p, [r.id]: { id: "pending", status: "running", triggered_by: "manual", started_at: new Date().toISOString(), completed_at: null, duration_ms: null, agent_output: null, tool_calls_used: null, error: null } }));

        try {
            await fetch(`${BOT_URL}/admin/routines/${r.id}/run`, { method: "POST" });
            // Refresh routine list to show updated last_status
            await fetch_();
        } catch (e) {
            console.error("Failed to trigger routine", e);
        } finally {
            setRunning(p => ({ ...p, [r.id]: false }));
        }
    };

    return (
        <div>
            <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
                <div className="is-flex is-align-items-center" style={{ gap: 6 }}>
                    <Clock size={13} style={{ color: "var(--accent-orange)" }} />
                    <span className="is-size-7 has-text-weight-black is-uppercase has-text-grey-light" style={{ letterSpacing: "0.08em" }}>Routines</span>
                </div>
                <button className="button is-warning is-small" onClick={() => setModal({ open: true })}>
                    <Plus size={12} style={{ marginRight: 4 }} />New
                </button>
            </div>

            {loading && <p className="is-size-7 has-text-grey italic">Loading...</p>}
            {!loading && routines.length === 0 && (
                <p className="is-size-7 has-text-grey italic">No routines yet. Add one to schedule periodic tasks for this agent.</p>
            )}

            <div className="is-flex is-flex-direction-column" style={{ gap: 8 }}>
                {routines.map(r => (
                    <div key={r.id} style={{ borderRadius: 10, background: r.enabled ? "rgba(255,140,0,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${r.enabled ? "rgba(255,140,0,0.14)" : "rgba(255,255,255,0.06)"}`, overflow: "hidden" }}>

                        {/* ── Routine Header ─────────────────────────────── */}
                        <div style={{ padding: "0.65rem 0.875rem" }}>
                            <div className="is-flex is-align-items-center is-justify-content-space-between">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="is-flex is-align-items-center" style={{ gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                                        <span className="is-size-7 has-text-weight-black has-text-white" style={{ lineHeight: 1 }}>{r.name}</span>
                                        <StatusBadge status={r.last_status} small />
                                        {!r.enabled && <span className="tag is-small is-dark" style={{ fontSize: 9 }}>Paused</span>}
                                    </div>
                                    <div className="is-flex is-align-items-center" style={{ gap: 8 }}>
                                        <code style={{ fontSize: 10, color: "#888", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>{r.cron}</code>
                                        <span style={{ fontSize: 10, color: "#555" }}>Last: {formatRelative(r.last_run_at)}</span>
                                    </div>
                                </div>

                                {/* ── Action Buttons ──────────────────────── */}
                                <div className="is-flex is-align-items-center" style={{ gap: 5, flexShrink: 0 }}>
                                    {/* ▶ Run Now */}
                                    <button
                                        title="Run now"
                                        disabled={running[r.id]}
                                        onClick={() => handleRunNow(r)}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: running[r.id] ? "not-allowed" : "pointer", border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: running[r.id] ? "#555" : "var(--accent-emerald)", fontWeight: 700, transition: "all 0.15s" }}>
                                        {running[r.id]
                                            ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                                            : <Play size={11} />}
                                        {running[r.id] ? "Running…" : "Run Now"}
                                    </button>

                                    {/* Debug toggle */}
                                    <button
                                        title="Debug output"
                                        onClick={() => setDebugOpen(p => ({ ...p, [r.id]: !p[r.id] }))}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", background: debugOpen[r.id] ? "rgba(255,255,255,0.08)" : "transparent", color: debugOpen[r.id] ? "#fff" : "#666", fontWeight: 700, transition: "all 0.15s" }}>
                                        <Terminal size={11} />
                                        {debugOpen[r.id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>

                                    {/* Pause/Resume */}
                                    <button className="button is-small is-dark" title={r.enabled ? "Pause" : "Resume"} onClick={() => handleToggle(r)}>
                                        {r.enabled ? <Pause size={11} /> : <Play size={11} />}
                                    </button>

                                    {/* Edit */}
                                    <button className="button is-small is-dark" onClick={() => setModal({ open: true, initial: r })}>
                                        <span style={{ fontSize: 11 }}>Edit</span>
                                    </button>

                                    {/* Delete */}
                                    <button className="button is-small is-danger is-light" onClick={() => handleDelete(r.id)}>
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                            <p className="is-size-7 has-text-grey mt-1" style={{ fontSize: 11, lineHeight: 1.4 }}>
                                {r.prompt.slice(0, 110)}{r.prompt.length > 110 ? "…" : ""}
                            </p>
                        </div>

                        {/* ── Debug Panel ─────────────────────────────────── */}
                        <AnimatePresence>
                            {debugOpen[r.id] && (
                                <div style={{ padding: "0 0.875rem 0.75rem" }}>
                                    <DebugPanel routineId={r.id} liveRun={liveRuns[r.id] ?? null} />
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {modal.open && (
                    <RoutineModal agentId={agentId} initial={modal.initial} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); fetch_(); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
