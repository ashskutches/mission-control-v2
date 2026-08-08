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
 *
 * "Send report to" DMs the finished report to a Discord user. A run takes minutes and
 * you are told to leave the page, so the notification is the only thing that closes
 * that loop. The roster comes from the guild rather than a text field because
 * sendDiscordDm resolves a snowflake reliably and a typed name only sometimes.
 *
 * "Improve" runs the question through an LLM (/admin/ai/refine-research-question)
 * against the deep-research skill's Phase 1 rubric before any run starts, because a
 * vague question is only discovered after the minutes and the 25 tool calls are gone.
 * It proposes rather than replaces: the rewrite lands in a panel with what it changed
 * and what it assumed, and the asker's own words stay in the box until they accept.
 * That ordering is the point — the way this feature fails is by inventing a specific
 * nobody chose ("since January") and answering a question nobody asked, so an
 * assumption has to be readable before it can be launched, and a rewrite is undoable
 * after. When the question names a topic rather than a question the server refuses to
 * return a rewrite at all and asks instead.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  FlaskConical, Loader2, Send, Bot, ChevronDown, AlertCircle, Bell,
  Sparkles, Check, Undo2, HelpCircle,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

export interface AgentDef {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  mission?: string;
  category?: string;
}

interface DiscordMember {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
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

interface Refinement {
  verdict: "sharpened" | "already_specific" | "too_vague";
  original: string;
  question: string | null;
  type: string | null;
  changes: string[];
  assumptions: string[];
  clarifying_questions: string[];
  decision: string | null;
  suggested_depth: string | null;
}

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
  const [notifyUserId, setNotifyUserId] = useState<string>(""); // "" = no DM
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [refining, setRefining] = useState(false);
  const [refinement, setRefinement] = useState<Refinement | null>(null);
  const [undoTo, setUndoTo] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  // The roster is best-effort: the endpoint answers with [] when the bot is offline
  // or DISCORD_GUILD_ID is unset, and the control simply doesn't render.
  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents/discord-members`)
      .then(r => (r.ok ? r.json() : []))
      .then((m: DiscordMember[]) => setMembers(Array.isArray(m) ? m : []))
      .catch(() => {});
  }, []);

  /** Manual edits invalidate both the open proposal and the undo — restoring the
   *  original after a hand-edit would throw that edit away without saying so. */
  const editQuestion = useCallback((v: string) => {
    setQuestion(v);
    setRefinement(null);
    setUndoTo(null);
    setRefineError(null);
  }, []);

  const refine = useCallback(async () => {
    const q = question.trim();
    if (!q || refining || busy) return;

    setRefining(true);
    setRefineError(null);
    setRefinement(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/ai/refine-research-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Could not improve the question (${res.status})`);
      setRefinement(data as Refinement);
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  }, [question, depth, refining, busy]);

  const acceptRefinement = useCallback(() => {
    if (!refinement?.question) return;
    setUndoTo(refinement.original);
    setQuestion(refinement.question);
    setRefinement(null);
  }, [refinement]);

  const undoRefinement = useCallback(() => {
    if (undoTo === null) return;
    setQuestion(undoTo);
    setUndoTo(null);
  }, [undoTo]);

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
      const notify = members.find(m => m.id === notifyUserId);
      const res = await fetch(`${BOT_URL}/admin/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          agent_id: chosenId,
          agent_name: chosenName,
          depth,
          notify_discord_user_id:  notify?.id ?? null,
          notify_discord_username: notify?.displayName ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Launch failed (${res.status})`);

      setQuestion("");
      setAgentId("");
      setRefinement(null);
      setUndoTo(null);
      // The recipient is deliberately kept — launching a second question usually
      // means the same person wants that report too.
      onLaunched();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase("");
    }
  }, [question, depth, agentId, agents, busy, onLaunched, members, notifyUserId]);

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <FlaskConical size={14} color={ACCENT} />
        <p style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>New investigation</p>
        <span style={{ fontSize: 10.5, color: "#475569" }}>
          Ask a question. You get a cited report, not a chat reply.
        </span>

        {/* Sharpen before launching — the run is minutes long, so a weak question is
            cheapest to catch here. */}
        <button
          onClick={refine}
          disabled={refining || busy || !question.trim()}
          title="Rewrite the question so the research run can actually answer it"
          style={{
            marginLeft: "auto", height: 26, padding: "0 10px", borderRadius: 7,
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: refining || busy || !question.trim() ? "not-allowed" : "pointer",
            background: question.trim() && !busy ? "rgba(167,139,250,0.09)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${question.trim() && !busy ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`,
            color: question.trim() && !busy ? ACCENT : "#475569",
            fontSize: 10.5, fontWeight: 700,
          }}
        >
          {refining ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />}
          {refining ? "Improving…" : "Improve with AI"}
        </button>
      </div>

      <textarea
        value={question}
        onChange={e => editQuestion(e.target.value)}
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

      {/* The rewrite the AI proposed — a suggestion, never a substitution. */}
      {refinement && (
        <div style={{
          marginTop: 8, padding: "10px 12px", borderRadius: 10,
          background: refinement.verdict === "too_vague" ? "rgba(251,191,36,0.06)" : "rgba(167,139,250,0.06)",
          border: `1px solid ${refinement.verdict === "too_vague" ? "rgba(251,191,36,0.26)" : "rgba(167,139,250,0.28)"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            {refinement.verdict === "too_vague"
              ? <HelpCircle size={11} color="#fbbf24" />
              : <Sparkles size={11} color={ACCENT} />}
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase",
              color: refinement.verdict === "too_vague" ? "#fbbf24" : ACCENT,
            }}>
              {refinement.verdict === "sharpened"        ? "Suggested question"
                : refinement.verdict === "already_specific" ? "Already specific enough"
                : "Needs one more detail"}
            </span>
            {refinement.type && (
              <span style={{
                fontSize: 9.5, padding: "2px 6px", borderRadius: 5, color: "#94a3b8",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {refinement.type}
              </span>
            )}
            <button
              onClick={() => setRefinement(null)}
              style={{
                marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                color: "#64748b", fontSize: 10.5, fontWeight: 700, padding: 0,
              }}
            >
              {refinement.verdict === "sharpened" ? "Keep mine" : "Dismiss"}
            </button>
          </div>

          {refinement.question && refinement.verdict === "sharpened" && (
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "#e2e8f0", margin: "0 0 8px" }}>
              {refinement.question}
            </p>
          )}

          {refinement.changes.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 14 }}>
              {refinement.changes.map((c, i) => (
                <li key={i} style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5 }}>{c}</li>
              ))}
            </ul>
          )}

          {/* Assumptions are the whole safety mechanism — read them before you launch. */}
          {refinement.assumptions.length > 0 && (
            <p style={{ fontSize: 10.5, color: "#fbbf24", margin: "0 0 6px", lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 800 }}>Assumes:</strong> {refinement.assumptions.join(" · ")}
            </p>
          )}

          {refinement.clarifying_questions.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 14 }}>
              {refinement.clarifying_questions.map((c, i) => (
                <li key={i} style={{ fontSize: 11, color: "#e2e8f0", lineHeight: 1.5 }}>{c}</li>
              ))}
            </ul>
          )}

          {refinement.decision && (
            <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 }}>
              Informs: {refinement.decision}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {refinement.verdict === "sharpened" && refinement.question && (
              <button
                onClick={acceptRefinement}
                style={{
                  height: 27, padding: "0 11px", borderRadius: 7,
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  background: "rgba(167,139,250,0.16)", border: "1px solid rgba(167,139,250,0.45)",
                  color: ACCENT, fontSize: 11, fontWeight: 700,
                }}
              >
                <Check size={11} /> Use this question
              </button>
            )}

            {/* Depth is priced in tool calls, so a suggestion to change it is applied
                explicitly rather than folded into accepting the rewrite. */}
            {refinement.suggested_depth && refinement.suggested_depth !== depth && (
              <button
                onClick={() => setDepth(refinement.suggested_depth!)}
                style={{
                  height: 27, padding: "0 10px", borderRadius: 7, cursor: "pointer",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)",
                  color: "#94a3b8", fontSize: 10.5, fontWeight: 700,
                }}
              >
                Suggests {DEPTHS.find(d => d.id === refinement.suggested_depth)?.label ?? refinement.suggested_depth} depth — apply
              </button>
            )}
          </div>
        </div>
      )}

      {/* After accepting: their words are one click away for as long as they haven't
          hand-edited the rewrite. */}
      {undoTo !== null && !refinement && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
          <Sparkles size={10} color={ACCENT} />
          <span style={{ fontSize: 10, color: "#64748b" }}>Rewritten by AI.</span>
          <button
            onClick={undoRefinement}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "inline-flex", alignItems: "center", gap: 4,
              color: "#94a3b8", fontSize: 10, fontWeight: 700,
            }}
          >
            <Undo2 size={10} /> Undo
          </button>
        </div>
      )}

      {refineError && (
        <p style={{ fontSize: 10.5, color: "#f43f5e", margin: "8px 0 0" }}>{refineError}</p>
      )}

      {/* Examples — only while the box is empty, so they never sit in the way. */}
      {!question && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => editQuestion(ex)}
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

        {/* Send the finished report to someone on Discord. Only rendered when the
            bot can actually see a guild roster — an empty picker is a dead control. */}
        {members.length > 0 && (
          <>
            <Bell size={12} color="#475569" style={{ marginLeft: 4 }} />
            <div style={{ position: "relative" }}>
              <select
                value={notifyUserId}
                onChange={e => setNotifyUserId(e.target.value)}
                disabled={busy}
                title="DM the finished report to this person on Discord"
                style={{
                  appearance: "none", height: 32, paddingLeft: 10, paddingRight: 26, borderRadius: 8,
                  border: `1px solid ${notifyUserId ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`,
                  background: notifyUserId ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)",
                  color: notifyUserId ? "#34d399" : "#64748b",
                  fontSize: 11.5, outline: "none", cursor: "pointer", maxWidth: 200,
                }}
              >
                <option value="">Send report to… (nobody)</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
              <ChevronDown
                size={11}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
              />
            </div>
          </>
        )}

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
        {notifyUserId && (
          <span style={{ color: "#34d399" }}>
            {" "}The report will be DM&rsquo;d to{" "}
            {members.find(m => m.id === notifyUserId)?.displayName} on Discord when it finishes.
          </span>
        )}
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
