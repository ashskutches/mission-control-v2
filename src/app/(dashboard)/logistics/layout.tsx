"use client";
import React from "react";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Building2, Lightbulb, Package, RotateCcw, ShoppingCart, Warehouse,
} from "lucide-react";
import SectionOwner from "@/components/SectionOwner";
import SectionTabs, { findActiveTab, type SectionTab } from "@/components/SectionTabs";

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
const TABS: (SectionTab & { blurb: string })[] = [
  { href: "/logistics", label: "Overview", icon: BarChart3, color: "#22c55e", exact: true,
    blurb: "Inventory health, live alerts and fulfilment speed — everything the report puts above the fold." },
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
  { href: "/logistics/insights", label: "Insights", icon: Lightbulb, color: "#e98d20",
    blurb: "What the Logistics lead agent has filed — ranked findings, what each is worth, and who is acting on it." },
];

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = findActiveTab(TABS, pathname);

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
      <SectionTabs items={TABS} pathname={pathname} idPrefix="logistics" />

      {/* Whose department this is. In the layout rather than the page so it
          shows on every tab of the section — this space has no
          SectionAgentPanel to carry it. */}
      <SectionOwner sectionId="logistics" sectionName="Logistics" accentColor="#22c55e" />

      {children}
    </div>
  );
}
