import { MessageCircle } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "community-support",
  sectionName: "Community Support Agent",
  subtitle: "Post-Purchase & Ops · Reddit / Communities · Brand Sentiment",
  accentColor: "#10b981",
  icon: <MessageCircle size={20} />,
};

export default function CommunitySupportPage() {
  return <CommerceSectionPage config={config} />;
}
