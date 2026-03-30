"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { APP_CONFIG } from "@/app/lib/AppConfig";

export interface SquadAgent {
    id: string;
    href: string;
    label: string;
    icon: React.ElementType;
    description: string;
    complexity?: "Low" | "Medium" | "High";
    tags?: string[];
}

export interface SquadConfig {
    squadId: string;
    squadName: string;
    subtitle: string;
    accentColor: string;
    icon: React.ElementType;
    description: string;
    agents: SquadAgent[];
}

export default function SquadOverviewPage({ config }: { config: SquadConfig }) {
    const router = useRouter();
    const { squadName, subtitle, accentColor, icon: SquadIcon, description, agents } = config;

    return (
        <div className="px-4 pb-6 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* Squad Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem" }}>
                <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `${accentColor}18`, border: `1px solid ${accentColor}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <SquadIcon size={24} style={{ color: accentColor }} />
                </div>
                <div>
                    <h1 className="title is-size-4 has-text-white mb-1" style={{ fontWeight: 900 }}>
                        {squadName}
                    </h1>
                    <p className="is-size-7 has-text-grey" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                        {subtitle}
                    </p>
                    <p className="is-size-7 has-text-grey-light" style={{ maxWidth: 560 }}>
                        {description}
                    </p>
                </div>
            </div>

            {/* Agents Grid */}
            <div>
                <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>
                    Agent Roster — {agents.length} units
                </p>
                <div className="columns is-multiline">
                    {agents.map((agent) => {
                        const Icon = agent.icon;
                        const complexityColor = agent.complexity === "High" ? "#f43f5e" : agent.complexity === "Medium" ? "#f59e0b" : "#10b981";
                        return (
                            <div key={agent.id} className="column is-6">
                                <div
                                    className="box p-5"
                                    onClick={() => router.push(agent.href)}
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: `1px solid rgba(255,255,255,0.06)`,
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                        height: "100%",
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.border = `1px solid ${accentColor}40`;
                                        (e.currentTarget as HTMLElement).style.background = `${accentColor}08`;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.06)";
                                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: 10,
                                            background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
                                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        }}>
                                            <Icon size={17} style={{ color: accentColor }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p className="is-size-7 has-text-weight-black has-text-white" style={{ marginBottom: 2 }}>
                                                {agent.label}
                                            </p>
                                            {agent.complexity && (
                                                <span style={{
                                                    display: "inline-block", padding: "1px 7px", borderRadius: 20,
                                                    fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
                                                    letterSpacing: "0.06em", background: `${complexityColor}18`,
                                                    color: complexityColor, border: `1px solid ${complexityColor}30`,
                                                }}>
                                                    {agent.complexity} complexity
                                                </span>
                                            )}
                                        </div>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </div>
                                    <p className="is-size-7 has-text-grey" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                        {agent.description}
                                    </p>
                                    {agent.tags && agent.tags.length > 0 && (
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "0.6rem" }}>
                                            {agent.tags.map(t => (
                                                <span key={t} style={{
                                                    fontSize: 9, padding: "2px 6px", borderRadius: 12,
                                                    background: "rgba(255,255,255,0.05)", color: "#888",
                                                    textTransform: "uppercase", letterSpacing: "0.05em",
                                                }}>
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
