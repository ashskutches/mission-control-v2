
"use client";
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { UserCheck, ShieldCheck, Zap, Activity } from "lucide-react";
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

interface AgentRosterProps {
    facts?: any[];
}

export const AgentRoster: React.FC<AgentRosterProps> = ({ facts = [] }) => {
    const agents = useMemo(() => {
        const rosterFact = facts.find(f => f.key === "agent_roster");
        if (rosterFact) {
            try {
                return JSON.parse(rosterFact.value) as Agent[];
            } catch (e) {
                console.error("Failed to parse agent_roster fact", e);
            }
        }
        // Fallback for UI skeleton
        return [
            { id: "gravity-claw-core", name: "Gravity Claw", type: "supervisor", specialization: "Strategic Orchestration", status: "online", lastActive: "Active Now", currentTask: "Supervising Agency Units" }
        ] as Agent[];
    }, [facts]);

    return (
        <div className="is-flex is-flex-direction-column" style={{ gap: '1rem' }}>
            {agents.map((agent, i) => (
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
                                <div className="has-text-right">
                                    <span className={cn(
                                        "tag is-rounded is-uppercase has-text-weight-black is-size-7",
                                        agent.status === 'online' ? "is-success is-light" :
                                            agent.status === 'busy' ? "is-info is-light" : "is-dark"
                                    )} style={{ fontSize: '8px' }}>
                                        {agent.status}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                <Activity size={10} className="has-text-grey" />
                                <p className="is-size-7 has-text-grey truncate" style={{ maxWidth: '200px' }}>
                                    {agent.currentTask || "Standby Protocol"}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
