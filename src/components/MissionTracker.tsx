"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Flag,
    Target,
    TrendingUp,
    CheckCircle2,
    Clock,
    Plus,
    BarChart3,
    ArrowUpRight
} from "lucide-react";

interface Mission {
    id: string;
    title: string;
    target: number;
    current: number;
    deadline: string;
    status: "active" | "completed" | "at-risk";
}

export const MissionTracker = () => {
    const [missions, setMissions] = useState<Mission[]>([
        {
            id: "1",
            title: "5X Growth: $1M ARR",
            target: 1000000,
            current: 42300 * 12,
            deadline: "2026-12-31",
            status: "active"
        }
    ]);

    const calculateProgress = (m: Mission) => Math.min(100, (m.current / m.target) * 100);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(0,170,255,0.1)] flex items-center justify-center text-[var(--accent-blue)] border border-[rgba(0,170,255,0.1)]">
                        <Target size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Strategic Missions</h3>
                        <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Autonomous Goal Alignment</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest hover:bg-white/[0.08] transition-all">
                    <Plus size={14} />
                    New Deploy
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {missions.map((mission) => (
                    <motion.div
                        key={mission.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 flex flex-col gap-6 border-[rgba(255,255,255,0.03)] group hover:border-[rgba(0,170,255,0.3)] transition-all overflow-hidden relative"
                    >
                        {/* Background Pulse */}
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Flag size={80} />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${mission.status === 'active' ? 'bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)] animate-pulse' : 'bg-emerald-500'}`} />
                                    <h4 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">{mission.title}</h4>
                                </div>
                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Clock size={10} />
                                    Deadline: {new Date(mission.deadline).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Current Run Rate</span>
                                    <span className="text-xl font-black text-[var(--text-primary)]">${(mission.current / 1000).toFixed(1)}K</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Objective</span>
                                    <span className="text-xl font-black text-[var(--accent-blue)]">${(mission.target / 1000000).toFixed(1)}M</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 relative z-10">
                            <div className="flex justify-between items-end">
                                <span className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                                    Mission Completion: <span className="text-[var(--accent-blue)]">{calculateProgress(mission).toFixed(1)}%</span>
                                </span>
                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase italic">Autonomous Tracking Active</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-px">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${calculateProgress(mission)}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-cyan)] to-[var(--accent-blue)] rounded-full shadow-[0_0_15px_rgba(0,170,255,0.4)]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 relative z-10">
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                                <TrendingUp size={14} className="text-[var(--accent-cyan)]" />
                                <div className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tight">MTD Momentum: +24%</div>
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                                <ArrowUpRight size={14} className="text-[var(--accent-emerald)]" />
                                <div className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tight">Rev Over Cost: 48.2x</div>
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-[var(--text-dim)]" />
                                <div className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tight">Nodes Active: 14/14</div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
