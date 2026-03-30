import { SearchCheck } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "search-visibility",
  sectionName: "Search Visibility Agent",
  subtitle: "Acquisition & Traffic · SEO / Backlinks / YouTube · Keyword Monitoring",
  accentColor: "#f59e0b",
  icon: <SearchCheck size={20} />,
};

export default function SearchVisibilityPage() {
  return <CommerceSectionPage config={config} />;
}
