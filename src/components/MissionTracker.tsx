"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Flag,
    Target,
    TrendingUp,
    CheckCircle2,
    Clock,
    Plus,
    BarChart3,
    ArrowUpRight
} from "lucide-react";

import { cn } from "@/app/lib/utils";

interface Mission {
    id: string;
    title: string;
    target: number;
    current: number;
    deadline: string;
    status: "active" | "completed" | "at-risk";
}

export const MissionTracker = () => {
    const [missions, setMissions] = useState<Mission[]>([
        {
            id: "1",
            title: "5X Growth: $1M ARR",
            target: 1000000,
            current: 42300 * 12,
            deadline: "2026-12-31",
            status: "active"
        }
    ]);

    const calculateProgress = (m: Mission) => Math.min(100, (m.current / m.target) * 100);

    return (
        <div className="is-flex is-flex-direction-column" style={{ gap: '1.5rem' }}>
            <div className="level is-mobile mb-2 pr-2">
                <div className="level-left">
                    <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: '40px', height: '40px', background: 'rgba(0,170,255,0.1)', borderRadius: '10px', color: 'var(--accent-blue)', border: '1px solid rgba(0,170,255,0.1)' }}>
                            <Target size={20} />
                        </div>
                        <div>
                            <h3 className="title is-size-5 has-text-white mb-0 uppercase tracking-tight">Strategic Missions</h3>
                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-bold tracking-widest" style={{ fontSize: '9px' }}>Objective Alignment Log</p>
                        </div>
                    </div>
                </div>
                <div className="level-right">
                    <button className="button is-dark is-small is-uppercase has-text-weight-black">
                        <Plus size={14} className="mr-2" />
                        Deploy Node
                    </button>
                </div>
            </div>

            <div className="columns is-multiline">
                {missions.map((mission) => (
                    <div key={mission.id} className="column is-12">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="box p-6 is-relative overflow-hidden group mb-0"
                            style={{ background: 'rgba(255,255,255,0.02) !important', border: '1px solid var(--glass-border)' }}
                        >
                            <div className="columns is-vcentered">
                                <div className="column">
                                    <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.75rem' }}>
                                        <div className={cn("w-2 h-2 rounded-full", mission.status === 'active' ? "bg-info animate-pulse shadow-sm" : "bg-success")} style={{ width: '8px', height: '8px' }} />
                                        <h4 className="title is-size-5 has-text-white mb-0 uppercase tracking-tight">{mission.title}</h4>
                                    </div>
                                    <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                                        <div className="is-flex is-align-items-center" style={{ gap: '0.4rem' }}>
                                            <Clock size={12} className="has-text-grey" />
                                            <span className="is-size-7 has-text-grey is-uppercase has-text-weight-bold" style={{ fontSize: '10px' }}>EOY 2026 Target</span>
                                        </div>
                                        <span className="tag is-black is-size-7 has-text-weight-black has-text-info">ACTIVE PROTOCOL</span>
                                    </div>
                                </div>
                                <div className="column is-narrow has-text-right">
                                    <div className="columns is-mobile is-gapless">
                                        <div className="column is-narrow px-4" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-black" style={{ fontSize: '8px' }}>Current Pace</p>
                                            <p className="subtitle is-size-4 has-text-white has-text-weight-black mb-0">${(mission.current / 1000).toFixed(1)}K</p>
                                        </div>
                                        <div className="column is-narrow px-4">
                                            <p className="is-size-7 has-text-grey is-uppercase has-text-weight-black" style={{ fontSize: '8px' }}>Objective</p>
                                            <p className="subtitle is-size-4 has-text-info has-text-weight-black mb-0">${(mission.target / 1000000).toFixed(1)}M</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 mb-5">
                                <div className="is-flex is-justify-content-between mb-2">
                                    <span className="is-size-7 has-text-grey-light is-uppercase has-text-weight-black">Completion Density: {calculateProgress(mission).toFixed(1)}%</span>
                                    <span className="is-size-7 has-text-grey italic" style={{ fontSize: '9px' }}>Real-time Trajectory Integration</span>
                                </div>
                                <progress className="progress is-info is-small" value={calculateProgress(mission)} max="100">{calculateProgress(mission)}%</progress>
                            </div>

                            <div className="columns is-mobile is-multiline mt-2">
                                <div className="column is-4">
                                    <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                        <TrendingUp size={14} className="has-text-info" />
                                        <span className="is-size-7 has-text-grey-light has-text-weight-bold uppercase" style={{ fontSize: '10px' }}>MTD Delta: +24%</span>
                                    </div>
                                </div>
                                <div className="column is-4">
                                    <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                        <ArrowUpRight size={14} className="has-text-success" />
                                        <span className="is-size-7 has-text-grey-light has-text-weight-bold uppercase" style={{ fontSize: '10px' }}>ROC Efficiency: 48.2x</span>
                                    </div>
                                </div>
                                <div className="column is-4">
                                    <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                        <CheckCircle2 size={14} className="has-text-grey" />
                                        <span className="is-size-7 has-text-grey-light has-text-weight-bold uppercase" style={{ fontSize: '10px' }}>Nodes: 14/14</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                ))}
            </div>
        </div>
    );
};
