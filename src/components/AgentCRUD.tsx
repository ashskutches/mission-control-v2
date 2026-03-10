"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain,
    Plus,
    Trash2,
    Settings2,
    Hash,
    ShieldCheck,
    Cpu,
    RefreshCcw,
    CheckCircle2,
    XCircle
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
}

const AVAILABLE_FEATURES = [
    { id: "shopify", label: "Shopify Access", icon: Cpu },
    { id: "search", label: "Google Search", icon: Brain },
    { id: "memory", label: "Long-term Memory", icon: ShieldCheck },
    { id: "broadcast", label: "Slack Broadcast", icon: RefreshCcw }
];

export const AgentCRUD = () => {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newAgent, setNewAgent] = useState<Partial<AgentDef>>({
        name: "",
        discordChannelId: "",
        type: "worker",
        specialization: "General Tasks",
        features: {}
    });

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await fetch(`${BOT_URL}/admin/agents`);
            const data = await res.json();
            // Filter out empty/tombstoned agents
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
                setNewAgent({ name: "", discordChannelId: "", type: "worker", specialization: "General Tasks", features: {} });
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
            if (res.ok) {
                await fetchAgents();
            }
        } catch (e) {
            console.error("Failed to delete agent");
        }
    };

    const toggleFeature = (featureId: string) => {
        setNewAgent(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [featureId]: !prev.features?.[featureId]
            }
        }));
    };

    return (
        <div className="agent-crud-container">
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

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="box p-6 mb-6"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--accent-blue)' }}
                    >
                        <form onSubmit={handleCreate}>
                            <div className="columns is-multiline">
                                <div className="column is-6">
                                    <div className="field">
                                        <label className="label is-size-7 has-text-grey is-uppercase tracking-widest mb-2">Codename</label>
                                        <div className="control has-icons-left">
                                            <input
                                                className="input is-dark is-small"
                                                type="text"
                                                placeholder="e.g. Sentinel-1"
                                                value={newAgent.name}
                                                onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                                                required
                                            />
                                            <span className="icon is-small is-left"><Brain size={14} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="column is-6">
                                    <div className="field">
                                        <label className="label is-size-7 has-text-grey is-uppercase tracking-widest mb-2">Discord Channel ID</label>
                                        <div className="control has-icons-left">
                                            <input
                                                className="input is-dark is-small"
                                                type="text"
                                                placeholder="1234567890..."
                                                value={newAgent.discordChannelId}
                                                onChange={e => setNewAgent({ ...newAgent, discordChannelId: e.target.value })}
                                                required
                                            />
                                            <span className="icon is-small is-left"><Hash size={14} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="column is-12">
                                    <label className="label is-size-7 has-text-grey is-uppercase tracking-widest mb-4">Feature Allocation</label>
                                    <div className="columns is-multiline">
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
                                </div>
                            </div>
                            <div className="is-flex is-justify-content-flex-end mt-4" style={{ gap: '1rem' }}>
                                <button type="button" onClick={() => setIsCreating(false)} className="button is-dark is-small is-uppercase has-text-weight-black">Cancel</button>
                                <button type="submit" className="button is-link is-small is-uppercase has-text-weight-black px-5">Deploy Unit</button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="columns is-multiline">
                {agents.map(agent => (
                    <div key={agent.id} className="column is-6">
                        <div className="box p-5" style={{ background: 'rgba(255,255,255,0.02) !important' }}>
                            <div className="level is-mobile mb-4">
                                <div className="level-left">
                                    <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(255,140,0,0.1)', borderRadius: '10px', color: 'var(--accent-orange)' }}>
                                            <Brain size={20} />
                                        </div>
                                        <div>
                                            <h4 className="title is-size-5 has-text-white mb-0">{agent.name}</h4>
                                            <p className="is-size-7 has-text-grey uppercase tracking-widest" style={{ fontSize: '9px' }}>{agent.specialization}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="level-right">
                                    <button onClick={() => handleDelete(agent.id)} className="button is-ghost has-text-danger p-0 ml-4">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="is-flex is-flex-wrap-wrap mb-4" style={{ gap: '0.5rem' }}>
                                <div className="tag is-dark">
                                    <Hash size={12} className="mr-1" /> {agent.discordChannelId}
                                </div>
                                <div className="tag is-dark is-uppercase is-size-7 has-text-weight-bold">
                                    {agent.type}
                                </div>
                            </div>

                            <div className="is-flex is-flex-direction-column" style={{ gap: '0.5rem' }}>
                                {AVAILABLE_FEATURES.map(feat => (
                                    <div key={feat.id} className="is-flex is-justify-content-between is-align-items-center">
                                        <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                            <feat.icon size={12} className="has-text-grey" />
                                            <span className="is-size-7 has-text-grey-light">{feat.label}</span>
                                        </div>
                                        {agent.features[feat.id] ? (
                                            <CheckCircle2 size={14} className="has-text-success" />
                                        ) : (
                                            <XCircle size={14} className="has-text-grey" style={{ opacity: 0.3 }} />
                                        )}
                                    </div>
                                ))}
                            </div>
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
