"use client";
import React from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Clock } from "lucide-react";

interface Fact {
    key: string;
    value: string;
    updated_at: string;
}

export const NeuralExplorer = ({ facts }: { facts: Fact[] }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facts.map((fact, i) => (
                <motion.div
                    key={fact.key}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, ease: "easeOut" }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className="glass-card relative overflow-hidden group min-h-[200px] flex flex-col pt-8"
                >
                    <div className="absolute top-[-10px] right-[-10px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <BrainCircuit size={100} />
                    </div>

                    <div className="text-[10px] font-black text-[var(--accent-orange)] uppercase tracking-[0.2em] mb-4 bg-[rgba(255,140,0,0.05)] w-fit px-2 py-1 rounded">
                        {fact.key}
                    </div>

                    <div className="text-[15px] leading-relaxed text-[var(--text-primary)] font-medium flex-1">
                        {fact.value}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.03)] flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        <Clock size={12} className="text-[var(--accent-blue)]" />
                        <span>SYNAPSE UPDATED {new Date(fact.updated_at).toLocaleDateString()}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
