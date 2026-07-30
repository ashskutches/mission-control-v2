"use client";

/**
 * ResearchComposer — launch an investigation.
 *
 * Research always runs in pipeline mode (plan → work stages → compiled document),
 * so there is no pipeline toggle here. That toggle used to live on Agents → Tasks
 * and was the only thing separating a research run from a one-off action; making it
 * the surface instead of a checkbox is the whole point of this page.
 *
 * Agent selection goes through /admin/ai/parse-job, the same router the job composer
 * uses, so a question lands on the agent whose specialisation actually fits it. The
 * user can override — the router is a default, not a verdict.
 */

import React, { useState, useCallback } from "react";
import { FlaskConical, Loader2, Send, Bot, ChevronDown, AlertCircle } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

export interface AgentDef {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  mission?: string;
  category?: string;
}

/**
 * Depth maps to the effort budgets in the deep-research skill. It is surfaced because
 * the honest cost difference between them is large — a deep run is 25–40 tool calls
 * against 3–10 for a quick one — and because more searching measurably degrades
 * citation accuracy, so "always go deep" is the wrong default, not the safe one.
 */
const DEPTHS = [
  { id: "quick",    label: "Quick",    detail: "3–10 calls · a specific fact or a single source" },
  { id: "standard", label: "Standard", detail: "10–25 calls · a comparison across a few entities" },
  { id: "deep",     label: "Deep",     detail: "25–40 calls · a landscape or a diagnostic" },
] as const;

const EXAMPLES = [
  "Which competitors added financing since January, and what do they charge?",
  "Why did organic traffic to our product pages drop in the last 30 days?",
  "What do the top 5 rebounder brands claim in their hero copy, and what do we not claim?",
  "Is there real search demand for lymphatic drainage rebounding, or is it a content-farm term?",
];

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const ACCENT = "#a78bfa";

export default function ResearchComposer({
  agents,
  onLaunched,
}: {
  agents: AgentDef[];
  onLaunched: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState<string>("standard");
  const [agentId, setAgentId] = useState<string>("");   // "" = let the router pick
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(async () => {
    const q = question.trim();
    if (!q || busy) return;

    setBusy(true);
    setError(null);
    try {
      let chosenId = agentId;
      let chosenName = agents.find(a => a.id === agentId)?.name ?? null;

      // No explicit pick — ask the router which agent fits.
      if (!chosenId) {
        setPhase("Choosing an agent…");
        const res = await fetch(`${BOT_URL}/admin/ai/parse-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: q, agents }),
        });
        const parsed = await res.json();
        if (!res.ok) throw new Error(parsed.error || `Agent routing failed (${res.status})`);
        chosenId = parsed.selected_agent_id ?? "";
        chosenName = parsed.selected_agent_name ?? null;
        if (!chosenId) {
          throw new Error("No agent matched this question — pick one explicitly below.");
        }
      }

      setPhase("Starting the run…");
      const res = await fetch(`${BOT_URL}/admin/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, agent_id: chosenId, agent_name: chosenName, depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Launch failed (${res.status})`);

      setQuestion("");
      setAgentId("");
      onLaunched();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase("");
    }
  }, [question, depth, agentId, agents, busy, onLaunched]);

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <FlaskConical size={14} color={ACCENT} />
        <p style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>New investigation</p>
        <span style={{ fontSize: 10.5, color: "#475569" }}>
          Ask a question. You get a cited report, not a chat reply.
        </span>
      </div>

      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launch(); }}
        placeholder="What do you need to find out? A specific question beats a topic — &ldquo;which competitors added financing since January&rdquo; will get you a better report than &ldquo;competitors&rdquo;."
        rows={3}
        disabled={busy}
        style={{
          width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
          color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.55, outline: "none",
          fontFamily: "inherit", opacity: busy ? 0.6 : 1,
        }}
      />

      {/* Examples — only while the box is empty, so they never sit in the way. */}
      {!question && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setQuestion(ex)}
              style={{
                fontSize: 10.5, padding: "4px 9px", borderRadius: 6, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                color: "#64748b", textAlign: "left", maxWidth: "100%",
              }}
            >
              {ex.length > 62 ? ex.slice(0, 62) + "…" : ex}
            </button>
          ))}
        </div>
      )}

      {/* Depth */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {DEPTHS.map(d => {
          const on = depth === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDepth(d.id)}
              title={d.detail}
              style={{
                flex: "1 1 150px", textAlign: "left", padding: "8px 11px", borderRadius: 9,
                cursor: "pointer",
                background: on ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: on ? ACCENT : "#94a3b8" }}>
                {d.label}
              </span>
              <span style={{ display: "block", fontSize: 10, color: "#64748b", marginTop: 2 }}>
                {d.detail}
              </span>
            </button>
          );
        })}
      </div>

      {/* Agent + launch */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Bot size={12} color="#475569" />
        <div style={{ position: "relative" }}>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            disabled={busy}
            style={{
              appearance: "none", height: 32, paddingLeft: 10, paddingRight: 26, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
              color: agentId ? "#e2e8f0" : "#64748b", fontSize: 11.5, outline: "none", cursor: "pointer",
            }}
          >
            <option value="">Auto — pick the best agent</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ""}{a.name}</option>
            ))}
          </select>
          <ChevronDown
            size={11}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
          />
        </div>

        <button
          onClick={launch}
          disabled={busy || !question.trim()}
          style={{
            marginLeft: "auto", height: 32, padding: "0 14px", borderRadius: 8,
            display: "inline-flex", alignItems: "center", gap: 7,
            cursor: busy || !question.trim() ? "not-allowed" : "pointer",
            background: question.trim() && !busy ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${question.trim() && !busy ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.08)"}`,
            color: question.trim() && !busy ? ACCENT : "#475569",
            fontSize: 11.5, fontWeight: 700,
          }}
        >
          {busy ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
          {busy ? (phase || "Working…") : "Start research"}
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#475569", margin: "8px 0 0" }}>
        Runs in stages and takes a few minutes. You can leave this page — it keeps going.
      </p>

      {error && (
        <div style={{
          marginTop: 10, padding: "9px 11px", borderRadius: 9,
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.28)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertCircle size={12} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: "#f43f5e" }}>{error}</span>
        </div>
      )}
    </div>
  );
}
