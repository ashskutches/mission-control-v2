import { Eye } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "brand-sentinel",
  sectionName: "Brand Sentinel",
  subtitle: "Strategy & Finance · Brand Awareness / Conferences · Long-Term Positioning",
  accentColor: "#a78bfa",
  icon: <Eye size={20} />,
};

export default function BrandSentinelPage() {
  return <CommerceSectionPage config={config} />;
}
