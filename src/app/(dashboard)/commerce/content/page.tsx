import { FileText } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "content",
  sectionName: "Content",
  subtitle: "Commerce · Content Strategy · SEO Content · Blog",
  accentColor: "#22c55e",
  icon: <FileText size={20} />,
};

export default function CommerceContentPage() {
  return <CommerceSectionPage config={config} />;
}
