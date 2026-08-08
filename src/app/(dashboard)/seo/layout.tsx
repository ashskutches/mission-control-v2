"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, SearchCheck, FileSearch, Target, Gauge, Bot } from "lucide-react";

const NAV = [
  { href: "/seo",               label: "Dashboard",     icon: BarChart3,  color: "#34d399", exact: true },
  { href: "/seo/opportunities", label: "Opportunities", icon: Target,     color: "#f43f5e" },
  { href: "/seo/pages",         label: "Pages",         icon: FileSearch, color: "#38bdf8" },
  { href: "/seo/ai",            label: "AI Visibility", icon: Bot,        color: "#22d3ee" },
  { href: "/seo/vitals",        label: "Vitals",        icon: Gauge,      color: "#a78bfa" },
  { href: "/seo/blog",          label: "Blog",          icon: BookOpen,   color: "#e98d20" },
];

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(56,189,248,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(52,211,153,0.25)",
        }}>
          <SearchCheck size={18} color="#34d399" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>SEO</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Organic search — what ranks, what nearly ranks, whether AI answers can cite us, and the article library behind it.
      </p>

      {/* Tab nav */}
      <div style={{
        display: "flex", gap: "0.4rem", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "0.75rem", marginBottom: "1.5rem",
      }}>
        {NAV.map(({ href, label, icon: Icon, color, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              // Slugified, not just lower-cased — a two-word label would otherwise put a
              // space inside the id and break any selector reaching for it.
              id={`seo-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: active ? `${color}18` : "rgba(255,255,255,0.04)",
                color: active ? color : "#64748b",
                border: active ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.3rem 0.85rem",
                fontSize: 11, fontWeight: 700, textDecoration: "none",
                textTransform: "uppercase", letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
            >
              <Icon size={12} />
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
