"use client";
/**
 * CommerceSectionPage — shared layout for all /commerce/* section pages.
 * Natural-scroll page (no height cap) — the dashboard layout's section handles the single scroll.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, X, Plug, ExternalLink } from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import SectionMetricsPanel from "@/components/SectionMetricsPanel";
import SectionLiveKPIs from "@/components/SectionLiveKPIs";
import InsightReviewPanel from "@/components/InsightReviewPanel";
import SectionTaskQueue from "@/components/SectionTaskQueue";
import ChatBox from "@/components/ChatBox";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Insight {
  id: string; type: string; title: string; body: string | null;
  priority: number; estimated_monthly_value: number | null;
  difficulty: string | null; effort: string | null;
  status: string; agent_id: string; agent_name: string | null; created_at: string;
}

interface ChatMessage {
  id: string; conversation_id: string; role: "user" | "assistant";
  content: string; created_at: string;
}

// ── Config passed in from each page ──────────────────────────────────────────
export interface SectionConfig {
  sectionId: string;
  sectionName: string;
  subtitle: string;
  accentColor: string;
  icon: React.ReactNode;
  /** Optional channel/domain context injected into the analysis prompt */
  sectionHint?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e", suggestion: "#f59e0b", observation: "#38bdf8",
  competitor: "#a78bfa", win: "#22c55e", integration_request: "#fb923c",
};
const TYPE_LABEL: Record<string, string> = {
  critical_issue: "Critical", suggestion: "Suggestion", observation: "Observation",
  competitor: "Competitor", win: "Win", integration_request: "Integration",
};
const STATUS_FILTERS = ["new", "in_progress", "resolved", "dismissed"];

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 12px" }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "block" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
      ))}
    </div>
  );
}

