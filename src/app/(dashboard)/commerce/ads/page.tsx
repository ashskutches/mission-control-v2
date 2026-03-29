import { Megaphone } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "ads",
  sectionName: "Ads",
  subtitle: "Commerce · Paid Media · Performance Marketing",
  accentColor: "#f43f5e",
  icon: <Megaphone size={20} />,
};

export default function CommerceAdsPage() {
  return <CommerceSectionPage config={config} />;
}
