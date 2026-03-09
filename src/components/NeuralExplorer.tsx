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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {facts.map((fact, i) => (
                <motion.div
                    key={fact.key}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass-card"
                    style={{ position: "relative", overflow: "hidden" }}
                >
                    <div style={{ position: "absolute", top: "-10px", right: "-10px", opacity: 0.05 }}>
                        <BrainCircuit size={80} />
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--accent-orange)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
                        {fact.key}
                    </div>

                    <div style={{ fontSize: "15px", lineHeight: "1.6", color: "var(--text-primary)", fontWeight: 400 }}>
                        {fact.value}
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px" }}>
                        <Clock size={12} />
                        <span>Updated {new Date(fact.updated_at).toLocaleDateString()}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
