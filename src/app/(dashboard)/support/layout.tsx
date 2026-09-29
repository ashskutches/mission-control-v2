"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, BookOpen, Brain, LifeBuoy, Settings, Lightbulb } from "lucide-react";
import { SUPPORT_ACCENT } from "./ui";
import { getSummary } from "./api";
import SectionOwner from "@/components/SectionOwner";
import SectionTabs, { type SectionTab } from "@/components/SectionTabs";

/**
 * Support's tabs carry no per-tab color — the whole strip is SUPPORT_ACCENT —
 * and two of them show a live count from /summary, so `badge` here is the key
 * to read off that payload rather than the number itself.
 */
interface NavItem extends Omit<SectionTab, "badge"> {
  badge?: "awaitingApproval" | "openQuestions";
}

const NAV: NavItem[] = [
  { href: "/support",          label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/support/inbox",    label: "Inbox",     icon: Inbox,    badge: "awaitingApproval" },
  { href: "/support/learning", label: "Learning",  icon: Brain,    badge: "openQuestions" },
  { href: "/support/docs",     label: "Knowledge", icon: BookOpen },
  { href: "/support/settings", label: "Settings",  icon: Settings },
  { href: "/support/insights", label: "Insights",  icon: Lightbulb },
];

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const tick = () => getSummary()
      .then(s => { if (alive) setCounts({ awaitingApproval: s.awaitingApproval, openQuestions: s.openQuestions }); })
      .catch(() => {});
    tick();
    const id = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${SUPPORT_ACCENT}33, rgba(167,139,250,0.15))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${SUPPORT_ACCENT}40`,
        }}>
          <LifeBuoy size={18} color={SUPPORT_ACCENT} />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Support</h1>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: "1.25rem" }}>
        AI drafts every reply, a human approves it, and every correction teaches the agent.
      </p>

      <SectionTabs
        items={NAV.map(({ badge, ...tab }) => ({ ...tab, badge: badge ? counts[badge] ?? 0 : 0 }))}
        pathname={pathname}
        idPrefix="support"
        color={SUPPORT_ACCENT}
        mutedColor="var(--text-muted)"
      />

      {/* Whose department this is. In the layout rather than the page so it
          shows on every tab of the section — this space has no
          SectionAgentPanel to carry it. */}
      <SectionOwner sectionId="support" sectionName="Support" accentColor="#00c9d7" />

      {children}
    </div>
  );
}
