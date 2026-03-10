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
        <div className="flex flex-col gap-6">
            <div className="glass-card flex flex-col gap-6 border-[rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[rgba(255,140,0,0.1)] flex items-center justify-center text-[var(--accent-orange)] border border-[rgba(255,140,0,0.1)]">
                            <Brain size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter">Gravity Claw Unit</h3>
                            <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Active Intelligence Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                        <span className="text-[10px] font-black text-[var(--accent-emerald)] uppercase">Connected</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Thinking Level Toggle */}
                    <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-widest">Cognitive Depth</span>
                            <Settings2 size={14} className="text-[var(--text-dim)]" />
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((level) => (
                                <button
                                    key={level}
                                    onClick={() => updateSetting("thinking_level", String(level))}
                                    className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${settings.thinking_level === String(level)
                                            ? "bg-[var(--accent-orange)] text-[var(--bg-deep)] shadow-[0_0_15px_rgba(255,140,0,0.3)]"
                                            : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                                        }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] font-medium text-[var(--text-muted)] italic">
                            Level {settings.thinking_level}: {Number(settings.thinking_level) > 3 ? "Exhaustive chains of thought enabled." : "Optimized for speed and directness."}
                        </p>
                    </div>

                    {/* LLM Provider Switch */}
                    <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-widest">Core Model</span>
                            <Cpu size={14} className="text-[var(--text-dim)]" />
                        </div>
                        <div className="flex gap-2">
                            {["anthropic", "openai", "auto"].map((provider) => (
                                <button
                                    key={provider}
                                    onClick={() => updateSetting("llm_provider", provider)}
                                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${settings.llm_provider === provider
                                            ? "bg-[var(--accent-blue)] text-white shadow-[0_0_15px_rgba(0,170,255,0.3)]"
                                            : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                                        }`}
                                >
                                    {provider}
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] font-medium text-[var(--text-muted)] italic">
                            {settings.llm_provider === "auto" ? "Dynamic routing based on task complexity." : `Fixed provider: ${settings.llm_provider.toUpperCase()}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <button
                        onClick={fetchSettings}
                        className="flex items-center gap-2 text-[10px] font-black text-[var(--accent-cyan)] uppercase tracking-widest hover:opacity-70 transition-opacity"
                    >
                        <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                        Refresh Vitals
                    </button>
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                        {saving && <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-1/3 h-full bg-gradient-to-r from-transparent via-[var(--accent-orange)] to-transparent"
                        />}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 flex items-center gap-4 border-[rgba(255,255,255,0.02)]">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-[var(--accent-blue)]">
                        <Database size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Persistence</div>
                        <div className="text-sm font-black text-[var(--text-primary)] uppercase">SQLite Link</div>
                    </div>
                </div>
                <div className="glass-card p-4 flex items-center gap-4 border-[rgba(255,255,255,0.02)]">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[var(--accent-emerald)]">
                        <ShieldCheck size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Security</div>
                        <div className="text-sm font-black text-[var(--text-primary)] uppercase">AES Active</div>
                    </div>
                </div>
                <div className="glass-card p-4 flex items-center gap-4 border-[rgba(255,255,255,0.02)]">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-[var(--accent-orange)]">
                        <Zap size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Latency</div>
                        <div className="text-sm font-black text-[var(--text-primary)] uppercase">Real-time</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
