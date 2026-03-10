"use client";
import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Target, Rocket, AlertTriangle } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface GrowthTrackerProps {
    facts?: any[];
}

export const GrowthTracker = ({ facts = [] }: GrowthTrackerProps) => {
    const findFact = (key: string) => facts.find(f => f.key === key)?.value;

    // Data extraction with defaults
    const target = Number(findFact("growth_target")) || 1000000; // $1M ARR default
    const current = Number(findFact("growth_current")) || 642300; // Mocked fallback
    const momentum = findFact("growth_momentum") || "14.2%";
    const progress = (current / target) * 100;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-6 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-[10px] font-black text-[var(--accent-orange)] uppercase tracking-widest bg-orange-500/10 w-fit px-2 py-1 rounded">
                        <Target size={12} />
                        Objective: 5X Growth
                    </div>
                    <div className="text-3xl font-black text-[var(--text-primary)] mt-2">${(target / 1000).toLocaleString()}K <span className="text-sm font-bold text-[var(--text-dim)]">/yr ARR</span></div>
                    <p className="text-xs font-medium text-[var(--text-secondary)] mt-1 leading-relaxed">
                        Trajectory required for next 12 months to hit strategic milestones.
                    </p>
                    <TrendingUp className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] group-hover:opacity-[0.1] transition-opacity" size={100} />
                </div>

                <div className="glass-card p-6 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-[10px] font-black text-[var(--accent-emerald)] uppercase tracking-widest bg-emerald-500/10 w-fit px-2 py-1 rounded">
                        <Rocket size={12} />
                        Current Momentum
                    </div>
                    <div className="text-3xl font-black text-[var(--text-primary)] mt-2">${(current / 1000).toLocaleString()}K <span className="text-sm font-bold text-[var(--text-dim)]">Trajectory</span></div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-emerald)] mt-1">
                        <span>↑ {momentum} from last month</span>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <div className="flex justify-between items-end mb-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Growth Progress</span>
                        <span className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Mission Completion: {progress.toFixed(1)}%</span>
                    </div>
                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">Economic Phase Alpha</span>
                </div>

                <div className="h-4 w-full bg-[var(--bg-elevated)] rounded-full border border-white/5 overflow-hidden relative shadow-inner">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-purple)] to-[var(--accent-cyan)] rounded-full relative"
                    >
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-y-0 right-0 w-8 bg-white/20 blur-md"
                        />
                    </motion.div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                    {[25, 50, 75, 100].map((mark) => (
                        <div key={mark} className="flex flex-col gap-1">
                            <div className={cn(
                                "h-1 w-full rounded-full transition-colors",
                                progress >= mark ? "bg-[var(--accent-cyan)]" : "bg-white/5"
                            )} />
                            <span className="text-[8px] font-bold text-[var(--text-dim)] text-center uppercase">{mark}%</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/20 animate-pulse">
                <AlertTriangle size={14} className="text-[var(--accent-orange)]" />
                <span className="text-[10px] font-black text-[var(--accent-orange)] uppercase tracking-widest">
                    Critical Gap Detected: 35.8% increase in automated lead conversion required to hit $1M.
                </span>
            </div>
        </div>
    );
};
