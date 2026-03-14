"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TrendingUp,
  Brain,
  Cpu,
  ShieldAlert,
  BarChart3,
  Zap,
  Database,
  Image as ImageIcon,
  Search,
  ShoppingBag,
  Bot,
  Sparkles,
  FileText,
  Target,
  CheckSquare,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Components
import Sidebar from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import { NeuralExplorer } from "@/components/NeuralExplorer";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { AgentRoster } from "@/components/AgentRoster";
import { AgentCRUD } from "@/components/AgentCRUD";
import { BusinessContextEditor } from "@/components/BusinessContextEditor";
import { TemplateLibrary } from "@/components/TemplateLibrary";
import { ProjectsDashboard } from "@/components/ProjectsDashboard";
import CostAlerts from "@/components/CostAlerts";
import AgentMetrics from "@/components/AgentMetrics";
import { cn } from "@/app/lib/utils";
import { APP_CONFIG } from "@/app/lib/AppConfig";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Small helpers ─────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, icon: Icon, trend,
}: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ElementType; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
      <div className="is-flex is-align-items-center mb-3" style={{ gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.09em" }}>{label}</span>
      </div>
      <p className="title is-size-3 has-text-white mb-1" style={{ lineHeight: 1, color }}>{value}</p>
      {sub && <p className="is-size-7 has-text-grey" style={{ fontSize: 11 }}>{sub}</p>}
    </div>
  );
}

