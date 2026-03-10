"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  BrainCircuit,
  LayoutDashboard,
  Network,
  Settings,
  ShieldAlert,
  Zap,
  Activity,
  TrendingUp,
  Box,
  Brain,
  Cpu
} from "lucide-react";

// Components & Utils
import Sidebar from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import { NeuralExplorer } from "@/components/NeuralExplorer";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { SalesChart } from "@/components/SalesChart";
import { cn } from "@/app/lib/utils";
import { APP_CONFIG } from "@/app/lib/AppConfig";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activity, setActivity] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [costData, setCostData] = useState({ total: 0, rows: [] });
  const [health, setHealth] = useState<any>(null);
  const [shopify, setShopify] = useState<any>(null);
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
        const [healthR, shopifyR] = await Promise.all([
          fetch(`${BOT_URL}/health`).then(r => r.json()),
          fetch(`${BOT_URL}/shopify`).then(r => r.json())
        ]);
        setHealth(healthR);
        setShopify(shopifyR);
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
      {/* Dynamic Background */}
      <div className="bg-glow absolute top-[-10%] right-[-10%] opacity-40 animate-pulse" />
      <div className="bg-glow-2 absolute bottom-[-10%] left-[20%] opacity-20" />

      <Sidebar />

      {/* Content Wrapper */}
      <section className="ml-[280px] flex-1 h-screen overflow-y-auto custom-scrollbar relative p-10 flex flex-col gap-8">

        {/* Page Header */}
        <header className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(255,140,0,0.1)] flex items-center justify-center text-[var(--accent-orange)]">
                <currentTab.icon size={18} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {currentTab.label} Node
              </span>
            </div>
            <h1 className="page-title text-4xl font-extrabold tracking-tight">
              {currentTab.id === 'overview' ? 'Situation Room' : currentTab.label}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="glass-card flex items-center gap-4 px-6 py-3 border-[rgba(255,255,255,0.03)]">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">System Pulse</span>
                <span className="text-xs font-mono font-bold text-[var(--accent-cyan)] uppercase">
                  {health ? `${Math.round(health.memory.rss / 1024 / 1024)}mb` : '---'}
                </span>
              </div>
              <Activity size={20} className="text-[var(--accent-cyan)]" />
            </div>
          </div>
        </header>

        {/* Tab Router Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col gap-8"
          >
            {/* ── Tab: Overview ── */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  label="Daily Revenue"
                  value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "$0"}
                  subValue="Commerce throughput"
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
                  label="API Ops (Cost)"
                  value={`$${costData.total.toFixed(4)}`}
                  subValue="Compute utilization"
                  color="var(--accent-blue)"
                  icon={Cpu}
                />

                <div className="md:col-span-3 glass-card relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BrainCircuit size={120} />
                  </div>
                  <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(255,140,0,0.1)] flex items-center justify-center text-[var(--accent-orange)] border border-[rgba(255,140,0,0.2)]">
                      <BrainCircuit size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">Strategic Intelligence</h3>
                      <p className="text-xs text-[var(--text-muted)] font-medium">Proactive Unit Observation</p>
                    </div>
                  </div>
                  <p className="text-xl font-medium leading-relaxed text-[var(--text-primary)] italic relative z-10 pr-20">
                    "{facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing store trends... check back soon for your next strategic move."}"
                  </p>
                </div>

                <div className="md:col-span-3 glass-card">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Activity size={18} className="text-[var(--accent-cyan)]" />
                      <h3 className="font-bold text-[var(--text-primary)]">Live Operations Pulse</h3>
                    </div>
                    <button className="text-[10px] font-bold text-[var(--accent-blue)] border-b border-[var(--accent-blue)] transition-all hover:opacity-70">
                      OPEN TIMELINE
                    </button>
                  </div>
                  <SynergyFeed items={activity.slice(0, 6)} />
                </div>
              </div>
            )}

            {/* Placeholder for other tabs - To be implemented in next step */}
            {activeTab !== "overview" && (
              <div className="flex-1 flex flex-col items-center justify-center glass-card border-dashed">
                <Box size={40} className="text-[var(--text-dim)] mb-4 animate-bounce" />
                <h2 className="text-xl font-bold text-[var(--text-secondary)]">V3 Module Initializing</h2>
                <p className="text-sm text-[var(--text-muted)] mt-2 italic">Building the future of Mission Control...</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Navigation Intercept for page.tsx logic without Link component wrapper */}
      <style jsx global>{`
        .nav-link-trigger { cursor: pointer; }
      `}</style>
    </main>
  );
}
