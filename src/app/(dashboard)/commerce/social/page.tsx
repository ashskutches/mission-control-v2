import { Share2 } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "social",
  sectionName: "Social Media",
  subtitle: "Commerce · TikTok · Pinterest · Instagram · Facebook",
  accentColor: "#e879f9",
  icon: <Share2 size={20} />,
  sectionHint: "Analyze social media performance across TikTok, Pinterest, Instagram, and Facebook. Draft content calendars and post copy (for human approval — never auto-post). Track follower growth, engagement rates, and top-performing formats.",
};

export default function CommerceSocialPage() {
  return <CommerceSectionPage config={config} />;
}
