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
  X
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
    <main className="app-container">
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="show-mobile fixed top-6 right-6 z-[110] w-12 h-12 rounded-xl bg-[var(--bg-darker)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent-orange)] shadow-2xl"
      >
        {isMobileMenuOpen ? <Menu size={24} className="rotate-90 transition-transform" /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-overlay show-mobile"
          />
        )}
      </AnimatePresence>

      <Sidebar
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id);
          setIsMobileMenuOpen(false);
        }}
        isOpen={isMobileMenuOpen}
      />

      {/* Content Wrapper */}
      <section className="ml-[280px] flex-1 h-screen overflow-y-auto custom-scrollbar relative p-10 flex flex-col gap-8 pb-32">

        {/* Page Header */}
        <header className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(255,140,0,0.1)] flex items-center justify-center text-[var(--accent-orange)] border border-[rgba(255,140,0,0.1)]">
                <currentTab.icon size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)]">
                {currentTab.label} Node
              </span>
            </div>
            <h1 className="page-title text-5xl font-black tracking-tighter">
              {activeTab === 'overview' ? 'Situation Room' : currentTab.label}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="glass-card flex items-center gap-4 px-6 py-4 border-[rgba(255,255,255,0.02)] animate-in fade-in slide-in-from-right duration-700">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Active Intelligence</span>
                <span className="text-xs font-black text-[var(--accent-emerald)] uppercase">
                  Stable Mode
                </span>
              </div>
              <ShieldAlert size={20} className="text-[var(--accent-emerald)]" />
            </div>
          </div>
        </header>

        {/* Tab Router Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.99, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col gap-8"
          >
            {/* ── Tab: Overview ── */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  label="Daily Revenue"
                  value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "$0"}
                  subValue="Direct Commerce Throughput"
                  color="var(--accent-emerald)"
                  trend="up"
                  icon={TrendingUp}
                />
                <StatCard
                  label="Neural Nodes"
                  value={facts.length}
                  subValue="Knowledge fragments"
                  color="var(--accent-orange)"
                  icon={Brain}
                />
                <StatCard
                  label="Compute (Cost)"
                  value={`$${costData.total.toFixed(4)}`}
                  subValue="Total Unit Utilization"
                  color="var(--accent-blue)"
                  icon={Cpu}
                />

                <div className="md:col-span-3 glass-card relative overflow-hidden group min-h-[160px] flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BrainCircuit size={160} />
                  </div>
                  <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(255,140,0,0.05)] flex items-center justify-center text-[var(--accent-orange)] border border-[rgba(255,140,0,0.2)]">
                      <BrainCircuit size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Strategic Recommendation</h3>
                      <p className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest">Neural Link Active</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black leading-tight text-[var(--text-primary)] tracking-tight relative z-10 max-w-4xl italic">
                    "{facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing live data streams... strategic pivot pending."}"
                  </p>
                </div>

                <div className="md:col-span-3 glass-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Live Operations Feed</h3>
                      <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Real-time Synergy Handshakes</p>
                    </div>
                    <Activity size={24} className="text-[var(--accent-cyan)] animate-pulse" />
                  </div>
                  <SynergyFeed items={activity.slice(0, 8)} />
                </div>
              </div>
            )}

            {/* ── Tab: War Room ── */}
            {activeTab === "war-room" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2 mb-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Active Agent Roster</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Unit Status & Current Task Allocation</p>
                  </div>
                  <AgentRoster />
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2 mb-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Coordination Pulse</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Cross-Unit Execution Log</p>
                  </div>
                  <div className="glass-card p-6 h-full">
                    <SynergyFeed items={activity.filter(a => a.action === 'synergy_handshake').slice(0, 5)} />
                    {activity.filter(a => a.action === 'synergy_handshake').length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center opacity-50 italic text-sm">
                        Waiting for synergy handshakes...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Neural Graph ── */}
            {activeTab === "neural-graph" && (
              <div className="flex flex-col gap-8">
                <header className="flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Knowledge Synapse Explorer</h3>
                  <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Global Memory Nodes & Extracted Intelligence</p>
                </header>
                <NeuralExplorer facts={facts} />
              </div>
            )}

            {/* ── Tab: Commerce ── */}
            {activeTab === "commerce" && (
              <div className="flex flex-col gap-10">
                <div className="flex flex-col gap-8">
                  <header className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Growth Mission Dashboard</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Strategic Milestones towards $1M ARR</p>
                  </header>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <GrowthTracker facts={facts} />
                    <MissionTracker />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <header className="flex flex-col gap-2">
                      <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Strategic Node Forecast</h3>
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Predictive Financial Modeling</p>
                    </header>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="glass-card p-6 border-[rgba(0,170,255,0.1)]">
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-2">Projected Month-End</div>
                        <div className="text-3xl font-black text-[var(--accent-blue)]">${Number(forecast?.estimatedMonthEnd || 0).toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-[var(--text-muted)] mt-2 uppercase tracking-tight">Based on linear run-rate</div>
                      </div>
                      <div className="glass-card p-6 border-[rgba(0,255,136,0.1)]">
                        <div className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-2">Compute Efficiency</div>
                        <div className="text-3xl font-black text-[var(--accent-emerald)]">{forecast?.efficiencyRatio || "0"}x</div>
                        <div className="text-[9px] font-bold text-[var(--text-muted)] mt-2 uppercase tracking-tight">Revenue per $1 compute spend</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-8">
                    <header className="flex flex-col gap-2">
                      <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Revenue Vitality</h3>
                      <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Financial Breakdown</p>
                    </header>
                    <div className="glass-card p-6">
                      <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                          <span className="text-xs font-bold text-[var(--text-dim)] uppercase">Gross Sales</span>
                          <span className="text-lg font-black text-[var(--accent-emerald)]">${Number(shopify?.financials?.gross_sales || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                          <span className="text-xs font-bold text-[var(--text-dim)] uppercase">Discounts</span>
                          <span className="text-lg font-black text-[var(--accent-rose)]">-${Number(shopify?.financials?.discounts || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                          <span className="text-xs font-bold text-[var(--text-dim)] uppercase">Returns</span>
                          <span className="text-lg font-black text-[var(--accent-rose)]">-${Number(shopify?.financials?.refunds || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                          <span className="text-sm font-black text-[var(--text-primary)] uppercase">Net Revenue</span>
                          <span className="text-2xl font-black text-[var(--accent-cyan)] shadow-[0_0_15px_var(--accent-cyan)] shadow-[0_0_15px_var(--accent-cyan)]">${Number(shopify?.todayRevenue || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Engine ── */}
            {activeTab === "engine" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-8">
                  <header className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Orchestration Health</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Provider Matrix & Compute Allocation</p>
                  </header>
                  <div className="glass-card p-8">
                    <ProviderMatrix stats={[
                      { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                      { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                      { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" }
                    ]} />
                  </div>
                </div>
                <div className="flex flex-col gap-8">
                  <header className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Unit Vitals</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Memory & Latency Overhead</p>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard label="Memory RSS" value={health ? `${Math.round(health.memory.rss / 1024 / 1024)}mb` : '---'} color="var(--accent-cyan)" />
                    <StatCard label="Heap Used" value={health ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}mb` : '---'} color="var(--accent-purple)" />
                    <StatCard label="Uptime" value={health ? `${Math.round(health.uptime / 60)}m` : '---'} color="var(--accent-emerald)" />
                    <StatCard label="Latency" value="42ms" color="var(--accent-orange)" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Settings ── */}
            {activeTab === "settings" && (
              <div className="flex flex-col gap-10 max-w-4xl">
                <section className="flex flex-col gap-6">
                  <header className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Unit Roster Manager</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Global Intelligence Configuration</p>
                  </header>
                  <RosterManager />
                </section>

                <section className="flex flex-col gap-6">
                  <header className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Orchestration Health</h3>
                    <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest">Model Distribution Vitals</p>
                  </header>
                  <div className="glass-card p-8">
                    <ProviderMatrix stats={[
                      { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                      { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                      { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" }
                    ]} />
                  </div>
                </section>
              </div>
            )}

            {/* ── Tab: Network (Placeholder) ── */}
            {activeTab === "network" && (
              <div className="flex-1 flex flex-col items-center justify-center glass-card border-dashed py-32">
                <Network size={48} className="text-[var(--text-dim)] mb-6 animate-spin-slow" />
                <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Neural Network Offline</h2>
                <p className="text-sm text-[var(--text-dim)] mt-4 font-bold uppercase tracking-widest">Graph visualization requires edge initialization.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
    </main >
  );
}
