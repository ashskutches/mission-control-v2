"use client";
import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, RefreshCw, TrendingUp, Zap } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";
const ALERT_THRESHOLD = 0.50;

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

interface CostStats {
  totalCalls: number;
  totalCostUsd: number;
  totalAlerts: number;
  agents: Array<{
    agentId: string;
    agentName: string;
    calls: number;
    costUsd: number;
    alerts: number;
  }>;
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

const DISMISSED_KEY = "gc_dismissed_alerts";

function loadDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed: { id: number; ts: number }[] = JSON.parse(raw);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    return new Set(parsed.filter(e => e.ts > cutoff).map(e => e.id));
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<number>) {
  try {
    const entries = [...ids].map(id => ({ id, ts: Date.now() }));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(entries));
  } catch {}
}

export default function CostAlerts() {
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return loadDismissed();
  });
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);

  const dismiss = (id: number) => {
    setDismissed(prev => {
      const next = new Set([...prev, id]);
      saveDismissed(next);
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertRes, statsRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/cost-alerts?limit=20`),
        fetch(`${BOT_URL}/admin/cost-stats`),
      ]);
      if (alertRes.ok) {
        const data = await alertRes.json();
        setAlerts(data.alerts ?? []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const alertCount = visible.length;

  if (loading && alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* ── Main Alert Banner ── */}
      {alertCount > 0 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(255, 59, 48, 0.12), rgba(255, 59, 48, 0.06))",
          border: "1px solid rgba(255, 59, 48, 0.3)",
          borderRadius: "12px",
          padding: "1rem 1.25rem",
          marginBottom: "1rem",
        }}>
          {/* Header */}
          <div className="is-flex is-justify-content-between is-align-items-center" style={{ marginBottom: expanded ? "1rem" : 0 }}>
            <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "8px",
                background: "rgba(255, 59, 48, 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <AlertTriangle size={16} color="#ff3b30" />
              </div>
              <div>
                <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                  <span className="has-text-white has-text-weight-bold" style={{ fontSize: "13px" }}>
                    {alertCount} Cost Alert{alertCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{
                    background: "rgba(255, 59, 48, 0.2)", color: "#ff3b30",
                    borderRadius: "100px", padding: "1px 8px", fontSize: "10px", fontWeight: 700,
                  }}>
                    &gt;${ALERT_THRESHOLD.toFixed(2)} per call
                  </span>
                </div>
                <div className="has-text-grey" style={{ fontSize: "11px" }}>
                  LLM calls that exceeded the cost threshold
                </div>
              </div>
            </div>
            <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
              <button
                onClick={load}
                className="button is-ghost is-small"
                style={{ padding: "0.25rem", color: "var(--text-muted)" }}
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="button is-ghost is-small has-text-grey"
                style={{ fontSize: "11px", fontWeight: 700 }}
              >
                {expanded ? "Collapse" : "View All"}
              </button>
            </div>
          </div>

          {/* Collapsed preview: show top 2 */}
          {!expanded && (
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {visible.slice(0, 2).map(alert => (
                <AlertRow key={alert.id} alert={alert} onDismiss={dismiss} />
              ))}
              {alertCount > 2 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="button is-ghost is-small has-text-grey"
                  style={{ fontSize: "11px", alignSelf: "flex-start", padding: "0.25rem 0" }}
                >
                  + {alertCount - 2} more
                </button>
              )}
            </div>
          )}

          {/* Expanded: all alerts */}
          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {visible.map(alert => (
                <AlertRow key={alert.id} alert={alert} onDismiss={dismiss} />
              ))}
              {visible.length === 0 && (
                <div className="has-text-grey" style={{ fontSize: "12px", padding: "0.5rem 0" }}>
                  All alerts dismissed.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Cost Stats Box ── */}
      {stats && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          padding: "0.875rem 1rem",
        }}>
          <div
            className="is-flex is-justify-content-between is-align-items-center"
            style={{ cursor: "pointer" }}
            onClick={() => setStatsOpen(o => !o)}
          >
            <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
              <TrendingUp size={14} color="var(--accent-orange)" />
              <span className="has-text-grey-light has-text-weight-bold is-uppercase" style={{ fontSize: "10px", letterSpacing: "0.08em" }}>
                LLM Cost (30d)
              </span>
            </div>
            <div className="is-flex is-align-items-center" style={{ gap: "1rem" }}>
              <span className="has-text-white has-text-weight-bold" style={{ fontSize: "14px" }}>
                ${stats.totalCostUsd.toFixed(2)}
              </span>
              {stats.totalAlerts > 0 && (
                <span style={{
                  background: "rgba(255, 59, 48, 0.15)", color: "#ff3b30",
                  borderRadius: "100px", padding: "1px 8px", fontSize: "10px", fontWeight: 700,
                }}>
                  {stats.totalAlerts} alerts
                </span>
              )}
              <span className="has-text-grey" style={{ fontSize: "11px" }}>{statsOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          {statsOpen && stats.agents.length > 0 && (
            <div style={{ marginTop: "0.875rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.875rem" }}>
              <div className="has-text-grey is-uppercase has-text-weight-bold mb-2" style={{ fontSize: "9px", letterSpacing: "0.1em" }}>
                By Agent (30 days)
              </div>
              {stats.agents.slice(0, 8).map(a => (
                <div key={a.agentId} className="is-flex is-justify-content-between is-align-items-center" style={{ marginBottom: "0.5rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="has-text-white has-text-weight-semibold" style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.agentName === a.agentId ? "Core Agent" : a.agentName}
                    </div>
                    <div className="has-text-grey" style={{ fontSize: "10px" }}>{a.calls} calls{a.alerts > 0 ? ` · ${a.alerts} alerts` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "1rem" }}>
                    <div className="has-text-weight-bold" style={{
                      fontSize: "13px",
                      color: a.costUsd > 20 ? "#ff3b30" : a.costUsd > 5 ? "#ff9f0a" : "var(--accent-emerald)",
                    }}>
                      ${a.costUsd.toFixed(2)}
                    </div>
                    {/* Cost bar */}
                    <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 3 }}>
                      <div style={{
                        width: `${Math.min(100, (a.costUsd / (stats.totalCostUsd || 1)) * 100)}%`,
                        height: "100%",
                        background: a.costUsd > 20 ? "#ff3b30" : a.costUsd > 5 ? "#ff9f0a" : "var(--accent-emerald)",
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual alert row ──────────────────────────────────────────────────────
function AlertRow({ alert, onDismiss }: { alert: CostAlert; onDismiss: (id: number) => void }) {
  return (
    <div style={{
      background: "rgba(255, 59, 48, 0.07)",
      border: "1px solid rgba(255, 59, 48, 0.15)",
      borderRadius: "8px",
      padding: "0.625rem 0.875rem",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    }}>
      <Zap size={12} color="#ff9f0a" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="is-flex is-align-items-center" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <span className="has-text-white has-text-weight-semibold" style={{ fontSize: "12px" }}>
            {alert.agent_name ?? alert.agent_id ?? "Unknown agent"}
          </span>
          {alert.action && (
            <span style={{
              background: "rgba(255,255,255,0.06)", borderRadius: "4px",
              padding: "0 6px", fontSize: "10px", color: "var(--text-muted)",
            }}>
              {alert.action}
            </span>
          )}
        </div>
        <div className="has-text-grey" style={{ fontSize: "10px", marginTop: "1px" }}>
          {formatTokens(alert.input_tokens)} in · {formatTokens(alert.output_tokens)} out · {timeAgo(alert.created_at)}
        </div>
      </div>
      <span style={{
        color: "#ff3b30", fontWeight: 800, fontSize: "13px", flexShrink: 0, fontVariantNumeric: "tabular-nums",
      }}>
        ${alert.cost_usd.toFixed(2)}
      </span>
      <button
        onClick={() => onDismiss(alert.id)}
        className="button is-ghost is-small"
        style={{ padding: "0.15rem", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}
