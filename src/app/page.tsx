"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "https://gravity-claw-production.up.railway.app";

type Activity = {
  id: number;
  action: string;
  details: string;
  status: string;
  created_at: string;
};

type CostLog = {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
};

type ShopifyData = {
  todayRevenue: string;
  orderCount: number;
  aov: string;
  topProducts: string;
  lowStock: string;
};

export default function CommandCenter() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [shopify, setShopify] = useState<ShopifyData | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    fetchStats();
    fetchShopify();
    const channel = supabase
      .channel("activity-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        setActivity((prev) => [payload.new as Activity, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchActivity() {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setActivity(data);
  }

  async function fetchStats() {
    const { data: costs } = await supabase.from("cost_log").select("cost_usd, input_tokens, output_tokens");
    if (costs) {
      const total = costs.reduce((sum: number, c: CostLog) => sum + (c.cost_usd || 0), 0);
      setTotalCost(total);
    }
    const { count } = await supabase.from("activity_log").select("*", { count: "exact", head: true }).eq("action", "message");
    if (count !== null) setTotalMessages(count);
  }

  async function fetchShopify() {
    try {
      const res = await fetch(`${BOT_URL}/shopify`);
      if (res.ok) {
        const data = await res.json();
        setShopify(data);
      }
    } catch (e) {
      console.error("Shopify fetch failed", e);
    } finally {
      setShopifyLoading(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Command Center</h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>Real-time overview of your Gravity Claw agent</p>
      </div>

      {/* Store Metrics */}
      <div className="card fade-in" style={{ marginBottom: 24 }}>
        <div className="section-title">🛍️ Leaps & Rebounds — Today</div>
        {shopifyLoading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading store data...</div>
        ) : shopify ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 12 }}>
            {[
              { label: "Revenue", value: `$${shopify.todayRevenue}`, color: "var(--brand-green)" },
              { label: "Orders", value: String(shopify.orderCount), color: "var(--text-primary)" },
              { label: "Avg Order", value: `$${shopify.aov}`, color: "var(--text-primary)" },
            ].map((m) => (
              <div key={m.label} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.value}</div>
              </div>
            ))}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "14px 16px", gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Top Products</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{shopify.topProducts}</div>
            </div>
            {shopify.lowStock !== "None" && (
              <div style={{ background: "rgba(239,68,68,0.1)", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(239,68,68,0.3)", gridColumn: "span 2" }}>
                <div style={{ fontSize: 11, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>⚠️ Low Stock</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{shopify.lowStock}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Could not connect to bot — is it running?</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* Live Activity Feed */}
        <div className="card fade-in fade-in-2">
          <div className="section-title">⚡ LIVE ACTIVITY FEED</div>
          {activity.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 18 }}>{item.action === "discord_message" ? "⚡" : "💬"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.details}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.action} · {timeAgo(item.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Agent Config */}
          <div className="card fade-in fade-in-3">
            <div className="section-title">🤖 Agent Configuration</div>
            {[
              { label: "Model", value: "Claude Sonnet 4" },
              { label: "Provider", value: "Anthropic" },
              { label: "Memory", value: "SQLite + Pinecone" },
              { label: "Channel", value: "Telegram" },
              { label: "Tier 3 DB", value: "Supabase" },
              { label: "Status", value: "● Online" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{r.label}</span>
                <span style={{ color: r.label === "Status" ? "var(--brand-green)" : "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
            }
