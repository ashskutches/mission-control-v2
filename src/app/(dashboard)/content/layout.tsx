"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Video, Tag, Layers, Copy, Film } from "lucide-react";

const NAV = [
  { href: "/content",          label: "Dashboard",       icon: BarChart3, color: "#f59e0b", exact: true },
  { href: "/content/video",    label: "Video Agent",     icon: Video,     color: "#f59e0b" },
  { href: "/content/assets",   label: "Asset Tagger",    icon: Tag,       color: "#38bdf8" },
  { href: "/content/sections", label: "Section Builder", icon: Layers,    color: "#a78bfa" },
  { href: "/content/copy",     label: "Copy Studio",     icon: Copy,      color: "#10b981" },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(16,185,129,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(245,158,11,0.25)",
        }}>
          <Film size={18} color="#f59e0b" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Content</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Create, tag, and manage all content — video, assets, Shopify sections, and copy.
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
              id={`content-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
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
