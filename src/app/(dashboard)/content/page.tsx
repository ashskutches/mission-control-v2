"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Film, ImageIcon, FileText, Layers, Video, FolderOpen,
  Tag, Sparkles, RefreshCw, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Package, Copy, ArrowRight,
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

interface ContentStats {
  clips_total: number;
  clips_high_quality: number;
  video_jobs: { draft: number; pending: number; rendering: number; done: number; failed: number };
  sections_total: number;
  assets_tagged: number;
  assets_untagged: number;
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

// ── Video Job Status Bar ───────────────────────────────────────────────────────

function VideoJobStatusBar({ jobs, loading }: { jobs: ContentStats["video_jobs"] | null; loading: boolean }) {
  const statuses = [
    { key: "draft",     label: "Draft",     color: "#64748b", icon: Clock },
    { key: "pending",   label: "Approved",  color: "#f59e0b", icon: CheckCircle2 },
    { key: "rendering", label: "Rendering", color: "#38bdf8", icon: RefreshCw },
    { key: "done",      label: "Done",      color: "#10b981", icon: CheckCircle2 },
    { key: "failed",    label: "Failed",    color: "#f43f5e", icon: AlertCircle },
  ] as const;

  return (
    <div style={{ ...CARD, marginBottom: "1.25rem" }}>
      <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
        Video Jobs Pipeline
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {statuses.map(({ key, label, color, icon: Icon }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 20, padding: "0.3rem 0.75rem" }}>
            <Icon size={11} color={color} />
            <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color }}>
              {loading ? "–" : (jobs?.[key] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick Nav Tiles ───────────────────────────────────────────────────────────

const NAV_TILES = [
  {
    href: "/content/video",
    label: "Video Agent",
    icon: Video,
    color: "#f59e0b",
    sub: "Create storyboards from your clip library",
    badge: "AI",
  },
  {
    href: "/content/assets",
    label: "Asset Tagger",
    icon: Tag,
    color: "#38bdf8",
    sub: "Batch-tag files for agents & search",
    badge: null,
  },
  {
    href: "/content/sections",
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

// ── Recent Activity Feed ───────────────────────────────────────────────────────

interface VideoJob {
  id: string;
  status: string;
  created_at: string;
  output_url?: string;
  error_message?: string;
}

function RecentJobsFeed({ jobs, loading }: { jobs: VideoJob[]; loading: boolean }) {
  const statusColor: Record<string, string> = {
    draft: "#64748b", pending: "#f59e0b", rendering: "#38bdf8", done: "#10b981", failed: "#f43f5e",
  };
  return (
    <div style={CARD}>
      <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
        Recent Video Jobs
      </p>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <p style={{ fontSize: 12, color: "#475569" }}>No video jobs yet — create one in the Video Agent.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {jobs.map((j, i) => (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[j.status] ?? "#64748b", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", flex: 1 }}>#{j.id.slice(0, 8)}</span>
              <span style={{ fontSize: 10, color: statusColor[j.status] ?? "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: `${statusColor[j.status] ?? "#64748b"}12`, padding: "1px 6px", borderRadius: 10 }}>
                {j.status}
              </span>
              <span style={{ fontSize: 10, color: "#475569" }}>
                {new Date(j.created_at).toLocaleDateString()}
              </span>
            </motion.div>
          ))}
          <a href="/content/video" style={{ fontSize: 11, color: ACCENT, fontWeight: 700, marginTop: "0.25rem", textDecoration: "none" }}>
            View all jobs →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Content Hub Page ──────────────────────────────────────────────────────────

const CONTENT_HINT = `
You are the Content Intelligence agent for Leaps & Rebounds — an ecommerce brand selling rebounders/trampolines.

Your domain covers ALL content production:
- Video library: clip metadata, quality scores, storyboard drafts, rendering jobs
- Asset library: images, raw files tagged by type/campaign/theme
- Shopify section snippets: custom liquid sections for A/B testing
- Copy assets: ads, emails, product descriptions, SMS

Your job is to:
- Audit existing content for gaps (missing video content types, untagged assets, low-quality clips)
- Recommend content briefs based on top-converting audiences and page sections
- Surface video jobs stuck in draft/failed state
- Identify which personas/audiences we're under-serving with content
- Suggest next content priorities based on what's working in the UCB1 audience system

Be direct and specific. Reference clip counts, job statuses, and section performance where relevant.
Always tie content recommendations to business outcomes (conversion, LTV, CAC reduction).
`.trim();

export default function ContentHubPage() {
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch recent video jobs (our main data source for now)
      const [jobsRes] = await Promise.allSettled([
        fetch(`${BOT_URL}/admin/video/jobs?limit=8`),
      ]);

      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const jobData = await jobsRes.value.json();
        const jobs: VideoJob[] = jobData.data ?? [];
        setRecentJobs(jobs);

        // Synthesise stats from job data
        const jobCounts = { draft: 0, pending: 0, rendering: 0, done: 0, failed: 0 };
        for (const j of jobs) {
          if (j.status in jobCounts) jobCounts[j.status as keyof typeof jobCounts]++;
        }
        setStats({
          clips_total: 0,
          clips_high_quality: 0,
          video_jobs: jobCounts,
          sections_total: 0,
          assets_tagged: 0,
          assets_untagged: 0,
        });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accentColor = (assignedAgent as any)?.color ?? ACCENT;

  const agentMetrics = [
    { label: "Video Jobs (total)", value: String(recentJobs.length) },
    { label: "Draft Jobs", value: String(stats?.video_jobs.draft ?? 0) },
    { label: "Completed Videos", value: String(stats?.video_jobs.done ?? 0) },
    { label: "Failed Jobs", value: String(stats?.video_jobs.failed ?? 0) },
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
          <StatCard label="Video Jobs" value={recentJobs.length} icon={Film} color="#f59e0b" sub="All time" loading={loading} />
          <StatCard label="Completed" value={stats?.video_jobs.done ?? 0} icon={CheckCircle2} color="#10b981" sub="Rendered videos" loading={loading} />
          <StatCard label="In Queue" value={(stats?.video_jobs.pending ?? 0) + (stats?.video_jobs.rendering ?? 0)} icon={RefreshCw} color="#38bdf8" sub="Pending + rendering" loading={loading} />
          <StatCard label="Failed" value={stats?.video_jobs.failed ?? 0} icon={AlertCircle} color="#f43f5e" sub="Need attention" loading={loading} />
        </div>

        {/* Video pipeline status */}
        <VideoJobStatusBar jobs={stats?.video_jobs ?? null} loading={loading} />

        {/* Quick nav tiles */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.75rem" }}>
            Content Tools
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {NAV_TILES.map(tile => <QuickNavTile key={tile.href} {...tile} />)}
          </div>
        </div>

        {/* Recent jobs */}
        <RecentJobsFeed jobs={recentJobs} loading={loading} />
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
              "Which video clips are underutilized?",
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