// ── Integration Request Card ───────────────────────────────────────────────────
function IntegrationCard({ insight, onFeedback }: {
  insight: Insight;
  onFeedback: (id: string, action: "accepted" | "rejected" | "completed" | "dismissed") => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const act = async (action: "accepted" | "rejected" | "completed" | "dismissed") => {
    setActing(true); await onFeedback(insight.id, action); setActing(false);
  };

  // Parse URL from body if present
  const urlMatch = insight.body?.match(/\*\*Docs\/Sign-up:\*\* (https?:\/\/\S+)/);
  const url = urlMatch?.[1];

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
      style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        <Plug size={13} color="#fb923c" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#fb923c", fontWeight: 700, fontSize: "0.8rem", margin: "0 0 2px" }}>
          {insight.title.replace("[Integration Request] ", "")}
        </p>
        {insight.body && (
          <p style={{ color: "#94a3b8", fontSize: "0.72rem", lineHeight: 1.5, margin: "0 0 6px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {insight.body.replace(/\*\*(.*?)\*\*/g, "$1").split("\n").slice(0, 3).join("\n")}
          </p>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "9px", color: "#64748b" }}>Priority {insight.priority}/10</span>
          {insight.status === "new" && (
            <button onClick={() => act("accepted")} disabled={acting}
              style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={9} /> Connect
            </button>
          )}
          {insight.status === "in_progress" && (
            <button onClick={() => act("completed")} disabled={acting}
              style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
              Mark Connected
            </button>
          )}
          {/* Dismiss always visible */}
          <button onClick={() => act("dismissed")} disabled={acting}
            style={{ fontSize: "10px", color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
            Dismiss
          </button>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: "#fb923c", display: "flex", alignItems: "center", gap: 3, textDecoration: "none", marginLeft: "auto" }}>
              Docs <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Insight Card ───────────────────────────────────────────────────────────────
function InsightCard({ insight, onFeedback, onOpenPanel }: {
  insight: Insight;
  onFeedback: (id: string, action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => Promise<void>;
  onOpenPanel: (insight: Insight) => void;
}) {
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const color = TYPE_COLOR[insight.type] ?? "#94a3b8";
  const act = async (action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => {
    setActing(true); await onFeedback(insight.id, action, note); setActing(false); setRejecting(false);
  };
  // Insight types that have rich content worth opening in the review panel
  const hasRichContent = ["klaviyo_draft", "social_draft", "review_reply", "product_change"].includes(insight.type);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="box mb-3 p-0"
      onClick={hasRichContent ? () => onOpenPanel(insight) : undefined}
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`, borderLeft: `3px solid ${color}`, overflow: "hidden", cursor: hasRichContent ? "pointer" : "default" }}>
      <div style={{ height: 2, background: `linear-gradient(to right, ${color}, ${color}30)`, width: `${insight.priority * 10}%` }} />
      <div className="p-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <span className="tag is-rounded" style={{ fontSize: "9px", background: `${color}18`, color, fontWeight: 800 }}>{TYPE_LABEL[insight.type] ?? insight.type}</span>
            <span style={{ fontSize: "10px", color: "#475569" }}>P{insight.priority}/10</span>
            {insight.difficulty && <span style={{ fontSize: "10px", color: "#475569" }}>· {insight.difficulty}</span>}
            {insight.estimated_monthly_value != null && (
              <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>+${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo</span>
            )}
          </div>
          <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{insight.title}</p>
          {insight.body && <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.5 }}>{insight.body.slice(0, 140)}{insight.body.length > 140 ? "…" : ""}</p>}
          {hasRichContent && <p style={{ fontSize: "9px", color: "#334155", marginTop: 2 }}>Click to review full draft →</p>}
        </div>
        <div className="mt-2 pt-2 is-flex is-align-items-center is-flex-wrap-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", gap: "0.4rem" }}>
          {insight.status === "new" && (
            <>
              <button onClick={() => act("accepted")} disabled={acting} className="button is-small" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><Check size={11} /> Accept</button>
              <button onClick={() => setRejecting(!rejecting)} disabled={acting} className="button is-small" style={{ background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><X size={11} /> Reject</button>
            </>
          )}
          {insight.status === "in_progress" && (
            <button onClick={() => act("completed")} disabled={acting} className="button is-small" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><Check size={11} /> Complete</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: "9px", color: "#334155" }}>{insight.agent_name ?? insight.agent_id}</span>
        </div>
        <AnimatePresence>
          {rejecting && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
              <input className="input is-small" placeholder="Why reject? (helps agent learn)" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: "11px" }}
                onKeyDown={e => { if (e.key === "Enter") act("rejected", rejectNote || undefined); }} autoFocus />
              <div className="is-flex mt-1" style={{ gap: "0.4rem" }}>
                <button onClick={() => act("rejected", rejectNote || undefined)} className="button is-small" style={{ fontSize: "11px", color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "none" }}>Confirm</button>
                <button onClick={() => setRejecting(false)} className="button is-small is-ghost" style={{ fontSize: "11px", color: "#64748b" }}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Per-section context hint builders ────────────────────────────────────────
function buildSectionHint(sectionId: string, sectionName: string, metrics: any[], insights: Insight[]): string {
  const metricLines = metrics.length > 0
    ? metrics.map((m: any) => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
    : "  (No metrics yet — run analysis)";
  const insightLines = insights.slice(0, 8).map((i) =>
    `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
  ).join("\n") || "  (None yet)";
  return (
    `This chat is on the ${sectionName} dashboard (section: "${sectionId}").\n\n` +
    `Current Dashboard Metrics:\n${metricLines}\n\n` +
    `Recent Insights:\n${insightLines}\n\n` +
    `Respond as the domain expert who owns ${sectionName} for this business.`
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CommerceSectionPage({ config }: { config: SectionConfig }) {
  const { sectionId, sectionName, subtitle, accentColor, icon } = config;

  const [insights, setInsights] = useState<Insight[]>([]);
  const [statusFilter, setStatusFilter] = useState("new");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string; emoji?: string } | null>(null);
  const [reviewInsight, setReviewInsight] = useState<Insight | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      const sectionFetch = fetch(`${BOT_URL}/admin/insights?section=${sectionId}&limit=100`);
      const agentFetch = assignedAgent?.id
        ? fetch(`${BOT_URL}/admin/insights?agent_id=${assignedAgent.id}&limit=100`)
        : Promise.resolve(null);

      const [sectionRes, agentRes] = await Promise.all([sectionFetch, agentFetch]);

      const bySection: Insight[] = sectionRes.ok ? await sectionRes.json() : [];
      const byAgent: Insight[] = (agentRes && agentRes.ok) ? await agentRes.json() : [];

      // Merge and deduplicate by id — section-specific ones take priority
      const seen = new Set<string>();
      const merged = [...bySection, ...byAgent].filter(i =>
        seen.has(i.id) ? false : (seen.add(i.id), true)
      );
      setInsights(merged);
    } catch { /* silent */ }
  }, [sectionId, assignedAgent?.id]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/section-metrics?section=${sectionId}`);
      if (res.ok) setMetrics(await res.json());
    } catch { /* silent */ }
  }, [sectionId]);

  useEffect(() => { fetchInsights(); fetchMetrics(); }, [fetchInsights, fetchMetrics]);

  const handleAnalysisDone = () => { setRefreshTrigger(t => t + 1); fetchInsights(); fetchMetrics(); };

  const handleFeedback = async (id: string, action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => {
    try {
      await fetch(`${BOT_URL}/admin/insights/${id}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      await fetchInsights();
    } catch { /* silent */ }
  };

  // Split integration requests from regular insights
  const integrationRequests = insights.filter(i => i.type === "integration_request" && i.status !== "dismissed");
  const regularInsights = insights.filter(i => i.type !== "integration_request");
  const filtered = regularInsights.filter(i => i.status === statusFilter);
  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = regularInsights.filter(i => i.status === s).length;
    return acc;
  }, {});

  return (
    // No height cap — page scrolls naturally through the dashboard layout's single scroll container
    <div style={{ padding: "1.25rem 1.5rem", minWidth: 0 }}>

      {/* Header */}
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4" style={{ flexShrink: 0 }}>
        <div className="is-flex is-align-items-center" style={{ gap: "0.65rem" }}>
          <span style={{ color: accentColor }}>{icon}</span>
          <div>
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.25rem", lineHeight: 1 }}>{sectionName}</h1>
            <p className="has-text-grey-light" style={{ fontSize: "0.75rem" }}>{subtitle}</p>
          </div>
        </div>
        <button onClick={() => { fetchInsights(); fetchMetrics(); setRefreshTrigger(t => t + 1); }} className="button is-small is-ghost" style={{ color: "#64748b" }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Agent Panel */}
      <div style={{ flexShrink: 0, marginBottom: "1rem" }}>
        <SectionAgentPanel sectionId={sectionId} sectionName={sectionName} sectionHint={config.sectionHint} onAgentAssigned={a => setAssignedAgent(a)} onAnalysisDone={handleAnalysisDone} />
      </div>

      {/* ── Row 1: Analytics — full width ────────────────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: "1.25rem" }}>

        {/* Live KPI auto-refresh bar */}
        <SectionLiveKPIs
          sectionId={sectionId}
          accentColor={accentColor}
          onRefreshed={() => {
            setRefreshTrigger(t => t + 1);
            fetchMetrics();
          }}
        />

        {/* Metrics */}
        <SectionMetricsPanel sectionId={sectionId} agentName={assignedAgent?.name} refreshTrigger={refreshTrigger} />

        {/* Integration Requests — only show if any */}
        <AnimatePresence>
          {integrationRequests.length > 0 && (
            <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ marginBottom: "1rem" }}>
              <div className="is-flex is-align-items-center mb-2" style={{ gap: 5 }}>
                <Plug size={11} color="#fb923c" />
                <p style={{ fontSize: "10px", color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: 0 }}>
                  Data Sources Requested
                </p>
                <span style={{ fontSize: "9px", background: "rgba(251,146,60,0.15)", color: "#fb923c", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                  {integrationRequests.length}
                </span>
              </div>
              {integrationRequests.map(ir => (
                <IntegrationCard key={ir.id} insight={ir} onFeedback={handleFeedback} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Row 2: Full-width Insights & Recommendations ─────────── */}
      <div style={{
        flexShrink: 0,
        marginTop: "1.25rem",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}>
        {/* Section header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.85rem 1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: `${accentColor}18`, border: `1px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13 }}>💡</span>
            </div>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1 }}>Insights & Recommendations</p>
              <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 2 }}>Agent-generated findings for this department</p>
            </div>
            {counts["new"] > 0 && (
              <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "2px 8px" }}>
                {counts["new"]} new
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Status filter tabs */}
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {STATUS_FILTERS.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className="button is-small" style={{
                  background: statusFilter === s ? "rgba(255,255,255,0.08)" : "transparent",
                  color: statusFilter === s ? "#e2e8f0" : "#475569",
                  border: statusFilter === s ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                  fontWeight: statusFilter === s ? 700 : 400, fontSize: "10px", textTransform: "capitalize",
                }}>
                  {s.replace("_", " ")}
                  {counts[s] > 0 && <span className="ml-1" style={{ fontSize: "9px", color: s === "new" && counts[s] > 0 ? "#f59e0b" : "#475569" }}>{counts[s]}</span>}
                </button>
              ))}
            </div>
            <a href={`/intelligence?section=${sectionId}`} style={{ fontSize: "10px", color: "#334155", whiteSpace: "nowrap" }}>View all →</a>
          </div>
        </div>

        {/* Insight cards — natural flow, no inner scroll */}
        <div style={{ padding: "1rem 1.25rem" }}>
          {filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, opacity: 0.5 }}>
              <p style={{ fontSize: "12px", color: "#475569", textAlign: "center" }}>
                No {statusFilter.replace("_", " ")} insights.{statusFilter === "new" ? " Run an analysis to generate findings." : ""}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.75rem" }}>
              {filtered.map(insight => (
                <InsightCard key={insight.id} insight={insight} onFeedback={handleFeedback} onOpenPanel={setReviewInsight} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2b: Agent Task Queue (actions awaiting approval) ──── */}
      <SectionTaskQueue sectionId={sectionId} accentColor={accentColor} />

      {/* ── Row 3: Chat — fixed 520px height, scrolls inside ─────────── */}
      <div style={{ marginTop: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.65rem" }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${accentColor}18`, border: `1px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13 }}>💬</span>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1 }}>
              {assignedAgent ? `Chat with ${assignedAgent.name}` : "Department Chat"}
            </p>
            <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 2 }}>Ask your agent anything about this department</p>
          </div>
        </div>
        {/* Fixed-height container — ChatBox fills it, messages scroll inside */}
        <div style={{ height: 520 }}>
          {assignedAgent ? (
            <ChatBox
              agentId={assignedAgent.id}
              agentName={assignedAgent.name}
              agentEmoji={(assignedAgent as any).emoji}
              agentColor={accentColor}
              mode="fill"
              showHeader
              showChatLink
              conversationKey={`${assignedAgent.id}-${sectionId}`}
              context={{
                sectionId,
                sectionName,
                metrics,
                insights: regularInsights,
              }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: "13px", color: "#475569", textAlign: "center" }}>Assign a lead agent above<br />to enable the chat panel.</p>
            </div>
          )}
        </div>
      </div>

      {/* Approval Review Panel — slide-out overlay */}
      <InsightReviewPanel
        insight={reviewInsight}
        onClose={() => setReviewInsight(null)}
        onStatusChange={(_id, status) => {
          setInsights(prev => prev.map(i => i.id === _id ? { ...i, status } : i));
          fetchInsights();
        }}
      />
    </div>
  );
}

