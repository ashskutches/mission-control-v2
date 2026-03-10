"use client";
import React from "react";
import { motion } from "framer-motion";
import { UserCheck, ShieldCheck, Zap, Activity } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface Agent {
    id: string;
    name: string;
    type: string;
    status: "online" | "idle" | "busy";
    lastActive: string;
    task?: string;
}

const agents: Agent[] = [
    { id: "gc-01", name: "Gravity Claw", type: "Core Orchestrator", status: "online", lastActive: "Active Now", task: "Monitoring Shopify Sync" },
    { id: "ag-01", name: "Antigravity", type: "Lead Engineer", status: "busy", lastActive: "Active Now", task: "Rewriting V3 Components" },
    { id: "gx-01", name: "Growth Agent", type: "Business Intel", status: "idle", lastActive: "2m ago", task: "Market Probability Analysis" }
];

export const AgentRoster = () => {
    return (
        <div className="flex flex-col gap-4">
            {agents.map((agent, i) => (
                <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-[var(--bg-elevated)] border border-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.08)] transition-all group"
                >
                    <div className="relative">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center bg-black/40 border",
                            agent.status === "online" ? "border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]" :
                                agent.status === "busy" ? "border-[var(--accent-purple)]/30 text-[var(--accent-purple)]" : "border-[var(--text-dim)]/30 text-[var(--text-dim)]"
                        )}>
                            {agent.name.includes("Claw") ? <ShieldCheck size={24} /> : agent.name.includes("Anti") ? <Zap size={24} /> : <UserCheck size={24} />}
                        </div>
                        <div className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0A] shadow-[0_0_8px_currentColor]",
                            agent.status === "online" ? "bg-[var(--accent-emerald)] text-[var(--accent-emerald)]" :
                                agent.status === "busy" ? "bg-[var(--accent-purple)] text-[var(--accent-purple)]" : "bg-[var(--text-dim)] text-[var(--text-dim)]"
                        )} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
                                {agent.name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-dim)] uppercase">
                                {agent.type}
                            </span>
                        </div>
                        <div className="text-[11px] font-medium text-[var(--text-dim)] mt-1 flex items-center gap-2">
                            <Activity size={10} className="text-[var(--accent-cyan)]" />
                            <span className="truncate group-hover:text-[var(--text-secondary)] transition-colors">
                                {agent.task || "Standby"}
                            </span>
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">{agent.status}</div>
                        <div className="text-[9px] font-medium text-[var(--text-muted)] mt-1">{agent.lastActive}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
