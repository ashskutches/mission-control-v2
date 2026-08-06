"use client";

/**
 * Blog Library — the interface over /admin/blog on gravity-claw.
 *
 * Seven views:
 *   Overview     — library health plus the audit findings, worst first
 *   Duplicates   — republished titles and topic clusters competing for one query
 *   Articles     — the searchable mirror of the ~785 existing posts
 *   Performance  — each article joined to what search and analytics say it earns
 *   Improve      — ranked, risk-tiered fixes for the articles we already have
 *   New posts    — search demand with no article behind it, checked against the library
 *   Drafts       — the writing pipeline for new posts, from brief to published
 *
 * The last three live in ./BlogSeo and read /admin/blog/{performance,recommendations,
 * opportunities}. They apply nothing — every action is a deep link into Shopify.
 *
 * Only two things here change anything: "sync" pulls Shopify into our mirror, and
 * "publish" on an approved draft creates an article. Everything else reads. Existing
 * articles are never edited from this screen — the pencil icon deep-links into
 * Shopify's own editor instead.
 *
 * The mirror starts empty and the Shopify token currently lacks the `read_content`
 * scope, so the states that matter most are the unhappy ones: an empty mirror has to
 * say what to click, and a denied sync has to say exactly which scope to grant rather
 * than surfacing a raw GraphQL error.
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Loader2, AlertTriangle, ExternalLink, Edit3, Search,
  ChevronDown, ChevronRight, Copy, Layers, FileText, CheckCircle2,
  Database, ShieldAlert, Link2, Image as ImageIcon, Clock,
  PenLine, Sparkles, Send, Plus, XCircle,
  TrendingUp, Wrench, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { BlogPerformanceView, BlogImproveView, BlogOpportunitiesView } from "./BlogSeo";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

/** Storefront and admin hosts for deep links out to the real article. */
const STOREFRONT = "https://leapsandrebounds.com";
const STORE_HANDLE = "leaps-rebounds";

// ── Types (mirror the API shapes in gravity-claw/src/utils/blog-audit.ts) ─────

interface BlogSummary {
  id: string;
  handle: string;
  title: string;
  templateSuffix: string | null;
  articleCount: number;
}

interface ArticleRef {
  shopify_article_id: string;
  title: string;
  handle: string;
  blog_handle: string;
  word_count: number;
  published_at: string | null;
}

interface Finding {
  code: string;
  severity: "high" | "medium" | "low";
  label: string;
  detail: string;
  count: number;
  articles: ArticleRef[];
  truncated: boolean;
}

interface Cluster {
  topic: string[];
  size: number;
  articles: ArticleRef[];
}

interface AuditResult {
  summary: {
    total_articles: number;
    published: number;
    unpublished: number;
    by_blog: Record<string, number>;
    avg_word_count: number;
    median_word_count: number;
    with_product_link: number;
    with_internal_link: number;
    with_seo_description: number;
    with_featured_image: number;
    oldest_published: string | null;
    newest_published: string | null;
  } | null;
  findings: Finding[];
  clusters: Cluster[];
  duplicate_titles: { title: string; articles: ArticleRef[] }[];
  note?: string;
}

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "done" | "failed";
  fetched: number;
  inserted: number;
  updated: number;
  deleted: number;
  duration_ms: number | null;
  error: string | null;
}

interface Stats {
  mirrored_articles: number;
  by_blog: Record<string, { articles: number; published: number; avg_word_count: number }>;
  last_sync: SyncRun | null;
  sync_in_flight: boolean;
}

type DraftState = "draft" | "in_review" | "approved" | "scheduled" | "published" | "rejected" | "archived";

interface GateCheck {
  code: string;
  goal: "revenue" | "reader" | "discovery";
  blocking: boolean;
  label: string;
  detail: string;
  overriddenWith?: string;
}

interface GateResult {
  ready: boolean;
  blocking: GateCheck[];
  advisory: GateCheck[];
  overridden: GateCheck[];
  metrics: { word_count: number; internal_link_count: number; product_link_count: number };
}

interface Draft {
  id: string;
  state: DraftState;
  topic: string;
  angle: string | null;
  target_keyword: string | null;
  blog_handle: string;
  title: string | null;
  handle: string | null;
  seo_title: string | null;
  seo_description: string | null;
  image_url: string | null;
  image_alt: string | null;
  featured_image_source: string | null;
  product_suggestions: ProductSuggestion[] | null;
  tags: string[];
  product_handles: string[];
  gate: GateResult | Record<string, never>;
  generated_by: string | null;
  repaired: boolean;
  generation_error: string | null;
  shopify_article_id: string | null;
  published_at: string | null;
  updated_at: string;
}

/** What the topic → catalogue resolver picked when the brief named no products. */
interface ProductSuggestion {
  handle: string;
  title: string;
  score: number;
  fallback: boolean;
  reason: string;
}

/** One featured-image option. Mirrors `blog_image_candidates`. */
interface ImageCandidate {
  id: string;
  draft_id: string;
  round: number;
  rank: number;
  source: "library" | "generated";
  library_file_id: string | null;
  drive_url: string | null;
  image_url: string;
  image_alt: string;
  prompt: string | null;
  model: string | null;
  angle: string | null;
  score: number;
  relevance: number;
  matched_terms: string[];
  reasons: string[];
  tags: string[];
  image_type: string | null;
  mood: string | null;
  status: "offered" | "chosen" | "rejected";
}

interface FeatureWeight {
  label: string;
  weight: number;
  picks: number;
  rejects: number;
}

interface ImagePreference {
  ready: boolean;
  sampleSize: number;
  tags: FeatureWeight[];
  imageTypes: FeatureWeight[];
  moods: FeatureWeight[];
  sources: FeatureWeight[];
}

