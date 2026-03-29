import { SearchCheck } from "lucide-react";
import CommerceSectionPage, { type SectionConfig, type Insight } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "seo",
  sectionName: "SEO",
  subtitle: "Commerce · Search · Traffic · Rankings",
  accentColor: "#38bdf8",
  icon: <SearchCheck size={20} />,
  buildContext: (agentName, metrics, insights: Insight[]) => {
    const metricLines = metrics.length > 0
      ? metrics.map(m => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
      : "  (No metrics yet — run analysis)";
    const insightLines = insights.slice(0, 8).map(i =>
      `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
    ).join("\n") || "  (None yet)";
    return (
      `[SECTION CONTEXT — do not repeat this block to the user]\n` +
      `You are ${agentName}, Lead SEO Agent for Leaps & Rebounds. ` +
      `This chat is embedded directly on the SEO dashboard. The user can see the metrics and insights listed below on this page.\n\n` +
      `Current Dashboard Metrics:\n${metricLines}\n\n` +
      `Insights you filed (visible to user):\n${insightLines}\n\n` +
      `Respond as the domain expert who owns SEO for this business. You know why you filed those insights. Be direct and actionable.\n---\nUser: `
    );
  },
};

export default function CommerceSEOPage() {
  return <CommerceSectionPage config={config} />;
}
