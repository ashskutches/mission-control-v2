import { Megaphone } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "media-buying",
  sectionName: "Media Buying Agent",
  subtitle: "Acquisition & Traffic · Meta / Google / Twitter · Budget Optimization",
  accentColor: "#f59e0b",
  icon: <Megaphone size={20} />,
};

export default function MediaBuyingPage() {
  return <CommerceSectionPage config={config} />;
}
