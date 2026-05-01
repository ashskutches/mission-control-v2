"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, MessageSquare, UserCheck } from "lucide-react";

const NAV = [
  { href: "/customer",     label: "Backorders",            icon: Package,      color: "#06b6d4", exact: true },
  { href: "/customer/sms", label: "Text Message (Testing)", icon: MessageSquare, color: "#a78bfa" },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(167,139,250,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(6,182,212,0.25)",
        }}>
          <UserCheck size={18} color="#06b6d4" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Customer</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Manage backordered orders and customer communications via SMS.
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
              id={`customer-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
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
