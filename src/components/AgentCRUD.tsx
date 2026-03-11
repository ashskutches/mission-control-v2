"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Plus, Trash2, Hash, ShieldCheck, Cpu, RefreshCcw,
    CheckCircle2, XCircle, Target, Sparkles, Globe, ShieldAlert,
    ChevronDown, ChevronUp, Library, X, Zap, Image as ImageIcon,
    Palette, FileText, BarChart2, Search, Layers,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ──────────────────────────────────────────────────────────────
interface AgentDef {
    id: string;
    name: string;
    type: string;
    specialization: string;
    discordChannelId: string;
    features: Record<string, boolean>;
    personality?: string;
    mission?: string;
    context?: string;
    constraints?: string;
    emoji?: string;
}

interface AgentTemplate {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    emoji: string;
    source_url: string;
}

// ── Constants ──────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
    "Design": "🎨",
    "Engineering": "⚙️",
    "Marketing": "📢",
    "Paid Media": "💰",
    "Product": "📦",
    "Project Management": "📋",
    "Testing": "🧪",
    "Support": "🛟",
    "Specialized": "🎯",
};

const CATEGORY_COLORS: Record<string, string> = {
    "Design": "#ff6b9d",
    "Engineering": "#4da6ff",
    "Marketing": "#ff8c00",
    "Paid Media": "#a855f7",
    "Product": "#22c55e",
    "Project Management": "#06b6d4",
    "Testing": "#f59e0b",
    "Support": "#10b981",
    "Specialized": "#e879f9",
};

const ALL_FEATURES = [
    { id: "shopify", label: "Shopify", icon: Cpu, description: "Live store data access" },
    { id: "search", label: "Web Search", icon: Globe, description: "Real-time web research" },
    { id: "memory", label: "Long-term Memory", icon: ShieldCheck, description: "Remembers across sessions" },
    { id: "business_context", label: "Brand Guide", icon: FileText, description: "Access to brand context" },
    { id: "design_intelligence", label: "Design Intelligence", icon: ImageIcon, description: "AI-enhanced DALL-E prompts" },
    { id: "content_intelligence", label: "Content Intelligence", icon: Sparkles, description: "Expert copywriting mode" },
    { id: "brand_enforcement", label: "Brand Enforcement", icon: Palette, description: "Inject brand colors/voice to images" },
];

const PRIMING_FIELDS = [
    { id: "personality", label: "Personality & Tone", icon: Sparkles, placeholder: "e.g. Direct, no-nonsense, uses dry humour." },
    { id: "mission", label: "Primary Mission", icon: Target, placeholder: "e.g. Handle customer support for the Shopify store." },
    { id: "context", label: "Operational Context", icon: Brain, placeholder: "e.g. Deployed in #ecom-support Discord channel." },
    { id: "constraints", label: "Constraints", icon: ShieldAlert, placeholder: "e.g. NEVER share revenue figures." },
];

const EMOJI_PRESETS = ["🤖", "🛡️", "🎯", "🔍", "📊", "🚨", "⚙️", "📦", "💬", "🔔", "🗺️", "🧠", "🎨", "📢", "💰", "🧪", "🛟", "📋"];

function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const blank: Partial<AgentDef> = {
    name: "", discordChannelId: "", type: "worker",
    specialization: "General Tasks", features: {},
    personality: "", mission: "", context: "", constraints: "", emoji: "🤖",
};