interface ProposeResult {
  candidates: ImageCandidate[];
  round: number;
  from_library: number;
  generated: number;
  library_considered: number;
  best_rejected_score: number | null;
  preference: ImagePreference;
  skipped: { source: string; reason: string }[];
}

interface MirrorArticle extends ArticleRef {
  author: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  image_url: string | null;
  is_published: boolean;
  shopify_updated_at: string | null;
  internal_link_count: number;
  product_link_count: number;
  external_link_count: number;
}

// ── Presentation helpers ──────────────────────────────────────────────────────

const SEVERITY = {
  high:   { color: "#f43f5e", label: "High" },
  medium: { color: "#f59e0b", label: "Medium" },
  low:    { color: "#64748b", label: "Low" },
} as const;

const DRAFT_STATE: Record<DraftState, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "#64748b" },
  in_review: { label: "In review", color: "#38bdf8" },
  approved:  { label: "Approved",  color: "#34d399" },
  scheduled: { label: "Scheduled", color: "#a78bfa" },
  published: { label: "Published", color: "#e98d20" },
  rejected:  { label: "Rejected",  color: "#f43f5e" },
  archived:  { label: "Archived",  color: "#475569" },
};

const PANEL: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.12em", margin: 0,
};

/** gid://shopify/Article/393369518230 → 393369518230, for admin deep links. */
function numericId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

function liveUrl(a: ArticleRef): string {
  return `${STOREFRONT}/blogs/${a.blog_handle}/${a.handle}`;
}

