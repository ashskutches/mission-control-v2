"use client";

/**
 * Social — WIP, admin-only.
 *
 * ## Why this page is admin-only without touching access.ts
 *
 * lib/access.ts is default-deny: GUEST_PATHS and TEAMMATE_PATHS are allowlists and
 * admin is "on neither list". "/social" is in neither, so middleware.ts already
 * refuses it for guest and teammate, and Sidebar already hides the nav entry —
 * both read the same canAccess(). Adding "/social" to TEAMMATE_PATHS later is the
 * single edit that opens it to the team.
 *
 * ## What is real here and what is not
 *
 * Connections reads the LIVE registry at GET /admin/integrations and reports the
 * actual state of the social feeds. Everything else — Compose, Approvals,
 * Scheduled, Performance — is an interactive mock over fixture data, because the
 * publishing architecture is still undecided (see the Publishing model toggle).
 *
 * The split is deliberate and labelled on screen. A mock that looks live is how a
 * dashboard ends up reporting numbers nobody sourced, which is the failure this
 * codebase has already had twice on SEO.
 *
 * NOTHING ON THIS PAGE SENDS. The publish path (social__schedule-post) is gated by
 * requireApproval() in gravity-claw and is not wired to this UI at all yet.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Share2, Send, ShieldCheck, Check, X, AlertTriangle, RefreshCw, Lock,
    Sparkles, CalendarClock, BarChart3, Link2, PenLine, Loader, Lightbulb,
} from "lucide-react";
import InsightsBoard from "@/components/InsightsBoard";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────
interface Integration {
    id: string;
    name: string;
    display_name: string;
    status: string;
    credentials_ok: boolean;
    env_vars: string[] | null;
    notes: string | null;
}

type ArchKey = "agg" | "dir" | "hyb";
type TabKey = "conn" | "insights" | "comp" | "appr" | "sched" | "perf";

// ── The social feeds, and which half of the problem each one solves ──────────
// A write credential and a read credential fail separately: a working Instagram
// read token says nothing about whether a post can ship, and vice versa. The
// registry does not model that distinction, so it is declared here.
const FEED_ROLE: Record<string, { role: "write" | "read"; label: string; ab: string }> = {
    upload_post:     { role: "write", label: "Upload-Post",          ab: "UP" },
    instagram_graph: { role: "read",  label: "Instagram Graph API",  ab: "IG" },
    facebook_page:   { role: "read",  label: "Facebook Page",        ab: "FB" },
    tiktok:          { role: "read",  label: "TikTok Business",      ab: "TT" },
    youtube_data:    { role: "read",  label: "YouTube Data API",     ab: "YT" },
};

// ── Publishing models — the open decision ────────────────────────────────────
const ARCH: Record<ArchKey, {
    name: string;
    stats: [string, string, string][];
    tone: "warn" | "crit" | "info";
    title: string;
    body: string;
}> = {
    agg: {
        name: "Aggregator",
        stats: [
            ["Credentials to get", "1", "one API key"],
            ["Blocks launch", "None", "ships this week"],
            ["Modules to maintain", "1", "one client"],
            ["Recurring cost", "Yes", "third-party fee"],
        ],
        tone: "warn",
        title: "The failure mode to design against",
        body: "A valid key with no linked account is worse than no key: upload-post accepts the post, reports it scheduled, and it silently never appears — the agent reads success. The live-check therefore compares linked accounts against ENABLED_PLATFORMS rather than just validating the key.",
    },
    dir: {
        name: "Direct APIs",
        stats: [
            ["Credentials to get", "5", "across 3 platforms"],
            ["Blocks launch", "2", "Meta review, TikTok audit"],
            ["Modules to maintain", "3", "plus token refresh each"],
            ["Recurring cost", "None", "no third party"],
        ],
        tone: "crit",
        title: "Nothing posts until the reviews clear",
        body: "Three approval processes on timetables you do not control. The upside is real — full capability, the platform's own error messages, no third party, no fee. The question worth researching is only how long those reviews actually take.",
    },
    hyb: {
        name: "Hybrid",
        stats: [
            ["Credentials to get", "2", "then 3 more later"],
            ["Blocks launch", "None", "Facebook goes first"],
            ["Modules to maintain", "2", "growing to 3"],
            ["Recurring cost", "Partial", "until reviews clear"],
        ],
        tone: "info",
        title: "Facebook direct now, the rest as approvals land",
        body: "Facebook only needs pages_manage_posts, and META_ADS_ACCESS_TOKEN is already a working System User token on that same business — so Facebook can go direct almost immediately. Instagram joins when Meta review clears, TikTok stays on the aggregator until its audit passes. Most total work, but nothing waits on an approval.",
    },
};

// ── Platforms available to Compose ───────────────────────────────────────────
const PLATFORMS = [
    { id: "instagram", label: "Instagram", ab: "IG", ratio: "4:5",  ar: "4 / 5",  limit: 2200,  enabled: true },
    { id: "facebook",  label: "Facebook",  ab: "FB", ratio: "1:1",  ar: "1 / 1",  limit: 63206, enabled: true },
    { id: "tiktok",    label: "TikTok",    ab: "TT", ratio: "9:16", ar: "9 / 16", limit: 2200,  enabled: true },
    { id: "pinterest", label: "Pinterest", ab: "PN", ratio: "2:3",  ar: "2 / 3",  limit: 500,   enabled: false },
    { id: "linkedin",  label: "LinkedIn",  ab: "LI", ratio: "1:1",  ar: "1 / 1",  limit: 3000,  enabled: false },
] as const;

interface Approval {
    id: string;
    agent: string;
    when: string;
    priority: number;
    platforms: string[];
    caption: string;
    hashtags: string;
    media: string;
    schedule: string;
    state: "pending" | "approved" | "rejected";
}

const SEED_APPROVALS: Approval[] = [
    {
        id: "a1", agent: "Content Creator", when: "4 minutes ago", priority: 5,
        platforms: ["instagram", "facebook"],
        caption: "Ten minutes on the mat does what thirty on pavement can't. Your lymphatic system moves when you do — and rebounding moves it without pounding your knees.",
        hashtags: "#rebounding #lymphaticdrainage #lowimpact #springreset #homegym",
        media: "image — cdn.leapsandrebounds.com/gen/spring-reset-4x5.jpg",
        schedule: "Tue 9:00 AM ET", state: "pending",
    },
    {
        id: "a2", agent: "Influencing Agent", when: "1 hour ago", priority: 7,
        platforms: ["tiktok"],
        caption: "The clip that snaps is sewn into the mat. That's why a whole mat ships for a few cents of plastic — and why we're changing it.",
        hashtags: "#rebounder #warranty #buildquality",
        media: "video — cdn.leapsandrebounds.com/gen/clip-fix-9x16.mp4",
        schedule: "immediately on approval", state: "pending",
    },
];

const QUEUE = [
    { when: "Tue 9:00a",  rel: "in 14 hours", cap: "Ten minutes on the mat does what thirty on pavement can't…",        plats: ["IG", "FB"],       ok: true },
    { when: "Wed 12:30p", rel: "in 2 days",   cap: "The clip that snaps is sewn into the mat. Here's the fix…",          plats: ["IG", "TT"],       ok: true },
    { when: "Thu 8:00a",  rel: "in 3 days",   cap: "Three rebounder mistakes that cost you the lymphatic benefit…",      plats: ["TT"],             ok: true },
    { when: "Fri 5:00p",  rel: "in 4 days",   cap: "Customer rebuild: 41 claims, one very patient man…",                 plats: ["FB"],             ok: false },
    { when: "Sat 10:00a", rel: "in 5 days",   cap: "Weekend reset: the 8-minute routine our warranty data likes…",       plats: ["IG", "FB", "TT"], ok: true },
];

// ── Shared style atoms ───────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "18px 20px",
    boxShadow: "0 8px 24px rgba(0,0,0,.35), 0 1px 0 rgba(233,141,32,.06)",
};

const SECT: React.CSSProperties = {
    fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase",
    color: "rgba(184,180,174,0.3)", fontWeight: 700, margin: "28px 0 12px",
};

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const TONE = {
    ok:   { fg: "#22c55e", bg: "rgba(34,197,94,.13)" },
    warn: { fg: "#f59e0b", bg: "rgba(245,158,11,.13)" },
    crit: { fg: "#f43f5e", bg: "rgba(244,63,94,.13)" },
    info: { fg: "#4a9eff", bg: "rgba(74,158,255,.13)" },
    idle: { fg: "rgba(184,180,174,0.65)", bg: "rgba(255,255,255,0.04)" },
};

function Pill({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
    const t = TONE[tone];
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em",
            textTransform: "uppercase", padding: "3px 9px", borderRadius: 20,
            color: t.fg, background: t.bg, whiteSpace: "nowrap",
        }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
            {children}
        </span>
    );
}

function Callout({ tone, title, children }: { tone: keyof typeof TONE; title: string; children: React.ReactNode }) {
    const t = TONE[tone];
    return (
        <div style={{
            display: "flex", gap: 11, alignItems: "flex-start",
            borderRadius: 14, padding: "13px 16px", fontSize: 12.5,
            border: "1px solid rgba(255,255,255,.07)",
            borderLeft: `3px solid ${t.fg}`, background: t.bg,
            color: "var(--text-secondary)", lineHeight: 1.55,
        }}>
            <div>
                <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: 2 }}>{title}</strong>
                {children}
            </div>
        </div>
    );
}

const Code = ({ children }: { children: React.ReactNode }) => (
    <code style={{
        fontFamily: MONO, fontSize: 11.5, background: "rgba(0,0,0,.25)",
        padding: "1.5px 5px", borderRadius: 4, color: "var(--accent-amber)",
        border: "1px solid rgba(255,255,255,.07)",
    }}>{children}</code>
);

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SocialPage() {
    const [tab, setTab] = useState<TabKey>("conn");
    const [arch, setArch] = useState<ArchKey>("agg");

    /**
     * Deep link into a tab — /social?tab=insights.
     *
     * This page has no child routes, so a link to "Social's insights" has nowhere
     * to point without it; insightsHrefFor() in lib/spaces.tsx produces exactly
     * that URL. Read off window.location rather than useSearchParams, which opts a
     * prerendered route into client-only rendering (see the note in /pipeline).
     */
    useEffect(() => {
        const want = new URLSearchParams(window.location.search).get("tab");
        const keys: TabKey[] = ["conn", "insights", "comp", "appr", "sched", "perf"];
        if (want && (keys as string[]).includes(want)) setTab(want as TabKey);
    }, []);

    // Live registry state
    const [feeds, setFeeds] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchErr, setFetchErr] = useState<string | null>(null);

    const loadFeeds = useCallback(async () => {
        setLoading(true);
        setFetchErr(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/integrations`);
            if (!res.ok) throw new Error(`API returned ${res.status}`);
            const data = await res.json();
            const rows: Integration[] = Array.isArray(data) ? data : (data.integrations ?? data.data ?? []);
            setFeeds(rows.filter((r) => Boolean(FEED_ROLE[r.name])));
        } catch (e: unknown) {
            // Report the failure rather than rendering an empty board, which would
            // read identically to "no social feeds exist".
            setFetchErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadFeeds(); }, [loadFeeds]);

    const writeFeeds = useMemo(() => feeds.filter((f) => FEED_ROLE[f.name]?.role === "write"), [feeds]);
    const readFeeds  = useMemo(() => feeds.filter((f) => FEED_ROLE[f.name]?.role === "read"),  [feeds]);

    // Compose state
    const [brief, setBrief] = useState(
        "Spring reset — 10 minutes of rebounding beats a 30-minute jog for lymphatic drainage. Lead with the mat, not the frame."
    );
    const [caption, setCaption] = useState(
        "Ten minutes on the mat does what thirty on pavement can't. Your lymphatic system moves when you do — and rebounding moves it without pounding your knees.\n\nSpring reset starts on the mat."
    );
    const [tags, setTags] = useState("rebounding lymphaticdrainage lowimpact springreset homegym");
    const [picked, setPicked] = useState<Record<string, boolean>>({ instagram: true, facebook: true, tiktok: false });
    const [pv, setPv] = useState("instagram");
    const [generating, setGenerating] = useState(false);

    const chosen = useMemo(
        () => PLATFORMS.filter((p) => p.enabled && picked[p.id]),
        [picked]
    );

    // Approvals
    const [approvals, setApprovals] = useState<Approval[]>(SEED_APPROVALS);
    const [toasts, setToasts] = useState<{ id: number; title: string; sub: string; bad?: boolean }[]>([]);

    const toast = useCallback((title: string, sub: string, bad?: boolean) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, title, sub, bad }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
    }, []);

    const settle = (id: string, ok: boolean) => {
        setApprovals((list) => list.map((a) => a.id === id ? { ...a, state: ok ? "approved" : "rejected" } : a));
        const a = approvals.find((x) => x.id === id);
        if (ok) toast("Approved (mock)", `${a?.platforms.join(", ")} · ${a?.schedule}`);
        else toast("Rejected (mock)", "Nothing was sent. The agent is told why.", true);
    };

    const pendingCount = approvals.filter((a) => a.state === "pending").length;

    const TABS: { k: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
        { k: "conn",  label: "Connections", icon: Link2,         count: feeds.length || undefined },
        { k: "insights", label: "Insights",  icon: Lightbulb },
        { k: "comp",  label: "Compose",     icon: PenLine },
        { k: "appr",  label: "Approvals",   icon: ShieldCheck,   count: pendingCount || undefined },
        { k: "sched", label: "Scheduled",   icon: CalendarClock, count: QUEUE.length },
        { k: "perf",  label: "Performance", icon: BarChart3 },
    ];

    return (
        <div style={{ maxWidth: 1220 }}>
            {/* ── WIP banner ─────────────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                background: "linear-gradient(100deg, rgba(245,158,11,.12), rgba(245,158,11,.03) 60%)",
                border: "1px dashed rgba(245,158,11,.42)", borderRadius: 14,
                padding: "12px 16px", marginBottom: 22,
            }}>
                <AlertTriangle size={17} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div style={{ flexGrow: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#f5a840" }}>
                        Work in progress — admin only
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        Connections and Insights are live. Compose, Approvals, Scheduled and Performance are interactive mocks
                        over fixture data. <strong style={{ color: "var(--text-primary)" }}>Nothing on this page sends anything.</strong>
                    </div>
                </div>
                <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5,
                    fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "#a78bfa", background: "rgba(167,139,250,.13)",
                    padding: "4px 10px", borderRadius: 20, flexShrink: 0,
                }}>
                    <Lock size={11} /> Admin
                </span>
            </div>

            {/* ── Head ───────────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: "linear-gradient(145deg, var(--accent-amber), var(--accent-orange))",
                    display: "grid", placeItems: "center",
                }}>
                    <Share2 size={19} color="#1a1a1c" />
                </div>
                <div style={{ flexGrow: 1, minWidth: 260 }}>
                    <h1 style={{ fontSize: 25, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }}>Social</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0", maxWidth: "64ch" }}>
                        One approved write path, four independent read paths. Publishing is gated by{" "}
                        <Code>requireApproval()</Code> — no agent posts unattended.
                    </p>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div style={{
                display: "flex", gap: 3, margin: "22px 0 24px", flexWrap: "wrap",
                borderBottom: "1px solid rgba(255,255,255,.07)",
            }} role="tablist">
                {TABS.map(({ k, label, icon: Icon, count }) => {
                    const on = tab === k;
                    return (
                        <button
                            key={k} role="tab" aria-selected={on} onClick={() => setTab(k)}
                            style={{
                                appearance: "none", background: on ? "rgba(233,141,32,.08)" : "none",
                                border: 0, borderBottom: `2px solid ${on ? "var(--accent-orange)" : "transparent"}`,
                                marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
                                fontSize: 13, fontWeight: 600, padding: "9px 14px",
                                color: on ? "var(--accent-amber)" : "var(--text-muted)",
                                display: "flex", alignItems: "center", gap: 7,
                                borderRadius: "8px 8px 0 0", transition: "all .18s",
                            }}
                        >
                            <Icon size={14} />
                            {label}
                            {count !== undefined && (
                                <span style={{
                                    fontFamily: MONO, fontSize: 10, fontWeight: 600,
                                    background: on ? "rgba(233,141,32,.18)" : "rgba(255,255,255,.05)",
                                    color: on ? "var(--accent-amber)" : "var(--text-secondary)",
                                    padding: "1px 6px", borderRadius: 20,
                                }}>{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* ══ CONNECTIONS ═══════════════════════════════════════ */}
                    {tab === "conn" && (
                        <ConnectionsTab
                            arch={arch} setArch={setArch}
                            writeFeeds={writeFeeds} readFeeds={readFeeds}
                            loading={loading} fetchErr={fetchErr} reload={loadFeeds}
                        />
                    )}

                    {/* ══ INSIGHTS ══════════════════════════════════════════ */}
                    {/* Real data — the same board every other space renders. */}
                    {tab === "insights" && (
                        <InsightsBoard
                            section="social"
                            emptyHint={<>Nothing open for Social in this lane. The Social lead agent files here when it runs.</>}
                        />
                    )}

                    {/* ══ COMPOSE ═══════════════════════════════════════════ */}
                    {tab === "comp" && (
                        <ComposeTab
                            arch={arch}
                            brief={brief} setBrief={setBrief}
                            caption={caption} setCaption={setCaption}
                            tags={tags} setTags={setTags}
                            picked={picked} setPicked={setPicked}
                            pv={pv} setPv={setPv}
                            chosen={chosen}
                            generating={generating} setGenerating={setGenerating}
                            toast={toast}
                        />
                    )}

                    {/* ══ APPROVALS ═════════════════════════════════════════ */}
                    {tab === "appr" && <ApprovalsTab approvals={approvals} settle={settle} />}

                    {/* ══ SCHEDULED ═════════════════════════════════════════ */}
                    {tab === "sched" && <ScheduledTab />}

                    {/* ══ PERFORMANCE ═══════════════════════════════════════ */}
                    {tab === "perf" && <PerformanceTab readFeeds={readFeeds} />}
                </motion.div>
            </AnimatePresence>

            {/* ── Toasts ─────────────────────────────────────────────────── */}
            <div style={{ position: "fixed", bottom: 22, right: 22, display: "flex", flexDirection: "column", gap: 9, zIndex: 60 }}>
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }}
                            style={{
                                background: "var(--bg-darker)", border: "1px solid var(--border)",
                                borderLeft: `3px solid ${t.bad ? "#f43f5e" : "#22c55e"}`,
                                borderRadius: 8, padding: "11px 16px", minWidth: 230,
                                boxShadow: "0 12px 34px rgba(0,0,0,.55)",
                            }}
                        >
                            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t.title}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.sub}</div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ── Connections ──────────────────────────────────────────────────────────────
function ConnectionsTab({
    arch, setArch, writeFeeds, readFeeds, loading, fetchErr, reload,
}: {
    arch: ArchKey; setArch: (a: ArchKey) => void;
    writeFeeds: Integration[]; readFeeds: Integration[];
    loading: boolean; fetchErr: string | null; reload: () => void;
}) {
    const m = ARCH[arch];

    return (
        <div>
            {/* Architecture switch */}
            <div style={{
                background: "linear-gradient(150deg, rgba(233,141,32,.06), transparent 65%), var(--bg-card)",
                border: "1px solid var(--border)", borderRadius: 22,
                padding: "20px 22px", marginBottom: 18,
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
                    <div style={{ flexGrow: 1, minWidth: 260 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 3px" }}>
                            How should posts leave the building?
                        </p>
                        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, maxWidth: "60ch" }}>
                            Still open. Flip it to see what changes — the credentials to collect, what blocks launch,
                            and what you give up. This is a decision aid, not a setting; it saves nothing.
                        </p>
                    </div>
                    <div style={{
                        display: "inline-flex", background: "rgba(0,0,0,.25)",
                        border: "1px solid rgba(255,255,255,.07)", borderRadius: 11,
                        padding: 3, gap: 3, flexShrink: 0,
                    }} role="group" aria-label="Publishing model">
                        {(Object.keys(ARCH) as ArchKey[]).map((k) => {
                            const on = arch === k;
                            return (
                                <button
                                    key={k} onClick={() => setArch(k)} aria-pressed={on}
                                    style={{
                                        appearance: "none", border: 0, cursor: "pointer", fontFamily: "inherit",
                                        fontSize: 12.5, fontWeight: 700, padding: "8px 15px", borderRadius: 8,
                                        background: on ? "var(--accent-orange)" : "transparent",
                                        color: on ? "#1a1a1c" : "var(--text-muted)",
                                        boxShadow: on ? "0 2px 12px rgba(233,141,32,.35)" : "none",
                                        transition: "all .18s", whiteSpace: "nowrap",
                                    }}
                                >{ARCH[k].name}</button>
                            );
                        })}
                    </div>
                </div>

                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 1, background: "rgba(255,255,255,.07)", borderRadius: 8, overflow: "hidden",
                }}>
                    {m.stats.map(([k, v, n]) => (
                        <div key={k} style={{ background: "var(--bg-darker)", padding: "12px 14px" }}>
                            <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(184,180,174,.3)", fontWeight: 700 }}>{k}</div>
                            <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, marginTop: 3, letterSpacing: "-0.02em" }}>{v}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{n}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: 24 }}>
                <Callout tone={m.tone} title={m.title}>{m.body}</Callout>
            </div>

            {/* Live registry */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, ...SECT, marginTop: 0 }}>
                <span>Live feed status</span>
                <button
                    onClick={reload}
                    style={{
                        appearance: "none", background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.07)", borderRadius: 6,
                        color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 10.5, fontWeight: 700, padding: "3px 9px",
                        display: "inline-flex", alignItems: "center", gap: 5, textTransform: "none", letterSpacing: 0,
                    }}
                >
                    <RefreshCw size={11} /> Refresh
                </button>
                <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>
                    from <Code>GET /admin/integrations</Code>
                </span>
            </div>

            {loading && (
                <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                    <Loader size={15} className="spin" /> Reading the registry…
                </div>
            )}

            {!loading && fetchErr && (
                <Callout tone="crit" title="Could not read the integrations registry">
                    {fetchErr}. This is a failure to <em>measure</em> the feeds, not proof they are down —
                    an empty board would look identical to “no social feeds exist”, so nothing is drawn.
                </Callout>
            )}

            {!loading && !fetchErr && (
                <>
                    <FeedGroup
                        title="Write path — the only thing that can publish"
                        feeds={writeFeeds}
                        empty="No write path is registered yet. Until one is, nothing can post."
                    />
                    <FeedGroup
                        title="Read paths — analytics only, and they fail separately"
                        feeds={readFeeds}
                        empty="No read feeds registered."
                    />
                </>
            )}

            {/* Capability table */}
            <h2 style={SECT}>Capability ceiling — what each path can actually post</h2>
            <div style={{ marginBottom: 12 }}>
                <Callout tone="warn" title="The aggregator column is unverified">
                    Our <Code>upload-post.ts</Code> client was written against docs and has never made a live
                    call — its response parsing is a guess. Treat every <strong style={{ color: "#f59e0b" }}>?</strong> as
                    something to confirm in a trial account before committing, not as a finding.
                </Callout>
            </div>
            <CapabilityTable />

            <p style={{ marginTop: 26, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)", fontSize: 11.5, color: "rgba(184,180,174,.3)" }}>
                Read paths are the direct platform APIs under <em>every</em> model above — this decision only governs
                publishing. Verify from the CLI with <Code>npx tsx src/dev/social-probe.ts</Code>.
            </p>
        </div>
    );
}

function FeedGroup({ title, feeds, empty }: { title: string; feeds: Integration[]; empty: string }) {
    return (
        <>
            <h2 style={SECT}>{title}</h2>
            {feeds.length === 0 ? (
                <div style={{ ...CARD, fontSize: 12.5, color: "var(--text-muted)" }}>{empty}</div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {feeds.map((f) => {
                        const meta = FEED_ROLE[f.name];
                        const ok = f.status === "active" && f.credentials_ok;
                        const tone: keyof typeof TONE =
                            ok ? "ok" : f.status === "requested" ? "idle" : "crit";
                        const stripe = TONE[tone].fg;
                        return (
                            <div key={f.id ?? f.name} style={{
                                display: "flex", alignItems: "center", gap: 13,
                                padding: "13px 16px", background: "var(--bg-card)",
                                border: "1px solid rgba(255,255,255,.07)",
                                borderLeft: `3px solid ${stripe}`, borderRadius: 14,
                            }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                    display: "grid", placeItems: "center", fontFamily: MONO,
                                    fontSize: 13, fontWeight: 800, background: "rgba(255,255,255,.04)",
                                    color: "var(--text-secondary)",
                                }}>{meta?.ab ?? "??"}</div>

                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        {f.display_name || meta?.label || f.name}
                                        <span style={{
                                            fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
                                            padding: "2px 7px", borderRadius: 4,
                                            background: meta?.role === "write" ? "rgba(233,141,32,.18)" : "rgba(0,201,215,.14)",
                                            color: meta?.role === "write" ? "var(--accent-amber)" : "#00c9d7",
                                        }}>{meta?.role === "write" ? "WRITE" : "READ"}</span>
                                    </div>
                                    {f.notes && (
                                        <div style={{
                                            fontSize: 11.5, color: "var(--text-muted)", marginTop: 2,
                                            overflow: "hidden", textOverflow: "ellipsis",
                                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                        }}>{f.notes}</div>
                                    )}
                                </div>

                                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                    <Pill tone={tone}>
                                        {ok ? "Active" : f.status === "requested" ? "Not set" : f.status}
                                    </Pill>
                                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "rgba(184,180,174,.3)" }}>
                                        {(f.env_vars ?? []).join(" · ") || "—"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

const CAPS: [string, React.ReactNode, React.ReactNode, string][] = [
    ["Single image / video", <Y key="y" />, <Y key="y2" />, "The baseline. Both fine."],
    ["Carousel (multi-image)", <Q key="q" note="one media object in our client" />, <Y key="y3" />, "Before/after and 5-exercise posts are carousels."],
    ["Stories", <Q key="q2" />, <Y key="y4" />, "Highest-frequency IG surface for a fitness brand."],
    ["Product tags / shopping", <N key="n" />, <Y key="y5" />, "Direct path from post to the rebounder PDP."],
    ["First comment (hashtag dump)", <Q key="q3" />, <Y key="y6" />, "Keeps 20 hashtags out of the visible caption."],
    ["Per-platform crop", <N key="n2" note="one media URL for all" />, <Y key="y7" />, "4:5 for IG, 9:16 for TikTok, 1:1 for FB."],
    ["Real API error on failure", <N key="n3" note="their error, not Meta's" />, <Y key="y8" />, "Debugging a silent drop through a proxy is painful."],
    ["Ships without app review", <Y key="y9" />, <N key="n4" note="Meta review + TikTok audit" />, "The strongest argument for the aggregator."],
];

function Y() { return <span style={{ color: "#22c55e", fontWeight: 700 }}>Yes</span>; }
function N({ note }: { note?: string }) {
    return (
        <span>
            <span style={{ color: "#f43f5e", fontWeight: 700 }}>No</span>
            {note && <small style={{ display: "block", color: "rgba(184,180,174,.3)", fontSize: 10.5 }}>{note}</small>}
        </span>
    );
}
function Q({ note }: { note?: string }) {
    return (
        <span>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>?</span>
            {note && <small style={{ display: "block", color: "rgba(184,180,174,.3)", fontSize: 10.5 }}>{note}</small>}
        </span>
    );
}

function CapabilityTable() {
    const th: React.CSSProperties = {
        textAlign: "left", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "rgba(184,180,174,.3)", fontWeight: 700, padding: "10px 14px",
        background: "var(--bg-darker)", borderBottom: "1px solid rgba(255,255,255,.07)",
    };
    const td: React.CSSProperties = {
        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.04)",
        verticalAlign: "top", fontSize: 12,
    };
    return (
        <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                    <tr>
                        <th style={th}>Post type / feature</th>
                        <th style={th}>Via aggregator</th>
                        <th style={th}>Direct API</th>
                        <th style={th}>Matters because</th>
                    </tr>
                </thead>
                <tbody>
                    {CAPS.map(([name, agg, dir, why]) => (
                        <tr key={name}>
                            <td style={{ ...td, fontWeight: 600 }}>{name}</td>
                            <td style={td}>{agg}</td>
                            <td style={td}>{dir}</td>
                            <td style={{ ...td, color: "var(--text-muted)" }}>{why}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Compose ──────────────────────────────────────────────────────────────────
function ComposeTab({
    arch, brief, setBrief, caption, setCaption, tags, setTags,
    picked, setPicked, pv, setPv, chosen, generating, setGenerating, toast,
}: {
    arch: ArchKey;
    brief: string; setBrief: (v: string) => void;
    caption: string; setCaption: (v: string) => void;
    tags: string; setTags: (v: string) => void;
    picked: Record<string, boolean>; setPicked: (v: Record<string, boolean>) => void;
    pv: string; setPv: (v: string) => void;
    chosen: readonly typeof PLATFORMS[number][];
    generating: boolean; setGenerating: (v: boolean) => void;
    toast: (t: string, s: string, bad?: boolean) => void;
}) {
    const input: React.CSSProperties = {
        width: "100%", background: "rgba(0,0,0,.25)", color: "var(--text-primary)",
        border: "1px solid rgba(255,255,255,.07)", borderRadius: 8,
        padding: "10px 12px", fontFamily: "inherit", fontSize: 13, resize: "vertical",
    };
    const label: React.CSSProperties = {
        display: "block", fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase",
        color: "rgba(184,180,174,.3)", fontWeight: 700, marginBottom: 6,
    };

    const active = chosen.find((p) => p.id === pv) ?? chosen[0];
    const tagList = tags.trim() ? tags.trim().split(/\s+/).map((t) => "#" + t.replace(/^#/, "")).join(" ") : "";
    const total = caption.length + tagList.length + 2;
    const over = active ? total > active.limit : false;

    const generate = () => {
        setGenerating(true);
        setTimeout(() => {
            setGenerating(false);
            toast("Draft generated (mock)", "No agent was called and no credits spent");
        }, 750);
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 18, alignItems: "start" }}
             className="social-compose">
            <div>
                <div style={CARD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Brief the agent</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: "auto" }}>
                            content-creator · <Code>kie-lifestyle</Code>
                        </span>
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <label style={label} htmlFor="brief">What is this post about?</label>
                        <textarea id="brief" rows={3} style={input} value={brief} onChange={(e) => setBrief(e.target.value)} />
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <span style={label}>Send to</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {PLATFORMS.map((p) => {
                                const on = p.enabled && Boolean(picked[p.id]);
                                return (
                                    <button
                                        key={p.id}
                                        disabled={!p.enabled}
                                        aria-pressed={on}
                                        onClick={() => {
                                            const next = { ...picked, [p.id]: !picked[p.id] };
                                            setPicked(next);
                                            if (!picked[p.id]) setPv(p.id);
                                        }}
                                        style={{
                                            appearance: "none", cursor: p.enabled ? "pointer" : "not-allowed",
                                            fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7,
                                            background: on ? "rgba(233,141,32,.15)" : "rgba(0,0,0,.25)",
                                            border: `1px solid ${on ? "var(--accent-orange)" : "rgba(255,255,255,.07)"}`,
                                            color: on ? "var(--accent-amber)" : "var(--text-secondary)",
                                            borderRadius: 20, padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
                                            opacity: p.enabled ? 1 : 0.38,
                                            textDecoration: p.enabled ? "none" : "line-through",
                                        }}
                                    >
                                        {p.label}
                                        <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.8 }}>{p.ratio}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "9px 0 0" }}>
                            Pinterest and LinkedIn are struck through because they are not in{" "}
                            <Code>ENABLED_PLATFORMS</Code>. The tool refuses them rather than letting them be
                            accepted and silently dropped.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                        <button onClick={generate} disabled={generating} style={{
                            appearance: "none", cursor: generating ? "wait" : "pointer", fontFamily: "inherit",
                            fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em", padding: "9px 17px",
                            borderRadius: 8, border: "1px solid transparent",
                            background: "var(--accent-orange)", color: "#1a1a1c",
                            opacity: generating ? 0.6 : 1,
                            display: "inline-flex", alignItems: "center", gap: 7,
                        }}>
                            {generating ? <Loader size={13} /> : <Sparkles size={13} />}
                            {generating ? "Generating…" : "Generate draft"}
                        </button>
                        <button onClick={() => toast("Image regenerated (mock)", "Reference: bungee rebounder, black padding")} style={{
                            appearance: "none", cursor: "pointer", fontFamily: "inherit",
                            fontSize: 12.5, fontWeight: 700, padding: "9px 17px", borderRadius: 8,
                            border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.04)",
                            color: "var(--text-primary)",
                        }}>Regenerate image</button>
                    </div>
                </div>

                <div style={{ ...CARD, marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Draft</span>
                        <Pill tone="info">Editable</Pill>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: "auto" }}>
                            your wording replaces the agent&apos;s before approval
                        </span>
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <label style={label} htmlFor="cap">Caption</label>
                        <textarea id="cap" rows={5} style={input} value={caption} onChange={(e) => setCaption(e.target.value)} />
                    </div>

                    <div>
                        <label style={label} htmlFor="tags">
                            Hashtags
                            <span style={{ textTransform: "none", letterSpacing: 0, color: "rgba(184,180,174,.3)", fontWeight: 400 }}>
                                {" "}— stored apart from the caption, appended at publish
                            </span>
                        </label>
                        <input id="tags" type="text" style={input} value={tags} onChange={(e) => setTags(e.target.value)} />
                    </div>

                    {chosen.length > 1 && (
                        <div style={{ marginTop: 14 }}>
                            {arch === "agg" ? (
                                <Callout tone="warn" title={`One media file for ${chosen.length} platforms`}>
                                    The aggregator takes a single <Code>media_url</Code>, so every platform gets the same
                                    crop — {chosen.map((p) => p.ratio).join(" vs ")} cannot all be served at once.
                                    Direct APIs would let you upload a per-platform render.
                                </Callout>
                            ) : (
                                <Callout tone="info" title="Per-platform renders available">
                                    Each platform gets its own crop and its own first comment:{" "}
                                    {chosen.map((p) => `${p.label} ${p.ratio}`).join(" · ")}.
                                </Callout>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Preview */}
            <div style={{ ...CARD, padding: "14px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>Preview</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: "auto" }}>
                        {chosen.length ? `${chosen.length} platform${chosen.length === 1 ? "" : "s"}` : "none selected"}
                    </span>
                </div>

                {chosen.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "34px 14px", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 24, opacity: 0.28, marginBottom: 6 }}>◌</div>
                        <strong style={{ fontSize: 13 }}>No platform selected</strong>
                        <p style={{ fontSize: 11.5, margin: "4px 0 0" }}>
                            An empty target list is refused, not treated as “all”.
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                            {chosen.map((p) => (
                                <button key={p.id} onClick={() => setPv(p.id)} aria-pressed={active?.id === p.id} style={{
                                    appearance: "none", cursor: "pointer", fontFamily: MONO,
                                    fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 20,
                                    background: active?.id === p.id ? "rgba(233,141,32,.15)" : "rgba(0,0,0,.25)",
                                    border: `1px solid ${active?.id === p.id ? "var(--accent-orange)" : "rgba(255,255,255,.07)"}`,
                                    color: active?.id === p.id ? "var(--accent-amber)" : "var(--text-secondary)",
                                }}>{p.ab}</button>
                            ))}
                        </div>

                        {active && (
                            <div style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,.07)", background: "var(--bg-darker)" }}>
                                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(140deg, var(--accent-amber), var(--accent-orange))", flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>leapsandrebounds</span>
                                    <span style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(184,180,174,.3)", fontWeight: 700 }}>
                                        {active.label}
                                    </span>
                                </div>

                                <div style={{
                                    aspectRatio: active.ar, position: "relative",
                                    display: "grid", placeItems: "center",
                                    background: "radial-gradient(circle at 32% 28%, rgba(233,141,32,.30), transparent 58%), radial-gradient(circle at 72% 76%, rgba(0,201,215,.16), transparent 55%), var(--bg-darker)",
                                }}>
                                    <span style={{
                                        fontFamily: MONO, fontSize: 10.5, color: "var(--text-muted)",
                                        background: "rgba(0,0,0,.42)", padding: "4px 9px", borderRadius: 20,
                                        border: "1px solid rgba(255,255,255,.07)",
                                    }}>agent-generated · kie-lifestyle</span>
                                    <span style={{
                                        position: "absolute", top: 8, right: 8, fontFamily: MONO, fontSize: 9.5,
                                        color: "rgba(184,180,174,.3)", background: "rgba(0,0,0,.5)",
                                        padding: "2px 6px", borderRadius: 4,
                                    }}>{active.ratio}</span>
                                </div>

                                <div style={{ padding: "11px 12px", fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                    {active.id === "tiktok" && caption.length > 150
                                        ? <>{caption.slice(0, 150)}<span style={{ color: "rgba(184,180,174,.3)" }}> … more</span></>
                                        : caption}
                                    {tagList && <><br /><br /><span style={{ color: "#4a9eff" }}>{tagList}</span></>}
                                </div>

                                <div style={{ padding: "0 12px 11px", fontFamily: MONO, fontSize: 10.5, color: "rgba(184,180,174,.3)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <span style={over ? { color: "#f43f5e", fontWeight: 700 } : undefined}>
                                        {total.toLocaleString()} / {active.limit.toLocaleString()} chars
                                    </span>
                                    <span>{active.ratio}</span>
                                </div>
                            </div>
                        )}

                        <p style={{ fontSize: 11, color: "rgba(184,180,174,.3)", margin: "10px 0 0" }}>
                            {over
                                ? <span style={{ color: "#f43f5e", fontWeight: 700 }}>Over {active?.label}&apos;s limit — caught here, not at publish.</span>
                                : "Hashtags render appended, as they will be sent."}
                        </p>
                    </>
                )}
            </div>

            <style>{`
                @media (max-width: 1080px) {
                    .social-compose { grid-template-columns: 1fr !important; }
                }
                .spin { animation: social-spin 1s linear infinite; }
                @keyframes social-spin { to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
            `}</style>
        </div>
    );
}

// ── Approvals ────────────────────────────────────────────────────────────────
function ApprovalsTab({ approvals, settle }: { approvals: Approval[]; settle: (id: string, ok: boolean) => void }) {
    return (
        <div>
            <div style={{ marginBottom: 18 }}>
                <Callout tone="info" title="This queue is the live-fire gate">
                    Every post an agent proposes stops here. Nothing reaches a platform until a human presses
                    Approve — enforced in <Code>action_gate.ts</Code> on the bot, not in a prompt. This mock
                    shows the shape; it is not reading the real queue.
                </Callout>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
                {approvals.map((a) => {
                    const settled = a.state !== "pending";
                    const stripe = a.state === "approved" ? "#22c55e" : a.state === "rejected" ? "#f43f5e" : "#f59e0b";
                    return (
                        <div key={a.id} style={{
                            ...CARD, borderLeft: `3px solid ${stripe}`,
                            opacity: settled ? 0.62 : 1, transition: "opacity .25s",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                                    Post to {a.platforms.join(", ")}
                                </span>
                                <Pill tone={a.state === "approved" ? "ok" : a.state === "rejected" ? "crit" : "warn"}>
                                    {a.state === "pending" ? "Awaiting approval" : a.state}
                                </Pill>
                                <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: "auto" }}>
                                    {a.agent} · {a.when} · priority {a.priority}
                                </span>
                            </div>

                            <dl style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: "6px 14px", fontSize: 12.5, margin: "12px 0" }}>
                                <Row k="Platforms"><strong>{a.platforms.join(", ")}</strong></Row>
                                <Row k="Caption">{a.caption}</Row>
                                <Row k="Hashtags"><span style={{ color: "#4a9eff" }}>{a.hashtags}</span></Row>
                                <Row k="Media"><span style={{ fontFamily: MONO, fontSize: 11, wordBreak: "break-all" }}>{a.media}</span></Row>
                                <Row k="When">{a.schedule}</Row>
                            </dl>

                            <div style={{
                                display: "flex", gap: 9, alignItems: "flex-start",
                                background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.22)",
                                borderRadius: 8, padding: "9px 12px", fontSize: 11.5,
                                color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.5,
                            }}>
                                <Check size={13} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <strong style={{ color: "#22c55e" }}>Fixed:</strong> this card used to read
                                    “Platform: All” on every post — the gate read <Code>input.platform</Code>, a field
                                    the schema never set. You were approving posts without being shown where they landed.
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 }}>
                                <button
                                    disabled={settled}
                                    onClick={() => settle(a.id, true)}
                                    style={{
                                        appearance: "none", cursor: settled ? "not-allowed" : "pointer", fontFamily: "inherit",
                                        fontSize: 12.5, fontWeight: 700, padding: "9px 17px", borderRadius: 8,
                                        border: "1px solid transparent", background: "var(--accent-orange)",
                                        color: "#1a1a1c", opacity: settled ? 0.4 : 1,
                                        display: "inline-flex", alignItems: "center", gap: 7,
                                    }}
                                >
                                    <Send size={13} /> Approve &amp; schedule
                                </button>
                                <button
                                    disabled={settled}
                                    onClick={() => settle(a.id, false)}
                                    style={{
                                        appearance: "none", cursor: settled ? "not-allowed" : "pointer", fontFamily: "inherit",
                                        fontSize: 12.5, fontWeight: 700, padding: "9px 17px", borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.04)",
                                        color: "#f43f5e", opacity: settled ? 0.4 : 1,
                                        display: "inline-flex", alignItems: "center", gap: 7,
                                    }}
                                >
                                    <X size={13} /> Reject
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
    return (
        <>
            <dt style={{ color: "rgba(184,180,174,.3)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, paddingTop: 2 }}>{k}</dt>
            <dd style={{ margin: 0 }}>{children}</dd>
        </>
    );
}

// ── Scheduled ────────────────────────────────────────────────────────────────
function ScheduledTab() {
    return (
        <div>
            <h2 style={{ ...SECT, marginTop: 0 }}>Approved and queued</h2>
            <div style={{ display: "grid", gap: 9 }}>
                {QUEUE.map((q, i) => (
                    <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 13, padding: "12px 15px",
                        background: "var(--bg-card)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14,
                    }}>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--text-secondary)", flexShrink: 0, width: 90 }}>
                            {q.when}
                            <span style={{ display: "block", color: "rgba(184,180,174,.3)", fontSize: 10 }}>{q.rel}</span>
                        </div>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                            border: "1px solid rgba(255,255,255,.07)",
                            background: "radial-gradient(circle at 35% 30%, rgba(233,141,32,.32), transparent 60%), var(--bg-darker)",
                        }} />
                        <div style={{ flexGrow: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {q.cap}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {q.plats.map((p) => (
                                <span key={p} style={{
                                    fontFamily: MONO, fontSize: 9.5, fontWeight: 700,
                                    width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center",
                                    background: "rgba(255,255,255,.04)", color: "var(--text-secondary)",
                                }}>{p}</span>
                            ))}
                        </div>
                        <Pill tone={q.ok ? "ok" : "warn"}>{q.ok ? "Approved" : "Media 404"}</Pill>
                    </div>
                ))}
            </div>

            <h2 style={SECT}>Published</h2>
            <div style={{ ...CARD, textAlign: "center", padding: "38px 20px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 26, opacity: 0.28, marginBottom: 6 }}>◌</div>
                <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Nothing published yet</strong>
                <p style={{ fontSize: 12, margin: "5px auto 0", maxWidth: "62ch" }}>
                    This fills in once a write path is connected. It will read back from the platform, not from our
                    own send log — a post we <em>think</em> shipped and a post that is actually live are different facts.
                </p>
            </div>
        </div>
    );
}

// ── Performance ──────────────────────────────────────────────────────────────
function PerformanceTab({ readFeeds }: { readFeeds: Integration[] }) {
    const byName = useMemo(() => {
        const m: Record<string, Integration> = {};
        readFeeds.forEach((f) => { m[f.name] = f; });
        return m;
    }, [readFeeds]);

    const ROWS = [
        { name: "Instagram", key: "instagram_graph", followers: null, eng: null, posts: 0, fmt: null },
        { name: "Facebook",  key: "facebook_page",   followers: null, eng: null, posts: 0, fmt: null },
        { name: "TikTok",    key: "tiktok",          followers: null, eng: null, posts: 0, fmt: null },
        { name: "YouTube",   key: "youtube_data",    followers: "12,480", eng: "2.9%", posts: 3, fmt: "Shorts" },
    ];

    const th: React.CSSProperties = {
        textAlign: "left", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "rgba(184,180,174,.3)", fontWeight: 700, padding: "10px 14px",
        background: "var(--bg-darker)", borderBottom: "1px solid rgba(255,255,255,.07)",
    };
    const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.04)", fontSize: 12.5 };
    const num: React.CSSProperties = { ...td, fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right" };

    return (
        <div>
            <div style={{ marginBottom: 18 }}>
                <Callout tone="warn" title="Illustrative — and it will never invent a number it cannot source">
                    Most read tokens are unset, so nearly every cell below is a dash. A dash means the feed is not
                    connected; it does <strong>not</strong> mean zero. Those are indistinguishable in a tool response,
                    which is why this table refuses to draw one as the other.
                </Callout>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 4 }}>
                <Tile k="Posts published · 28d" v="0" d="No write path connected" />
                <Tile k="Attributed revenue" v="—" d="Unpriced, never estimated" dim />
                <Tile k="Read feeds connected" v={`${readFeeds.filter((f) => f.status === "active" && f.credentials_ok).length} / ${readFeeds.length || 4}`} d="live from the registry" />
                <Tile k="Approval queue" v="2" d="mock fixture" />
            </div>

            <h2 style={SECT}>By platform</h2>
            <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
                    <thead>
                        <tr>
                            <th style={th}>Platform</th>
                            <th style={th}>Read status</th>
                            <th style={{ ...th, textAlign: "right" }}>Followers</th>
                            <th style={{ ...th, textAlign: "right" }}>Eng. rate</th>
                            <th style={{ ...th, textAlign: "right" }}>Posts 28d</th>
                            <th style={th}>Top format</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map((r) => {
                            const feed = byName[r.key];
                            const ok = feed?.status === "active" && feed?.credentials_ok;
                            return (
                                <tr key={r.name}>
                                    <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                                    <td style={td}>
                                        {feed
                                            ? <Pill tone={ok ? "ok" : feed.status === "requested" ? "idle" : "crit"}>
                                                  {ok ? "Active" : feed.status === "requested" ? "Not set" : feed.status}
                                              </Pill>
                                            : <Pill tone="idle">No row</Pill>}
                                    </td>
                                    <td style={{ ...num, color: ok && r.followers ? undefined : "rgba(184,180,174,.3)" }}>{ok && r.followers ? r.followers : "—"}</td>
                                    <td style={{ ...num, color: ok && r.eng ? undefined : "rgba(184,180,174,.3)" }}>{ok && r.eng ? r.eng : "—"}</td>
                                    <td style={num}>{ok ? r.posts : "—"}</td>
                                    <td style={{ ...td, color: ok && r.fmt ? undefined : "rgba(184,180,174,.3)" }}>{ok && r.fmt ? r.fmt : "unknown"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Tile({ k, v, d, dim }: { k: string; v: string; d: string; dim?: boolean }) {
    return (
        <div style={{ ...CARD, padding: "14px 16px" }}>
            <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(184,180,174,.3)", fontWeight: 700 }}>{k}</div>
            <div style={{
                fontFamily: MONO, fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em",
                margin: "5px 0 1px", fontVariantNumeric: "tabular-nums",
                color: dim ? "rgba(184,180,174,.3)" : undefined,
            }}>{v}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d}</div>
        </div>
    );
}
