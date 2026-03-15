"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, LayoutTemplate, Settings2, X, ChevronRight, ChevronLeft,
    Loader2, Check, RotateCcw, Plus, Trash2, Clock, Bot, Zap,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentDef {
    id: string;
    name: string;
    emoji: string;
    specialization: string;
    personality: string;
    mission: string;
    context: string;
    constraints: string;
    features: Record<string, boolean>;
}

interface RoutineDef {
    name: string;
    description: string;
    cron: string;
    prompt: string;
    enabled: boolean;
}

interface Template {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    emoji: string;
}

type Tab = "guided" | "templates" | "advanced";
type GuidedStep = "describe" | "review-agent" | "review-routines" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
    content_creation: "Content Creation",
    image_generation: "Image Generation",
    shopify: "Shopify",
    search: "Web Search",
    memory: "Memory",
    brand_enforcement: "Brand Enforcement",
    business_context: "Business Context",
    email: "Email",
    google_workspace: "Google Workspace",
    moderation: "Moderation",
    design_intelligence: "Design Intelligence",
};

const CATEGORY_COLORS: Record<string, string> = {
    "Design":              "#ff6b9d",
    "Engineering":         "#4da6ff",
    "Marketing":           "#ff8c00",
    "Paid Media":          "#a855f7",
    "Product":             "#22c55e",
    "Project Management":  "#06b6d4",
    "Testing":             "#f59e0b",
    "Support":             "#10b981",
    "Specialized":         "#e879f9",
};

function getCategoryColor(category?: string): string {
    return CATEGORY_COLORS[category ?? ""] || "#6366f1";
}

function FeaturePill({ label, active }: { label: string; active: boolean }) {
    return (
        <span style={{
            display: "inline-block", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "2px 8px", borderRadius: 6,
            background: active ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.04)",
            border: active ? "1px solid rgba(255,140,0,0.3)" : "1px solid transparent",
            color: active ? "#ff8c00" : "#555",
        }}>{label}</span>
    );
}

// ── Guided Tab ─────────────────────────────────────────────────────────────────

