"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bug, Plug, DollarSign, ShieldAlert, RefreshCw, ChevronDown, ChevronUp, Clock, ExternalLink } from "lucide-react";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import CostSummaryPanel from "@/components/CostSummaryPanel";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

const BLOCKAGE_TYPES = ["bug", "blocker", "integration_request", "feature_request"];

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Config ────────────────────────────────────────────────────────────────────
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

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "blockages",    label: "Blockages",    icon: ShieldAlert, color: "#f43f5e",
    subtitle: "Bugs, blockers, missing integrations, and feature gaps filed by agents." },
  { id: "costs",        label: "Costs",        icon: DollarSign,  color: "#22c55e",
    subtitle: "30-day LLM spend by agent and high-cost call alerts." },
  { id: "integrations", label: "Integrations", icon: Plug,        color: "#38bdf8",
    subtitle: "All connected APIs — status, credentials, and agent tool mapping." },
];

// ── BlockagesPanel ─────────────────────────────────────────────────────────────
function BlockagesPanel() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Health-check state
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
    // Remove from list if dismissing/resolving while in open/new filter — item no longer belongs
    const shouldRemove = (status === "dismissed" || status === "resolved") && (filterStatus === "open" || filterStatus === "in_progress");
    setItems(prev => shouldRemove
      ? prev.filter(i => i.id !== id)
      : prev.map(i => i.id === id ? { ...i, status } : i)
    );
  };

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Summary counts
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
            color: "#38bdf8", fontWeight: 800, fontSize: "12px",
            gap: "0.4rem", display: "flex", alignItems: "center",
          }}
        >
          {checking ? (
            <>
              <RefreshCw size={13} className="spin" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw size={13} />
              Run Health Check
            </>
          )}
        </motion.button>
        <span style={{ fontSize: "11px", color: "#334155" }}>
          Dispatches each open blockage to the agent that filed it — they verify if the issue still exists.
        </span>
      </div>

      {/* Health check result banner */}
      <AnimatePresence>
        {checkResult && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="mb-4 px-4 py-3"
            style={{
              background: checkResult.jobs.length > 0 ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.08)",
              border: `1px solid ${checkResult.jobs.length > 0 ? "rgba(34,197,94,0.25)" : "rgba(100,116,139,0.2)"}`,
              borderRadius: 10,
            }}
          >
            <p style={{ fontSize: "13px", color: checkResult.jobs.length > 0 ? "#22c55e" : "#64748b", fontWeight: 700, margin: 0 }}>
              {checkResult.message}
            </p>
            {checkResult.jobs.length > 0 && (
              <p style={{ fontSize: "11px", color: "#475569", margin: "0.25rem 0 0" }}>
                Agents: {checkResult.jobs.map((j: any) => j.agent_name ?? j.agent_id).join(", ")} — refresh in ~60s to see any auto-resolved items.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {(["bug", "blocker", "integration_request", "feature_request"] as const).map(t => {
          const tc = TYPE_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "all" : t)}
              style={{
                background: filterType === t ? tc.bg : "rgba(255,255,255,0.02)",
                border: filterType === t ? `1px solid ${tc.color}50` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: counts[t] > 0 ? tc.color : "#334155" }}>{counts[t]}</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{tc.label}s</div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="is-flex is-align-items-center mb-4" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {[
          { id: "open", label: "Open" }, { id: "in_progress", label: "In Progress" },
          { id: "resolved", label: "Resolved" }, { id: "all", label: "All" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterStatus(f.id)}
            className="button is-small"
            style={{
              background: filterStatus === f.id ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.04)",
              color: filterStatus === f.id ? "#f43f5e" : "#64748b",
              border: filterStatus === f.id ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
              fontSize: "11px", fontWeight: 700,
            }}>{f.label}</button>
        ))}
        <button onClick={fetchItems} className="button is-small is-ghost ml-auto" style={{ color: "#475569" }}>
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: "#475569", textAlign: "center", padding: "40px 0" }}>Loading blockages…</p>
      ) : items.length === 0 ? (
        <div className="box has-text-centered py-6" style={{ background: "rgba(255,255,255,0.02)" }}>
          <ShieldAlert size={32} color="#1e3a2f" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ color: "#22c55e", fontWeight: 700 }}>No open blockages — agents are running clean. ✓</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {items.map(item => {
            const tc = TYPE_CONFIG[item.type] ?? { label: item.type, color: "#64748b", bg: "rgba(100,116,139,0.1)" };
            const isExpanded = expanded[item.id];
            return (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
                className="box mb-3 p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${tc.color}28`, borderLeft: `3px solid ${tc.color}` }}
              >
                <div className="is-flex is-align-items-flex-start" style={{ gap: "0.75rem" }}>
                  <div className="is-flex-shrink-0" style={{ paddingTop: 2 }}>
                    <span className="tag is-rounded" style={{ fontSize: "9px", background: tc.bg, color: tc.color, fontWeight: 700, textTransform: "uppercase" }}>
                      {tc.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.4rem", marginBottom: "0.35rem" }}>
                      <span className="tag is-rounded" style={{ fontSize: "9px", background: `${STATUS_COLOR[item.status] ?? "#64748b"}18`, color: STATUS_COLOR[item.status] ?? "#64748b", fontWeight: 700 }}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                      <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.04)", color: "#475569" }}>
                        P{item.priority}
                      </span>
                      {item.section && (
                        <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.04)", color: "#475569", textTransform: "uppercase" }}>
                          {item.section}
                        </span>
                      )}
                      {item.agent_name && (
                        <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(255,255,255,0.03)", color: "#475569" }}>
                          {item.agent_name}
                        </span>
                      )}
                      {item.tool_name && (
                        <span className="tag is-rounded" style={{ fontSize: "9px", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontFamily: "monospace" }}>
                          🔧 {item.tool_name}
                        </span>
                      )}
                    </div>
                    <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35, marginBottom: "0.4rem" }}>
                      {item.title}
                    </p>
                    <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                      <span style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={9} /> {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="is-flex" style={{ gap: "0.3rem", flexShrink: 0 }}>
                    {item.status === "new" && (
                      <button onClick={() => patch(item.id, "in_progress")}
                        className="button is-small"
                        style={{ fontSize: "10px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", fontWeight: 700 }}>
                        Start
                      </button>
                    )}
                    {item.status === "in_progress" && (
                      <button onClick={() => patch(item.id, "resolved")}
                        className="button is-small"
                        style={{ fontSize: "10px", background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", fontWeight: 700 }}>
                        Resolve
                      </button>
                    )}
                    {(item.body || item.error_message) && (
                      <button onClick={() => toggle(item.id)} className="button is-ghost is-small" style={{ color: "#64748b", padding: "0.25rem" }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (item.body || item.error_message) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {item.error_message && (
                          <div className="mb-2 px-3 py-2" style={{ background: "rgba(239,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)" }}>
                            <p style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, marginBottom: "0.2rem", textTransform: "uppercase" }}>Error</p>
                            <p style={{ fontSize: "0.8rem", color: "#fca5a5", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{item.error_message}</p>
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

// ── Page ──────────────────────────────────────────────────────────────────────
function SystemPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "blockages") as string;

  const setTab = (id: string) => router.push(`/system?tab=${id}`, { scroll: false });
  const activeTab = TABS.find(t => t.id === tab) ?? TABS[0];

  return (
    <div className="px-5 py-5" style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div className="mb-5">
        <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.75rem" }}>
          <ShieldAlert size={22} color="#f43f5e" />
          <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>Blockages</h1>
        </div>
        <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
          {activeTab.subtitle}
        </p>
      </div>

      {/* Tab bar */}
      <div className="is-flex mb-5" style={{ gap: "0.4rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.75rem" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="button is-small"
              style={{
                background: isActive ? `${t.color}18` : "rgba(255,255,255,0.04)",
                color: isActive ? t.color : "#64748b",
                border: isActive ? `1px solid ${t.color}35` : "1px solid rgba(255,255,255,0.06)",
                fontWeight: 700, fontSize: "12px", gap: "0.4rem",
              }}>
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === "blockages"    && <BlockagesPanel />}
          {tab === "costs"        && <CostSummaryPanel />}
          {tab === "integrations" && <IntegrationsPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SystemPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#475569" }}>Loading…</div>}>
      <SystemPageInner />
    </Suspense>
  );
}
