"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Trash2, Play, Pause, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Terminal, Sparkles, Bot, Check, X } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Routine {
    id: string;
    agent_id: string;
    name: string;
    description: string | null;
    cron: string;
    prompt: string;
    enabled: boolean;
    report_to_discord: boolean;
    last_run_at: string | null;
    last_status: "success" | "error" | "running" | null;
    resource_level: "LOW" | "MEDIUM" | "HIGH" | null;
    created_at: string;
    // Agent proposal fields
    approval_status: "approved" | "pending" | "rejected" | null;
    proposed_by: string | null;
    proposal_notes: string | null;
}

interface RoutineRun {
    id: string;
    status: "running" | "success" | "error";
    triggered_by: "cron" | "manual";
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    agent_output: string | null;
    tools_used: string[] | null;     // renamed from tool_calls_used → tasks table
    provider: string | null;
    error: string | null;
}

const CRON_PRESETS = [
    { label: "Every 15 min",  value: "*/15 * * * *" },
    { label: "Hourly",        value: "0 * * * *" },
    { label: "Every 2 hrs",   value: "0 */2 * * *" },
    { label: "Every 4 hrs",   value: "0 */4 * * *" },
    { label: "Every 6 hrs",   value: "0 */6 * * *" },
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

function ResourceBadge({ level }: { level: Routine["resource_level"] }) {
    if (!level) return null;
    const cfg = {
        LOW:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)"  },
        MEDIUM: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
        HIGH:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)"  },
    }[level];
    return (
        <span title={`Resource usage: ${level}`} style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9,
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 5, padding: "2px 6px",
        }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
            {level}
        </span>
    );
}

// ── Debug Panel ────────────────────────────────────────────────────────────────

