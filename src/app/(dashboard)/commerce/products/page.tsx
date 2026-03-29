import { Package } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "products",
  sectionName: "Products & Inventory",
  subtitle: "Commerce · SKU Management · Stock Levels · Pricing",
  accentColor: "#34d399",
  icon: <Package size={20} />,
  sectionHint: "Focus on inventory levels, product performance, pricing strategies, and catalog optimization. Flag low-stock items and underperforming SKUs.",
};

export default function CommerceProductsPage() {
  return <CommerceSectionPage config={config} />;
}
