"use client";
/**
 * Sales — the revenue space.
 *
 * It absorbed the standalone Profit page: the P&L is the last tab here rather than
 * a sibling in the sidebar. /profitability is still a live route (the blocker
 * banner under the Insights KPI strip deep-links `/profitability?tab=costs`, and
 * Command Center renders the same component at `/?tab=profitability`), it is just
 * no longer somewhere the nav sends you.
 *
 * The split between the tabs is the split between two questions about one order
 * pull. Dashboard and Products ask what sold and to whom; Profit asks what we kept.
 * Both read `buildPnl` server-side, so they cannot disagree about the same orders —
 * which is the whole reason Sales was built on the existing P&L rather than a
 * second Shopify reader.
 */
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ShoppingCart, Package, PiggyBank, Lightbulb } from "lucide-react";

const NAV = [
  { href: "/sales",          label: "Dashboard", icon: BarChart3, color: "#22c55e", exact: true },
  { href: "/sales/insights", label: "Insights",  icon: Lightbulb, color: "#e98d20" },
  { href: "/sales/products", label: "Products",  icon: Package,   color: "#38bdf8" },
  { href: "/sales/profit",   label: "Profit",    icon: PiggyBank, color: "#a78bfa" },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(52,211,153,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(34,197,94,0.25)",
        }}>
          <ShoppingCart size={18} color="#22c55e" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Sales</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        Revenue — what sold, to whom, at what discount, and what it left behind after costs.
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
              id={`sales-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
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
