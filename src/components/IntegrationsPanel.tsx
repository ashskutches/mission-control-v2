"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Plug, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  display_name: string;
  category: string;
  status: "active" | "broken" | "requested" | "disabled" | "in_progress";
  credentials_ok: boolean;
  description: string | null;
  agent_tools: string[];
  env_vars: string[];
  docs_url: string | null;
  notes: string | null;
  last_verified_at: string | null;
  updated_at: string;
}

const STATUS_CONFIG = {
  active:      { label: "Active",      color: "#22c55e", bg: "rgba(34,197,94,0.1)",   Icon: CheckCircle },
  broken:      { label: "Broken",      color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   Icon: XCircle },
  requested:   { label: "Requested",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  Icon: Clock },
  in_progress: { label: "In Progress", color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  Icon: RefreshCw },
  disabled:    { label: "Disabled",    color: "#64748b", bg: "rgba(100,116,139,0.1)", Icon: AlertTriangle },
};

const CATEGORY_ORDER = ["ecommerce", "analytics", "email", "ads", "comms", "storage", "ai", "other"];

function groupByCategory(items: Integration[]): Record<string, Integration[]> {
  const grouped: Record<string, Integration[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations`);
      if (!res.ok) throw new Error(`${res.status}`);
      setIntegrations(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string, extra?: Record<string, any>) {
    setUpdatingId(id);
    try {
      await fetch(`${API_BASE}/admin/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  const grouped = groupByCategory(integrations);

  const stats = {
    active:    integrations.filter(i => i.status === "active").length,
    broken:    integrations.filter(i => i.status === "broken").length,
    requested: integrations.filter(i => i.status === "requested").length,
    total:     integrations.length,
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 13 }}>
      Loading integrations…
    </div>
  );

  if (error) return (
    <div style={{ color: "#f43f5e", fontSize: 12, padding: "12px 16px", background: "rgba(244,63,94,0.08)", borderRadius: 8 }}>
      Failed to load integrations: {error}
    </div>
  );

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Active",    value: stats.active,    color: "#22c55e" },
          { label: "Broken",    value: stats.broken,    color: "#f43f5e" },
          { label: "Requested", value: stats.requested, color: "#f59e0b" },
          { label: "Total",     value: stats.total,     color: "#94a3b8" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "8px 16px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", alignItems: "center", minWidth: 70,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: "#64748b", marginTop: 2, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
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

      {/* Category groups */}
      {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(category => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            color: "#475569", textTransform: "uppercase", marginBottom: 8,
          }}>
            {category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(grouped[category] ?? []).map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.disabled;
              const isExpanded = expanded === item.id;

              return (
                <div key={item.id} style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, overflow: "hidden",
                  transition: "border-color 0.15s",
                  ...(item.status === "broken" ? { borderColor: "rgba(244,63,94,0.25)" } : {}),
                  ...(item.status === "requested" ? { borderColor: "rgba(245,158,11,0.25)" } : {}),
                }}>
                  {/* Row */}
                  <div
                    style={{
                      padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                      cursor: "pointer", userSelect: "none",
                    }}
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: cfg.color,
                      boxShadow: item.status === "active" ? `0 0 6px ${cfg.color}` : "none",
                    }} />

                    {/* Name */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flex: 1 }}>
                      {item.display_name}
                    </span>

                    {/* Credentials indicator */}
                    {!item.credentials_ok && item.status !== "requested" && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(244,63,94,0.15)", color: "#f43f5e", letterSpacing: "0.05em",
                      }}>
                        NO CREDS
                      </span>
                    )}

                    {/* Status badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                      background: cfg.bg, color: cfg.color, letterSpacing: "0.06em",
                    }}>
                      {cfg.label.toUpperCase()}
                    </span>

                    {/* Expand chevron */}
                    {isExpanded
                      ? <ChevronUp size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                      : <ChevronDown size={13} style={{ color: "#64748b", flexShrink: 0 }} />}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
                    }}>
                      {item.description && (
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{item.description}</p>
                      )}

                      {/* Env vars */}
                      {item.env_vars?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 4 }}>REQUIRED ENV VARS</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.env_vars.map(v => (
                              <code key={v} style={{
                                fontSize: 10, padding: "2px 6px", borderRadius: 4,
                                background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                              }}>{v}</code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tools */}
                      {item.agent_tools?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 4 }}>AGENT TOOLS</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.agent_tools.map(t => (
                              <span key={t} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                background: "rgba(56,189,248,0.08)", color: "#38bdf8",
                              }}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {item.notes && (
                        <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontStyle: "italic" }}>
                          {item.notes}
                        </p>
                      )}

                      {/* Last verified */}
                      {item.last_verified_at && (
                        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
                          Last verified: {new Date(item.last_verified_at).toLocaleDateString()}
                        </p>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        {item.status !== "active" && (
                          <button
                            disabled={updatingId === item.id}
                            onClick={() => updateStatus(item.id, "active", { credentials_ok: true })}
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e",
                            }}
                          >
                            Mark Active ✓
                          </button>
                        )}
                        {item.status !== "broken" && (
                          <button
                            disabled={updatingId === item.id}
                            onClick={() => updateStatus(item.id, "broken")}
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e",
                            }}
                          >
                            Mark Broken
                          </button>
                        )}
                        {item.status !== "in_progress" && item.status === "requested" && (
                          <button
                            disabled={updatingId === item.id}
                            onClick={() => updateStatus(item.id, "in_progress")}
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8",
                            }}
                          >
                            Set In Progress
                          </button>
                        )}
                        {item.docs_url && (
                          <a
                            href={item.docs_url} target="_blank" rel="noopener noreferrer"
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "#94a3b8", textDecoration: "none",
                            }}
                          >
                            Docs ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
