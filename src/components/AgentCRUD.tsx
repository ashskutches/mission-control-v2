"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain,
    Plus,
    Trash2,
    Hash,
    ShieldCheck,
    Cpu,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    Target,
    Sparkles,
    Globe,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface AgentDef {
    id: string;
    name: string;
    type: string;
    specialization: string;
    discordChannelId: string;
    features: Record<string, boolean>;
    // Priming fields
    personality?: string;
    mission?: string;
    context?: string;
    constraints?: string;
}

const AVAILABLE_FEATURES = [
    { id: "shopify", label: "Shopify Access", icon: Cpu },
    { id: "search", label: "Web Search", icon: Globe },
    { id: "memory", label: "Long-term Memory", icon: ShieldCheck },
];

const PRIMING_FIELDS = [
    {
        id: "personality",
        label: "Personality & Tone",
        icon: Sparkles,
        placeholder: "e.g. Direct and no-nonsense. Uses dry humour. Never overly formal. Gets straight to the point.",
        hint: "Defines communication style, tone, and persona traits."
    },
    {
        id: "mission",
        label: "Primary Mission",
        icon: Target,
        placeholder: "e.g. Handle all inbound customer support queries for the Shopify store. Resolve order questions, refund requests, and product questions.",
        hint: "The single core objective this agent optimizes every response around."
    },
    {
        id: "context",
        label: "Operational Context",
        icon: Brain,
        placeholder: "e.g. Deployed in the #ecom-support Discord channel for Helios Apparel. Responds to the team and customers. Has access to Shopify order data.",
        hint: "Background info — who it talks to, what project/team it serves."
    },
    {
        id: "constraints",
        label: "Constraints & Guardrails",
        icon: ShieldAlert,
        placeholder: "e.g. NEVER share revenue figures. NEVER approve refunds over $50 without manager approval. NEVER discuss competitors.",
        hint: "Hard rules. What this agent must never do."
    }
];

const defaultAgent: Partial<AgentDef> = {
    name: "",
    discordChannelId: "",
    type: "worker",
    specialization: "General Tasks",
    features: {},
    personality: "",
    mission: "",
    context: "",
    constraints: "",
};

