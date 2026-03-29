import { SearchCheck } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "seo",
  sectionName: "SEO",
  subtitle: "Commerce · Search · Traffic · Rankings",
  accentColor: "#38bdf8",
  icon: <SearchCheck size={20} />,
};

export default function CommerceSEOPage() {
  return <CommerceSectionPage config={config} />;
}
