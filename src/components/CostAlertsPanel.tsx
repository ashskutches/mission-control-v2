"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, X, RefreshCw, TrendingUp, Zap, DollarSign,
  BarChart3, Clock, ArrowUpRight, ChevronDown, ChevronUp,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";
const DEFAULT_THRESHOLD = 0.50;

interface CostAlert {
  id: number;
  agent_id: string | null;
  agent_name: string | null;
  action: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  task_id: string | null;
  created_at: string;
}

interface AgentCostStat {
  agentId: string;
  agentName: string;
  calls: number;
  costUsd: number;
  alerts: number;
}

interface CostStats {
  totalCalls: number;
  totalCostUsd: number;
  totalAlerts: number;
  agents: AgentCostStat[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const DISMISSED_KEY = "gc_dismissed_alerts_v2";
function loadDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed: { id: number; ts: number }[] = JSON.parse(raw);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(parsed.filter(e => e.ts > cutoff).map(e => e.id));
  } catch { return new Set(); }
}
function saveDismissed(ids: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].map(id => ({ id, ts: Date.now() }))));
  } catch {}
}

// ── Summary stat pill
function SummaryCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 150,
      background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`,
      borderTop: `2px solid ${color}`, borderRadius: 10, padding: "0.875rem 1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: "#475569", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ── Expanded alert row
function AlertRowFull({ alert, onDismiss, threshold }: {
  alert: CostAlert; onDismiss: (id: number) => void; threshold: number;
}) {
  const severity = alert.cost_usd > threshold * 4 ? "high" : alert.cost_usd > threshold * 2 ? "medium" : "low";
  const sevColor = severity === "high" ? "#f43f5e" : severity === "medium" ? "#f59e0b" : "#fb923c";
  const totalTokens = alert.input_tokens + alert.output_tokens;
  const inputPct = Math.round((alert.input_tokens / totalTokens) * 100);

  return (
    <div style={{
      background: `${sevColor}06`,
      border: `1px solid ${sevColor}20`,
      borderLeft: `3px solid ${sevColor}`,
      borderRadius: 10, padding: "0.75rem 1rem",
      display: "flex", alignItems: "flex-start", gap: "1rem",
    }}>
      {/* Severity dot */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${sevColor}15`, border: `1px solid ${sevColor}30`,
        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
      }}>
        <Zap size={13} style={{ color: sevColor }} />
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>
            {alert.agent_name ?? alert.agent_id ?? "Unknown agent"}
          </span>
          {alert.action && (
            <span style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 5, padding: "1px 7px", fontSize: 10, color: "#64748b",
            }}>
              {alert.action}
            </span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.06em",
            padding: "1px 7px", borderRadius: 10,
            background: `${sevColor}15`, color: sevColor,
          }}>
            {severity} cost
          </span>
          <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>{timeAgo(alert.created_at)}</span>
        </div>

        {/* Model tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>
            <span style={{ color: "#64748b", fontWeight: 600 }}>Model:</span> {alert.model}
          </span>
        </div>

        {/* Token breakdown bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#475569" }}>
              Input <span style={{ color: "#94a3b8", fontWeight: 600 }}>{formatTokens(alert.input_tokens)}</span>
            </span>
            <span style={{ fontSize: 10, color: "#475569" }}>
              Output <span style={{ color: "#94a3b8", fontWeight: 600 }}>{formatTokens(alert.output_tokens)}</span>
            </span>
            <span style={{ fontSize: 10, color: "#475569" }}>
              Total <span style={{ color: "#94a3b8", fontWeight: 600 }}>{formatTokens(totalTokens)}</span>
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ display: "flex", height: "100%" }}>
              <div style={{ width: `${inputPct}%`, background: "#38bdf8", borderRadius: "3px 0 0 3px" }} />
              <div style={{ flex: 1, background: "#a78bfa", borderRadius: "0 3px 3px 0" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
            <span style={{ fontSize: 9, color: "#38bdf8" }}>■ Input ({inputPct}%)</span>
            <span style={{ fontSize: 9, color: "#a78bfa" }}>■ Output ({100 - inputPct}%)</span>
          </div>
        </div>
      </div>

      {/* Cost + dismiss */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: sevColor, fontVariantNumeric: "tabular-nums" }}>
          ${alert.cost_usd.toFixed(3)}
        </span>
        <span style={{ fontSize: 9, color: "#475569" }}>
          {((alert.cost_usd / threshold) * 100).toFixed(0)}% of threshold
        </span>
        <button
          onClick={() => onDismiss(alert.id)}
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, cursor: "pointer", color: "#475569", display: "flex",
            alignItems: "center", justifyContent: "center", width: 24, height: 24,
          }}
          title="Dismiss"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Agent cost row in the per-agent breakdown
