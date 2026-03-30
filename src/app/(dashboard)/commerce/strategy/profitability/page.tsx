import { LineChart } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "profitability",
  sectionName: "Profitability Sentinel",
  subtitle: "Strategy & Finance · Analytics / Sales / Leads · Contribution Margin",
  accentColor: "#a78bfa",
  icon: <LineChart size={20} />,
};

export default function ProfitabilityPage() {
  return <CommerceSectionPage config={config} />;
}