function adminUrl(a: ArticleRef): string {
  return `https://admin.shopify.com/store/${STORE_HANDLE}/articles/${numericId(a.shopify_article_id)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Small components ──────────────────────────────────────────────────────────

function Tile({ label, value, sub, color = "#94a3b8", icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: LucideIcon;
}) {
  return (
    <div style={{ ...PANEL, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={LABEL}>{label}</p>
        <Icon size={13} color={color} />
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>{sub}</p>}
    </div>
  );
}

/** One article as a row with links out to the storefront and the Shopify editor. */
function ArticleRow({ a, showBlog = true }: { a: ArticleRef; showBlog?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
      borderRadius: 8, background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 12.5, color: "#e2e8f0", margin: 0, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{a.title}</p>
        <p style={{ fontSize: 10.5, color: "#475569", margin: "2px 0 0" }}>
          {showBlog && <span style={{ color: "#64748b" }}>{a.blog_handle}</span>}
          {showBlog && " · "}
          {a.word_count.toLocaleString()} words · {fmtDate(a.published_at)}
        </p>
      </div>
      <a href={liveUrl(a)} target="_blank" rel="noreferrer" title="View on the storefront"
        style={{ color: "#475569", display: "flex", padding: 4 }}>
        <ExternalLink size={13} />
      </a>
      <a href={adminUrl(a)} target="_blank" rel="noreferrer" title="Edit in Shopify admin"
        style={{ color: "#475569", display: "flex", padding: 4 }}>
        <Edit3 size={13} />
      </a>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY[f.severity];

  return (
    <div style={{ ...PANEL, borderLeft: `2px solid ${sev.color}`, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "13px 16px", background: "none", border: "none",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        {open ? <ChevronDown size={14} color="#475569" /> : <ChevronRight size={14} color="#475569" />}
        <span style={{
          fontSize: 9, fontWeight: 800, color: sev.color, background: `${sev.color}18`,
          border: `1px solid ${sev.color}30`, borderRadius: 4, padding: "2px 6px",
          textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0,
        }}>{sev.label}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{f.label}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: sev.color }}>{f.count}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 16px 14px 42px" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55, margin: "0 0 12px" }}>
                {f.detail}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {f.articles.map(a => <ArticleRow key={a.shopify_article_id} a={a} />)}
              </div>
              {f.truncated && (
                <p style={{ fontSize: 11, color: "#475569", margin: "10px 0 0", fontStyle: "italic" }}>
                  Showing {f.articles.length} of {f.count}. The rest are in the Articles tab.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "duplicates" | "articles" | "performance" | "improve" | "opportunities" | "drafts";

export default function BlogLibrary() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [blogs, setBlogs] = useState<BlogSummary[] | null>(null);
  const [blogsErr, setBlogsErr] = useState<{ error: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const [syncErr, setSyncErr] = useState<{ error: string; hint?: string } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [draftCount, setDraftCount] = useState(0);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/stats`, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) setStats(await res.json());
    } catch { /* leave prior stats visible */ }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/audit`, { signal: AbortSignal.timeout(60_000) });
      if (res.ok) setAudit(await res.json());
    } catch { /* leave prior audit visible */ }
  }, []);

  /**
   * Live blog list. This is also the scope probe — it is the cheapest call that fails
   * when the Admin token cannot read content, so its error drives the banner.
   */
  const loadBlogs = useCallback(async () => {
    setBlogsErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/blogs`, { signal: AbortSignal.timeout(20_000) });
      const body = await res.json();
      if (!res.ok) { setBlogsErr(body); setBlogs(null); return; }
      setBlogs(body.blogs ?? []);
    } catch (e) {
      setBlogsErr({ error: errMessage(e) || "Could not reach gravity-claw" });
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadAudit(), loadBlogs()]);
      setLoading(false);
    })();
  }, [loadStats, loadAudit, loadBlogs]);

  // Elapsed counter — a full sync is ~15-60s, long enough that a bare spinner reads as a hang.
  useEffect(() => {
    if (!syncing) { setSyncElapsed(0); return; }
    const t = setInterval(() => setSyncElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [syncing]);

  const runSync = async () => {
    setSyncing(true); setSyncErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(300_000),
      });
      const body = await res.json();
      if (!res.ok) { setSyncErr(body); return; }
      await Promise.all([loadStats(), loadAudit(), loadBlogs()]);
    } catch (e) {
      setSyncErr({
        error: e instanceof Error && e.name === "TimeoutError"
          ? "Sync timed out after 5 minutes. It may still be running on the server — check back with Sync again."
          : errMessage(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  const s = audit?.summary;
  const mirrored = stats?.mirrored_articles ?? 0;
  const liveTotal = blogs?.reduce((n, b) => n + b.articleCount, 0) ?? null;
  const scopeProblem = blogsErr?.hint || syncErr?.hint;

  const tabs = [
    { key: "overview" as Tab, label: "Overview", icon: ShieldAlert, count: audit?.findings.length ?? 0 },
    { key: "duplicates" as Tab, label: "Duplicates", icon: Copy,
      count: (audit?.duplicate_titles.length ?? 0) + (audit?.clusters.length ?? 0) },
    { key: "articles" as Tab, label: "Articles", icon: FileText, count: mirrored },
    { key: "performance" as Tab, label: "Performance", icon: TrendingUp, count: null },
    { key: "improve" as Tab, label: "Improve", icon: Wrench, count: null },
    { key: "opportunities" as Tab, label: "New posts", icon: Lightbulb, count: null },
    { key: "drafts" as Tab, label: "Drafts", icon: PenLine, count: draftCount },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Sync bar ───────────────────────────────────────────────────────── */}
      <div style={{ ...PANEL, padding: "14px 18px", display: "flex", alignItems: "center",
        gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Database size={15} color="#e98d20" />
          <div>
            <p style={LABEL}>Mirror</p>
            <p style={{ fontSize: 13, color: "#e2e8f0", margin: "2px 0 0", fontWeight: 700 }}>
              {mirrored.toLocaleString()} articles
              {liveTotal !== null && (
                <span style={{ color: mirrored === liveTotal ? "#34d399" : "#f59e0b", fontWeight: 600 }}>
                  {" "}/ {liveTotal.toLocaleString()} live in Shopify
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{ height: 28, width: 1, background: "rgba(255,255,255,0.07)" }} />

        <div>
          <p style={LABEL}>Last sync</p>
          <p style={{ fontSize: 13, color: "#e2e8f0", margin: "2px 0 0", fontWeight: 700 }}>
            {timeAgo(stats?.last_sync?.finished_at ?? stats?.last_sync?.started_at ?? null)}
            {stats?.last_sync?.status === "failed" && (
              <span style={{ color: "#f43f5e", fontWeight: 600 }}> · failed</span>
            )}
            {stats?.last_sync?.status === "done" && stats.last_sync.duration_ms && (
              <span style={{ color: "#475569", fontWeight: 600 }}>
                {" "}· {Math.round(stats.last_sync.duration_ms / 1000)}s
              </span>
            )}
          </p>
        </div>

        {blogs && blogs.length > 0 && (
          <>
            <div style={{ height: 28, width: 1, background: "rgba(255,255,255,0.07)" }} />
            <div>
              <p style={LABEL}>Blogs</p>
              <p style={{ fontSize: 13, color: "#e2e8f0", margin: "2px 0 0", fontWeight: 700 }}>
                {blogs.map(b => `${b.title} (${b.articleCount})`).join(" · ")}
              </p>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        <motion.button whileHover={{ scale: syncing ? 1 : 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={runSync} disabled={syncing}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10,
            background: syncing ? "rgba(255,255,255,0.04)" : "rgba(233,141,32,0.14)",
            border: `1px solid ${syncing ? "rgba(255,255,255,0.08)" : "rgba(233,141,32,0.35)"}`,
            color: syncing ? "#64748b" : "#e98d20", fontSize: 12, fontWeight: 800,
            cursor: syncing ? "default" : "pointer", fontFamily: "inherit",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
          {syncing
            ? <><Loader2 size={13} className="spin" /> Syncing… {syncElapsed}s</>
            : <><RefreshCw size={13} /> Sync from Shopify</>}
        </motion.button>
      </div>

      {/* ── Scope banner. The one error worth explaining in full. ─────────── */}
      {scopeProblem && (
        <div style={{
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 14, padding: "16px 18px", display: "flex", gap: 13,
        }}>
          <AlertTriangle size={17} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", margin: 0 }}>
              Shopify is refusing to hand over articles
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.6 }}>
              {scopeProblem}
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "10px 0 0", lineHeight: 1.6 }}>
              Fix it in Shopify admin → <strong style={{ color: "#cbd5e1" }}>Settings → Apps and sales
              channels → Develop apps</strong> → the gravity-claw app →{" "}
              <strong style={{ color: "#cbd5e1" }}>Configuration → Admin API access scopes</strong> → enable{" "}
              <code style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 5px",
                borderRadius: 4 }}>read_content</code>. Tick{" "}
              <code style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 5px",
                borderRadius: 4 }}>write_content</code> at the same time and publishing will work later
              without a second trip. Save, then sync again.
            </p>
            <p style={{ fontSize: 11, color: "#475569", margin: "10px 0 0", fontFamily: "monospace" }}>
              {blogsErr?.error || syncErr?.error}
            </p>
          </div>
        </div>
      )}

      {/* Any other failure, stated plainly rather than swallowed. */}
      {!scopeProblem && (blogsErr || syncErr) && (
        <div style={{
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)",
          borderRadius: 12, padding: "13px 16px", display: "flex", gap: 11, alignItems: "flex-start",
        }}>
          <AlertTriangle size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#fda4af", margin: 0, lineHeight: 1.5 }}>
            {syncErr?.error || blogsErr?.error}
          </p>
        </div>
      )}

      {/* ── Loading / empty ────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ ...PANEL, padding: "48px", display: "flex", justifyContent: "center" }}>
          <Loader2 size={22} color="#475569" className="spin" />
        </div>
      ) : mirrored === 0 && tab !== "drafts" ? (
        <div style={{ ...PANEL, padding: "44px 30px", textAlign: "center" }}>
          <Database size={30} color="#334155" style={{ marginBottom: 14 }} />
          <p style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>
            The mirror is empty
          </p>
          <p style={{ fontSize: 12.5, color: "#64748b", margin: "8px auto 0", maxWidth: 460, lineHeight: 1.6 }}>
            {liveTotal
              ? `Shopify is holding ${liveTotal.toLocaleString()} articles. Sync pulls them in and runs the audit — no article is edited or published.`
              : "Sync pulls every article from Shopify into the local mirror and audits it. Nothing is edited or published."}
          </p>
          <button onClick={() => setTab("drafts")} style={{
            marginTop: 16, padding: "8px 16px", borderRadius: 9,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
            color: "#94a3b8", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Write a post anyway
          </button>
        </div>
      ) : (
        <>
          {/* ── Tabs ────────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tabs.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <motion.button key={t.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10,
                    background: active ? "rgba(233,141,32,0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(233,141,32,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: active ? "#e98d20" : "#475569", fontSize: 11.5, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                  <Icon size={13} />
                  {t.label}
                  {t.count !== null && <span style={{ opacity: 0.65, fontWeight: 700 }}>{t.count}</span>}
                </motion.button>
              );
            })}
          </div>

          {tab === "overview" && s && (
            <>
              <div style={{ display: "grid", gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))" }}>
                <Tile label="Articles" value={s.total_articles.toLocaleString()} icon={FileText}
                  color="#e98d20"
                  sub={Object.entries(s.by_blog).map(([h, n]) => `${h}: ${n}`).join(" · ")} />
                <Tile label="Published" value={s.published.toLocaleString()} icon={CheckCircle2}
                  color="#34d399"
                  sub={s.unpublished ? `${s.unpublished} unpublished` : "all live"} />
                <Tile label="Median length" value={`${s.median_word_count.toLocaleString()}w`} icon={Layers}
                  color="#818cf8" sub={`mean ${s.avg_word_count.toLocaleString()}w`} />
                <Tile label="Links to a product" value={pct(s.with_product_link, s.total_articles)}
                  icon={Link2} color={s.with_product_link / s.total_articles < 0.5 ? "#f43f5e" : "#34d399"}
                  sub={`${s.with_product_link.toLocaleString()} of ${s.total_articles.toLocaleString()}`} />
                <Tile label="Has meta description" value={pct(s.with_seo_description, s.total_articles)}
                  icon={Search} color="#38bdf8"
                  sub={`${s.with_seo_description.toLocaleString()} of ${s.total_articles.toLocaleString()}`} />
                <Tile label="Has an image" value={pct(s.with_featured_image, s.total_articles)}
                  icon={ImageIcon} color="#a78bfa"
                  sub={`${s.with_featured_image.toLocaleString()} of ${s.total_articles.toLocaleString()}`} />
                <Tile label="Oldest post" value={fmtDate(s.oldest_published)} icon={Clock} color="#64748b"
                  sub={`newest ${fmtDate(s.newest_published)}`} />
              </div>

              <div>
                <p style={{ ...LABEL, marginBottom: 10 }}>
                  Findings · worst first
                </p>
                {audit!.findings.length === 0 ? (
                  <div style={{ ...PANEL, padding: "28px", textAlign: "center" }}>
                    <CheckCircle2 size={22} color="#34d399" style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
                      Nothing flagged. Every article has links, metadata and enough substance.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {audit!.findings.map(f => <FindingCard key={f.code} f={f} />)}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "duplicates" && audit && (
            <DuplicatesView audit={audit} />
          )}

          {tab === "articles" && (
            <ArticlesView blogs={stats ? Object.keys(stats.by_blog) : []} />
          )}

          {tab === "performance" && <BlogPerformanceView />}

          {tab === "improve" && <BlogImproveView />}

          {tab === "opportunities" && <BlogOpportunitiesView />}

          {tab === "drafts" && (
            <DraftsView blogs={blogs} onCountChange={setDraftCount} />
          )}
        </>
      )}

      <style jsx global>{`
        .spin { animation: blogspin 1s linear infinite; }
        @keyframes blogspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Duplicates ────────────────────────────────────────────────────────────────

function DuplicatesView({ audit }: { audit: AuditResult }) {
  const dupes = audit.duplicate_titles;
  const clusters = audit.clusters;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Republished titles — the unambiguous case, so it leads. */}
      <div>
        <p style={{ ...LABEL, marginBottom: 4 }}>Republished titles · {dupes.length}</p>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
          The same title live more than once. Keep the best performer, redirect the rest.
        </p>
        {dupes.length === 0 ? (
          <div style={{ ...PANEL, padding: "20px", textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>No republished titles.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dupes.map((g, i) => (
              <div key={i} style={{ ...PANEL, padding: "13px 16px", borderLeft: "2px solid #f43f5e" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <Copy size={12} color="#f43f5e" />
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                    {g.articles.length}× “{g.title}”
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {g.articles.map(a => <ArticleRow key={a.shopify_article_id} a={a} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topic clusters — a judgement call, so the shared topic is shown as evidence. */}
      <div>
        <p style={{ ...LABEL, marginBottom: 4 }}>Topic clusters · {clusters.length}</p>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
          Different titles, same subject, same blog. Google picks one and discounts the others.
          Consolidating a cluster into one canonical post is usually worth more than a new article.
        </p>
        {clusters.length === 0 ? (
          <div style={{ ...PANEL, padding: "20px", textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>No competing topics found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clusters.map((c, i) => (
              <div key={i} style={{ ...PANEL, padding: "13px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9,
                  flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 17, fontWeight: 900, color: "#f59e0b", minWidth: 22,
                  }}>{c.size}</span>
                  <span style={{ fontSize: 10, color: "#475569", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>competing on</span>
                  {c.topic.map(t => (
                    <span key={t} style={{
                      fontSize: 10.5, fontWeight: 700, color: "#cbd5e1",
                      background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px",
                    }}>{t}</span>
                  ))}
                  <span style={{ fontSize: 10.5, color: "#475569" }}>
                    · {c.articles[0]?.blog_handle}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {c.articles.map(a => <ArticleRow key={a.shopify_article_id} a={a} showBlog={false} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Articles ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function ArticlesView({ blogs }: { blogs: string[] }) {
  const [rows, setRows] = useState<MirrorArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [blog, setBlog] = useState("");
  const [published, setPublished] = useState("");
  const [maxWords, setMaxWords] = useState("");
  const [order, setOrder] = useState("published_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), order, dir });
    if (q) params.set("q", q);
    if (blog) params.set("blog", blog);
    if (published) params.set("published", published);
    if (maxWords) params.set("max_words", maxWords);

    try {
      const res = await fetch(`${BOT_URL}/admin/blog/articles?${params}`,
        { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const body = await res.json();
        setRows(body.articles ?? []);
        setTotal(body.total ?? 0);
      }
    } catch { /* keep the previous page rather than blanking the table */ }
    finally { setLoading(false); }
  }, [offset, order, dir, q, blog, published, maxWords]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Any filter change invalidates the current page offset.
  useEffect(() => { setOffset(0); }, [q, blog, published, maxWords, order, dir]);

  const input: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, padding: "7px 11px", color: "#e2e8f0", fontSize: 12,
    fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={13} color="#475569" style={{ position: "absolute", left: 10, top: 9 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles…"
            style={{ ...input, paddingLeft: 30, width: "100%" }} />
        </div>
        <select value={blog} onChange={e => setBlog(e.target.value)} style={input}>
          <option value="">All blogs</option>
          {blogs.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={published} onChange={e => setPublished(e.target.value)} style={input}>
          <option value="">Any status</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <select value={maxWords} onChange={e => setMaxWords(e.target.value)} style={input}>
          <option value="">Any length</option>
          <option value="400">Under 400 words</option>
          <option value="800">Under 800 words</option>
        </select>
        <select value={`${order}:${dir}`}
          onChange={e => {
            const [o, d] = e.target.value.split(":");
            setOrder(o!); setDir(d as "asc" | "desc");
          }} style={input}>
          <option value="published_at:desc">Newest first</option>
          <option value="published_at:asc">Oldest first</option>
          <option value="word_count:asc">Shortest first</option>
          <option value="word_count:desc">Longest first</option>
          <option value="title:asc">Title A–Z</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...PANEL, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 130px 70px 60px 100px 62px",
          gap: 10, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {["Title", "Blog", "Words", "Links", "Published", ""].map((h, i) => (
            <p key={i} style={{ ...LABEL, fontSize: 9.5 }}>{h}</p>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: 34, display: "flex", justifyContent: "center" }}>
            <Loader2 size={18} color="#475569" className="spin" />
          </div>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#64748b", padding: 26, textAlign: "center", margin: 0 }}>
            Nothing matches those filters.
          </p>
        ) : rows.map(a => (
          <div key={a.shopify_article_id} style={{
            display: "grid", gridTemplateColumns: "1fr 130px 70px 60px 100px 62px",
            gap: 10, padding: "9px 14px", alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
            opacity: loading ? 0.5 : 1, transition: "opacity 0.15s",
          }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, color: "#e2e8f0", margin: 0, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.title}
              </p>
              {!a.is_published && (
                <span style={{ fontSize: 9.5, color: "#f59e0b", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>unpublished</span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.blog_handle}</p>
            <p style={{ fontSize: 11.5, margin: 0,
              color: a.word_count < 400 ? "#f43f5e" : "#94a3b8" }}>
              {a.word_count.toLocaleString()}
            </p>
            <p style={{ fontSize: 11.5, margin: 0,
              color: a.internal_link_count === 0 ? "#f43f5e" : "#94a3b8" }}
              title={`${a.internal_link_count} internal, ${a.product_link_count} to products, ${a.external_link_count} external`}>
              {a.internal_link_count}
              {a.product_link_count > 0 && <span style={{ color: "#34d399" }}> ·{a.product_link_count}</span>}
            </p>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{fmtDate(a.published_at)}</p>
            <div style={{ display: "flex", gap: 2 }}>
              <a href={liveUrl(a)} target="_blank" rel="noreferrer" title="View on the storefront"
                style={{ color: "#475569", padding: 4, display: "flex" }}>
                <ExternalLink size={13} />
              </a>
              <a href={adminUrl(a)} target="_blank" rel="noreferrer" title="Edit in Shopify admin"
                style={{ color: "#475569", padding: 4, display: "flex" }}>
                <Edit3 size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Pager */}
      {total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11.5, color: "#475569", margin: 0 }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0}
              style={{
                ...input, cursor: offset === 0 ? "default" : "pointer",
                opacity: offset === 0 ? 0.4 : 1, fontWeight: 700,
              }}>Previous</button>
            <button onClick={() => setOffset(o => o + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              style={{
                ...input, cursor: offset + PAGE_SIZE >= total ? "default" : "pointer",
                opacity: offset + PAGE_SIZE >= total ? 0.4 : 1, fontWeight: 700,
              }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Featured image picker ─────────────────────────────────────────────────────

/**
 * Four featured-image choices for one draft.
 *
 * `no_featured_image` is a blocking gate check and nothing used to fill the field in, so
 * every generated draft was structurally unpublishable. The server searches the tagged
 * photo library against the post's topic and generates only the shortfall; this is the
 * screen where a human picks one.
 *
 * Every card shows why it was offered. That is deliberate: when the four suggestions are
 * wrong, "matches rebound, cardio" is the only thing that tells you whether the topic
 * was misread or the library is simply missing the photo. The same applies to the
 * learned preference, which states how many past decisions it rests on and is not
 * applied at all below the minimum.
 */
function FeaturedImagePicker({ draft, onChanged }: {
  draft: Draft;
  onChanged: () => Promise<void> | void;
}) {
  const [candidates, setCandidates] = useState<ImageCandidate[] | null>(null);
  const [meta, setMeta] = useState<ProposeResult | null>(null);
  const [busy, setBusy] = useState<null | "find" | "library" | string>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts/${draft.id}/images`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) setCandidates((await res.json()).candidates ?? []);
    } catch { /* leave whatever is on screen */ }
  }, [draft.id]);

  useEffect(() => { load(); }, [load]);

  /** Generation is slow — four images against an external provider. Hence the timeout. */
  const propose = async (generate: boolean) => {
    setBusy(generate ? "find" : "library"); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts/${draft.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate }),
        signal: AbortSignal.timeout(300_000),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(payload.error || `Request failed (${res.status})`); return; }
      setMeta(payload as ProposeResult);
      setCandidates((payload.candidates ?? []) as ImageCandidate[]);
    } catch (e) { setErr(errMessage(e)); }
    finally { setBusy(null); }
  };

  const choose = async (candidateId: string) => {
    setBusy(candidateId); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts/${draft.id}/images/${candidateId}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(60_000),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(payload.error || `Request failed (${res.status})`); return; }
      await load();
      // The gate result changed, so the row's badge and Publish button are now stale.
      await onChanged();
    } catch (e) { setErr(errMessage(e)); }
    finally { setBusy(null); }
  };

  const latestRound = candidates?.length ? Math.max(...candidates.map(c => c.round)) : 0;
  const showing = (candidates ?? []).filter(c => c.round === latestRound || c.status === "chosen");
  const chosen = (candidates ?? []).find(c => c.status === "chosen");
  const pref = meta?.preference;

  const smallBtn = (color: string, disabled = false): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
    borderRadius: 7, background: disabled ? "rgba(255,255,255,0.03)" : `${color}18`,
    border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : color + "35"}`,
    color: disabled ? "#475569" : color, fontSize: 10, fontWeight: 800,
    cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
    textTransform: "uppercase", letterSpacing: "0.06em",
  });

  const working = busy === "find" || busy === "library";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p style={{ ...LABEL, color: chosen ? "#34d399" : "#f43f5e" }}>
          Featured image {chosen ? "· chosen" : "· required to publish"}
        </p>
        <button onClick={() => propose(true)} disabled={working} style={smallBtn("#a78bfa", working)}>
          {busy === "find" ? <Loader2 size={10} className="spin" /> : <ImageIcon size={10} />}
          {showing.length ? "More options" : "Find images"}
        </button>
        <button onClick={() => propose(false)} disabled={working} style={smallBtn("#64748b", working)}>
          {busy === "library" ? <Loader2 size={10} className="spin" /> : <Search size={10} />}
          Library only
        </button>
      </div>

      {busy === "find" && (
        <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 0" }}>
          Searching the photo library, then generating whatever it cannot supply. This takes
          up to a couple of minutes.
        </p>
      )}

      {err && (
        <p style={{ fontSize: 11.5, color: "#fda4af", margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>
      )}

      {meta && (
        <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 0", lineHeight: 1.55 }}>
          {meta.from_library > 0
            ? `${meta.from_library} from the photo library`
            : "Nothing in the photo library was on topic"}
          {meta.generated > 0 && `, ${meta.generated} generated from the article's opening`}
          {meta.from_library === 0 && meta.library_considered > 0 && (
            <> — {meta.library_considered} photo{meta.library_considered === 1 ? "" : "s"} were
              considered and the closest scored {meta.best_rejected_score?.toFixed(2) ?? "0.00"}</>
          )}
          .
        </p>
      )}

      {pref && (
        <p style={{ fontSize: 10.5, color: "#475569", margin: "5px 0 0", lineHeight: 1.5 }}>
          {pref.ready
            ? `Ordering is nudged by ${pref.sampleSize} past decisions. It never changes which images qualify, only their order.`
            : `No learned preference yet — ${pref.sampleSize} past decision${pref.sampleSize === 1 ? "" : "s"} recorded, and it stays out of the ranking until there are more.`}
        </p>
      )}

      {meta?.skipped?.length ? (
        <div style={{ marginTop: 8 }}>
          {meta.skipped.map((s, i) => (
            <p key={i} style={{ fontSize: 11, color: "#fcd34d", margin: "0 0 3px", lineHeight: 1.5 }}>
              <strong>{s.source}:</strong> {s.reason}
            </p>
          ))}
        </div>
      ) : null}

      {showing.length > 0 && (
        <div style={{
          display: "grid", gap: 8, marginTop: 10,
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        }}>
          {showing.map(c => {
            const isChosen = c.status === "chosen";
            return (
              <div key={c.id} style={{
                border: `1px solid ${isChosen ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10, overflow: "hidden",
                background: isChosen ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
                display: "flex", flexDirection: "column",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image_url} alt={c.image_alt}
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />

                <div style={{ padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 800, letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: c.source === "library" ? "#38bdf8" : "#a78bfa",
                    }}>
                      {c.source === "library" ? "Photo library" : "Generated"}
                    </span>
                    <span style={{ fontSize: 9, color: "#475569", marginLeft: "auto" }}>
                      {c.score.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {c.reasons.slice(0, 3).map((r, i) => (
                      <span key={i} title={r} style={{
                        fontSize: 8.5, color: "#64748b", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3,
                        padding: "1px 4px", maxWidth: "100%", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{r}</span>
                    ))}
                  </div>

                  {isChosen ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 9.5, fontWeight: 800, color: "#34d399",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      <CheckCircle2 size={10} /> Featured
                    </span>
                  ) : (
                    <button onClick={() => choose(c.id)} disabled={busy !== null}
                      style={smallBtn("#34d399", busy !== null)}>
                      {busy === c.id ? <Loader2 size={10} className="spin" /> : <CheckCircle2 size={10} />}
                      Use this
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chosen && (
        <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 0", lineHeight: 1.5 }}>
          Alt text: {chosen.image_alt || "—"}
        </p>
      )}
    </div>
  );
}

// ── Drafts ────────────────────────────────────────────────────────────────────

/**
 * The writing pipeline. A brief becomes a draft, a draft gets generated, reviewed,
 * approved, and only then can it be published.
 *
 * The gate is the organising idea: every draft shows whether it would pass, and the
 * publish button is disabled until it does. That keeps the failure visible while it
 * is still cheap to fix, rather than at the moment someone tries to ship.
 */
function DraftsView({ blogs, onCountChange }: {
  blogs: BlogSummary[] | null;
  onCountChange: (n: number) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [blogHandle, setBlogHandle] = useState("news");
  const [products, setProducts] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts`, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        const body = await res.json();
        setDrafts(body.drafts ?? []);
        onCountChange((body.drafts ?? []).length);
      }
    } catch { /* keep whatever is on screen */ }
    finally { setLoading(false); }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  /** Every mutating action funnels through here so errors surface the same way. */
  const act = async (id: string, path: string, body?: unknown, method = "POST") => {
    setBusy(id); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts/${id}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const blocking = (payload.blocking ?? []) as GateCheck[];
        setErr(blocking.length
          ? `${payload.error} — ${blocking.map(c => c.label).join("; ")}`
          : (payload.error || `Request failed (${res.status})`));
        return;
      }
      await load();
    } catch (e) {
      setErr(errMessage(e));
    } finally { setBusy(null); }
  };

  const createBrief = async () => {
    if (!topic.trim()) return;
    setBusy("new"); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/blog/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          target_keyword: keyword || null,
          blog_handle: blogHandle,
          product_handles: products.split(",").map(p => p.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Could not create the brief"); return; }
      setTopic(""); setKeyword(""); setProducts(""); setShowNew(false);
      await load();
    } catch (e) { setErr(errMessage(e)); }
    finally { setBusy(null); }
  };

  const input: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, padding: "8px 11px", color: "#e2e8f0", fontSize: 12,
    fontFamily: "inherit", outline: "none", width: "100%",
  };

  const btn = (color: string, disabled = false): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px",
    borderRadius: 8, background: disabled ? "rgba(255,255,255,0.03)" : `${color}18`,
    border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : color + "35"}`,
    color: disabled ? "#475569" : color, fontSize: 10.5, fontWeight: 800,
    cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
    textTransform: "uppercase", letterSpacing: "0.06em",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5, maxWidth: 620 }}>
          A brief becomes a draft, a draft gets written and reviewed, and only an approved
          draft can be published. The gate checks the things the existing library got wrong:
          a product link, internal links, an image, a meta description, enough substance.
          Writing a draft also resolves the products it should link and offers four
          featured-image choices — expand a draft to pick one.
        </p>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowNew(v => !v)} style={btn("#e98d20")}>
          <Plus size={12} /> New brief
        </motion.button>
      </div>

      {showNew && (
        <div style={{ ...PANEL, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ ...LABEL, marginBottom: 5 }}>Topic</p>
            <input value={topic} onChange={e => setTopic(e.target.value)} style={input}
              placeholder="What should this post be about?" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <p style={{ ...LABEL, marginBottom: 5 }}>Target search term</p>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} style={input}
                placeholder="optional" />
            </div>
            <div>
              <p style={{ ...LABEL, marginBottom: 5 }}>Blog</p>
              <select value={blogHandle} onChange={e => setBlogHandle(e.target.value)} style={input}>
                {(blogs ?? [{ handle: "news" } as BlogSummary]).map(b => (
                  <option key={b.handle} value={b.handle}>{b.handle}</option>
                ))}
              </select>
            </div>
            <div>
              <p style={{ ...LABEL, marginBottom: 5 }}>Product handles</p>
              <input value={products} onChange={e => setProducts(e.target.value)} style={input}
                placeholder="comma separated" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createBrief} disabled={!topic.trim() || busy === "new"}
              style={btn("#34d399", !topic.trim() || busy === "new")}>
              {busy === "new" ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} Create
            </button>
            <button onClick={() => setShowNew(false)} style={btn("#64748b")}>Cancel</button>
          </div>
        </div>
      )}

      {err && (
        <div style={{
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.22)",
          borderRadius: 10, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <XCircle size={14} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#fda4af", margin: 0, lineHeight: 1.5 }}>{err}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...PANEL, padding: 40, display: "flex", justifyContent: "center" }}>
          <Loader2 size={18} color="#475569" className="spin" />
        </div>
      ) : drafts.length === 0 ? (
        <div style={{ ...PANEL, padding: "40px 28px", textAlign: "center" }}>
          <PenLine size={26} color="#334155" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>No drafts yet</p>
          <p style={{ fontSize: 12.5, color: "#64748b", margin: "7px auto 0", maxWidth: 420, lineHeight: 1.6 }}>
            Start with a brief. Nothing reaches the storefront until you approve it and press publish.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {drafts.map(d => {
            const st = DRAFT_STATE[d.state];
            const gate = ("ready" in d.gate ? d.gate : null) as GateResult | null;
            const isBusy = busy === d.id;
            const open = expanded === d.id;
            const written = Boolean(d.title);

            return (
              <div key={d.id} style={{ ...PANEL, borderLeft: `2px solid ${st.color}`, overflow: "hidden" }}>
                <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setExpanded(open ? null : d.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                    {open ? <ChevronDown size={14} color="#475569" /> : <ChevronRight size={14} color="#475569" />}
                  </button>

                  <span style={{
                    fontSize: 9, fontWeight: 800, color: st.color, background: `${st.color}18`,
                    border: `1px solid ${st.color}30`, borderRadius: 4, padding: "2px 6px",
                    textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0,
                  }}>{st.label}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 700, color: written ? "#e2e8f0" : "#64748b", margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {d.title || d.topic}
                    </p>
                    <p style={{ fontSize: 10.5, color: "#475569", margin: "2px 0 0" }}>
                      {d.blog_handle}
                      {gate && ` · ${gate.metrics.word_count.toLocaleString()} words`}
                      {d.generated_by && ` · ${d.generated_by}`}
                      {d.repaired && " · repaired"}
                      {` · ${timeAgo(d.updated_at)}`}
                      {/* The featured image is the check most likely to be the only thing
                          standing between a finished draft and publishing, and it is fixed
                          in the panel below rather than anywhere else. */}
                      {written && (d.image_url
                        ? <span style={{ color: "#34d399" }}> · image set</span>
                        : <span style={{ color: "#f43f5e" }}> · no image</span>)}
                    </p>
                  </div>

                  {gate && (
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: gate.ready ? "#34d399" : "#f43f5e", flexShrink: 0,
                    }}>
                      {gate.ready ? "GATE PASSES" : `${gate.blocking.length} BLOCKING`}
                    </span>
                  )}

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {isBusy && <Loader2 size={13} color="#e98d20" className="spin" />}
                    {!written && d.state === "draft" && (
                      <button onClick={() => act(d.id, "/generate")} disabled={isBusy}
                        style={btn("#a78bfa", isBusy)}>
                        <Sparkles size={11} /> Write it
                      </button>
                    )}
                    {written && d.state === "draft" && (
                      <button onClick={() => act(d.id, "/transition", { to: "in_review" })} disabled={isBusy}
                        style={btn("#38bdf8", isBusy)}>Send to review</button>
                    )}
                    {d.state === "in_review" && (
                      <>
                        <button onClick={() => act(d.id, "/transition", { to: "approved" })} disabled={isBusy}
                          style={btn("#34d399", isBusy)}>Approve</button>
                        <button onClick={() => act(d.id, "/transition", { to: "rejected" })} disabled={isBusy}
                          style={btn("#f43f5e", isBusy)}>Reject</button>
                      </>
                    )}
                    {(d.state === "approved" || d.state === "scheduled") && (
                      <button onClick={() => act(d.id, "/publish", {})}
                        disabled={isBusy || !gate?.ready}
                        title={gate?.ready ? "Create this article in Shopify" : "The gate must pass first"}
                        style={btn("#e98d20", isBusy || !gate?.ready)}>
                        <Send size={11} /> Publish
                      </button>
                    )}
                    {d.shopify_article_id && (
                      <a href={`${STOREFRONT}/blogs/${d.blog_handle}/${d.handle}`} target="_blank" rel="noreferrer"
                        style={{ color: "#475569", padding: 4, display: "flex" }} title="View on the storefront">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ padding: "0 16px 14px 42px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <p style={LABEL}>Brief</p>
                          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.55 }}>
                            {d.topic}
                            {d.target_keyword && <span style={{ color: "#64748b" }}> · targeting “{d.target_keyword}”</span>}
                            {d.product_handles.length > 0 && (
                              <span style={{ color: "#64748b" }}> · selling {d.product_handles.join(", ")}</span>
                            )}
                          </p>
                          {/* Where the handles came from when nobody typed them. A flagship
                              standing in for a topic with no matching product is worth
                              saying out loud — the writer was told to place it honestly, and
                              the reviewer should know that is what happened. */}
                          {(d.product_suggestions ?? []).some(s => s.fallback) && (
                            <p style={{ fontSize: 11, color: "#fcd34d", margin: "5px 0 0", lineHeight: 1.5 }}>
                              No product matches this topic. {d.product_suggestions!.find(s => s.fallback)!.handle}{" "}
                              was linked so the post has a path to an order — check it reads honestly.
                            </p>
                          )}
                        </div>

                        {written && (
                          <FeaturedImagePicker draft={d} onChanged={load} />
                        )}

                        {d.generation_error && (
                          <p style={{ fontSize: 11.5, color: "#fda4af", margin: 0, fontFamily: "monospace" }}>
                            Generation failed: {d.generation_error}
                          </p>
                        )}

                        {d.seo_description && (
                          <div>
                            <p style={LABEL}>Meta description · {d.seo_description.length} chars</p>
                            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>{d.seo_description}</p>
                          </div>
                        )}

                        {gate && gate.blocking.length > 0 && (
                          <div>
                            <p style={{ ...LABEL, color: "#f43f5e" }}>Blocking the publish</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                              {gate.blocking.map(c => (
                                <p key={c.code} style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                                  <strong style={{ color: "#fda4af" }}>{c.label}.</strong> {c.detail}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {gate && gate.advisory.length > 0 && (
                          <div>
                            <p style={{ ...LABEL, color: "#f59e0b" }}>Worth a look</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                              {gate.advisory.map(c => (
                                <p key={c.code} style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                                  <strong style={{ color: "#fcd34d" }}>{c.label}.</strong> {c.detail}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {gate?.ready && (
                          <p style={{ fontSize: 12, color: "#34d399", margin: 0 }}>
                            Every check passes. {gate.metrics.word_count.toLocaleString()} words,{" "}
                            {gate.metrics.internal_link_count} internal links,{" "}
                            {gate.metrics.product_link_count} to products.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
