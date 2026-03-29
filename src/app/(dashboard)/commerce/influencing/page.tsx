import { Star } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "influencing",
  sectionName: "Influencing",
  subtitle: "Commerce · Influencer Deals · Brand Partnerships",
  accentColor: "#f43f5e",
  icon: <Star size={20} />,
};

export default function CommerceInfluencingPage() {
  return <CommerceSectionPage config={config} />;
}
