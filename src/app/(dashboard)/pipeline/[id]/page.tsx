"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, User, AlertTriangle, CheckCircle2, Clock,
  Zap, Tag, DollarSign, BarChart2, RefreshCw, SendHorizonal,
  AlertCircle, ExternalLink, GitMerge, Activity, Shield,
  ChevronRight, MessageSquare, CircleCheck, Info,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Insight {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  section?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  status: string;
  priority?: number | null;
  risk_tier?: string | null;
  risk_score?: number | null;
  estimated_monthly_value?: number | null;
  difficulty?: number | null;
  effort?: string | null;
  occurrences?: number | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  assigned_work_id?: string | null;
  assigned_task_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface WorkItem {
  id: string;
  title: string;
  status: string;
  milestones?: { label: string; done: boolean }[] | null;
  current_milestone?: number | null;
  last_progress?: string | null;
  completion_report?: string | null;
  agent_name?: string | null;
  run_count?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface HumanTask {
  id: string;
  title: string;
  status: string;
  assigned_to?: string | null;
  instructions?: string | null;
  completion_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AgentInfo {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean;
}

interface FeedbackEntry {
  action: string;
  note?: string | null;
  created_at?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface DetailData {
  insight: Insight;
  work: WorkItem | null;
  human_task: HumanTask | null;
  agent: AgentInfo | null;
  feedback: FeedbackEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e",
};
const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  new:          { label: "New",         color: "#e98d20", icon: AlertCircle },
  acknowledged: { label: "Acknowledged",color: "#38bdf8", icon: Info },
  in_progress:  { label: "In Progress", color: "#22c55e", icon: Zap },
  resolved:     { label: "Resolved",    color: "#4ade80", icon: CheckCircle2 },
  dismissed:    { label: "Dismissed",   color: "#475569", icon: CircleCheck },
};

function priorityColor(p?: number | null) {
  if (!p) return "#475569";
  if (p >= 9) return "#f43f5e";
  if (p >= 7) return "#fb923c";
  if (p >= 5) return "#e98d20";
  return "#38bdf8";
}

function milestonePercent(work: WorkItem | null) {
  const ms = work?.milestones;
  if (!ms?.length) return 0;
  return Math.round((ms.filter(m => m.done).length / ms.length) * 100);
}

// ── Section: Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#64748b", icon: Info };
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 8, background: `${meta.color}18`, border: `1px solid ${meta.color}40`, color: meta.color, fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

// ── Section: Chat ─────────────────────────────────────────────────────────────
function InsightChat({ insight, agent }: { insight: Insight; agent: AgentInfo | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialise conversation with context pre-injected
  const initConv = useCallback(async () => {
    try {
      const agentId = insight.assigned_agent_id ?? insight.agent_id ?? agent?.id;
      if (!agentId) return;

      // Create a new conversation with the context in the system note
      const systemContext =
        `You are discussing insight: "${insight.title}"\n\n` +
        `Section: ${insight.section ?? "unknown"} | Type: ${insight.type ?? "unknown"} | Priority: ${insight.priority ?? "?"}/10\n` +
        `Risk: ${insight.risk_tier ?? "unknown"} | Status: ${insight.status}\n\n` +
        `Insight details:\n${insight.body ?? "(no description provided)"}\n\n` +
        `Your job: help the user understand this insight, explain why it was flagged, what the impact is, and what they should do next. Be concise and direct.`;

      const res = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, system_note: systemContext }),
      });
      if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
      const data = await res.json();
      setConvId(data.id ?? data.conversation_id ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [insight, agent]);

  useEffect(() => { initConv(); }, [initConv]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || sending || !convId) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.reply ?? data.text ?? data.message ?? "(no response)";
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const hasAgent = !!(insight.assigned_agent_id ?? insight.agent_id ?? agent?.id);
  const agentName = insight.assigned_agent_name ?? insight.agent_name ?? agent?.name ?? "Agent";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 420, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
      {/* Chat header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={15} color="#a78bfa" />
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>{agentName}</p>
          <p style={{ fontSize: "10px", color: "#475569" }}>Context: this insight is pre-loaded</p>
        </div>
        {!hasAgent && <span style={{ marginLeft: "auto", fontSize: "10px", color: "#f43f5e" }}>No agent assigned</span>}
        {!convId && hasAgent && <span style={{ marginLeft: "auto", fontSize: "10px", color: "#64748b" }}>Starting conversation…</span>}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!hasAgent && (
          <div style={{ textAlign: "center", padding: 24, color: "#475569" }}>
            <Bot size={24} style={{ marginBottom: 6, opacity: 0.3 }} />
            <p style={{ fontSize: "12px" }}>Assign an agent to this insight to start a chat</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "8px 12px", borderRadius: 10,
              background: msg.role === "user" ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)",
              color: msg.role === "user" ? "#fff" : "#cbd5e1",
              fontSize: "13px", lineHeight: 1.5,
              borderBottomRightRadius: msg.role === "user" ? 2 : 10,
              borderBottomLeftRadius: msg.role === "user" ? 10 : 2,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 10, borderBottomLeftRadius: 2 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#64748b", animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <p style={{ fontSize: "11px", color: "#f43f5e", textAlign: "center" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={hasAgent ? `Ask ${agentName} about this insight…` : "Assign an agent first"}
          disabled={!hasAgent || !convId}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: "13px", outline: "none" }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending || !convId || !hasAgent}
          aria-label="Send message"
          style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && convId && hasAgent ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: input.trim() ? "#fff" : "#475569" }}
        >
          <SendHorizonal size={14} />
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InsightDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [doneNote, setDoneNote] = useState("");
  const [showDoneBox, setShowDoneBox] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BOT_URL}/admin/pipeline/${params.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const markDone = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/pipeline/${params.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: doneNote, completed_by: "ash" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompleted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "#475569" }}>
      <RefreshCw size={22} style={{ marginRight: 10, animation: "spin 1s linear infinite" }} /> Loading insight…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 12 }}>
      <AlertCircle size={32} color="#f43f5e" />
      <p style={{ color: "#94a3b8" }}>{error ?? "Insight not found"}</p>
      <button onClick={() => router.back()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>← Go back</button>
    </div>
  );

  const { insight, work, human_task, agent, feedback } = data;
  const pct = milestonePercent(work);
  const statusMeta = STATUS_META[insight.status] ?? { label: insight.status, color: "#64748b" };

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px", ...style }}>
      {children}
    </div>
  );

  const label = (text: string) => (
    <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 4 }}>{text}</p>
  );

  const value = (text: string | number | null | undefined, fallback = "—") => (
    <p style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>{text ?? fallback}</p>
  );

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button onClick={() => router.push("/pipeline")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px", fontWeight: 600, marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={14} /> Back to Pipeline
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: "11px", color: "#475569" }}>
              <GitMerge size={11} />
              <span>Pipeline</span>
              <ChevronRight size={11} />
              {insight.section && <><span>{insight.section}</span><ChevronRight size={11} /></>}
              <span style={{ color: "#94a3b8" }}>Insight</span>
            </div>

            <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#f1f5f9", lineHeight: 1.3, marginBottom: 12 }}>
              {insight.title}
            </h1>

            {/* Status row */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={insight.status} />
              {insight.risk_tier && insight.risk_tier !== "low" && (
                <span style={{ fontSize: "10px", fontWeight: 800, color: RISK_COLOR[insight.risk_tier] ?? "#e98d20", background: `${RISK_COLOR[insight.risk_tier] ?? "#e98d20"}18`, padding: "3px 8px", borderRadius: 6, border: `1px solid ${RISK_COLOR[insight.risk_tier] ?? "#e98d20"}40` }}>
                  ⚠ {insight.risk_tier.toUpperCase()} RISK
                </span>
              )}
              {insight.type && (
                <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {insight.type}
                </span>
              )}
              <span style={{ fontSize: "10px", color: "#475569" }}>Created {timeAgo(insight.created_at)}</span>
            </div>
          </div>

          {/* ── Mark Complete button ─────────────────────────────────────────── */}
          {!completed && insight.status !== "resolved" && insight.status !== "dismissed" && (
            <div>
              {!showDoneBox ? (
                <button onClick={() => setShowDoneBox(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 800, fontSize: "13px", boxShadow: "0 4px 16px rgba(34,197,94,0.3)" }}>
                  <CheckCircle2 size={15} /> Mark Complete
                </button>
              ) : (
                <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: 14, width: 300 }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>Add a completion note (optional)</p>
                  <textarea
                    value={doneNote}
                    onChange={e => setDoneNote(e.target.value)}
                    placeholder="What was done? Any follow-up needed?"
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: "12px", outline: "none", resize: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => setShowDoneBox(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                    <button onClick={markDone} disabled={completing} style={{ flex: 2, padding: "7px 0", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                      {completing ? "Saving…" : "Confirm Done ✓"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {completed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontWeight: 800, fontSize: "13px" }}>
              <CheckCircle2 size={16} /> Marked Complete
            </div>
          )}
        </div>
      </div>

      {/* ── 2-column layout ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Why was this created */}
          {card(
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Info size={15} color="#a78bfa" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>What & Why</span>
              </div>
              {insight.body ? (
                <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{insight.body}</p>
              ) : (
                <p style={{ fontSize: "13px", color: "#475569", fontStyle: "italic" }}>No description provided by the agent.</p>
              )}

              {/* Source agent */}
              {(insight.agent_id || insight.agent_name) && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={13} color="#a78bfa" />
                  </div>
                  <div>
                    <p style={{ fontSize: "10px", color: "#475569" }}>Flagged by</p>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#a78bfa" }}>{insight.agent_name ?? insight.agent_id}</p>
                    {agent?.description && <p style={{ fontSize: "10px", color: "#64748b", marginTop: 1 }}>{agent.description}</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Linked work item progress */}
          {work && card(
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Activity size={15} color="#38bdf8" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Work Progress</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "2px 8px", borderRadius: 6 }}>{work.status}</span>
              </div>

              <p style={{ fontWeight: 700, fontSize: "13px", color: "#e2e8f0", marginBottom: 10 }}>{work.title}</p>

              {work.milestones && work.milestones.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Step {(work.current_milestone ?? 0) + 1} of {work.milestones.length}: {work.milestones[work.current_milestone ?? 0]?.label ?? ""}
                    </span>
                    <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 3, marginBottom: 14 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#38bdf8,#818cf8)", borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {work.milestones.map((ms, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: ms.done ? "#22c55e" : i === (work.current_milestone ?? 0) ? "#38bdf8" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", color: ms.done ? "#4ade80" : i === (work.current_milestone ?? 0) ? "#e2e8f0" : "#475569" }}>{ms.label}</span>
                        {ms.done && <CheckCircle2 size={10} color="#22c55e" style={{ marginLeft: "auto" }} />}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {work.last_progress && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: "3px solid rgba(56,189,248,0.4)" }}>
                  <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, marginBottom: 4 }}>LATEST UPDATE</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>{work.last_progress}</p>
                  <p style={{ fontSize: "10px", color: "#475569", marginTop: 4 }}>{timeAgo(work.updated_at)}</p>
                </div>
              )}

              {work.completion_report && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(34,197,94,0.05)", borderRadius: 8, borderLeft: "3px solid rgba(34,197,94,0.4)" }}>
                  <p style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>COMPLETION REPORT</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>{work.completion_report}</p>
                </div>
              )}

              {work.agent_name && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Bot size={12} color="#a78bfa" />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Assigned to</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>{work.agent_name}</span>
                  {work.run_count != null && <span style={{ fontSize: "10px", color: "#475569", marginLeft: "auto" }}>Run {work.run_count}× so far</span>}
                </div>
              )}
            </>
          )}

          {/* Human task */}
          {human_task && card(
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <User size={15} color="#22c55e" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Human Task</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 6 }}>{human_task.status}</span>
              </div>
              {human_task.assigned_to && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <User size={11} color="#22c55e" />
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>Assigned to <strong style={{ color: "#22c55e" }}>{human_task.assigned_to}</strong></span>
                </div>
              )}
              {human_task.instructions && (
                <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>{human_task.instructions}</p>
              )}
              {human_task.completion_notes && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(34,197,94,0.05)", borderRadius: 8, borderLeft: "3px solid rgba(34,197,94,0.4)" }}>
                  <p style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>DONE — NOTES</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>{human_task.completion_notes}</p>
                </div>
              )}
            </>
          )}

          {/* Feedback history */}
          {feedback.length > 0 && card(
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Clock size={14} color="#64748b" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>History</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feedback.map((fb, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 8, borderBottom: i < feedback.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e98d20", marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#e98d20", textTransform: "uppercase" }}>{fb.action}</span>
                      {fb.note && <p style={{ fontSize: "12px", color: "#64748b", marginTop: 2 }}>{fb.note}</p>}
                      <p style={{ fontSize: "10px", color: "#334155", marginTop: 2 }}>{fmt(fb.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Chat with agent */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MessageSquare size={14} color="#a78bfa" />
              <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Chat with Agent</span>
              <span style={{ fontSize: "10px", color: "#475569", background: "rgba(167,139,250,0.08)", padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(167,139,250,0.15)" }}>Insight context pre-loaded</span>
            </div>
            <InsightChat insight={insight} agent={agent} />
          </div>
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Stats card */}
          {card(
            <>
              <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Insight Metrics</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  {label("Priority")}
                  <p style={{ fontSize: "18px", fontWeight: 900, color: priorityColor(insight.priority) }}>{insight.priority ?? "—"}/10</p>
                </div>
                {insight.estimated_monthly_value != null && (
                  <div style={{ padding: "10px 12px", background: "rgba(34,197,94,0.04)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.15)" }}>
                    {label("Est. Monthly Value")}
                    <p style={{ fontSize: "18px", fontWeight: 900, color: "#22c55e" }}>${insight.estimated_monthly_value.toFixed(0)}</p>
                  </div>
                )}
                {insight.risk_score != null && (
                  <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    {label("Risk Score")}
                    <p style={{ fontSize: "18px", fontWeight: 900, color: RISK_COLOR[insight.risk_tier ?? ""] ?? "#e98d20" }}>{insight.risk_score}/10</p>
                  </div>
                )}
                {insight.occurrences != null && (
                  <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    {label("Occurrences")}
                    <p style={{ fontSize: "18px", fontWeight: 900, color: "#fb923c" }}>×{insight.occurrences}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Metadata */}
          {card(
            <>
              <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Details</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>{label("Section")}{value(insight.section)}</div>
                <div>{label("Type")}{value(insight.type)}</div>
                <div>{label("Effort")}{value(insight.effort)}</div>
                <div>{label("Difficulty")}{value(insight.difficulty != null ? `${insight.difficulty}/10` : null)}</div>
                <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {label("Created")}<p style={{ fontSize: "12px", color: "#94a3b8" }}>{fmt(insight.created_at)}</p>
                </div>
                <div>{label("Last Updated")}<p style={{ fontSize: "12px", color: "#94a3b8" }}>{fmt(insight.updated_at)}</p></div>
              </div>
            </>
          )}

          {/* Assignment */}
          {card(
            <>
              <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Assignment</p>
              {insight.assigned_agent_name || insight.assigned_agent_id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={15} color="#a78bfa" />
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#64748b" }}>Assigned agent</p>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#a78bfa" }}>{insight.assigned_agent_name ?? insight.assigned_agent_id}</p>
                  </div>
                </div>
              ) : human_task?.assigned_to ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={15} color="#22c55e" />
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", color: "#64748b" }}>Assigned to</p>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e" }}>{human_task.assigned_to}</p>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>Unassigned — re-assign from Pipeline</p>
              )}
            </>
          )}

          {/* Quick links */}
          {work && (
            <a href="/work" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(56,189,248,0.2)", background: "rgba(56,189,248,0.04)", color: "#38bdf8", textDecoration: "none" }}>
              <ExternalLink size={14} />
              <span style={{ fontWeight: 700, fontSize: "12px" }}>View in Work Queue</span>
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
