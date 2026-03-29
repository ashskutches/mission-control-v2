import { ShoppingCart } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "orders",
  sectionName: "Orders & Fulfillment",
  subtitle: "Commerce · Order Management · Shipping · Returns",
  accentColor: "#22c55e",
  icon: <ShoppingCart size={20} />,
  sectionHint: "Monitor open orders, fulfillment rates, shipping delays, and return requests. Identify bottlenecks in the fulfillment pipeline and surface customer service escalations.",
};

export default function CommerceOrdersPage() {
  return <CommerceSectionPage config={config} />;
}
