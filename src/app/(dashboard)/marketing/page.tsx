"use client";
/**
 * Marketing → Dashboard
 *
 * The one-screen answer to "is marketing working this period". Five headline
 * numbers, then the three places demand actually comes from — paid, organic,
 * owned — each read from the feed that already exists in gravity-claw.
 *
 * WHY THE NUMBERS ARE SPLIT THE WAY THEY ARE
 * ------------------------------------------
 * Net revenue, MER, CAC and new customers come from Shopify via the P&L
 * (/admin/profitability/platforms → blended). Per-channel revenue and ROAS come
 * from the ad platforms' own attribution. Those two never get added together:
 * every platform claims the same order, so the sum is inflated. Platform revenue
 * ranks channels against each other; Shopify revenue is what the business made.
 *
 * Anything a feed cannot supply renders as an em dash with the reason attached,
 * never as zero. See /admin/profitability/connections for the full gap list —
 * the "Feed status" panel at the bottom is that endpoint.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  DollarSign, Megaphone, TrendingUp, UserPlus, Percent,
  Search, Mail, Globe, RefreshCw, ArrowRight, Plug, CheckCircle2,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import ChatBox from "@/components/ChatBox";
import {
  BOT_URL, CARD, LABEL, TH, TD, PeriodPicker, MetricCard, Panel, EmptyState,
  ChannelPill, ShareBar, money, num, pct, mult, channelColor,
  type PeriodKey,
} from "@/components/MarketingShared";

// ── Types (only the fields this page reads) ───────────────────────────────────

interface PlatformChannel {
  channel: string; spend: number; impressions: number; clicks: number;
  conversions: number; revenue: number; cpm: number | null; cpc: number | null;
  ctr: number | null; costPerConversion: number | null; attributedRoas: number | null;
  source: string; daysMissing: number;
}
interface PlatformsResponse {
  period: { label: string };
  channels: PlatformChannel[];
  blended: {
    spend: number; impressions: number; clicks: number;
    cpm: number | null; cpc: number | null; ctr: number | null;
    mer: number | null; cac: number | null;
    newCustomers: number | null; orders: number | null; netRevenue: number | null;
  };
  unattributed: { revenue: number; orders: number; note: string };
}
interface TrafficChannel { channel: string; sessions: number; users: number; share_pct: number }
/**
 * Note the field name: runGSCReport returns `avg_position`, not `position`, and it
 * is a plain mean of the returned rows rather than impression-weighted. The totals
 * are likewise summed over the rows the request asked for, not the whole property —
 * so they are labelled "top N queries" wherever they are shown.
 */
interface GscTotals { clicks: number; impressions: number; ctr_pct: number; avg_position: number }
interface GscResponse { totals: GscTotals; keywords: { keyword: string; clicks: number; position: number }[] }
interface KlaviyoCampaign { id: string; name: string; status: string; send_time: string | null }
interface Feed { key: string; label: string; connected: boolean; unlocks: string; howTo: string }

// ── Agent context ─────────────────────────────────────────────────────────────