function AgentCostRow({ agent, max }: { agent: AgentCostStat; max: number }) {
  const ratio = agent.costUsd / Math.max(max, 0.001);
  const barColor = agent.costUsd > 20 ? "#f43f5e" : agent.costUsd > 5 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {agent.agentName === agent.agentId ? "Core Agent" : agent.agentName}
          </span>
          {agent.alerts > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#f43f5e", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>
              {agent.alerts} alert{agent.alerts !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>{agent.calls.toLocaleString()} calls</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: barColor, fontVariantNumeric: "tabular-nums", minWidth: 52, textAlign: "right" }}>
            ${agent.costUsd.toFixed(2)}
          </span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ width: `${ratio * 100}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: "#334155" }}>${(agent.costUsd / Math.max(agent.calls, 1)).toFixed(4)}/call avg</span>
        <span style={{ fontSize: 9, color: "#334155" }}>{Math.round(ratio * 100)}% of total</span>
      </div>
    </div>
  );
}

// ── Main export
export default function CostAlertsPanel() {
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return loadDismissed();
  });
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  const dismiss = (id: number) => {
    setDismissed(prev => { const n = new Set([...prev, id]); saveDismissed(n); return n; });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertRes, statsRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/cost-alerts?limit=50`),
        fetch(`${BOT_URL}/admin/cost-stats`),
      ]);
      if (alertRes.ok) setAlerts((await alertRes.json()).alerts ?? []);
      if (statsRes.ok) setStats(await statsRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 5 * 60 * 1000); return () => clearInterval(iv); }, [load]);

  const visible = alerts.filter(a => !dismissed.has(a.id) && a.cost_usd >= threshold);
  const allAbove = alerts.filter(a => a.cost_usd >= threshold);
  const highSeverity = allAbove.filter(a => a.cost_usd > threshold * 4).length;
  const maxAgentCost = Math.max(...(stats?.agents ?? []).map(a => a.costUsd), 0.001);
  const dailyAvg = stats ? stats.totalCostUsd / 30 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Section label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertTriangle size={14} color="#f43f5e" />
        </div>
        <div>
          <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13, margin: 0, lineHeight: 1 }}>Cost Alerts</p>
          <p style={{ fontSize: 10, color: "#475569", margin: 0, marginTop: 3 }}>LLM calls that exceeded your cost threshold — last 30 days</p>
        </div>
        <button onClick={load} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <RefreshCw size={11} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Summary cards */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <SummaryCard label="Total Spend (30d)" value={stats ? `$${stats.totalCostUsd.toFixed(2)}` : "—"} sub={`$${dailyAvg.toFixed(2)}/day average`} color="#22c55e" icon={DollarSign} />
        <SummaryCard label="Total Calls" value={stats?.totalCalls.toLocaleString() ?? "—"} sub={stats ? `avg $${(stats.totalCostUsd / Math.max(stats.totalCalls, 1)).toFixed(4)}/call` : undefined} color="#38bdf8" icon={BarChart3} />
        <SummaryCard label="Alerts Triggered" value={stats?.totalAlerts.toString() ?? "—"} sub={`>${threshold.toFixed(2)} threshold`} color={stats && stats.totalAlerts > 0 ? "#f43f5e" : "#64748b"} icon={AlertTriangle} />
        <SummaryCard label="High Severity" value={highSeverity.toString()} sub={`>${(threshold * 4).toFixed(2)} per call`} color={highSeverity > 0 ? "#f43f5e" : "#64748b"} icon={ArrowUpRight} />
      </div>

      {/* ── Threshold control + alerts list */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={13} color="#f43f5e" />
            <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 12, margin: 0 }}>
              Threshold Breaches
              {allAbove.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#f43f5e", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 10, padding: "1px 8px" }}>
                  {visible.length} active
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Threshold slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#475569" }}>Threshold:</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", minWidth: 36 }}>${threshold.toFixed(2)}</span>
              <input
                type="range" min={0.05} max={5} step={0.05}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                style={{ width: 80, accentColor: "#f59e0b" }}
              />
            </div>
            <button
              onClick={() => setAlertsCollapsed(c => !c)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
            >
              {alertsCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              {alertsCollapsed ? "Show" : "Collapse"}
            </button>
          </div>
        </div>

        {/* Alert list */}
        {!alertsCollapsed && (
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem", maxHeight: 520, overflowY: "auto" }} className="custom-scrollbar">
            {loading && visible.length === 0 && (
              <p style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "2rem" }}>Loading alerts…</p>
            )}
            {!loading && visible.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem 1rem", opacity: 0.5 }}>
                <AlertTriangle size={24} color="#22c55e" style={{ margin: "0 auto 0.5rem" }} />
                <p style={{ fontSize: 12, color: "#475569" }}>
                  No calls exceeded ${threshold.toFixed(2)}. {dismissed.size > 0 ? `(${dismissed.size} dismissed)` : "The system is running efficiently."}
                </p>
              </div>
            )}
            {visible.map(alert => (
              <AlertRowFull key={alert.id} alert={alert} onDismiss={dismiss} threshold={threshold} />
            ))}
            {dismissed.size > 0 && (
              <button
                onClick={() => { setDismissed(new Set()); saveDismissed(new Set()); }}
                style={{ fontSize: 10, color: "#334155", background: "none", border: "none", cursor: "pointer", alignSelf: "flex-end", marginTop: 4 }}
              >
                Restore {dismissed.size} dismissed →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Per-agent cost breakdown */}
      {stats && stats.agents.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
            <TrendingUp size={13} color="#f59e0b" />
            <p style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 12, margin: 0 }}>
              Per-Agent Breakdown
            </p>
            <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>30-day window</span>
          </div>
          <div>
            {stats.agents
              .slice()
              .sort((a, b) => b.costUsd - a.costUsd)
              .slice(0, 12)
              .map(agent => (
                <AgentCostRow key={agent.agentId} agent={agent} max={maxAgentCost} />
              ))}
          </div>
          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "#334155" }}>Color scale:&nbsp;</span>
            <span style={{ fontSize: 9, color: "#22c55e" }}>■ &lt;$5</span>
            <span style={{ fontSize: 9, color: "#f59e0b" }}>■ $5–$20</span>
            <span style={{ fontSize: 9, color: "#f43f5e" }}>■ &gt;$20</span>
          </div>
        </div>
      )}

    </div>
  );
}
