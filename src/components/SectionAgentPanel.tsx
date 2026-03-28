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
  onAnalysisDone?: () => void;
}

export default function SectionAgentPanel({ sectionId, sectionName, onAgentAssigned, onAnalysisDone }: SectionAgentPanelProps) {
  const [section, setSection] = useState<SectionData | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [teamAgents, setTeamAgents] = useState<Agent[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Open-ended research prompt — agent decides what to do, how to research, and what to track
  const ANALYSIS_PROMPT = `You are the Lead Agent for the ${sectionName} domain. You have full agency over this section's dashboard.

Start by calling get_section_feedback for section "${sectionId}" to understand what kinds of insights the team has found valuable vs. dismissed before.

Then conduct your research — you decide what data to pull, what tools to use, and what to investigate. There is no fixed script.

After research:
1. Call upsert_section_metric for each KPI you want to display on the ${sectionName} dashboard. You decide what metrics matter. Update existing ones with fresh values.
2. Call log_insight for each significant finding — prioritize by revenue impact. Include estimated_monthly_value where you can calculate it.
3. Remove any stale metrics with delete_section_metric if they are no longer relevant.

Your goal is to help grow this area of the business. Surface what's actually important, not what's easy to find.`;

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
      await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: section.lead_agent_id,
          message: ANALYSIS_PROMPT,
          source: "manual_trigger",
        }),
      });
      setLastRun(new Date());
      onAnalysisDone?.();
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
