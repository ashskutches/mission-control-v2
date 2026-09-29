"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SectionTabs, { tabSlug } from "@/components/SectionTabs";
import { BarChart3, Tag, Layers, Copy, Film, Pin, Wand2, Lightbulb, Database, Bot, Sparkles, CheckSquare, FolderOpen, GraduationCap } from "lucide-react";

/**
 * Content navigation — five groups, two levels.
 *
 * This was a single strip of ten tabs, which is more than anyone reads: you
 * scanned the row looking for the one you wanted instead of knowing where it
 * was. Grouped by what you are DOING rather than by what the page is made of,
 * so the question "where do I go" has an answer before you read any labels.
 *
 * Why five and not three. The obvious cut is Dashboard / Creation / Management,
 * and it fails on the second group: seven of the ten are "management", so the
 * clutter moves down a level instead of going away. The real seams are making
 * something, judging what was made, the files you keep, and what teaches the
 * generator — and that last pair is the one worth separating. Products and
 * Training Data are the generator's INPUTS, upstream of Image Studio; filed
 * under a general "Library" beside finished assets they read as archives, which
 * is exactly the confusion that let a contradictory reference set sit unnoticed
 * for months.
 *
 * Blog is not here. It lives under SEO — /seo/blog — because it is judged on
 * search performance, and it was only ever a cross-link from here: the tab
 * pointed at /seo/blog and rendered the same BlogLibrary component. Two doors to
 * one room made the section look like it owned something it does not.
 * /content/blog still redirects, so old bookmarks and agent-written links keep
 * working.
 */

interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; color?: string }>;
  /** One line, shown under the second row — what the page answers. */
  hint: string;
}

interface Group {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; color?: string }>;
  color: string;
  /** The page this group lands on when its name is clicked. */
  href: string;
  exact?: boolean;
  tabs: Tab[];
}

const GROUPS: Group[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    color: "#f59e0b",
    href: "/content",
    exact: true,
    tabs: [],
  },
  {
    id: "create",
    label: "Create",
    icon: Sparkles,
    color: "#a78bfa",
    href: "/content/generate",
    tabs: [
      { href: "/content/generate", label: "Image Studio", icon: Wand2, hint: "Make one image, with the product references chosen for you" },
      { href: "/content/copy",     label: "Copy Studio",  icon: Copy,  hint: "Draft ad and email copy against the brand voice" },
    ],
  },
  {
    id: "review",
    label: "Review",
    icon: CheckSquare,
    color: "#38bdf8",
    href: "/content/agent-content",
    tabs: [
      { href: "/content/agent-content", label: "Agent Content", icon: Bot, hint: "Approve or reject everything the agents generated" },
    ],
  },
  {
    id: "library",
    label: "Library",
    icon: FolderOpen,
    color: "#10b981",
    href: "/content/assets",
    tabs: [
      { href: "/content/assets", label: "Assets",       icon: Film,   hint: "Every file in Drive — browse, upload, search" },
      { href: "/content/tags",   label: "Tag Library",  icon: Tag,    hint: "The tag vocabulary the library is organized by" },
      { href: "/content/batch",  label: "Batch Tagger", icon: Layers, hint: "Run the vision tagger across untagged files" },
    ],
  },
  {
    id: "training",
    label: "Training",
    icon: GraduationCap,
    color: "#f59e0b",
    href: "/content/products",
    tabs: [
      { href: "/content/products",      label: "Products",      icon: Pin,      hint: "Pin and label the reference photos for one product" },
      { href: "/content/training-data", label: "Training Data", icon: Database, hint: "What the generator can and cannot render, across all products" },
    ],
  },
  // Last, everywhere. Insights is the decision queue an agent files into, not a
  // tool you reach for while working — it is where you go when you have finished
  // and want to know what is waiting on you. Sitting second, as it did in all
  // eight sections, it took the position the most-used page should have.
  {
    id: "insights",
    label: "Insights",
    icon: Lightbulb,
    color: "#e98d20",
    href: "/content/insights",
    tabs: [],
  },
];

/**
 * The group a path belongs to. Longest href wins, so /content never swallows the
 * rest.
 *
 * Matches on the group's own href as well as its tabs: Dashboard and Insights
 * are single pages with no second row, and keying only off `tabs` left them
 * unable to ever look selected.
 */
function activeGroup(pathname: string): Group {
  const dashboard = GROUPS[0]!;
  if (pathname === "/content") return dashboard;
  const candidates = GROUPS.flatMap(g =>
    [{ href: g.href, g }, ...g.tabs.map(t => ({ href: t.href, g }))]
      .filter(c => c.href !== "/content")
      .map(c => ({ g: c.g, len: c.href.length, hit: pathname === c.href || pathname.startsWith(c.href + "/") })),
  );
  const match = candidates.filter(c => c.hit).sort((a, b) => b.len - a.len)[0];
  return match?.g ?? dashboard;
}

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = activeGroup(pathname);
  const activeTab = current.tabs.find(t => pathname === t.href || pathname.startsWith(t.href + "/"));
  // A group with one page is its own row already — the group button IS the link.
  // Rendering a second row holding a single item repeats the label you just clicked.
  const showSecondRow = current.tabs.length > 1;

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

      {/* ── Group strip ──────────────────────────────────────────────────── */}
      {/*
        The same pill strip every other section renders, with two differences
        it takes as props: the pills are a touch larger because they are the
        top level, and the bottom border moves down to the second row whenever
        this group shows one. Which pill is active comes from activeGroup(), not
        from matching the group's own href — a group is active when one of ITS
        pages is open, and only the Dashboard group's href is ever the pathname.
      */}
      <SectionTabs
        items={GROUPS.map(g => ({ href: g.href, label: g.label, icon: g.icon, color: g.color, id: `content-group-${g.id}` }))}
        pathname={pathname}
        idPrefix="content"
        activeHref={current.href}
        size="md"
        style={{
          borderBottom: showSecondRow ? "none" : "1px solid rgba(255,255,255,0.05)",
          marginBottom: showSecondRow ? 0 : (activeTab ? "0.5rem" : "1.5rem"),
        }}
      />

      {/* ── Second row: the pages in this group ──────────────────────────── */}
      {/*
        Always rendered for a group that has pages, never on hover and never
        collapsed. A menu you have to open is a menu you have to remember the
        contents of, and the whole complaint was not being able to find things.
      */}
      {showSecondRow && (
        <div style={{
          display: "flex", gap: "1.1rem", flexWrap: "wrap", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "0.55rem 0.15rem 0.75rem",
          marginBottom: "0.5rem",
        }}>
          {current.tabs.map(t => {
            const active = t.href === activeTab?.href;
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                id={`content-nav-${tabSlug(t.label)}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.35rem",
                  color: active ? "#f1f5f9" : "#64748b",
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  textDecoration: "none",
                  borderBottom: active ? `2px solid ${current.color}` : "2px solid transparent",
                  paddingBottom: "0.2rem",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={13} color={active ? current.color : "#64748b"} />
                {t.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* What the page you are on answers. One line, so the label does not have
          to carry the whole explanation. */}
      {activeTab && (
        <p style={{ color: "#475569", fontSize: 11.5, marginBottom: "1.25rem" }}>
          {activeTab.hint}
        </p>
      )}

      {children}
    </div>
  );
}
