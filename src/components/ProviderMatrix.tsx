"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";

interface ProviderStats {
    name: string;
    share: number;
    health: "online" | "offline" | "slow";
    color: string;
}

export const ProviderMatrix = ({ stats }: { stats: ProviderStats[] }) => {
    return (
        <div className="flex flex-col gap-8">
            {stats.map((s, i) => (
                <div key={s.name} className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]",
                                s.health === "online" ? "text-[var(--accent-emerald)]" :
                                    s.health === "slow" ? "text-[var(--accent-orange)]" : "text-[var(--accent-rose)]"
                            )} />
                            <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                            {Math.round(s.share)}% ALLOCATION
                        </span>
                    </div>

                    <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.02)]">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.share}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full ring-1 ring-inset ring-white/10"
                            style={{
                                background: `linear-gradient(90deg, ${s.color}dd, ${s.color})`,
                                boxShadow: `0 0 15px ${s.color}44`
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
