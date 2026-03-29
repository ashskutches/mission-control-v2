import { Heart } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "loyalty",
  sectionName: "Loyalty & LTV",
  subtitle: "Commerce · Customer Retention · Subscriptions · Repeat Buyers",
  accentColor: "#f43f5e",
  icon: <Heart size={20} />,
  sectionHint: "Focus on customer lifetime value, subscription health, churn rate, and win-back opportunities. Draft targeted retention email sequences for at-risk segments. All emails go to Klaviyo as drafts only.",
};

export default function CommerceLoyaltyPage() {
  return <CommerceSectionPage config={config} />;
}
