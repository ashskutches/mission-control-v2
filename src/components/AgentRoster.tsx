
"use client";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, ShieldCheck, Zap, Activity, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface Agent {
    id: string;
    name: string;
    type: string;
    specialization: string;
    status: "online" | "idle" | "busy" | "error";
    lastActive: string;
    currentTask?: string;
}

type ResetState = "idle" | "loading" | "done" | "error";

interface AgentRosterProps {
    facts?: any[];
}

export const AgentRoster: React.FC<AgentRosterProps> = ({ facts = [] }) => {
    const [resetState, setResetState] = useState<Record<string, ResetState>>({});
    const [resetMsg, setResetMsg] = useState<Record<string, string>>({});

    const agents = useMemo(() => {
        const rosterFact = facts.find(f => f.key === "agent_roster");
        if (rosterFact) {
            try {
                return JSON.parse(rosterFact.value) as Agent[];
            } catch (e) {
                console.error("Failed to parse agent_roster fact", e);
            }
        }
        return [
            { id: "gravity-claw-core", name: "Gravity Claw", type: "supervisor", specialization: "Strategic Orchestration", status: "online", lastActive: "Active Now", currentTask: "Supervising Agency Units" }
        ] as Agent[];
    }, [facts]);

    const handleRefreshSession = async (agent: Agent) => {
        setResetState(s => ({ ...s, [agent.id]: "loading" }));
        setResetMsg(s => ({ ...s, [agent.id]: "" }));
        try {
            const base = process.env.NEXT_PUBLIC_API_URL ?? "";
            const resp = await fetch(`${base}/admin/agents/${agent.id}/reset-session`, { method: "POST" });
            const json = await resp.json();
            if (!resp.ok) throw new Error(json.error ?? "Reset failed");
            setResetState(s => ({ ...s, [agent.id]: "done" }));
            setResetMsg(s => ({ ...s, [agent.id]: json.message ?? "Session refreshed" }));
        } catch (e: any) {
            setResetState(s => ({ ...s, [agent.id]: "error" }));
            setResetMsg(s => ({ ...s, [agent.id]: e.message ?? "Reset failed" }));
        } finally {
            // Auto-clear feedback after 3s
            setTimeout(() => setResetState(s => ({ ...s, [agent.id]: "idle" })), 3000);
        }
    };

    return (
        <div className="is-flex is-flex-direction-column" style={{ gap: '1rem' }}>
            {agents.map((agent, i) => {
                const rs = resetState[agent.id] ?? "idle";
                return (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="box p-4 mb-0 is-shadowless"
                        style={{
                            background: 'rgba(255,255,255,0.02) !important',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px'
                        }}
                    >
                        <div className="media is-align-items-center">
                            <div className="media-left">
                                <div className="relative">
                                    <div className={cn(
                                        "is-flex is-justify-content-center is-align-items-center",
                                        "w-12 h-12 rounded-xl bg-black/40 border",
                                        agent.status === "online" ? "border-success-dark has-text-success" :
                                            agent.status === "busy" ? "border-info-dark has-text-info" : "border-grey has-text-grey"
                                    )}
                                        style={{
                                            borderColor: agent.status === 'online' ? 'rgba(0,255,136,0.3)' :
                                                agent.status === 'busy' ? 'rgba(0,170,255,0.3)' : 'rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        {agent.type === 'supervisor' ? <ShieldCheck size={20} /> : <UserCheck size={20} />}
                                    </div>
                                    <div className={cn(
                                        "is-absolute",
                                        "w-3 h-3 rounded-full border-2 border-black",
                                        agent.status === "online" ? "has-background-success" :
                                            agent.status === "busy" ? "has-background-info" : "has-background-grey"
                                    )}
                                        style={{ bottom: '-2px', right: '-2px' }}
                                    />
                                </div>
                            </div>

                            <div className="media-content">
                                <div className="is-flex is-justify-content-between is-align-items-center">
                                    <div>
                                        <p className="title is-size-6 has-text-white mb-0 uppercase tracking-tight">
                                            {agent.name}
                                        </p>
                                        <p className="is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest" style={{ fontSize: '9px' }}>
                                            {agent.specialization}
                                        </p>
                                    </div>
                                    <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                        <span className={cn(
                                            "tag is-rounded is-uppercase has-text-weight-black is-size-7",
                                            agent.status === 'online' ? "is-success is-light" :
                                                agent.status === 'busy' ? "is-info is-light" : "is-dark"
                                        )} style={{ fontSize: '8px' }}>
                                            {agent.status}
                                        </span>

                                        {/* Refresh Session Button */}
                                        <motion.button
                                            onClick={() => handleRefreshSession(agent)}
                                            disabled={rs === "loading"}
                                            className="button is-ghost is-small p-1"
                                            title="Refresh session — clears conversation history, loads latest skills"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            style={{
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                color: rs === "done" ? 'rgba(0,255,136,0.8)'
                                                    : rs === "error" ? 'rgba(255,80,80,0.8)'
                                                    : 'rgba(255,255,255,0.4)',
                                                background: 'rgba(255,255,255,0.04)',
                                                cursor: rs === "loading" ? "wait" : "pointer",
                                                minWidth: '28px',
                                                height: '28px',
                                            }}
                                        >
                                            {rs === "loading" ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                                                >
                                                    <RefreshCw size={12} />
                                                </motion.div>
                                            ) : rs === "done" ? (
                                                <CheckCircle2 size={12} />
                                            ) : rs === "error" ? (
                                                <AlertCircle size={12} />
                                            ) : (
                                                <RefreshCw size={12} />
                                            )}
                                        </motion.button>
                                    </div>
                                </div>

                                <div className="mt-3 is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                    <Activity size={10} className="has-text-grey" />
                                    <p className="is-size-7 has-text-grey truncate" style={{ maxWidth: '200px' }}>
                                        {agent.currentTask || "Standby Protocol"}
                                    </p>
                                </div>

                                {/* Reset feedback toast */}
                                <AnimatePresence>
                                    {resetMsg[agent.id] && rs !== "idle" && (
                                        <motion.p
                                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                            animate={{ opacity: 1, height: 'auto', marginTop: '0.4rem' }}
                                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                            className="is-size-7"
                                            style={{
                                                color: rs === "error" ? 'rgba(255,80,80,0.8)' : 'rgba(0,255,136,0.7)',
                                                fontSize: '10px',
                                            }}
                                        >
                                            {rs === "error" ? "⚠️ " : "✓ "}{resetMsg[agent.id]}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
