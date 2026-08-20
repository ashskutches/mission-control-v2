"use client";
/**
 * Command Center — /
 *
 * The primary interface between the human owner and the entire agent system,
 * organised as tabs. Overview is the agent-system view: revenue strip, department
 * health, pending actions, wins feed, Master Bot chat. Profitability is the P&L.
 *
 * Tabs are deep-linkable via ?tab=<id>. See the note on CommandCenterPage for why
 * the query is read on mount rather than through useSearchParams.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Brain, ShieldAlert, DollarSign,
  Send, AlertCircle, ChevronRight, Zap, RefreshCw,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import CostAlerts from "@/components/CostAlerts";
import ProfitDashboard from "@/components/ProfitDashboard";
import { LayoutDashboard, PiggyBank } from "lucide-react";
import { ADMIN_CC_TABS } from "@/app/lib/access";
import { CORE_SPACES, type Space } from "@/app/lib/spaces";
import { useRole } from "@/app/lib/useRole";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BOT_URL  = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Department config ────────────────────────────────────────────────────────
// The grid is CORE_SPACES (lib/spaces.tsx) — same ids the backend keys
// departmentHealth on, so a card and its number cannot disagree.
//
// The 13-entry list this replaced pointed every card into /commerce/*, and 7 of
// them — Social, Products, Orders, Loyalty, Reviews, CRO, Amazon — were ids no
// stored insight could ever carry: the first three of those were rewritten to a
// different section on the way in, and the rest were refused outright. Those cards
// showed "No insights yet" at a healthy-looking 70%, permanently.
// ── Sub-components ────────────────────────────────────────────────────────────
/**
 * `money: true` marks a figure a guest must not see. The guest tier is open to anyone
 * who completes a Discord sign-in, so revenue, AOV, forecast and spend are dropped
 * from the strip for them.
 *
 * ⚠️ Presentation only. The page fetches /admin/overview, which returns these numbers
 * in one payload — a guest can still read the response. Real enforcement means the bot
 * withholding them by tier, which lands with the /api/bot proxy rollout. See the note
 * on GUEST_HIDDEN_OVERVIEW in lib/access.ts.
 */
function KpiStrip({ data, hideMoney = false }: { data: any; hideMoney?: boolean }) {
  const all = [
    { label: "Today",    money: true,  value: data?.revenue?.today !== undefined ? `$${Number(data.revenue.today).toLocaleString()}` : "—",       color: "#22c55e" },
    { label: "Orders",   money: true,  value: data?.revenue?.todayOrders ?? "—",                                                                    color: "#38bdf8" },
    { label: "AOV",      money: true,  value: data?.revenue?.aov !== undefined ? `$${data.revenue.aov}` : "—",                                     color: "#a78bfa" },
    { label: "30d Rev",  money: true,  value: data?.revenue?.rolling30d !== undefined ? `$${Number(data.revenue.rolling30d).toLocaleString()}` : "—", color: "#fb923c" },
    { label: "Forecast", money: true,  value: data?.revenue?.mtdForecast ? `$${Number(data.revenue.mtdForecast).toLocaleString()}` : "—",          color: "#f59e0b" },
    { label: "Agents",   money: false, value: data?.agents?.active ?? "—",                                                                          color: "#e879f9" },
    { label: "Runs/7d",  money: false, value: data?.agentRuns7d ?? "—",                                                                             color: "#34d399" },
    { label: "AI Cost",  money: true,  value: data?.costs?.total30d !== undefined ? `$${data.costs.total30d}` : "—",                               color: "#f87171" },
  ];
  const items = hideMoney ? all.filter(i => !i.money) : all;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 9, color: "#555", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 900, color, margin: "4px 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function DeptCard({ dept, health, onNav }: { dept: Space; health?: any; onNav: (href: string) => void }) {
  const score = health?.score ?? 70;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#f43f5e";
  const Icon = dept.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onNav(dept.href)}
      style={{
        background: `linear-gradient(135deg, ${dept.color}08, rgba(0,0,0,0))`,
        border: `1px solid ${dept.color}22`,
        borderRadius: 12, padding: "12px 14px",
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${dept.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} color={dept.color} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#ccc", textTransform: "uppercase", letterSpacing: "0.06em" }}>{dept.label}</span>
        <ChevronRight size={11} color="#444" style={{ marginLeft: "auto" }} />
      </div>

      {/* Health bar */}
      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#555" }}>
          {health?.recentWins > 0 && <span style={{ color: "#22c55e" }}>↑{health.recentWins}w </span>}
          {health?.openIssues > 0 && <span style={{ color: "#f43f5e" }}>⚠{health.openIssues} </span>}
          {health?.insightCount > 0 ? `${health.insightCount} insights` : "No insights yet"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 900, color }}>{score}%</span>
      </div>
    </motion.button>
  );
}

