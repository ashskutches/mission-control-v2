"use client";
import React from "react";
import { motion } from "framer-motion";

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    color?: string;
    trend?: "up" | "down" | "neutral";
}

export const StatCard = ({ label, value, subValue, color = "var(--accent-blue)", trend }: StatCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ borderLeft: `4px solid ${color}` }}
        >
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "8px", fontFamily: "Outfit" }}>{value}</div>
            {subValue && (
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {trend === "up" && <span style={{ color: "var(--accent-emerald)" }}>↑ </span>}
                    {trend === "down" && <span style={{ color: "var(--accent-rose)" }}>↓ </span>}
                    {subValue}
                </div>
            )}
        </motion.div>
    );
};
