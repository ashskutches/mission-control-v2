"use client";
/**
 * Master Bot Overview — /
 *
 * The primary interface between the human owner and the entire agent system.
 * Shows: revenue strip, department health scorecards, pending actions inbox,
 * agent wins feed, and a persistent Master Bot chat.
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, TrendingUp, Brain, Cpu, ShieldAlert, Bot, CheckSquare, Target,
  ShoppingBag, DollarSign, Send, AlertCircle, ChevronRight, Zap, Award,
  Package, ShoppingCart, Heart, Share2, BarChart2, Mail, Megaphone,
  SearchCheck, FileText, Star, LifeBuoy, TrendingDown, RefreshCw,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import CostAlerts from "@/components/CostAlerts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BOT_URL  = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Department config ────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { id: "seo",        label: "SEO",         icon: SearchCheck,  color: "#38bdf8", href: "/commerce/seo" },
  { id: "email",      label: "Email",        icon: Mail,         color: "#a78bfa", href: "/commerce/email" },
  { id: "content",    label: "Content",      icon: FileText,     color: "#22c55e", href: "/commerce/content" },
  { id: "ads",        label: "Paid Ads",     icon: Megaphone,    color: "#f43f5e", href: "/commerce/ads" },
  { id: "social",     label: "Social",       icon: Share2,       color: "#e879f9", href: "/commerce/social" },
  { id: "influencing",label: "Influencing",  icon: Star,         color: "#fb923c", href: "/commerce/influencing" },
  { id: "products",   label: "Products",     icon: Package,      color: "#34d399", href: "/commerce/products" },
  { id: "orders",     label: "Orders",       icon: ShoppingCart, color: "#22c55e", href: "/commerce/orders" },
  { id: "loyalty",    label: "Loyalty",      icon: Heart,        color: "#f43f5e", href: "/commerce/loyalty" },
  { id: "reviews",    label: "Reviews",      icon: Award,        color: "#fbbf24", href: "/commerce/reviews" },
  { id: "support",    label: "Support",      icon: LifeBuoy,     color: "#10b981", href: "/commerce/support" },
  { id: "cro",        label: "CRO",          icon: TrendingUp,   color: "#818cf8", href: "/commerce/cro" },
  { id: "amazon",     label: "Amazon",       icon: BarChart2,    color: "#fb923c", href: "/commerce/amazon" },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiStrip({ data }: { data: any }) {
  const items = [
    { label: "Today",    value: data?.revenue?.today !== undefined ? `$${Number(data.revenue.today).toLocaleString()}` : "—",       color: "#22c55e" },
    { label: "Orders",   value: data?.revenue?.todayOrders ?? "—",                                                                    color: "#38bdf8" },
    { label: "AOV",      value: data?.revenue?.aov !== undefined ? `$${data.revenue.aov}` : "—",                                     color: "#a78bfa" },
    { label: "30d Rev",  value: data?.revenue?.rolling30d !== undefined ? `$${Number(data.revenue.rolling30d).toLocaleString()}` : "—", color: "#fb923c" },
    { label: "Forecast", value: data?.revenue?.mtdForecast ? `$${Number(data.revenue.mtdForecast).toLocaleString()}` : "—",          color: "#f59e0b" },
    { label: "Agents",   value: data?.agents?.active ?? "—",                                                                          color: "#e879f9" },
    { label: "Runs/7d",  value: data?.agentRuns7d ?? "—",                                                                             color: "#34d399" },
    { label: "AI Cost",  value: data?.costs?.total30d !== undefined ? `$${data.costs.total30d}` : "—",                               color: "#f87171" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 9, color: "#555", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 900, color, margin: "4px 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function DeptCard({ dept, health, onNav }: { dept: typeof DEPARTMENTS[number]; health?: any; onNav: (href: string) => void }) {
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

function PendingActionRow({ action }: { action: any }) {
  const typeColor: Record<string, string> = { integration_request: "#fb923c", suggestion: "#f59e0b", critical_issue: "#f43f5e" };
  const color = typeColor[action.type] ?? "#6366f1";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ccc", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {action.section && <span style={{ color, fontSize: 9, fontWeight: 800, textTransform: "uppercase", marginRight: 6, letterSpacing: "0.08em" }}>{action.section}</span>}
          Priority {action.priority}/10
        </p>
        <p style={{ fontSize: 10, color: "#555", margin: 0 }}>{action.agent ?? "Agent"} · {new Date(action.created_at).toLocaleDateString()}</p>
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>
        {action.type?.replace("_", " ")}
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
        text: "**Mission Control Online.** I'm monitoring all departments. What strategic question can I help you with?",
        ts: Date.now(),
      }]);
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          placeholder="Ask the Master Bot anything…"
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OverviewPage() {
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
    <div className="px-4 pb-8 pt-4" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Hero strip ── */}
      <section style={{ background: "linear-gradient(135deg, rgba(255,140,0,0.06), rgba(0,0,0,0))", border: "1px solid rgba(255,140,0,0.1)", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, color: "#555", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Mission Control · Master Bot HQ</p>
            <h1 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 900, color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>Situation Room</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={load}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#888", fontSize: 11 }}
            >
              <RefreshCw size={11} /> Refresh
            </motion.button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 10, padding: "8px 14px" }}>
              <ShieldAlert size={14} color="#22c55e" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {agents.filter(a => a.enabled !== false).length} Agents Active
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>Live Revenue Intelligence</p>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
            {Array(8).fill(0).map((_, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, height: 60 }} />
            ))}
          </div>
        ) : (
          <KpiStrip data={overview} />
        )}
      </div>

      {/* ── Department scorecards ── */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>Department Health</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {DEPARTMENTS.map(dept => (
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
              <AlertCircle size={14} color="#f59e0b" />
              <p style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Pending Actions</p>
              {overview?.insights?.total > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 5, padding: "1px 7px" }}>
                  {overview.insights.total} new
                </span>
              )}
            </div>
            {overview?.insights?.pendingActions?.length > 0 ? (
              <div>
                {overview.insights.pendingActions.map((action: any, i: number) => (
                  <PendingActionRow key={i} action={action} />
                ))}
                <button
                  onClick={() => router_fn("/intelligence")}
                  style={{ marginTop: 10, fontSize: 10, color: "#555", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  View all insights <ChevronRight size={10} />
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No high-priority pending actions. Agents are watching.</p>
            )}
          </div>

          {/* Agent Wins Feed */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Zap size={14} color="#22c55e" />
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
                <p style={{ fontSize: 12, fontWeight: 800, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Master Bot</p>
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