// Risk tier drives the colour — it is now a real assessed value rather than a
// self-reported priority, so it is the honest thing to lead with.
const TIER_COLOR: Record<string, string> = {
  critical: "#f43f5e",
  high:     "#fb923c",
  medium:   "#f59e0b",
  low:      "#6b7280",
};

function PendingActionRow({ action }: { action: any }) {
  const color = TIER_COLOR[action.risk_tier] ?? "#6366f1";
  const value = action.estimated_monthly_value;

  return (
    <div
      onClick={() => action.id && window.location.assign(`/pipeline/${action.id}`)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: action.id ? "pointer" : "default",
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* The title is the whole point — this row used to read "Priority 9/10" with
            no indication of what the insight actually was. */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ddd", margin: 0, lineHeight: 1.4 }}>
          {action.section && (
            <span style={{ color, fontSize: 9, fontWeight: 800, textTransform: "uppercase", marginRight: 6, letterSpacing: "0.08em" }}>
              {action.section}
            </span>
          )}
          {action.title ?? "Untitled insight"}
        </p>
        <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>
          {action.agent ?? "Agent"}
          {action.occurrences > 1 && <span style={{ color: "#fb923c", fontWeight: 700 }}> · reported {action.occurrences}×</span>}
          {value != null && (
            <span style={{ color: value < 0 ? "#f43f5e" : "#22c55e", fontWeight: 700 }}>
              {" · "}{value < 0 ? "−" : "+"}${Math.abs(value).toLocaleString()}/mo
            </span>
          )}
          {" · "}{new Date(action.created_at).toLocaleDateString()}
        </p>
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 4, padding: "1px 6px", flexShrink: 0, textTransform: "uppercase" }}>
        {action.risk_tier ?? action.type?.replace("_", " ")}
      </span>
    </div>
  );
}

