"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Trash2, Play, Pause, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";

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

const CRON_PRESETS = [
    { label: "Every 15 minutes",  value: "*/15 * * * *" },
    { label: "Hourly",            value: "0 * * * *" },
    { label: "Daily at 9am",      value: "0 9 * * *" },
    { label: "Daily at 6pm",      value: "0 18 * * *" },
    { label: "Mon–Fri at 9am",    value: "0 9 * * 1-5" },
    { label: "Every Monday 9am",  value: "0 9 * * 1" },
    { label: "1st of month 8am",  value: "0 8 1 * *" },
];

function statusIcon(status: Routine["last_status"]) {
    if (status === "success") return <CheckCircle2 size={12} style={{ color: "var(--accent-emerald)" }} />;
    if (status === "error")   return <XCircle size={12} style={{ color: "#ef4444" }} />;
    if (status === "running") return <Loader2 size={12} style={{ color: "var(--accent-cyan)", animation: "spin 1s linear infinite" }} />;
    return null;
}

function formatRelative(ts: string | null) {
    if (!ts) return "Never";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function RoutineModal({
    agentId,
    initial,
    onClose,
    onSaved,
}: {
    agentId: string;
    initial?: Partial<Routine>;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState<Partial<Routine>>(initial ?? { agent_id: agentId, enabled: true, cron: "0 9 * * *" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: keyof Routine, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/routines`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, agent_id: agentId }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Error ${res.status}`);
            }
            onSaved();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 520, padding: "1.5rem" }}
                onClick={e => e.stopPropagation()}
            >
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
                        <input required className="input" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                            placeholder="e.g. Weekly Sales Report"
                            value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
                    </div>

                    {/* Schedule */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Schedule</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                            {CRON_PRESETS.map(p => (
                                <button key={p.value} type="button"
                                    onClick={() => set("cron", p.value)}
                                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: form.cron === p.value ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.05)", border: form.cron === p.value ? "1px solid rgba(255,140,0,0.4)" : "1px solid transparent", color: form.cron === p.value ? "#ff8c00" : "#aaa" }}
                                >{p.label}</button>
                            ))}
                        </div>
                        <input required className="input is-family-monospace is-small" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#aaa" }}
                            placeholder="cron expression (e.g. 0 9 * * 1)"
                            value={form.cron ?? ""} onChange={e => set("cron", e.target.value)} />
                        <p className="is-size-7 has-text-grey mt-1">All times Eastern. <a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)" }}>crontab.guru ↗</a></p>
                    </div>

                    {/* Prompt */}
                    <div className="field mb-4">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Task Prompt</label>
                        <textarea required className="textarea" rows={4} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
                            placeholder="What should the agent do? e.g. Pull this week's Shopify sales data and post a summary."
                            value={form.prompt ?? ""} onChange={e => set("prompt", e.target.value)} />
                        <p className="is-size-7 has-text-grey mt-1">This is sent as a message to the agent exactly as written.</p>
                    </div>

                    {/* Enabled */}
                    <div className="field mb-4 is-flex is-align-items-center" style={{ gap: 10 }}>
                        <input type="checkbox" id="routine-enabled" checked={!!form.enabled} onChange={e => set("enabled", e.target.checked)} />
                        <label htmlFor="routine-enabled" className="is-size-7 has-text-grey-light has-text-weight-bold" style={{ letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Active</label>
                    </div>

                    {error && <p className="help is-danger mb-3">{error}</p>}

                    <div className="is-flex" style={{ gap: "0.75rem" }}>
                        <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
                        <button type="submit" className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}>
                            {initial?.id ? "Save Changes" : "Create Routine"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

interface AgentRoutinesProps {
    agentId: string;
    agentName: string;
}

export function AgentRoutines({ agentId, agentName }: AgentRoutinesProps) {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean; initial?: Partial<Routine> }>({ open: false });

    const fetch_ = useCallback(async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/routines?agent_id=${agentId}`);
            const data = await res.json();
            setRoutines(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [agentId]);

    useEffect(() => { fetch_(); }, [fetch_]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this routine?")) return;
        await fetch(`${BOT_URL}/admin/routines/${id}`, { method: "DELETE" });
        fetch_();
    };

    const handleToggle = async (r: Routine) => {
        await fetch(`${BOT_URL}/admin/routines/${r.id}/toggle`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !r.enabled }),
        });
        fetch_();
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

            <div className="is-flex is-flex-direction-column" style={{ gap: 6 }}>
                {routines.map(r => (
                    <div key={r.id} style={{ padding: "0.6rem 0.8rem", borderRadius: 8, background: r.enabled ? "rgba(255,140,0,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${r.enabled ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                        <div className="is-flex is-align-items-center is-justify-content-space-between">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="is-flex is-align-items-center" style={{ gap: 6, marginBottom: 2 }}>
                                    {statusIcon(r.last_status)}
                                    <span className="is-size-7 has-text-weight-black has-text-white">{r.name}</span>
                                    {!r.enabled && <span className="tag is-small is-dark" style={{ fontSize: 9 }}>Paused</span>}
                                </div>
                                <div className="is-flex is-align-items-center" style={{ gap: 8 }}>
                                    <code style={{ fontSize: 10, color: "#aaa", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>{r.cron}</code>
                                    <span className="is-size-7 has-text-grey" style={{ fontSize: 10 }}>{formatRelative(r.last_run_at)}</span>
                                </div>
                            </div>
                            <div className="is-flex is-align-items-center" style={{ gap: 5, flexShrink: 0 }}>
                                <button className="button is-small is-dark" title={r.enabled ? "Pause" : "Resume"} onClick={() => handleToggle(r)}>
                                    {r.enabled ? <Pause size={11} /> : <Play size={11} />}
                                </button>
                                <button className="button is-small is-dark" onClick={() => setModal({ open: true, initial: r })}>
                                    <span style={{ fontSize: 11 }}>Edit</span>
                                </button>
                                <button className="button is-small is-danger is-light" onClick={() => handleDelete(r.id)}>
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        </div>
                        <p className="is-size-7 has-text-grey mt-1" style={{ fontSize: 11, lineHeight: 1.4 }}>{r.prompt.slice(0, 100)}{r.prompt.length > 100 ? "…" : ""}</p>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {modal.open && (
                    <RoutineModal
                        agentId={agentId}
                        initial={modal.initial}
                        onClose={() => setModal({ open: false })}
                        onSaved={() => { setModal({ open: false }); fetch_(); }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
