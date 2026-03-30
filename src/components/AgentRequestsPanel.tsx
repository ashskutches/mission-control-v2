"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Bug, Plug, Wrench, AlertTriangle, CheckCircle2, Clock, X,
  Filter, RefreshCw, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  integration: { label: "Integration",  icon: Plug,          color: "#38bdf8", bg: "rgba(56,189,248,0.1)"  },
  bug:         { label: "Bug Report",   icon: Bug,           color: "#f43f5e", bg: "rgba(244,63,94,0.1)"   },
  feature:     { label: "Feature Req.", icon: Wrench,        color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  blocker:     { label: "Blocker",      icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:        { label: "Open",        color: "#f43f5e" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  resolved:    { label: "Resolved",    color: "#22c55e" },
  dismissed:   { label: "Dismissed",  color: "#64748b" },
};

interface AgentRequest {
  id: string;
  created_at: string;
  agent_id: string;
  agent_name?: string;
  type: "integration" | "bug" | "feature" | "blocker";
  priority: number;
  title: string;
  body?: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  resolution_note?: string;
  integration_name?: string;
  integration_url?: string;
  data_points?: string[];
  section?: string;
  error_message?: string;
  tool_name?: string;
}

function PriorityBadge({ priority }: { priority: number }) {
  const color = priority >= 9 ? "#f43f5e" : priority >= 7 ? "#f59e0b" : priority >= 5 ? "#38bdf8" : "#64748b";
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
      color, background: `${color}18`, padding: "2px 7px", borderRadius: 4,
    }}>
      P{priority}
    </span>
  );
}

function RequestCard({ req, onStatusChange }: { req: AgentRequest; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");
  const typeConf = TYPE_CONFIG[req.type] ?? TYPE_CONFIG.bug;
  const statusConf = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.open;
  const TypeIcon = typeConf.icon;

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await fetch(`${BOT_URL}/admin/agent-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution_note: note || undefined }),
      });
      onStatusChange();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
      borderLeft: `3px solid ${typeConf.color}`,
      opacity: req.status === "resolved" || req.status === "dismissed" ? 0.55 : 1,
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
      >
        <div style={{ background: typeConf.bg, borderRadius: 6, padding: 5, flexShrink: 0 }}>
          <TypeIcon size={13} style={{ color: typeConf.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: typeConf.color }}>
              {typeConf.label}
            </span>
            <PriorityBadge priority={req.priority} />
            <span style={{ fontSize: 9, fontWeight: 700, color: statusConf.color, marginLeft: "auto" }}>
              ● {statusConf.label}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {req.title}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
            {req.agent_name ?? req.agent_id}{req.section ? ` · ${req.section}` : ""} · {new Date(req.created_at).toLocaleDateString()}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: "#64748b", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#64748b", flexShrink: 0 }} />}
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {req.body && (
            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap" }}>{req.body}</p>
          )}
          {req.error_message && (
            <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 6, padding: "8px 10px", marginTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#f43f5e", letterSpacing: "0.08em", marginBottom: 4 }}>ERROR MESSAGE</div>
              <code style={{ fontSize: 11, color: "#fca5a5" }}>{req.error_message}</code>
            </div>
          )}
          {req.tool_name && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Tool: <code style={{ color: "#94a3b8" }}>{req.tool_name}</code></div>
          )}
          {req.integration_name && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>🔌 {req.integration_name}</span>
              {req.integration_url && (
                <a href={req.integration_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                  Docs <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
          {Array.isArray(req.data_points) && req.data_points.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Data Points Needed:</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {req.data_points.map((dp, i) => (
                  <li key={i} style={{ fontSize: 11, color: "#94a3b8" }}>{dp}</li>
                ))}
              </ul>
            </div>
          )}
          {req.resolution_note && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "8px 10px", marginTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#22c55e", letterSpacing: "0.08em", marginBottom: 4 }}>RESOLUTION</div>
              <p style={{ fontSize: 11, color: "#86efac", margin: 0 }}>{req.resolution_note}</p>
            </div>
          )}

          {/* Actions */}
          {req.status === "open" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder="Resolution note (optional)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#f1f5f9",
                  outline: "none", width: "100%",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => updateStatus("in_progress")} disabled={updating}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ⏳ In Progress
                </button>
                <button onClick={() => updateStatus("resolved")} disabled={updating}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ✓ Resolve
                </button>
                <button onClick={() => updateStatus("dismissed")} disabled={updating}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: "rgba(100,116,139,0.15)", color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <X size={11} /> Dismiss
                </button>
              </div>
            </div>
          )}
          {req.status === "in_progress" && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input
                placeholder="Resolution note..."
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#f1f5f9", outline: "none",
                }}
              />
              <button onClick={() => updateStatus("resolved")} disabled={updating}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                ✓ Resolve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentRequestsPanel() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [summary, setSummary] = useState<{ total: number; openCount: number; criticalCount: number; byType: Record<string, number> } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const [reqRes, sumRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/agent-requests?${params}`),
        fetch(`${BOT_URL}/admin/agent-requests/summary`),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const sortedRequests = [...requests].sort((a, b) => {
    // Open first, then by priority desc, then by date desc
    if (a.status === "open" && b.status !== "open") return -1;
    if (b.status === "open" && a.status !== "open") return 1;
    return b.priority - a.priority || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      {/* Summary Bar */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Filed",       value: summary.total,         color: "#94a3b8" },
            { label: "Open",              value: summary.openCount,     color: "#f43f5e" },
            { label: "Critical (P8+)",    value: summary.criticalCount, color: "#f59e0b" },
            { label: "Integration Reqs",  value: summary.byType?.integration ?? 0, color: "#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Filter size={13} style={{ color: "#64748b" }} />
        {["all", "open", "in_progress", "resolved", "dismissed"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{
              padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "capitalize",
              background: statusFilter === s ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              color: statusFilter === s ? "#f1f5f9" : "#64748b",
            }}>
            {s === "all" ? "All Status" : s.replace("_", " ")}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["all", "integration", "bug", "feature", "blocker"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{
                padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700,
                background: typeFilter === t ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: typeFilter === t ? "#f1f5f9" : "#64748b",
              }}>
              {t === "all" ? "All Types" : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
          <button onClick={fetchRequests} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 13 }}>Loading agent requests...</div>
      ) : sortedRequests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          <CheckCircle2 size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No requests found</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Agents haven't filed anything matching these filters.</div>
        </div>
      ) : (
        sortedRequests.map(req => (
          <RequestCard key={req.id} req={req} onStatusChange={fetchRequests} />
        ))
      )}
    </div>
  );
}