function DebugPanel({ routineId, liveRun }: { routineId: string; liveRun: RoutineRun | null }) {
    const [run, setRun] = useState<RoutineRun | null>(liveRun);
    const [history, setHistory] = useState<RoutineRun[]>([]);
    const [tab, setTab] = useState<"current" | "history">("current");
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
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
                    return data;
                }
            } catch { /* silent */ }
            return null;
        };

        const fetchHistory = async () => {
            try {
                const res = await fetch(`${BOT_URL}/admin/routines/${routineId}/runs`);
                if (res.ok) setHistory(await res.json());
            } catch { /* silent */ }
        };

        fetchLatest();
        fetchHistory();

        // Always poll when we have a running state — use interval ref to avoid stale closure
        if (run?.status === "running") {
            pollRef.current = setInterval(async () => {
                const latest = await fetchLatest();
                // Stop polling and refresh history once the task finishes
                if (latest && latest.status !== "running") {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;
                    await fetchHistory();
                }
            }, 2000);
        }

        return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
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
                            {displayRun.tools_used && displayRun.tools_used.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, color: "#666", marginRight: 2 }}>Tools:</span>
                                    {displayRun.tools_used.map(t => (
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
                    {history.map(h => {
                        const isOpen = expandedHistoryId === h.id;
                        return (
                            <div key={h.id} style={{ borderRadius: 6, overflow: "hidden", border: isOpen ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent" }}>
                                {/* Row header — click to expand */}
                                <div
                                    onClick={() => setExpandedHistoryId(isOpen ? null : h.id)}
                                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: isOpen ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", cursor: "pointer", flexWrap: "wrap", userSelect: "none" }}>
                                    <StatusBadge status={h.status} small />
                                    <span style={{ fontSize: 10, color: "#777" }}>{new Date(h.started_at).toLocaleString()}</span>
                                    {h.duration_ms != null && <span style={{ fontSize: 10, color: "#555" }}>{(h.duration_ms / 1000).toFixed(1)}s</span>}
                                    <span style={{ fontSize: 10, color: h.triggered_by === "manual" ? "var(--accent-cyan)" : "#555" }}>
                                        {h.triggered_by === "manual" ? "⚡ manual" : "⏰ cron"}
                                    </span>
                                    {h.provider && h.provider !== "error" && <span style={{ fontSize: 10, color: "#555" }}>{h.provider}</span>}
                                    {h.error && !isOpen && <span style={{ fontSize: 10, color: "#ef4444" }} title={h.error}>⚠ {h.error.slice(0, 40)}…</span>}
                                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#444" }}>{isOpen ? "▲" : "▼"}</span>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                        {/* Tools used */}
                                        {Array.isArray(h.tools_used) && h.tools_used.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                                                {(h.tools_used as string[]).map((t, i) => (
                                                    <span key={i} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>{t.replace("shopify__", "")}</span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Agent output */}
                                        {h.agent_output ? (
                                            <pre style={{ fontSize: 10, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflowY: "auto", margin: 0, background: "#0a0a12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 12px" }}>
                                                {h.agent_output}
                                            </pre>
                                        ) : (
                                            <p style={{ fontSize: 10, color: "#555", fontStyle: "italic", margin: 0 }}>No output recorded.</p>
                                        )}
                                        {/* Error */}
                                        {h.error && (
                                            <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 4, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                                                <p style={{ fontSize: 10, color: "#ef4444", margin: 0 }}>{h.error}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

        </motion.div>
    );
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

function RoutineModal({ agentId, agentName, initial, onClose, onSaved }: { agentId: string; agentName: string; initial?: Partial<Routine>; onClose: () => void; onSaved: () => void; }) {
    const [form, setForm] = useState<Partial<Routine>>(initial ?? { agent_id: agentId, enabled: true, cron: "0 9 * * *" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI prompt builder state
    const [description, setDescription] = useState("");
    const [building, setBuilding] = useState(false);
    const [buildError, setBuildError] = useState<string | null>(null);
    const [promptGenerated, setPromptGenerated] = useState(false);

    const set = (k: keyof Routine, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleBuildPrompt = async () => {
        if (!description.trim()) return;
        setBuilding(true);
        setBuildError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/ai/build-routine-prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: description.trim(), agentName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
            set("prompt", data.prompt);
            setPromptGenerated(true);
        } catch (e: any) {
            setBuildError(e.message);
        } finally {
            setBuilding(false);
        }
    };

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
                style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 560, padding: "1.5rem", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                        <Clock size={16} style={{ color: "var(--accent-orange)" }} />
                        <p className="has-text-weight-black is-size-6">{initial?.id ? "Edit Routine" : "New Routine"}</p>
                    </div>
                    <button className="delete" onClick={onClose} />
                </div>

                <form onSubmit={handleSave}>
                    {/* Name */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Routine Name</label>
                        <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} placeholder="e.g. Weekly Sales Report" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
                    </div>

                    {/* Schedule */}
                    <div className="field mb-4">
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

                    {/* ── AI Prompt Builder ───────────────────────────────── */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Describe the Task Workflow
                        </label>
                        <p className="is-size-7 has-text-grey mb-2" style={{ lineHeight: 1.5 }}>
                            Describe what you want in plain language — AI will convert it into an optimized agent prompt.
                        </p>
                        <div style={{ position: "relative" }}>
                            <textarea
                                className="textarea"
                                rows={3}
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical", paddingRight: "110px" }}
                                placeholder={`e.g. "Every morning check our Shopify sales from yesterday and post a brief summary with revenue, orders, and the top product."`}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleBuildPrompt(); } }}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <button
                                type="button"
                                disabled={building || !description.trim()}
                                onClick={handleBuildPrompt}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: building || !description.trim() ? "not-allowed" : "pointer", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", color: building || !description.trim() ? "#555" : "#a78bfa", fontWeight: 700, transition: "all 0.15s" }}>
                                {building
                                    ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Building…</>
                                    : <><Sparkles size={12} /> {promptGenerated ? "Regenerate" : "✨ Build Prompt"}</>}
                            </button>
                            {promptGenerated && !building && (
                                <span style={{ fontSize: 11, color: "var(--accent-emerald)" }}>✓ Generated — review and edit below</span>
                            )}
                            {buildError && <span style={{ fontSize: 11, color: "#ef4444" }}>{buildError}</span>}
                        </div>
                    </div>

                    {/* Generated / editable prompt */}
                    <div className="field mb-4">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <label className="is-size-7 has-text-grey-light has-text-weight-bold" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Agent Prompt
                                {promptGenerated && <span style={{ marginLeft: 8, fontSize: 10, color: "#a78bfa", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>AI-generated — edit freely</span>}
                            </label>
                        </div>
                        <textarea
                            required
                            className="textarea"
                            rows={5}
                            style={{
                                background: promptGenerated ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.04)",
                                border: promptGenerated ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(255,255,255,0.08)",
                                color: "#fff",
                                resize: "vertical",
                                transition: "all 0.3s",
                            }}
                            placeholder="The exact prompt sent to the agent. Use ✨ Build Prompt above or write your own."
                            value={form.prompt ?? ""}
                            onChange={e => { set("prompt", e.target.value); if (promptGenerated) setPromptGenerated(false); }}
                        />
                    </div>

                    <div className="field mb-3 is-flex is-align-items-center" style={{ gap: 10 }}>
                        <input type="checkbox" id="routine-enabled" checked={!!form.enabled} onChange={e => set("enabled", e.target.checked)} />
                        <label htmlFor="routine-enabled" className="is-size-7 has-text-grey-light has-text-weight-bold" style={{ letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Active</label>
                    </div>

                    <div className="field mb-4" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(88,101,242,0.06)", border: "1px solid rgba(88,101,242,0.2)" }}>
                        <div className="is-flex is-align-items-center" style={{ gap: 10 }}>
                            <input type="checkbox" id="routine-discord" checked={!!form.report_to_discord} onChange={e => set("report_to_discord", e.target.checked)} />
                            <label htmlFor="routine-discord" style={{ cursor: "pointer", userSelect: "none" }}>
                                <span className="is-size-7 has-text-weight-bold" style={{ color: "#7289da" }}>📢 Report in Discord</span>
                            </label>
                        </div>
                        <p className="is-size-7 has-text-grey mt-1" style={{ paddingLeft: 22, lineHeight: 1.4 }}>
                            After each run, the agent posts its output to its Discord channel as an embed.
                        </p>
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
            const routineList = Array.isArray(data) ? data : [];
            setRoutines(routineList);
            // Default all routines to COLLAPSED — user expands individually
            setDebugOpen(prev => {
                const next: Record<string, boolean> = { ...prev };
                routineList.forEach((r: Routine) => { if (next[r.id] === undefined) next[r.id] = false; });
                return next;
            });
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
        setLiveRuns(p => ({ ...p, [r.id]: { id: "pending", status: "running", triggered_by: "manual", started_at: new Date().toISOString(), completed_at: null, duration_ms: null, agent_output: null, tools_used: null, provider: null, error: null } }));

        try {
            const res = await fetch(`${BOT_URL}/admin/routines/${r.id}/run`, { method: "POST" });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                // 409 = already running — pull back the optimistic state
                setLiveRuns(p => ({ ...p, [r.id]: { ...p[r.id], status: "error", error: body.error ?? `Server error ${res.status}` } }));
            } else {
                // Refresh routine list to show updated last_status
                await fetch_();
            }
        } catch (e) {
            console.error("Failed to trigger routine", e);
            setLiveRuns(p => ({ ...p, [r.id]: { ...p[r.id], status: "error", error: "Failed to trigger" } }));
        } finally {
            setRunning(p => ({ ...p, [r.id]: false }));
        }
    };

    const handleApprove = async (id: string) => {
        await fetch(`${BOT_URL}/admin/routines/${id}/approve`, { method: "POST" });
        fetch_();
    };

    const handleReject = async (id: string) => {
        const feedback = window.prompt("Optional: leave a note for the agent about why this was rejected.");
        await fetch(`${BOT_URL}/admin/routines/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: feedback ?? "" }),
        });
        fetch_();
    };

    const pendingRoutines = routines.filter(r => r.approval_status === "pending");
    const activeRoutines  = routines.filter(r => r.approval_status !== "pending");

    return (
        <div>
            {/* ── Section Header ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Clock size={14} style={{ color: "var(--accent-orange)" }} />
                    </div>
                    <div>
                        <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: 0, lineHeight: 1 }}>Routines</p>
                        <p style={{ color: "#555", fontSize: 11, margin: 0, marginTop: 2 }}>{activeRoutines.length} scheduled task{activeRoutines.length !== 1 ? "s" : ""}{pendingRoutines.length > 0 ? ` · ${pendingRoutines.length} pending approval` : ""}</p>
                    </div>
                </div>
                <button
                    onClick={() => setModal({ open: true })}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.3)", color: "#ff8c00", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,140,0,0.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,140,0,0.12)"; }}
                >
                    <Plus size={13} /> New Routine
                </button>
            </div>

            {/* ── Empty / Loading States ──────────────────────────────────────── */}
            {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1rem 0", color: "#555", fontSize: 13 }}>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading routines…
                </div>
            )}
            {!loading && routines.length === 0 && (
                <div style={{ padding: "1.5rem", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
                    <Clock size={28} style={{ color: "#333", marginBottom: 8 }} />
                    <p style={{ color: "#666", fontSize: 13, fontWeight: 600, margin: 0 }}>No routines yet</p>
                    <p style={{ color: "#444", fontSize: 11, margin: "4px 0 0" }}>Schedule periodic tasks for this agent using the button above.</p>
                </div>
            )}

            {/* ── Pending Agent Proposals ──────────────────────────────────────── */}
            {pendingRoutines.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Bot size={13} style={{ color: "#f59e0b" }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                            Agent Proposals — Awaiting Approval
                        </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pendingRoutines.map(r => (
                            <motion.div
                                key={r.id}
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    borderRadius: 12,
                                    background: "rgba(245,158,11,0.04)",
                                    border: "1px solid rgba(245,158,11,0.25)",
                                    padding: "0.85rem 1rem",
                                }}
                            >
                                {/* Header row */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.name}</span>
                                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                                Pending
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                            <code style={{ fontSize: 10, color: "#888", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>{r.cron}</code>
                                            {r.proposed_by && (
                                                <span style={{ fontSize: 10, color: "#666" }}>Proposed by {r.proposed_by}</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Approve / Reject */}
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                        <button
                                            onClick={() => handleApprove(r.id)}
                                            title="Approve — activates routine immediately"
                                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.1)", color: "var(--accent-emerald)", transition: "all 0.15s" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.2)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.1)"; }}
                                        >
                                            <Check size={11} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(r.id)}
                                            title="Reject proposal"
                                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#ef4444", transition: "all 0.15s" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.07)"; }}
                                        >
                                            <X size={11} /> Reject
                                        </button>
                                    </div>
                                </div>

                                {/* Rationale / notes */}
                                {r.proposal_notes && (
                                    <p style={{ fontSize: 11, color: "#888", lineHeight: 1.5, margin: "0 0 8px", fontStyle: "italic" }}>
                                        {r.proposal_notes.split("\n")[0]}
                                    </p>
                                )}

                                {/* Prompt preview */}
                                <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 10px" }}>
                                    <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px", fontWeight: 700 }}>Prompt</p>
                                    <p style={{ fontSize: 11, color: "#777", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                                        {r.prompt}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Routine Cards ───────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {activeRoutines.map(r => (
                    <div key={r.id} style={{
                        borderRadius: 12,
                        background: r.enabled ? "rgba(255,140,0,0.03)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${debugOpen[r.id] ? "rgba(255,140,0,0.3)" : (r.enabled ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.06)")}`,
                        overflow: "hidden",
                        transition: "border-color 0.15s",
                    }}>

                        {/* ── Card Header ── */}
                        <div
                            onClick={() => setDebugOpen(p => ({ ...p, [r.id]: !p[r.id] }))}
                            style={{
                                padding: "0.75rem 1rem",
                                cursor: "pointer",
                                userSelect: "none",
                                background: debugOpen[r.id] ? "rgba(255,255,255,0.025)" : "transparent",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { if (!debugOpen[r.id]) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = debugOpen[r.id] ? "rgba(255,255,255,0.025)" : "transparent"; }}
                        >
                            {/* Row 1: chevron + name */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <span style={{ color: debugOpen[r.id] ? "var(--accent-orange)" : "#444", flexShrink: 0, transition: "color 0.15s", display: "flex" }}>
                                    {debugOpen[r.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </span>
                                <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 1 }}>{r.name}</span>
                            </div>

                            {/* Row 2: badges only — horizontal */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 22, marginBottom: 6, flexWrap: "wrap" }}>
                                <StatusBadge status={r.last_status} small />
                                <ResourceBadge level={r.resource_level} />
                                {!r.enabled && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#666", letterSpacing: "0.06em", textTransform: "uppercase" }}>Paused</span>}
                                {r.report_to_discord && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(88,101,242,0.15)", color: "#7289da", border: "1px solid rgba(88,101,242,0.25)", fontWeight: 700 }}>📢 Discord</span>}
                            </div>

                            {/* Row 3: cron + last-run (left) | action buttons (right) */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22 }} onClick={e => e.stopPropagation()}>
                                <code style={{ fontSize: 10, color: "#888", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>{r.cron}</code>
                                <span style={{ fontSize: 10, color: "#444" }}>Last: {formatRelative(r.last_run_at)}</span>

                                {/* Push actions to right */}
                                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                                    <button
                                        title="Run now"
                                        disabled={running[r.id] || liveRuns[r.id]?.status === "running"}
                                        onClick={() => handleRunNow(r)}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
                                            padding: "4px 10px", borderRadius: 7, transition: "all 0.15s",
                                            cursor: (running[r.id] || liveRuns[r.id]?.status === "running") ? "not-allowed" : "pointer",
                                            border: "1px solid rgba(52,211,153,0.3)",
                                            background: "rgba(52,211,153,0.08)",
                                            color: (running[r.id] || liveRuns[r.id]?.status === "running") ? "#555" : "var(--accent-emerald)",
                                        }}
                                    >
                                        {(running[r.id] || liveRuns[r.id]?.status === "running")
                                            ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                                            : <Play size={11} />}
                                        {(running[r.id] || liveRuns[r.id]?.status === "running") ? "Running…" : "Run Now"}
                                    </button>

                                    <button
                                        title={r.enabled ? "Pause" : "Resume"}
                                        onClick={() => handleToggle(r)}
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#888", cursor: "pointer", transition: "all 0.15s" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#ccc"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#888"; }}
                                    >
                                        {r.enabled ? <Pause size={12} /> : <Play size={12} />}
                                    </button>

                                    <button
                                        title="Edit"
                                        onClick={() => setModal({ open: true, initial: r })}
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#ccc"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#888"; }}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        title="Delete"
                                        onClick={() => handleDelete(r.id)}
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", transition: "all 0.15s" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.06)"; }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Row 4: prompt preview — full width, collapsed only */}
                            {!debugOpen[r.id] && r.prompt && (
                                <p style={{ fontSize: 11, color: "#555", lineHeight: 1.45, margin: "8px 0 0", paddingLeft: 22, paddingRight: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                    {r.prompt}
                                </p>
                            )}
                        </div>

                        {/* ── Debug Panel ── */}
                        <AnimatePresence>
                            {debugOpen[r.id] && (
                                <div style={{ padding: "0 1rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                    <DebugPanel routineId={r.id} liveRun={liveRuns[r.id] ?? null} />
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {modal.open && (
                    <RoutineModal agentId={agentId} agentName={agentName} initial={modal.initial} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); fetch_(); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
