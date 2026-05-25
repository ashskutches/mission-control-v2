"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, BarChart3, Layers } from "lucide-react";

const TABS = [
  { label: "Dashboard", href: "/commerce/dashboard", icon: BarChart3 },
  { label: "Sections",  href: "/commerce/sections",  icon: Layers },
];

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeTab = pathname.startsWith("/commerce/dashboard")
    ? "/commerce/dashboard"
    : pathname.startsWith("/commerce/sections")
    ? "/commerce/sections"
    : null;

  return (
    <div>
      {/* ── Tab bar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(8,12,20,0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.25rem",
          height: 52,
        }}
      >
        {/* Left: Commerce label */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(233,141,32,0.12)",
              border: "1px solid rgba(233,141,32,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShoppingBag size={13} color="#e98d20" />
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#e98d20",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Commerce
          </span>
        </div>

        {/* Right: Tab pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? "#e98d20" : "#475569",
                  textDecoration: "none",
                  border: isActive
                    ? "1px solid rgba(233,141,32,0.3)"
                    : "1px solid transparent",
                  background: isActive
                    ? "rgba(233,141,32,0.15)"
                    : "transparent",
                  transition: "color 0.15s, background 0.15s, border-color 0.15s",
                  zIndex: 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "#475569";
                  }
                }}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="commerce-tab-indicator"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 20,
                      background: "rgba(233,141,32,0.15)",
                      border: "1px solid rgba(233,141,32,0.3)",
                      zIndex: -1,
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                <Icon size={12} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Page content ── */}
      <div>{children}</div>
    </div>
  );
}
