import { Share2 } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "social-presence",
  sectionName: "Social Presence Agent",
  subtitle: "Acquisition & Traffic · Instagram / Twitter / Reddit · Community Engagement",
  accentColor: "#f59e0b",
  icon: <Share2 size={20} />,
};

export default function SocialPresencePage() {
  return <CommerceSectionPage config={config} />;
}
