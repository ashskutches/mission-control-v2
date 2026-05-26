"use client";
/**
 * CommerceSectionPage — shared layout for all /commerce/* section pages.
 * Insights ARE the pipeline. Accepting sends them into pipeline stages visible right here.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Check, X, Plug, ExternalLink, BarChart2, Lightbulb,
  MessageSquare, GitMerge, ArrowRight, Bot,
} from "lucide-react";
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
  status: string; agent_id: string; agent_name: string | null;
  assigned_agent_id?: string | null; assigned_agent_name?: string | null;
  created_at: string;
}


export interface SectionConfig {
  sectionId: string; sectionName: string; subtitle: string;
  accentColor: string; icon: React.ReactNode; sectionHint?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e", suggestion: "#f59e0b", observation: "#38bdf8",
  competitor: "#a78bfa", win: "#22c55e", integration_request: "#fb923c",
};
const TYPE_LABEL: Record<string, string> = {
  critical_issue: "Critical", suggestion: "Suggestion", observation: "Observation",
  competitor: "Competitor", win: "Win", integration_request: "Integration",
};

// Status tabs — now includes pipeline stages
const STATUS_TABS: { id: string; label: string; pipelineStage?: string }[] = [
  { id: "new",          label: "New" },
  { id: "acknowledged", label: "In Pipeline" },
  { id: "in_progress",  label: "In Progress" },
  { id: "resolved",     label: "Done" },
  { id: "dismissed",    label: "Dismissed" },
];

// Pipeline stage display info
const PIPELINE_STAGE: Record<string, { label: string; color: string }> = {
  acknowledged: { label: "In Pipeline",  color: "#e98d20" },
  in_progress:  { label: "In Progress",  color: "#22c55e" },
  resolved:     { label: "Done",         color: "#4ade80" },
};

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
  onFeedback: (id: string, action: string) => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const act = async (action: string) => { setActing(true); await onFeedback(insight.id, action); setActing(false); };
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
function InsightCard({ insight, onFeedback, onOpenPanel, sectionAgent }: {
  insight: Insight;
  onFeedback: (id: string, action: string, note?: string, agentId?: string, agentName?: string) => Promise<void>;
  onOpenPanel: (insight: Insight) => void;
  sectionAgent: { id: string; name: string } | null;
}) {
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const color = TYPE_COLOR[insight.type] ?? "#94a3b8";
  const isInPipeline = ["acknowledged", "in_progress", "resolved"].includes(insight.status);
  const pipelineInfo = PIPELINE_STAGE[insight.status];
  const hasRichContent = ["klaviyo_draft", "social_draft", "review_reply", "product_change"].includes(insight.type);

  const act = async (action: string, note?: string, agentId?: string, agentName?: string) => {
    setActing(true);
    await onFeedback(insight.id, action, note, agentId, agentName);
    setActing(false); setRejecting(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="box mb-3 p-0"
      onClick={hasRichContent && !isInPipeline ? () => onOpenPanel(insight) : undefined}
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`, borderLeft: `3px solid ${color}`, overflow: "hidden", cursor: hasRichContent && !isInPipeline ? "pointer" : "default" }}>

      {/* Priority bar */}
      <div style={{ height: 2, background: `linear-gradient(to right, ${color}, ${color}30)`, width: `${insight.priority * 10}%` }} />

      <div className="p-3">
        {/* Header row */}
        <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          <span className="tag is-rounded" style={{ fontSize: "9px", background: `${color}18`, color, fontWeight: 800 }}>{TYPE_LABEL[insight.type] ?? insight.type}</span>
          <span style={{ fontSize: "10px", color: "#475569" }}>P{insight.priority}/10</span>
          {insight.difficulty && <span style={{ fontSize: "10px", color: "#475569" }}>· {insight.difficulty}</span>}
          {insight.estimated_monthly_value != null && (
            <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>+${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo</span>
          )}
          {/* Pipeline stage badge (shown when not new) */}
          {pipelineInfo && (
            <span style={{ marginLeft: "auto", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", color: pipelineInfo.color, background: `${pipelineInfo.color}12`, border: `1px solid ${pipelineInfo.color}30`, borderRadius: 6, padding: "1px 7px" }}>
              {pipelineInfo.label}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{insight.title}</p>
        {insight.body && <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.5 }}>{insight.body.slice(0, 140)}{insight.body.length > 140 ? "…" : ""}</p>}
        {hasRichContent && !isInPipeline && <p style={{ fontSize: "9px", color: "#334155", marginTop: 2 }}>Click to review full draft →</p>}

        {/* Pipeline status detail row */}
        {isInPipeline && (
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 7, background: `${pipelineInfo!.color}08`, border: `1px solid ${pipelineInfo!.color}20`, display: "flex", alignItems: "center", gap: 8 }}>
            <GitMerge size={11} color={pipelineInfo!.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {(insight.assigned_agent_name ?? insight.assigned_agent_id) ? (
                <p style={{ fontSize: "10px", color: "#94a3b8" }}>
                  Assigned to <strong style={{ color: "#a78bfa" }}>{insight.assigned_agent_name ?? insight.assigned_agent_id}</strong>
                </p>
              ) : (
                <p style={{ fontSize: "10px", color: "#64748b" }}>In pipeline — unassigned</p>
              )}
            </div>
            <a href={`/pipeline/${insight.id}`}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "10px", fontWeight: 700, color: pipelineInfo!.color, textDecoration: "none", whiteSpace: "nowrap" }}
              onClick={e => e.stopPropagation()}>
              View <ArrowRight size={9} />
            </a>
          </div>
        )}

        {/* Action row */}
        <div className="mt-2 pt-2 is-flex is-align-items-center is-flex-wrap-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", gap: "0.4rem" }}>

          {/* New insight — show Pipeline + Assign + Dismiss */}
          {insight.status === "new" && (
            <>
              {/* → Pipeline: send to inbox, no agent */}
              <button onClick={() => act("promoted")} disabled={acting}
                title="Send to pipeline inbox — will be assigned later"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(233,141,32,0.35)", background: "rgba(233,141,32,0.08)", color: "#e98d20", cursor: "pointer" }}>
                <GitMerge size={10} /> Pipeline
              </button>

              {/* → Assign: send to pipeline and assign section's agent */}
              <button onClick={() => act("assigned", undefined, sectionAgent?.id ?? undefined, sectionAgent?.name ?? undefined)}
                disabled={acting}
                title={sectionAgent ? `Assign to ${sectionAgent.name} and move to pipeline` : "Assign a lead agent to this section first"}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)", color: sectionAgent ? "#a78bfa" : "#475569", cursor: sectionAgent ? "pointer" : "not-allowed", opacity: sectionAgent ? 1 : 0.5 }}>
                <Bot size={10} /> Assign{sectionAgent ? ` to ${sectionAgent.name}` : ""}
              </button>

              {/* Dismiss */}
              <button onClick={() => setRejecting(!rejecting)} disabled={acting}
                style={{ fontSize: "10px", color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "3px 10px", cursor: "pointer" }}>
                Dismiss
              </button>
            </>
          )}

          {/* In-progress insight: complete */}
          {insight.status === "in_progress" && (
            <button onClick={() => act("completed")} disabled={acting}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", cursor: "pointer" }}>
              <Check size={10} /> Mark Done
            </button>
          )}

          {/* Acknowledged: dismiss option */}
          {insight.status === "acknowledged" && (
            <button onClick={() => act("dismissed")} disabled={acting}
              style={{ fontSize: "10px", color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "3px 10px", cursor: "pointer" }}>
              Remove from pipeline
            </button>
          )}

          {/* Source agent (always shown right-aligned) */}
          <span style={{ marginLeft: "auto", fontSize: "9px", color: "#334155" }}>{insight.agent_name ?? insight.agent_id}</span>
        </div>

        {/* Reject note input */}
        <AnimatePresence>
          {rejecting && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
              <input className="input is-small" placeholder="Why dismiss? (helps agent learn)" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: "11px" }}
                onKeyDown={e => { if (e.key === "Enter") act("dismissed", rejectNote || undefined); }} autoFocus />
              <div className="is-flex mt-1" style={{ gap: "0.4rem" }}>
                <button onClick={() => act("dismissed", rejectNote || undefined)} className="button is-small" style={{ fontSize: "11px", color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "none" }}>Confirm Dismiss</button>
                <button onClick={() => setRejecting(false)} className="button is-small is-ghost" style={{ fontSize: "11px", color: "#64748b" }}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
  const [activeTab, setActiveTab] = useState<"analytics" | "insights" | "chat">("analytics");

  const TABS: { id: "analytics" | "insights" | "chat"; label: string; icon: React.ElementType }[] = [
    { id: "analytics", label: "Analytics",  icon: BarChart2 },
    { id: "insights",  label: "Insights",   icon: Lightbulb },
    { id: "chat",      label: "Chat",       icon: MessageSquare },
  ];

  const fetchInsights = useCallback(async () => {
    try {
      const sectionFetch = fetch(`${BOT_URL}/admin/insights?section=${sectionId}&limit=100`);
      const agentFetch = assignedAgent?.id
        ? fetch(`${BOT_URL}/admin/insights?agent_id=${assignedAgent.id}&limit=100`)
        : Promise.resolve(null);
      const [sectionRes, agentRes] = await Promise.all([sectionFetch, agentFetch]);
      const bySection: Insight[] = sectionRes.ok ? await sectionRes.json() : [];
      const byAgent: Insight[] = (agentRes && agentRes.ok) ? await agentRes.json() : [];
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

  const handleFeedback = async (id: string, action: string, note?: string, agentId?: string, agentName?: string) => {
    try {
      await fetch(`${BOT_URL}/admin/insights/${id}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note, agent_id: agentId, agent_name: agentName }),
      });
      await fetchInsights();
    } catch { /* silent */ }
  };

  // Split integration requests from regular insights
  const integrationRequests = insights.filter(i => i.type === "integration_request" && i.status !== "dismissed");
  const regularInsights = insights.filter(i => i.type !== "integration_request");
  const filtered = regularInsights.filter(i => i.status === statusFilter);

  // Counts for all tabs
  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.id] = regularInsights.filter(i => i.status === t.id).length;
    return acc;
  }, {});

  return (
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

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "1.25rem", flexShrink: 0 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          // Badge: new insights on Insights tab
          const badge = tab.id === "insights" && counts["new"] > 0 ? counts["new"] : null;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", background: "none", border: "none", borderBottom: isActive ? `2px solid ${accentColor}` : "2px solid transparent", marginBottom: -1, color: isActive ? accentColor : "#475569", fontWeight: isActive ? 800 : 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", transition: "color 0.15s", fontFamily: "inherit" }}>
              <Icon size={13} />
              {tab.label}
              {badge && (
                <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "1px 5px", lineHeight: 1 }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <SectionLiveKPIs sectionId={sectionId} accentColor={accentColor} onRefreshed={() => { setRefreshTrigger(t => t + 1); fetchMetrics(); }} />
            <SectionMetricsPanel sectionId={sectionId} agentName={assignedAgent?.name} refreshTrigger={refreshTrigger} />
            <AnimatePresence>
              {integrationRequests.length > 0 && (
                <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ marginTop: "1rem" }}>
                  <div className="is-flex is-align-items-center mb-2" style={{ gap: 5 }}>
                    <Plug size={11} color="#fb923c" />
                    <p style={{ fontSize: "10px", color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: 0 }}>Data Sources Requested</p>
                    <span style={{ fontSize: "9px", background: "rgba(251,146,60,0.15)", color: "#fb923c", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>{integrationRequests.length}</span>
                  </div>
                  {integrationRequests.map(ir => <IntegrationCard key={ir.id} insight={ir} onFeedback={handleFeedback} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === "insights" && (
          <motion.div key="insights" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {/* Insights panel */}
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: `${accentColor}18`, border: `1px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 13 }}>💡</span>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1 }}>Insights & Pipeline</p>
                    <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 2 }}>Agent findings — accept to promote into the pipeline</p>
                  </div>
                  {counts["new"] > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "2px 8px" }}>
                      {counts["new"]} new
                    </span>
                  )}
                </div>

                {/* Status filter tabs */}
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {STATUS_TABS.map(t => (
                    <button key={t.id} onClick={() => setStatusFilter(t.id)}
                      className="button is-small"
                      style={{ background: statusFilter === t.id ? "rgba(255,255,255,0.08)" : "transparent", color: statusFilter === t.id ? "#e2e8f0" : "#475569", border: statusFilter === t.id ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent", fontWeight: statusFilter === t.id ? 700 : 400, fontSize: "10px", textTransform: "capitalize" }}>
                      {t.label}
                      {counts[t.id] > 0 && (
                        <span className="ml-1" style={{ fontSize: "9px", color: t.id === "new" && counts[t.id] > 0 ? "#f59e0b" : t.id === "acknowledged" ? "#e98d20" : "#475569" }}>
                          {counts[t.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: "1rem 1.25rem" }}>
                {filtered.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, opacity: 0.5 }}>
                    <p style={{ fontSize: "12px", color: "#475569", textAlign: "center" }}>
                      No {STATUS_TABS.find(t => t.id === statusFilter)?.label.toLowerCase()} insights.
                      {statusFilter === "new" ? " Run an analysis to generate findings." : ""}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.75rem" }}>
                    {filtered.map(insight => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                        onFeedback={handleFeedback}
                        onOpenPanel={setReviewInsight}
                        sectionAgent={assignedAgent}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task Queue */}
            <div style={{ marginTop: "1rem" }}>
              <SectionTaskQueue sectionId={sectionId} accentColor={accentColor} />
            </div>
          </motion.div>
        )}

        {activeTab === "chat" && (
          <motion.div key="chat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div style={{ marginBottom: "0.65rem" }}>
              <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0 }}>
                {assignedAgent ? `Chat with ${assignedAgent.name}` : "Department Chat"}
              </p>
              <p style={{ fontSize: "10px", color: "#475569", margin: "2px 0 0" }}>Ask your agent anything about this department</p>
            </div>
            <div style={{ height: 560 }}>
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
                  context={{ sectionId, sectionName, metrics, insights: regularInsights }}
                />
              ) : (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
                  <p style={{ fontSize: "13px", color: "#475569", textAlign: "center" }}>Assign a lead agent above<br />to enable the chat panel.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
