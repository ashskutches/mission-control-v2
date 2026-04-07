"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  ShieldAlert, RefreshCw, ChevronDown, ChevronUp,
  Clock, ExternalLink, Sparkles, Copy, CheckCheck,
  Loader, AlertTriangle, UserPlus, Check, X, MessageSquare, CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const BLOCKAGE_TYPES = ["bug", "blocker", "integration_request", "feature_request"];
const STORAGE_KEY = "blockages_agent_id";

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
  occurrences?: number | null;
  tool_name?: string | null;
  error_message?: string | null;
  integration_name?: string | null;
}

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
  color?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bug:                 { label: "Bug",          color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  blocker:             { label: "Blocker",      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  integration_request: { label: "Integration",  color: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  feature_request:     { label: "Feature Req.", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
};
const STATUS_LABEL: Record<string, string> = {
  new: "New", acknowledged: "Acknowledged", in_progress: "In Progress",
  resolved: "Resolved", dismissed: "Dismissed",
};
const STATUS_COLOR: Record<string, string> = {
  new: "#f59e0b", acknowledged: "#38bdf8", in_progress: "#a78bfa",
  resolved: "#22c55e", dismissed: "#64748b",
};

// ── Per-item prompt state ───────────────────────────────────────────────────
interface ItemPromptState {
  stage: "idle" | "working" | "done" | "error";
  text: string | null;
  error: string | null;
  copied: boolean;
  convId: string | null;
}

function defaultPromptState(): ItemPromptState {
  return { stage: "idle", text: null, error: null, copied: false, convId: null };
}

// ── Agent selector header ───────────────────────────────────────────────────
function AgentBar({ agent, agents, onSelect, onClear }: {
  agent: Agent | null;
  agents: Agent[];
  onSelect: (a: Agent) => void;
  onClear: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const accent = agent?.color ?? "#a78bfa";

  return (
    <div className="mb-4">
      <div
        className="p-3"
        style={{
          background: agent ? `${accent}08` : "rgba(167,139,250,0.03)",
          border: agent ? `1px solid ${accent}25` : "1px dashed rgba(167,139,250,0.2)",
          borderLeft: agent ? `3px solid ${accent}` : undefined,
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: `${accent}18`, border: `1px solid ${accent}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
          }}>
            {agent ? (agent.emoji ?? "🤖") : <Sparkles size={16} color="#a78bfa" />}
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: "0.85rem", color: "#e2e8f0" }}>
              {agent ? agent.name : "Prompt Generator"}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {agent
                ? `Click "Generate Prompt" on any blockage below`
                : "Assign an agent to generate per-item resolution prompts"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {agent && (
            <>
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="button is-small is-ghost"
                style={{ fontSize: "11px", color: "#64748b" }}
              >
                Change
              </button>
              <button
                onClick={onClear}
                className="button is-small is-ghost"
                style={{ fontSize: "11px", color: "#475569" }}
                title="Remove agent"
              >
                <X size={13} />
              </button>
            </>
          )}
          {!agent && (
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="button is-small"
              style={{
                background: "rgba(167,139,250,0.14)", color: "#a78bfa",
                border: "1px solid rgba(167,139,250,0.3)", fontWeight: 700, gap: "0.4rem",
              }}
            >
              <UserPlus size={13} /> Assign Agent
            </button>
          )}
        </div>
      </div>

      {/* Agent picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
            transition={{ duration: 0.13 }}
            className="box p-3 mt-1"
            style={{
              background: "rgba(15,20,30,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)", transformOrigin: "top",
            }}
          >
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>
              Select Agent for Prompt Generation
            </p>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {agents.map(a => {
                const isCurrent = a.id === agent?.id;
                return (
                  <motion.button
                    key={a.id}
                    onClick={() => { if (!isCurrent) { onSelect(a); setShowPicker(false); } }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    disabled={isCurrent}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.45rem 0.6rem", borderRadius: 8, width: "100%",
                      background: isCurrent ? "rgba(167,139,250,0.08)" : "transparent",
                      border: "none", cursor: isCurrent ? "default" : "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{a.emoji ?? "🤖"}</span>
                    <div style={{ flex: 1 }}>
                      <p className="has-text-white" style={{ fontWeight: 600, fontSize: "0.875rem" }}>{a.name}</p>
                      {a.specialization && (
                        <p style={{ fontSize: "10px", color: "#64748b" }}>{a.specialization}</p>
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

// ── Blockage card with inline prompt generator ──────────────────────────────
function BlockageCard({ item, agent, onPatch }: {
  item: Insight;
  agent: Agent | null;
  onPatch: (id: string, status: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [ps, setPs] = useState<ItemPromptState>(defaultPromptState());

  const cfg = TYPE_CONFIG[item.type] ?? { label: item.type, color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
  const accent = agent?.color ?? "#a78bfa";

  const generatePrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!agent || ps.stage === "working") return;

    setIsOpen(true); // expand to show progress
    setPs({ stage: "working", text: null, error: null, copied: false, convId: null });

    try {
      // 1. Build context string from the single blockage
      const contextLines = [
        `Type: ${item.type.toUpperCase()} — Priority: P${item.priority}`,
        `Title: "${item.title}"`,
        item.agent_name      ? `Filed by: ${item.agent_name}` : null,
        item.section         ? `Section: ${item.section}` : null,
        item.tool_name       ? `Tool: ${item.tool_name}` : null,
        item.integration_name ? `Integration: ${item.integration_name}` : null,
        item.error_message   ? `Error: ${item.error_message}` : null,
        item.body            ? `Details: ${item.body}` : null,
      ].filter(Boolean).join("\n");

      const userPrompt =
        `Write a single, self-contained, copy-paste-ready prompt that a developer can send to their AI coding assistant to resolve the following system blockage.\n\n` +
        `BLOCKAGE:\n${contextLines}\n\n` +
        `REQUIREMENTS:\n` +
        `- The prompt must include all relevant context (error message, tool name, integration) so the developer doesn't need to explain anything else.\n` +
        `- Be specific and actionable — describe exactly what needs to be fixed or built.\n` +
        `- Write only the prompt text itself, no preamble or explanation.\n` +
        `- Aim for 3-6 sentences.`;

      // 2. Create conversation
      const convRes = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
          title: `Prompt: ${item.title.slice(0, 50)}`,
        }),
      });
      if (!convRes.ok) throw new Error("Failed to create conversation");
      const conv = await convRes.json();

      // 3. Send to agent
      const msgRes = await fetch(`${BOT_URL}/admin/chat/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userPrompt }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!msgRes.ok) throw new Error(`Agent call failed: ${await msgRes.text()}`);

      // 4. Get reply
      const msgsRes = await fetch(`${BOT_URL}/admin/chat/conversations/${conv.id}/messages`);
      const msgs: any[] = msgsRes.ok ? await msgsRes.json() : [];
      const reply = [...msgs].reverse().find(m => m.role === "assistant");
      const text: string = reply?.content ?? "";

      if (!text) throw new Error("No response received from agent.");

      setPs({ stage: "done", text, error: null, copied: false, convId: conv.id });
    } catch (err: any) {
      const msg = err?.name === "TimeoutError" ? "Timed out after 2 minutes" : err.message;
      setPs({ stage: "error", text: null, error: msg, copied: false, convId: null });
    }
  };

  const copyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ps.text) return;
    navigator.clipboard.writeText(ps.text).catch(() => {});
    setPs(p => ({ ...p, copied: true }));
    setTimeout(() => setPs(p => ({ ...p, copied: false })), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className="mb-3 p-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}
    >
      {/* Header row */}
      <div
        className="is-flex is-align-items-center"
        style={{ gap: "0.5rem", cursor: "pointer" }}
        onClick={() => setIsOpen(o => !o)}
      >
        <span style={{
          background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.color}30`,
          borderRadius: 12, padding: "1px 8px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {cfg.label}
        </span>
        {(item.occurrences ?? 1) > 1 && (
          <span title={`Reported ${item.occurrences} times`} style={{
            background: "rgba(245,158,11,0.15)",
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10, padding: "1px 7px",
            fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0,
          }}>
            ×{item.occurrences}
          </span>
        )}
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.88rem", flex: 1 }}>{item.title}</span>

        {/* Generate Prompt button — only visible when agent is assigned */}
        {agent && (
          <motion.button
            onClick={generatePrompt}
            disabled={ps.stage === "working"}
            whileHover={ps.stage !== "working" ? { scale: 1.04 } : {}}
            whileTap={ps.stage !== "working" ? { scale: 0.96 } : {}}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 6, fontSize: "10px", fontWeight: 700,
              background: ps.stage === "done"
                ? "rgba(34,197,94,0.1)"
                : ps.stage === "working"
                  ? `${accent}10`
                  : `${accent}15`,
              border: `1px solid ${ps.stage === "done" ? "rgba(34,197,94,0.3)" : `${accent}35`}`,
              color: ps.stage === "done" ? "#22c55e" : accent,
              cursor: ps.stage === "working" ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {ps.stage === "working"
              ? <><Loader size={9} className="spin" /> Generating…</>
              : ps.stage === "done"
                ? <><Sparkles size={9} /> Regenerate</>
                : <><Sparkles size={9} /> Generate Prompt</>
            }
          </motion.button>
        )}

        <span style={{ fontSize: "10px", color: STATUS_COLOR[item.status] ?? "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
        <span style={{ fontSize: "10px", color: "#475569", whiteSpace: "nowrap" }}>P{item.priority}</span>
        {isOpen ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
          >
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {/* Meta row */}
              <div className="is-flex mb-2" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  <Clock size={10} style={{ marginRight: 3 }} />
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
                {item.agent_name && <span style={{ fontSize: "11px", color: "#64748b" }}>by {item.agent_name}</span>}
                {item.section && <span style={{ fontSize: "11px", color: "#475569", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "1px 6px" }}>{item.section}</span>}
                {item.tool_name && <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>{item.tool_name}</span>}
                {item.integration_name && <span style={{ fontSize: "11px", color: "#38bdf8" }}>{item.integration_name}</span>}
              </div>

              {item.error_message && (
                <div className="mb-2 p-2" style={{ background: "rgba(239,68,68,0.07)", borderRadius: 6, fontSize: "0.8rem", color: "#fca5a5", fontFamily: "monospace" }}>
                  {item.error_message}
                </div>
              )}
              {item.body && (
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.body}</p>
              )}

              {/* ── Generated prompt area ───────────────────────────────── */}
              <AnimatePresence>
                {ps.stage !== "idle" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginTop: "0.75rem" }}
                  >
                    {ps.stage === "working" && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 12px", borderRadius: 8,
                        background: `${accent}08`, border: `1px solid ${accent}20`,
                      }}>
                        <Loader size={12} color={accent} className="spin" />
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          Writing prompt… <span style={{ color: accent, fontWeight: 700 }}>(usually 10–30s)</span>
                        </span>
                      </div>
                    )}

                    {ps.stage === "error" && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 12px", borderRadius: 8,
                        background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.2)",
                      }}>
                        <AlertTriangle size={12} color="#f43f5e" />
                        <span style={{ fontSize: "11px", color: "#f43f5e" }}>{ps.error}</span>
                      </div>
                    )}

                    {ps.stage === "done" && ps.text && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                          borderRadius: 8,
                          background: ps.copied ? "rgba(34,197,94,0.06)" : "rgba(167,139,250,0.05)",
                          border: `1px solid ${ps.copied ? "rgba(34,197,94,0.3)" : `${accent}25`}`,
                          overflow: "hidden",
                        }}
                      >
                        {/* Prompt header */}
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: `1px solid ${ps.copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)"}`,
                        }}>
                          <span style={{
                            fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: ps.copied ? "#22c55e" : accent,
                          }}>
                            {ps.copied ? "✓ Copied to clipboard" : `✦ AI Coding Prompt — ${agent?.name}`}
                          </span>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {ps.convId && (
                              <a
                                href={`/chats?conversation=${ps.convId}`}
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}
                              >
                                <MessageSquare size={10} /> View chat
                              </a>
                            )}
                            <motion.button
                              onClick={copyPrompt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "3px 8px", borderRadius: 5, fontSize: "10px", fontWeight: 700,
                                background: ps.copied ? "rgba(34,197,94,0.15)" : `${accent}15`,
                                border: `1px solid ${ps.copied ? "rgba(34,197,94,0.3)" : `${accent}30`}`,
                                color: ps.copied ? "#22c55e" : accent,
                                cursor: "pointer",
                              }}
                            >
                              {ps.copied ? <CheckCheck size={10} /> : <Copy size={10} />}
                              {ps.copied ? "Copied!" : "Copy"}
                            </motion.button>
                          </div>
                        </div>

                        {/* Prompt text */}
                        <p style={{
                          padding: "10px 12px",
                          fontSize: "12px", color: "#cbd5e1", lineHeight: 1.7,
                          whiteSpace: "pre-wrap", margin: 0,
                        }}>
                          {ps.text}
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions row */}
              <div className="mt-3" style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                <a
                  href={`/chats?agent=${item.agent_name ?? ""}&context=${encodeURIComponent(`[Blockage: ${item.title}] Help me fix this.`)}`}
                  className="button is-small is-ghost" style={{ fontSize: "11px", color: "#475569" }}
                >
                  <ExternalLink size={11} style={{ marginRight: 4 }} /> Chat about this
                </a>
                {item.status !== "resolved" && (
                  <motion.button
                    onClick={() => onPatch(item.id, "resolved")}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="button is-small ml-2"
                    style={{
                      fontSize: "11px", fontWeight: 700,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "#22c55e",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <CheckCircle size={11} /> Mark Resolved
                  </motion.button>
                )}
                {item.status !== "dismissed" && (
                  <button
                    onClick={() => onPatch(item.id, "dismissed")}
                    className="button is-small is-ghost ml-1"
                    style={{ fontSize: "11px", color: "#334155" }}
                  >
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
}

// ── Main blockages panel ────────────────────────────────────────────────────
function BlockagesPanel({ agent }: { agent: Agent | null }) {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
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
    setChecking(true); setCheckResult(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/health-check`, { method: "POST" });
      setCheckResult(await res.json());
      fetchItems();
    } catch (err: any) {
      setCheckResult({ message: `Error: ${err.message}`, jobs: [] });
    } finally { setChecking(false); }
  };

  const patch = async (id: string, status: string) => {
    await fetch(`${BOT_URL}/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const shouldRemove = (status === "dismissed" || status === "resolved")
      && (filterStatus === "open" || filterStatus === "in_progress");
    setItems(prev => shouldRemove ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const counts = {
    bug: items.filter(i => i.type === "bug").length,
    blocker: items.filter(i => i.type === "blocker").length,
    integration_request: items.filter(i => i.type === "integration_request").length,
    feature_request: items.filter(i => i.type === "feature_request").length,
  };

  return (
    <div>
      {/* Controls */}
      <div className="is-flex is-align-items-center mb-4" style={{ gap: "0.75rem" }}>
        <motion.button
          onClick={runHealthCheck} disabled={checking}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="button is-small"
          style={{
            background: checking ? "rgba(56,189,248,0.08)" : "rgba(56,189,248,0.14)",
            border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8", fontWeight: 700, gap: "0.4rem",
          }}
        >
          <RefreshCw size={13} className={checking ? "spin" : ""} />
          {checking ? "Running…" : "Run Health Check"}
        </motion.button>
        <button onClick={fetchItems} className="button is-small is-ghost" style={{ color: "#475569" }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {checkResult && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3"
          style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 8, fontSize: "0.82rem", color: "#94a3b8" }}>
          {checkResult.message}
          {checkResult.jobs?.length > 0 && (
            <span style={{ marginLeft: 8, color: "#475569" }}>
              → {checkResult.jobs.map((j: any) => j.agent_name ?? j.agent_id).join(", ")}
            </span>
          )}
        </motion.div>
      )}

      {/* Summary pills */}
      <div className="is-flex mb-4" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {Object.entries(counts).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type]!;
          return (
            <span key={type} style={{
              background: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.color}30`,
              borderRadius: 20, padding: "2px 10px", fontSize: "11px", fontWeight: 700,
            }}>
              {cfg.label}: {count}
            </span>
          );
        })}
      </div>

      {/* Filters */}
      <div className="is-flex mb-4" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        {["all", "open", "acknowledged", "in_progress", "resolved", "dismissed"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className="button is-small" style={{
            background: filterStatus === s ? "rgba(244,63,94,0.14)" : "rgba(255,255,255,0.04)",
            color: filterStatus === s ? "#f43f5e" : "#64748b",
            border: filterStatus === s ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
            fontWeight: 600, fontSize: "11px",
          }}>
            {STATUS_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: 1, background: "rgba(255,255,255,0.06)", margin: "0 4px" }} />
        {["all", "bug", "blocker", "integration_request", "feature_request"].map(t => {
          const cfg = TYPE_CONFIG[t];
          return (
            <button key={t} onClick={() => setFilterType(t)} className="button is-small" style={{
              background: filterType === t ? (cfg?.bg ?? "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.04)",
              color: filterType === t ? (cfg?.color ?? "#fff") : "#64748b",
              border: `1px solid ${filterType === t ? (cfg?.color ?? "#fff") + "35" : "rgba(255,255,255,0.06)"}`,
              fontWeight: 600, fontSize: "11px",
            }}>
              {cfg?.label ?? "All Types"}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "#475569", fontSize: "0.85rem", padding: "2rem 0" }}>Loading blockages…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#475569", fontSize: "0.85rem", padding: "2rem 0", textAlign: "center" }}>
          ✅ No blockages in this filter.
        </div>
      ) : (
        <AnimatePresence>
          {items.map(item => (
            <BlockageCard key={item.id} item={item} agent={agent} onPatch={patch} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
function BlockagesPageInner() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`)
      .then(r => r.ok ? r.json() : [])
      .then((all: Agent[]) => {
        setAgents(all);
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const found = all.find(a => a.id === savedId);
          if (found) setSelectedAgent(found);
        }
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  const selectAgent = (a: Agent) => {
    setSelectedAgent(a);
    localStorage.setItem(STORAGE_KEY, a.id);
  };

  const clearAgent = () => {
    setSelectedAgent(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="px-5 py-5" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="mb-5">
        <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.75rem" }}>
          <ShieldAlert size={22} color="#f43f5e" />
          <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.4rem" }}>Blockages</h1>
        </div>
        <p className="has-text-grey-light" style={{ fontSize: "0.85rem" }}>
          Bugs, blockers, missing integrations, and feature gaps filed by agents.
        </p>
      </div>

      {!agentsLoading && (
        <AgentBar
          agent={selectedAgent}
          agents={agents}
          onSelect={selectAgent}
          onClear={clearAgent}
        />
      )}

      <BlockagesPanel agent={selectedAgent} />
    </div>
  );
}

export default function BlockagesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#475569" }}>Loading…</div>}>
      <BlockagesPageInner />
    </Suspense>
  );
}
