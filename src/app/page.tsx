"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const NAV_ITEMS = [
  { icon: "⊞", label: "Overview", id: "overview" },
  { icon: "🛍️", label: "Commerce", id: "commerce" },
  { icon: "🧠", label: "Intelligence", id: "intelligence" },
  { icon: "⚡", label: "Activity", id: "activity" },
  { icon: "⚙", label: "Engine", id: "engine" },
];

function parseStock(raw: string) {
  return raw.split(", ").map((item) => {
    const m = item.match(/^(.*?):\s*(-?\d+)\s*left$/);
    return { name: m ? m[1] : item, qty: m ? parseInt(m[2]) : 0 };
  });
}

function Badge({ qty }: { qty: number }) {
  const color = qty < 0 ? "#ef4444" : qty === 0 ? "#f97316" : "#eab308";
  const bg = qty < 0 ? "#1a0000" : qty === 0 ? "#1a0a00" : "#1a1500";
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
      {qty}
    </span>
  );
}

// Mini bar chart for cost over time
function CostChart({ costRows }: { costRows: any[] }) {
  if (!costRows.length) return <div style={{ color: "#444", fontSize: 13 }}>No cost data yet</div>;

  // Group by day
  const byDay: Record<string, number> = {};
  for (const row of costRows) {
    const day = row.created_at?.slice(0, 10) ?? "unknown";
    byDay[day] = (byDay[day] ?? 0) + (row.cost_usd ?? 0);
  }
  const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const max = Math.max(...days.map(([, v]) => v), 0.0001);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
      {days.map(([day, val]) => (
        <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div
            title={`${day}: $${val.toFixed(4)}`}
            style={{
              width: "100%",
              height: Math.max(4, (val / max) * 52),
              background: "#f97316",
              borderRadius: 3,
              opacity: 0.8,
              cursor: "default",
            }}
          />
          <div style={{ fontSize: 8, color: "#444", whiteSpace: "nowrap" }}>
            {day.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [activity, setActivity] = useState<any[]>([]);
  const [costRows, setCostRows] = useState<any[]>([]);
  const [cost, setCost] = useState(0);
  const [shopify, setShopify] = useState<any>(null);
  const [shopifyErr, setShopifyErr] = useState(false);
  const [shopifyLoading, setShopifyLoading] = useState(true);
  const [filter, setFilter] = useState("critical");
  const [facts, setFacts] = useState<{ key: string; value: string }[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [healthErr, setHealthErr] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch(`${BOT_URL}/shopify`, { cache: "no-store" });
        const d = await r.json();
        setShopify(d);
        setShopifyErr(false);
      } catch {
        setShopifyErr(true);
      } finally {
        setShopifyLoading(false);
      }
    };
    go();
    const iv = setInterval(go, 60000);
    return () => clearInterval(iv);
  }, []);

  // Poll Bot Health
  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch(`${BOT_URL}/health`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = await r.json();
        setHealth(d);
        setHealthErr(false);
      } catch {
        setHealthErr(true);
      }
    };
    go();
    const iv = setInterval(go, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const go = async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setActivity(data);
    };
    go();
    const iv = setInterval(go, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    supabase
      .from("cost_log")
      .select("cost_usd, created_at")
      .order("created_at", { ascending: true })
      .then(({ data }: { data: any }) => {
        if (data) {
          setCostRows(data);
          setCost(data.reduce((s: number, r: any) => s + (r.cost_usd || 0), 0));
        }
      });
  }, []);

  // Poll bot_facts table for Second Brain
  useEffect(() => {
    const go = async () => {
      const { data } = await supabase
        .from("bot_facts")
        .select("key, value, updated_at")
        .order("updated_at", { ascending: false });
      if (data) setFacts(data as { key: string; value: string }[]);
    };
    go();
    const iv = setInterval(go, 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const fmt = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return `${Math.floor(d / 86400)}d ago`;
  };

  const ico = (a: string): string =>
    ({ discord_message: "💬", message: "✈️", memory_save: "🧠", tool_use: "🔧", voice_response: "🔊", proactive_briefing: "📩" } as any)[a] || "⚡";

  const stock = shopify?.lowStock ? parseStock(shopify.lowStock) : [];
  const filtered = stock.filter((s: any) =>
    filter === "critical" ? s.qty < 0 : filter === "out" ? s.qty === 0 : true
  );
  const crit = stock.filter((s: any) => s.qty < 0).length;
  const out = stock.filter((s: any) => s.qty === 0).length;

  const toolEvents = activity.filter((a) => a.action === "tool_use").slice(0, 10);

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">GC</div>
          <div>
            <div className="sidebar-title">Mission Control</div>
            <div className="sidebar-subtitle">v2.0 · Gravity Claw</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`nav-item ${tab === item.id ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "commerce" && crit > 0 && (
                <span style={{ marginLeft: "auto", background: "var(--brand-red)", color: "#fff", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{crit}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="agent-status">
            <div className={`status-dot ${healthErr ? "offline" : ""}`} style={{ background: healthErr ? "var(--brand-red)" : "var(--brand-green)", boxShadow: healthErr ? "0 0 10px var(--brand-red)" : "0 0 10px var(--brand-green)" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Agent {healthErr ? "Offline" : "Online"}</div>
              {health && !healthErr && (
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m · {Math.round(health.memory.rss / 1024 / 1024)}MB
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="fade-in">
            <header className="page-header">
              <h1 className="page-title">Command Overview</h1>
              <p className="page-subtitle">Real-time status of your Gravity Claw ecosystem</p>
            </header>

            <div className="grid-4 fade-in-1">
              {[
                { label: "Revenue Today", value: shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—", color: "#22c55e" },
                { label: "API Cost (Total)", value: `$${cost.toFixed(4)}`, color: "#f97316" },
                { label: "Memory Nodes", value: facts.length, color: "#3b82f6" },
                { label: "Status", value: healthErr ? "OFFLINE" : "ONLINE", color: healthErr ? "#ef4444" : "#10b981" },
              ].map((s: any) => (
                <div key={s.label} className="stat-card" style={{ "--accent-color": s.color } as any}>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginTop: 32 }}>
              {/* Mini Feed */}
              <div className="card fade-in-2">
                <div className="section-title">⚡ Live Briefing</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activity.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="activity-item" style={{ background: item.action === "proactive_briefing" ? "rgba(249, 115, 22, 0.05)" : "transparent" }}>
                      <div className="activity-icon">{ico(item.action)}</div>
                      <div className="activity-text">
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.details}</div>
                        <div className="activity-meta">{fmt(item.created_at)} · {item.action}</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setTab("activity")} style={{ marginTop: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "10px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>View Full Log</button>
                </div>
              </div>

              {/* Agent Quick Actions / Stats */}
              <div className="card fade-in-3">
                <div className="section-title">🤖 System Health</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>UPTIME</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{health ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : "—"}</div>
                  </div>
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>MEMORY UTILIZATION</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{health ? `${Math.round(health.memory.rss / 1024 / 1024)} MB` : "—"}</div>
                  </div>
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>CURRENT MODEL</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand-orange)" }}>Claude 3.5 Sonnet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Commerce ── */}
        {tab === "commerce" && (
          <div className="fade-in">
            <header className="page-header">
              <h1 className="page-title">Commerce Intelligence</h1>
              <p className="page-subtitle">Shopify sales performance and inventory tracking</p>
            </header>

            {shopifyErr && (
              <div className="card" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "var(--brand-red)" }}>
                <p style={{ color: "var(--brand-red)", fontWeight: 600 }}>⚠️ Connection lost — Ensure Gravity Claw agent is running.</p>
              </div>
            )}

            {shopify && (
              <>
                <div className="grid-3 fade-in-1">
                  {[
                    { label: "Gross Revenue", value: `$${Number(shopify.todayRevenue).toLocaleString()}`, color: "var(--brand-green)" },
                    { label: "Orders Today", value: String(shopify.orderCount), color: "var(--text-primary)" },
                    { label: "Order Avg", value: `$${shopify.aov}`, color: "var(--text-primary)" },
                  ].map((s: any) => (
                    <div key={s.label} className="stat-card" style={{ "--accent-color": s.color } as any}>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid-2 fade-in-2" style={{ marginTop: 24 }}>
                  <div className="card">
                    <div className="section-title">🏆 Top Selling Products</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {shopify.topProducts.split(", ").map((p: string, i: number) => {
                        const ci = p.lastIndexOf(": ");
                        const name = ci > -1 ? p.slice(0, ci) : p;
                        const units = ci > -1 ? p.slice(ci + 2) : "";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 18, width: 24 }}>{["🥇", "🥈", "🥉"][i] || "•"}</span>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }}>{name}</div>
                            <div style={{ color: "var(--brand-orange)", fontWeight: 700 }}>{units}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                      <div className="section-title" style={{ marginBottom: 0 }}>⚠️ Inventory Alerts</div>
                      <div style={{ display: "flex", background: "var(--bg-elevated)", padding: 4, borderRadius: 10 }}>
                        {["critical", "out", "all"].map((f) => (
                          <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "var(--bg-card)" : "transparent", border: "none", color: filter === f ? "#fff" : "var(--text-muted)", borderRadius: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            {f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
                      {filtered.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>All levels stable ✓</p> : filtered.map((item: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
                          <span style={{ fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                          <Badge qty={item.qty} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Intelligence ── */}
        {tab === "intelligence" && (
          <div className="fade-in">
            <header className="page-header">
              <h1 className="page-title">Neural Intelligence</h1>
              <p className="page-subtitle">Long-term semantic memory and personalized learning</p>
            </header>

            <div className="card fade-in-1">
              <div className="section-title">🧠 Known Facts & Learnings</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
                {facts.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Bot has not committed anything to memory yet.</p>
                ) : facts.map((f, i) => (
                  <div key={i} style={{ padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid var(--border)", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 11, color: "var(--brand-orange)", fontWeight: 700, marginBottom: 8, letterSpacing: "1px" }}>{f.key.toUpperCase()}</div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Activity (Logs) ── */}
        {tab === "activity" && (
          <div className="fade-in">
            <header className="page-header">
              <h1 className="page-title">Activity Logs</h1>
              <p className="page-subtitle">Granular event timeline across all channels</p>
            </header>

            <div className="card fade-in-1">
              <div className="section-title">🕒 Real-time Timeline</div>
              <div style={{ display: "grid", gap: 4 }}>
                {activity.map((item: any) => (
                  <div key={item.id} className="activity-item" style={{ borderBottom: "1px solid var(--border)", borderRadius: 0 }}>
                    <div className="activity-icon" style={{ background: item.action === "tool_use" ? "rgba(59, 130, 246, 0.1)" : "var(--bg-elevated)" }}>{ico(item.action)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="activity-text" style={{ fontWeight: 500 }}>{item.details}</div>
                      {item.metadata?.content && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, marginTop: 8, whiteSpace: "pre-wrap" }}>
                          {item.metadata.content}
                        </div>
                      )}
                      <div className="activity-meta" style={{ marginTop: 8 }}>{fmt(item.created_at)} · ACTION: {item.action.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Engine (Settings) ── */}
        {tab === "engine" && (
          <div className="fade-in">
            <header className="page-header">
              <h1 className="page-title">System Engine</h1>
              <p className="page-subtitle">Core configuration and infrastructure health</p>
            </header>

            <div className="grid-2 fade-in-1">
              <div className="card">
                <div className="section-title">💰 API Utilization Cost</div>
                <CostChart costRows={costRows} />
                <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>Total spend to date: <span style={{ color: "#fff", fontWeight: 700 }}>${cost.toFixed(4)}</span></div>
              </div>

              <div className="card">
                <div className="section-title">🔧 Recent Tool Orchestration</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {toolEvents.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 16, color: "var(--brand-orange)" }}>🔧</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.details}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(item.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card fade-in-2" style={{ marginTop: 24 }}>
              <div className="section-title">⚙ Global Configuration</div>
              <div className="grid-3">
                {[
                  { label: "AI Model", value: "Claude 3.5 Sonnet" },
                  { label: "Memory Type", value: "Hybrid (SQLite + Pinecone)" },
                  { label: "Channel Access", value: "Discord, Telegram, Alexa" },
                  { label: "Persistence", value: "Supabase PG" },
                  { label: "Infrastructure", value: "Docker (Cloud Arc)" },
                  { label: "Security", value: "Layer B (No-Shell Voice)" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
