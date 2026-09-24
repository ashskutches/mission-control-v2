"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, Radio, Link2, Rocket, Activity, Code2, Lightbulb } from "lucide-react";
import SectionTabs, { type SectionTab } from "@/components/SectionTabs";

const NAV: SectionTab[] = [
  { href: "/website",           label: "Dashboard", icon: BarChart3, color: "#38bdf8", exact: true },
  { href: "/website/insights",  label: "Insights",  icon: Lightbulb, color: "#e98d20" },
  { href: "/website/sections",  label: "Sections",  icon: Layers,   color: "#a78bfa" },
  { href: "/website/signals",   label: "Signals",   icon: Radio,    color: "#f59e0b" },
  { href: "/website/embeds",    label: "Embeds",    icon: Link2,    color: "#34d399" },
  { href: "/website/deploy",    label: "Deploy",    icon: Rocket,   color: "#64748b" },
  { href: "/website/snippets",  label: "Snippets",  icon: Code2,    color: "#818cf8" },
];

export default function AudienceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1020, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(167,139,250,0.2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(56,189,248,0.2)",
        }}>
          <Activity size={18} color="#38bdf8" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Website</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Customer intelligence — personalization, A/B sections, embeds, and Shopify snippets.
      </p>

      {/* Sub-nav */}
      <SectionTabs items={NAV} pathname={pathname} idPrefix="website" />

      {children}
    </div>
  );
}
