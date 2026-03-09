"use client";
import React from "react";
import { motion } from "framer-motion";
import { Github, Zap, Shield, MessageSquare, Database, Activity } from "lucide-react";

interface SynergyItem {
    id: string;
    action: string;
    details: string;
    created_at: string;
    status: string;
}

const getIcon = (action: string) => {
    switch (action) {
        case "tool_use": return <Database size={16} />;
        case "dev_proposal": return <Github size={16} />;
        case "message": return <MessageSquare size={16} />;
        case "synergy_handshake": return <Zap size={16} />;
        case "health_check": return <Shield size={16} />;
        default: return <Activity size={16} />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case "dev_proposal": return "var(--accent-orange)";
        case "synergy_handshake": return "var(--accent-blue)";
        case "tool_use": return "var(--accent-emerald)";
        case "error": return "var(--accent-rose)";
        default: return "var(--text-muted)";
    }
};

export const SynergyFeed = ({ items }: { items: SynergyItem[] }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {items.map((item, i) => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card"
                    style={{ padding: "16px", display: "flex", alignItems: "flex-start", gap: "16px" }}
                >
                    <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "var(--bg-elevated)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: getActionColor(item.action),
                        border: `1px solid ${getActionColor(item.action)}22`
                    }}>
                        {getIcon(item.action)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{item.details}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "8px", textTransform: "uppercase" }}>
                            <span className="mono" style={{ color: getActionColor(item.action) }}>{item.action}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
