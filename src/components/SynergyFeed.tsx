"use client";
import React from "react";
import { motion } from "framer-motion";
import { Github, Zap, Shield, MessageSquare, Database, Activity, Code2, Sparkles } from "lucide-react";

interface SynergyItem {
    id: string;
    action: string;
    details: string;
    created_at: string;
    status: string;
}

const getIcon = (action: string) => {
    switch (action) {
        case "tool_use": return <Database size={14} />;
        case "dev_proposal": return <Code2 size={14} />;
        case "message": return <MessageSquare size={14} />;
        case "synergy_handshake": return <Sparkles size={14} />;
        case "health_check": return <Shield size={14} />;
        default: return <Activity size={14} />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case "dev_proposal": return "var(--accent-orange)";
        case "synergy_handshake": return "var(--accent-purple)";
        case "tool_use": return "var(--accent-blue)";
        case "health_check": return "var(--accent-emerald)";
        case "error": return "var(--accent-rose)";
        default: return "var(--text-muted)";
    }
};

export const SynergyFeed = ({ items }: { items: SynergyItem[] }) => {
    return (
        <div className="flex flex-col gap-3">
            {items.map((item, i) => {
                const color = getActionColor(item.action);

                return (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, ease: "easeOut" }}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.06)] transition-all group"
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
                            style={{ background: `${color}15`, color: color, border: `1px solid ${color}30` }}
                        >
                            {getIcon(item.action)}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-cyan)] transition-colors">
                                {item.details}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span
                                    className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/20"
                                    style={{ color: color }}
                                >
                                    {item.action}
                                </span>
                                <span className="text-[10px] font-medium text-[var(--text-dim)]">
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] opacity-20 group-hover:bg-[var(--accent-emerald)] group-hover:opacity-100 transition-all shadow-[0_0_8px_var(--accent-emerald)]" />
                    </motion.div>
                );
            })}
        </div>
    );
};
