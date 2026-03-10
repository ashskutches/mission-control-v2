"use client";
import React from "react";
import { motion } from "framer-motion";
import { Activity, Shield, MessageSquare, Database, Code2, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";

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
        case "dev_proposal": return <Code2 size={16} />;
        case "message": return <MessageSquare size={16} />;
        case "synergy_handshake": return <Sparkles size={16} />;
        case "health_check": return <Shield size={16} />;
        default: return <Activity size={16} />;
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
        <div className="is-flex is-flex-direction-column" style={{ gap: '1rem' }}>
            {items.map((item, i) => {
                const color = getActionColor(item.action);

                return (
                    <motion.article
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="media box p-3 is-shadowless mb-0"
                        style={{
                            background: 'rgba(255,255,255,0.02) !important',
                            border: '1px solid var(--glass-border)'
                        }}
                    >
                        <figure className="media-left">
                            <div
                                className="is-flex is-justify-content-center is-align-items-center"
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: `${color}15`,
                                    color: color,
                                    border: `1px solid ${color}30`
                                }}
                            >
                                {getIcon(item.action)}
                            </div>
                        </figure>
                        <div className="media-content">
                            <div className="content">
                                <p className="mb-1">
                                    <strong className="has-text-white is-size-7">{item.details}</strong>
                                </p>
                                <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
                                    <span
                                        className="tag is-black is-uppercase has-text-weight-black"
                                        style={{ color: color, fontSize: '8px', padding: '0 0.5rem', height: '1.5em' }}
                                    >
                                        {item.action}
                                    </span>
                                    <small className="has-text-grey" style={{ fontSize: '10px' }}>
                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="media-right is-flex is-align-items-center">
                            <div
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: color,
                                    opacity: 0.3
                                }}
                            />
                        </div>
                    </motion.article>
                );
            })}
        </div>
    );
};
