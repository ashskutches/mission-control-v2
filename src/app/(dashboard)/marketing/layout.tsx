"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Megaphone, Radar, Lightbulb, Tag, CalendarDays } from "lucide-react";
import SectionTabs, { type SectionTab } from "@/components/SectionTabs";

const NAV: SectionTab[] = [
  { href: "/marketing",      label: "Dashboard", icon: BarChart3, color: "#e98d20", exact: true },
  { href: "/marketing/ads",  label: "Ads",       icon: Megaphone, color: "#f43f5e" },
  { href: "/marketing/calendar", label: "Calendar", icon: CalendarDays, color: "#e98d20" },
  { href: "/marketing/promotions", label: "Promotions", icon: Tag, color: "#e98d20" },
  { href: "/marketing/insights", label: "Insights", icon: Lightbulb, color: "#e98d20" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1020, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(233,141,32,0.2), rgba(244,63,94,0.2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(233,141,32,0.2)",
        }}>
          <Radar size={18} color="#e98d20" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Marketing</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Every channel on one scoreboard — paid, organic, email — measured against spend and new customers.
      </p>

      {/* Sub-nav */}
      <SectionTabs items={NAV} pathname={pathname} idPrefix="marketing" />

      {children}
    </div>
  );
}
