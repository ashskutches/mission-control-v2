"use client";
/**
 * RoutineTemplates — pre-built agent playbook picker
 *
 * Shown as a collapsible "Playbook Templates" section inside AgentRoutines.
 * Fetches /admin/routines/templates and lets the user one-click install any
 * template, which creates a paused routine (human must enable it).
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp, Plus, Loader2, CheckCircle2 } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    cron: string;
    resource_level: "LOW" | "MEDIUM" | "HIGH";
}

const CATEGORY_COLOR: Record<string, string> = {
    email:    "#a78bfa",
    seo:      "#38bdf8",
    ads:      "#f43f5e",
    support:  "#34d399",
    products: "#fb923c",
};

const RESOURCE_COLOR: Record<string, string> = {
    LOW:    "#22c55e",
    MEDIUM: "#f59e0b",
    HIGH:   "#ef4444",
};

function cronLabel(cron: string): string {
    const presets: Record<string, string> = {
        "0 9 * * 1":   "Weekly Mon 9am",
        "0 8 * * *":   "Daily 8am",
        "0 10 * * *":  "Daily 10am",
        "0 9 * * 1-5": "Weekdays 9am",
    };
    return presets[cron] ?? cron;
}

interface RoutineTemplatesProps {
    agentId: string;
    onInstalled: () => void;
}

export default function RoutineTemplates({ agentId, onInstalled }: RoutineTemplatesProps) {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [installing, setInstalling] = useState<Record<string, boolean>>({});
    const [installed, setInstalled] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || templates.length > 0) return;
        fetch(`${BOT_URL}/admin/routines/templates`)
            .then(r => r.json())
            .then(setTemplates)
            .catch(() => setError("Failed to load templates"));
    }, [open, templates.length]);

    const install = async (t: Template) => {
        if (installing[t.id] || installed[t.id]) return;
        setInstalling(p => ({ ...p, [t.id]: true }));
        setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/routines/from-template`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template_id: t.id, agent_id: agentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
            setInstalled(p => ({ ...p, [t.id]: true }));
            onInstalled();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setInstalling(p => ({ ...p, [t.id]: false }));
        }
    };

    return (
        <div style={{ marginBottom: "1rem" }}>
            {/* Collapsible header */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    background: open ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${open ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 10, padding: "0.5rem 0.75rem",
                    cursor: "pointer", transition: "all 0.2s",
                }}
                aria-label="Toggle playbook templates"
            >
                <BookOpen size={13} style={{ color: "#a78bfa", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: open ? "#a78bfa" : "#666",
                    letterSpacing: "0.07em", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
                    Playbook Templates
                </span>
                <span style={{ fontSize: 10, color: "#555" }}>
                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
            </button>

            {/* Template grid */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ paddingTop: 8 }}>
                            {error && (
                                <p style={{ fontSize: 11, color: "#f43f5e", marginBottom: 8 }}>{error}</p>
                            )}
                            {templates.length === 0 && !error && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 12, padding: "0.5rem 0" }}>
                                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                    Loading templates…
                                </div>
                            )}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
                                {templates.map(t => {
                                    const accentColor = CATEGORY_COLOR[t.category] ?? "#94a3b8";
                                    const isInstalled = installed[t.id];
                                    const isInstalling = installing[t.id];
                                    return (
                                        <motion.div
                                            key={t.id}
                                            whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                            style={{
                                                background: isInstalled ? `${accentColor}08` : "rgba(255,255,255,0.02)",
                                                border: `1px solid ${isInstalled ? accentColor + "30" : "rgba(255,255,255,0.07)"}`,
                                                borderTop: `2px solid ${accentColor}`,
                                                borderRadius: 10,
                                                padding: "0.75rem",
                                            }}
                                        >
                                            <div style={{ marginBottom: 6 }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>
                                                    {t.name}
                                                </p>
                                                <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
                                                    {t.description}
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                                    background: `${accentColor}12`, color: accentColor,
                                                    border: `1px solid ${accentColor}25`, textTransform: "uppercase" }}>
                                                    {t.category}
                                                </span>
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                                    color: RESOURCE_COLOR[t.resource_level] ?? "#94a3b8",
                                                    background: `${RESOURCE_COLOR[t.resource_level]}15`,
                                                    border: `1px solid ${RESOURCE_COLOR[t.resource_level]}25` }}>
                                                    {t.resource_level}
                                                </span>
                                                <span style={{ fontSize: 9, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
                                                    🕐 {cronLabel(t.cron)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => install(t)}
                                                disabled={isInstalling || isInstalled}
                                                aria-label={`Install ${t.name}`}
                                                style={{
                                                    width: "100%", display: "flex", alignItems: "center",
                                                    justifyContent: "center", gap: 6,
                                                    fontSize: 11, fontWeight: 700, padding: "5px 10px",
                                                    borderRadius: 7, cursor: isInstalling || isInstalled ? "not-allowed" : "pointer",
                                                    border: isInstalled
                                                        ? `1px solid ${accentColor}30`
                                                        : "1px solid rgba(255,255,255,0.1)",
                                                    background: isInstalled
                                                        ? `${accentColor}12`
                                                        : "rgba(255,255,255,0.05)",
                                                    color: isInstalled ? accentColor : "#aaa",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                {isInstalling ? (
                                                    <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Installing…</>
                                                ) : isInstalled ? (
                                                    <><CheckCircle2 size={11} /> Installed — enable in Routines</>
                                                ) : (
                                                    <><Plus size={11} /> Install Playbook</>
                                                )}
                                            </button>
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <p style={{ fontSize: 10, color: "#334155", marginTop: 8 }}>
                                Installed routines start <strong style={{ color: "#555" }}>paused</strong> — enable them in the Routines section above.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
