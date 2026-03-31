"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import { ShieldAlert, RefreshCw, ChevronDown, ChevronUp, Clock, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const BLOCKAGE_TYPES = ["bug", "blocker", "integration_request", "feature_request"];

interface Insight {
  id: string;
  created_at: string;
  agent_name: string | null;
  section: string;
  type: string;
  title: string;
  body: string | null;
  priority: number;
  status: string;
  tool_name?: string | null;
  error_message?: string | null;
  integration_name?: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bug:                 { label: "Bug",          color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  blocker:             { label: "Blocker",      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  integration_request: { label: "Integration",  color: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  feature_request:     { label: "Feature Req.", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
};
const STATUS_LABEL: Record<string, string> = {
  new: "New", acknowledged: "Acknowledged", in_progress: "In Progress", resolved: "Resolved", dismissed: "Dismissed",
};
const STATUS_COLOR: Record<string, string> = {
  new: "#f59e0b", acknowledged: "#38bdf8", in_progress: "#a78bfa", resolved: "#22c55e", dismissed: "#64748b",
};

function BlockagesPanel() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ message: string; jobs: any[] } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ types: BLOCKAGE_TYPES.join(","), limit: "100" });
      if (filterStatus === "open") params.set("status", "new");
      else if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("type", filterType);
      const res = await fetch(`${BOT_URL}/admin/insights?${params}`);
      if (res.ok) setItems(await res.json());
    } catch { /* silently captured */ }
    finally { setLoading(false); }
  }, [filterType, filterStatus]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const runHealthCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/health-check`, { method: "POST" });
      const data = await res.json();
      setCheckResult(data);
      fetchItems();
    } catch (err: any) {
      setCheckResult({ message: `Error: ${err.message}`, jobs: [] });
    } finally {
      setChecking(false);
    }
  };

  const patch = async (id: string, status: string) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const shouldRemove = (status === "dismissed" || status === "resolved") && (filterStatus === "open" || filterStatus === "in_progress");
    setItems(prev => shouldRemove
      ? prev.filter(i => i.id !== id)
      : prev.map(i => i.id === id ? { ...i, status } : i)
    );
  };

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const counts = {
    bug: items.filter(i => i.type === "bug").length,
    blocker: items.filter(i => i.type === "blocker").length,
    integration_request: items.filter(i => i.type === "integration_request").length,
    feature_request: items.filter(i => i.type === "feature_request").length,
  };

  return (
    <div>
      {/* Health Check */}
      <div className="is-flex is-align-items-center mb-4" style={{ gap: "0.75rem" }}>
        <motion.button
          onClick={runHealthCheck}
          disabled={checking}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="button is-small"
          style={{
            background: checking ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.14)",
            border: "1px solid rgba(56,189,248,0.3)",
            color: "#38bdf8", fontWeight: 700, gap: "0.4rem",
          }}>
          <RefreshCw size={13} className={checking ? "spin" : ""} />
          {checking ? "Running…" : "Run Health Check"}
        </motion.button>
        <button onClick={fetchItems} className="button is-small is-ghost" style={{ color: "#475569" }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {checkResult && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3"
          style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 8, fontSize: "0.82rem", color: "#94a3b8" }}>
          {checkResult.message}
          {checkResult.jobs?.length > 0 && (
            <span style={{ marginLeft: 8, color: "#475569" }}>
              → {checkResult.jobs.map((j: any) => j.agent_name ?? j.agent_id).join(", ")}
            </span>
          )}
        </motion.div>
      )}

      {/* Summary pills */}
      <div className="is-flex mb-4" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {Object.entries(counts).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type];
          return (
            <span key={type} style={{
              background: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.color}30`,
              borderRadius: 20, padding: "2px 10px", fontSize: "11px", fontWeight: 700,
            }}>
              {cfg.label}: {count}
            </span>
          );
        })}
      </div>

      {/* Filters */}
      <div className="is-flex mb-4" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        {["all", "open", "acknowledged", "in_progress", "resolved", "dismissed"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="button is-small"
            style={{
              background: filterStatus === s ? "rgba(244,63,94,0.14)" : "rgba(255,255,255,0.04)",
              color: filterStatus === s ? "#f43f5e" : "#64748b",
              border: filterStatus === s ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
              fontWeight: 600, fontSize: "11px",
            }}>
            {STATUS_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: 1, background: "rgba(255,255,255,0.06)", margin: "0 4px" }} />
        {["all", "bug", "blocker", "integration_request", "feature_request"].map(t => {
          const cfg = TYPE_CONFIG[t];
          return (
            <button key={t} onClick={() => setFilterType(t)}
              className="button is-small"
              style={{
                background: filterType === t ? (cfg?.bg ?? "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.04)",
                color: filterType === t ? (cfg?.color ?? "#fff") : "#64748b",
                border: `1px solid ${filterType === t ? (cfg?.color ?? "#fff") + "35" : "rgba(255,255,255,0.06)"}`,
                fontWeight: 600, fontSize: "11px",
              }}>
              {cfg?.label ?? "All Types"}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: "#475569", fontSize: "0.85rem", padding: "2rem 0" }}>Loading blockages…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#475569", fontSize: "0.85rem", padding: "2rem 0", textAlign: "center" }}>
          ✅ No blockages in this filter.
        </div>
      ) : (
        <AnimatePresence>
          {items.map(item => {
            const cfg = TYPE_CONFIG[item.type] ?? { label: item.type, color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
            const isOpen = expanded[item.id];
            return (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="mb-3 p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                <div className="is-flex is-align-items-center" style={{ gap: "0.5rem", cursor: "pointer" }}
                  onClick={() => toggle(item.id)}>
                  <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: "1px 8px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.88rem", flex: 1 }}>{item.title}</span>
                  <span style={{ fontSize: "10px", color: STATUS_COLOR[item.status] ?? "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  <span style={{ fontSize: "10px", color: "#475569", whiteSpace: "nowrap" }}>P{item.priority}</span>
                  {isOpen ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="is-flex mb-2" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            <Clock size={10} style={{ marginRight: 3 }} />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                          {item.agent_name && <span style={{ fontSize: "11px", color: "#64748b" }}>by {item.agent_name}</span>}
                          {item.section && <span style={{ fontSize: "11px", color: "#475569", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "1px 6px" }}>{item.section}</span>}
                          {item.tool_name && <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>{item.tool_name}</span>}
                          {item.integration_name && <span style={{ fontSize: "11px", color: "#38bdf8" }}>{item.integration_name}</span>}
                        </div>
                        {item.error_message && (
                          <div className="mb-2 p-2" style={{ background: "rgba(239,68,68,0.07)", borderRadius: 6, fontSize: "0.8rem", color: "#fca5a5", fontFamily: "monospace" }}>
                            {item.error_message}
                          </div>
                        )}
                        {item.body && (
                          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.body}</p>
                        )}
                        <div className="mt-2">
                          <a href={`/chats?agent=${item.agent_name ?? ""}&context=${encodeURIComponent(`[Blockage: ${item.title}] Help me fix this.`)}`}
                            className="button is-small is-ghost" style={{ fontSize: "11px", color: "#475569" }}>
                            <ExternalLink size={11} style={{ marginRight: 4 }} /> Chat about this
                          </a>
                          {item.status !== "dismissed" && (
                            <button onClick={() => patch(item.id, "dismissed")}
                              className="button is-small is-ghost ml-2" style={{ fontSize: "11px", color: "#334155" }}>
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}

function BlockagesPageInner() {
  return (
    <div className="px-5 py-5" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="mb-5">
        <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.75rem" }}>
          <ShieldAlert size={22} color="#f43f5e" />
          <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>Blockages</h1>
        </div>
        <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
          Bugs, blockers, missing integrations, and feature gaps filed by agents.
        </p>
      </div>
      <BlockagesPanel />
    </div>
  );
}

export default function BlockagesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#475569" }}>Loading…</div>}>
      <BlockagesPageInner />
    </Suspense>
  );
}
