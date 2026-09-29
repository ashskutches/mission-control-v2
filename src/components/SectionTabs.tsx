"use client";
import React from "react";
import Link from "next/link";

/**
 * The section tab strip — the row of uppercase pills under a dashboard section
 * header.
 *
 * Eight sections (content, logistics, marketing, orders, sales, seo, support,
 * website) each had their own copy of this strip, byte-identical down to the
 * `${color}18` active fill, the `${color}30` border, the 0.06em letter-spacing
 * and the 0.15s transition. They had already started to drift where it is
 * hardest to notice: the element id was slugified three different ways
 * (`\s+` in content/sales/seo, `[^a-z0-9]+` in logistics/orders, a bare
 * `toLowerCase()` in marketing/website), so the id a given label produced
 * depended on which section it happened to live in — and support rendered no
 * id at all. See `tabSlug` for the single rule they now share.
 *
 * What genuinely varies between sections is data, not markup: the items, the
 * per-item accent (support uses one accent for the whole strip), an optional
 * count badge, and whether the strip closes with a bottom border. Those are the
 * props. Everything else is fixed here on purpose — if a section needs a
 * different pill, that is a design decision worth making once, in this file.
 *
 * Not in scope: Content's SECOND row. Those are underlined text links, not
 * pills — a different primitive that happens to sit below this one.
 */

export interface SectionTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; color?: string }>;
  /** Accent when active. Falls back to the strip-wide `color`. */
  color?: string;
  /** Match the pathname exactly rather than by prefix — for a section root. */
  exact?: boolean;
  /** Full element id, when the derived `${idPrefix}-nav-${slug}` is not wanted. */
  id?: string;
  /** Count bubble on the pill. Hidden when absent or 0. */
  badge?: number;
}

/**
 * Label → id slug. One rule for every section.
 *
 * Collapsing anything that is not [a-z0-9] — rather than just whitespace — is
 * what keeps "Text Message (Testing)" from putting brackets in an id, and the
 * trim keeps it from ending in a stray dash. Every id in use today is
 * unchanged by this: the labels that differ between the old regexes are the
 * punctuated ones, and only /orders had one.
 */
export function tabSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * The tab a path is on. First match wins, so an `exact` section root listed
 * first never loses to a prefix match further down the strip.
 *
 * Exported because logistics and orders also render the active tab's blurb
 * above the strip, and the two must not disagree about which tab that is.
 */
export function findActiveTab<T extends { href: string; exact?: boolean }>(
  items: readonly T[],
  pathname: string,
): T | undefined {
  return items.find(t => (t.exact ? pathname === t.href : pathname.startsWith(t.href)));
}

interface SectionTabsProps {
  items: readonly SectionTab[];
  pathname: string;
  /** Element ids are `${idPrefix}-nav-${tabSlug(label)}`. */
  idPrefix: string;
  /** Strip-wide accent, for sections whose tabs are not individually colored. */
  color?: string;
  /** Inactive text color. Support uses the CSS variable; the rest are literal. */
  mutedColor?: string;
  /** Pick the active tab by href instead of by matching `pathname`. */
  activeHref?: string;
  /** `md` is the slightly larger pill used by Content's top-level group strip. */
  size?: "sm" | "md";
  /** Merged over the container defaults — a section that closes its own border. */
  style?: React.CSSProperties;
}

export default function SectionTabs({
  items,
  pathname,
  idPrefix,
  color,
  mutedColor = "#64748b",
  activeHref,
  size = "sm",
  style,
}: SectionTabsProps) {
  const active = activeHref !== undefined
    ? items.find(t => t.href === activeHref)
    : findActiveTab(items, pathname);

  return (
    <div style={{
      display: "flex", gap: "0.4rem", flexWrap: "wrap",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      paddingBottom: "0.75rem", marginBottom: "1.5rem",
      ...style,
    }}>
      {items.map(tab => {
        const { href, label, icon: Icon, badge } = tab;
        const isActive = active?.href === href;
        // Concrete color, never mutedColor: the active fill and border append
        // an alpha pair (`#rrggbb` + `18`), which a CSS variable cannot take.
        const accent = tab.color ?? color ?? "#64748b";
        return (
          <Link
            key={href}
            href={href}
            id={tab.id ?? `${idPrefix}-nav-${tabSlug(label)}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              background: isActive ? `${accent}18` : "rgba(255,255,255,0.04)",
              color: isActive ? accent : mutedColor,
              border: isActive ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: size === "md" ? "0.35rem 0.95rem" : "0.3rem 0.85rem",
              fontSize: 11, fontWeight: 700, textDecoration: "none",
              textTransform: "uppercase", letterSpacing: "0.06em",
              transition: "all 0.15s",
            }}
          >
            <Icon size={12} />
            {label}
            {!!badge && (
              <span style={{
                background: isActive ? accent : "rgba(255,255,255,0.1)",
                color: isActive ? "#0f0f10" : "var(--text-secondary)",
                borderRadius: 999, padding: "0 5px", fontSize: 9, fontWeight: 900,
                minWidth: 15, textAlign: "center",
              }}>{badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
