"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SQUADS } from "@/app/lib/AppConfig";
import { StatCard } from "@/components/StatCard";
import { ShoppingBag, TrendingUp, BarChart3 } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const SQUAD_AGENTS: Record<string, string[]> = {
    acquisition: ["Media Buying", "Creator & Outreach", "Social Presence", "Search Visibility"],
    conversion: ["Experimentation", "Pricing & Intel", "Catalog Architect", "Revenue Max"],
    ops: ["Resolution Specialist", "Logistics Optimizer", "Community Support"],
    strategy: ["Profitability Sentinel", "Brand Sentinel"],
};

const SQUAD_HREFS: Record<string, string> = {
    acquisition: "/commerce/acquisition",
    conversion: "/commerce/conversion",
    ops: "/commerce/ops",
    strategy: "/commerce/strategy",
};

export default function CommercePage() {
    const router = useRouter();
    const [shopify, setShopify] = useState<any>(null);
    const [forecast, setForecast] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            const fetchT = (url: string) =>
                fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
            const [s, f] = await Promise.all([
                fetchT(`${BOT_URL}/shopify`),
                fetchT(`${BOT_URL}/forecasting`),
            ]);
            if (s) setShopify(s);
            if (f) setForecast(f);
        };
        load();
    }, []);

    return (
        <div className="px-4 pb-6 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

            {/* Revenue Intelligence */}
            <div>
                <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>
                    Revenue Intelligence
                </p>
                <div className="columns is-multiline">
                    <div className="column is-4">
                        <StatCard label="Today's Revenue" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"} subValue={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading…"} color="var(--accent-emerald)" trend="up" icon={ShoppingBag} />
                    </div>
                    <div className="column is-4">
                        <StatCard label="30-Day Sales" value={shopify ? `$${Number(shopify.total30d || 0).toLocaleString()}` : "—"} subValue="Rolling 30-day gross" color="var(--accent-blue)" icon={TrendingUp} />
                    </div>
                    <div className="column is-4">
                        <StatCard label="Month-End Forecast" value={forecast?.estimatedMonthEnd ? `$${Number(forecast.estimatedMonthEnd).toLocaleString()}` : "—"} subValue="Projected from MTD pace" color="var(--accent-cyan)" icon={BarChart3} />
                    </div>
                </div>
            </div>

            {/* Squad Cards */}
            <div>
                <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>
                    Agent Squads
                </p>
                <div className="columns is-multiline">
                    {SQUADS.map(squad => {
                        const agents = SQUAD_AGENTS[squad.id] ?? [];
                        const Icon = squad.icon;
                        return (
                            <div key={squad.id} className="column is-6">
                                <div
                                    className="box p-6"
                                    onClick={() => router.push(SQUAD_HREFS[squad.id])}
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                        height: "100%",
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.border = `1px solid ${squad.color}50`;
                                        (e.currentTarget as HTMLElement).style.background = `${squad.color}08`;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.06)";
                                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                                    }}
                                >
                                    {/* Squad header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 11,
                                            background: `${squad.color}18`, border: `1px solid ${squad.color}30`,
                                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        }}>
                                            <Icon size={20} style={{ color: squad.color }} />
                                        </div>
                                        <div>
                                            <p className="is-size-7 has-text-weight-black has-text-white" style={{ marginBottom: 2 }}>
                                                {squad.label}
                                            </p>
                                            <span style={{
                                                fontSize: 9, padding: "1px 7px", borderRadius: 12,
                                                background: `${squad.color}18`, color: squad.color,
                                                border: `1px solid ${squad.color}30`,
                                                textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 700,
                                            }}>
                                                {agents.length} agents
                                            </span>
                                        </div>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" style={{ marginLeft: "auto" }}>
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </div>

                                    {/* Description */}
                                    <p className="is-size-7 has-text-grey mb-4" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                        {squad.description}
                                    </p>

                                    {/* Agent pills */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                        {agents.map(name => (
                                            <span key={name} style={{
                                                fontSize: 9, padding: "2px 8px", borderRadius: 12,
                                                background: "rgba(255,255,255,0.04)", color: "#999",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                textTransform: "uppercase" as const, letterSpacing: "0.05em",
                                            }}>
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
