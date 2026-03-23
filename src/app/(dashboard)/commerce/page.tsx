"use client";
import React, { useState, useEffect } from "react";
import { StatCard } from "@/components/StatCard";
import { SynergyFeed } from "@/components/SynergyFeed";
import { TrendingUp, ShoppingBag, Image as ImageIcon, Sparkles, Search, Bot, BarChart3, Activity } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const PILL = ({ label, color }: { label: string; color: string }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", background: `${color}18`, color, border: `1px solid ${color}40` }}>{label}</span>
);

export default function CommercePage() {
  const [shopify, setShopify] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [costData, setCostData] = useState({ total: 0 });

  useEffect(() => {
    const go = async () => {
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: actData } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100);
      const { data: costRows } = await supabase.from("cost_log").select("cost_usd").gte("created_at", thirtyAgo);
      if (actData) setActivity(actData);
      if (costRows) setCostData({ total: costRows.reduce((a, c) => a + (c.cost_usd || 0), 0) });
      const fetchT = (url: string) => fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
      const [s, f, a] = await Promise.all([fetchT(`${BOT_URL}/shopify`), fetchT(`${BOT_URL}/forecasting`), fetchT(`${BOT_URL}/admin/agents`)]);
      if (s) setShopify(s);
      if (f) setForecast(f);
      if (a) setAgents(Array.isArray(a) ? a : []);
    };
    go();
  }, []);

  const imagesGenerated = activity.filter(a => a.details?.toLowerCase().includes("image") || a.action?.toLowerCase().includes("image")).length;
  const ocaRuns = activity.filter(a => a.action === "oca_run" || a.details?.toLowerCase().includes("content asset")).length;
  const searchRuns = activity.filter(a => a.action === "web_search" || a.details?.toLowerCase().includes("web search")).length;
  const contentAgents = agents.filter((a: any) => a.features?.content_creation).length;
  const imageAgents = agents.filter((a: any) => a.features?.image_generation).length;
  const shopifyAgents = agents.filter((a: any) => a.features?.shopify).length;

  const featureColors: Record<string, string> = { image_generation: "#ff64c8", content_creation: "#ff8c00", shopify: "#22c55e", search: "#06b6d4", memory: "#a855f7" };
  const featureLabels: Record<string, string> = { image_generation: "Images", content_creation: "OCA", shopify: "Shopify", search: "Search", memory: "Memory" };

  return (
    <div className="px-4 pb-6 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

      {/* Revenue Intelligence */}
      <div>
        <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Revenue Intelligence</p>
        <div className="columns is-multiline">
          <div className="column is-4"><StatCard label="Today's Revenue" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"} subValue={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading…"} color="var(--accent-emerald)" trend="up" icon={ShoppingBag} /></div>
          <div className="column is-4"><StatCard label="30-Day Sales" value={shopify ? `$${Number(shopify.total30d || 0).toLocaleString()}` : "—"} subValue="Rolling 30-day gross" color="var(--accent-blue)" icon={TrendingUp} /></div>
          <div className="column is-4"><StatCard label="Month-End Forecast" value={forecast?.estimatedMonthEnd ? `$${Number(forecast.estimatedMonthEnd).toLocaleString()}` : "—"} subValue="Projected from MTD pace" color="var(--accent-cyan)" icon={BarChart3} /></div>
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
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} style={{ color }} /></div>
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
            {agents.length === 0 ? <p className="has-text-grey is-size-7 italic">No agents deployed yet.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {agents.map((agent: any) => {
                  const activeFeatures = Object.entries(agent.features || {}).filter(([, v]) => v).map(([k]) => k);
                  return (
                    <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="is-size-7 has-text-weight-black has-text-white" style={{ marginBottom: 4 }}>{agent.name}</p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                          {activeFeatures.slice(0, 4).map((f: string) => <PILL key={f} label={featureLabels[f] ?? f} color={featureColors[f] ?? "#888"} />)}
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
              <Activity size={14} className="has-text-info" />
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
                {[{ label: "30-Day Sales", val: `$${Number(shopify?.total30d || 0).toLocaleString()}`, color: "has-text-success" }, { label: "Today's Orders", val: `${shopify?.todayOrders || 0} @ $${shopify?.aov || "0.00"} AOV`, color: "has-text-info" }, { label: "AI Cost (30d)", val: `-$${costData.total.toFixed(2)}`, color: "has-text-warning" }].map(({ label, val, color }) => (
                  <div key={label} className="is-flex is-justify-content-between is-align-items-center pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">{label}</span>
                    <span className={`has-text-weight-black ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="column is-4">
            <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Forecast</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div><p className="heading has-text-grey mb-1">Projected Month-End</p><p className="title is-size-2 has-text-info mb-0">${Number(forecast?.estimatedMonthEnd || 0).toLocaleString()}</p></div>
                <div><p className="heading has-text-grey mb-1">Compute Efficiency</p><p className="title is-size-2 has-text-success mb-0">{forecast?.efficiencyRatio || "0"}x</p></div>
              </div>
            </div>
          </div>
          <div className="column is-4">
            <div className="box p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
              <h4 className="title is-size-5 is-uppercase mb-5 has-text-weight-black">Agency Summary</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[{ label: "Active Agents", val: agents.length, icon: Bot, color: "#ff8c00" }, { label: "Images Generated", val: imagesGenerated, icon: ImageIcon, color: "#ff64c8" }, { label: "OCA Executions", val: ocaRuns, icon: Sparkles, color: "#ff8c00" }, { label: "Research Queries", val: searchRuns, icon: Search, color: "var(--accent-cyan)" }].map(({ label, val, icon: Icon, color }) => (
                  <div key={label} className="is-flex is-justify-content-between is-align-items-center">
                    <div className="is-flex is-align-items-center" style={{ gap: 8 }}><Icon size={14} style={{ color }} /><span className="is-size-7 is-uppercase has-text-grey-light has-text-weight-bold">{label}</span></div>
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
}
