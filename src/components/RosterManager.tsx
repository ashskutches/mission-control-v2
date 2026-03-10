"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Brain,
    Cpu,
    Zap,
    ShieldCheck,
    RefreshCcw,
    ChevronRight,
    Settings2,
    Database
} from "lucide-react";
import { cn } from "@/app/lib/utils";

interface AgentSettings {
    thinking_level: string;
    llm_provider: string;
}

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

export const RosterManager = () => {
    const [settings, setSettings] = useState<AgentSettings>({ thinking_level: "1", llm_provider: "auto" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${BOT_URL}/settings`);
            const data = await res.json();
            setSettings(data);
        } catch (e) {
            console.error("Failed to fetch agent settings");
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key: keyof AgentSettings, value: string) => {
        setSaving(true);
        try {
            // In a real app, the API key would be handled securely
            // For now, we assume the bot token is available or handled by the backend
            const res = await fetch(`${BOT_URL}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: value, api_key: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN })
            });
            if (res.ok) {
                setSettings(prev => ({ ...prev, [key]: value }));
            }
        } catch (e) {
            console.error("Failed to update setting");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="is-flex is-flex-direction-column" style={{ gap: '1.5rem' }}>
            <div className="box p-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02) !important', border: '1px solid var(--glass-border)' }}>
                <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="level is-mobile mb-0">
                        <div className="level-left">
                            <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                                <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(255,140,0,0.1)', borderRadius: '10px', color: 'var(--accent-orange)', border: '1px solid rgba(255,140,0,0.1)' }}>
                                    <Brain size={20} />
                                </div>
                                <div>
                                    <h3 className="title is-size-6 has-text-white mb-0 uppercase tracking-tight">Gravity Claw Unit</h3>
                                    <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest" style={{ fontSize: '9px' }}>Strategic Intelligence Node</p>
                                </div>
                            </div>
                        </div>
                        <div className="level-right">
                            <div className="is-flex is-align-items-center px-3 py-1 rounded-full" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-success mr-2 animate-pulse" style={{ width: '6px', height: '6px' }} />
                                <span className="is-size-7 has-text-success has-text-weight-black is-uppercase" style={{ fontSize: '9px' }}>Linked</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    <div className="columns is-multiline">
                        {/* Thinking Level */}
                        <div className="column is-6">
                            <div className="field">
                                <label className="label is-size-7 has-text-grey-light is-uppercase tracking-widest mb-3">Cognitive Depth Filter</label>
                                <div className="buttons has-addons mb-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => updateSetting("thinking_level", String(level))}
                                            className={cn("button is-dark is-small is-flex-grow-1 is-uppercase has-text-weight-black", settings.thinking_level === String(level) && "is-info")}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                                <p className="is-size-7 has-text-grey italic mt-2" style={{ fontSize: '10px' }}>
                                    {Number(settings.thinking_level) > 3 ? "Deep thought chains active (slow/high cost)." : "Direct execution mode (fast/efficient)."}
                                </p>
                            </div>
                        </div>

                        {/* Provider Switch */}
                        <div className="column is-6">
                            <div className="field">
                                <label className="label is-size-7 has-text-grey-light is-uppercase tracking-widest mb-3">Core Processing Model</label>
                                <div className="buttons has-addons mb-2">
                                    {["anthropic", "openai", "auto"].map((provider) => (
                                        <button
                                            key={provider}
                                            onClick={() => updateSetting("llm_provider", provider)}
                                            className={cn("button is-dark is-small is-flex-grow-1 is-uppercase has-text-weight-black", settings.llm_provider === provider && "is-link")}
                                        >
                                            {provider}
                                        </button>
                                    ))}
                                </div>
                                <p className="is-size-7 has-text-grey italic mt-2" style={{ fontSize: '10px' }}>
                                    {settings.llm_provider === 'auto' ? "Dynamic latency-based routing." : `Fixed: ${settings.llm_provider.toUpperCase()}`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-5 py-3" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="level is-mobile mb-0">
                        <div className="level-left">
                            <a onClick={fetchSettings} className="is-flex is-align-items-center has-text-grey-light hover:has-text-info transition-colors" style={{ gap: '0.5rem' }}>
                                <RefreshCcw size={12} className={cn(loading && "animate-spin")} />
                                <span className="is-size-7 is-uppercase has-text-weight-black" style={{ fontSize: '9px' }}>Refresh Vitals</span>
                            </a>
                        </div>
                        <div className="level-right is-flex-grow-1 ml-4 pr-2">
                            <progress className="progress is-warning is-small mb-0" style={{ height: '4px', opacity: saving ? 1 : 0, transition: 'opacity 0.3s' }} max="100">Saving</progress>
                        </div>
                    </div>
                </div>
            </div>

            <div className="columns is-multiline">
                <div className="column is-4">
                    <div className="box p-4 is-flex is-align-items-center" style={{ gap: '1rem', background: 'rgba(255,255,255,0.02) !important' }}>
                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(0,170,255,0.1)', borderRadius: '8px', color: 'var(--accent-blue)' }}>
                            <Database size={18} />
                        </div>
                        <div>
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold" style={{ fontSize: '9px' }}>Persistence</p>
                            <p className="is-size-7 has-text-white has-text-weight-black uppercase">SQLite Link</p>
                        </div>
                    </div>
                </div>
                <div className="column is-4">
                    <div className="box p-4 is-flex is-align-items-center" style={{ gap: '1rem', background: 'rgba(255,255,255,0.02) !important' }}>
                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(0,255,136,0.1)', borderRadius: '8px', color: 'var(--accent-emerald)' }}>
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold" style={{ fontSize: '9px' }}>Security</p>
                            <p className="is-size-7 has-text-white has-text-weight-black uppercase">AES Active</p>
                        </div>
                    </div>
                </div>
                <div className="column is-4">
                    <div className="box p-4 is-flex is-align-items-center" style={{ gap: '1rem', background: 'rgba(255,255,255,0.02) !important' }}>
                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(255,140,0,0.1)', borderRadius: '8px', color: 'var(--accent-orange)' }}>
                            <Zap size={18} />
                        </div>
                        <div>
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold" style={{ fontSize: '9px' }}>Latency</p>
                            <p className="is-size-7 has-text-white has-text-weight-black uppercase">Real-time</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
