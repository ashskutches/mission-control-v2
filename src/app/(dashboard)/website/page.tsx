"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Target, Activity, Brain,
  Eye, Mail, ShoppingBag, Zap, Layers,
  Link2, Radio, RefreshCw, Code2,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import ChatBox from "@/components/ChatBox";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Analytics {
  profiles: { total: number; identified: number; identity_rate: string };
  events_last_7d: Record<string, number>;
  top_sections: {
    name: string; shopify_section_id: string;
    impressions: number; clicks: number; add_to_cart: number; avg_dwell_ms: number; ctr: string;
  }[];
}

interface AssignedAgent { id: string; name: string; emoji?: string; color?: string; }

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12, padding: "1.25rem",
} as const;

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  page: Eye, email: Mail, ad: Target, purchase: ShoppingBag, quiz: Brain,
};
const CHANNEL_COLORS: Record<string, string> = {
  page: "#38bdf8", email: "#34d399", ad: "#f59e0b", purchase: "#a78bfa", quiz: "#f472b6",
};

const AUDIENCE_SECTION_HINT = `
You are the lead intelligence agent for the **Audience & Personalization** platform.
Your domain covers:
- Visitor profiles, psychological signals, and segment tags (pain points, life stage, motivation, decision style)
- Personalization sections — Shopify liquid snippets that are served to visitors based on their profile signals
- Embeds — page-level deployment targets that use UCB1 bandit + profile scoring to rank and serve sections
- Signal definitions — UTM, page-view, time-based, and webhook triggers that automatically tag visitors
- Conversion metrics — impressions, clicks, add-to-cart rates per section and per embed

Data you have access to: total profiles, identity rate, 7-day event counts by channel, top-performing section stats (impressions, Assisted ATC%, CTR).

Note: Assisted ATC% uses exposure-credit attribution — any section the visitor SAW during a session where they added to cart receives credit. This intentionally inflates the raw rate vs. direct attribution; use it for relative comparison between sections, not absolute conversion benchmarking.

Your job is to surface actionable insights:
- Which sections are underperforming relative to their impression volume?
- Which visitor segments are growing fastest?
- What signal gaps exist (signals that fire rarely vs high-impression sections)?
- Which embeds have high max_sections caps that could be tightened for conversion focus?
- What tests should be run next to improve add-to-cart rates?

Be analytical, direct, and specific. Reference actual section names and signal keys when discussing performance.
Always tie recommendations back to improving Leaps & Rebounds' conversion rate.
`.trim();

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...CARD, flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color }}>{value}</div>
      {sub && <p style={{ fontSize: 10, color: "#475569", marginTop: "0.2rem" }}>{sub}</p>}
    </motion.div>
  );
}

// ── Top Sections Table ────────────────────────────────────────────────────────

