"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, TrendingUp, Brain, Cpu, ShieldAlert, Bot,
  Image as ImageIcon, CheckSquare, Target, ShoppingBag, DollarSign,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import CostAlerts from "@/components/CostAlerts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

function KpiCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ElementType }) {
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

export default function OverviewPage() {
  const [activity, setActivity] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [costData, setCostData] = useState({ total: 0 });
  const [costStats, setCostStats] = useState<any>(null);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const [shopify, setShopify] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState(0);
  const [monthProjects, setMonthProjects] = useState(0);
  const [tagStats, setTagStats] = useState<{ tagged: number; total: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [actR, factR, costR, todayR, monthR, imgR, vidR] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("bot_facts").select("*").order("updated_at", { ascending: false }),
        supabase.from("cost_log").select("cost_usd").gte("created_at", thirtyAgo),
        supabase.from("tasks").select("id", { count: "exact" }).gte("created_at", `${today}T00:00:00`).eq("status", "success"),
        supabase.from("projects").select("id", { count: "exact" }).gte("created_at", monthStart),
        supabase.from("image_library").select("id", { count: "exact" }),
        supabase.from("video_library").select("id", { count: "exact" }),
      ]);
      if (actR.data) setActivity(actR.data);
      if (factR.data) setFacts(factR.data);
      if (costR.data) setCostData({ total: costR.data.reduce((a, c) => a + (c.cost_usd || 0), 0) });
      setTodayTasks(todayR.count ?? 0);
      setMonthProjects(monthR.count ?? 0);
      const tagged = (imgR.count ?? 0) + (vidR.count ?? 0);
      if (tagged > 0) setTagStats({ tagged, total: 16123 });

      const fetchT = (url: string) => fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
      const [s, a, cs, m] = await Promise.all([
        fetchT(`${BOT_URL}/shopify`), fetchT(`${BOT_URL}/admin/agents`),
        fetchT(`${BOT_URL}/admin/cost-stats`), fetchT(`${BOT_URL}/admin/agent-metrics`),
      ]);
      if (s) setShopify(s);
      if (a) setAgents(Array.isArray(a) ? a : []);
      if (cs?.totalCostUsd !== undefined) setCostStats(cs);
      if (m?.roi) setAgentMetrics(m);
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const recommendation = facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing live data streams… strategic pivot pending.";

  return (
    <div className="px-4 pb-6 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Hero */}
      <section className="hero is-black is-small" style={{ margin: "-1rem -1rem 0" }}>
        <div className="hero-body px-4">
          <div className="level is-mobile">
            <div className="level-left">
              <div className="level-item">
                <div>
                  <p className="has-text-grey-light is-size-7 is-uppercase has-text-weight-black" style={{ letterSpacing: "0.1em" }}>Overview</p>
                  <h1 className="title is-size-1 has-text-weight-black mb-0">Situation Room</h1>
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

      {/* KPI Row */}
      <div>
        <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Key Metrics</p>
        <div className="columns is-multiline">
          <div className="column is-4"><KpiCard label="Daily Revenue" icon={ShoppingBag} color="var(--accent-emerald)" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"} sub={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading..."} /></div>
          <div className="column is-4"><KpiCard label="Active Agents" icon={Bot} color="var(--accent-orange)" value={agents.length} sub={`${agents.filter((a: any) => a.enabled !== false).length} enabled`} /></div>
          <div className="column is-4"><KpiCard label="LLM Spend (30d)" icon={Cpu} color="var(--accent-blue)" value={costStats ? `$${costStats.totalCostUsd.toFixed(2)}` : `$${costData.total.toFixed(2)}`} sub={costStats?.totalAlerts ? `${costStats.totalAlerts} high-cost alerts` : "AI compute cost"} /></div>
          <div className="column is-4"><KpiCard label="Value Generated (30d)" icon={TrendingUp} color="var(--accent-emerald)" value={agentMetrics ? `$${agentMetrics.roi.timeSavedValueUsd.toFixed(0)}` : "—"} sub={agentMetrics ? `${agentMetrics.roi.timeSavedHrs}h automated` : "Time saved × $25/hr"} /></div>
          <div className="column is-4"><KpiCard label="Tasks Completed Today" icon={CheckSquare} color="var(--accent-cyan)" value={todayTasks} sub="Successful agent runs" /></div>
          <div className="column is-4"><KpiCard label="Projects This Month" icon={Target} color="var(--accent-purple, #a855f7)" value={monthProjects} sub="Active projects" /></div>
          <div className="column is-4">
            <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
              <div className="is-flex is-align-items-center mb-3" style={{ gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ImageIcon size={16} style={{ color: "#a855f7" }} /></div>
                <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.09em" }}>Content Library</span>
              </div>
              <p className="title is-size-3 has-text-white mb-1" style={{ lineHeight: 1, color: "#a855f7" }}>{tagStats ? tagStats.tagged.toLocaleString() : "—"}</p>
              <p className="is-size-7 has-text-grey" style={{ fontSize: 11 }}>{tagStats ? `${Math.round((tagStats.tagged / tagStats.total) * 100)}% tagged · ${(tagStats.total - tagStats.tagged).toLocaleString()} remaining` : "No files tagged yet"}</p>
              {tagStats && <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.round((tagStats.tagged / tagStats.total) * 100))}%`, background: "linear-gradient(90deg, #a855f7, #7c3aed)", borderRadius: 2 }} /></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Cost Alerts */}
      <CostAlerts />

      {/* Live Feed */}
      <div className="box p-6">
        <div className="level mb-5">
          <div className="level-left"><div><h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Live Operations Feed</h3><p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold" style={{ letterSpacing: "0.08em" }}>Real-time agent activity</p></div></div>
          <div className="level-right"><Activity size={20} className="has-text-info" style={{ animation: "pulse 2s infinite" }} /></div>
        </div>
        <SynergyFeed items={activity.slice(0, 8)} />
      </div>

      {/* Strategic Recommendation */}
      <div className="box p-6 is-relative" style={{ overflow: "hidden" }}>
        <div className="columns is-vcentered">
          <div className="column is-narrow">
            <div className="is-flex is-justify-content-center is-align-items-center" style={{ width: "56px", height: "56px", background: "rgba(255,140,0,0.06)", borderRadius: "16px", color: "var(--accent-orange)", border: "1px solid rgba(255,140,0,0.12)" }}><Brain size={28} /></div>
          </div>
          <div className="column">
            <p className="is-size-7 has-text-weight-black has-text-grey-light is-uppercase mb-1" style={{ letterSpacing: "0.08em" }}>Strategic Recommendation</p>
            <p className="is-size-4 has-text-weight-black has-text-white mb-0 italic" style={{ lineHeight: "1.3" }}>"{recommendation}"</p>
          </div>
        </div>
        <Brain size={120} style={{ position: "absolute", right: "-20px", bottom: "-20px", opacity: 0.03, pointerEvents: "none" }} />
      </div>
    </div>
  );
}
