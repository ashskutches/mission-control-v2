"use client";
import React from "react";
import { motion } from "framer-motion";

interface ProviderStats {
    name: string;
    share: number;
    health: "online" | "offline" | "slow";
    color: string;
}

export const ProviderMatrix = ({ stats }: { stats: ProviderStats[] }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {stats.map((s) => (
                <div key={s.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="status-dot" style={{ background: s.health === "online" ? "var(--accent-emerald)" : s.health === "slow" ? "var(--accent-orange)" : "var(--accent-rose)" }} />
                            <span style={{ fontWeight: 700, fontSize: "14px" }}>{s.name}</span>
                        </div>
                        <span className="mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{Math.round(s.share)}% ALLOCATION</span>
                    </div>

                    <div style={{ height: "8px", background: "var(--bg-elevated)", borderRadius: "99px", overflow: "hidden" }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.share}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{ height: "100%", background: s.color, boxShadow: `0 0 10px ${s.color}66` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
