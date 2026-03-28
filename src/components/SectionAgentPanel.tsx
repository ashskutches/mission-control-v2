"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, UserPlus, Users, MessageSquare, ChevronDown, X, Check, Zap,
  Play, Loader, ExternalLink,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  color?: string;
  section?: string;
}

interface SectionData {
  id: string;
  name: string;
  lead_agent_id: string | null;
  lead_agent: Agent | null;
  team_size: number;
}

interface SectionAgentPanelProps {
  sectionId: string;
  sectionName: string;
  onAgentAssigned?: (agent: Agent) => void;
}

export default function SectionAgentPanel({ sectionId, sectionName, onAgentAssigned }: SectionAgentPanelProps) {
  const [section, setSection] = useState<SectionData | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [teamAgents, setTeamAgents] = useState<Agent[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Domain-specific analysis prompts
  const ANALYSIS_PROMPTS: Record<string, string> = {
    seo: `Run a full SEO analysis right now. Do the following:
1. Pull the last 7 days of Google Search Console data (clicks, impressions, CTR, average position) and compare to the prior 7 days
2. Identify the top 5 keywords driving the most traffic and any keywords that dropped significantly in ranking
3. Pull GA4 sessions and user data for the same period
4. Identify any critical issues (major ranking drops, indexation problems, traffic anomalies)
5. Identify your top 3 growth opportunities with estimated revenue impact
6. File ALL significant findings using log_insight — include estimated_monthly_value for each finding where you can calculate it from traffic × CVR × AOV
Be thorough. File at least 3 insights, including at least 1 suggestion with a specific recommended action.`,
    email: `Run a full Email & CRM analysis right now. Pull campaign performance, list health, open rates, click rates, and revenue attribution for the last 30 days. Identify underperforming segments, list decay issues, and high-ROI opportunities. File all significant findings using log_insight with estimated revenue impact.`,
    content: `Run a full Content analysis right now. Review top-performing content, identify gaps, and surface pages with declining traffic. Identify the highest-ROI content opportunities — topics we should write, pages we should update, or formats we should test. File all findings using log_insight.`,
    ads: `Run a full Ads analysis right now. Review ROAS, CPC, CTR, and conversion rate by campaign and ad set for the last 30 days. Identify underperforming spend and highest-opportunity scaling candidates. File all significant findings using log_insight with estimated revenue impact.`,
    commerce: `Run a full Commerce analysis right now. Review conversion rate, AOV, top-selling products, cart abandonment rate, and product page performance. Identify revenue leaks and growth opportunities. File all findings using log_insight with estimated monthly revenue impact.`,
    general: `Run a full business analysis for the ${sectionName} domain. Gather all available data, identify key trends, risks, and opportunities. File your most important findings using log_insight with estimated revenue impact where possible.`,
  };

  const fetchData = useCallback(async () => {
    try {
      const [sectionsRes, agentsRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/sections`),
        fetch(`${BOT_URL}/admin/agents`),
      ]);
      if (sectionsRes.ok) {
        const sections: SectionData[] = await sectionsRes.json();
        setSection(sections.find(s => s.id === sectionId) ?? null);
      }
      if (agentsRes.ok) {
        setAllAgents(await agentsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch team when lead agent changes
  useEffect(() => {
    if (!section?.lead_agent_id) { setTeamAgents([]); return; }
    fetch(`${BOT_URL}/admin/agents/${section.lead_agent_id}/team`)
      .then(r => r.ok ? r.json() : [])
      .then(setTeamAgents)
      .catch(() => setTeamAgents([]));
  }, [section?.lead_agent_id]);

  const assignAgent = async (agent: Agent) => {
    setAssigning(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/sections/${sectionId}/agent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, trigger_onboarding: !section?.lead_agent_id }),
      });
      if (res.ok) {
        await fetchData();
        setShowPicker(false);
        onAgentAssigned?.(agent);
      }
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async () => {
    await fetch(`${BOT_URL}/admin/sections/${sectionId}/agent`, { method: "DELETE" });
    await fetchData();
  };

  const runAnalysis = async () => {
    if (!section?.lead_agent_id || running) return;
    setRunning(true);
    try {
      const prompt = ANALYSIS_PROMPTS[sectionId] ?? ANALYSIS_PROMPTS.general;
      await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: section.lead_agent_id,
          message: prompt,
          source: "manual_trigger",
        }),
      });
      setLastRun(new Date());
    } catch (err) {
      console.error("Run analysis failed:", err);
    } finally {
      setRunning(false);
    }
  };

  const lead = section?.lead_agent;
  const accentColor = lead?.color ?? "#38bdf8";

  if (loading) {
    return (
      <div className="box p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="has-text-grey" style={{ fontSize: "0.85rem" }}>Loading agent...</p>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <AnimatePresence mode="wait">
        {!lead ? (
          // ── Unassigned state ──────────────────────────────────────────────
          <motion.div
            key="unassigned"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="box p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}
          >
            <div className="is-flex is-align-items-center is-justify-content-space-between">
              <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bot size={18} color="#475569" />
                </div>
                <div>
                  <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.9rem" }}>No Lead Agent</p>
                  <p className="has-text-grey-light" style={{ fontSize: "0.8rem" }}>
                    Assign an agent to own the {sectionName} domain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="button is-small"
                style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}
              >
                <UserPlus size={13} style={{ marginRight: "0.4rem" }} />
                Assign Agent
              </button>
            </div>
          </motion.div>
        ) : (
          // ── Assigned state ────────────────────────────────────────────────
          <motion.div
            key="assigned"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="box p-4"
            style={{
              background: `${accentColor}08`,
              border: `1px solid ${accentColor}25`,
              borderLeft: `3px solid ${accentColor}`,
            }}
          >
            <div className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap" style={{ gap: "0.75rem" }}>
              {/* Agent info */}
              <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                }}>
                  {lead.emoji ?? "🤖"}
                </div>
                <div>
                  <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                    <p className="has-text-white" style={{ fontWeight: 800, fontSize: "0.95rem" }}>{lead.name}</p>
                    <span className="tag is-rounded" style={{ fontSize: "9px", background: `${accentColor}18`, color: accentColor, fontWeight: 700 }}>
                      LEAD
                    </span>
                  </div>
                  <p className="has-text-grey-light" style={{ fontSize: "0.78rem" }}>
                    {lead.specialization ?? "Domain Agent"}
                    {teamAgents.length > 0 && ` · ${teamAgents.length} sub-agent${teamAgents.length > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                {/* Team avatars */}
                {teamAgents.length > 0 && (
                  <div className="is-flex is-align-items-center" style={{ gap: "0.25rem" }} title={`Team: ${teamAgents.map(a => a.name).join(", ")}`}>
                    <Users size={13} color="#64748b" />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{teamAgents.map(a => a.emoji ?? "🤖").join(" ")}</span>
                  </div>
                )}

                {/* ── Run Analysis ───────────────────────────────── */}
                <motion.button
                  onClick={runAnalysis}
                  disabled={running}
                  whileHover={!running ? { scale: 1.03 } : {}}
                  whileTap={!running ? { scale: 0.97 } : {}}
                  className="button is-small"
                  style={{
                    background: running ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.15)",
                    color: running ? "#b45309" : "#f59e0b",
                    border: `1px solid ${running ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.35)"}`,
                    fontWeight: 700, fontSize: "11px", gap: "0.35rem",
                    cursor: running ? "not-allowed" : "pointer",
                  }}
                  title="Trigger an immediate analysis run"
                >
                  {running
                    ? <><Loader size={12} className="spin" /> Running...</>
                    : <><Play size={12} /> Run Analysis</>}
                </motion.button>

                {/* ── Chat ───────────────────────────────────────── */}
                <a
                  href={`/chats?agent=${lead.id}`}
                  className="button is-small"
                  style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30`, fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}
                >
                  <MessageSquare size={12} />
                  Chat
                </a>
                {/* Change agent */}
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="button is-small is-ghost"
                  style={{ color: "#64748b", fontSize: "11px" }}
                >
                  <ChevronDown size={13} />
                </button>
                {/* Unassign */}
                <button
                  onClick={unassign}
                  className="button is-small is-ghost"
                  style={{ color: "#475569", fontSize: "11px" }}
                  title="Unassign agent"
                >
                  <X size={13} />
                </button>
              </div>

            </div>

            {/* Footer row — last run + results link */}
            {(lastRun || section?.team_size === 0) && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${accentColor}15` }}>
                <div className="is-flex is-align-items-center is-justify-content-space-between">
                  <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                    <Zap size={12} color={accentColor} />
                    <p style={{ fontSize: "11px", color: "#64748b" }}>
                      {lastRun
                        ? `Analysis started at ${lastRun.toLocaleTimeString()} — insights are being filed now.`
                        : `${lead.name} has received an onboarding message. Open Chat to see their routine proposals.`}
                    </p>
                  </div>
                  {lastRun && (
                    <a
                      href={`/intelligence?section=${sectionId}`}
                      style={{ fontSize: "11px", color: accentColor, fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}
                    >
                      View Results <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent picker dropdown */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="box p-3 mt-2"
            style={{
              background: "rgba(15,20,30,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)", transformOrigin: "top",
            }}
          >
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>
              Select Lead Agent for {sectionName}
            </p>
            {allAgents.length === 0 ? (
              <p className="has-text-grey" style={{ fontSize: "0.85rem" }}>No agents found. Create one first.</p>
            ) : (
              allAgents.map(agent => {
                const isCurrent = agent.id === section?.lead_agent_id;
                return (
                  <motion.button
                    key={agent.id}
                    onClick={() => !isCurrent && assignAgent(agent)}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    disabled={assigning || isCurrent}
                    className="is-flex is-align-items-center is-fullwidth"
                    style={{
                      gap: "0.75rem", padding: "0.5rem 0.6rem", borderRadius: 8,
                      background: isCurrent ? "rgba(56,189,248,0.08)" : "transparent",
                      border: "none", cursor: isCurrent ? "default" : "pointer",
                      width: "100%", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{agent.emoji ?? "🤖"}</span>
                    <div style={{ flex: 1 }}>
                      <p className="has-text-white" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{agent.name}</p>
                      {agent.specialization && (
                        <p style={{ fontSize: "10px", color: "#64748b" }}>{agent.specialization}</p>
                      )}
                    </div>
                    {isCurrent && <Check size={14} color="#38bdf8" />}
                  </motion.button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
