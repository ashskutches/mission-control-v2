"use client";

/**
 * Blog Library — the interface over /admin/blog on gravity-claw.
 *
 * Three views over ~785 existing Shopify articles:
 *   Overview   — library health plus the audit findings, worst first
 *   Duplicates — republished titles and topic clusters competing for one query
 *   Articles   — the searchable mirror
 *
 * Read-only, like the API behind it. Nothing here edits or publishes an article;
 * the only write is "sync", which pulls Shopify into our mirror.
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
  type LucideIcon,
} from "lucide-react";

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

type Tab = "overview" | "duplicates" | "articles";

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
      ) : mirrored === 0 ? (
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
                  <span style={{ opacity: 0.65, fontWeight: 700 }}>{t.count}</span>
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
