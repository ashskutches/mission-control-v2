"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, MessageSquare, Loader, Check,
  Sparkles, Copy, CheckCheck, X, AlertTriangle,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const STORAGE_KEY = "blockages_agent_id";

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  color?: string;
}

interface Insight {
  id: string;
  type: string;
  title: string;
  body: string | null;
  priority: number;
  agent_name: string | null;
  error_message: string | null;
}

interface Prompt {
  title: string;
  text: string;
}

// ── Parse agent response into individual copy-able prompts ─────────────────
function parsePrompts(text: string): Prompt[] {
  // Split on numbered items "1.", "2.", etc. or "---" delimiters
  const blocks = text.split(/\n(?=\d+[\.\)]|\n---)/g).filter(b => b.trim().length > 50);

  if (blocks.length <= 1) {
    // Try splitting on bold headers **Title**
    const byHeader = text.split(/\n(?=\*\*[^*]+\*\*)/g).filter(b => b.trim().length > 50);
    if (byHeader.length > 1) {
      return byHeader.map(block => {
        const titleMatch = block.match(/^\*\*(.+?)\*\*/);
        const title = titleMatch?.[1]?.trim() ?? "Prompt";
        const body = block.replace(/^\*\*(.+?)\*\*\n?/, "").trim();
        return { title, text: body };
      });
    }
    return [{ title: "Generated Prompts", text: text.trim() }];
  }

  return blocks.map(block => {
    const cleaned = block.trim();
    // Extract number + title from first line
    const firstLine = cleaned.split("\n")[0];
    const title = firstLine
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/:.+$/, "")
      .trim()
      .slice(0, 60) || "Prompt";
    // Body is everything after first line, strip list numbering
    const body = cleaned.split("\n").slice(1).join("\n").trim() || cleaned;
    return { title, text: body || cleaned };
  });
}

