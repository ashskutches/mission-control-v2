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
import { cn } from "@/app/lib/utils";

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
        <div className="is-flex is-flex-direction-column" style={{ gap: '2rem' }}>
            {/* Header / Toolbar */}
            <div className="level is-mobile px-2">
                <div className="level-left">
                    <div className="buttons are-small">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={cn("button is-dark is-uppercase has-text-weight-bold", filter === cat && "is-info")}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="level-right">
                    <div className="tabs is-toggle is-small is-rounded mb-0">
                        <ul>
                            <li className={cn(viewMode === 'grid' && "is-active")}>
                                <a onClick={() => setViewMode("grid")}>
                                    <span className="icon is-small"><LayoutGrid size={14} /></span>
                                    <span>Grid</span>
                                </a>
                            </li>
                            <li className={cn(viewMode === 'timeline' && "is-active")}>
                                <a onClick={() => setViewMode("timeline")}>
                                    <span className="icon is-small"><History size={14} /></span>
                                    <span>Time</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Neural Content */}
            <div className="columns is-multiline">
                <AnimatePresence mode="popLayout">
                    {filteredFacts.map((fact, i) => (
                        <div key={fact.key} className={cn("column", viewMode === 'grid' ? "is-4" : "is-12")}>
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3, delay: i * 0.02 }}
                                className="box p-5 is-relative overflow-hidden group mb-0"
                                style={{
                                    minHeight: viewMode === 'grid' ? '180px' : 'auto',
                                    background: 'rgba(255,255,255,0.02) !important',
                                    border: '1px solid var(--glass-border)'
                                }}
                            >
                                {/* Activity Bar */}
                                <div
                                    className="is-absolute"
                                    style={{
                                        top: 0,
                                        left: 0,
                                        width: '4px',
                                        height: '100%',
                                        backgroundColor: getSynapseColor(fact.category),
                                        opacity: 0.4
                                    }}
                                />

                                <div className="media">
                                    {viewMode === 'timeline' && (
                                        <div className="media-left has-text-centered pr-4" style={{ borderRight: '1px solid rgba(255,255,255,0.05)', minWidth: '80px' }}>
                                            <p className="is-size-7 is-uppercase has-text-grey-light has-text-weight-black">{new Date(fact.updated_at).toLocaleString('en-US', { month: 'short' })}</p>
                                            <p className="is-size-3 has-text-white has-text-weight-black leading-none">{new Date(fact.updated_at).getDate()}</p>
                                        </div>
                                    )}
                                    <div className="media-content">
                                        <div className="content">
                                            <div className="is-flex is-justify-content-between is-align-items-center mb-3">
                                                <span
                                                    className="tag is-black is-size-7 is-uppercase has-text-weight-black"
                                                    style={{ color: getSynapseColor(fact.category), border: `1px solid ${getSynapseColor(fact.category)}33` }}
                                                >
                                                    {fact.category || "General"}
                                                </span>
                                                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                                    <Zap size={10} className="has-text-warning animate-pulse" />
                                                    <span className="is-size-7 has-text-grey" style={{ fontSize: '9px' }}>NODE_{i + 1024}</span>
                                                </div>
                                            </div>
                                            <h4 className="title is-size-6 has-text-weight-black has-text-white mb-3">
                                                {fact.key.replace(/_/g, " ")}
                                            </h4>
                                            <p className="is-size-7 has-text-grey-light italic" style={{ lineHeight: '1.5' }}>
                                                {fact.value}
                                            </p>
                                        </div>

                                        {viewMode === 'grid' && (
                                            <div className="is-flex is-justify-content-between is-align-items-center mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                                    <Clock size={12} className="has-text-info" />
                                                    <span className="is-size-7 has-text-grey" style={{ fontSize: '10px' }}>{new Date(fact.updated_at).toLocaleDateString()}</span>
                                                </div>
                                                <Share2 size={12} className="has-text-grey-dark" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </AnimatePresence>

                {filteredFacts.length === 0 && (
                    <div className="column is-12 py-6 has-text-centered box is-shadowless" style={{ background: 'transparent', border: '2px dashed rgba(255,255,255,0.05)' }}>
                        <Filter size={32} className="has-text-grey-dark mb-4 opacity-20 mx-auto" />
                        <h3 className="is-size-6 has-text-grey is-uppercase has-text-weight-black">No Synapses Found</h3>
                        <p className="is-size-7 has-text-grey-dark mt-2">Adjust filters to explore neural network.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