// ── CollapsibleSection ───────────────────────────────────────────────────────
function CollapsibleSection({
  title, subtitle, defaultOpen = false, children,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", background: open ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
          border: "none", cursor: "pointer", borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)")}
      >
        <div style={{ textAlign: "left" }}>
          <p className="has-text-weight-black has-text-white" style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{title}</p>
          {subtitle && <p className="has-text-grey" style={{ fontSize: 11, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {open ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
      </button>
      {open && (
        <div style={{ padding: "1.25rem" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data
  const [activity, setActivity]   = useState<any[]>([]);
  const [facts, setFacts]         = useState<any[]>([]);
  const [costData, setCostData]   = useState({ total: 0, rows: [] as any[] });
  const [costStats, setCostStats] = useState<{ totalCostUsd: number; totalAlerts: number } | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const [health, setHealth]       = useState<any>(null);
  const [shopify, setShopify]     = useState<any>(null);
  const [forecast, setForecast]   = useState<any>(null);
  const [agents, setAgents]       = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState(0);
  const [monthProjects, setMonthProjects] = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Supabase fetches
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [actResp, factResp, costResp, todayTasksResp, monthProjectsResp] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("bot_facts").select("*").order("updated_at", { ascending: false }),
        supabase.from("cost_log").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id", { count: "exact" }).gte("created_at", `${today}T00:00:00`).eq("status", "success"),
        supabase.from("tasks").select("id", { count: "exact" }).gte("created_at", monthStart).eq("status", "success"),
      ]);

      if (actResp.data)  setActivity(actResp.data);
      if (factResp.data) setFacts(factResp.data);
      if (costResp.data) {
        const total = costResp.data.reduce((acc, curr) => acc + (curr.cost_usd || 0), 0);
        setCostData({ total, rows: costResp.data });
      }
      setTodayTasks(todayTasksResp.count ?? 0);
      setMonthProjects(monthProjectsResp.count ?? 0);

      // Bot API fetches
      try {
        const [healthR, shopifyR, forecastR, agentsR, costStatsR, metricsR] = await Promise.all([
          fetch(`${BOT_URL}/health`).then(r => r.json()).catch(() => null),
          fetch(`${BOT_URL}/shopify`).then(r => r.json()).catch(() => null),
          fetch(`${BOT_URL}/forecasting`).then(r => r.json()).catch(() => null),
          fetch(`${BOT_URL}/admin/agents`).then(r => r.json()).catch(() => []),
          fetch(`${BOT_URL}/admin/cost-stats`).then(r => r.json()).catch(() => null),
          fetch(`${BOT_URL}/admin/agent-metrics`).then(r => r.json()).catch(() => null),
        ]);
        if (healthR)    setHealth(healthR);
        if (shopifyR)   setShopify(shopifyR);
        if (forecastR)  setForecast(forecastR);
        if (agentsR)    setAgents(Array.isArray(agentsR) ? agentsR : []);
        if (costStatsR?.totalCostUsd !== undefined) setCostStats(costStatsR);
        if (metricsR?.roi) setAgentMetrics(metricsR);
      } catch { /* offline */ }

      setLoading(false);
    };

    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, []);

  const currentTab = useMemo(() =>
    APP_CONFIG.navigation.find(n => n.id === activeTab) || APP_CONFIG.navigation[0],
    [activeTab]);

  // Derived commerce metrics
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCost = (costData.rows as any[]).filter(r => new Date(r.created_at).getTime() > sevenDaysAgo)
    .reduce((s: number, r: any) => s + (r.cost_usd || 0), 0);

  return (
    <main className="app-wrapper">
      <div className={cn("sidebar-backdrop", isMobileMenuOpen && "is-active")}
        onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />

      <Sidebar activeTab={activeTab} onTabChange={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} isOpen={isMobileMenuOpen} />

      <section className="main-content custom-scrollbar" style={{ overflowY: "auto", height: "100vh", position: "relative" }}>

        {/* Mobile nav */}
        <nav className="navbar is-hidden-tablet is-black" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item has-text-weight-black has-text-white" onClick={() => setActiveTab("overview")}>GC COMMAND</a>
            <a role="button" className={cn("navbar-burger", isMobileMenuOpen && "is-active")} aria-label="menu"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            </a>
          </div>
        </nav>

        {/* Hero header */}
        <section className="hero is-black is-small mb-5">
          <div className="hero-body px-0">
            <div className="level is-mobile px-4">
              <div className="level-left">
                <div className="level-item">
                  <div>
                    <div className="is-flex is-align-items-center mb-2" style={{ gap: "0.75rem" }}>
                      <div className="is-flex is-justify-content-center is-align-items-center"
                        style={{ width: "32px", height: "32px", background: "rgba(255,140,0,0.1)", borderRadius: "8px", color: "var(--accent-orange)" }}>
                        <currentTab.icon size={18} />
                      </div>
                      <p className="has-text-grey-light is-size-7 is-uppercase has-text-weight-black" style={{ letterSpacing: "0.1em" }}>
                        {currentTab.label}
                      </p>
                    </div>
                    <h1 className="title is-size-1 has-text-weight-black tracking-tight mb-0">
                      {activeTab === "overview" ? "Situation Room" : currentTab.label}
                    </h1>
                  </div>
                </div>
              </div>
              <div className="level-right is-hidden-mobile">
                <div className="level-item">
                  <div className="box py-3 px-5 is-flex is-align-items-center" style={{ gap: "1rem", background: "rgba(255,255,255,0.02) !important" }}>
                    <div className="has-text-right">
                      <p className="is-size-7 has-text-weight-black has-text-grey is-uppercase" style={{ fontSize: "9px", letterSpacing: "0.1em" }}>Active Intelligence</p>
                      <p className="is-size-7 has-text-weight-black has-text-success is-uppercase">Stable Mode</p>
                    </div>
                    <ShieldAlert size={20} className="has-text-success" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* ── Tab Content ── */}
        <div className="px-4 pb-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>

              {/* ═══════════════════════════════════════════════════════════════
                  OVERVIEW
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

                  {/* Row 1 — 6 KPI cards */}
                  <div>
                    <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>
                      Key Metrics
                    </p>
                    <div className="columns is-multiline">
                      <div className="column is-4">
                        <KpiCard label="Daily Revenue" icon={ShoppingBag} color="var(--accent-emerald)"
                          value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"}
                          sub={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading..."} />
                      </div>
                      <div className="column is-4">
                        <KpiCard label="Active Agents" icon={Bot} color="var(--accent-orange)"
                          value={agents.length}
                          sub={`${agents.filter((a: any) => a.enabled !== false).length} enabled`} />
                      </div>
                      <div className="column is-4">
                        <KpiCard label="LLM Spend (30d)" icon={Cpu} color="var(--accent-blue)"
                          value={costStats ? `$${costStats.totalCostUsd.toFixed(2)}` : `$${costData.total.toFixed(2)}`}
                          sub={costStats?.totalAlerts ? `${costStats.totalAlerts} high-cost alerts` : "AI compute cost"} />
                      </div>
                      <div className="column is-4">
                        <KpiCard label="Value Generated (30d)" icon={TrendingUp} color="var(--accent-emerald)"
                          value={agentMetrics ? `$${agentMetrics.roi.timeSavedValueUsd.toFixed(0)}` : "—"}
                          sub={agentMetrics ? `${agentMetrics.roi.timeSavedHrs}h of work automated` : "Time saved × $25/hr"} />
                      </div>
                      <div className="column is-4">
                        <KpiCard label="Tasks Completed Today" icon={CheckSquare} color="var(--accent-cyan)"
                          value={todayTasks}
                          sub="Successful agent runs" />
                      </div>
                      <div className="column is-4">
                        <KpiCard label="Projects This Month" icon={Target} color="var(--accent-purple, #a855f7)"
                          value={monthProjects}
                          sub="Successful completions" />
                      </div>
                    </div>
                  </div>

                  {/* Cost Alerts — Overview only */}
                  <CostAlerts />

                  {/* Row 2 — Live feed */}
                  <div className="box p-6">
                    <div className="level mb-5">
                      <div className="level-left">
                        <div>
                          <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1" style={{ letterSpacing: "-0.02em" }}>Live Operations Feed</h3>
                          <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Real-time agent activity</p>
                        </div>
                      </div>
                      <div className="level-right">
                        <Activity size={20} className="has-text-info" style={{ animation: "pulse 2s infinite" }} />
                      </div>
                    </div>
                    <SynergyFeed items={activity.slice(0, 8)} />
                  </div>

                  {/* Row 3 — Mission banner / recommendation */}
                  <div className="box p-6 is-relative" style={{ overflow: "hidden" }}>
                    <div className="columns is-vcentered">
                      <div className="column is-narrow">
                        <div className="is-flex is-justify-content-center is-align-items-center"
                          style={{ width: "56px", height: "56px", background: "rgba(255,140,0,0.06)", borderRadius: "16px", color: "var(--accent-orange)", border: "1px solid rgba(255,140,0,0.12)" }}>
                          <Brain size={28} />
                        </div>
                      </div>
                      <div className="column">
                        <p className="is-size-7 has-text-weight-black has-text-grey-light is-uppercase mb-1" style={{ letterSpacing: "0.08em" }}>Strategic Recommendation</p>
                        <p className="is-size-4 has-text-weight-black has-text-white mb-0 italic" style={{ lineHeight: "1.3" }}>
                          "{facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing live data streams… strategic pivot pending."}"
                        </p>
                      </div>
                    </div>
                    <Brain size={120} style={{ position: "absolute", right: "-20px", bottom: "-20px", opacity: 0.03, pointerEvents: "none" }} />
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  AGENTS
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "agents" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <CollapsibleSection
                    title="Agent Intelligence"
                    subtitle="Performance · Cost · ROI — 30 Day Window"
                    defaultOpen={false}
                  >
                    <AgentMetrics />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Projects"
                    subtitle="Agent-driven objectives and deliverables"
                    defaultOpen={false}
                  >
                    <ProjectsDashboard />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Manage Agents"
                    subtitle="Create, configure, and deploy AI agents"
                    defaultOpen={true}
                  >
                    <AgentCRUD />
                  </CollapsibleSection>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  COMMERCE
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "commerce" && (() => {
                const imagesGenerated = activity.filter(a =>
                  a.details?.toLowerCase().includes("image") || a.action?.toLowerCase().includes("image")).length;
                const ocaRuns = activity.filter(a =>
                  a.action === "oca_run" || a.details?.toLowerCase().includes("content asset")).length;
                const searchRuns = activity.filter(a =>
                  a.action === "web_search" || a.details?.toLowerCase().includes("web search")).length;
                const contentAgents = agents.filter((a: any) => a.features?.content_creation).length;
                const imageAgents   = agents.filter((a: any) => a.features?.image_generation).length;
                const shopifyAgents = agents.filter((a: any) => a.features?.shopify).length;

                const PILL = ({ label, color }: { label: string; color: string }) => (
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", background: `${color}18`, color, border: `1px solid ${color}40` }}>{label}</span>
                );

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

                    {/* Revenue Intelligence */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Revenue Intelligence</p>
                      <div className="columns is-multiline">
                        <div className="column is-4">
                          <StatCard label="Today's Revenue" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"}
                            subValue={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading..."}
                            color="var(--accent-emerald)" trend="up" icon={ShoppingBag} />
                        </div>
                        <div className="column is-4">
                          <StatCard label="30-Day Sales" value={shopify ? `$${Number(shopify.total30d || 0).toLocaleString()}` : "—"}
                            subValue="Rolling 30-day gross" color="var(--accent-blue)" icon={TrendingUp} />
                        </div>
                        <div className="column is-4">
                          <StatCard label="Month-End Forecast"
                            value={(() => {
                              if (forecast?.estimatedMonthEnd) return `$${Number(forecast.estimatedMonthEnd).toLocaleString()}`;
                              const mtd = Number(shopify?.currentMonthRevenue || 0);
                              const d = new Date(); const dom = d.getDate();
                              const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                              return mtd > 0 ? `$${Math.round(mtd / dom * dim).toLocaleString()}` : "—";
                            })()}
                            subValue="Projected from MTD pace" color="var(--accent-cyan)" icon={BarChart3} />
                        </div>
                      </div>
                    </div>

                    {/* Content Pipeline */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Content Pipeline Activity</p>
                      <div className="columns is-multiline">
                        {[
                          { label: "Images Generated", val: imagesGenerated, icon: ImageIcon, color: "#ff64c8", sub: "DALL-E · Nano Banana · Ideogram" },
                          { label: "OCA Runs", val: ocaRuns, icon: Sparkles, color: "var(--accent-orange)", sub: "Content creation pipeline" },
                          { label: "Web Searches", val: searchRuns, icon: Search, color: "var(--accent-cyan)", sub: "Competitor & market research" },
                          { label: "Total Agent Events", val: activity.length, icon: Activity, color: "var(--accent-emerald)", sub: "All logged activity (last 100)" },
                        ].map(({ label, val, icon: Icon, color, sub }) => (
                          <div key={label} className="column is-3">
                            <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Icon size={14} style={{ color }} />
                                </div>
                                <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>{label}</span>
                              </div>
                              <p className="title is-size-3 has-text-white mb-1">{val}</p>
                              <p className="is-size-7 has-text-grey">{sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Agent Capability + Activity */}
                    <div className="columns">
                      <div className="column is-5">
                        <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                          <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-5" style={{ letterSpacing: "0.12em" }}>Agent Capability Map</p>
                          {agents.length === 0 ? (
                            <p className="has-text-grey is-size-7 italic">No agents deployed yet.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                              {agents.map((agent: any) => {
                                const activeFeatures = Object.entries(agent.features || {}).filter(([, v]) => v).map(([k]) => k);
                                const colors: Record<string, string> = { image_generation: "#ff64c8", content_creation: "#ff8c00", shopify: "#22c55e", search: "#06b6d4", memory: "#a855f7", brand_enforcement: "#f59e0b", business_context: "#3b82f6", design_intelligence: "#e879f9", moderation: "#ef4444" };
                                const labels: Record<string, string> = { image_generation: "Images", content_creation: "OCA", shopify: "Shopify", search: "Search", memory: "Memory", brand_enforcement: "Brand", business_context: "Guide", design_intelligence: "Design", moderation: "Mod" };
                                return (
                                  <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p className="is-size-7 has-text-weight-black has-text-white" style={{ marginBottom: 4 }}>{agent.name}</p>
                                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {activeFeatures.slice(0, 4).map((f: string) => <PILL key={f} label={labels[f] ?? f} color={colors[f] ?? "#888"} />)}
                                        {activeFeatures.length > 4 && <span style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>+{activeFeatures.length - 4}</span>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                                {[{ label: "Content", val: contentAgents, color: "#ff8c00" }, { label: "Imaging", val: imageAgents, color: "#ff64c8" }, { label: "Shopify", val: shopifyAgents, color: "#22c55e" }].map(({ label, val, color }) => (
                                  <div key={label} style={{ textAlign: "center", padding: "0.6rem", borderRadius: 8, background: `${color}10`, border: `1px solid ${color}20` }}>
                                    <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>{val}</p>
                                    <p style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="column is-7">
                        <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                          <div className="is-flex is-justify-content-space-between is-align-items-center mb-5">
                            <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey" style={{ letterSpacing: "0.12em" }}>Recent Agent Activity</p>
                            <Activity size={14} className="has-text-info" style={{ animation: "pulse 2s infinite" }} />
                          </div>
                          <SynergyFeed items={activity.slice(0, 10)} />
                        </div>
                      </div>
                    </div>

                    {/* Revenue Breakdown */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Revenue Breakdown</p>
                      <div className="columns">
                        <div className="column is-4">
                          <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Revenue Vitality</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                              {[
                                { label: "30-Day Sales", val: `$${Number(shopify?.total30d || 0).toLocaleString()}`, color: "has-text-success" },
                                { label: "Today's Orders", val: `${shopify?.todayOrders || 0} @ $${shopify?.aov || "0.00"} AOV`, color: "has-text-info" },
                                { label: "AI Compute Cost", val: `-$${costData.total.toFixed(2)}`, color: "has-text-warning" },
                              ].map(({ label, val, color }) => (
                                <div key={label} className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">{label}</span>
                                  <span className={`has-text-weight-black ${color}`}>{val}</span>
                                </div>
                              ))}
                              <div className="is-flex is-justify-content-between is-align-items-center p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "12px" }}>
                                <span className="is-size-6 is-uppercase has-text-white has-text-weight-black">Today Net</span>
                                <span className="is-size-4 has-text-weight-black has-text-info">${Number(shopify?.todayRevenue || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="column is-4">
                          <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Forecast</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              <div>
                                <p className="heading has-text-grey mb-1" style={{ letterSpacing: "0.1em" }}>Projected Month-End</p>
                                <p className="title is-size-2 has-text-info mb-0">${Number(forecast?.estimatedMonthEnd || 0).toLocaleString()}</p>
                                <p className="is-size-7 has-text-grey italic">Based on linear run-rate</p>
                              </div>
                              <div>
                                <p className="heading has-text-grey mb-1" style={{ letterSpacing: "0.1em" }}>Compute Efficiency</p>
                                <p className="title is-size-2 has-text-success mb-0">{forecast?.efficiencyRatio || "0"}x</p>
                                <p className="is-size-7 has-text-grey italic">Revenue per $1 compute</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="column is-4">
                          <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                            <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Agency Summary</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              {[
                                { label: "Active Agents", val: agents.length, icon: Bot, color: "#ff8c00" },
                                { label: "Images Generated", val: imagesGenerated, icon: ImageIcon, color: "#ff64c8" },
                                { label: "OCA Executions", val: ocaRuns, icon: Sparkles, color: "#ff8c00" },
                                { label: "Research Queries", val: searchRuns, icon: Search, color: "var(--accent-cyan)" },
                              ].map(({ label, val, icon: Icon, color }) => (
                                <div key={label} className="is-flex is-justify-content-between is-align-items-center">
                                  <div className="is-flex is-align-items-center" style={{ gap: 8 }}>
                                    <Icon size={14} style={{ color }} />
                                    <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">{label}</span>
                                  </div>
                                  <span className="title is-size-4 mb-0 has-text-white">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════════════
                  BRAND
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "brand" && (
                <div>
                  <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Brand Guide</h3>
                  <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold mb-5" style={{ letterSpacing: "0.08em" }}>
                    Business context, voice, and brand identity
                  </p>
                  <BusinessContextEditor />
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ENGINE
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "engine" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

                  {/* Knowledge graph — was Neural Graph nav item */}
                  <div>
                    <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Knowledge Synapse</h3>
                    <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold mb-5" style={{ letterSpacing: "0.08em" }}>
                      Memory nodes &amp; intelligence fragments
                    </p>
                    <NeuralExplorer facts={facts} />
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

                  {/* Runtime health */}
                  <div className="columns is-multiline">
                    <div className="column is-6">
                      <div className="mb-4">
                        <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Orchestration Health</h3>
                        <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Compute Allocation</p>
                      </div>
                      <div className="box p-8">
                        <ProviderMatrix stats={[
                          { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                          { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                          { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" },
                        ]} />
                      </div>
                    </div>
                    <div className="column is-6">
                      <div className="mb-4">
                        <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Unit Vitals</h3>
                        <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Runtime Health</p>
                      </div>
                      <div className="columns is-multiline">
                        <div className="column is-6"><StatCard label="Memory RSS" value={health ? `${Math.round(health.memory.rss / 1024 / 1024)}mb` : "---"} color="var(--accent-cyan)" icon={Zap} /></div>
                        <div className="column is-6"><StatCard label="Heap Used" value={health ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}mb` : "---"} color="var(--accent-purple)" icon={Database} /></div>
                        <div className="column is-6"><StatCard label="Uptime" value={health ? `${Math.round(health.uptime / 60)}m` : "---"} color="var(--accent-emerald)" icon={Clock} /></div>
                        <div className="column is-6"><StatCard label="Latency" value="42ms" color="var(--accent-orange)" icon={Activity} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  SETTINGS
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === "settings" && (
                <div className="columns is-centered">
                  <div className="column is-8">
                    <div className="box p-6">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-5">Orchestration Logic</h3>
                      <ProviderMatrix stats={[
                        { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                        { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                        { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" },
                      ]} />
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="py-6 mt-2 has-text-centered has-text-grey-light is-size-7 is-uppercase has-text-weight-bold px-4" style={{ letterSpacing: "0.1em" }}>
          {APP_CONFIG.name} · Strategic Intelligence Asset &copy; {new Date().getFullYear()}
        </footer>
      </section>

      <style jsx global>{`
        .nav-link-trigger { cursor: pointer; }
      `}</style>
    </main>
  );
}
