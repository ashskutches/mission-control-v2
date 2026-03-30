import { LayoutGrid } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "catalog-architect",
  sectionName: "Catalog Architect",
  subtitle: "Conversion & Merchandising · Products / Descriptions / Assets · Shopify Catalog",
  accentColor: "#38bdf8",
  icon: <LayoutGrid size={20} />,
};

export default function CatalogArchitectPage() {
  return <CommerceSectionPage config={config} />;
}
