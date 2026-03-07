"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const NAV_ITEMS = [
  { icon: "⊞", label: "Command Center", id: "command" },
  { icon: "🛍️", label: "Leaps & Rebounds", id: "store" },
  { icon: "🧠", label: "Second Brain", id: "brain" },
  { icon: "⚡", label: "Productivity", id: "productivity" },
  { icon: "✓", label: "Tasks", id: "tasks" },
  { icon: "▶", label: "Content Intel", id: "content" },
  { icon: "⋯", label: "Connections", id: "connections" },
  { icon: "⚙", label: "Settings", id: "settings" },
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
  const [tab, setTab] = useState("command");
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

  // Recent messages = activity_log filtered to "message" actions
  const messages = activity.filter((a) => a.action === "message").slice(0, 20);
  const toolEvents = activity.filter((a) => a.action === "tool_use").slice(0, 10);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "radial-gradient(circle at top right, #1a1a1a, #050505)",
      color: "#f5f5f5",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        background: "rgba(10, 10, 10, 0.8)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0
      }}>
        <div style={{ padding: "0 16px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#f97316", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>GC</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Mission Control</div>
            <div style={{ fontSize: 11, color: "#555" }}>v1.1 · Gravity Claw</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {NAV_ITEMS.map((item: any) => (
            <div
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, background: tab === item.id ? "#1e1e1e" : "transparent", color: tab === item.id ? "#fff" : "#666", cursor: "pointer", fontSize: 14 }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "store" && crit > 0 && (
                <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{crit}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: 16, borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(10px)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: healthErr ? "#ef4444" : "#22c55e", boxShadow: healthErr ? "0 0 8px #ef4444" : "0 0 8px #22c55e" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Agent {healthErr ? "Offline" : "Online"}</div>
            {health && !healthErr && (
              <div style={{ fontSize: 10, color: "#666" }}>
                Up: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m · {Math.round(health.memory.rss / 1024 / 1024)}MB
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>

        {/* ── Command Center ── */}
        {tab === "command" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Command Center</h1>
            <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>Real-time overview of your Gravity Claw agent</p>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Revenue Today", value: shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—", grad: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" },
                { label: "Orders", value: shopify ? String(shopify.orderCount) : "—", grad: "rgba(255,255,255,0.03)" },
                { label: "Avg Order", value: shopify ? `$${shopify.aov}` : "—", grad: "rgba(255,255,255,0.03)" },
                { label: "API Cost (Total)", value: `$${cost.toFixed(4)}`, grad: "rgba(255,255,255,0.03)" },
              ].map((s: any) => (
                <div key={s.label} style={{
                  background: s.grad.startsWith("linear") ? s.grad : "rgba(17, 17, 17, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)"
                }}>
                  <div style={{ fontSize: 11, color: s.grad.startsWith("linear") ? "rgba(255,255,255,0.8)" : "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, marginBottom: 24 }}>
              {/* Activity Feed */}
              <div style={{ background: "rgba(17, 17, 17, 0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: 16, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#f97316", marginBottom: 20, textTransform: "uppercase" }}>⚡ Live Activity Feed</div>
                <div style={{ maxHeight: 500, overflowY: "auto", paddingRight: 8 }}>
                  {activity.length === 0 ? (
                    <div style={{ color: "#444", fontSize: 14, textAlign: "center", padding: 40 }}>No activity yet...</div>
                  ) : activity.map((item: any) => (
                    <div key={item.id} style={{
                      display: "flex",
                      gap: 14,
                      padding: "16px",
                      borderRadius: 12,
                      background: item.action === "proactive_briefing" ? "rgba(249, 115, 22, 0.1)" : "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      marginBottom: 12,
                      cursor: "default"
                    }}>
                      <span style={{ fontSize: 20, marginTop: 2, flexShrink: 0, filter: "drop-shadow(0 0 8px rgba(249, 115, 22, 0.3))" }}>{ico(item.action)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "#fff", fontWeight: item.action === "proactive_briefing" ? 600 : 500, lineHeight: 1.4 }}>{item.details}</div>

                        {item.metadata?.publicUrl && (
                          <div style={{ marginTop: 12, background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: 8 }}>
                            <audio controls src={item.metadata.publicUrl} style={{ height: 32, width: "100%", maxWidth: 300 }} />
                          </div>
                        )}

                        {item.metadata?.content && (
                          <div style={{
                            fontSize: 13,
                            color: "#aaa",
                            marginTop: 10,
                            padding: 14,
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.05)",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.5
                          }}>
                            {item.metadata.content}
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                          <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>{item.action}</div>
                          <div style={{ fontSize: 11, color: "#444" }}>{fmt(item.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Config */}
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>🤖 Agent Config</div>
                {[
                  { label: "Model", value: "Claude Sonnet" },
                  { label: "Tool Loop", value: "✅ Active" },
                  { label: "Memory", value: "SQLite + Pinecone" },
                  { label: "Channels", value: "Discord + Telegram" },
                  { label: "Supabase", value: "Connected" },
                  { label: "API Cost", value: `$${cost.toFixed(4)}` },
                  { label: "Status", value: shopifyErr ? "🔴 Offline" : "🟢 Online" },
                ].map((r: any) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #1a1a1a", padding: "9px 0" }}>
                    <span style={{ color: "#555" }}>{r.label}</span>
                    <span style={{ color: "#ccc", fontWeight: 500 }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Chart + Recent Tool Calls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>💰 API Cost — Last 14 Days</div>
                <CostChart costRows={costRows} />
                <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>Hover bars for daily breakdown · Total: ${cost.toFixed(4)}</div>
              </div>
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>🔧 Recent Tool Calls</div>
                {toolEvents.length === 0
                  ? <div style={{ color: "#444", fontSize: 13 }}>No tool calls yet — send a message to get started</div>
                  : toolEvents.map((item: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
                      <span style={{ fontSize: 14, flexShrink: 0, color: "#f97316" }}>🔧</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.details}</div>
                        <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{fmt(item.created_at)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Leaps & Rebounds ── */}
        {tab === "store" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Leaps &amp; Rebounds</h1>
            <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>Live Shopify store data · refreshes every 60s</p>
            {shopifyLoading && <div style={{ color: "#555" }}>Loading...</div>}
            {shopifyErr && !shopifyLoading && (
              <div style={{ background: "#1a0000", border: "1px solid #ef444433", borderRadius: 10, padding: 20, color: "#ef4444" }}>
                ⚠️ Could not connect to bot — is Gravity Claw running locally?
              </div>
            )}
            {shopify && !shopifyErr && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                  {[
                    { label: "Revenue Today", value: `$${Number(shopify.todayRevenue).toLocaleString()}`, color: "#22c55e" },
                    { label: "Orders Today", value: String(shopify.orderCount), color: "#e5e5e5" },
                    { label: "Avg Order Value", value: `$${shopify.aov}`, color: "#e5e5e5" },
                  ].map((s: any) => (
                    <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 20 }}>
                      <div style={{ fontSize: 11, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>🏆 Top Products Today</div>
                    {shopify.topProducts.split(", ").map((p: string, i: number) => {
                      const ci = p.lastIndexOf(": ");
                      const name = ci > -1 ? p.slice(0, ci) : p;
                      const units = ci > -1 ? p.slice(ci + 2) : "";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a", marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][i] || "▪"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                          </div>
                          <span style={{ color: "#f97316", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{units}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", textTransform: "uppercase" }}>⚠️ Inventory Alerts</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["critical", "out", "all"].map((f: string) => (
                          <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "#1e1e1e" : "transparent", border: `1px solid ${filter === f ? "#333" : "#1e1e1e"}`, color: filter === f ? "#fff" : "#555", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>
                            {f === "critical" ? `Oversold (${crit})` : f === "out" ? `Out (${out})` : "All"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                      {filtered.length === 0
                        ? <div style={{ color: "#444", fontSize: 13 }}>No items ✓</div>
                        : filtered.map((item: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#0d0d0d", borderRadius: 6, gap: 10 }}>
                            <span style={{ fontSize: 12, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                            <Badge qty={item.qty} />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Second Brain ── */}
        {tab === "brain" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Second Brain</h1>
            <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>Core facts Gravity Claw has learned about you · updates as you chat</p>
            <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>🧠 Known Facts</div>
              {facts.length === 0 ? (
                <div style={{ color: "#444", fontSize: 14 }}>
                  No facts stored yet — tell Gravity Claw something about yourself and it will remember it here.
                  <br /><br />
                  <span style={{ color: "#333", fontFamily: "monospace", fontSize: 12 }}>Try: "My favorite trampoline park is Sky Zone" or "My goal this month is to hit $10K revenue"</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {facts.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
                      <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, minWidth: 140, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.key}</div>
                      <div style={{ fontSize: 13, color: "#ccc", flex: 1 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Coming Soon tabs ── */}
        {!["command", "store", "brain"].includes(tab) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 40 }}>{NAV_ITEMS.find((n: any) => n.id === tab)?.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#333" }}>{NAV_ITEMS.find((n: any) => n.id === tab)?.label}</div>
            <div style={{ fontSize: 14, color: "#444" }}>Coming soon</div>
          </div>
        )}

      </div>
    </div>
  );
}
