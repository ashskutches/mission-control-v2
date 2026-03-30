"use client";
import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, RefreshCw, AlertTriangle, TrendingUp, Zap } from "lucide-react";

interface CostByAgent {
  agent_id: string;
  agent_name: string | null;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  alert_count: number;
}

interface CostAlert {
  id: string;
  agent_id: string;
  agent_name: string | null;
  action: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  task_id: string | null;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

export default function CostSummaryPanel() {
  const [agentCosts, setAgentCosts] = useState<CostByAgent[]>([]);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsd, setTotalUsd] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/costs/by-agent`),
        fetch(`${API_BASE}/admin/costs/alerts?limit=5`),
      ]);
      if (!agentsRes.ok && !alertsRes.ok) throw new Error("Failed to load cost data");

      const agents: CostByAgent[] = agentsRes.ok ? await agentsRes.json() : [];
      const alertsData: CostAlert[] = alertsRes.ok ? await alertsRes.json() : [];

      setAgentCosts(agents);
      setAlerts(alertsData);
      setTotalUsd(agents.reduce((sum, a) => sum + Number(a.total_cost_usd), 0));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "24px 0", color: "#475569", fontSize: 13 }}>
      Loading cost data…
    </div>
  );

  if (error) return (
    <div style={{ color: "#f43f5e", fontSize: 12, padding: "10px 14px", background: "rgba(244,63,94,0.08)", borderRadius: 8 }}>
      {error} — check <a href="/costs" style={{ color: "#22c55e" }}>Costs</a> tab for full report.
    </div>
  );

  return (
    <div>
      {/* Header stat */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{
          padding: "10px 20px", borderRadius: 10,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e", lineHeight: 1 }}>
            ${totalUsd.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontWeight: 600 }}>30-DAY SPEND</div>
        </div>
        {alerts.length > 0 && (
          <div style={{
            padding: "10px 20px", borderRadius: 10,
            background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)",
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f43f5e", lineHeight: 1 }}>
              {alerts.length}
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontWeight: 600 }}>RECENT ALERTS</div>
          </div>
        )}
        <button
          onClick={load}
          style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
            color: "#94a3b8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Per-agent breakdown */}
      {agentCosts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
            By Agent (30 days)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {agentCosts.slice(0, 8).map(a => {
              const pct = totalUsd > 0 ? (a.total_cost_usd / totalUsd) * 100 : 0;
              const isHigh = a.total_cost_usd > 2;
              return (
                <div key={a.agent_id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 8,
                  background: isHigh ? "rgba(244,63,94,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isHigh ? "rgba(244,63,94,0.15)" : "rgba(255,255,255,0.05)"}`,
                }}>
                  {isHigh && <Zap size={11} style={{ color: "#f43f5e", flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.agent_name ?? a.agent_id}
                  </span>
                  {/* Progress bar */}
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: isHigh ? "#f43f5e" : "#38bdf8" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: isHigh ? "#f43f5e" : "#94a3b8", flexShrink: 0, minWidth: 48, textAlign: "right" }}>
                    ${Number(a.total_cost_usd).toFixed(3)}
                  </span>
                  <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>
                    {a.total_calls} runs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
            Recent Alerts
          </div>
          {alerts.map(a => (
            <div key={a.id} style={{
              padding: "7px 10px", borderRadius: 8, marginBottom: 4,
              background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={11} style={{ color: "#f43f5e", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.agent_name ?? a.agent_id} — {a.action ?? "run"}
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{a.model} · {new Date(a.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#f43f5e", flexShrink: 0 }}>
                ${Number(a.cost_usd).toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      <a href="/costs" style={{
        display: "inline-block", marginTop: 12, fontSize: 11, color: "#38bdf8",
        textDecoration: "none", fontWeight: 700,
      }}>
        View full cost report →
      </a>
    </div>
  );
}
