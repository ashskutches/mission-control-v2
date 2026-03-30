import { Zap } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "revenue-max",
  sectionName: "Revenue Maximization Agent",
  subtitle: "Conversion & Merchandising · Upselling / LTV · Cross-sell Triggers",
  accentColor: "#38bdf8",
  icon: <Zap size={20} />,
};

export default function RevenueMaxPage() {
  return <CommerceSectionPage config={config} />;
}
