"use client";
import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Target, Rocket, AlertTriangle } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface GrowthTrackerProps {
    facts?: any[];
}

export const GrowthTracker = ({ facts = [] }: GrowthTrackerProps) => {
    const findFact = (key: string) => facts.find(f => f.key === key)?.value;

    // Data extraction with defaults
    const target = Number(findFact("growth_target")) || 1000000; // $1M ARR default
    const current = Number(findFact("growth_current")) || 642300; // Mocked fallback
    const momentum = findFact("growth_momentum") || "14.2%";
    const progress = (current / target) * 100;

    return (
        <div className="is-flex is-flex-direction-column" style={{ gap: '1.5rem' }}>
            <div className="columns is-multiline">
                <div className="column is-6">
                    <div className="box p-5 is-relative overflow-hidden group" style={{ background: 'rgba(255,255,255,0.02) !important', border: '1px solid var(--glass-border)' }}>
                        <div className="level is-mobile mb-4">
                            <div className="level-left">
                                <div className="is-flex is-align-items-center bg-warning-light p-2 rounded" style={{ gap: '0.5rem', background: 'rgba(255,140,0,0.1)' }}>
                                    <Target size={12} className="has-text-warning" />
                                    <span className="is-size-7 has-text-warning has-text-weight-black is-uppercase tracking-widest" style={{ fontSize: '9px' }}>Objective: 5X Growth</span>
                                </div>
                            </div>
                        </div>
                        <p className="title is-size-3 has-text-white mb-1">${(target / 1000).toLocaleString()}K <span className="is-size-7 has-text-grey">/yr ARR</span></p>
                        <p className="is-size-7 has-text-grey-light italic mb-0">Trajection required for strategic milestones.</p>
                        <TrendingUp className="is-absolute" style={{ bottom: '-10px', right: '-10px', opacity: 0.03, pointerEvents: 'none' }} size={80} />
                    </div>
                </div>

                <div className="column is-6">
                    <div className="box p-5 is-relative overflow-hidden group" style={{ background: 'rgba(255,255,255,0.02) !important', border: '1px solid var(--glass-border)' }}>
                        <div className="level is-mobile mb-4">
                            <div className="level-left">
                                <div className="is-flex is-align-items-center bg-success-light p-2 rounded" style={{ gap: '0.5rem', background: 'rgba(0,255,136,0.1)' }}>
                                    <Rocket size={12} className="has-text-success" />
                                    <span className="is-size-7 has-text-success has-text-weight-black is-uppercase tracking-widest" style={{ fontSize: '9px' }}>Momentum</span>
                                </div>
                            </div>
                        </div>
                        <p className="title is-size-3 has-text-white mb-1">${(current / 1000).toLocaleString()}K <span className="is-size-7 has-text-grey">Trajectory</span></p>
                        <p className="is-size-7 has-text-success has-text-weight-bold uppercase tracking-widest" style={{ fontSize: '10px' }}>↑ {momentum} FROM PREV PERIOD</p>
                    </div>
                </div>
            </div>

            <div className="box p-6" style={{ background: 'rgba(255,255,255,0.02) !important', border: '1px solid var(--glass-border)' }}>
                <div className="level is-mobile mb-5">
                    <div className="level-left">
                        <div>
                            <p className="is-size-7 has-text-grey-light is-uppercase has-text-weight-black mb-1">Mission Progress</p>
                            <h4 className="title is-size-5 has-text-white mb-0">Phase Alpha Completion: {progress.toFixed(1)}%</h4>
                        </div>
                    </div>
                    <div className="level-right">
                        <span className="tag is-black has-text-weight-black has-text-info">STRATEGIC NODE</span>
                    </div>
                </div>

                <div className="is-relative mb-4">
                    <progress className="progress is-info is-small" value={progress} max="100">{progress}%</progress>
                </div>

                <div className="columns is-mobile is-gapless mb-0">
                    {[25, 50, 75, 100].map((mark) => (
                        <div key={mark} className="column has-text-centered">
                            <div style={{ height: '4px', background: progress >= mark ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)', borderRadius: '2px', marginBottom: '8px' }} />
                            <span className="is-size-7 has-text-grey has-text-weight-black" style={{ fontSize: '8px' }}>{mark}%</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="notification is-warning is-light p-4" style={{ background: 'rgba(255,140,0,0.05)', border: '1px solid rgba(255,140,0,0.2)' }}>
                <div className="media is-align-items-center">
                    <div className="media-left">
                        <AlertTriangle size={16} className="has-text-warning" />
                    </div>
                    <div className="media-content">
                        <p className="is-size-7 has-text-warning has-text-weight-black is-uppercase tracking-widest">
                            Critical Gap Detected: 35.8% increase in conversion required for $1M target.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
