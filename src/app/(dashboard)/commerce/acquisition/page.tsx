"use client";
import { TrendingUp, Megaphone, Users, Share2, SearchCheck } from "lucide-react";
import SquadOverviewPage, { type SquadConfig } from "@/components/SquadOverviewPage";

const config: SquadConfig = {
    squadId: "acquisition",
    squadName: "Acquisition & Traffic",
    subtitle: "Commerce · Growth Squad · Top of Funnel",
    accentColor: "#f59e0b",
    icon: TrendingUp,
    description: "High-volume data processing and rapid-response growth agents. These units live at the top of the funnel — their job is to drive qualified traffic through paid media, organic search, social, and creator partnerships.",
    agents: [
        {
            id: "media-buying",
            href: "/commerce/acquisition/media-buying",
            label: "Media Buying Agent",
            icon: Megaphone,
            description: "Specialized in budget reallocation and bid adjustments based on real-time ROAS across Meta, Google, and Twitter.",
            complexity: "Low",
            tags: ["Meta Ads", "Google Ads", "Twitter Ads", "ROAS", "Budget"],
        },
        {
            id: "creator-outreach",
            href: "/commerce/acquisition/creator-outreach",
            label: "Creator & Outreach Agent",
            icon: Users,
            description: "Scans for new creator partners, manages outbound outreach, and tracks affiliate link performance.",
            complexity: "Medium",
            tags: ["Influencers", "Affiliates", "Outreach", "Partnerships"],
        },
        {
            id: "social-presence",
            href: "/commerce/acquisition/social-presence",
            label: "Social Presence Agent",
            icon: Share2,
            description: "Handles daily posting, community monitoring, and engagement — replying to comments and mentions across Instagram, Twitter, and Reddit.",
            complexity: "Low",
            tags: ["Instagram", "Twitter", "Reddit", "Community", "Scheduling"],
        },
        {
            id: "search-visibility",
            href: "/commerce/acquisition/search-visibility",
            label: "Search Visibility Agent",
            icon: SearchCheck,
            description: "Monitors keyword rankings, identifies backlink opportunities, and optimizes video metadata for YouTube SEO.",
            complexity: "Medium",
            tags: ["SEO", "Backlinks", "YouTube", "Keywords", "GSC"],
        },
    ],
};

export default function AcquisitionSquadPage() {
    return <SquadOverviewPage config={config} />;
}
