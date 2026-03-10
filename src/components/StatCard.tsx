"use client";
import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    color?: string;
    trend?: "up" | "down" | "neutral";
    icon?: LucideIcon;
}

export const StatCard = ({ label, value, subValue, color = "var(--accent-blue)", trend, icon: Icon }: StatCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="glass-card flex flex-col gap-4 relative overflow-hidden"
        >
            <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        {label}
                    </span>
                    <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        {value}
                    </span>
                </div>
                {Icon && (
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center opacity-80"
                        style={{ background: `${color}15`, color: color }}
                    >
                        <Icon size={20} />
                    </div>
                )}
            </div>

            {subValue && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] relative z-10">
                    {trend === "up" && <span className="text-[var(--accent-emerald)] text-[10px]">▲</span>}
                    {trend === "down" && <span className="text-[var(--accent-rose)] text-[10px]">▼</span>}
                    <span>{subValue}</span>
                </div>
            )}

            {/* Decorative Sparkle Glow */}
            <div
                className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}
            />
        </motion.div>
    );
};
