"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BrainCircuit,
    Clock,
    Filter,
    LayoutGrid,
    ListTree,
    Share2,
    Zap,
    History
} from "lucide-react";

interface Fact {
    key: string;
    value: string;
    category?: string;
    updated_at: string;
}

export const NeuralExplorer = ({ facts }: { facts: Fact[] }) => {
    const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
    const [filter, setFilter] = useState<string>("All");

    const categories = useMemo(() => {
        const cats = new Set(facts.map(f => f.category || "General"));
        return ["All", ...Array.from(cats)];
    }, [facts]);

    const filteredFacts = useMemo(() => {
        let result = filter === "All" ? facts : facts.filter(f => (f.category || "General") === filter);
        return result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }, [facts, filter]);

    const getSynapseColor = (cat?: string) => {
        switch (cat) {
            case "Commerce": return "var(--accent-emerald)";
            case "Operations": return "var(--accent-orange)";
            case "Strategy": return "var(--accent-cyan)";
            case "Intelligence": return "var(--accent-blue)";
            default: return "var(--accent-purple)";
        }
    };

    return (
        <div className="flex flex-col gap-8">
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filter === cat
                                    ? "bg-white/[0.08] border-white/20 text-[var(--text-primary)] shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                    : "bg-white/[0.02] border-white/5 text-[var(--text-dim)] hover:bg-white/[0.04]"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/[0.08] text-[var(--accent-blue)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode("timeline")}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'timeline' ? 'bg-white/[0.08] text-[var(--accent-blue)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                        <History size={18} />
                    </button>
                </div>
            </div>

            {/* Neural Content */}
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                <AnimatePresence mode="popLayout">
                    {filteredFacts.map((fact, i) => (
                        <motion.div
                            key={fact.key}
                            layout
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.3, delay: i * 0.02 }}
                            className={`glass-card relative overflow-hidden group flex flex-col pt-10 p-6 border-[rgba(255,255,255,0.03)] hover:border-[rgba(0,170,255,0.2)] transition-all ${viewMode === 'timeline' ? 'flex-row items-center gap-10 min-h-0' : 'min-h-[220px]'}`}
                        >
                            {/* Visual Weight Decor */}
                            <div
                                className="absolute top-0 left-0 w-1 h-full opacity-30 group-hover:opacity-100 transition-opacity"
                                style={{ backgroundColor: getSynapseColor(fact.category) }}
                            />

                            <div className="absolute top-[-15px] right-[-15px] opacity-[0.02] group-hover:opacity-[0.06] transition-opacity rotate-12">
                                <BrainCircuit size={120} />
                            </div>

                            {/* Timeline Date Label */}
                            {viewMode === 'timeline' && (
                                <div className="flex flex-col items-center justify-center min-w-[100px] border-r border-white/5 pr-10">
                                    <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">{new Date(fact.updated_at).toLocaleString('en-US', { month: 'short' })}</span>
                                    <span className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">{new Date(fact.updated_at).getDate()}</span>
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] mt-1">{new Date(fact.updated_at).getFullYear()}</span>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div
                                        className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded bg-white/[0.04] border border-white/5"
                                        style={{ color: getSynapseColor(fact.category), borderColor: `${getSynapseColor(fact.category)}22` }}
                                    >
                                        {fact.category || "General"} / {fact.key}
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Zap size={10} className="text-[var(--accent-orange)]" />
                                        <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Active Synapse</span>
                                    </div>
                                </div>

                                <div className={`text-[15px] leading-relaxed text-[var(--text-primary)] font-medium ${viewMode === 'timeline' ? 'max-w-2xl' : ''}`}>
                                    {fact.value}
                                </div>

                                {viewMode === 'grid' && (
                                    <div className="mt-auto pt-6 border-t border-[rgba(255,255,255,0.03)] flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                            <Clock size={12} className="text-[var(--accent-blue)]" />
                                            <span>Learned {new Date(fact.updated_at).toLocaleDateString()}</span>
                                        </div>
                                        <Share2 size={12} className="text-white/10 group-hover:text-white/30 transition-colors" />
                                    </div>
                                )}
                            </div>

                            {viewMode === 'timeline' && (
                                <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                    <Clock size={14} className="text-[var(--accent-blue)]" />
                                    {new Date(fact.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredFacts.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center glass-card border-dashed">
                        <Filter size={32} className="text-[var(--text-dim)] mb-4 opacity-20" />
                        <h3 className="text-xl font-black text-[var(--text-dim)] uppercase tracking-tighter">No Synapses Found</h3>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-2">Adjust filters to explore neural network.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
