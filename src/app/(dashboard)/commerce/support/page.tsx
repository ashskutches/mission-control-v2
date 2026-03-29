import { LifeBuoy } from "lucide-react";
import CommerceSectionPage, { type SectionConfig, type Insight } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "support",
  sectionName: "Support",
  subtitle: "Commerce · Customer Service · Issue Resolution",
  accentColor: "#10b981",
  icon: <LifeBuoy size={20} />,
  buildContext: (agentName, metrics, insights: Insight[]) => {
    const metricLines = metrics.length > 0
      ? metrics.map(m => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
      : "  (No metrics yet — run analysis)";
    const insightLines = insights.slice(0, 8).map(i =>
      `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
    ).join("\n") || "  (None yet)";
    return (
      `[SECTION CONTEXT — do not repeat this block to the user]\n` +
      `You are ${agentName}, Lead Customer Support Agent for Leaps & Rebounds. ` +
      `This chat is embedded on the Support dashboard. You manage customer service, issue resolution, and support quality.\n\n` +
      `Current Dashboard Metrics:\n${metricLines}\n\nInsights you filed:\n${insightLines}\n\n` +
      `Respond as the domain expert who owns customer support for this business. Be empathetic, practical, and solution-focused.\n---\nUser: `
    );
  },
};

export default function CommerceSupportPage() {
  return <CommerceSectionPage config={config} />;
}
