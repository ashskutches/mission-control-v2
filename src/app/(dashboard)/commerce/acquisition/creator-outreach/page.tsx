import { Users } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "creator-outreach",
  sectionName: "Creator & Outreach Agent",
  subtitle: "Acquisition & Traffic · Influencers / Partnerships · Affiliate Tracking",
  accentColor: "#f59e0b",
  icon: <Users size={20} />,
};

export default function CreatorOutreachPage() {
  return <CommerceSectionPage config={config} />;
}
