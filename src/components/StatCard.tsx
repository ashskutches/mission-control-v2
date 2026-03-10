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
    icon: LucideIcon;
}

export const StatCard = ({ label, value, subValue, color = "var(--accent-blue)", trend, icon: Icon }: StatCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="box p-5 is-flex is-flex-direction-column"
            style={{
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                justifyContent: 'space-between'
            }}
        >
            <div className="level is-mobile mb-4">
                <div className="level-left">
                    <div className="level-item">
                        <div>
                            <p className="heading has-text-grey-light mb-1" style={{ letterSpacing: '0.1em' }}>{label}</p>
                            <p className="title is-size-3 mb-0" style={{ letterSpacing: '-0.02em' }}>{value}</p>
                        </div>
                    </div>
                </div>
                <div className="level-right">
                    <div className="level-item">
                        <div
                            className="is-flex is-justify-content-center is-align-items-center"
                            style={{
                                width: '42px',
                                height: '42px',
                                padding: '8px',
                                borderRadius: '12px',
                                background: `${color}15`,
                                color: color
                            }}
                        >
                            <Icon size={22} />
                        </div>
                    </div>
                </div>
            </div>

            {subValue && (
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                    {trend === "up" && <span className="has-text-success" style={{ fontSize: '10px' }}>▲</span>}
                    {trend === "down" && <span className="has-text-danger" style={{ fontSize: '10px' }}>▼</span>}
                    <span className="is-size-7 has-text-grey-light has-text-weight-semibold">{subValue}</span>
                </div>
            )}

            {/* Accent Glow */}
            <div
                style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '60px',
                    height: '60px',
                    background: color,
                    filter: 'blur(40px)',
                    opacity: 0.1,
                    pointerEvents: 'none'
                }}
            />
        </motion.div>
    );
};
