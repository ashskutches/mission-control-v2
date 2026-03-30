import { FlaskConical } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "experimentation",
  sectionName: "Experimentation Agent",
  subtitle: "Conversion & Merchandising · A/B Tests / CRO · Heatmaps & UX",
  accentColor: "#38bdf8",
  icon: <FlaskConical size={20} />,
};

export default function ExperimentationPage() {
  return <CommerceSectionPage config={config} />;
}
