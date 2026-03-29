import { BarChart2 } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "amazon",
  sectionName: "Amazon Marketplace",
  subtitle: "Commerce · Amazon FBA · Listings · BSR · Reviews",
  accentColor: "#fb923c",
  icon: <BarChart2 size={20} />,
  sectionHint: "Monitor Amazon listing health, Best Seller Rank (BSR), review velocity, and buy box status. Draft optimized listing titles, bullets, and A+ content. Identify keyword opportunities and competitive positioning on Amazon.",
};

export default function CommerceAmazonPage() {
  return <CommerceSectionPage config={config} />;
}
