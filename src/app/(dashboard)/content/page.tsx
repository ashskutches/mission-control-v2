"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Film, ImageIcon, FileText, Layers,
  Tag, FolderOpen, TrendingUp, Package, Copy, ArrowRight,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import ChatBox from "@/components/ChatBox";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

const ACCENT = "#f59e0b";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriveStats {
  configured: boolean;
  total: number;
  videos: number;
  images: number;
  documents: number;
  other: number;
  tagged: number;
  untagged: number;
  tagCoverage: number;
}

interface AssignedAgent { id: string; name: string; emoji?: string; color?: string; }

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub, loading }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string; loading?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...CARD, flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</span>
      </div>
      {loading ? (
        <div style={{ height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
      ) : (
        <>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color }}>{value}</div>
          {sub && <p style={{ fontSize: 10, color: "#475569", marginTop: "0.2rem" }}>{sub}</p>}
        </>
      )}
    </motion.div>
  );
}

// ── Asset Library Stats Panel ─────────────────────────────────────────────────

function AssetLibraryPanel({ stats, loading }: { stats: DriveStats | null; loading: boolean }) {
  const FILE_TYPES = [
    { key: "images",    label: "Images",    color: "#38bdf8", icon: ImageIcon },
    { key: "documents", label: "Documents", color: "#10b981", icon: FileText },
    { key: "other",     label: "Other",     color: "#94a3b8", icon: Package },
  ] as const;

  const total    = stats?.total    ?? 0;
  const tagged   = stats?.tagged   ?? 0;
  const untagged = stats?.untagged ?? 0;
  const coverage = stats?.tagCoverage ?? 0;

  return (
    <div style={{ ...CARD, marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          Asset Library
        </p>
        {!loading && !stats?.configured && (
          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "2px 8px" }}>
            Drive not configured
          </span>
        )}
        {!loading && stats?.configured && (
          <a href="/content/assets" style={{ fontSize: 10, color: "#64748b", textDecoration: "none", fontWeight: 700 }}>Tag files →</a>
        )}
      </div>

      {/* File type breakdown */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {/* Total */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 0.85rem", flex: 1 }}>
          <FolderOpen size={14} color="#64748b" />
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>
              {loading ? "–" : total}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Total Files</div>
          </div>
        </div>

        {FILE_TYPES.map(({ key, label, color, icon: Icon }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 10, padding: "0.5rem 0.85rem", flex: 1 }}>
            <Icon size={14} color={color} />
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color, lineHeight: 1 }}>
                {loading ? "–" : (stats?.[key] ?? 0)}
              </div>
              <div style={{ fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: 0.8 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tagging progress */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Tag size={11} color="#10b981" />
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tag Coverage</span>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 800 }}>{loading ? "–" : tagged} tagged</span>
            <span style={{ fontSize: 11, color: untagged > 0 ? "#f43f5e" : "#64748b", fontWeight: 800 }}>{loading ? "–" : untagged} untagged</span>
            <span style={{ fontSize: 11, color: "#f1f5f9", fontWeight: 800 }}>{loading ? "–" : coverage}%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: loading ? "0%" : `${coverage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ height: "100%", background: `linear-gradient(90deg, #10b981, #34d399)`, borderRadius: 99 }}
          />
        </div>
        {!loading && untagged > 0 && (
          <p style={{ fontSize: 10, color: "#475569", marginTop: "0.4rem" }}>
            {untagged} files need tagging — <a href="/content/assets" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}>open Asset Tagger →</a>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Quick Nav Tiles ───────────────────────────────────────────────────────────

const NAV_TILES = [
  {
    href: "/content/assets",
    label: "Asset Tagger",
    icon: Tag,
    color: "#38bdf8",
    sub: "Batch-tag files for agents & search",
    badge: null,
  },
  {
    href: "/website/snippets",
    label: "Section Builder",
    icon: Layers,
    color: "#a78bfa",
    sub: "Generate Shopify snippets from prompts",
    badge: "AI",
  },
  {
    href: "/content/copy",
    label: "Copy Studio",
    icon: Copy,
    color: "#10b981",
    sub: "Ad copy, emails, product descriptions",
    badge: "AI",
  },
];

function QuickNavTile({ href, label, icon: Icon, color, sub, badge }: typeof NAV_TILES[0]) {
  return (
    <motion.a
      href={href}
      whileHover={{ y: -2, borderColor: `${color}40` }}
      transition={{ duration: 0.15 }}
      style={{
        ...CARD,
        flex: 1,
        minWidth: 180,
        textDecoration: "none",
        display: "block",
        border: `1px solid ${color}18`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* glow accent top-right */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${color}12, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, flex: 1 }}>{label}</span>
        {badge && (
          <span style={{ fontSize: 8, fontWeight: 900, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 8, padding: "1px 5px", letterSpacing: "0.06em" }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#475569", marginBottom: "0.75rem" }}>{sub}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Open <ArrowRight size={10} />
      </div>
    </motion.a>
  );
}

// ── Content Hub Page ──────────────────────────────────────────────────────────

const CONTENT_HINT = `
You are the Content Intelligence agent for Leaps & Rebounds — an ecommerce brand selling rebounders/trampolines.

Your domain covers ALL content production:
- Asset library: images, raw files tagged by type/campaign/theme
- Shopify section snippets: custom liquid sections for A/B testing
- Copy assets: ads, emails, product descriptions, SMS

Your job is to:
- Audit existing content for gaps (untagged assets, missing copy types)
- Recommend content briefs based on top-converting audiences and page sections
- Identify which personas/audiences we're under-serving with content
- Suggest next content priorities based on what's working in the UCB1 audience system

Be direct and specific. Reference asset counts, tag coverage, and section performance where relevant.
Always tie content recommendations to business outcomes (conversion, LTV, CAC reduction).
`.trim();

export default function ContentHubPage() {
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(null);

  const fetchData = useCallback(async () => {
    setDriveLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/stats`);
      if (res.ok) setDriveStats(await res.json());
    } catch { /* silent */ }
    finally { setDriveLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accentColor = (assignedAgent as any)?.color ?? ACCENT;

  const agentMetrics = [
    { label: "Total Drive Files", value: String(driveStats?.total ?? 0) },
    { label: "Tagged Files",      value: String(driveStats?.tagged ?? 0) },
    { label: "Untagged Files",    value: String(driveStats?.untagged ?? 0) },
    { label: "Tag Coverage",      value: `${driveStats?.tagCoverage ?? 0}%` },
    { label: "Images",            value: String(driveStats?.images ?? 0) },
    { label: "Documents",         value: String(driveStats?.documents ?? 0) },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: main content ── */}
      <div>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Film size={18} color={ACCENT} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Content Hub</h1>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Manage, create, and tag all business content</p>
            </div>
          </div>
        </motion.div>

        {/* Agent Panel */}
        <div style={{ marginBottom: "1.25rem" }}>
          <SectionAgentPanel
            sectionId="content"
            sectionName="Content Hub"
            sectionHint={CONTENT_HINT}
            accentColor={ACCENT}
            onAgentAssigned={a => setAssignedAgent(a)}
          />
        </div>

        {/* KPI Row */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <StatCard label="Total Files"    value={driveStats?.total    ?? 0} icon={FolderOpen}  color="#f59e0b" sub="In Drive library"     loading={driveLoading} />
          <StatCard label="Tagged"         value={driveStats?.tagged   ?? 0} icon={Tag}         color="#10b981" sub="Ready for agents"     loading={driveLoading} />
          <StatCard label="Untagged"       value={driveStats?.untagged ?? 0} icon={TrendingUp}  color="#f43f5e" sub="Need tagging"         loading={driveLoading} />
          <StatCard label="Tag Coverage"   value={`${driveStats?.tagCoverage ?? 0}%`} icon={ImageIcon} color="#38bdf8" sub="Coverage score" loading={driveLoading} />
        </div>

        {/* Asset Library Stats */}
        <AssetLibraryPanel stats={driveStats} loading={driveLoading} />

        {/* Quick nav tiles */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.75rem" }}>
            Content Tools
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {NAV_TILES.map(tile => <QuickNavTile key={tile.href} {...tile} />)}
          </div>
        </div>
      </div>

      {/* ── Right: Agent Chat ── */}
      <div style={{ position: "sticky", top: "1rem" }}>
        <div style={{ height: 520 }}>
          {assignedAgent ? (
            <ChatBox
              agentId={assignedAgent.id}
              agentName={assignedAgent.name}
              agentEmoji={assignedAgent.emoji}
              agentColor={accentColor}
              mode="fill"
              showHeader
              showChatLink
              conversationKey={`${assignedAgent.id}-content`}
              context={{
                sectionId: "content",
                sectionName: "Content Hub",
                metrics: agentMetrics,
              }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <Film size={24} color="#475569" />
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
                Assign a content agent above<br />to enable the intelligence chat.
              </p>
            </div>
          )}
        </div>

        {assignedAgent && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              "What content should we prioritize creating next?",
              "Which assets are untagged and most urgent?",
              "What audience segments lack dedicated content?",
            ].map(prompt => (
              <button key={prompt}
                style={{ textAlign: "left", background: `${accentColor}06`, border: `1px solid ${accentColor}15`, borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: 11, color: "#64748b", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}10`; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}06`; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}>
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
