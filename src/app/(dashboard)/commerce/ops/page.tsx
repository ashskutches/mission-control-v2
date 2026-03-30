import { ShieldCheck, LifeBuoy, Truck, MessageCircle } from "lucide-react";
import SquadOverviewPage, { type SquadConfig } from "@/components/SquadOverviewPage";

const config: SquadConfig = {
    squadId: "ops",
    squadName: "Post-Purchase & Ops",
    subtitle: "Commerce · Ops Squad · Complexity Focused",
    accentColor: "#10b981",
    icon: ShieldCheck,
    description: "Logic-heavy agents that handle every touchpoint after the sale. Mistakes here lead to poor reviews and chargebacks — these require the strictest guardrails and human-in-the-loop approval for live actions.",
    agents: [
        {
            id: "resolution",
            href: "/commerce/ops/resolution",
            label: "Resolution Specialist",
            icon: LifeBuoy,
            description: "Handles WISMO (Where Is My Order), return labels, and warranty claims using direct API access to your shipping carrier.",
            complexity: "High",
            tags: ["WISMO", "Returns", "Warranties", "Gorgias", "Carrier API"],
        },
        {
            id: "logistics",
            href: "/commerce/ops/logistics",
            label: "Logistics Optimizer",
            icon: Truck,
            description: "Monitors shipping costs and carrier performance. Alerts humans if a specific route or zone is becoming unprofitable.",
            complexity: "Medium",
            tags: ["Shipping", "Carriers", "Cost Analysis", "Routes", "Alerts"],
        },
        {
            id: "community-support",
            href: "/commerce/ops/community-support",
            label: "Community Support Agent",
            icon: MessageCircle,
            description: "Niche agent that specifically monitors Reddit, Facebook Groups, and off-platform communities for brand sentiment and untagged issues.",
            complexity: "Medium",
            tags: ["Reddit", "Facebook", "Sentiment", "Brand Monitoring", "Community"],
        },
    ],
};

export default function OpsSquadPage() {
    return <SquadOverviewPage config={config} />;
}
