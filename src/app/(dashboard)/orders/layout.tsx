"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Lightbulb, MessageSquare, Package, TrendingUp, Truck } from "lucide-react";
import SectionOwner from "@/components/SectionOwner";

/**
 * The Orders section. Four surfaces that all answer "what is happening to an order",
 * merged from what used to be two separate sidebar entries (/orders and /customer).
 *
 * Queue is the general case; Backorders is a narrower slice kept separate because its
 * SMS script is tuned to the "switch variant or keep waiting?" conversation.
 *
 * Patterns is the odd one out and deliberately last: the other three are about a
 * single order right now, it is about what all of them together add up to. It reads
 * months of history rather than today's exceptions, so it is slow by nature.
 */
const TABS = [
  { href: "/orders",             label: "Queue",       icon: AlertTriangle,  color: "#fb923c", exact: true,
    blurb: "Every order that needs a human today, ranked by how bad it is. Read live from Shopify — healthy orders are not shown." },
  { href: "/orders/insights",    label: "Insights",    icon: Lightbulb,      color: "#e98d20",
    blurb: "What the Orders lead agent has filed — ranked findings, what each is worth, and who is acting on it." },
  { href: "/orders/backorders",  label: "Backorders",  icon: Package,        color: "#06b6d4",
    blurb: "Orders tagged _BACKORDERED, with the variant-or-wait SMS follow-up." },
  { href: "/orders/sms",         label: "Text Message (Testing)", icon: MessageSquare, color: "#a78bfa",
    blurb: "Send a real SMS by hand. Every send here goes to a live phone." },
  { href: "/orders/patterns",    label: "Buying Patterns", icon: TrendingUp, color: "#34d399",
    blurb: "What months of orders add up to: what gets bought together, what only looks like it does, and where the money is actually being left. Every figure shows its arithmetic." },
];

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Order ids are numeric, so a numeric segment is the detail drill-down. It gets no
  // tab strip — it has its own "Back to queue" link and is not a sibling surface.
  const isDetail = /^\/orders\/\d+/.test(pathname);
  const active = TABS.find(t => (t.exact ? pathname === t.href : pathname.startsWith(t.href)));

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(251,146,60,0.2), rgba(244,63,94,0.15))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(251,146,60,0.25)",
        }}>
          <Truck size={18} color="#fb923c" />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Orders</h1>
      </div>

      {!isDetail && (
        <>
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
                  id={`orders-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`}
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
        </>
      )}

      {/* Whose department this is. In the layout rather than the page so it
          shows on every tab of the section — this space has no
          SectionAgentPanel to carry it. */}
      <SectionOwner sectionId="orders" sectionName="Orders" accentColor="#fb923c" />

      {children}
    </div>
  );
}
