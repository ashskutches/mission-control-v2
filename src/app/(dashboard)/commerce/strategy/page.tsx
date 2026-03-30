"use client";
import { Activity, LineChart, Eye } from "lucide-react";
import SquadOverviewPage, { type SquadConfig } from "@/components/SquadOverviewPage";

const config: SquadConfig = {
    squadId: "strategy",
    squadName: "Strategy & Finance",
    subtitle: "Commerce · Brain Layer · High Importance",
    accentColor: "#a78bfa",
    icon: Activity,
    description: "The oversight layer that coordinates all other squads. These agents aggregate cross-channel data to calculate real contribution margin in real-time and govern long-term brand positioning. High-signal, low-noise.",
    agents: [
        {
            id: "profitability",
            href: "/commerce/strategy/profitability",
            label: "Profitability Sentinel",
            icon: LineChart,
            description: "Aggregates data from Ads, Store, and Shipping to calculate real-time Contribution Margin. Instructs the Media Buying agent to slow down if shipping costs spike.",
            complexity: "High",
            tags: ["Analytics", "Contribution Margin", "Sales", "Cross-channel", "Alerts"],
        },
        {
            id: "brand-sentinel",
            href: "/commerce/strategy/brand-sentinel",
            label: "Brand Sentinel",
            icon: Eye,
            description: "Monitors brand mentions across the web and helps plan long-term plays like physical conferences, PR moments, and high-level collaborations.",
            complexity: "Medium",
            tags: ["Brand Awareness", "PR", "Conferences", "Collaborations", "Monitoring"],
        },
    ],
};

export default function StrategySquadPage() {
    return <SquadOverviewPage config={config} />;
}
