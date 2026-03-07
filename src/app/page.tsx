"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "https://gravity-claw-production-fb9e.up.railway.app";

const NAV_ITEMS = [
  { icon: "⊞", label: "Command Center", id: "command" },
  { icon: "🛍️", label: "Leaps & Rebounds", id: "store" },
  { icon: "⚡", label: "Productivity", id: "productivity" },
  { icon: "✓", label: "Tasks", id: "tasks" },
  { icon: "▶", label: "Content Intel", id: "content" },
  { icon: "🧠", label: "Second Brain", id: "brain" },
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

export default function App() {
  const [tab, setTab] = useState("command");
  const [activity, setActivity] = useState<any[]>([]);
  const [cost, setCost] = useState(0);
  const [shopify, setShopify] = useState<any>(null);
  const [shopifyErr, setShopifyErr] = useState(false);
  const [shopifyLoading, setShopifyLoading] = useState(true);
  const [filter, setFilter] = useState("critical");

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

  useEffect(() => {
    const go = async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (data) setActivity(data);
    };
    go();
    const iv = setInterval(go, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    supabase.from("cost_log").select("cost_usd").then(({ data }: { data: any }) => {
      if (data) setCost(data.reduce((s: number, r: any) => s + (r.cost_usd || 0), 0));
    });
  }, []);

  const fmt = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
  };

  const ico = (a: string): string =>
    ({ discord_message: "⚡", telegram_message: "✈️", memory_save: "🧠", tool_use: "🔧" } as any)[a] || "💬";

  const stock = shopify?.lowStock ? parseStock(shopify.lowStock) : [];
  const filtered = stock.filter((s: any) =>
    filter === "critical" ? s.qty < 0 : filter === "out" ? s.qty === 0 : true
  );
  const crit = stock.filter((s: any) => s.qty < 0).length;
  const out = stock.filter((s: any) => s.qty === 0).length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui,sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 16px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#f97316", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>GC</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Mission Control</div>
            <div style={{ fontSize: 11, color: "#555" }}>v1.0 · Gravity Claw</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {NAV_ITEMS.map((item: any) => (
            <div key={item.id} onClick={() => setTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, background: tab === item.id ? "#1e1e1e" : "transparent", color: tab === item.id ? "#fff" : "#666", cursor: "pointer", fontSize: 14 }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "store" && crit > 0 && (
                <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{crit}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: 16, borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: shopifyErr ? "#ef4444" : "#22c55e" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Agent {shopifyErr ? "Offline" : "Online"}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Claude Sonnet · Railway</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>

        {tab === "command" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Command Center</h1>
            <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>Real-time overview of your Gravity Claw agent</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Revenue Today", value: shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—", color: "#22c55e" },
                { label: "Orders", value: shopify ? String(shopify.orderCount) : "—", color: "#e5e5e5" },
                { label: "Avg Order", value: shopify ? `$${shopify.aov}` : "—", color: "#e5e5e5" },
                { label: "API Cost", value: `$${cost.toFixed(4)}`, color: "#888" },
              ].map((s: any) => (
                <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>⚡ Live Activity Feed</div>
                {activity.length === 0 ? <div style={{ color: "#444", fontSize: 14 }}>No activity yet...</div> : activity.map((item: any) => (
                  <div key={item.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>{ico(item.action)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.details}</div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{item.action} · {fmt(item.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "#555", marginBottom: 16, textTransform: "uppercase" }}>🤖 Agent Config</div>
                {[
                  { label: "Model", value: "Claude Sonnet" },
                  { label: "Provider", value: "Anthropic" },
                  { label: "Memory", value: "SQLite" },
                  { label: "Channels", value: "Discord + Telegram" },
                  { label: "Tier 3 DB", value: "Supabase" },
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
          </div>
        )}

        {tab === "store" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Leaps &amp; Rebounds</h1>
            <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>Live Shopify store data · refreshes every 60s</p>
            {shopifyLoading && <div style={{ color: "#555" }}>Loading...</div>}
            {shopifyErr && !shopifyLoading && (
              <div style={{ background: "#1a0000", border: "1px solid #ef444433", borderRadius: 10, padding: 20, color: "#ef4444" }}>
                ⚠️ Could not connect to bot — is it running on Railway?
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

        {!["command", "store"].includes(tab) && (
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
