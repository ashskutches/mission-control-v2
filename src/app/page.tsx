"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Activity,
  TrendingUp,
  Brain,
  Cpu,
  ShieldAlert,
  BarChart3,
  Settings,
  Zap,
  LayoutDashboard,
  Database,
  Image as ImageIcon,
  FileText,
  Search,
  ShoppingBag,
  Bot,
  Sparkles,
} from "lucide-react";

// Components & Utils
import Sidebar from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import { NeuralExplorer } from "@/components/NeuralExplorer";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { AgentRoster } from "@/components/AgentRoster";
import { GrowthTracker } from "@/components/GrowthTracker";
import { RosterManager } from "@/components/RosterManager";
import { MissionTracker } from "@/components/MissionTracker";
import { AgentCRUD } from "@/components/AgentCRUD";
import { BusinessContextEditor } from "@/components/BusinessContextEditor";
import { TemplateLibrary } from "@/components/TemplateLibrary";
import { ProjectsDashboard } from "@/components/ProjectsDashboard";
import { cn } from "@/app/lib/utils";
import { APP_CONFIG } from "@/app/lib/AppConfig";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [costData, setCostData] = useState({ total: 0, rows: [] as any[] });
  const [health, setHealth] = useState<any>(null);
  const [shopify, setShopify] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Unified Data Orchestration
  useEffect(() => {
    const fetchData = async () => {
      const [actResp, factResp, costResp] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("bot_facts").select("*").order("updated_at", { ascending: false }),
        supabase.from("cost_log").select("*").order("created_at", { ascending: false })
      ]);

      if (actResp.data) setActivity(actResp.data);
      if (factResp.data) setFacts(factResp.data);
      if (costResp.data) {
        const total = costResp.data.reduce((acc, curr) => acc + (curr.cost_usd || 0), 0);
        setCostData({ total, rows: costResp.data as any });
      }

      try {
        const [healthR, shopifyR, forecastR, agentsR] = await Promise.all([
          fetch(`${BOT_URL}/health`).then(r => r.json()),
          fetch(`${BOT_URL}/shopify`).then(r => r.json()),
          fetch(`${BOT_URL}/forecasting`).then(r => r.json()),
          fetch(`${BOT_URL}/admin/agents`).then(r => r.json()),
        ]);
        setHealth(healthR);
        setShopify(shopifyR);
        setForecast(forecastR);
        setAgents(Array.isArray(agentsR) ? agentsR : []);
      } catch (e) {
        console.warn("⚠️ Bot API connection failed");
      }

      setLoading(false);
    };

    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, []);

  const currentTab = useMemo(() =>
    APP_CONFIG.navigation.find(n => n.id === activeTab) || APP_CONFIG.navigation[0],
    [activeTab]);

  return (
    <main className="app-wrapper">
      {/* Mobile backdrop — tap to close sidebar */}
      <div
        className={cn("sidebar-backdrop", isMobileMenuOpen && "is-active")}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id);
          setIsMobileMenuOpen(false);
        }}
        isOpen={isMobileMenuOpen}
      />


      <section className="main-content custom-scrollbar" style={{ overflowY: 'auto', height: '100vh', position: 'relative' }}>

        {/* Mobile Navbar (Bulma style) */}
        <nav className="navbar is-hidden-tablet is-black" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item has-text-weight-black has-text-white" onClick={() => setActiveTab("overview")}>
              GC COMMAND
            </a>
            <a
              role="button"
              className={cn("navbar-burger", isMobileMenuOpen && "is-active")}
              aria-label="menu"
              aria-expanded="false"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>
        </nav>

        {/* Hero Header */}
        <section className="hero is-black is-small mb-6">
          <div className="hero-body px-0">
            <div className="level is-mobile px-4">
              <div className="level-left">
                <div className="level-item">
                  <div>
                    <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.75rem' }}>
                      <div className="is-flex is-justify-content-center is-align-items-center"
                        style={{ width: '32px', height: '32px', background: 'rgba(255,140,0,0.1)', borderRadius: '8px', color: 'var(--accent-orange)' }}>
                        <currentTab.icon size={18} />
                      </div>
                      <p className="has-text-grey-light is-size-7 is-uppercase has-text-weight-black tracking-widest">
                        {currentTab.label} Node
                      </p>
                    </div>
                    <h1 className="title is-size-1 has-text-weight-black tracking-tight mb-0">
                      {activeTab === 'overview' ? 'Situation Room' : currentTab.label}
                    </h1>
                  </div>
                </div>
              </div>
              <div className="level-right is-hidden-mobile">
                <div className="level-item">
                  <div className="box py-3 px-5 is-flex is-align-items-center" style={{ gap: '1rem', background: 'rgba(255,255,255,0.02) !important' }}>
                    <div className="has-text-right">
                      <p className="is-size-7 has-text-weight-black has-text-grey is-uppercase tracking-widest" style={{ fontSize: '9px' }}>Active Intelligence</p>
                      <p className="is-size-7 has-text-weight-black has-text-success is-uppercase">Stable Mode</p>
                    </div>
                    <ShieldAlert size={20} className="has-text-success" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Content */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── Tab: Overview ── */}
              {activeTab === "overview" && (
                <div className="columns is-multiline">
                  <div className="column is-4">
                    <StatCard
                      label="Daily Revenue"
                      value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "$0"}
                      subValue="Direct Commerce Throughput"
                      color="var(--accent-emerald)"
                      trend="up"
                      icon={TrendingUp}
                    />
                  </div>
                  <div className="column is-4">
                    <StatCard
                      label="Neural Nodes"
                      value={facts.length}
                      subValue="Knowledge fragments"
                      color="var(--accent-orange)"
                      icon={Brain}
                    />
                  </div>
                  <div className="column is-4">
                    <StatCard
                      label="Compute (Cost)"
                      value={`$${costData.total.toFixed(4)}`}
                      subValue="Total Unit Utilization"
                      color="var(--accent-blue)"
                      icon={Cpu}
                    />
                  </div>

                  <div className="column is-12">
                    <div className="box p-6 is-relative overflow-hidden" style={{ minHeight: '180px' }}>
                      <div className="columns is-vcentered">
                        <div className="column is-narrow">
                          <div className="is-flex is-justify-content-center is-align-items-center"
                            style={{ width: '56px', height: '56px', background: 'rgba(255,140,0,0.05)', borderRadius: '16px', color: 'var(--accent-orange)', border: '1px solid rgba(255,140,0,0.1)' }}>
                            <BrainCircuit size={28} />
                          </div>
                        </div>
                        <div className="column">
                          <p className="is-size-7 has-text-weight-black has-text-grey-light is-uppercase tracking-widest mb-1">Strategic Recommendation</p>
                          <p className="is-size-4 has-text-weight-black has-text-white mb-0 italic" style={{ lineHeight: '1.2' }}>
                            "{facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing live data streams... strategic pivot pending."}"
                          </p>
                        </div>
                      </div>
                      <BrainCircuit size={120} className="is-absolute" style={{ right: '-20px', bottom: '-20px', opacity: 0.03, pointerEvents: 'none' }} />
                    </div>
                  </div>

                  <div className="column is-12">
                    <div className="box p-6">
                      <div className="level mb-6">
                        <div className="level-left">
                          <div>
                            <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1" style={{ letterSpacing: '-0.02em' }}>Live Operations Feed</h3>
                            <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Real-time Synergy Handshakes</p>
                          </div>
                        </div>
                        <div className="level-right">
                          <Activity size={24} className="has-text-info animate-pulse" />
                        </div>
                      </div>
                      <SynergyFeed items={activity.slice(0, 8)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: War Room ── */}
              {activeTab === "war-room" && (
                <div className="columns">
                  <div className="column is-6">
                    <div className="mb-5">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Active Agent Roster</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Unit Status & Current Allocation</p>
                    </div>
                    <AgentRoster facts={facts} />
                  </div>
                  <div className="column is-6">
                    <div className="mb-5">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Coordination Pulse</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Cross-Unit Execution Log</p>
                    </div>
                    <div className="box p-6" style={{ minHeight: '400px' }}>
                      <SynergyFeed items={activity.filter(a => a.action === 'synergy_handshake').slice(0, 5)} />
                      {activity.filter(a => a.action === 'synergy_handshake').length === 0 && (
                        <div className="is-flex is-justify-content-center is-align-items-center" style={{ height: '300px' }}>
                          <p className="has-text-grey italic is-size-6">Waiting for synergy handshakes...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Neural Graph ── */}
              {activeTab === "neural-graph" && (
                <div className="is-flex is-flex-direction-column" style={{ gap: '2rem' }}>
                  <div>
                    <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Knowledge Synapse Explorer</h3>
                    <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Memory Nodes & Intelligence</p>
                  </div>
                  <NeuralExplorer facts={facts} />
                </div>
              )}

              {/* ── Tab: Commerce ── */}
              {activeTab === "commerce" && (() => {
                // Derive agent-intelligence metrics from activity log
                const imagesGenerated = activity.filter(a =>
                  a.details?.toLowerCase().includes("image") ||
                  a.action?.toLowerCase().includes("image")
                ).length;
                const ocaRuns = activity.filter(a =>
                  a.action === "oca_run" || a.details?.toLowerCase().includes("content asset")
                ).length;
                const searchRuns = activity.filter(a =>
                  a.action === "web_search" || a.details?.toLowerCase().includes("web search")
                ).length;
                const totalInteractions = activity.length;

                // Agent feature breakdown
                const contentAgents = agents.filter(a => a.features?.content_creation).length;
                const imageAgents   = agents.filter(a => a.features?.image_generation).length;
                const shopifyAgents = agents.filter(a => a.features?.shopify).length;

                // Cost last 7 days
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const recentCost = (costData.rows as any[]).filter(r =>
                  new Date(r.created_at).getTime() > sevenDaysAgo
                ).reduce((s: number, r: any) => s + (r.cost_usd || 0), 0);

                const PILL = ({ label, color }: { label: string; color: string }) => (
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 20,
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", background: `${color}18`, color,
                    border: `1px solid ${color}40`,
                  }}>{label}</span>
                );

                return (
                  <div className="is-flex is-flex-direction-column" style={{ gap: "2.5rem" }}>

                    {/* ── Row 1: Revenue + AI Compute ── */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Revenue Intelligence</p>
                      <div className="columns is-multiline">
                        <div className="column is-3">
                          <StatCard label="Today's Revenue" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"} subValue={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading..."} color="var(--accent-emerald)" trend="up" icon={ShoppingBag} />
                        </div>
                        <div className="column is-3">
                          <StatCard label="30-Day Sales" value={shopify ? `$${Number(shopify.total30d || 0).toLocaleString()}` : "—"} subValue="Rolling 30-day gross" color="var(--accent-blue)" icon={TrendingUp} />
                        </div>
                        <div className="column is-3">
                          <StatCard label="Month-End Forecast" value={(() => { const v = forecast?.estimatedMonthEnd || (shopify?.total30d ? Math.round(Number(shopify.total30d) * (new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate() / new Date().getDate())) : 0); return `$${Number(v).toLocaleString()}`; })()} subValue={forecast?.estimatedMonthEnd ? "From revenue data" : "Estimated from 30d run-rate"} color="var(--accent-cyan)" icon={BarChart3} />
                        </div>
                        <div className="column is-3">
                          <StatCard label="AI Compute (7d)" value={`$${recentCost.toFixed(4)}`} subValue="Total agent spend" color="var(--accent-orange)" icon={Cpu} />
                        </div>
                      </div>
                    </div>

                    {/* ── Row 2: Content Pipeline ── */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Content Pipeline Activity</p>
                      <div className="columns is-multiline">
                        <div className="column is-3">
                          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,100,200,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <ImageIcon size={14} style={{ color: "#ff64c8" }} />
                              </div>
                              <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Images Generated</span>
                            </div>
                            <p className="title is-size-3 has-text-white mb-1">{imagesGenerated}</p>
                            <p className="is-size-7 has-text-grey">DALL-E 3 · Nano Banana 2 · Ideogram</p>
                          </div>
                        </div>
                        <div className="column is-3">
                          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,140,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Sparkles size={14} style={{ color: "var(--accent-orange)" }} />
                              </div>
                              <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>OCA Runs</span>
                            </div>
                            <p className="title is-size-3 has-text-white mb-1">{ocaRuns}</p>
                            <p className="is-size-7 has-text-grey">Content creation pipeline executions</p>
                          </div>
                        </div>
                        <div className="column is-3">
                          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,200,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Search size={14} style={{ color: "var(--accent-cyan)" }} />
                              </div>
                              <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Web Searches</span>
                            </div>
                            <p className="title is-size-3 has-text-white mb-1">{searchRuns}</p>
                            <p className="is-size-7 has-text-grey">Competitor & market research queries</p>
                          </div>
                        </div>
                        <div className="column is-3">
                          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,255,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Activity size={14} style={{ color: "var(--accent-emerald)" }} />
                              </div>
                              <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Total Agent Events</span>
                            </div>
                            <p className="title is-size-3 has-text-white mb-1">{totalInteractions}</p>
                            <p className="is-size-7 has-text-grey">All logged activity (last 100)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Row 3: Agent Capability Map + Recent Activity ── */}
                    <div className="columns">
                      <div className="column is-5">
                        <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                          <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-5" style={{ letterSpacing: "0.12em" }}>Agent Capability Map</p>
                          {agents.length === 0 ? (
                            <p className="has-text-grey is-size-7 italic">No agents deployed yet.</p>
                          ) : (
                            <div className="is-flex is-flex-direction-column" style={{ gap: "0.85rem" }}>
                              {agents.map((agent: any) => {
                                const activeFeatures = Object.entries(agent.features || {}).filter(([, v]) => v).map(([k]) => k);
                                return (
                                  <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p className="is-size-7 has-text-weight-black has-text-white" style={{ marginBottom: 4 }}>{agent.name}</p>
                                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {activeFeatures.slice(0, 4).map((f: string) => {
                                          const colors: Record<string, string> = {
                                            image_generation: "#ff64c8",
                                            content_creation: "#ff8c00",
                                            shopify: "#22c55e",
                                            search: "#06b6d4",
                                            memory: "#a855f7",
                                            brand_enforcement: "#f59e0b",
                                            business_context: "#3b82f6",
                                            design_intelligence: "#e879f9",
                                            moderation: "#ef4444",
                                          };
                                          const labels: Record<string, string> = {
                                            image_generation: "Images",
                                            content_creation: "OCA",
                                            shopify: "Shopify",
                                            search: "Search",
                                            memory: "Memory",
                                            brand_enforcement: "Brand",
                                            business_context: "Guide",
                                            design_intelligence: "Design",
                                            moderation: "Mod",
                                          };
                                          return <PILL key={f} label={labels[f] ?? f} color={colors[f] ?? "#888"} />;
                                        })}
                                        {activeFeatures.length > 4 && (
                                          <span style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>+{activeFeatures.length - 4}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Summary row */}
                              <div className="mt-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                {[
                                  { label: "Content", val: contentAgents, color: "#ff8c00", icon: FileText },
                                  { label: "Imaging", val: imageAgents, color: "#ff64c8", icon: ImageIcon },
                                  { label: "Shopify", val: shopifyAgents, color: "#22c55e", icon: ShoppingBag },
                                ].map(({ label, val, color, icon: Icon }) => (
                                  <div key={label} style={{ textAlign: "center", padding: "0.6rem", borderRadius: 8, background: `${color}10`, border: `1px solid ${color}20` }}>
                                    <Icon size={12} style={{ color, marginBottom: 4 }} />
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
                            <Activity size={14} className="has-text-info animate-pulse" />
                          </div>
                          <SynergyFeed items={activity.slice(0, 10)} />
                        </div>
                      </div>
                    </div>

                    {/* ── Row 4: Revenue Breakdown ── */}
                    <div>
                      <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Revenue Breakdown</p>
                      <div className="columns">
                        <div className="column is-4">
                          <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Revenue Vitality</h4>
                            <div className="is-flex is-flex-direction-column" style={{ gap: "1.25rem" }}>
                              <div className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">30-Day Sales</span>
                                <span className="has-text-weight-black has-text-success">${Number(shopify?.total30d || 0).toLocaleString()}</span>
                              </div>
                              <div className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Today's Orders</span>
                                <span className="has-text-weight-black has-text-info">{shopify?.todayOrders || 0} @ ${shopify?.aov || "0.00"} AOV</span>
                              </div>
                              <div className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">AI Compute Cost</span>
                                <span className="has-text-weight-black has-text-warning">-${costData.total.toFixed(4)}</span>
                              </div>
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
                            <div className="is-flex is-flex-direction-column" style={{ gap: "1rem" }}>
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
                            <div className="is-flex is-flex-direction-column" style={{ gap: "1rem" }}>
                              <div className="is-flex is-justify-content-between is-align-items-center">
                                <div className="is-flex is-align-items-center" style={{ gap: 8 }}><Bot size={14} style={{ color: "#ff8c00" }} /><span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Active Agents</span></div>
                                <span className="title is-size-4 mb-0 has-text-white">{agents.length}</span>
                              </div>
                              <div className="is-flex is-justify-content-between is-align-items-center">
                                <div className="is-flex is-align-items-center" style={{ gap: 8 }}><ImageIcon size={14} style={{ color: "#ff64c8" }} /><span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Images Generated</span></div>
                                <span className="title is-size-4 mb-0 has-text-white">{imagesGenerated}</span>
                              </div>
                              <div className="is-flex is-justify-content-between is-align-items-center">
                                <div className="is-flex is-align-items-center" style={{ gap: 8 }}><Sparkles size={14} style={{ color: "#ff8c00" }} /><span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">OCA Executions</span></div>
                                <span className="title is-size-4 mb-0 has-text-white">{ocaRuns}</span>
                              </div>
                              <div className="is-flex is-justify-content-between is-align-items-center">
                                <div className="is-flex is-align-items-center" style={{ gap: 8 }}><Search size={14} style={{ color: "var(--accent-cyan)" }} /><span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Research Queries</span></div>
                                <span className="title is-size-4 mb-0 has-text-white">{searchRuns}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}


              {/* ── Tab: Projects ── */}
              {activeTab === "projects" && (
                <ProjectsDashboard />
              )}

                            {/* ── Tab: Agents ── */}
              {activeTab === "agents" && (
                <div className="is-flex is-flex-direction-column" style={{ gap: '2rem' }}>
                  <AgentCRUD />
                </div>
              )}

              {/* ── Tab: Engine ── */}
              {activeTab === "engine" && (
                <div className="columns is-multiline">
                  <div className="column is-6">
                    <div className="mb-5">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Orchestration Health</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Compute Allocation</p>
                    </div>
                    <div className="box p-8">
                      <ProviderMatrix stats={[
                        { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                        { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                        { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" }
                      ]} />
                    </div>
                  </div>
                  <div className="column is-6">
                    <div className="mb-5">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Unit Vitals</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Overhead Lifecycle</p>
                    </div>
                    <div className="columns is-multiline">
                      <div className="column is-6">
                        <StatCard label="Memory RSS" value={health ? `${Math.round(health.memory.rss / 1024 / 1024)}mb` : '---'} color="var(--accent-cyan)" icon={Zap} />
                      </div>
                      <div className="column is-6">
                        <StatCard label="Heap Used" value={health ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}mb` : '---'} color="var(--accent-purple)" icon={Database} />
                      </div>
                      <div className="column is-6">
                        <StatCard label="Uptime" value={health ? `${Math.round(health.uptime / 60)}m` : '---'} color="var(--accent-emerald)" icon={TrendingUp} />
                      </div>
                      <div className="column is-6">
                        <StatCard label="Latency" value="42ms" color="var(--accent-orange)" icon={Activity} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Settings ── */}
              {activeTab === "settings" && (
                <div className="columns is-centered">
                  <div className="column is-8">
                    <div className="box p-6 mb-6">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-5">Unit Roster Manager</h3>
                      <RosterManager />
                    </div>
                    <div className="box p-6">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-5">Orchestration Logic</h3>
                      <ProviderMatrix stats={[
                        { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                        { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                        { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" }
                      ]} />
                    </div>
                  </div>
                </div>
              )}
              {/* ── Tab: Brand Guide (Business Context) ── */}
              {activeTab === "business-context" && (
                <BusinessContextEditor />
              )}

              {/* ── Tab: Template Library ── */}
              {activeTab === "template-library" && (
                <TemplateLibrary />
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="py-6 mt-6 has-text-centered has-text-grey-light is-size-7 is-uppercase has-text-weight-bold tracking-widest px-4">
          {APP_CONFIG.name} Commander &copy; {new Date().getFullYear()} · Strategic Intelligence Asset
        </footer>
      </section>

      {/* Navigation Intercept for page.tsx logic without Link component wrapper */}
      <style jsx global>{`
        .nav-link-trigger { cursor: pointer; }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </main>
  );
}