// ── Agent Setup Modal (shared by Scratch + Template) ───────────────────
function AgentSetupModal({
    initial,
    templateInfo,
    onClose,
    onSaved,
}: {
    initial: Partial<AgentDef>;
    templateInfo?: { name: string; description: string; category: string; system_prompt: string; emoji: string };
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState<Partial<AgentDef>>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const set = (k: keyof AgentDef, v: any) => setForm(p => ({ ...p, [k]: v }));
    const toggleFeature = (id: string) => setForm(p => ({
        ...p,
        features: { ...p.features, [id]: !p.features?.[id] }
    }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const id = `agent-${Date.now()}`;
        const payload = {
            id,
            ...form,
            mission: templateInfo ? templateInfo.system_prompt.slice(0, 3000) : form.mission,
        };
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Server error ${res.status}`);
            }
            onSaved();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
        }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{
                    background: "#12121a", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16, width: "100%", maxWidth: 560,
                    maxHeight: "90vh", overflowY: "auto", padding: "1.5rem",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
                    <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                        <span style={{ fontSize: 28 }}>{form.emoji ?? "🤖"}</span>
                        <div>
                            <p className="has-text-weight-black is-size-6">
                                {templateInfo ? `Spawn: ${templateInfo.name}` : "New Agent"}
                            </p>
                            {templateInfo && (
                                <p className="is-size-7 has-text-grey">{templateInfo.category} · {templateInfo.description?.slice(0, 80)}</p>
                            )}
                        </div>
                    </div>
                    <button className="delete" onClick={onClose} />
                </div>

                <form onSubmit={handleSave}>
                    {/* Emoji picker */}
                    <div className="mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>Icon</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {EMOJI_PRESETS.map(e => (
                                <button key={e} type="button"
                                    onClick={() => set("emoji", e)}
                                    style={{
                                        fontSize: 20, padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                                        background: form.emoji === e ? "rgba(255,140,0,0.2)" : "rgba(255,255,255,0.05)",
                                        border: form.emoji === e ? "1px solid rgba(255,140,0,0.5)" : "1px solid transparent",
                                    }}
                                >{e}</button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Display Name
                        </label>
                        <input
                            className="input" required
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                            placeholder="e.g. Social Media Manager"
                            value={form.name ?? ""}
                            onChange={e => {
                                set("name", e.target.value);
                                set("specialization", e.target.value);
                            }}
                        />
                    </div>

                    {/* Codename */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Codename <span className="has-text-grey" style={{ fontWeight: 400, textTransform: "none" }}>· auto-generated from name</span>
                        </label>
                        <div className="field has-addons mb-0">
                            <div className="control" style={{ flex: 1 }}>
                                <input
                                    className="input is-family-monospace"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#aaa" }}
                                    placeholder="auto-generated"
                                    value={form.id && !form.id.startsWith("agent-") ? form.id : slugify(form.name ?? "")}
                                    readOnly
                                />
                            </div>
                        </div>
                        <p className="is-size-7 has-text-grey mt-1">Used as the agent's internal identifier</p>
                    </div>

                    {/* Discord Channel ID */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Discord Channel ID
                        </label>
                        <div className="control has-icons-left">
                            <input
                                className="input"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                                placeholder="e.g. 1234567890123456789"
                                value={form.discordChannelId ?? ""}
                                onChange={e => set("discordChannelId", e.target.value)}
                            />
                            <span className="icon is-left has-text-grey"><Hash size={14} /></span>
                        </div>
                        <p className="is-size-7 has-text-grey mt-1">Right-click a Discord channel → Copy Channel ID</p>
                    </div>

                    {/* Feature Allocation */}
                    <div className="mb-4">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-2" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Feature Allocation
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {ALL_FEATURES.map(feat => {
                                const Icon = feat.icon;
                                const active = !!form.features?.[feat.id];
                                return (
                                    <button
                                        key={feat.id}
                                        type="button"
                                        onClick={() => toggleFeature(feat.id)}
                                        style={{
                                            textAlign: "left", padding: "8px 10px", borderRadius: 8,
                                            background: active ? "rgba(255,140,0,0.1)" : "rgba(255,255,255,0.03)",
                                            border: active ? "1px solid rgba(255,140,0,0.4)" : "1px solid rgba(255,255,255,0.07)",
                                            cursor: "pointer", transition: "all 0.15s",
                                        }}
                                    >
                                        <div className="is-flex is-align-items-center" style={{ gap: 6 }}>
                                            <Icon size={12} style={{ color: active ? "var(--accent-orange, #ff8c00)" : "#666", flexShrink: 0 }} />
                                            <span className="is-size-7 has-text-weight-bold" style={{ color: active ? "#fff" : "#888" }}>{feat.label}</span>
                                        </div>
                                        <p className="is-size-7" style={{ color: "#555", marginTop: 2, paddingLeft: 18 }}>{feat.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Advanced (mission, personality, etc.) — collapsed by default for template spawn */}
                    {!templateInfo && (
                        <div className="mb-4">
                            <button
                                type="button"
                                className="is-flex is-align-items-center is-size-7 has-text-grey"
                                style={{ gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                onClick={() => setShowAdvanced(p => !p)}
                            >
                                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Advanced Priming {showAdvanced ? "" : "(optional)"}
                            </button>
                            {showAdvanced && (
                                <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {PRIMING_FIELDS.map(f => {
                                        const Icon = f.icon;
                                        return (
                                            <div key={f.id}>
                                                <div className="is-flex is-align-items-center mb-1" style={{ gap: 6 }}>
                                                    <Icon size={12} className="has-text-grey" />
                                                    <label className="is-size-7 has-text-grey-light has-text-weight-bold">{f.label}</label>
                                                </div>
                                                <textarea
                                                    className="textarea is-small" rows={2}
                                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", resize: "vertical" }}
                                                    placeholder={f.placeholder}
                                                    value={(form as any)[f.id] ?? ""}
                                                    onChange={e => set(f.id as keyof AgentDef, e.target.value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {error && <p className="help is-danger mb-3">{error}</p>}

                    <div className="is-flex" style={{ gap: "0.75rem" }}>
                        <button type="button" className="button is-dark is-fullwidth" onClick={onClose}>Cancel</button>
                        <button type="submit" className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}>
                            {templateInfo ? `✨ Spawn ${templateInfo.name}` : "Create Agent"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────
export const AgentCRUD = () => {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [templates, setTemplates] = useState<AgentTemplate[]>([]);
    const [templatesGrouped, setTemplatesGrouped] = useState<Record<string, AgentTemplate[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"roster" | "templates">("roster");
    const [templateSearch, setTemplateSearch] = useState("");
    const [templateCategory, setTemplateCategory] = useState<string | null>(null);
    const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});

    // Modal state
    const [modal, setModal] = useState<{
        open: boolean;
        initial: Partial<AgentDef>;
        templateInfo?: { name: string; description: string; category: string; system_prompt: string; emoji: string };
    }>({ open: false, initial: blank });

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`);
            const data = await res.json();
            setAgents(data.agents ?? []);
        } catch { setError("Could not connect to bot API."); }
    }, []);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agent-templates`);
            const data = await res.json();
            setTemplates(data.templates ?? []);
            setTemplatesGrouped(data.grouped ?? {});
        } catch { /* templates optional */ }
    }, []);

    useEffect(() => {
        Promise.all([fetchAgents(), fetchTemplates()]).finally(() => setLoading(false));
    }, [fetchAgents, fetchTemplates]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this agent?")) return;
        await fetch(`${BOT_URL}/admin/agents/${id}`, { method: "DELETE" });
        fetchAgents();
    };

    const openScratch = () => setModal({ open: true, initial: { ...blank } });

    const openFromTemplate = async (t: AgentTemplate) => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agent-templates/${t.slug}`);
            const { template: full } = await res.json();
            setModal({
                open: true,
                initial: {
                    ...blank,
                    name: full.name,
                    specialization: full.category,
                    emoji: full.emoji ?? CATEGORY_EMOJI[full.category] ?? "🤖",
                },
                templateInfo: {
                    name: full.name,
                    description: full.description,
                    category: full.category,
                    system_prompt: full.system_prompt,
                    emoji: full.emoji ?? CATEGORY_EMOJI[full.category] ?? "🤖",
                },
            });
        } catch { setError("Could not load template."); }
    };

    const onSaved = () => {
        setModal({ open: false, initial: blank });
        fetchAgents();
    };

    const filteredTemplates = templates.filter(t => {
        const matchCat = !templateCategory || t.category === templateCategory;
        const matchSearch = !templateSearch ||
            t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
            t.description?.toLowerCase().includes(templateSearch.toLowerCase());
        return matchCat && matchSearch;
    });

    const filteredGrouped: Record<string, AgentTemplate[]> = {};
    for (const t of filteredTemplates) {
        if (!filteredGrouped[t.category]) filteredGrouped[t.category] = [];
        filteredGrouped[t.category]!.push(t);
    }

    return (
        <div>
            {/* ── Tab Bar ── */}
            <div className="is-flex is-align-items-center is-justify-content-space-between mb-4">
                <div className="tabs is-small mb-0" style={{ flex: 1 }}>
                    <ul style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <li className={activeTab === "roster" ? "is-active" : ""}>
                            <a onClick={() => setActiveTab("roster")} style={{ borderBottomColor: activeTab === "roster" ? "var(--accent-orange, #ff8c00)" : "transparent" }}>
                                <span className="icon is-small"><Brain size={14} /></span>
                                <span>Agent Roster ({agents.length})</span>
                            </a>
                        </li>
                        <li className={activeTab === "templates" ? "is-active" : ""}>
                            <a onClick={() => setActiveTab("templates")} style={{ borderBottomColor: activeTab === "templates" ? "var(--accent-orange, #ff8c00)" : "transparent" }}>
                                <span className="icon is-small"><Library size={14} /></span>
                                <span>Template Library ({templates.length})</span>
                            </a>
                        </li>
                    </ul>
                </div>
                <button className="button is-warning is-small ml-3" onClick={openScratch}>
                    <span className="icon"><Plus size={14} /></span>
                    <span>New Agent</span>
                </button>
            </div>

            {error && <p className="help is-danger mb-3">{error}</p>}

            {/* ── Roster Tab ── */}
            {activeTab === "roster" && (
                <div>
                    {loading && <p className="has-text-grey is-size-7 has-text-centered py-6">Loading agents...</p>}
                    {!loading && agents.length === 0 && (
                        <div className="has-text-centered py-6">
                            <p className="has-text-grey is-size-7 mb-3">No agents yet. Create one from scratch or spawn from a template.</p>
                            <div className="is-flex is-justify-content-center" style={{ gap: "0.75rem" }}>
                                <button className="button is-warning is-small" onClick={openScratch}>
                                    <span className="icon"><Plus size={14} /></span><span>From Scratch</span>
                                </button>
                                <button className="button is-dark is-small" onClick={() => setActiveTab("templates")}>
                                    <span className="icon"><Library size={14} /></span><span>Browse Templates</span>
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="columns is-multiline">
                        {agents.map(agent => {
                            const isOpen = !!expandedAgents[agent.id];
                            const activeFeatures = Object.entries(agent.features ?? {}).filter(([, v]) => v);
                            return (
                                <div key={agent.id} className="column is-12 is-6-desktop">
                                    <div className="box" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", padding: "1rem" }}>
                                        <div className="is-flex is-align-items-center is-justify-content-space-between">
                                            <div className="is-flex is-align-items-center" style={{ gap: "0.6rem", flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: 22, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <p className="has-text-weight-black is-size-7 text-truncate">{agent.name}</p>
                                                    <p className="has-text-grey" style={{ fontSize: 11 }}>{agent.specialization}</p>
                                                </div>
                                            </div>
                                            <div className="is-flex is-align-items-center" style={{ gap: 6, flexShrink: 0 }}>
                                                {activeFeatures.length > 0 && (
                                                    <span className="tag is-dark is-small" style={{ fontSize: 10 }}>{activeFeatures.length} features</span>
                                                )}
                                                <button className="button is-small is-dark" onClick={() => setExpandedAgents(p => ({ ...p, [agent.id]: !isOpen }))}>
                                                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </button>
                                                <button className="button is-small is-danger is-light" onClick={() => handleDelete(agent.id)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        {isOpen && (
                                            <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
                                                {agent.discordChannelId && (
                                                    <p className="is-size-7 has-text-grey mb-2">
                                                        <Hash size={10} style={{ display: "inline", marginRight: 4 }} />
                                                        {agent.discordChannelId}
                                                    </p>
                                                )}
                                                {agent.mission && (
                                                    <p className="is-size-7 has-text-grey mb-2" style={{ lineHeight: 1.5 }}>
                                                        <Target size={10} style={{ display: "inline", marginRight: 4 }} />
                                                        {agent.mission.slice(0, 150)}{agent.mission.length > 150 ? "..." : ""}
                                                    </p>
                                                )}
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                                                    {ALL_FEATURES.map(f => (
                                                        <span key={f.id} className="tag is-small" style={{
                                                            background: agent.features?.[f.id] ? "rgba(255,140,0,0.15)" : "rgba(255,255,255,0.04)",
                                                            color: agent.features?.[f.id] ? "#ff8c00" : "#555",
                                                            border: `1px solid ${agent.features?.[f.id] ? "rgba(255,140,0,0.3)" : "rgba(255,255,255,0.06)"}`,
                                                        }}>
                                                            {f.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Templates Tab ── */}
            {activeTab === "templates" && (
                <div>
                    {/* Search + filter */}
                    <div className="is-flex mb-4" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                        <div className="control has-icons-left" style={{ flex: 1, minWidth: 180 }}>
                            <input
                                className="input is-small"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                                placeholder="Search templates..."
                                value={templateSearch}
                                onChange={e => setTemplateSearch(e.target.value)}
                            />
                            <span className="icon is-left has-text-grey"><Search size={14} /></span>
                        </div>
                        <div className="is-flex" style={{ gap: 4, flexWrap: "wrap" }}>
                            <button className={`button is-small ${!templateCategory ? "is-warning" : "is-dark"}`} onClick={() => setTemplateCategory(null)}>All</button>
                            {Object.keys(templatesGrouped).sort().map(cat => (
                                <button
                                    key={cat}
                                    className={`button is-small ${templateCategory === cat ? "is-warning" : "is-dark"}`}
                                    style={{ borderLeft: `3px solid ${CATEGORY_COLORS[cat] ?? "#888"}` }}
                                    onClick={() => setTemplateCategory(p => p === cat ? null : cat)}
                                >{CATEGORY_EMOJI[cat]} {cat}</button>
                            ))}
                        </div>
                    </div>

                    {templates.length === 0 && (
                        <p className="has-text-grey is-size-7 has-text-centered py-6">No templates loaded.</p>
                    )}

                    {Object.entries(filteredGrouped).sort().map(([category, catTemplates]) => (
                        <div key={category} className="mb-5">
                            <p className="is-size-7 is-uppercase has-text-weight-black mb-3"
                                style={{ letterSpacing: "0.1em", color: CATEGORY_COLORS[category] ?? "#888", borderBottom: `1px solid ${CATEGORY_COLORS[category] ?? "#888"}22`, paddingBottom: 6 }}>
                                {CATEGORY_EMOJI[category]} {category} · {catTemplates.length} agents
                            </p>
                            <div className="columns is-multiline">
                                {catTemplates.map(t => (
                                    <div key={t.slug} className="column is-4-desktop is-6-tablet">
                                        <div className="box" style={{
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            height: "100%", display: "flex", flexDirection: "column", padding: "0.85rem",
                                            transition: "border-color 0.2s",
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.borderColor = CATEGORY_COLORS[category] ?? "#555")}
                                            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
                                        >
                                            <div className="is-flex is-align-items-center mb-2" style={{ gap: 6 }}>
                                                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                                                <p className="has-text-weight-black is-size-7">{t.name}</p>
                                            </div>
                                            <p className="has-text-grey is-size-7 mb-3" style={{ flex: 1, lineHeight: 1.5, fontSize: 11 }}>
                                                {t.description?.slice(0, 100)}{(t.description?.length ?? 0) > 100 ? "..." : ""}
                                            </p>
                                            <button
                                                className="button is-small is-warning is-fullwidth"
                                                onClick={() => openFromTemplate(t)}
                                            >
                                                <Zap size={12} style={{ marginRight: 6 }} />
                                                Use Template
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Setup Modal ── */}
            <AnimatePresence>
                {modal.open && (
                    <AgentSetupModal
                        initial={modal.initial}
                        templateInfo={modal.templateInfo}
                        onClose={() => setModal(p => ({ ...p, open: false }))}
                        onSaved={onSaved}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
