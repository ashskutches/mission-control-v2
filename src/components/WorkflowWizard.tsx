"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Bot, X, Send, ChevronRight, Loader2, Check,
    Plus, GitBranch, User, Layout, MessageSquare, AlertCircle
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Agent {
    id: string;
    name: string;
    emoji: string;
    specialization: string;
}

interface PhaseConfig {
    phase: number;
    name: string;
    description: string;
    enabled: boolean;
    steps: string[];
}

interface WorkflowDraft {
    name: string;
    description: string;
    phases_config: PhaseConfig[];
    human_owner_discord_id?: string;
}

interface Message {
    role: "user" | "assistant";
    text: string;
}

export function WorkflowWizard({ isOpen, onClose, onCreated }: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [step, setStep] = useState<"select-agent" | "collaborate" | "success">("select-agent");
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [draft, setDraft] = useState<WorkflowDraft | null>(null);
    const [confirming, setConfirming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial fetch of agents
    useEffect(() => {
        if (isOpen) {
            fetch(`${BOT_URL}/admin/agents`)
                .then(res => res.json())
                .then(data => setAgents(data))
                .catch(err => console.error("Failed to fetch agents", err));
        }
    }, [isOpen]);

    // Auto-scroll chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || !selectedAgent || loading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", text: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch(`${BOT_URL}/admin/workflows/wizard/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: selectedAgent.id,
                    message: userMsg
                }),
            });
            const data = await res.json();
            
            setMessages(prev => [...prev, { role: "assistant", text: data.text }]);
            if (data.wizardConfig) {
                setDraft(data.wizardConfig);
            }
        } catch (err) {
            console.error("Chat failed", err);
            setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!draft || confirming) return;
        setConfirming(true);
        try {
            const res = await fetch(`${BOT_URL}/admin/workflows/wizard/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                setStep("success");
                onCreated();
            } else {
                throw new Error("Failed to confirm workflow");
            }
        } catch (err) {
            console.error("Confirm failed", err);
        } finally {
            setConfirming(false);
        }
    };

    const reset = () => {
        setStep("select-agent");
        setSelectedAgent(null);
        setMessages([]);
        setInput("");
        setDraft(null);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{
                    width: "100%", maxWidth: step === "collaborate" ? 1000 : 600,
                    background: "#0a0a0b", borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
                    overflow: "hidden", position: "relative",
                    display: "flex", flexDirection: "column",
                    minHeight: 500, maxHeight: "90vh",
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "1.25rem 1.75rem", display: "flex", alignItems: "center",
                    justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: "rgba(255,140,0,0.15)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                        }}>
                            <GitBranch size={16} color="#ff8c00" />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                Workflow Designer
                            </p>
                            <p style={{ fontSize: 11, color: "#6b7280" }}>
                                {step === "select-agent" ? "Choose an agent to work with" : 
                                 step === "collaborate" ? `Collaborating with ${selectedAgent?.name}` : 
                                 "Workflow established"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: "rgba(255,255,255,0.05)", border: "none",
                        width: 30, height: 30, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: "#666", transition: "color 0.2s",
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                    {step === "select-agent" && (
                        <div style={{ padding: "2rem", width: "100%", overflowY: "auto" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                                {agents.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => { setSelectedAgent(a); setStep("collaborate"); }}
                                        style={{
                                            padding: "1.25rem", borderRadius: 16,
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            textAlign: "left", cursor: "pointer",
                                            transition: "transform 0.2s, background 0.2s, border-color 0.2s",
                                            display: "flex", alignItems: "center", gap: 14,
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                            e.currentTarget.style.borderColor = "rgba(255,140,0,0.3)";
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                        }}
                                    >
                                        <span style={{ fontSize: 32 }}>{a.emoji}</span>
                                        <div>
                                            <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{a.name}</p>
                                            <p style={{ fontSize: 11, color: "#6b7280" }}>{a.specialization}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === "collaborate" && (
                        <>
                            {/* Chat Window */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                                <div ref={scrollRef} style={{ flex: 1, padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                                    {messages.length === 0 && (
                                        <div style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>
                                            <MessageSquare size={32} color="#ff8c00" style={{ margin: "0 auto 12px" }} />
                                            <p style={{ fontSize: 13, color: "#9ca3af" }}>
                                                Tell {selectedAgent?.name} what kind of workflow you want to build.
                                            </p>
                                        </div>
                                    )}
                                    {messages.map((m, i) => (
                                        <div key={i} style={{
                                            display: "flex",
                                            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                                            gap: 10,
                                        }}>
                                            {m.role === "assistant" && (
                                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <span style={{ fontSize: 14 }}>{selectedAgent?.emoji}</span>
                                                </div>
                                            )}
                                            <div style={{
                                                maxWidth: "80%",
                                                padding: "0.75rem 1rem",
                                                borderRadius: 16,
                                                fontSize: 13,
                                                lineHeight: 1.5,
                                                background: m.role === "user" ? "#ff8c00" : "rgba(255,255,255,0.04)",
                                                color: m.role === "user" ? "#fff" : "#d1d5db",
                                                border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
                                            }}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.5 }}>
                                            <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "#ff8c00" }} />
                                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{selectedAgent?.name} is thinking…</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: "1.25rem", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        <input
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                                            placeholder={`Message ${selectedAgent?.name}…`}
                                            style={{
                                                flex: 1, padding: "0.75rem 1rem", borderRadius: 12,
                                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                                                color: "#fff", fontSize: 13, outline: "none",
                                            }}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={loading || !input.trim()}
                                            style={{
                                                width: 42, height: 42, borderRadius: 12,
                                                background: "#ff8c00", border: "none",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer", color: "#fff",
                                            }}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Window */}
                            <div style={{ width: 400, background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto" }}>
                                    <h3 style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
                                        Draft Workflow
                                    </h3>
                                    
                                    {!draft ? (
                                        <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                                            <Sparkles size={24} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
                                            <p style={{ fontSize: 11, color: "#4b5563" }}>
                                                Propose a plan to generate the draft.
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                                            <div>
                                                <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{draft.name}</p>
                                                <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{draft.description}</p>
                                            </div>

                                            <div>
                                                <p style={{ fontSize: 10, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", marginBottom: 10 }}>Phases</p>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    {draft.phases_config.map((p, i) => (
                                                        <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,140,0,0.06)", border: "1px solid rgba(255,140,0,0.15)" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                                <span style={{ fontSize: 11, fontWeight: 800, color: "#ff8c00" }}>Phase {p.phase}: {p.name}</span>
                                                                {p.enabled && <Check size={12} color="#22c55e" />}
                                                            </div>
                                                            <p style={{ fontSize: 10, color: "#9ca3af" }}>{p.steps.length} automated steps</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {draft.human_owner_discord_id && (
                                                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
                                                    <User size={14} color="#38bdf8" />
                                                    <span style={{ fontSize: 11, color: "#38bdf8" }}>Owner: {draft.human_owner_discord_id}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={!draft || confirming}
                                        style={{
                                            flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, fontWeight: 800,
                                            background: draft ? "#22c55e" : "rgba(255,255,255,0.05)",
                                            color: draft ? "#fff" : "#444",
                                            border: "none", cursor: draft ? "pointer" : "not-allowed",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        }}
                                    >
                                        {confirming ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <><Check size={14} /> Establish Workflow</>}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {step === "success" && (
                        <div style={{ padding: "4rem", textAlign: "center", width: "100%" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                                <Check size={32} color="#22c55e" />
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 12 }}>Workflow Established</h2>
                            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: "2.5rem" }}>
                                Your new workflow is now active and the AI Manager has been notified.
                            </p>
                            <button onClick={onClose} style={{
                                padding: "0.75rem 2rem", borderRadius: 12, background: "#ff8c00", color: "#fff",
                                fontWeight: 800, border: "none", cursor: "pointer",
                            }}>
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