function GuidedTab({ onCreated }: { onCreated: () => void }) {
    const [step, setStep] = useState<GuidedStep>("describe");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agent, setAgent] = useState<AgentDef | null>(null);
    const [routines, setRoutines] = useState<RoutineDef[]>([]);
    const [saving, setSaving] = useState(false);
    // Template match state
    const [matchedTemplate, setMatchedTemplate] = useState<{ slug: string; name: string; category: string; emoji: string } | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    const handleGenerate = async () => {
        if (!description.trim()) return;
        setLoading(true); setError(null); setMatchedTemplate(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/ai/build-agent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: description.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
            setAgent(data.agent);
            setRoutines(data.routines.map((r: any) => ({ ...r, enabled: true })));

            // If AI found a strong template match, load it and offer to swap
            if (data.template_slug) {
                setLoadingTemplate(true);
                try {
                    const tRes = await fetch(`${BOT_URL}/admin/agent-templates/${data.template_slug}`);
                    const tData = await tRes.json();
                    if (tRes.ok && tData.template) {
                        const t = tData.template;
                        setMatchedTemplate({ slug: t.slug, name: t.name, category: t.category, emoji: t.emoji ?? "🤖" });
                        // Pre-fill agent fields from the template (user can still edit)
                        setAgent(prev => prev ? {
                            ...prev,
                            emoji: t.emoji ?? prev.emoji,
                            specialization: t.description ?? prev.specialization,
                            mission: t.mission || prev.mission,
                            personality: t.personality || prev.personality,
                            context: t.context || prev.context,
                            constraints: t.constraints || prev.constraints,
                            features: t.features && Object.keys(t.features).length ? t.features : prev.features,
                        } : prev);
                    }
                } catch { /* template load failed silently — AI draft still valid */ } finally {
                    setLoadingTemplate(false);
                }
            }
            setStep("review-agent");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeploy = async () => {
        if (!agent) return;
        setSaving(true); setError(null);
        try {
            const catColor = matchedTemplate ? getCategoryColor(matchedTemplate.category) : undefined;
            const agentPayload = {
                ...agent,
                ...(matchedTemplate ? { category: matchedTemplate.category, color: catColor } : {}),
            };
            const agentRes = await fetch(`${BOT_URL}/admin/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(agentPayload),
            });
            if (!agentRes.ok) { const b = await agentRes.json(); throw new Error(b.error || "Failed to create agent"); }

            for (const r of routines.filter(r => r.enabled)) {
                await fetch(`${BOT_URL}/admin/routines`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...r, agent_id: agent.id, enabled: true, report_to_discord: false }),
                });
            }
            setStep("done");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setStep("describe"); setDescription(""); setAgent(null);
        setRoutines([]); setError(null); setMatchedTemplate(null);
    };

    const catColor = matchedTemplate ? getCategoryColor(matchedTemplate.category) : "#ff8c00";

    if (step === "done") return (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <Check size={24} color="var(--accent-emerald)" />
            </div>
            <p className="has-text-white has-text-weight-black" style={{ fontSize: 18, marginBottom: 6 }}>
                {agent?.emoji} {agent?.name} is live!
            </p>
            <p className="has-text-grey" style={{ fontSize: 12, marginBottom: "1.5rem" }}>
                Agent deployed with {routines.filter(r => r.enabled).length} routine{routines.filter(r => r.enabled).length !== 1 ? "s" : ""} scheduled.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={handleReset} className="button is-dark is-small">Create Another</button>
                <button onClick={onCreated} className="button is-small" style={{ background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.3)", color: "#ff8c00" }}>View Agents</button>
            </div>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Step indicator */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {(["describe", "review-agent", "review-routines"] as GuidedStep[]).map((s, i) => {
                    const labels = ["Describe", "Review Agent", "Review Routines"];
                    const isDone = ["describe", "review-agent", "review-routines"].indexOf(step) > i;
                    const isCurrent = step === s;
                    return (
                        <React.Fragment key={s}>
                            <span style={{
                                fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                                padding: "3px 9px", borderRadius: 6,
                                background: isCurrent ? `${catColor}22` : isDone ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)",
                                color: isCurrent ? catColor : isDone ? "var(--accent-emerald)" : "#444",
                                border: isCurrent ? `1px solid ${catColor}50` : "1px solid transparent",
                            }}>
                                {isDone ? "✓ " : ""}{labels[i]}
                            </span>
                            {i < 2 && <ChevronRight size={12} color="#333" />}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step 1: Describe */}
            {step === "describe" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    <div>
                        <p className="has-text-white has-text-weight-bold" style={{ fontSize: 15, marginBottom: 4 }}>What do you need this agent to do?</p>
                        <p className="has-text-grey" style={{ fontSize: 12 }}>Describe it in plain English. The AI will design the agent and suggest routines — and will try to match an existing template if one fits.</p>
                    </div>
                    <textarea
                        autoFocus
                        rows={5}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="e.g. I need an agent that monitors our Shopify store every morning and sends me a summary of yesterday's sales, top-selling products, and any orders with issues. It should also flag anything unusual."
                        style={{
                            width: "100%", padding: "0.75rem", resize: "vertical",
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 10, color: "#fff", fontSize: 13, lineHeight: 1.6,
                            outline: "none", boxSizing: "border-box",
                        }}
                    />
                    {error && <p style={{ color: "#ef4444", fontSize: 12 }}>⚠️ {error}</p>}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !description.trim()}
                        className="button"
                        style={{ background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.35)", color: "#ff8c00", fontWeight: 800, alignSelf: "flex-start" }}
                    >
                        {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Designing agent…</> : <><Sparkles size={14} style={{ marginRight: 6 }} />Design with AI</>}
                    </button>
                </div>
            )}

            {/* Step 2: Review Agent */}
            {step === "review-agent" && agent && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {/* Template match banner */}
                    {loadingTemplate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.6rem 0.875rem", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "#555" }} />
                            <span style={{ fontSize: 12, color: "#555" }}>Checking for matching templates…</span>
                        </div>
                    )}
                    {matchedTemplate && !loadingTemplate && (
                        <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: `${catColor}10`, border: `1px solid ${catColor}35`, display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22, flexShrink: 0 }}>{matchedTemplate.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.07em", color: catColor, background: `${catColor}18`, border: `1px solid ${catColor}35`, borderRadius: 4, padding: "1px 6px" }}>Template Match</span>
                                    <p style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{matchedTemplate.name}</p>
                                </div>
                                <p style={{ fontSize: 11, color: "#888" }}>Fields pre-filled from this template. Edit below as needed.</p>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 36 }}>{agent.emoji}</span>
                        <div>
                            <input
                                value={agent.name}
                                onChange={e => setAgent(a => a ? { ...a, name: e.target.value } : a)}
                                className="input is-small"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 800, fontSize: 16, width: 280 }}
                            />
                            <p className="has-text-grey" style={{ fontSize: 11, marginTop: 3 }}>{agent.specialization}</p>
                        </div>
                    </div>

                    {[
                        { label: "Mission", key: "mission" as keyof AgentDef },
                        { label: "Personality & Tone", key: "personality" as keyof AgentDef },
                        { label: "Operational Context", key: "context" as keyof AgentDef },
                        { label: "Constraints", key: "constraints" as keyof AgentDef },
                    ].map(({ label, key }) => (
                        <div key={key}>
                            <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", display: "block", marginBottom: 4 }}>{label}</label>
                            <textarea
                                rows={2}
                                value={agent[key] as string}
                                onChange={e => setAgent(a => a ? { ...a, [key]: e.target.value } : a)}
                                style={{ width: "100%", padding: "0.5rem 0.75rem", resize: "vertical", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#ccc", fontSize: 12, lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                    ))}

                    <div>
                        <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", display: "block", marginBottom: 6 }}>Features</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                                <button key={key} onClick={() => setAgent(a => a ? { ...a, features: { ...a.features, [key]: !a.features[key] } } : a)}
                                    style={{ all: "unset", cursor: "pointer" }}>
                                    <FeaturePill label={label} active={!!agent.features[key]} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p style={{ color: "#ef4444", fontSize: 12 }}>⚠️ {error}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setStep("describe")} className="button is-dark is-small"><ChevronLeft size={13} style={{ marginRight: 4 }} />Back</button>
                        <button onClick={() => setStep("review-routines")} className="button is-small" style={{ background: `${catColor}18`, border: `1px solid ${catColor}40`, color: catColor, fontWeight: 800 }}>
                            Review Routines <ChevronRight size={13} style={{ marginLeft: 4 }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Review Routines */}
            {step === "review-routines" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    <div>
                        <p className="has-text-white has-text-weight-bold" style={{ fontSize: 14, marginBottom: 3 }}>Suggested Routines</p>
                        <p className="has-text-grey" style={{ fontSize: 12 }}>Toggle off routines you don't want. You can always add more later.</p>
                    </div>

                    {routines.map((r, i) => (
                        <div key={i} style={{
                            background: r.enabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                            border: `1px solid ${r.enabled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
                            borderRadius: 10, padding: "0.875rem",
                            opacity: r.enabled ? 1 : 0.5, transition: "all 0.2s",
                        }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <button
                                    onClick={() => setRoutines(rs => rs.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}
                                    style={{
                                        all: "unset", cursor: "pointer", width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                                        background: r.enabled ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)",
                                        border: r.enabled ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.1)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                >{r.enabled && <Check size={11} color="var(--accent-emerald)" />}</button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                        <input
                                            value={r.name}
                                            onChange={e => setRoutines(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                            style={{ all: "unset", fontWeight: 800, fontSize: 13, color: "#fff", width: "100%" }}
                                        />
                                        <code style={{ fontSize: 10, color: "#555", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 5, flexShrink: 0 }}>{r.cron}</code>
                                    </div>
                                    <p className="has-text-grey" style={{ fontSize: 11, marginBottom: 6 }}>{r.description}</p>
                                    <textarea
                                        rows={3}
                                        value={r.prompt}
                                        onChange={e => setRoutines(rs => rs.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))}
                                        style={{ width: "100%", padding: "0.4rem 0.6rem", resize: "vertical", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, color: "#aaa", fontSize: 11, lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {error && <p style={{ color: "#ef4444", fontSize: 12 }}>⚠️ {error}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setStep("review-agent")} className="button is-dark is-small"><ChevronLeft size={13} style={{ marginRight: 4 }} />Back</button>
                        <button onClick={handleDeploy} disabled={saving} className="button is-small" style={{ background: `${catColor}18`, border: `1px solid ${catColor}40`, color: catColor, fontWeight: 800 }}>
                            {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Deploying…</> : <><Zap size={13} style={{ marginRight: 6 }} />Deploy Agent + {routines.filter(r => r.enabled).length} Routine{routines.filter(r => r.enabled).length !== 1 ? "s" : ""}</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

// ── Templates Tab ─────────────────────────────────────────────────────────────


function TemplatesTab({ onCreated }: { onCreated: () => void }) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [grouped, setGrouped] = useState<Record<string, Template[]>>({});
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Template | null>(null);
    const [fullTemplate, setFullTemplate] = useState<any | null>(null);
    const [loadingFull, setLoadingFull] = useState(false);
    const [agentName, setAgentName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${BOT_URL}/admin/agent-templates`)
            .then(r => r.json())
            .then(d => { setTemplates(d.templates ?? []); setGrouped(d.grouped ?? {}); })
            .catch(() => setTemplates([]))
            .finally(() => setLoading(false));
    }, []);

    const handleSelect = async (t: Template) => {
        setSelected(t);
        setAgentName(t.name);
        setLoadingFull(true);
        setFullTemplate(null);
        setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/agent-templates/${t.slug}`);
            const d = await res.json();
            setFullTemplate(d.template);
        } catch {
            setError("Failed to load template details");
        } finally {
            setLoadingFull(false);
        }
    };

    const handleDeploy = async () => {
        if (!fullTemplate || !agentName.trim()) return;
        setSaving(true); setError(null);
        try {
            const id = agentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
            const catColor = getCategoryColor(selected?.category);
            const res = await fetch(`${BOT_URL}/admin/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    name: agentName.trim(),
                    emoji: fullTemplate.emoji || selected?.emoji || "🤖",
                    specialization: fullTemplate.specialization || selected?.description || "",
                    personality: fullTemplate.personality || "",
                    mission: fullTemplate.mission || fullTemplate.description || "",
                    context: fullTemplate.context || "",
                    constraints: fullTemplate.constraints || "",
                    features: fullTemplate.features || {},
                    type: "specialized",
                    category: selected?.category,
                    color: catColor,
                }),
            });
            if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed to create agent"); }
            setSaved(true);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: 8, color: "#555" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading templates…</span>
        </div>
    );

    if (saved) return (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <Check size={24} color="var(--accent-emerald)" />
            </div>
            <p className="has-text-white has-text-weight-black" style={{ fontSize: 18, marginBottom: 6 }}>
                {selected?.emoji} {agentName} deployed!
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: "1.5rem" }}>
                <button onClick={() => { setSaved(false); setSelected(null); setFullTemplate(null); }} className="button is-dark is-small">Use Another Template</button>
                <button onClick={onCreated} className="button is-small" style={{ background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.3)", color: "#ff8c00" }}>View Agents</button>
            </div>
        </div>
    );

    if (selected && fullTemplate) {
        const catColor = getCategoryColor(selected.category);
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <button onClick={() => { setSelected(null); setFullTemplate(null); }} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
                <ChevronLeft size={13} /> Back to templates
            </button>
            {/* Category color header strip */}
            <div style={{ borderRadius: 10, border: `1px solid ${catColor}40`, background: `${catColor}10`, padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36 }}>{selected.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <input
                            value={agentName}
                            onChange={e => setAgentName(e.target.value)}
                            placeholder="Agent name"
                            className="input is-small"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 800, fontSize: 14 }}
                        />
                        <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.07em", color: catColor, background: `${catColor}18`, border: `1px solid ${catColor}35`, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{selected.category}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#999" }}>{selected.description}</p>
                </div>
            </div>
            {fullTemplate.mission && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem" }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 4 }}>Mission</p>
                    <p style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>{fullTemplate.mission}</p>
                </div>
            )}
            {fullTemplate.features && Object.keys(fullTemplate.features).length > 0 && (
                <div>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#555", marginBottom: 6 }}>Features</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {Object.entries(fullTemplate.features).filter(([, v]) => v).map(([k]) => (
                            <FeaturePill key={k} label={FEATURE_LABELS[k] ?? k} active />
                        ))}
                    </div>
                </div>
            )}
            {error && <p style={{ color: "#ef4444", fontSize: 12 }}>⚠️ {error}</p>}
            <button onClick={handleDeploy} disabled={saving || !agentName.trim()} className="button" style={{ background: `${catColor}18`, border: `1px solid ${catColor}40`, color: catColor, fontWeight: 800, alignSelf: "flex-start" }}>
                {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Deploying…</> : <><Zap size={13} style={{ marginRight: 6 }} />Deploy {agentName || "Agent"}</>}
            </button>
        </div>
    );}

    if (selected && loadingFull) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", gap: 8, color: "#555" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading template…</span>
        </div>
    );

    if (templates.length === 0) return (
        <div style={{ textAlign: "center", padding: "3rem", color: "#555" }}>
            <LayoutTemplate size={28} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>No templates available yet.</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Templates are added via the agent_templates table in Supabase.</p>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {Object.entries(grouped).map(([cat, items]) => {
                const catColor = getCategoryColor(cat);
                return (
                <div key={cat}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 3, height: 14, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                        <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: catColor }}>{cat}</p>
                    </div>
                    <div className="columns is-multiline" style={{ rowGap: "0.5rem" }}>
                        {items.map(t => (
                            <div key={t.slug} className="column is-6">
                                <button onClick={() => handleSelect(t)} style={{
                                    all: "unset", cursor: "pointer", display: "block", width: "100%",
                                    background: `${catColor}08`,
                                    border: `1px solid ${catColor}30`,
                                    borderTop: `3px solid ${catColor}`,
                                    borderRadius: 10, padding: "0.875rem",
                                    transition: "all 0.15s", boxSizing: "border-box",
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${catColor}14`; e.currentTarget.style.borderColor = `${catColor}60`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${catColor}08`; e.currentTarget.style.borderColor = `${catColor}30`; }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 22 }}>{t.emoji}</span>
                                        <p style={{ fontWeight: 800, fontSize: 13, color: "#fff" }}>{t.name}</p>
                                    </div>
                                    <p style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{t.description}</p>
                                    <p style={{ fontSize: 10, color: catColor, marginTop: 6, fontWeight: 700 }}>Use template →</p>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );})}
        </div>
    );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

interface AgentWizardProps {
    onClose: () => void;
    onCreated: () => void;
    /** If provided, drop straight into the Advanced tab with existing agent data for editing */
    existingAgent?: any;
    AdvancedForm: React.ComponentType<{ existingAgent?: any; onSaved: () => void }>;
}

export function AgentWizard({ onClose, onCreated, existingAgent, AdvancedForm }: AgentWizardProps) {
    const defaultTab: Tab = existingAgent ? "advanced" : "guided";
    const [tab, setTab] = useState<Tab>(defaultTab);

    const tabs: { id: Tab; label: string; icon: React.ReactNode; tip: string }[] = [
        { id: "guided", label: "Guided", icon: <Sparkles size={13} />, tip: "AI designs the agent for you" },
        { id: "templates", label: "Templates", icon: <LayoutTemplate size={13} />, tip: "Start from a pre-built blueprint" },
        { id: "advanced", label: "Advanced", icon: <Settings2 size={13} />, tip: "Full manual control" },
    ];

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={e => e.stopPropagation()}
                style={{
                    background: "#0e0e18", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 18, width: "100%", maxWidth: 620,
                    maxHeight: "92vh", display: "flex", flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Bot size={16} color="var(--accent-orange)" />
                        <p className="has-text-white has-text-weight-black" style={{ fontSize: 15 }}>
                            {existingAgent ? `Edit Agent` : "Create New Agent"}
                        </p>
                    </div>
                    <button onClick={onClose} className="delete" />
                </div>

                {/* Tab bar */}
                {!existingAgent && (
                    <div style={{ display: "flex", padding: "0.75rem 1.5rem 0", gap: 4, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)} title={t.tip} style={{
                                all: "unset", cursor: "pointer",
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "8px 14px", fontSize: 12, fontWeight: 700,
                                borderBottom: tab === t.id ? "2px solid #ff8c00" : "2px solid transparent",
                                color: tab === t.id ? "#ff8c00" : "#555",
                                transition: "all 0.15s", marginBottom: -1,
                            }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
                    <AnimatePresence mode="wait">
                        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                            {tab === "guided" && <GuidedTab onCreated={() => { onCreated(); onClose(); }} />}
                            {tab === "templates" && <TemplatesTab onCreated={() => { onCreated(); onClose(); }} />}
                            {tab === "advanced" && <AdvancedForm existingAgent={existingAgent} onSaved={() => { onCreated(); onClose(); }} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
