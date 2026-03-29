"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Plus, Trash2, Hash, ShieldCheck, Cpu, RefreshCcw,
    CheckCircle2, XCircle, Target, Sparkles, Globe, ShieldAlert,
    ChevronDown, ChevronUp, Library, X, Zap, Image as ImageIcon,
    Palette, FileText, BarChart2, Search, Layers, Pencil, Mail, AlignJustify, ArrowRight,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { AgentWizard } from "@/components/AgentWizard";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ──────────────────────────────────────────────────────────────
interface AgentDef {
    id: string;
    name: string;
    type: string;
    specialization: string;
    discordChannelId: string;
    discordManagerId?: string;
    skills?: string[];     // Skill tier bundles — gates tool access
    role?: string;         // Role preset used to assign skills
    personality?: string;
    mission?: string;
    context?: string;
    constraints?: string;
    emoji?: string;
    color?: string;
    category?: string;
}

interface DiscordMember {
    id: string; username: string; displayName: string; avatar: string;
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
    "Support": "🛀",
    "Specialized": "🎯",
    "Influencing": "🌟",
    "Organics": "🌱",
    "General": "🤖",
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
    "Influencing": "#f43f5e",
    "Organics": "#84cc16",
    "General": "#6366f1",
};

// Keywords → department mapping for agents that lack a category field
const SPECIALIZATION_TO_CATEGORY: [RegExp, string][] = [
    [/seo|search engine|content market|blog|keyword|organic/i, "Organics"],
    [/reddit|grayhat|grey.?hat|forum|community post|upvot/i, "Organics"],
    [/influenc|ugc|creator|tiktok|instagram|youtube|collab|partnership|ambassador/i, "Influencing"],
    [/email|campaign|social|brand|advertis|copywr|outreach|growth/i, "Marketing"],
    [/paid|ppc|ads|google ads|meta ads|facebook ads|tiktok ads/i, "Paid Media"],
    [/design|ui|ux|figma|creative|graphic|photo|visual|illustrat/i, "Design"],
    [/engineer|dev|code|software|frontend|backend|fullstack|api|database|devops/i, "Engineering"],
    [/product|roadmap|feature|backlog|sprint|agile|scrum/i, "Product"],
    [/project|pm|planning|milestone|timeline|coordinat/i, "Project Management"],
    [/test|qa|quality|bug|automat|spec|coverage/i, "Testing"],
    [/support|customer|helpdesk|ticket|service|care/i, "Support"],
];

/**
 * Derives a display category for an agent.
 * Uses agent.category if set, otherwise sniffs specialization keywords.
 */
function deriveCategory(agent: AgentDef): string {
    if (agent.category && CATEGORY_COLORS[agent.category]) return agent.category;
    const haystack = `${agent.specialization ?? ""} ${agent.mission ?? ""}`.toLowerCase();
    for (const [re, cat] of SPECIALIZATION_TO_CATEGORY) {
        if (re.test(haystack)) return cat;
    }
    return "General";
}


const ROLE_PRESETS: { id: string; label: string; emoji: string; description: string; skills: string[] }[] = [
    { id: "general",           label: "General Assistant",          emoji: "🤖", description: "All-purpose tasks, writing, research. Core + Google Workspace.",                                             skills: ["core","workspace"] },
    { id: "lead-agent",        label: "Lead Agent / Dept Head",      emoji: "🧠", description: "Full access: analytics, comms, content, commerce, workflow orchestration.",                                 skills: ["core","workspace","intelligence","communication","content","commerce","workflows"] },
    { id: "seo-analyst",       label: "SEO Analyst",                 emoji: "🔍", description: "Google Search Console, GA4, DataForSEO, PageSpeed, site auditing.",                                       skills: ["core","workspace","intelligence"] },
    { id: "email-marketer",    label: "Email Marketer",              emoji: "📧", description: "Gmail, Klaviyo, Shopify. Writes and manages email campaigns.",                                             skills: ["core","workspace","communication","commerce"] },
    { id: "content-creator",   label: "Content Creator",            emoji: "🎨", description: "Image & video generation, social publishing, brand asset library, research.",                             skills: ["core","workspace","intelligence","content","asset-library"] },
    { id: "influencing-agent", label: "Influencer / Social Media",  emoji: "⭐", description: "Influencer outreach, partnership content, social post scheduling.",                                        skills: ["core","workspace","communication","content"] },
    { id: "support-agent",     label: "Customer Support",           emoji: "🛟", description: "Support tickets, order lookups, Gorgias, SMS & voice calls.",                                            skills: ["core","workspace","communication","commerce","outreach"] },
    { id: "ads-manager",       label: "Paid Ads Manager",           emoji: "📢", description: "Ad performance research, creative generation, asset library, reporting.",                                  skills: ["core","workspace","intelligence","content","asset-library"] },
    { id: "analytics-agent",   label: "Analytics & Commerce",       emoji: "📊", description: "Revenue dashboards, Triple Whale, Klaviyo, Shopify metrics, reporting.",                                  skills: ["core","workspace","intelligence","commerce"] },
];


