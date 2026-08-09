"use client";

/**
 * TaskComposer — hand an agent a job and watch it work.
 *
 * The Tasks page had no way to create an agent task at all. Its `+` button opens
 * the HUMAN task form and posts to /admin/work/human; agent work arrived only by
 * being promoted off the insights board, or through a raw API call. So the surface
 * named Tasks could show you tasks and not start one.
 *
 * What it starts is deliberately not what POST /admin/work files. That route
 * queues a row for the work runner, which picks it up on the next 15-minute cycle
 * and gives it ONE agent turn — max_runs defaults to 1, and claim_due_work() bumps
 * run_count as it claims, so there is no second run to fall back on. If the agent
 * does not declare itself finished, the item goes to needs_human. No plan, no
 * stages, and a text blob for a result.
 *
 * This posts to /admin/work/run, which plans the task into stages and runs it
 * immediately, ending in a short report: what was done, which tools were used and
 * why, what changed, what is left. Same machinery research uses, different
 * deliverable — nobody wants a 2,000-word essay about a spreadsheet cleanup.
 *
 * Agent selection goes through /admin/ai/parse-job, the same router the research
 * composer and job composer use. It is a default, not a verdict: pick explicitly
 * to override it.
 */

import React, { useState, useCallback } from "react";
import { Loader2, Send, Bot, ChevronDown, AlertCircle, Play } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

export interface AgentDef {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  category?: string;
}

const ACCENT = "#38bdf8";

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const EXAMPLES = [
  "Find every part in the robot camera report on Amazon and give me a buy list with a total",
  "Draft replies to the three support tickets sitting unanswered since Friday",
  "Check which product pages are missing an FAQ block and list them",
];

export default function TaskComposer({
  agents,
  onLaunched,
}: {
  agents: AgentDef[];
  onLaunched: () => void;
}) {
  const [task, setTask] = useState("");
  const [agentId, setAgentId] = useState<string>("");   // "" = let the router pick
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(async () => {
    const t = task.trim();
    if (!t || busy) return;

    setBusy(true);
    setError(null);
    try {
      let chosenId = agentId;
      let chosenName = agents.find(a => a.id === agentId)?.name ?? null;

      if (!chosenId) {
        setPhase("Choosing an agent…");
        const res = await fetch(`${BOT_URL}/admin/ai/parse-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: t, agents }),
        });
        const parsed = await res.json();
        if (!res.ok) throw new Error(parsed.error || `Agent routing failed (${res.status})`);
        chosenId = parsed.selected_agent_id ?? "";
        chosenName = parsed.selected_agent_name ?? null;
        if (!chosenId) throw new Error("No agent matched this task — pick one explicitly below.");
      }

      setPhase("Planning the work…");
      const res = await fetch(`${BOT_URL}/admin/work/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, agent_id: chosenId, agent_name: chosenName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Launch failed (${res.status})`);

      setTask("");
      setAgentId("");
      onLaunched();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase("");
    }
  }, [task, agentId, agents, busy, onLaunched]);

  return (
    <div style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Play size={13} color={ACCENT} />
        <p style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>Give an agent a task</p>
        <span style={{ fontSize: 10, color: "#475569" }}>
          Runs now, in stages. You get a short report of what it did.
        </span>
      </div>

      <textarea
        value={task}
        onChange={e => setTask(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launch(); }}
        placeholder="What needs doing? Name the actual target — the sheet, the tickets, the pages — so the plan can be specific."
        rows={3}
        disabled={busy}
        style={{
          width: "100%", resize: "vertical", padding: "9px 11px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
          color: "#e2e8f0", fontSize: 12, lineHeight: 1.55, outline: "none",
          fontFamily: "inherit", opacity: busy ? 0.6 : 1,
        }}
      />

      {!task.trim() && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => setTask(ex)}
              style={{
                fontSize: 10, color: "#64748b", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7,
                padding: "4px 8px", cursor: "pointer", textAlign: "left",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <Bot size={11} color="#475569" style={{ position: "absolute", left: 9, pointerEvents: "none" }} />
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            disabled={busy}
            style={{
              appearance: "none", height: 28, padding: "0 26px 0 25px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              color: agentId ? "#e2e8f0" : "#64748b", fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", maxWidth: 240,
            }}
          >
            <option value="">Pick the agent automatically</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ""}{a.name}</option>
            ))}
          </select>
          <ChevronDown size={11} color="#475569" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
        </div>

        <button
          onClick={launch}
          disabled={busy || !task.trim()}
          style={{
            marginLeft: "auto", height: 28, padding: "0 14px", borderRadius: 8,
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: busy || !task.trim() ? "not-allowed" : "pointer",
            background: task.trim() && !busy ? "rgba(56,189,248,0.14)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${task.trim() && !busy ? "rgba(56,189,248,0.36)" : "rgba(255,255,255,0.07)"}`,
            color: task.trim() && !busy ? ACCENT : "#475569",
            fontSize: 11, fontWeight: 700,
          }}
        >
          {busy ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
          {busy ? (phase || "Starting…") : "Run it"}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 9, padding: "7px 10px", borderRadius: 8,
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.25)",
          display: "flex", alignItems: "flex-start", gap: 7,
        }}>
          <AlertCircle size={11} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 10.5, color: "#fda4af" }}>{error}</span>
        </div>
      )}
    </div>
  );
}
