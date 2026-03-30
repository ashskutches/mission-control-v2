import { Truck } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "logistics",
  sectionName: "Logistics Optimizer",
  subtitle: "Post-Purchase & Ops · Shipping / Returns / Commerce · Carrier Performance",
  accentColor: "#10b981",
  icon: <Truck size={20} />,
};

export default function LogisticsPage() {
  return <CommerceSectionPage config={config} />;
}
