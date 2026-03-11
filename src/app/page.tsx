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
  Network,
  Settings,
  Zap,
  LayoutDashboard,
  Menu,
  X,
  Database
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
  const [costData, setCostData] = useState({ total: 0, rows: [] });
  const [health, setHealth] = useState<any>(null);
  const [shopify, setShopify] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Unified Data Orchestration
  useEffect(() => {
    const fetchData = async () => {
      const [actResp, factResp, costResp] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(40),
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
        const [healthR, shopifyR, forecastR] = await Promise.all([
          fetch(`${BOT_URL}/health`).then(r => r.json()),
          fetch(`${BOT_URL}/shopify`).then(r => r.json()),
          fetch(`${BOT_URL}/forecasting`).then(r => r.json())
        ]);
        setHealth(healthR);
        setShopify(shopifyR);
        setForecast(forecastR);
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
              {activeTab === "commerce" && (
                <div className="is-flex is-flex-direction-column" style={{ gap: '3rem' }}>
                  <div>
                    <div className="mb-6">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Growth Mission Dashboard</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Strategic Milestones towards $1M ARR</p>
                    </div>
                    <div className="columns is-multiline">
                      <div className="column is-6">
                        <GrowthTracker facts={facts} />
                      </div>
                      <div className="column is-6">
                        <MissionTracker />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-6">
                      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Strategic Node Forecast</h3>
                      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold tracking-widest">Predictive Financial Modeling</p>
                    </div>
                    <div className="columns">
                      <div className="column is-8">
                        <div className="columns is-multiline">
                          <div className="column is-6">
                            <div className="box p-6" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                              <p className="heading has-text-grey mb-2" style={{ letterSpacing: '0.1em' }}>Projected Month-End</p>
                              <p className="title is-size-2 has-text-info mb-1">${Number(forecast?.estimatedMonthEnd || 0).toLocaleString()}</p>
                              <p className="is-size-7 has-text-grey italic">Based on linear run-rate</p>
                            </div>
                          </div>
                          <div className="column is-6">
                            <div className="box p-6" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
                              <p className="heading has-text-grey mb-2" style={{ letterSpacing: '0.1em' }}>Compute Efficiency</p>
                              <p className="title is-size-2 has-text-success mb-1">{forecast?.efficiencyRatio || "0"}x</p>
                              <p className="is-size-7 has-text-grey italic">Revenue per $1 compute spend</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="column is-4">
                        <div className="box p-6">
                          <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Revenue Vitality</h4>
                          <div className="is-flex is-flex-direction-column" style={{ gap: '1.25rem' }}>
                            <div className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Gross Sales</span>
                              <span className="has-text-weight-black has-text-success">${Number(shopify?.financials?.gross_sales || 0).toLocaleString()}</span>
                            </div>
                            <div className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">Returns</span>
                              <span className="has-text-weight-black has-text-danger">-${Number(shopify?.financials?.refunds || 0).toLocaleString()}</span>
                            </div>
                            <div className="is-flex is-justify-content-between is-align-items-center p-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                              <span className="is-size-6 is-uppercase has-text-white has-text-weight-black">Net Rec</span>
                              <span className="is-size-4 has-text-weight-black has-text-info">${Number(shopify?.todayRevenue || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
