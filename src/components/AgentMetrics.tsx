"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Zap, CheckCircle, XCircle,
  Clock, DollarSign, BarChart3, Bot, RefreshCw, Award, AlertTriangle,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface AgentStat {
  agentId: string; agentName: string;
  runs7d: number; runs30d: number; successRate: number;
  avgDurationMs: number; totalToolCalls: number; costUsd: number;
}

interface ExpensiveRoutine {
  label: string; agentName: string; totalCost: number; calls: number;
}

interface ROI {
  totalTasksSuccess: number; totalTasksError: number;
  timeSavedHrs: number; timeSavedValueUsd: number;
  totalComputeCostUsd: number; netRoiUsd: number;
  hourlyRateUsed: number; periodDays: number;
}

interface RoutineHealth {
  total: number; enabled: number; successLast: number;
  errorLast: number; highResource: number;
}

interface MetricsData {
  agents: AgentStat[];
  expensiveRoutines: ExpensiveRoutine[];
  routineHealth: RoutineHealth;
  roi: ROI;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${(ms/60000).toFixed(1)}m`;
}

function StatPill({ label, value, color = "#888" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function AgentMetrics() {
  const [data, setData]     = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${BOT_URL}/admin/agent-metrics`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="has-text-grey is-size-7 py-4" style={{ textAlign: "center" }}>Loading agent metrics…</div>
  );
  if (error || !data) return (
    <div className="has-text-grey is-size-7 py-4" style={{ textAlign: "center" }}>Could not load metrics.</div>
  );

  const { agents, expensiveRoutines, routineHealth, roi } = data;
  const maxCost = Math.max(...agents.map(a => a.costUsd), 0.001);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Section header ── */}
      <div className="is-flex is-justify-content-space-between is-align-items-center">
        <div>
          <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey" style={{ letterSpacing: "0.12em" }}>
            Agent Intelligence
          </p>
          <h3 className="title is-size-4 has-text-weight-black mb-0">Metrics & ROI</h3>
        </div>
        <button onClick={load} className="button is-ghost is-small" style={{ color: "#555" }} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Row 1: ROI headline cards ── */}
      <div className="columns is-multiline">
        {[
          {
            label: "Time Saved (30d)",
            value: `${roi.timeSavedHrs}h`,
            sub: `≈ $${roi.timeSavedValueUsd.toFixed(0)} @ $${roi.hourlyRateUsed}/hr`,
            color: "var(--accent-emerald)", icon: Clock,
            tip: "Total agent task duration (successful runs only)"
          },
          {
            label: "Compute Cost (30d)",
            value: `$${roi.totalComputeCostUsd.toFixed(2)}`,
            sub: `${(roi.totalComputeCostUsd / 30).toFixed(2)}/day avg`,
            color: "var(--accent-orange)", icon: DollarSign,
            tip: "LLM API spend tracked in cost_log"
          },
          {
            label: "Net ROI (30d)",
            value: roi.netRoiUsd >= 0 ? `+$${roi.netRoiUsd.toFixed(0)}` : `-$${Math.abs(roi.netRoiUsd).toFixed(0)}`,
            sub: roi.netRoiUsd >= 0 ? "Value > cost" : "Cost > time saved est.",
            color: roi.netRoiUsd >= 0 ? "var(--accent-emerald)" : "#ff9f0a", icon: roi.netRoiUsd >= 0 ? TrendingUp : TrendingDown,
            tip: "Time saved value minus compute cost"
          },
          {
            label: "Task Success Rate",
            value: `${Math.round((roi.totalTasksSuccess / Math.max(roi.totalTasksSuccess + roi.totalTasksError, 1)) * 100)}%`,
            sub: `${roi.totalTasksSuccess} ok · ${roi.totalTasksError} errors`,
            color: "var(--accent-blue)", icon: CheckCircle,
            tip: "30-day task completion rate across all agents"
          },
        ].map(({ label, value, sub, color, icon: Icon, tip }) => (
          <div key={label} className="column is-3" title={tip}>
            <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
              <div className="is-flex is-align-items-center mb-3" style={{ gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="is-size-7 has-text-grey-light has-text-weight-black is-uppercase" style={{ fontSize: 10, letterSpacing: "0.08em" }}>{label}</span>
              </div>
              <p className="title is-size-3 has-text-white mb-1" style={{ color }}>{value}</p>
              <p className="is-size-7 has-text-grey">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Routine health summary ── */}
      <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-4">
          <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey" style={{ letterSpacing: "0.1em" }}>Routine Health</p>
          {routineHealth.errorLast > 0 && (
            <span style={{ background: "rgba(255,59,48,0.15)", color: "#ff3b30", borderRadius: 100, padding: "1px 10px", fontSize: 10, fontWeight: 700 }}>
              {routineHealth.errorLast} failing
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatPill label="Total" value={routineHealth.total} color="#fff" />
          <StatPill label="Enabled" value={routineHealth.enabled} color="var(--accent-emerald)" />
          <StatPill label="Last OK" value={routineHealth.successLast} color="var(--accent-emerald)" />
          <StatPill label="Last Err" value={routineHealth.errorLast} color={routineHealth.errorLast > 0 ? "#ff3b30" : "#555"} />
          <StatPill label="HIGH Load" value={routineHealth.highResource} color={routineHealth.highResource > 0 ? "#ff9f0a" : "#555"} />
        </div>
      </div>

      {/* ── Row 3: Per-agent breakdown + expensive routines ── */}
      <div className="columns">

        {/* Agent leaderboard */}
        <div className="column is-7">
          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
            <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.1em" }}>
              Agent Leaderboard (30d)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {agents.slice(0, 7).map((a, i) => (
                <div key={a.agentId}>
                  <div className="is-flex is-justify-content-space-between is-align-items-center mb-1">
                    <div className="is-flex is-align-items-center" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                      {i === 0 && <Award size={11} color="#f59e0b" style={{ flexShrink: 0 }} />}
                      <span className="is-size-7 has-text-white has-text-weight-semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.agentName === a.agentId ? "Core Agent" : a.agentName}
                      </span>
                    </div>
                    <div className="is-flex is-align-items-center" style={{ gap: 12, flexShrink: 0 }}>
                      <span className="is-size-7 has-text-grey" style={{ fontSize: 10 }}>{a.runs30d} runs</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: a.successRate >= 90 ? "var(--accent-emerald)" : a.successRate >= 70 ? "#ff9f0a" : "#ff3b30" }}>
                        {a.successRate}%
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#888", fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right" }}>
                        ${a.costUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {/* Cost bar */}
                  <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                    <div style={{
                      width: `${(a.costUsd / maxCost) * 100}%`, height: "100%", borderRadius: 2,
                      background: a.costUsd > 20 ? "#ff3b30" : a.costUsd > 5 ? "#ff9f0a" : "var(--accent-emerald)",
                    }} />
                  </div>
                  {/* Secondary stats */}
                  <div className="is-flex" style={{ gap: 16, marginTop: 3 }}>
                    <span className="has-text-grey" style={{ fontSize: 9 }}>avg {fmtMs(a.avgDurationMs)}</span>
                    <span className="has-text-grey" style={{ fontSize: 9 }}>{a.totalToolCalls} tool calls</span>
                    <span className="has-text-grey" style={{ fontSize: 9 }}>{a.runs7d} this week</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most expensive routines */}
        <div className="column is-5">
          <div className="box p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
            <div className="is-flex is-align-items-center mb-4" style={{ gap: 8 }}>
              <Zap size={13} color="#ff9f0a" />
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey" style={{ letterSpacing: "0.1em" }}>
                Most Expensive (30d)
              </p>
            </div>
            {expensiveRoutines.length === 0 ? (
              <p className="is-size-7 has-text-grey" style={{ fontStyle: "italic" }}>No cost data yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expensiveRoutines.slice(0, 6).map((r, i) => {
                  const [agentPart, actionPart] = r.label.split(" — ");
                  return (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: i < expensiveRoutines.slice(0,6).length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 900, color: i === 0 ? "#ff3b30" : i === 1 ? "#ff9f0a" : "#555",
                        minWidth: 16, textAlign: "right",
                      }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="has-text-white" style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {actionPart ?? r.label}
                        </div>
                        <div className="has-text-grey" style={{ fontSize: 9 }}>{agentPart} · {r.calls}×</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? "#ff3b30" : i === 1 ? "#ff9f0a" : "#888", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        ${r.totalCost.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ROI note */}
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="has-text-grey" style={{ fontSize: 10, lineHeight: 1.5 }}>
                <span className="has-text-white" style={{ fontWeight: 700 }}>ROI note:</span> Time-saved value uses actual task duration × ${roi.hourlyRateUsed}/hr equivalent rate.
                Revenue attribution requires tagging specific agent actions to conversions — not yet implemented.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
