"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, ShoppingBag } from "lucide-react";

const NAV = [
  { href: "/commerce/dashboard", label: "Dashboard", icon: BarChart3, color: "#e98d20", exact: true },
  { href: "/commerce/sections",  label: "Sections",  icon: Layers,    color: "#a78bfa" },
];

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1020, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(233,141,32,0.2), rgba(167,139,250,0.2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(233,141,32,0.2)",
        }}>
          <ShoppingBag size={18} color="#e98d20" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Commerce</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Revenue intelligence — squads, sections, analytics, and storefront performance.
      </p>

      {/* Sub-nav */}
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
              id={`commerce-nav-${label.toLowerCase()}`}
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