export default function BlockagesAgentPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState<"idle" | "working" | "done" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [convId, setConvId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/agents`);
      if (res.ok) {
        const all: Agent[] = await res.json();
        setAgents(all);
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const found = all.find(a => a.id === savedId);
          if (found) setSelectedAgent(found);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    localStorage.setItem(STORAGE_KEY, agent.id);
    setShowPicker(false);
  };

  const clearAgent = () => {
    setSelectedAgent(null);
    localStorage.removeItem(STORAGE_KEY);
    setStage("idle");
    setPrompts([]);
    setConvId(null);
  };

  const generatePrompts = async () => {
    if (!selectedAgent || stage === "working") return;
    setStage("working");
    setRunError(null);
    setPrompts([]);
    setElapsed(0);
    setConvId(null);

    const timer = setInterval(() => setElapsed(s => s + 1), 1000);

    try {
      // 1. Fetch all open blockages
      const bRes = await fetch(
        `${BOT_URL}/admin/insights?types=bug,blocker,integration_request,feature_request&status=new&limit=50`
      );
      const blockages: Insight[] = bRes.ok ? await bRes.json() : [];

      if (blockages.length === 0) {
        setPrompts([{ title: "No blockages", text: "✅ There are no open blockages to generate prompts for." }]);
        setStage("done");
        clearInterval(timer);
        return;
      }

      const blockageList = blockages.map((b, i) => {
        const lines = [
          `${i + 1}. [${b.type.toUpperCase()}] P${b.priority} — "${b.title}"`,
          b.agent_name       ? `   Filed by: ${b.agent_name}` : null,
          b.error_message    ? `   Error: ${b.error_message.slice(0, 150)}` : null,
          b.body             ? `   Details: ${b.body.slice(0, 200)}` : null,
        ].filter(Boolean);
        return lines.join("\n");
      }).join("\n\n");

      // 2. Create conversation
      const convRes = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          title: `Blockages → Antigravity Prompts — ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!convRes.ok) throw new Error("Failed to create conversation");
      const conv = await convRes.json();
      setConvId(conv.id);

      // 3. Send prompt
      const userPrompt = `You are reviewing ${blockages.length} open system blockages. For each one, write a clear, self-contained, copy-paste-ready prompt that a developer can send to their AI coding assistant to resolve it.

OPEN BLOCKAGES:

${blockageList}

INSTRUCTIONS:
- Write one prompt per blockage.
- Each prompt must be self-contained — include all relevant context (error messages, integration names, what's failing) so the developer doesn't need to explain anything else to their AI.
- Be specific and actionable. Describe the exact fix needed, not just the problem.
- Format as a numbered list. Start each item with a **bold title** (the issue name), then the prompt text on the next line.

Example format:
1. **Fix Google Ads Token**
The Google Ads integration is returning an "invalid_grant" error on all API calls...`;

      const msgRes = await fetch(`${BOT_URL}/admin/chat/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userPrompt }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!msgRes.ok) throw new Error(`Agent call failed: ${await msgRes.text()}`);
      const msgData = await msgRes.json();

      // 4. Get the assistant's reply
      const msgsRes = await fetch(`${BOT_URL}/admin/chat/conversations/${conv.id}/messages`);
      const msgs: any[] = msgsRes.ok ? await msgsRes.json() : [];
      const lastAssistant = [...msgs].reverse().find(m => m.role === "assistant");
      const responseText: string = lastAssistant?.content ?? msgData?.reply ?? "";

      if (!responseText) throw new Error("No response received from agent.");

      setPrompts(parsePrompts(responseText));
      setStage("done");
    } catch (err: any) {
      const msg = err?.name === "TimeoutError" ? "Timed out after 3 minutes" : err.message;
      setRunError(msg);
      setStage("error");
    } finally {
      clearInterval(timer);
    }
  };

  const copyPrompt = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const accentColor = selectedAgent?.color ?? "#a78bfa";

  if (loading) return null;

  return (
    <div className="mb-5">
      <AnimatePresence mode="wait">
        {!selectedAgent ? (
          // ── Unassigned ─────────────────────────────────────────────────────
          <motion.div
            key="unassigned"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="box p-4"
            style={{ background: "rgba(167,139,250,0.03)", border: "1px dashed rgba(167,139,250,0.2)" }}
          >
            <div className="is-flex is-align-items-center is-justify-content-space-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(167,139,250,0.08)", border: "1px dashed rgba(167,139,250,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={18} color="#a78bfa" />
                </div>
                <div>
                  <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.9rem" }}>Prompt Generator</p>
                  <p className="has-text-grey-light" style={{ fontSize: "0.8rem" }}>
                    Assign an agent to convert open blockages → Antigravity prompts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="button is-small"
                style={{ background: "rgba(167,139,250,0.14)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", fontWeight: 700, gap: "0.4rem" }}
              >
                <UserPlus size={13} /> Assign Agent
              </button>
            </div>
          </motion.div>
        ) : (
          // ── Assigned ───────────────────────────────────────────────────────
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
            {/* Header row */}
            <div className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap" style={{ gap: "0.75rem" }}>
              <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                }}>
                  {selectedAgent.emoji ?? "🤖"}
                </div>
                <div>
                  <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                    <p className="has-text-white" style={{ fontWeight: 800, fontSize: "0.95rem" }}>{selectedAgent.name}</p>
                    <span className="tag is-rounded" style={{ fontSize: "9px", background: `${accentColor}18`, color: accentColor, fontWeight: 700 }}>
                      PROMPT GENERATOR
                    </span>
                  </div>
                  <p className="has-text-grey-light" style={{ fontSize: "0.78rem" }}>
                    {selectedAgent.specialization ?? "Converts open blockages into copy-paste Antigravity prompts"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                <motion.button
                  onClick={generatePrompts}
                  disabled={stage === "working"}
                  whileHover={stage !== "working" ? { scale: 1.03 } : {}}
                  whileTap={stage !== "working" ? { scale: 0.97 } : {}}
                  className="button is-small"
                  style={{
                    background: stage === "working" ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.15)",
                    color: stage === "working" ? "#7c3aed" : "#a78bfa",
                    border: `1px solid ${stage === "working" ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.4)"}`,
                    fontWeight: 700, fontSize: "11px", gap: "0.35rem",
                    cursor: stage === "working" ? "not-allowed" : "pointer",
                  }}
                >
                  {stage === "working"
                    ? <><Loader size={12} className="spin" /> Generating…</>
                    : <><Sparkles size={12} /> Generate Prompts</>}
                </motion.button>

                {convId && (
                  <a
                    href={`/chats?conversation=${convId}`}
                    className="button is-small"
                    style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30`, fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}
                  >
                    <MessageSquare size={12} /> Chat
                  </a>
                )}

                <button onClick={() => setShowPicker(!showPicker)} className="button is-small is-ghost" style={{ color: "#64748b", fontSize: "11px" }}>
                  Change
                </button>
                <button onClick={clearAgent} className="button is-small is-ghost" style={{ color: "#475569", fontSize: "11px" }} title="Remove agent">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Progress / Output */}
            <AnimatePresence>
              {stage !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3" style={{ borderTop: `1px solid ${accentColor}15`, overflow: "hidden" }}
                >
                  {stage === "working" && (
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                      <Loader size={12} color={accentColor} className="spin" />
                      <p style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Reading blockages and writing prompts
                        <span style={{ color: accentColor, fontWeight: 700 }}> · {elapsed}s</span>
                        <span style={{ color: "#475569" }}> (usually 20–60s)</span>
                      </p>
                    </div>
                  )}

                  {stage === "error" && (
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                      <AlertTriangle size={12} color="#f43f5e" />
                      <p style={{ fontSize: "11px", color: "#f43f5e" }}>{runError}</p>
                    </div>
                  )}

                  {stage === "done" && prompts.length > 0 && (
                    <div>
                      <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                        {prompts.length} prompt{prompts.length !== 1 ? "s" : ""} generated — click to copy
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {prompts.map((p, i) => {
                          const key = `p${i}`;
                          const isCopied = copied === key;
                          return (
                            <motion.div
                              key={key}
                              initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => copyPrompt(p.text, key)}
                              style={{
                                background: isCopied ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${isCopied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.07)"}`,
                                borderRadius: 8, padding: "10px 12px",
                                cursor: "pointer", position: "relative",
                              }}
                              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                            >
                              <div className="is-flex is-align-items-center is-justify-content-space-between mb-1">
                                <span style={{
                                  fontSize: "10px", fontWeight: 800,
                                  color: isCopied ? "#22c55e" : accentColor,
                                  textTransform: "uppercase", letterSpacing: "0.06em",
                                }}>
                                  {isCopied ? "✓ Copied to clipboard" : `${i + 1}. ${p.title.slice(0, 50)}`}
                                </span>
                                {isCopied
                                  ? <CheckCheck size={13} color="#22c55e" />
                                  : <Copy size={13} color="#475569" />}
                              </div>
                              <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                                {p.text.slice(0, 350)}{p.text.length > 350 ? "…" : ""}
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                      {convId && (
                        <p style={{ fontSize: "10px", color: "#475569", marginTop: "0.75rem" }}>
                          Full response →{" "}
                          <a href={`/chats?conversation=${convId}`} style={{ color: accentColor, fontWeight: 600 }}>view in chat ↗</a>
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
              Select Agent for Prompt Generation
            </p>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {agents.length === 0 ? (
                <p className="has-text-grey" style={{ fontSize: "0.85rem" }}>No agents found.</p>
              ) : agents.map(agent => {
                const isCurrent = agent.id === selectedAgent?.id;
                return (
                  <motion.button
                    key={agent.id}
                    onClick={() => !isCurrent && selectAgent(agent)}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    disabled={isCurrent}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.5rem 0.6rem", borderRadius: 8, width: "100%",
                      background: isCurrent ? "rgba(167,139,250,0.08)" : "transparent",
                      border: "none", cursor: isCurrent ? "default" : "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{agent.emoji ?? "🤖"}</span>
                    <div style={{ flex: 1 }}>
                      <p className="has-text-white" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{agent.name}</p>
                      {agent.specialization && (
                        <p style={{ fontSize: "10px", color: "#64748b" }}>{agent.specialization}</p>
                      )}
                    </div>
                    {isCurrent && <Check size={14} color="#a78bfa" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
