import { LifeBuoy } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "resolution",
  sectionName: "Resolution Specialist",
  subtitle: "Post-Purchase & Ops · Customer Service / Returns / Warranties · WISMO",
  accentColor: "#10b981",
  icon: <LifeBuoy size={20} />,
};

export default function ResolutionPage() {
  return <CommerceSectionPage config={config} />;
}
