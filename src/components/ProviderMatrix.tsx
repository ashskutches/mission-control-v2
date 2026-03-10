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
        <div className="is-flex is-flex-direction-column" style={{ gap: '1.5rem' }}>
            {stats.map((s, i) => (
                <div key={s.name} className="p-0">
                    <div className="level is-mobile mb-2">
                        <div className="level-left">
                            <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
                                <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    s.health === "online" ? "bg-success shadow-[0_0_8px_rgba(0,255,136,0.4)]" :
                                        s.health === "slow" ? "bg-warning shadow-[0_0_8px_rgba(255,140,0,0.4)]" : "bg-danger"
                                )} style={{ width: '8px', height: '8px' }} />
                                <span className="is-size-7 font-bold text-white tracking-wide">{s.name}</span>
                            </div>
                        </div>
                        <div className="level-right">
                            <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: '9px' }}>
                                {Math.round(s.share)}% NODE WEIGHT
                            </span>
                        </div>
                    </div>

                    <div className="is-relative">
                        <progress
                            className={cn(
                                "progress is-small",
                                s.health === 'online' ? "is-info" : s.health === 'slow' ? "is-warning" : "is-danger"
                            )}
                            value={s.share}
                            max="100"
                        >
                            {s.share}%
                        </progress>
                    </div>
                </div>
            ))}
        </div>
    );
};
