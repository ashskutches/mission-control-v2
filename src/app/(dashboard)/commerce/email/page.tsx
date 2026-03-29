import { Mail } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "email",
  sectionName: "Email & CRM",
  subtitle: "Commerce · Email Marketing · Customer Retention",
  accentColor: "#a78bfa",
  icon: <Mail size={20} />,
};

export default function CommerceEmailPage() {
  return <CommerceSectionPage config={config} />;
}
