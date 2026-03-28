"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchCheck, RefreshCw, Check, X, MessageSquare, ChevronDown } from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import SectionMetricsPanel from "@/components/SectionMetricsPanel";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface Insight {
  id: string;
  type: string;
  title: string;
  body: string | null;
  priority: number;
  estimated_monthly_value: number | null;
  difficulty: string | null;
  effort: string | null;
  status: string;
  agent_id: string;
  agent_name: string | null;
  created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e",
  suggestion: "#f59e0b",
  observation: "#38bdf8",
  competitor: "#a78bfa",
  win: "#22c55e",
};

const TYPE_LABEL: Record<string, string> = {
  critical_issue: "Critical",
  suggestion: "Suggestion",
  observation: "Observation",
  competitor: "Competitor",
  win: "Win",
};

const STATUS_FILTERS = ["new", "in_progress", "resolved", "dismissed"];

function InsightCard({ insight, onFeedback }: {
  insight: Insight;
  onFeedback: (id: string, action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const color = TYPE_COLOR[insight.type] ?? "#94a3b8";

  const act = async (action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => {
    setActing(true);
    await onFeedback(insight.id, action, note);
    setActing(false);
    setRejecting(false);
  };

  const isNew = insight.status === "new";
  const isInProgress = insight.status === "in_progress";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="box mb-3 p-0"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`, borderLeft: `3px solid ${color}`, overflow: "hidden" }}
    >
      {/* Priority bar */}
      <div style={{ height: 2, background: `linear-gradient(to right, ${color}, ${color}30)`, width: `${insight.priority * 10}%` }} />

      <div className="p-4">
        <div className="is-flex is-justify-content-space-between is-align-items-flex-start" style={{ gap: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="tag is-rounded" style={{ fontSize: "9px", background: `${color}18`, color, fontWeight: 800, letterSpacing: "0.05em" }}>
                {TYPE_LABEL[insight.type] ?? insight.type}
              </span>
              <span style={{ fontSize: "10px", color: "#475569" }}>P{insight.priority}/10</span>
              {insight.difficulty && (
                <span style={{ fontSize: "10px", color: "#475569" }}>· {insight.difficulty}</span>
              )}
              {insight.estimated_monthly_value != null && (
                <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>
                  +${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo
                </span>
              )}
            </div>
            <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem" }}>
              {insight.title}
            </p>
            {insight.body && (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5 }}>{insight.body}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 pt-3 is-flex is-align-items-center is-flex-wrap-wrap" style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, gap: "0.5rem" }}>
          {isNew && (
            <>
              <button
                onClick={() => act("accepted")}
                disabled={acting}
                className="button is-small"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}
              >
                <Check size={12} /> Accept
              </button>
              <button
                onClick={() => setRejecting(!rejecting)}
                disabled={acting}
                className="button is-small"
                style={{ background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}
              >
                <X size={12} /> Reject
              </button>
            </>
          )}
          {isInProgress && (
            <button
              onClick={() => act("completed")}
              disabled={acting}
              className="button is-small"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}
            >
              <Check size={12} /> Mark Complete
            </button>
          )}
          <a
            href={`/chats?agent=${insight.agent_id}&insight=${insight.id}`}
            className="button is-small is-ghost"
            style={{ color: "#64748b", fontSize: "11px", gap: "0.3rem" }}
          >
            <MessageSquare size={12} /> Chat about this
          </a>
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#334155" }}>
            {insight.agent_name ?? insight.agent_id}
          </span>
        </div>

        {/* Reject note input */}
        <AnimatePresence>
          {rejecting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <input
                className="input is-small"
                placeholder="Why are you rejecting this? (optional — helps the agent learn)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: "12px" }}
                onKeyDown={e => {
                  if (e.key === "Enter") act("rejected", rejectNote || undefined);
                }}
                autoFocus
              />
              <div className="is-flex mt-1" style={{ gap: "0.4rem" }}>
                <button onClick={() => act("rejected", rejectNote || undefined)} className="button is-small" style={{ fontSize: "11px", color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "none" }}>
                  Confirm Reject
                </button>
                <button onClick={() => setRejecting(false)} className="button is-small is-ghost" style={{ fontSize: "11px", color: "#64748b" }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SEOPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [statusFilter, setStatusFilter] = useState("new");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string } | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/insights?section=seo&limit=50`);
      if (res.ok) setInsights(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  // Refresh metrics after analysis runs
  const handleAnalysisDone = () => setRefreshTrigger(t => t + 1);

  const handleFeedback = async (id: string, action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => {
    try {
      await fetch(`${BOT_URL}/admin/insights/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      await fetchInsights();
    } catch (e) { console.error(e); }
  };

  const filtered = insights.filter(i => i.status === statusFilter);
  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = insights.filter(i => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-5">
        <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
          <SearchCheck size={22} color="#38bdf8" />
          <div>
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem", lineHeight: 1 }}>SEO</h1>
            <p className="has-text-grey-light" style={{ fontSize: "0.8rem" }}>Agent-managed · Search · Traffic · Rankings</p>
          </div>
        </div>
        <button onClick={() => { fetchInsights(); setRefreshTrigger(t => t + 1); }} className="button is-small is-ghost" style={{ color: "#64748b" }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Agent Panel — assign lead, run analysis */}
      <SectionAgentPanel
        sectionId="seo"
        sectionName="SEO"
        onAgentAssigned={a => setAssignedAgent(a)}
        onAnalysisDone={handleAnalysisDone}
      />

      {/* Dynamic Metrics — agent writes these */}
      <SectionMetricsPanel
        sectionId="seo"
        agentName={assignedAgent?.name}
        refreshTrigger={refreshTrigger}
      />

      {/* Insights Panel */}
      <div>
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
          <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
            Insights & Recommendations
          </p>
          <a href="/intelligence?section=seo" style={{ fontSize: "10px", color: "#334155" }}>View all →</a>
        </div>

        {/* Status tabs */}
        <div className="is-flex mb-4" style={{ gap: "0.4rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem" }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="button is-small"
              style={{
                background: statusFilter === s ? "rgba(255,255,255,0.08)" : "transparent",
                color: statusFilter === s ? "#e2e8f0" : "#475569",
                border: statusFilter === s ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                fontWeight: statusFilter === s ? 700 : 400,
                fontSize: "11px",
                textTransform: "capitalize",
              }}
            >
              {s.replace("_", " ")}
              {counts[s] > 0 && (
                <span className="ml-1" style={{ fontSize: "9px", color: s === "new" && counts[s] > 0 ? "#f59e0b" : "#475569" }}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: "0.85rem", color: "#334155", textAlign: "center", padding: "2rem 0" }}>
              No {statusFilter.replace("_", " ")} insights. {statusFilter === "new" ? "Run an analysis to generate findings." : ""}
            </motion.p>
          ) : (
            filtered.map(insight => (
              <InsightCard key={insight.id} insight={insight} onFeedback={handleFeedback} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
