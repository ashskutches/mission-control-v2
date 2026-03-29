import { Award } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "reviews",
  sectionName: "Reviews & Reputation",
  subtitle: "Commerce · Customer Reviews · Star Ratings · Brand Trust",
  accentColor: "#fbbf24",
  icon: <Award size={20} />,
  sectionHint: "Analyze review sentiment, respond to negative reviews with empathy and resolution offers (draft responses only — never auto-post). Identify top review themes and product feedback patterns.",
};

export default function CommerceReviewsPage() {
  return <CommerceSectionPage config={config} />;
}
