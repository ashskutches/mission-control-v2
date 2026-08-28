"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Building2, Lightbulb, Package, RotateCcw, ShoppingCart, Warehouse,
} from "lucide-react";

/**
 * The Logistics section — the supply side of the store.
 *
 * Built to the layout in the Atlas logistics-dashboard report (Aug 7 2026): an
 * above-the-fold overview, then one tab per drill-down. Tabs are ordered by how
 * much of them works today: Overview, Inventory, Reorder, Warehouses and Shipping all
 * run on Shopify alone; Returns is wired but waiting on Gorgias, and the only thing
 * Shipping still cannot show is the freight/storage FEES, which live on Falcon invoices.
 *
 * Kept separate from /orders on purpose. Orders is order-shaped (a queue you clear,
 * one customer at a time); this is SKU-shaped (what to buy, and when). They meet on
 * the variant, not in the navigation.
 */
const TABS = [
  { href: "/logistics", label: "Overview", icon: BarChart3, color: "#22c55e", exact: true,
    blurb: "Inventory health, live alerts and fulfilment speed — everything the report puts above the fold." },
  { href: "/logistics/insights", label: "Insights", icon: Lightbulb, color: "#e98d20",
    blurb: "What the Logistics lead agent has filed — ranked findings, what each is worth, and who is acting on it." },
  { href: "/logistics/inventory", label: "Inventory", icon: Package, color: "#38bdf8",
    blurb: "Every tracked SKU with its stock, reorder point and days to stockout. Sorted by what runs out first." },
  { href: "/logistics/reorder", label: "Reorder", icon: ShoppingCart, color: "#f59e0b",
    blurb: "What to buy now, how much, and when it would land — plus the supplier lead times the whole calculation rests on." },
  { href: "/logistics/returns", label: "Warranty & Returns", icon: RotateCcw, color: "#a78bfa",
    blurb: "Return rate, defect rate and RMA reasons. Blocked on Gorgias credentials; the Shopify returns-in-flight signal is shown meanwhile." },
  { href: "/logistics/warehouses", label: "Warehouses", icon: Building2, color: "#22d3ee",
    blurb: "Stock per SKU per warehouse: what can actually ship, what is only being held, and what belongs to a dropship partner rather than to us." },
  { href: "/logistics/shipping", label: "Shipping & Carriers", icon: Activity, color: "#06b6d4",
    blurb: "Shipment volume, carrier mix, transit time and on-time delivery against the carrier's promise — all from Shopify. Only the freight and storage FEES still need Falcon." },
];

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = TABS.find(t => (t.exact ? pathname === t.href : pathname.startsWith(t.href)));

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(56,189,248,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(34,197,94,0.25)",
        }}>
          <Warehouse size={18} color="#22c55e" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Logistics</h1>
      </div>

      <p style={{ color: "#64748b", fontSize: 13, marginBottom: "1.25rem" }}>
        {active?.blurb}
      </p>

      {/* Tab nav */}
      <div style={{
        display: "flex", gap: "0.4rem", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "0.75rem", marginBottom: "1.5rem",
      }}>
        {TABS.map(({ href, label, icon: Icon, color }) => {
          const isActive = active?.href === href;
          return (
            <Link
              key={href}
              href={href}
              id={`logistics-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: isActive ? `${color}18` : "rgba(255,255,255,0.04)",
                color: isActive ? color : "#64748b",
                border: isActive ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.06)",
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