const MARKETING_HINT = `
You are the lead agent for the **Marketing** surface of Mission Control.
Your domain is demand generation across every channel, judged on profit, not volume:

- Paid media — Meta and Google spend, blended MER, CAC, per-channel attributed ROAS
- Organic search — Google Search Console clicks, impressions, CTR, average position
- Owned — Klaviyo email campaigns, flows, and list growth
- Site traffic mix — GA4 sessions by default channel grouping
- The gap between what the platforms claim and what Shopify actually recorded

Rules you must hold to:
1. Platform-attributed revenue is NOT additive. Meta and Google both claim the same
   orders. Use it to rank channels against each other; use Shopify net revenue for
   anything about the business as a whole.
2. Blended MER (net revenue ÷ total ad spend) is the honest efficiency number. A
   channel ROAS that rises while MER falls means attribution shifted, not that
   marketing improved.
3. A missing feed is not a zero. If ad spend is unavailable, say the feed is down —
   do not report the channel as free.

Surface actions, not summaries: which channel is absorbing budget without returning
it, which organic queries sit at position 5-15 and are one page-fix from traffic,
which flows are off, and what should change this week.
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** GA4 and GSC take a day count, the P&L takes a period key. Keep them in step. */
function daysFor(period: PeriodKey): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return Math.max(1, Math.round((now.getTime() - qStart.getTime()) / 86_400_000));
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketingDashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [loading, setLoading] = useState(true);

  const [platforms, setPlatforms] = useState<PlatformsResponse | null>(null);
  const [traffic, setTraffic] = useState<TrafficChannel[] | null>(null);
  const [gsc, setGsc] = useState<GscResponse | null>(null);
  const [campaigns, setCampaigns] = useState<KlaviyoCampaign[] | null>(null);
  const [listStats, setListStats] = useState<{ total_lists: number; profile_count: number } | null>(null);
  const [feeds, setFeeds] = useState<Feed[] | null>(null);

  const [assignedAgent, setAssignedAgent] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const days = daysFor(period);
    const [p, t, g, c, l, f] = await Promise.all([
      getJson<PlatformsResponse>(`${BOT_URL}/admin/profitability/platforms?period=${period}`),
      getJson<{ channels: TrafficChannel[] }>(`${BOT_URL}/admin/analytics/channels?days=${days}`),
      // kwLimit drives the totals as well as the list: the route sums the rows it
      // returned, so asking for 8 would report the top 8 queries as if they were the
      // whole property. 100 is the route's ceiling.
      getJson<GscResponse>(`${BOT_URL}/admin/gsc/dashboard?days=${days}&kwLimit=100&pgLimit=5`),
      getJson<KlaviyoCampaign[] | { campaigns: KlaviyoCampaign[] }>(`${BOT_URL}/klaviyo/campaigns?limit=6`),
      getJson<{ total_lists: number; profile_count: number }>(`${BOT_URL}/klaviyo/list-stats`),
      getJson<{ feeds: Feed[] }>(`${BOT_URL}/admin/profitability/connections`),
    ]);
    setPlatforms(p);
    setTraffic(t?.channels ?? null);
    setGsc(g);
    // The route returns a bare array today; tolerate the wrapped shape too.
    setCampaigns(Array.isArray(c) ? c : (c?.campaigns ?? null));
    setListStats(l);
    setFeeds(f?.feeds ?? null);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const b = platforms?.blended;
  const paidChannels = (platforms?.channels ?? []).filter(c => c.spend > 0);
  const totalPaidSpend = paidChannels.reduce((s, c) => s + c.spend, 0);
  const missingFeeds = (feeds ?? []).filter(f => !f.connected);

  const agentMetrics = [
    { label: "Net Revenue", value: money(b?.netRevenue) },
    { label: "Ad Spend", value: money(b?.spend) },
    { label: "Blended MER", value: mult(b?.mer) },
    { label: "CAC", value: money(b?.cac, 2) },
    { label: "New Customers", value: num(b?.newCustomers) },
    ...paidChannels.map(c => ({
      label: `${c.channel} attributed ROAS`,
      value: mult(c.attributedRoas),
      sub: `${money(c.spend)} spend`,
    })),
    ...(gsc?.totals ? [{ label: "Organic clicks", value: num(gsc.totals.clicks), sub: `top 100 queries, avg position ${gsc.totals.avg_position?.toFixed(1)}` }] : []),
  ];

  const accentColor = assignedAgent?.color ?? "#e98d20";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left column ── */}
      <div>
        <div style={{ marginBottom: "1.25rem" }}>
          <SectionAgentPanel
            sectionId="marketing"
            sectionName="Marketing"
            sectionHint={MARKETING_HINT}
            accentColor="#e98d20"
            onAgentAssigned={a => setAssignedAgent(a)}
          />
        </div>

        <PeriodPicker
          value={period}
          onChange={setPeriod}
          right={
            <>
              <span style={{ fontSize: 10, color: "#475569" }}>{platforms?.period?.label ?? ""}</span>
              <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh marketing data">
                <RefreshCw size={12} className={loading ? "spin" : ""} />
              </button>
            </>
          }
        />

        {/* ── Headline KPIs ── */}
        <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <MetricCard
            label="Net Revenue" icon={DollarSign} color="#22c55e"
            value={money(b?.netRevenue)} sub="Shopify, after refunds"
            unavailable={b && b.netRevenue == null ? "Shopify feed unavailable" : null}
          />
          <MetricCard
            label="Ad Spend" icon={Megaphone} color="#f43f5e"
            value={money(b?.spend)} sub={`${paidChannels.length} paid channel${paidChannels.length === 1 ? "" : "s"}`}
            unavailable={b && b.spend == null ? "No ad platform connected" : null}
          />
          <MetricCard
            label="Blended MER" icon={TrendingUp} color="#e98d20"
            value={mult(b?.mer)} sub="Net revenue ÷ ad spend"
            unavailable={b && b.mer == null ? "Needs revenue and spend" : null}
          />
          <MetricCard
            label="CAC" icon={UserPlus} color="#a78bfa"
            value={money(b?.cac, 2)} sub="Spend ÷ new customers"
            unavailable={b && b.cac == null ? "Needs spend and new customers" : null}
          />
          <MetricCard
            label="New Customers" icon={Percent} color="#38bdf8"
            value={num(b?.newCustomers)} sub={`${num(b?.orders)} orders total`}
            unavailable={b && b.newCustomers == null ? "Shopify feed unavailable" : null}
          />
        </div>

        {/* ── Paid channels ── */}
        <Panel
          title="Paid channels"
          note="Revenue and ROAS below are each platform's own attribution — comparable between rows, never summed into the business total. The unattributed row is what Shopify recorded that no platform claimed."
          right={
            <Link href="/marketing/ads" style={{ fontSize: 10, color: "#f43f5e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Campaign detail <ArrowRight size={11} />
            </Link>
          }
        >
          {loading && !platforms ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : paidChannels.length === 0 ? (
            <EmptyState reason="No ad spend stored for this window. Either no ad platform is connected, or collection has not run — spend is unknown here, not zero." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Channel</th>
                    <th style={TH}>Spend</th>
                    <th style={TH}>Impr.</th>
                    <th style={TH}>CTR</th>
                    <th style={TH}>CPM</th>
                    <th style={TH}>Purch.</th>
                    <th style={TH}>Cost / purch.</th>
                    <th style={TH}>Attr. ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {paidChannels.map(c => {
                    const color = channelColor(c.channel);
                    const share = totalPaidSpend > 0 ? (c.spend / totalPaidSpend) * 100 : 0;
                    return (
                      <tr key={c.channel} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ ...TD, textAlign: "left", minWidth: 140 }}>
                          <ChannelPill channel={c.channel} />
                          <ShareBar pct={share} color={color} />
                          <span style={{ fontSize: 9.5, color: "#475569" }}>
                            {share.toFixed(0)}% of paid budget
                            {c.daysMissing > 0 && ` · ${c.daysMissing} day gap`}
                          </span>
                        </td>
                        <td style={TD}>{money(c.spend)}</td>
                        <td style={TD}>{num(c.impressions)}</td>
                        <td style={TD}>{pct(c.ctr, 2)}</td>
                        <td style={TD}>{money(c.cpm, 2)}</td>
                        <td style={TD}>{num(c.conversions)}</td>
                        <td style={TD}>{money(c.costPerConversion, 2)}</td>
                        <td style={{ ...TD, fontWeight: 800, color: c.attributedRoas == null ? "#475569" : c.attributedRoas >= 2.8 ? "#22c55e" : c.attributedRoas >= 1 ? "#e98d20" : "#f43f5e" }}>
                          {mult(c.attributedRoas)}
                        </td>
                      </tr>
                    );
                  })}
                  {platforms?.unattributed && (
                    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ ...TD, textAlign: "left" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>Unattributed</span>
                        <p style={{ fontSize: 9.5, color: "#475569", whiteSpace: "normal", maxWidth: 220 }}>
                          Organic, direct, email, repeat — no spend, so no ROAS.
                        </p>
                      </td>
                      <td style={TD}>—</td>
                      <td style={TD}>—</td>
                      <td style={TD}>—</td>
                      <td style={TD}>—</td>
                      <td style={TD}>{num(platforms.unattributed.orders)}</td>
                      <td style={TD}>—</td>
                      <td style={{ ...TD, color: "#64748b" }}>{money(platforms.unattributed.revenue)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Traffic mix ── */}
        <Panel
          title="Traffic mix — GA4 sessions"
          note="Where sessions came from, independent of what the ad platforms claim. A paid channel whose spend rises while its session share does not is buying the same visitors twice."
        >
          {!traffic ? (
            <EmptyState reason="GA4 returned nothing. Check GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON in Railway — an unconfigured property looks identical to a site with no traffic." />
          ) : traffic.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>No sessions recorded in this window.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {traffic.map((t, i) => (
                <motion.div
                  key={t.channel}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
                >
                  <span style={{ fontSize: 12, color: "#cbd5e1", minWidth: 150 }}>{t.channel}</span>
                  <div style={{ flex: 1 }}>
                    <ShareBar pct={t.share_pct} color="#38bdf8" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", minWidth: 70, textAlign: "right" }}>{num(t.sessions)}</span>
                  <span style={{ fontSize: 10, color: "#475569", minWidth: 44, textAlign: "right" }}>{t.share_pct}%</span>
                </motion.div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Earned + owned ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>

          {/* Organic search */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.9rem" }}>
              <Search size={13} color="#34d399" />
              <p style={LABEL}>Organic search</p>
              <Link href="/seo" style={{ marginLeft: "auto", fontSize: 9.5, color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none" }}>
                SEO →
              </Link>
            </div>
            {!gsc?.totals ? (
              <EmptyState reason="Search Console returned nothing. Check GSC_SITE_URL and that the service account has access to the property." />
            ) : (
              <>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
                  {[
                    { l: "Clicks", v: num(gsc.totals.clicks), c: "#34d399" },
                    { l: "Impressions", v: num(gsc.totals.impressions), c: "#38bdf8" },
                    { l: "CTR", v: pct(gsc.totals.ctr_pct, 2), c: "#e98d20" },
                    { l: "Avg pos.", v: gsc.totals.avg_position?.toFixed(1) ?? "—", c: "#a78bfa" },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <p style={{ ...LABEL, fontSize: 9 }}>{l}</p>
                      <p style={{ fontSize: "1.15rem", fontWeight: 800, color: c }}>{v}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 9.5, color: "#475569", marginBottom: "0.9rem" }}>
                  Across the top 100 queries, not the whole property.
                </p>
                <p style={{ ...LABEL, fontSize: 9, marginBottom: "0.45rem" }}>Top queries</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {(gsc.keywords ?? []).slice(0, 5).map(k => (
                    <div key={k.keyword} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.keyword}</span>
                      <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>
                        {num(k.clicks)} · p{k.position?.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Email */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.9rem" }}>
              <Mail size={13} color="#a78bfa" />
              <p style={LABEL}>Email — Klaviyo</p>
            </div>
            {!campaigns && !listStats ? (
              <EmptyState reason="Klaviyo returned nothing. Check KLAVIYO_API_KEY in Railway." />
            ) : (
              <>
                <div style={{ display: "flex", gap: "1.25rem", marginBottom: "0.9rem" }}>
                  <div>
                    <p style={{ ...LABEL, fontSize: 9 }}>Profiles</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "#a78bfa" }}>{num(listStats?.profile_count)}</p>
                  </div>
                  <div>
                    <p style={{ ...LABEL, fontSize: 9 }}>Lists</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>{num(listStats?.total_lists)}</p>
                  </div>
                </div>
                <p style={{ ...LABEL, fontSize: 9, marginBottom: "0.45rem" }}>Recent campaigns</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {(campaigns ?? []).slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "(untitled)"}</span>
                      <span style={{ fontSize: 9.5, color: "#475569", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.status}</span>
                    </div>
                  ))}
                  {(campaigns ?? []).length === 0 && <p style={{ fontSize: 11, color: "#475569" }}>No campaigns returned.</p>}
                </div>
                {/* getKlaviyoCampaigns hard-codes open_rate/click_rate/revenue to null —
                    they need Klaviyo's separate reporting endpoint. Say so rather than
                    showing zeros that read as "the emails failed". */}
                <p style={{ fontSize: 9.5, color: "#b45309", marginTop: "0.7rem", lineHeight: 1.5 }}>
                  Open, click and revenue per campaign are not on this feed yet — they need
                  Klaviyo&apos;s campaign-values reporting endpoint.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Feed status ── */}
        <Panel
          title="Feed status"
          note="What is plugged in, and which number goes blank while it is not. An empty panel above is almost always one of these."
        >
          {!feeds ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : missingFeeds.length === 0 ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <CheckCircle2 size={14} color="#22c55e" />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Every feed is connected.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {missingFeeds.map(f => (
                <div key={f.key} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  <Plug size={13} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{f.label}</p>
                    <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{f.unlocks}</p>
                  </div>
                </div>
              ))}
              <Link href="/profitability?tab=costs" style={{ fontSize: 10, color: "#e98d20", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: "0.2rem" }}>
                Fix in Profit → Costs <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </Panel>

        {/* ── Jump-offs ── */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { href: "/marketing/ads", label: "Ads", icon: Megaphone, color: "#f43f5e", sub: "Campaign & creative performance" },
            { href: "/profitability", label: "Profit", icon: DollarSign, color: "#22c55e", sub: "P&L, margin, contribution" },
            { href: "/website", label: "Website", icon: Globe, color: "#38bdf8", sub: "On-site personalization & tests" },
            { href: "/content", label: "Content", icon: Search, color: "#e98d20", sub: "Blog, social, creative library" },
          ].map(({ href, label, icon: Icon, color, sub }) => (
            <Link key={href} href={href} style={{ ...CARD, flex: 1, minWidth: 160, textDecoration: "none", display: "block", border: `1px solid ${color}18` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={color} />
                </div>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12 }}>{label}</span>
              </div>
              <p style={{ fontSize: 10, color: "#475569" }}>{sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Right: agent chat ── */}
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
              conversationKey={`${assignedAgent.id}-marketing`}
              context={{ sectionId: "marketing", sectionName: "Marketing", metrics: agentMetrics }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
                Assign a lead agent above<br />to enable the marketing chat.
              </p>
            </div>
          )}
        </div>

        {assignedAgent && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              "Which channel is absorbing budget without returning it?",
              "MER vs channel ROAS — what changed this period?",
              "Which organic queries are closest to page one?",
              "What should we change this week?",
            ].map(prompt => (
              <button key={prompt}
                style={{ textAlign: "left", background: `${accentColor}06`, border: `1px solid ${accentColor}15`, borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: 11, color: "#64748b", cursor: "pointer" }}>
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
