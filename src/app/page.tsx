"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShieldAlert,
  BrainCircuit,
  Zap,
  Settings,
  TrendingUp,
  ShoppingCart,
  Activity,
  Maximize2,
  Github
} from "lucide-react";

// Components
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import { NeuralExplorer } from "@/components/NeuralExplorer";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { SalesChart } from "@/components/SalesChart";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const NAVIGATION = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { id: "war-room", label: "War Room", icon: <ShieldAlert size={18} /> },
  { id: "neural", label: "Neural Graph", icon: <BrainCircuit size={18} /> },
  { id: "commerce", label: "Commerce", icon: <ShoppingCart size={18} /> },
  { id: "engine", label: "Engine", icon: <Settings size={18} /> },
];

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activity, setActivity] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [costData, setCostData] = useState({ total: 0, rows: [] });
  const [health, setHealth] = useState<any>(null);
  const [shopify, setShopify] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Unified Data Orchestration
  useEffect(() => {
    const fetchData = async () => {
      // Supabase Calls
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

      // Bot API Calls
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

  const synergyItems = activity.filter(a => ["dev_proposal", "synergy_handshake", "tool_use"].includes(a.action));

  return (
    <div className="app-container">
      <div className="bg-glow" />
      <div className="bg-glow-2" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "0 8px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, var(--accent-orange), #ff9a44)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "14px",
            color: "#000"
          }}>GC</div>
          <h2 style={{ fontSize: "16px", fontWeight: 700 }}>MISSION CONTROL</h2>
        </div>

        <nav className="nav-group">
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-link ${activeTab === item.id ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
              {item.id === "war-room" && activity.some(a => a.action === "dev_proposal") && (
                <div style={{ marginLeft: "auto", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-orange)", boxShadow: "0 0 10px var(--accent-orange)" }} />
              )}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div className="glass-card" style={{ padding: "16px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div className={`status-dot ${health?.status === "ok" ? "online" : "offline"}`}
                style={{ color: health?.status === "ok" ? "var(--accent-emerald)" : "var(--accent-rose)" }} />
              <span style={{ fontSize: "12px", fontWeight: 700 }}>Agent {health?.status === "ok" ? "Link Active" : "Link Lost"}</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              UPTIME: {health ? `${Math.floor(health.uptime / 3600)}H ${Math.floor((health.uptime % 3600) / 60)}M` : "—"}
            </div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: "100px" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="dashboard-grid"
          >
            {/* ── Tab: Overview ── */}
            {activeTab === "overview" && (
              <>
                <div style={{ gridColumn: "1 / -1", marginBottom: "12px" }}>
                  <h1 className="page-title">Situation Room</h1>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>Ecosystem intelligence node v3.0</p>
                </div>

                <StatCard
                  label="Daily Revenue"
                  value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "$0"}
                  subValue="Commerce throughput"
                  color="var(--accent-emerald)"
                  trend="up"
                />
                <StatCard
                  label="Neural Nodes"
                  value={facts.length}
                  subValue="Knowledge fragments"
                  color="var(--accent-orange)"
                />
                <StatCard
                  label="API Ops (Cost)"
                  value={`$${costData.total.toFixed(4)}`}
                  subValue="Compute utilization"
                  color="var(--accent-blue)"
                />

                {/* AI Insights Card */}
                <div className="glass-card" style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, rgba(255,154,68,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,154,68,0.2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(255,154,68,0.1)" }}>
                      <BrainCircuit size={20} color="var(--accent-orange)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 700 }}>AI Strategic Insight</h3>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Proactive business intelligence</p>
                    </div>
                  </div>
                  <p style={{ fontSize: "15px", lineHeight: "1.6", color: "rgba(255,255,255,0.9)", fontStyle: "italic" }}>
                    "{facts.find(f => f.key === "smart_recommendation")?.value || "Analyzing store trends... check back soon for your next strategic move."}"
                  </p>
                </div>

                <div className="glass-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}><Activity size={18} color="var(--accent-cyan)" /> Live Pulse</h3>
                    <button style={{ color: "var(--accent-blue)", fontSize: "12px", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>TIMELINE →</button>
                  </div>
                  <SynergyFeed items={activity.slice(0, 5)} />
                </div>
              </>
            )}

            {/* ── Tab: War Room ── */}
            {activeTab === "war-room" && (
              <>
                <div style={{ gridColumn: "1 / -1", marginBottom: "12px" }}>
                  <h1 className="page-title" style={{ background: "linear-gradient(135deg, #FF4B2B 0%, #FF416C 100%)", WebkitBackgroundClip: "text" }}>War Room</h1>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>Collaborative AI-to-AI development pipeline</p>
                </div>

                <div className="glass-card" style={{ gridColumn: "1 / 3" }}>
                  <h3 style={{ marginBottom: "20px" }}>Development Proposals</h3>
                  {activity.some(a => a.action === "dev_proposal") ? (
                    <SynergyFeed items={activity.filter(a => a.action === "dev_proposal")} />
                  ) : (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                      <Github size={40} style={{ opacity: 0.1, marginBottom: "16px" }} />
                      <p>No active code proposals in the queue.</p>
                    </div>
                  )}
                </div>

                <div className="glass-card">
                  <h3 style={{ marginBottom: "20px" }}>Synergy Status</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {[
                      { label: "Bridge Status", val: "ACTIVE", color: "var(--accent-emerald)" },
                      { label: "Latency", val: "42ms", color: "var(--accent-blue)" },
                      { label: "Sub-Agents", val: "DEVELOPER, MONITOR", color: "var(--accent-orange)" },
                      { label: "Sync Mode", val: "SUPABASE_RELAY", color: "var(--accent-cyan)" }
                    ].map(item => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{item.label}</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: item.color }}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Neural Graph ── */}
            {activeTab === "neural" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h1 className="page-title">Neural Graph</h1>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>Visualized persistent identity and cognitive nodes</p>
                </div>
                <NeuralExplorer facts={facts} />
              </div>
            )}

            {/* ── Tab: Commerce ── */}
            {activeTab === "commerce" && (
              <>
                <div style={{ gridColumn: "1 / -1", marginBottom: "12px" }}>
                  <h1 className="page-title">Commerce Intelligence</h1>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>Real-time Shopify synchronization</p>
                </div>

                {shopify && !shopify.error ? (
                  <>
                    <StatCard label="Revenue Today" value={`$${Number(shopify.todayRevenue || 0).toLocaleString()}`} subValue="Commerce throughput" color="var(--accent-emerald)" />
                    <StatCard label="Orders Today" value={shopify.todayOrders || "0"} subValue="Processing queue" />
                    <StatCard label="30-Day Revenue" value={`$${Number(shopify.total30d || 0).toLocaleString()}`} subValue="Monthly performance" color="var(--accent-orange)" />

                    {/* 30-Day Sales Chart */}
                    <SalesChart data={shopify.dailySales || []} total30d={shopify.total30d || 0} />

                    <StatCard label="AOV" value={`$${shopify.aov || "0.00"}`} subValue="Customer quality" color="var(--accent-purple)" />
                    <StatCard label="Total Products" value={shopify.totalProducts || "0"} subValue="Catalog size" color="var(--accent-cyan)" />

                    <div className="glass-card" style={{ gridColumn: "1 / -1" }}>
                      <h3>Product Catalog</h3>
                      <div style={{ marginTop: "20px" }}>
                        {(shopify.topProducts || "").split(", ").filter(Boolean).map((p: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 0", borderBottom: "1px solid var(--glass-border)" }}>
                            <div className="mono" style={{ color: "var(--accent-emerald)" }}>0{i + 1}</div>
                            <div style={{ fontWeight: 600 }}>{p}</div>
                            <div style={{ marginLeft: "auto" }}><TrendingUp size={16} color="var(--accent-emerald)" /></div>
                          </div>
                        ))}
                      </div>
                      {shopify.lastSync && (
                        <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
                          Last sync: {new Date(shopify.lastSync).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: "1 / -1", padding: "100px", textAlign: "center" }}>
                    <AnimatePresence>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                        <Zap size={40} color="var(--accent-orange)" />
                      </motion.div>
                    </AnimatePresence>
                    <p style={{ marginTop: "20px", color: "var(--text-muted)" }}>Connecting to Shopify Engine...</p>
                  </div>
                )}
              </>
            )}



            {/* ── Tab: Engine ── */}
            {activeTab === "engine" && (
              <>
                <div style={{ gridColumn: "1 / -1", marginBottom: "12px" }}>
                  <h1 className="page-title">System Engine</h1>
                  <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>Infrastructure, fallbacks, and provider matrix</p>
                </div>

                <div className="glass-card">
                  <h3 style={{ marginBottom: "24px" }}>LLM Provider Distribution</h3>
                  <ProviderMatrix
                    stats={[
                      { name: "Anthropic (Sonnet 3.5)", share: 85, health: "online", color: "var(--accent-emerald)" },
                      { name: "OpenAI (GPT-4o-mini)", share: 12, health: "online", color: "var(--accent-blue)" },
                      { name: "Gemini (Flash 2.0)", share: 3, health: "online", color: "var(--accent-orange)" },
                    ]}
                  />
                </div>

                <div className="glass-card">
                  <h3 style={{ marginBottom: "24px" }}>Environment Health</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[
                      { l: "Platform", v: health?.platform || "Linux" },
                      { l: "Runtime", v: "Node.js 20.x" },
                      { l: "Memory RSS", v: health ? `${Math.round(health.memory.rss / 1024 / 1024)}MB` : "—" },
                      { l: "Region", v: "Oregon (AWS)" }
                    ].map(i => (
                      <div key={i.l} style={{ padding: "12px", background: "var(--bg-elevated)", borderRadius: "10px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>{i.l}</div>
                        <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "4px" }}>{i.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Maximize2 size={24} color="var(--accent-blue)" />
                    <div>
                      <h3>Integrated MCP Servers</h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>Active connections for tool-extended reasoning</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                    {["Shopify", "GitHub", "Terminal", "Memory_SQLite", "Brave_Search"].map(s => (
                      <div key={s} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>{s}</div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
