import { FileText } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const config: SectionConfig = {
  sectionId: "content",
  sectionName: "Content",
  subtitle: "Commerce · Blog · YouTube · Facebook Groups · External Sites",
  accentColor: "#22c55e",
  icon: <FileText size={20} />,
  sectionHint: `This section covers ALL organic content channels for Leaps & Rebounds:
- **Blog** — leapsandrebounds.com/blog, SEO-optimized articles, pillar pages
- **YouTube** — product demos, workout tutorials, educational rebounding content
- **Facebook Groups** — L&R community groups, rebounding fitness communities
- **External Sites** — guest posts, backlinks from fitness/health blogs, press mentions
- **Reddit** — r/fitness, r/homeGym, r/rebounding engagement and presence
- **Pinterest** — workout pins, product lifestyle imagery
- **Other earned media** — podcast appearances, newsletter features, influencer blogs

When analyzing, check content performance across these channels. Surface what's growing, what's underperforming, and what content gaps exist. Use request_integration for channels you can't currently measure.`,
};

export default function CommerceContentPage() {
  return <CommerceSectionPage config={config} />;
}