function TopSectionsTable({ sections }: { sections: Analytics["top_sections"] }) {
  if (sections.length === 0)
    return <p style={{ fontSize: 13, color: "#475569" }}>No section data yet — sections appear once the Shopify snippet is live.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {sections.map((s, i) => {
        const atcRate = s.impressions > 0 ? ((s.add_to_cart / s.impressions) * 100).toFixed(1) : "0.0";
        const barWidth = sections[0].impressions > 0 ? Math.round((s.impressions / sections[0].impressions) * 100) : 0;
        return (
          <motion.div
            key={s.shopify_section_id}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            style={{ padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2 }}>{s.name}</p>
                <code style={{ fontSize: 9, color: "#475569" }}>{s.shopify_section_id}</code>
              </div>
              {[
                { label: "Impressions", value: s.impressions.toLocaleString(), color: "#38bdf8" },
                { label: "ATC", value: s.add_to_cart, color: "#a78bfa" },
                { label: "Assisted ATC%", value: `${atcRate}%`, color: "#34d399" },
                { label: "CTR", value: s.ctr, color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", minWidth: 60 }}>
                  <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color }}>{value}</p>
                </div>
              ))}
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${barWidth}%` }} transition={{ duration: 0.6, delay: i * 0.04 }}
                style={{ height: "100%", background: "linear-gradient(90deg, #38bdf8, #a78bfa)", borderRadius: 2 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function AudienceDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/analytics`);
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Build context primer for the agent's first message
  const agentMetrics = analytics ? [
    { label: "Total Profiles", value: analytics.profiles.total.toLocaleString() },
    { label: "Identified", value: analytics.profiles.identified.toLocaleString() },
    { label: "Identity Rate", value: analytics.profiles.identity_rate },
    ...Object.entries(analytics.events_last_7d).map(([ch, n]) => ({ label: `${ch} events (7d)`, value: String(n) })),
    ...analytics.top_sections.slice(0, 3).map(s => ({
      label: `"${s.name}" ATC rate`,
      value: `${s.impressions > 0 ? ((s.add_to_cart / s.impressions) * 100).toFixed(1) : 0}%`,
      sub: `${s.impressions} impressions`,
    })),
  ] : [];

  const totalEvents = analytics ? Object.values(analytics.events_last_7d).reduce((a, b) => a + b, 0) : 0;
  const accentColor = (assignedAgent as any)?.color ?? "#38bdf8";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: metrics ── */}
      <div>
        {/* Agent Panel */}
        <div style={{ marginBottom: "1.25rem" }}>
          <SectionAgentPanel
            sectionId="audience"
            sectionName="Audience Intelligence"
            sectionHint={AUDIENCE_SECTION_HINT}
            accentColor="#38bdf8"
            onAgentAssigned={a => setAssignedAgent(a)}
          />
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {loading ? (
            <p style={{ color: "#475569", fontSize: 13 }}>Loading analytics…</p>
          ) : analytics ? (
            <>
              <MetricCard label="Total Profiles" value={analytics.profiles.total.toLocaleString()} icon={Users} color="#38bdf8" />
              <MetricCard label="Identified" value={analytics.profiles.identified.toLocaleString()} icon={Target} color="#34d399" sub={analytics.profiles.identity_rate + " rate"} />
              <MetricCard label="Events (7d)" value={totalEvents.toLocaleString()} icon={Activity} color="#a78bfa" />
            </>
          ) : null}
        </div>

        {/* Channel breakdown */}
        {analytics && (
          <div style={{ ...CARD, marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Events Last 7 Days — by Channel</p>
              <button onClick={fetchAnalytics} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh analytics">
                <RefreshCw size={12} className={loading ? "spin" : ""} />
              </button>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {Object.entries(analytics.events_last_7d).length === 0 ? (
                <p style={{ color: "#475569", fontSize: 13 }}>No events yet — the snippet hasn&apos;t fired.</p>
              ) : Object.entries(analytics.events_last_7d).map(([ch, count]) => {
                const Icon = CHANNEL_ICONS[ch] ?? Zap;
                const color = CHANNEL_COLORS[ch] ?? "#64748b";
                return (
                  <div key={ch} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `${color}0d`, border: `1px solid ${color}22`, borderRadius: 20, padding: "0.2rem 0.7rem" }}>
                    <Icon size={11} color={color} />
                    <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ch}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color }}>{count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top performing sections */}
        <div style={CARD}>
          <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
            Top Performing Sections
          </p>
          {loading ? <p style={{ color: "#475569", fontSize: 13 }}>Loading…</p> : <TopSectionsTable sections={analytics?.top_sections ?? []} />}
        </div>

        {/* Quick navigation cards */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
          {[
            { href: "/website/sections", label: "Section Library", icon: Layers, color: "#a78bfa", sub: "Register & reorder sections" },
            { href: "/website/signals", label: "Signal Definitions", icon: Radio, color: "#f59e0b", sub: "UTM, page-view, time-based" },
            { href: "/website/embeds", label: "Embeds", icon: Link2, color: "#34d399", sub: "Deploy targets + UCB ranking" },
            { href: "/website/snippets", label: "Snippets", icon: Code2, color: "#818cf8", sub: "Pull, push & edit Liquid snippets" },
          ].map(({ href, label, icon: Icon, color, sub }) => (
            <a key={href} href={href} style={{ ...CARD, flex: 1, minWidth: 160, textDecoration: "none", display: "block", border: `1px solid ${color}18`, transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}40`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}18`}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={color} />
                </div>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>{label}</span>
              </div>
              <p style={{ fontSize: 10, color: "#475569" }}>{sub}</p>
            </a>
          ))}
        </div>
      </div>

      {/* ── Right: AI Agent Chat ── */}
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
              conversationKey={`${assignedAgent.id}-audience`}
              context={{
                sectionId: "audience",
                sectionName: "Audience Intelligence",
                metrics: agentMetrics,
              }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
                Assign a lead agent above<br />to enable the intelligence chat.
              </p>
            </div>
          )}
        </div>

        {/* Suggested prompts — only shown when agent is assigned */}
        {assignedAgent && analytics && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              "Which sections are underperforming?",
              "What signal gaps do we have?",
              "What should I test next to improve ATC?",
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
