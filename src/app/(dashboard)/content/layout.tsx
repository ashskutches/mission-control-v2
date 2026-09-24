"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      { href: "/content/agent-content", label: "Agent Content", icon: Bot,       hint: "Approve or reject everything the agents generated" },
      { href: "/content/insights",      label: "Insights",      icon: Lightbulb, hint: "What the Content lead agent has filed for a decision" },
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
      { href: "/content/tags",   label: "Tag Library",  icon: Tag,    hint: "The tag vocabulary the library is organised by" },
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
];

/** The group a path belongs to. Longest href wins, so /content never swallows the rest. */
function activeGroup(pathname: string): Group {
  const dashboard = GROUPS[0]!;
  if (pathname === "/content") return dashboard;
  const match = GROUPS
    .flatMap(g => g.tabs.map(t => ({ g, len: t.href.length, hit: pathname === t.href || pathname.startsWith(t.href + "/") })))
    .filter(x => x.hit)
    .sort((a, b) => b.len - a.len)[0];
  return match?.g ?? dashboard;
}

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = activeGroup(pathname);
  const activeTab = current.tabs.find(t => pathname === t.href || pathname.startsWith(t.href + "/"));

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
      <div style={{
        display: "flex", gap: "0.4rem", flexWrap: "wrap",
        borderBottom: current.tabs.length ? "none" : "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "0.75rem",
        marginBottom: current.tabs.length ? 0 : "1.5rem",
      }}>
        {GROUPS.map(g => {
          const active = g.id === current.id;
          const Icon = g.icon;
          return (
            <Link
              key={g.id}
              href={g.href}
              id={`content-group-${g.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                background: active ? `${g.color}18` : "rgba(255,255,255,0.04)",
                color: active ? g.color : "#64748b",
                border: active ? `1px solid ${g.color}30` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.35rem 0.95rem",
                fontSize: 11, fontWeight: 700, textDecoration: "none",
                textTransform: "uppercase", letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
            >
              <Icon size={12} />
              {g.label}
            </Link>
          );
        })}
      </div>

      {/* ── Second row: the pages in this group ──────────────────────────── */}
      {/*
        Always rendered for a group that has pages, never on hover and never
        collapsed. A menu you have to open is a menu you have to remember the
        contents of, and the whole complaint was not being able to find things.
      */}
      {current.tabs.length > 0 && (
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
                id={`content-nav-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
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
