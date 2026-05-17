"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Bot, RefreshCw, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronUp, Clock, Zap, Search,
  Palette, Mail, BarChart2, Users, Copy, Check, X,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentJob {
  id: string;
  title: string;
  request: string;
  prompt: string;
  agent_id: string;
  agent_name: string | null;
  category: string | null;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  task_run_id: string | null;
  agent_output: string | null;
  tools_used: string[] | null;
  duration_ms: number | null;
  provider: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ParseResult {
  title: string;
  category: string;
  confidence: number;
  prompt: string;
  selected_agent_id: string | null;
  selected_agent_name: string | null;
  alternatives: { agent_id: string; agent_name: string; reason: string }[];
  needs_agent: boolean;
  suggested_agent_type: string | null;
  needs_clarification: boolean;
  clarifying_questions: string[];
}

interface AgentDef {
  id: string; name: string; emoji?: string;
  specialization?: string; mission?: string; category?: string;
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  research:  { icon: Search,    color: "#4a9eff", label: "Research"  },
  creative:  { icon: Palette,   color: "#f472b6", label: "Creative"  },
  email:     { icon: Mail,      color: "#34d399", label: "Email"     },
  report:    { icon: BarChart2, color: "#f59e0b", label: "Report"    },
  team:      { icon: Users,     color: "#a78bfa", label: "Team"      },
  general:   { icon: Zap,       color: "#94a3b8", label: "General"   },
};

const QUICK_PROMPTS = [
  { icon: "🔍", text: "Research our top 3 competitors and compare their value props vs ours" },
  { icon: "🎨", text: "Generate 10 lifestyle images of our rebounder in a lake/outdoor setting" },
  { icon: "📧", text: "Send San Fran Fitness an email to schedule a meeting" },
  { icon: "📊", text: "Pull last week's Klaviyo performance and give me a report" },
  { icon: "💬", text: "Send all team members a progress update with their metrics" },
  { icon: "🔍", text: "Audit our SEO — check rankings, find gaps, recommend 5 quick wins" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(ms: number | null) {
  if (!ms) return null;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function formatRelative(ts: string | null) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function StatusBadge({ status }: { status: AgentJob["status"] }) {
  const cfg = {
    queued:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "Queued",    Icon: Clock },
    running:   { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",   label: "Running",   Icon: Loader2 },
    done:      { color: "#34d399", bg: "rgba(52,211,153,0.12)",   label: "Done",      Icon: CheckCircle2 },
    failed:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)",    label: "Failed",    Icon: XCircle },
    cancelled: { color: "#64748b", bg: "rgba(100,116,139,0.12)",  label: "Cancelled", Icon: X },
  }[status];
  const { color, bg, label, Icon } = cfg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10,
      fontWeight: 700, color, background: bg, border: `1px solid ${color}30`,
      borderRadius: 5, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      <Icon size={9} style={status === "running" ? { animation: "spin 1s linear infinite" } : {}} />
      {label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
        padding: "3px 8px", borderRadius: 5, cursor: "pointer", border: "none",
        background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)",
        color: copied ? "#34d399" : "#555" }}>
      {copied ? <Check size={9} /> : <Copy size={9} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Job Composer ──────────────────────────────────────────────────────────────
function JobComposer({ agents, onJobCreated }: { agents: AgentDef[]; onJobCreated: () => void }) {
  const [request, setRequest] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [overrideAgentId, setOverrideAgentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async (req?: string) => {
    const text = (req ?? request).trim();
    if (!text) return;
    setParsing(true); setParsed(null); setParseError(null); setAnswers([]); setOverrideAgentId(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/ai/parse-job`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, agents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setParsed(data);
    } catch (e: any) { setParseError(e.message); }
    finally { setParsing(false); }
  };

  const handleSubmitAnswers = async () => {
    if (!parsed) return;
    const augmented = `${request}\n\nAdditional context:\n${parsed.clarifying_questions.map((q, i) => `Q: ${q}\nA: ${answers[i] ?? ""}`).join("\n")}`;
    await handleAnalyze(augmented);
  };

  const handleCreate = async () => {
    if (!parsed) return;
    const agentId = overrideAgentId ?? parsed.selected_agent_id;
    if (!agentId) { setCreateError("Please select an agent"); return; }
    setCreating(true); setCreateError(null);
    try {
      const agentName = overrideAgentId
        ? agents.find(a => a.id === overrideAgentId)?.name ?? null
        : parsed.selected_agent_name;
      const res = await fetch(`${BOT_URL}/admin/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsed.title, request, prompt: parsed.prompt,
          agent_id: agentId, agent_name: agentName, category: parsed.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRequest(""); setParsed(null); setAnswers([]); setOverrideAgentId(null);
      onJobCreated();
    } catch (e: any) { setCreateError(e.message); }
    finally { setCreating(false); }
  };

  const catCfg = parsed ? (CATEGORIES[parsed.category] ?? CATEGORIES.general) : null;
  const CatIcon = catCfg?.icon ?? Zap;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "1.25rem", marginBottom: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.9rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(233,141,32,0.12)", border: "1px solid rgba(233,141,32,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={15} color="#e98d20" />
        </div>
        <div>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: 0 }}>New Job</p>
          <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>Describe what you need done — AI selects the right agent</p>
        </div>
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => { setRequest(p.text); setParsed(null); setParseError(null); textareaRef.current?.focus(); }}
            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
            <span>{p.icon}</span> {p.text.slice(0, 36)}…
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea ref={textareaRef} value={request} onChange={e => { setRequest(e.target.value); if (parsed) { setParsed(null); setParseError(null); } }}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleAnalyze(); } }}
        rows={3} placeholder='Describe the job in plain language, e.g. "Research our competitors and build a comparison doc"'
        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
          color: "#fff", padding: "10px 12px", fontSize: 13, lineHeight: 1.6, resize: "vertical",
          fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button onClick={() => handleAnalyze()} disabled={parsing || !request.trim()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
            padding: "7px 16px", borderRadius: 8, cursor: parsing || !request.trim() ? "not-allowed" : "pointer",
            background: parsing || !request.trim() ? "rgba(255,255,255,0.04)" : "rgba(233,141,32,0.15)",
            border: `1px solid ${parsing || !request.trim() ? "rgba(255,255,255,0.08)" : "rgba(233,141,32,0.35)"}`,
            color: parsing || !request.trim() ? "#475569" : "#e98d20", transition: "all 0.15s" }}>
          {parsing ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</> : <><Sparkles size={12} /> Analyze Request</>}
        </button>
        <span style={{ fontSize: 11, color: "#334155" }}>⌘↵ to analyze</span>
        {parseError && <span style={{ fontSize: 11, color: "#ef4444" }}>{parseError}</span>}
      </div>

      {/* AI Parse Result */}
      <AnimatePresence>
        {parsed && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: "1rem", padding: "1rem", borderRadius: 12,
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>

            {/* Category + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                color: catCfg?.color, background: `${catCfg?.color}18`, border: `1px solid ${catCfg?.color}30`,
                display: "flex", alignItems: "center", gap: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <CatIcon size={10} /> {catCfg?.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{parsed.title}</span>
            </div>

            {/* Clarification needed */}
            {parsed.needs_clarification && parsed.clarifying_questions.length > 0 && (
              <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10,
                background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", margin: "0 0 8px" }}>
                  🤔 A couple of quick questions before I proceed:
                </p>
                {parsed.clarifying_questions.map((q, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>{q}</p>
                    <input value={answers[i] ?? ""} onChange={e => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
                      placeholder="Your answer…" style={{ width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#fff",
                        padding: "5px 9px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
                <button onClick={handleSubmitAnswers} disabled={parsing}
                  style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
                    background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
                  {parsing ? "Re-analyzing…" : "Continue →"}
                </button>
              </div>
            )}

            {/* Agent match */}
            {!parsed.needs_clarification && (
              <>
                {parsed.needs_agent ? (
                  <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, margin: "0 0 3px" }}>⚠️ No matching agent found</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Suggested: {parsed.suggested_agent_type}</p>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>Select an agent below or create one first.</p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
                      Assigned Agent
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                      background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                      <span style={{ fontSize: 18 }}>{agents.find(a => a.id === (overrideAgentId ?? parsed.selected_agent_id))?.emoji ?? "🤖"}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                          {agents.find(a => a.id === (overrideAgentId ?? parsed.selected_agent_id))?.name ?? parsed.selected_agent_name}
                        </p>
                        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
                          {Math.round((overrideAgentId ? 1 : parsed.confidence) * 100)}% match
                        </p>
                      </div>
                      <CheckCircle2 size={14} color="#34d399" />
                    </div>
                    {/* Alternatives */}
                    {parsed.alternatives.length > 0 && (
                      <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#334155", alignSelf: "center" }}>Switch to:</span>
                        {parsed.alternatives.map(alt => (
                          <button key={alt.agent_id} onClick={() => setOverrideAgentId(alt.agent_id)}
                            title={alt.reason}
                            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                              background: overrideAgentId === alt.agent_id ? "rgba(233,141,32,0.15)" : "rgba(255,255,255,0.06)",
                              border: overrideAgentId === alt.agent_id ? "1px solid rgba(233,141,32,0.35)" : "1px solid rgba(255,255,255,0.08)",
                              color: overrideAgentId === alt.agent_id ? "#e98d20" : "#64748b" }}>
                            {agents.find(a => a.id === alt.agent_id)?.emoji ?? "🤖"} {alt.agent_name}
                          </button>
                        ))}
                        {overrideAgentId && (
                          <button onClick={() => setOverrideAgentId(null)}
                            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                              background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "#475569" }}>
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Prompt preview */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                      Execution Prompt
                    </p>
                    <CopyButton text={parsed.prompt} />
                  </div>
                  <div style={{ background: "#0a0a12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
                    padding: "8px 10px", maxHeight: 140, overflowY: "auto", fontSize: 11, color: "#94a3b8",
                    lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
                    {parsed.prompt}
                  </div>
                </div>

                {createError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{createError}</p>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreate} disabled={creating || (!parsed.selected_agent_id && !overrideAgentId)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800,
                      padding: "8px 20px", borderRadius: 8, cursor: "pointer",
                      background: "linear-gradient(135deg, rgba(233,141,32,0.25), rgba(233,141,32,0.15))",
                      border: "1px solid rgba(233,141,32,0.4)", color: "#e98d20" }}>
                    {creating ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : <><Send size={12} /> Create Job</>}
                  </button>
                  <button onClick={() => { setParsed(null); setParseError(null); }}
                    style={{ fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                      background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
                    Edit
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onCancel, onDelete }: {
  job: AgentJob;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catCfg = CATEGORIES[job.category ?? "general"] ?? CATEGORIES.general;
  const CatIcon = catCfg.icon;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>

      {/* Card header — always visible */}
      <div onClick={() => setExpanded(v => !v)} style={{ padding: "12px 14px", cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Category dot */}
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: `${catCfg.color}18`, border: `1px solid ${catCfg.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CatIcon size={13} color={catCfg.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{job.title}</span>
            <StatusBadge status={job.status} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#475569" }}>
              {job.agent_name ?? job.agent_id}
            </span>
            <span style={{ fontSize: 10, color: "#334155" }}>·</span>
            <span style={{ fontSize: 11, color: "#334155" }}>{formatRelative(job.created_at)}</span>
            {job.duration_ms && (
              <>
                <span style={{ fontSize: 10, color: "#334155" }}>·</span>
                <span style={{ fontSize: 11, color: "#334155" }}>{formatDuration(job.duration_ms)}</span>
              </>
            )}
          </div>
          {/* Quick output preview */}
          {job.agent_output && !expanded && (
            <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
              {job.agent_output.slice(0, 120).replace(/#+\s*/g, "")}…
            </p>
          )}
          {job.error && !expanded && (
            <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0" }}>
              {job.error.slice(0, 100)}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {(job.status === "queued" || job.status === "running") && (
            <button onClick={e => { e.stopPropagation(); onCancel(job.id); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              Cancel
            </button>
          )}
          {(job.status === "done" || job.status === "failed" || job.status === "cancelled") && (
            <button onClick={e => { e.stopPropagation(); onDelete(job.id); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#334155" }}>
              Remove
            </button>
          )}
          {expanded ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>

              {/* Original request */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 5px" }}>
                  Original Request
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{job.request}</p>
              </div>

              {/* Output */}
              {job.agent_output && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                      Output
                    </p>
                    <CopyButton text={job.agent_output} />
                  </div>
                  <div style={{ background: "#0a0a12", borderRadius: 10, padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.06)", maxHeight: 320, overflowY: "auto" }}>
                    <pre style={{ fontSize: 12, color: "#94a3b8", margin: 0, whiteSpace: "pre-wrap",
                      wordBreak: "break-word", lineHeight: 1.65, fontFamily: "monospace" }}>
                      {job.agent_output}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error */}
              {job.error && (
                <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 8,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Error</p>
                  <p style={{ fontSize: 11, color: "#ef4444", margin: 0, fontFamily: "monospace" }}>{job.error}</p>
                </div>
              )}

              {/* Tools + meta */}
              {(job.tools_used?.length || job.provider) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {job.provider && (
                    <span style={{ fontSize: 10, color: "#334155", padding: "2px 7px",
                      borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      🧠 {job.provider}
                    </span>
                  )}
                  {job.tools_used?.map((t, i) => (
                    <span key={i} style={{ fontSize: 10, color: "#334155", padding: "2px 7px",
                      borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      🔧 {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Jobs Board ────────────────────────────────────────────────────────────────
function JobsBoard({ jobs, loading, onCancel, onDelete }: {
  jobs: AgentJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const active = jobs.filter(j => j.status === "queued" || j.status === "running");
  const history = jobs.filter(j => j.status === "done" || j.status === "failed" || j.status === "cancelled");

  if (loading && !jobs.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 13, padding: "2rem 0" }}>
        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading jobs…
      </div>
    );
  }

  return (
    <div>
      {/* Active section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase",
          letterSpacing: "0.08em", margin: 0 }}>
          Active · {active.length}
        </h3>
      </div>

      {active.length === 0 ? (
        <div style={{ textAlign: "center", padding: "1.5rem", color: "#334155", fontSize: 13,
          background: "rgba(255,255,255,0.015)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)",
          marginBottom: "1rem" }}>
          No active jobs — submit one above ↑
        </div>
      ) : (
        <AnimatePresence>
          {active.map(j => <JobCard key={j.id} job={j} onCancel={onCancel} onDelete={onDelete} />)}
        </AnimatePresence>
      )}

      {/* History section */}
      {history.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <button onClick={() => setShowHistory(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              cursor: "pointer", color: "#64748b", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", padding: 0, marginBottom: "0.75rem" }}>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            History · {history.length}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {history.map(j => <JobCard key={j.id} job={j} onCancel={onCancel} onDelete={onDelete} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function JobsTab({ agents }: { agents: AgentDef[] }) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/jobs?limit=80`);
      if (!res.ok) return;
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchJobs();
    // Poll every 4s while there are running/queued jobs, else every 15s
    const tick = () => {
      fetchJobs();
      const hasActive = jobs.some(j => j.status === "queued" || j.status === "running");
      pollRef.current = setTimeout(tick, hasActive ? 4000 : 15000);
    };
    pollRef.current = setTimeout(tick, 4000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [fetchJobs, jobs]);

  const handleCancel = async (id: string) => {
    try {
      await fetch(`${BOT_URL}/admin/jobs/${id}/cancel`, { method: "POST" });
      await fetchJobs();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${BOT_URL}/admin/jobs/${id}`, { method: "DELETE" });
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch { /* silent */ }
  };

  return (
    <div style={{ maxWidth: 780 }}>
      {/* Inject spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {(["queued", "running", "done", "failed"] as const).map(s => {
          const count = jobs.filter(j => j.status === s).length;
          const cfg = { queued: { c: "#f59e0b", l: "Queued" }, running: { c: "#38bdf8", l: "Running" },
                         done:   { c: "#34d399", l: "Done"   }, failed:  { c: "#ef4444", l: "Failed"  } }[s];
          return (
            <div key={s} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12,
              background: `${cfg.c}0d`, border: `1px solid ${cfg.c}25`, color: cfg.c,
              display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontWeight: 800 }}>{count}</span>
              <span style={{ fontWeight: 400, opacity: 0.7 }}>{cfg.l}</span>
            </div>
          );
        })}
        <button onClick={fetchJobs} style={{ marginLeft: "auto", display: "flex", alignItems: "center",
          gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      <JobComposer agents={agents} onJobCreated={fetchJobs} />
      <JobsBoard jobs={jobs} loading={loading} onCancel={handleCancel} onDelete={handleDelete} />
    </div>
  );
}