// ── Skill Tiers ────────────────────────────────────────────────────────────
const SKILL_TIERS: { id: string; label: string; description: string; tokens: number; color: string; always?: boolean }[] = [
    { id: "core",          label: "Core",          description: "Memories, web search, insights, routines",  tokens: 2800,  color: "#6366f1", always: true },
    { id: "workspace",     label: "Workspace",      description: "Google Docs / Sheets CRUD",                tokens: 1500,  color: "#38bdf8" },
    { id: "intelligence",  label: "Intelligence",   description: "GA4, GSC, YouTube, Facebook/IG, DataForSEO, Firecrawl", tokens: 1841, color: "#f59e0b" },
    { id: "communication", label: "Communication",  description: "Gmail + Discord DM",                       tokens: 1200,  color: "#7289da" },
    { id: "content",       label: "Content",        description: "Image/video gen, social scheduling, Pinterest", tokens: 2400, color: "#e879f9" },
    { id: "asset-library", label: "Asset Library",  description: "Gemini image/video tagging & search",      tokens: 1400,  color: "#34d399" },
    { id: "commerce",      label: "Commerce",       description: "Shopify MCP, Triple Whale, Klaviyo metrics",tokens: 900,   color: "#f87171" },
    { id: "outreach",      label: "Outreach",       description: "SMS + Voice calls",                        tokens: 800,   color: "#fb923c" },
    { id: "workflows",     label: "Workflows",      description: "Workflow orchestration (lead agents only)", tokens: 1698,  color: "#a78bfa" },
    { id: "admin",         label: "Admin",          description: "Shell, browser, system logs",              tokens: 600,   color: "#94a3b8" },
];
const SKILL_TOKEN_BUDGET = 18827; // current max


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
    name: "", discordChannelId: "", discordManagerId: "", type: "worker",
    specialization: "General Tasks", skills: ["core","workspace"], role: "general",
    personality: "", mission: "", context: "", constraints: "", emoji: "🤖",
};

