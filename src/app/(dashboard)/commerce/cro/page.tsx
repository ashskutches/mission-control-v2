import { TrendingUp } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "cro",
  sectionName: "CRO & Experimentation",
  subtitle: "Commerce · Conversion Rate · A/B Tests · UX · PageSpeed",
  accentColor: "#818cf8",
  icon: <TrendingUp size={20} />,
  sectionHint: "Analyze conversion funnel performance, PageSpeed scores, Core Web Vitals, and GA4 behavior data. Identify highest-impact conversion improvements. Draft A/B test hypotheses and landing page copy variants for human review.",
};

export default function CommerceCROPage() {
  return <CommerceSectionPage config={config} />;
}
