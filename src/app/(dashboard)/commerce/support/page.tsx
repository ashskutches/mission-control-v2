import { LifeBuoy } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "support",
  sectionName: "Support",
  subtitle: "Commerce · Customer Service · Issue Resolution",
  accentColor: "#10b981",
  icon: <LifeBuoy size={20} />,
};

export default function CommerceSupportPage() {
  return <CommerceSectionPage config={config} />;
}