export const AgentCRUD = () => {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [newAgent, setNewAgent] = useState<Partial<AgentDef>>(defaultAgent);

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`);
            const data = await res.json();
            setAgents(data.filter((a: any) => a.name));
        } catch (e) {
            console.error("Failed to fetch agents");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = `agent-${Date.now()}`;
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    ...newAgent,
                    api_key: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
                })
            });
            if (res.ok) {
                await fetchAgents();
                setIsCreating(false);
                setNewAgent(defaultAgent);
            }
        } catch (e) {
            console.error("Failed to create agent");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to decommission this unit?")) return;
        try {
            const res = await fetch(`${BOT_URL}/admin/agents/${id}?api_key=${process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN}`, {
                method: "DELETE"
            });
            if (res.ok) await fetchAgents();
        } catch (e) {
            console.error("Failed to delete agent");
        }
    };

    const toggleFeature = (featureId: string) => {
        setNewAgent(prev => ({
            ...prev,
            features: { ...prev.features, [featureId]: !prev.features?.[featureId] }
        }));
    };

    const updateField = (field: keyof AgentDef, value: string) => {
        setNewAgent(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="agent-crud-container">
            {/* Header */}
            <div className="level is-mobile mb-6">
                <div className="level-left">
                    <div>
                        <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Unit Deployment</h3>
                        <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Dynamic Agent CRUD Interface</p>
                    </div>
                </div>
                <div className="level-right">
                    <button
                        onClick={() => setIsCreating(true)}
                        className="button is-info is-small is-uppercase has-text-weight-black"
                        style={{ borderRadius: '8px' }}
                    >
                        <Plus size={16} className="mr-2" />
                        Initialize New Unit
                    </button>
                </div>
            </div>

            {/* Create Form */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="box p-6 mb-6"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--accent-blue)' }}
                    >
                        <h4 className="title is-size-5 has-text-weight-black mb-5">Initialize New Unit</h4>
                        <form onSubmit={handleCreate}>

                            {/* Identity */}
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest mb-3">Identity</p>
                            <div className="columns is-multiline mb-2">
                                <div className="column is-6">
                                    <div className="field">
                                        <label className="label is-size-7 has-text-grey-light mb-2">Codename *</label>
                                        <div className="control has-icons-left">
                                            <input
                                                className="input is-small"
                                                type="text"
                                                placeholder="e.g. Sentinel-1"
                                                value={newAgent.name}
                                                onChange={e => updateField("name", e.target.value)}
                                                required
                                            />
                                            <span className="icon is-small is-left"><Brain size={14} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="column is-6">
                                    <div className="field">
                                        <label className="label is-size-7 has-text-grey-light mb-2">Discord Channel ID *</label>
                                        <div className="control has-icons-left">
                                            <input
                                                className="input is-small"
                                                type="text"
                                                placeholder="1234567890..."
                                                value={newAgent.discordChannelId}
                                                onChange={e => updateField("discordChannelId", e.target.value)}
                                                required
                                            />
                                            <span className="icon is-small is-left"><Hash size={14} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="column is-12">
                                    <div className="field">
                                        <label className="label is-size-7 has-text-grey-light mb-2">Specialization</label>
                                        <div className="control">
                                            <input
                                                className="input is-small"
                                                type="text"
                                                placeholder="e.g. Shopify Customer Support, Inventory Management..."
                                                value={newAgent.specialization}
                                                onChange={e => updateField("specialization", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Priming Fields */}
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest mb-3 mt-5">
                                Priming Directives
                            </p>
                            <div className="columns is-multiline mb-2">
                                {PRIMING_FIELDS.map(field => (
                                    <div key={field.id} className="column is-6">
                                        <div className="field">
                                            <label className="label is-size-7 mb-1" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <field.icon size={13} className="has-text-info" />
                                                {field.label}
                                            </label>
                                            <p className="is-size-7 has-text-grey mb-2" style={{ lineHeight: 1.4 }}>{field.hint}</p>
                                            <div className="control">
                                                <textarea
                                                    className="textarea is-small"
                                                    rows={3}
                                                    placeholder={field.placeholder}
                                                    value={(newAgent as any)[field.id] || ""}
                                                    onChange={e => updateField(field.id as keyof AgentDef, e.target.value)}
                                                    style={{ resize: 'vertical', fontSize: '12px' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Feature Allocation */}
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest mb-3 mt-5">Feature Allocation</p>
                            <div className="columns is-multiline mb-4">
                                {AVAILABLE_FEATURES.map(feat => (
                                    <div key={feat.id} className="column is-3">
                                        <div
                                            onClick={() => toggleFeature(feat.id)}
                                            className={cn(
                                                "box p-4 is-clickable transition-all",
                                                newAgent.features?.[feat.id] ? "has-background-info-dark" : "has-background-dark"
                                            )}
                                            style={{ border: newAgent.features?.[feat.id] ? '1px solid var(--accent-blue)' : '1px solid transparent' }}
                                        >
                                            <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
                                                <feat.icon size={16} className={newAgent.features?.[feat.id] ? "has-text-info" : "has-text-grey"} />
                                                <span className="is-size-7 has-text-weight-bold">{feat.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="is-flex is-justify-content-flex-end mt-4" style={{ gap: '1rem' }}>
                                <button type="button" onClick={() => { setIsCreating(false); setNewAgent(defaultAgent); }} className="button is-dark is-small is-uppercase has-text-weight-black">Cancel</button>
                                <button type="submit" className="button is-link is-small is-uppercase has-text-weight-black px-5">Deploy Unit</button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Agent Cards */}
            <div className="columns is-multiline">
                {agents.map(agent => (
                    <div key={agent.id} className="column is-6">
                        <div className="box p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {/* Card Header */}
                            <div className="level is-mobile mb-4">
                                <div className="level-left">
                                    <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(255,140,0,0.1)', borderRadius: '10px', color: 'var(--accent-orange)' }}>
                                            <Brain size={20} />
                                        </div>
                                        <div>
                                            <h4 className="title is-size-5 has-text-white mb-0">{agent.name}</h4>
                                            <p className="is-size-7 has-text-grey is-uppercase tracking-widest" style={{ fontSize: '9px' }}>{agent.specialization}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="level-right" style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                    <button
                                        onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                                        className="button is-ghost has-text-grey p-0"
                                        title="Show priming details"
                                    >
                                        {expandedAgent === agent.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <button onClick={() => handleDelete(agent.id)} className="button is-ghost has-text-danger p-0 ml-2">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="is-flex is-flex-wrap-wrap mb-4" style={{ gap: '0.5rem' }}>
                                <div className="tag is-dark"><Hash size={12} className="mr-1" />{agent.discordChannelId || "No Channel"}</div>
                                <div className="tag is-dark is-uppercase is-size-7 has-text-weight-bold">{agent.type}</div>
                            </div>

                            {/* Mission Preview */}
                            {agent.mission && (
                                <p className="is-size-7 has-text-grey-light mb-4" style={{ lineHeight: 1.5, borderLeft: '2px solid var(--accent-blue)', paddingLeft: '0.75rem', fontStyle: 'italic' }}>
                                    {agent.mission.slice(0, 120)}{agent.mission.length > 120 ? "…" : ""}
                                </p>
                            )}

                            {/* Features */}
                            <div className="is-flex is-flex-direction-column" style={{ gap: '0.4rem' }}>
                                {AVAILABLE_FEATURES.map(feat => (
                                    <div key={feat.id} className="is-flex is-justify-content-between is-align-items-center">
                                        <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                            <feat.icon size={12} className="has-text-grey" />
                                            <span className="is-size-7 has-text-grey-light">{feat.label}</span>
                                        </div>
                                        {agent.features?.[feat.id] ? (
                                            <CheckCircle2 size={14} className="has-text-success" />
                                        ) : (
                                            <XCircle size={14} className="has-text-grey" style={{ opacity: 0.3 }} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Expanded Priming Details */}
                            <AnimatePresence>
                                {expandedAgent === agent.id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                            {PRIMING_FIELDS.map(field => {
                                                const val = (agent as any)[field.id];
                                                if (!val) return null;
                                                return (
                                                    <div key={field.id} className="mb-3">
                                                        <div className="is-flex is-align-items-center mb-1" style={{ gap: '6px' }}>
                                                            <field.icon size={12} className="has-text-info" />
                                                            <span className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest">{field.label}</span>
                                                        </div>
                                                        <p className="is-size-7 has-text-grey-light" style={{ lineHeight: 1.6, paddingLeft: '1.25rem' }}>{val}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                ))}

                {agents.length === 0 && !loading && (
                    <div className="column is-12 has-text-centered py-6">
                        <p className="has-text-grey italic is-size-6">No dynamic units deployed. Initialise one to scale operations.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
