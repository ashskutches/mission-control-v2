"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, BookOpen, Brain, LifeBuoy } from "lucide-react";
import { SUPPORT_ACCENT } from "./ui";
import { PENDING_APPROVAL_COUNT, OPEN_QUESTION_COUNT } from "./fixtures";

const NAV = [
  { href: "/support",          label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/support/inbox",    label: "Inbox",     icon: Inbox,  badge: PENDING_APPROVAL_COUNT },
  { href: "/support/learning", label: "Learning",  icon: Brain,  badge: OPEN_QUESTION_COUNT },
  { href: "/support/docs",     label: "Knowledge", icon: BookOpen },
];

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${SUPPORT_ACCENT}33, rgba(167,139,250,0.15))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${SUPPORT_ACCENT}40`,
        }}>
          <LifeBuoy size={18} color={SUPPORT_ACCENT} />
        </div>
        <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Support</h1>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: "1.25rem" }}>
        AI drafts every reply, a human approves it, and every correction teaches the agent.
      </p>

      <div style={{
        display: "flex", gap: "0.4rem", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "0.75rem", marginBottom: "1.5rem",
      }}>
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: active ? `${SUPPORT_ACCENT}18` : "rgba(255,255,255,0.04)",
                color: active ? SUPPORT_ACCENT : "var(--text-muted)",
                border: active ? `1px solid ${SUPPORT_ACCENT}30` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.3rem 0.85rem",
                fontSize: 11, fontWeight: 700, textDecoration: "none",
                textTransform: "uppercase", letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
            >
              <Icon size={12} />
              {label}
              {!!badge && (
                <span style={{
                  background: active ? SUPPORT_ACCENT : "rgba(255,255,255,0.1)",
                  color: active ? "#0f0f10" : "var(--text-secondary)",
                  borderRadius: 999, padding: "0 5px", fontSize: 9, fontWeight: 900,
                  minWidth: 15, textAlign: "center",
                }}>{badge}</span>
              )}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
