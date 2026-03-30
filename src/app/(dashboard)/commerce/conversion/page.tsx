import { Target, FlaskConical, Tag, LayoutGrid, Zap } from "lucide-react";
import SquadOverviewPage, { type SquadConfig } from "@/components/SquadOverviewPage";

const config: SquadConfig = {
    squadId: "conversion",
    squadName: "Conversion & Merchandising",
    subtitle: "Commerce · Value Squad · The Math of the Website",
    accentColor: "#38bdf8",
    icon: Target,
    description: "These agents focus on the economics of the storefront. Higher complexity because they require direct access to store analytics, heatmaps, pricing data, and inventory. Mistakes here directly impact revenue.",
    agents: [
        {
            id: "experimentation",
            href: "/commerce/conversion/experimentation",
            label: "Experimentation Agent",
            icon: FlaskConical,
            description: "Analyzes heatmaps and session recordings to suggest and run UI/UX A/B tests that improve conversion rate.",
            complexity: "High",
            tags: ["A/B Testing", "CRO", "Heatmaps", "UX", "Hotjar"],
        },
        {
            id: "pricing-intel",
            href: "/commerce/conversion/pricing-intel",
            label: "Pricing & Intelligence Agent",
            icon: Tag,
            description: "Scrapes competitors and suggests dynamic pricing to maintain margins without losing the Buy Box.",
            complexity: "High",
            tags: ["Competitor Analysis", "Dynamic Pricing", "Margins", "MSRP"],
        },
        {
            id: "catalog-architect",
            href: "/commerce/conversion/catalog-architect",
            label: "Catalog Architect",
            icon: LayoutGrid,
            description: "Ensures every SKU has high-quality creative assets, SEO-optimized copy, and correct technical specifications.",
            complexity: "Medium",
            tags: ["Products", "Copy", "SEO", "Assets", "Shopify"],
        },
        {
            id: "revenue-max",
            href: "/commerce/conversion/revenue-max",
            label: "Revenue Maximization Agent",
            icon: Zap,
            description: "Manages Frequently Bought Together logic, upsell rules, and website cross-sell triggers to maximize LTV.",
            complexity: "High",
            tags: ["Upselling", "LTV", "Cross-sell", "Bundles", "Post-purchase"],
        },
    ],
};

export default function ConversionSquadPage() {
    return <SquadOverviewPage config={config} />;
}
