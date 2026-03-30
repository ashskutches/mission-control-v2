import { Tag } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "pricing-intel",
  sectionName: "Pricing & Intelligence Agent",
  subtitle: "Conversion & Merchandising · Competitor Analysis / Dynamic Pricing · Margin Defense",
  accentColor: "#38bdf8",
  icon: <Tag size={20} />,
};

export default function PricingIntelPage() {
  return <CommerceSectionPage config={config} />;
}
