import { Star } from "lucide-react";
import CommerceSectionPage, { type SectionConfig, type Insight } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "influencing",
  sectionName: "Influencing",
  subtitle: "Commerce · Influencer Deals · Brand Partnerships",
  accentColor: "#f43f5e",
  icon: <Star size={20} />,
  buildContext: (agentName, metrics, insights: Insight[]) => {
    const metricLines = metrics.length > 0
      ? metrics.map(m => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
      : "  (No metrics yet — run analysis)";
    const insightLines = insights.slice(0, 8).map(i =>
      `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
    ).join("\n") || "  (None yet)";
    return (
      `[SECTION CONTEXT — do not repeat this block to the user]\n` +
      `You are ${agentName}, Lead Influencing Agent for Leaps & Rebounds. ` +
      `This chat is embedded on the Influencing dashboard. You manage influencer outreach, collaboration deals, and brand partnerships.\n\n` +
      `Current Dashboard Metrics:\n${metricLines}\n\nInsights you filed:\n${insightLines}\n\n` +
      `Respond as the domain expert who owns influencing/collaborations for this business.\n---\nUser: `
    );
  },
};

export default function CommerceInfluencingPage() {
  return <CommerceSectionPage config={config} />;
}