function WinRow({ win }: { win: any }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0, marginTop: 4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: "#ccc", margin: 0, lineHeight: 1.4 }}>
          {win.details?.slice(0, 100) ?? win.action}
        </p>
        <p style={{ fontSize: 9, color: "#555", margin: "2px 0 0" }}>{win.agent_id} · {new Date(win.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}

interface ChatMsg { role: "user" | "assistant"; text: string; ts: number; }

function MasterBotChat({ masterAgentId }: { masterAgentId: string | null }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      setMessages([{
        role: "assistant",
        text: "**L&R Ops Online.** All departments are being monitored. What do you want to dig into?",
        ts: Date.now(),
      }]);
    }
  }, []);



  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(p => [...p, { role: "user", text, ts: Date.now() }]);
    setLoading(true);
    try {
      // Use master agent ID if available, else the generic message endpoint
      const endpoint = masterAgentId
        ? `${BOT_URL}/admin/chat/agent/${masterAgentId}`
        : `${BOT_URL}/admin/chat`;
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: AbortSignal.timeout(90_000),
      });
      const data = await r.json();
      const reply = data.reply ?? data.text ?? data.message ?? "…";
      setMessages(p => [...p, { role: "assistant", text: reply, ts: Date.now() }]);
    } catch (err: any) {
      setMessages(p => [...p, { role: "assistant", text: `❌ ${err.message}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, masterAgentId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                  <Brain size={11} color="var(--accent-orange)" />
                </div>
              )}
              <div style={{
                maxWidth: "80%", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
                padding: "8px 12px", fontSize: 12, lineHeight: 1.6,
                background: m.role === "user" ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.04)",
                border: m.role === "user" ? "1px solid rgba(255,140,0,0.2)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                {m.role === "assistant" ? <MarkdownMessage content={m.text} /> : <span style={{ color: "#fff" }}>{m.text}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,140,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={11} color="var(--accent-orange)" />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-orange)", display: "block" }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask the intelligence anything…"
          rows={2}
          style={{
            flex: 1, resize: "none", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none",
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={send} disabled={loading || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: 10, background: loading || !input.trim() ? "rgba(255,140,0,0.1)" : "rgba(255,140,0,0.2)",
            border: "1px solid rgba(255,140,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer", alignSelf: "flex-end",
          }}
        >
          <Send size={14} color={loading || !input.trim() ? "#555" : "var(--accent-orange)"} />
        </motion.button>
      </div>
    </div>
  );
}

// ── Tab shell ─────────────────────────────────────────────────────────────────
const CC_TABS = [
  { id: "overview",      label: "Overview",      icon: LayoutDashboard, color: "var(--accent-orange)" },
  { id: "profitability", label: "Profitability", icon: PiggyBank,       color: "#22c55e" },
] as const;

type CcTab = typeof CC_TABS[number]["id"];

const readTab = (): CcTab => {
  const t = new URLSearchParams(window.location.search).get("tab");
  return CC_TABS.some(x => x.id === t) ? t as CcTab : "overview";
};

/**
 * Deliberately NOT useSearchParams.
 *
 * useSearchParams opts a statically-prerendered route into client-only rendering,
 * which turned the whole of `/` into a "Loading…" fallback in the server HTML —
 * measured, not assumed. Reading the query on mount keeps the Overview tab
 * server-rendered as before.
 *
 * A mount-only read is safe here because nothing inside the app pushes `?tab=`
 * without a full load: the sidebar's Profit item points at /profitability, a real
 * route. Reaching /?tab=profitability means a fresh page load, and back/forward is
 * covered by the popstate listener.
 */
export default function CommandCenterPage() {
  const [tab, setTab] = useState<CcTab>("overview");

  // Profitability is admin-only. The middleware gates /profitability but cannot see
  // "?tab=profitability", so the tab is filtered by role here and `shownTab` falls
  // back to Overview for anyone who deep-links it. Until useRole resolves we render
  // as a viewer, so the P&L never flashes up while the role is still unknown.
  const { role } = useRole();
  const isAdmin = role === "admin";
  const visibleTabs = useMemo(
    () => CC_TABS.filter(t => isAdmin || !(ADMIN_CC_TABS as readonly string[]).includes(t.id)),
    [isAdmin],
  );
  const shownTab: CcTab = visibleTabs.some(t => t.id === tab) ? tab : "overview";

  useEffect(() => {
    setTab(readTab());
    const onPop = () => setTab(readTab());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const switchTab = (t: CcTab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    // The Profit dashboard's own dashboard/costs sub-tab belongs to the tab being
    // left, so it does not travel with the switch.
    url.searchParams.delete("sub");
    window.history.pushState(null, "", url);
  };

  return (
    <div className="px-4 pb-8 pt-4" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* A one-item tab strip is just a mystery button — for viewers, Overview is
          the whole page, so the strip is dropped rather than shown with one tab. */}
      {visibleTabs.length > 1 && (
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 12, padding: 3, alignSelf: "flex-start",
      }}>
        {visibleTabs.map(t => {
          const Icon = t.icon;
          const on = shownTab === t.id;
          return (
            <button key={t.id} onClick={() => switchTab(t.id)} aria-pressed={on} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: on ? "rgba(255,255,255,.06)" : "none",
              border: 0, borderRadius: 9, padding: ".4rem .85rem", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: on ? 800 : 600,
              color: on ? t.color : "#777", transition: "all .15s",
            }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>
      )}

      {shownTab === "overview"
        ? <OverviewTab />
        : <ProfitDashboard subTabParam="sub" showHeading={false} />}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  // Read the tier here rather than threading it down: OverviewTab is rendered from
  // the tab strip, not passed props, and useRole is a cached fetch of /api/auth/me.
  const { role } = useRole();
  const hideMoney = role === "guest";
  const kpiCount = hideMoney ? 2 : 8;   // KpiStrip drops the six money tiles for guests
  const [overview, setOverview] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [masterAgentId, setMasterAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router_fn = (href: string) => window.location.assign(href);

  const load = useCallback(async () => {
    const [ov, ag] = await Promise.all([
      fetch(`${BOT_URL}/admin/overview`, { signal: AbortSignal.timeout(10_000) }).then(r => r.json()).catch(() => null),
      fetch(`${BOT_URL}/admin/agents`, { signal: AbortSignal.timeout(5_000) }).then(r => r.json()).catch(() => []),
    ]);
    if (ov) setOverview(ov);
    if (Array.isArray(ag)) {
      setAgents(ag);
      const master = ag.find((a: any) => a.name?.toLowerCase().includes("master") || a.role === "master" || a.category === "master");
      if (master) setMasterAgentId(master.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const deptHealthMap = Object.fromEntries((overview?.departmentHealth ?? []).map((h: any) => [h.dept, h]));

  return (
    // No px-4/pt-4 here — the Command Center shell above supplies the gutter.
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── L&R Hero banner ── */}
      <section style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(233,141,32,0.2)" }}>
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lrb-hero-banner.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 20%",
            opacity: 0.18,
            pointerEvents: "none",
          }}
        />
        {/* Gradient overlay to ensure text legibility */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(26,26,28,0.97) 0%, rgba(26,26,28,0.85) 55%, rgba(26,26,28,0.3) 100%)",
          pointerEvents: "none",
        }} />
        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lrb-wordmark.png"
                alt="Leaps & Rebounds Mission Control"
                style={{ width: "min(260px, 55vw)", borderRadius: 10, marginBottom: 10, display: "block" }}
              />
              {/* Brand differentiator badges */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "70% Less Joint Impact", color: "#e98d20" },
                  { label: "Bungee · Not Springs", color: "#38bdf8" },
                  { label: "Ships 95% Assembled", color: "#22c55e" },
                  { label: "30-Day Jump Trial", color: "#a78bfa" },
                ].map(({ label, color }) => (
                  <span key={label} style={{
                    fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                    color, background: `${color}12`, border: `1px solid ${color}30`,
                    borderRadius: 6, padding: "3px 8px",
                  }}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={load}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#888", fontSize: 11 }}
              >
                <RefreshCw size={11} /> Refresh
              </motion.button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 10, padding: "8px 14px" }}>
                <ShieldAlert size={14} color="#22c55e" />
                <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {agents.filter(a => a.enabled !== false).length} Agents Bouncing
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(233,141,32,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DollarSign size={10} color="var(--accent-orange)" />
          </div>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#666", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Live Revenue Intelligence</p>
        </div>
        {loading ? (
          // Skeleton count tracks the real strip: guests see only the two non-money
          // tiles, so an 8-column shimmer would collapse to 2 and jump the layout.
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpiCount}, 1fr)`, gap: 8 }}>
            {Array(kpiCount).fill(0).map((_, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, height: 60 }} />
            ))}
          </div>
        ) : (
          <KpiStrip data={overview} hideMoney={hideMoney} />
        )}
      </div>

      {/* ── Department scorecards ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(233,141,32,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={10} color="var(--accent-orange)" />
          </div>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#666", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Department Health</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {CORE_SPACES.map(dept => (
            <DeptCard key={dept.id} dept={dept} health={deptHealthMap[dept.id]} onNav={router_fn} />
          ))}
        </div>
      </div>

      {/* ── Main columns ── */}
      <div className="columns" style={{ gap: "1rem" }}>

        {/* Left — Pending Actions + Wins */}
        <div className="column is-5" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Pending Actions Inbox */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={12} color="#f59e0b" />
              </div>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Needs Your Decision</p>
              {overview?.insights?.total > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 5, padding: "1px 7px" }}>
                  top 5 of {overview.insights.total}
                </span>
              )}
            </div>
            {overview?.insights?.pendingActions?.length > 0 ? (
              <div>
                {overview.insights.pendingActions.map((action: any, i: number) => (
                  <PendingActionRow key={action.id ?? i} action={action} />
                ))}
                <button
                  onClick={() => router_fn("/pipeline")}
                  style={{ marginTop: 10, fontSize: 10, color: "#555", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  View the full board <ChevronRight size={10} />
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>Nothing needs a decision right now. Agents are watching.</p>
            )}
          </div>

          {/* Agent Wins Feed */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={12} color="#22c55e" />
              </div>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Recent Agent Wins</p>
            </div>
            {overview?.recentWins?.length > 0 ? (
              overview.recentWins.map((win: any, i: number) => <WinRow key={i} win={win} />)
            ) : (
              <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>Agents running… wins will appear here.</p>
            )}
          </div>
        </div>

        {/* Right — Master Bot Chat */}
        <div className="column is-7">
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,140,0,0.12)", borderRadius: 14, padding: "18px 20px", height: 520, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,140,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Brain size={13} color="var(--accent-orange)" />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Intelligence</p>
                <p style={{ fontSize: 9, color: "#555", margin: 0 }}>
                  {masterAgentId ? `Agent: ${masterAgentId.slice(0, 8)}… · Online` : "General intelligence mode"}
                </p>
              </div>
              <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
            </div>
            <MasterBotChat masterAgentId={masterAgentId} />
          </div>
        </div>
      </div>

      {/* ── Strategic Recommendation ── */}
      {overview?.recommendation && (
        <div style={{ background: "linear-gradient(135deg, rgba(255,140,0,0.06), rgba(0,0,0,0))", border: "1px solid rgba(255,140,0,0.12)", borderRadius: 14, padding: "18px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={22} color="var(--accent-orange)" />
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Strategic Recommendation</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>
                "{overview.recommendation}"
              </p>
            </div>
          </div>
          <Brain size={100} style={{ position: "absolute", right: -20, bottom: -20, opacity: 0.03, pointerEvents: "none" }} />
        </div>
      )}

      {/* ── Cost Alerts ── */}
      <CostAlerts />
    </div>
  );
}