// ── Agent Setup Modal (shared by Scratch + Template) ───────────────────
function AgentSetupModal({
    initial,
    templateInfo,
    onClose,
    onSaved,
    isEditing,
    discordMembers,
}: {
    initial: Partial<AgentDef>;
    templateInfo?: { name: string; description: string; category: string; system_prompt: string; emoji: string };
    onClose: () => void;
    onSaved: () => void;
    isEditing?: boolean;
    discordMembers: DiscordMember[];
}) {
    const [form, setForm] = useState<Partial<AgentDef>>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const set = (k: keyof AgentDef, v: any) => setForm(p => ({ ...p, [k]: v }));
    const applyRolePreset = (roleId: string) => {
        const preset = ROLE_PRESETS.find(r => r.id === roleId);
        if (!preset) return;
        setForm(p => ({ ...p, role: roleId, skills: preset.skills }));
    };
    const toggleSkill = (id: string) => {
        if (SKILL_TIERS.find(s => s.id === id)?.always) return; // core is always on
        setForm(p => {
            const current = p.skills ?? [];
            const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
            return { ...p, skills: next };
        });
    };

    // Discord manager dropdown (members passed from parent — fetched once)
    const [memberSearch, setMemberSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const filteredMembers = discordMembers.filter(m =>
        m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.username.toLowerCase().includes(memberSearch.toLowerCase())
    );
    const selectedMember = discordMembers.find(m => m.username === form.discordManagerId || m.id === form.discordManagerId);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        // Reuse existing ID when editing; generate new one for creates
        const id = isEditing && initial.id ? initial.id : `agent-${Date.now()}`;
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

                    {/* Department / Category */}
                    <div className="field mb-3">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Department
                        </label>
                        <div className="control">
                            <div className="select is-fullwidth" style={{ width: "100%" }}>
                                <select
                                    value={form.category ?? ""}
                                    onChange={e => set("category", e.target.value || undefined)}
                                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: form.category ? "#fff" : "#888", width: "100%" }}
                                >
                                    <option value="">— Auto-detect from specialization</option>
                                    {Object.keys(CATEGORY_COLORS).map(cat => (
                                        <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="is-size-7 has-text-grey mt-1">Sets which group this agent appears under on the roster</p>
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

                    {/* Discord Manager */}
                    <div className="field mb-3" style={{ position: "relative" }}>
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-1" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Discord Manager / Owner
                        </label>
                        {discordMembers.length > 0 ? (
                            <div style={{ position: "relative" }}>
                                <button
                                    type="button"
                                    onClick={() => { setDropdownOpen(p => !p); setMemberSearch(""); }}
                                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}
                                >
                                    {selectedMember ? (
                                        <>
                                            <img src={selectedMember.avatar} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                                            <span style={{ flex: 1 }}>{selectedMember.displayName}</span>
                                            <span style={{ color: "#666", fontSize: 11 }}>@{selectedMember.username}</span>
                                        </>
                                    ) : (
                                        <span style={{ color: "#666" }}>Select a Discord member…</span>
                                    )}
                                    <ChevronDown size={13} style={{ color: "#666", marginLeft: "auto", flexShrink: 0 }} />
                                </button>
                                {dropdownOpen && (
                                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10000, background: "#0e0e14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.8)" }}>
                                        <div style={{ padding: "8px 8px 4px" }}>
                                            <input autoFocus placeholder="Search members…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 12, padding: "6px 10px", outline: "none" }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                            <button type="button" onClick={() => { set("discordManagerId", ""); setDropdownOpen(false); }}
                                                style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}>
                                                — None
                                            </button>
                                            {filteredMembers.map(m => (
                                                <button key={m.id} type="button"
                                                    onClick={() => { set("discordManagerId", m.username); setDropdownOpen(false); }}
                                                    style={{ width: "100%", padding: "7px 12px", textAlign: "left", background: form.discordManagerId === m.username ? "rgba(255,140,0,0.12)" : "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                                                >
                                                    <img src={m.avatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ color: "#e5e5e5", fontWeight: 700, fontSize: 12, margin: 0 }}>{m.displayName}</p>
                                                        <p style={{ color: "#555", fontSize: 10, margin: 0 }}>@{m.username}</p>
                                                    </div>
                                                    {form.discordManagerId === m.username && <CheckCircle2 size={13} style={{ color: "#ff8c00", flexShrink: 0 }} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="control has-icons-left">
                                <input className="input"
                                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                                    placeholder="e.g. robert (Discord username)"
                                    value={form.discordManagerId ?? ""}
                                    onChange={e => set("discordManagerId", e.target.value)}
                                />
                                <span className="icon is-left has-text-grey"><Hash size={14} /></span>
                            </div>
                        )}
                        <p className="is-size-7 has-text-grey mt-1">Agent will discord_dm this person for escalations or when clarification is needed</p>
                    </div>

                    {/* Role Preset */}
                    <div className="mb-4">
                        <label className="is-size-7 has-text-grey-light has-text-weight-bold mb-2" style={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Role
                        </label>
                        <p className="is-size-7 has-text-grey mb-2">Picking a role auto-assigns the right capabilities. You can fine-tune below.</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {ROLE_PRESETS.map(preset => {
                                const active = (form.role ?? "general") === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyRolePreset(preset.id)}
                                        style={{
                                            textAlign: "left", padding: "9px 11px", borderRadius: 9,
                                            background: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                                            border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.07)",
                                            cursor: "pointer", transition: "all 0.15s",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                            <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#888" }}>{preset.label}</span>
                                            {active && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#6366f1", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, padding: "1px 5px" }}>Selected</span>}
                                        </div>
                                        <p style={{ fontSize: 10, color: "#555", margin: 0, paddingLeft: 20 }}>{preset.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Capabilities */}
                    <div className="mb-4">
                        <div className="is-flex is-align-items-center is-justify-content-space-between mb-2">
                            <label className="is-size-7 has-text-grey-light has-text-weight-bold" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Capabilities
                            </label>
                            {(() => {
                                const activeSkills = form.skills ?? [];
                                const totalTokens = SKILL_TIERS.filter(s => activeSkills.includes(s.id) || s.always).reduce((t, s) => t + s.tokens, 0);
                                const pct = Math.round((totalTokens / SKILL_TOKEN_BUDGET) * 100);
                                const color = pct < 50 ? "#34d399" : pct < 75 ? "#f59e0b" : "#ef4444";
                                return (
                                    <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 6, padding: "2px 7px" }}>
                                        ~{totalTokens.toLocaleString()} tokens ({pct}% of budget)
                                    </span>
                                );
                            })()}
                        </div>
                        <p className="is-size-7 has-text-grey mb-2">Select which tool bundles this agent can access. Fewer skills = faster, cheaper responses.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {SKILL_TIERS.map(skill => {
                                const active = skill.always || (form.skills ?? []).includes(skill.id);
                                return (
                                    <button
                                        key={skill.id}
                                        type="button"
                                        onClick={() => toggleSkill(skill.id)}
                                        disabled={skill.always}
                                        style={{
                                            textAlign: "left", padding: "7px 10px", borderRadius: 8,
                                            background: active ? `${skill.color}15` : "rgba(255,255,255,0.02)",
                                            border: active ? `1px solid ${skill.color}45` : "1px solid rgba(255,255,255,0.06)",
                                            cursor: skill.always ? "default" : "pointer",
                                            opacity: skill.always ? 0.7 : 1,
                                            display: "flex", alignItems: "center", gap: 10,
                                            transition: "all 0.12s",
                                        }}
                                    >
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? skill.color : "#444", flexShrink: 0, transition: "background 0.12s" }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#777", display: "block" }}>
                                                {skill.label}
                                                {skill.always && <span style={{ fontSize: 9, color: "#555", fontWeight: 400, marginLeft: 5 }}>Always on</span>}
                                            </span>
                                            <span style={{ fontSize: 10, color: "#555" }}>{skill.description}</span>
                                        </div>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: active ? skill.color : "#444", background: active ? `${skill.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? skill.color + "35" : "rgba(255,255,255,0.06)"}`, borderRadius: 4, padding: "1px 5px", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                                            ~{skill.tokens.toLocaleString()}t
                                        </span>
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

// ── Compact Roster Card ────────────────────────────────────────────────────
function AgentRosterCard({
    agent, score, heatColor, heatLabel, categoryColor, activeFeatureCount, routineCount, discordMembers, onEdit, onDelete,
}: {
    agent: AgentDef;
    score: number;
    heatColor: string;
    heatLabel: string;
    categoryColor: string;
    activeFeatureCount: number;
    routineCount: number;
    discordMembers: DiscordMember[];
    onEdit: () => void;
    onDelete: () => void;
}) {
    const router = useRouter();
    const [hovered, setHovered] = React.useState(false);
    const cardBg = score > 0.6 ? "rgba(52,211,153,0.04)" : score > 0.25 ? "rgba(255,140,0,0.04)" : "rgba(255,255,255,0.02)";
    const manager = agent.discordManagerId
        ? discordMembers.find(m => m.username === agent.discordManagerId) ?? { username: agent.discordManagerId, displayName: agent.discordManagerId, avatar: "" }
        : null;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => router.push(`/agents/${agent.id}`)}
            style={{
                position: "relative", overflow: "hidden", background: hovered ? "rgba(255,255,255,0.05)" : cardBg,
                border: `1px solid ${hovered ? `${categoryColor}55` : `${categoryColor}28`}`,
                borderLeft: `3px solid ${categoryColor}`, borderRadius: 10,
                padding: "0.75rem 0.875rem", cursor: "pointer", transition: "all 0.15s",
            }}
        >
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${categoryColor}15`, border: `1px solid ${categoryColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {agent.emoji ?? "🤖"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#e5e5e5", fontWeight: 900, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</p>
                    <p style={{ color: "#666", fontSize: 11, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.specialization}</p>
                </div>
                {/* Hover actions */}
                {hovered ? (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button title="Edit" onClick={onEdit}
                            style={{ background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)", borderRadius: 7, color: "#ff8c00", cursor: "pointer", padding: "4px 7px", display: "flex", alignItems: "center" }}>
                            <Pencil size={11} />
                        </button>
                        <button title="Delete" onClick={onDelete}
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#ef4444", cursor: "pointer", padding: "4px 7px", display: "flex", alignItems: "center" }}>
                            <Trash2 size={11} />
                        </button>
                    </div>
                ) : (
                    <ArrowRight size={13} color="#444" style={{ flexShrink: 0 }} />
                )}
            </div>
            {/* Bottom row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                {score > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: heatColor, background: `${heatColor}18`, border: `1px solid ${heatColor}35`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{heatLabel}</span>
                )}
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: categoryColor, background: `${categoryColor}12`, border: `1px solid ${categoryColor}30`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{agent.category ?? "Specialist"}</span>
                {/* Routine count badge */}
                <span style={{
                    fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: routineCount > 0 ? "#a78bfa" : "#444",
                    background: routineCount > 0 ? "rgba(167,139,250,0.12)" : "transparent",
                    border: `1px solid ${routineCount > 0 ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                }}>
                    ⚡ {routineCount} routine{routineCount !== 1 ? "s" : ""}
                </span>
                {/* Manager blurb */}
                {manager && (
                    <span
                        title={`Manager: ${manager.displayName} (@${manager.username})`}
                        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                    >
                        {manager.avatar
                            ? <img src={manager.avatar} alt="" style={{ width: 14, height: 14, borderRadius: "50%", opacity: 0.75 }} />
                            : <span style={{ fontSize: 9, color: "#555" }}>👤</span>
                        }
                        <span style={{ fontSize: 9, color: "#555", fontWeight: 700 }}>@{manager.username}</span>
                    </span>
                )}
                {!manager && (agent.skills ?? []).length > 0 && (
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#555", fontWeight: 700 }}>{(agent.skills ?? []).length} skills</span>
                )}
            </div>
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
    const [sectionOpen, setSectionOpen] = useState<Record<string, Record<string, boolean>>>({});
    const toggleSection = (agentId: string, section: string) =>
        setSectionOpen(p => ({
            ...p,
            [agentId]: { ...(p[agentId] ?? { skills: true, routines: true, documents: true }), [section]: !(p[agentId]?.[section] ?? true) },
        }));
    const isSectionOpen = (agentId: string, section: string) => p => (p[agentId]?.[section] ?? true);
    const [activityScores, setActivityScores] = useState<Record<string, number>>({});
    const [routineCounts, setRoutineCounts] = useState<Record<string, number>>({});
    const [discordMembers, setDiscordMembers] = useState<DiscordMember[]>([]);
    const [wizardOpen, setWizardOpen] = useState(false);

    // Modal state
    const [modal, setModal] = useState<{
        open: boolean;
        initial: Partial<AgentDef>;
        templateInfo?: { name: string; description: string; category: string; system_prompt: string; emoji: string };
        isEditing?: boolean;
    }>({ open: false, initial: blank });

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`);
            const data = await res.json();
            // API returns the array directly, not wrapped in { agents: [] }
            setAgents(Array.isArray(data) ? data : (data.agents ?? []));
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
        // Fetch Discord members once (passed down to modal as prop — avoids per-open refetch)
        fetch(`${BOT_URL}/admin/agents/discord-members`)
            .then(r => r.json())
            .then(data => Array.isArray(data) ? setDiscordMembers(data) : null)
            .catch(() => {});
        // Fetch routine counts (non-blocking)
        fetch(`${BOT_URL}/admin/routines`)
            .then(r => r.json())
            .then(data => {
                const counts: Record<string, number> = {};
                for (const r of (Array.isArray(data) ? data : [])) {
                    if (r.agent_id) counts[r.agent_id] = (counts[r.agent_id] ?? 0) + 1;
                }
                setRoutineCounts(counts);
            })
            .catch(() => {});
        // Fetch activity scores independently (non-blocking)
        fetch(`${BOT_URL}/admin/agent-metrics`)
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data?.agents)) return;
                const scores: Record<string, number> = {};
                for (const a of data.agents) {
                    scores[a.agentId] = (a.runs30d ?? 0) * 10 + (a.costUsd ?? 0) * 20;
                }
                setActivityScores(scores);
            })
            .catch(() => {});
    }, [fetchAgents, fetchTemplates]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this agent?")) return;
        await fetch(`${BOT_URL}/admin/agents/${id}`, { method: "DELETE" });
        fetchAgents();
    };

    const openScratch = () => setWizardOpen(true);

    const openEdit = (agent: AgentDef) => setModal({
        open: true,
        initial: { ...agent },
        isEditing: true,
    });

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
                    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        {(() => {
                            // Group agents by derived department
                            const grouped: Record<string, typeof agents> = {};
                            for (const agent of agents) {
                                const dept = deriveCategory(agent);
                                if (!grouped[dept]) grouped[dept] = [];
                                grouped[dept]!.push(agent);
                            }

                            // Sort departments: known categories first (in defined order), then General
                            const knownOrder = Object.keys(CATEGORY_COLORS);
                            const depts = Object.keys(grouped).sort((a, b) => {
                                const ai = knownOrder.indexOf(a);
                                const bi = knownOrder.indexOf(b);
                                if (ai === -1 && bi === -1) return a.localeCompare(b);
                                if (ai === -1) return 1;
                                if (bi === -1) return -1;
                                return ai - bi;
                            });

                            return depts.map(dept => {
                                const deptAgents = (grouped[dept] ?? []).sort(
                                    (a, b) => (activityScores[b.id] ?? 0) - (activityScores[a.id] ?? 0)
                                );
                                const deptColor = CATEGORY_COLORS[dept] ?? "#6366f1";
                                const deptEmoji = CATEGORY_EMOJI[dept] ?? "🤖";
                                return (
                                    <div key={dept}>
                                        {/* Department header — only shown when multiple depts exist */}
                                        {depts.length > 1 && (
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: 8,
                                                marginBottom: "0.75rem",
                                                paddingBottom: 6,
                                                borderBottom: `2px solid ${deptColor}44`,
                                            }}>
                                                <span style={{ fontSize: 16 }}>{deptEmoji}</span>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 900,
                                                    textTransform: "uppercase", letterSpacing: "0.1em",
                                                    color: deptColor,
                                                }}>{dept}</span>
                                                <span style={{
                                                    fontSize: 9, fontWeight: 700,
                                                    background: `${deptColor}18`,
                                                    border: `1px solid ${deptColor}35`,
                                                    borderRadius: 10, padding: "1px 7px",
                                                    color: deptColor,
                                                }}>{deptAgents.length} agent{deptAgents.length !== 1 ? "s" : ""}</span>
                                            </div>
                                        )}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                                        {deptAgents.map(agent => {
                                            const activeSkillCount = (agent.skills ?? []).length;
                                            const score = activityScores[agent.id] ?? 0;
                                            const maxScore = Math.max(...Object.values(activityScores), 1);
                                            const ratio = Math.min(score / maxScore, 1);
                                            const heatColor = ratio > 0.6 ? "#34d399" : ratio > 0.25 ? "#ff8c00" : "#555";
                                            const heatLabel = ratio > 0.6 ? "ACTIVE" : ratio > 0.25 ? "MODERATE" : score > 0 ? "QUIET" : "IDLE";
                                            const categoryColor = agent.color || CATEGORY_COLORS[deriveCategory(agent)] || deptColor;
                                            return (
                                                <AgentRosterCard
                                                    key={agent.id}
                                                    agent={agent}
                                                    score={score}
                                                    heatColor={heatColor}
                                                    heatLabel={heatLabel}
                                                    categoryColor={categoryColor}
                                                    activeFeatureCount={activeSkillCount}
                                                    routineCount={routineCounts[agent.id] ?? 0}
                                                    discordMembers={discordMembers}
                                                    onEdit={() => openEdit(agent)}
                                                    onDelete={() => handleDelete(agent.id)}
                                                />
                                            );
                                        })}
                                        </div>
                    </div>
                );
            })
        })()}
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

            {/* ── Setup Modal (for editing existing agents) ── */}
            <AnimatePresence>
                {modal.open && (
                    <AgentSetupModal
                        initial={modal.initial}
                        templateInfo={modal.templateInfo}
                        isEditing={modal.isEditing}
                        onClose={() => setModal(p => ({ ...p, open: false }))}
                        onSaved={onSaved}
                        discordMembers={discordMembers}
                    />
                )}
            </AnimatePresence>

            {/* ── Agent Creation Wizard (for new agents) ── */}
            <AnimatePresence>
                {wizardOpen && (
                    <AgentWizard
                        onClose={() => setWizardOpen(false)}
                        onCreated={() => { setWizardOpen(false); fetchAgents(); }}
                        AdvancedForm={({ onSaved: advSaved }) => (
                            <div style={{ padding: "1rem 0", textAlign: "center" }}>
                                <p className="has-text-grey" style={{ fontSize: 12, marginBottom: "1rem" }}>
                                    Advanced mode opens the full configuration form with all fields.
                                </p>
                                <button
                                    className="button is-dark"
                                    onClick={() => {
                                        setWizardOpen(false);
                                        setModal({ open: true, initial: { ...blank } });
                                    }}
                                >
                                    Open Advanced Form
                                </button>
                            </div>
                        )}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
