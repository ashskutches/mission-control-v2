"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LifeBuoy, RefreshCw, Check, X } from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import SectionMetricsPanel from "@/components/SectionMetricsPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { Send, AlertCircle } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const SECTION_ID = "support";
const SECTION_NAME = "Support";
const ACCENT = "#10b981";

interface Insight {
  id: string; type: string; title: string; body: string | null;
  priority: number; estimated_monthly_value: number | null;
  difficulty: string | null; effort: string | null;
  status: string; agent_id: string; agent_name: string | null; created_at: string;
}
interface ChatMessage {
  id: string; conversation_id: string; role: "user" | "assistant";
  content: string; created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e", suggestion: "#f59e0b", observation: "#38bdf8",
  competitor: "#a78bfa", win: "#22c55e",
};
const TYPE_LABEL: Record<string, string> = {
  critical_issue: "Critical", suggestion: "Suggestion", observation: "Observation",
  competitor: "Competitor", win: "Win",
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
    setActing(true); await onFeedback(insight.id, action, note); setActing(false); setRejecting(false);
  };
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="box mb-3 p-0" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}20`, borderLeft: `3px solid ${color}`, overflow: "hidden" }}>
      <div style={{ height: 2, background: `linear-gradient(to right, ${color}, ${color}30)`, width: `${insight.priority * 10}%` }} />
      <div className="p-3">
        <div className="is-flex is-align-items-flex-start" style={{ gap: "0.5rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <span className="tag is-rounded" style={{ fontSize: "9px", background: `${color}18`, color, fontWeight: 800 }}>{TYPE_LABEL[insight.type] ?? insight.type}</span>
              <span style={{ fontSize: "10px", color: "#475569" }}>P{insight.priority}/10</span>
              {insight.difficulty && <span style={{ fontSize: "10px", color: "#475569" }}>· {insight.difficulty}</span>}
              {insight.estimated_monthly_value != null && (
                <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>+${Math.abs(insight.estimated_monthly_value).toLocaleString()}/mo</span>
              )}
            </div>
            <p className="has-text-white" style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{insight.title}</p>
            {insight.body && <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.5 }}>{insight.body.slice(0, 120)}{insight.body.length > 120 ? "…" : ""}</p>}
          </div>
        </div>
        <div className="mt-2 pt-2 is-flex is-align-items-center is-flex-wrap-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", gap: "0.4rem" }}>
          {insight.status === "new" && (
            <>
              <button onClick={() => act("accepted")} disabled={acting} className="button is-small" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><Check size={11} /> Accept</button>
              <button onClick={() => setRejecting(!rejecting)} disabled={acting} className="button is-small" style={{ background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><X size={11} /> Reject</button>
            </>
          )}
          {insight.status === "in_progress" && (
            <button onClick={() => act("completed")} disabled={acting} className="button is-small" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, fontSize: "11px", gap: "0.3rem" }}><Check size={11} /> Complete</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: "9px", color: "#334155" }}>{insight.agent_name ?? insight.agent_id}</span>
        </div>
        <AnimatePresence>
          {rejecting && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
              <input className="input is-small" placeholder="Why reject? (helps the agent learn)" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: "11px" }}
                onKeyDown={e => { if (e.key === "Enter") act("rejected", rejectNote || undefined); }} autoFocus />
              <div className="is-flex mt-1" style={{ gap: "0.4rem" }}>
                <button onClick={() => act("rejected", rejectNote || undefined)} className="button is-small" style={{ fontSize: "11px", color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "none" }}>Confirm</button>
                <button onClick={() => setRejecting(false)} className="button is-small is-ghost" style={{ fontSize: "11px", color: "#64748b" }}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 12px" }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, display: "block" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
      ))}
    </div>
  );
}

function buildContext(agentName: string, metrics: any[], insights: Insight[]) {
  const metricLines = metrics.length > 0 ? metrics.map(m => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n") : "  (No metrics yet)";
  const insightLines = insights.slice(0, 8).map(i => `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`).join("\n") || "  (None yet)";
  return `[SECTION CONTEXT — do not repeat this block to the user]\nYou are ${agentName}, Lead Customer Support Agent for Leaps & Rebounds. This chat is embedded on the Support dashboard. You manage customer service, issue resolution, and support quality for the business.\n\nCurrent Dashboard Metrics:\n${metricLines}\n\nInsights you filed:\n${insightLines}\n\nRespond as the domain expert who owns customer support for this business. Be empathetic, practical, and solution-focused.\n---\nUser: `;
}

function EmbeddedChat({ agentId, agentName, agentEmoji = "🤖", metrics, insights }: {
  agentId: string; agentName: string; agentEmoji?: string; metrics: any[]; insights: Insight[];
}) {
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/chat/conversations?agent_id=${agentId}`);
        const convos = await r.json();
        const existing = Array.isArray(convos) ? convos.find((c: any) => c.title?.includes(`[${SECTION_ID}-commerce]`)) : null;
        let cid: string;
        if (existing) { cid = existing.id; setIsFirstMessage(false); }
        else {
          const cr = await fetch(`${BOT_URL}/admin/chat/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, title: `[${SECTION_ID}-commerce] ${SECTION_NAME} Dashboard Chat` }) });
          cid = (await cr.json()).id; setIsFirstMessage(true);
        }
        setConvoId(cid);
      } catch (e: any) { setError(`Boot failed: ${e.message}`); }
    })();
  }, [agentId]);

  const fetchMessages = useCallback(async (cid: string) => {
    try {
      const d: ChatMessage[] = await (await fetch(`${BOT_URL}/admin/chat/conversations/${cid}/messages`)).json();
      const incoming = Array.isArray(d) ? d : [];
      const lastNew = incoming[incoming.length - 1]?.id;
      const lastCur = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (lastNew !== lastCur || incoming.length !== messagesRef.current.length) { messagesRef.current = incoming; setMessages(incoming); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!convoId) return;
    fetchMessages(convoId);
    pollRef.current = setInterval(() => { if (!sending) fetchMessages(convoId); }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId, fetchMessages, sending]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !convoId || sending) return;
    setInput(""); setSending(true); setError(null);
    const content = isFirstMessage ? buildContext(agentName, metrics, insights) + text : text;
    const tempId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: convoId, role: "user", content: text, created_at: new Date().toISOString() }]);
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }), signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Send failed");
      setIsFirstMessage(false); await fetchMessages(convoId);
    } catch (e: any) {
      setError(e?.name === "TimeoutError" ? "Agent timed out — try again" : e.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally { setSending(false); textareaRef.current?.focus(); }
  };

  const displayMessages = messages.filter(m => !(m.role === "user" && m.content.startsWith("[SECTION CONTEXT")));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(0,0,0,0.25)", borderRadius: 14, border: `1px solid ${ACCENT}18`, minWidth: 0 }}>
      <div style={{ padding: "0.875rem 1.1rem", borderBottom: `1px solid ${ACCENT}15`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{agentEmoji}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agentName}</p>
          <p style={{ margin: 0, fontSize: "9px", color: "#475569" }}>{SECTION_NAME} lead · context loaded</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
          <span style={{ color: "#22c55e", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "1rem", minWidth: 0 }} className="custom-scrollbar">
        {displayMessages.length === 0 && !sending ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.35, gap: 8, textAlign: "center" }}>
            <span style={{ fontSize: 36 }}>{agentEmoji}</span>
            <p style={{ color: "#ccc", fontSize: "12px", margin: 0 }}>Ask {agentName} about {SECTION_NAME} strategy.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayMessages.map(msg => {
              const isUser = msg.role === "user";
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                  style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 6, alignItems: "flex-end", marginBottom: 10 }}>
                  {!isUser && <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{agentEmoji}</div>}
                  <div style={{ maxWidth: "82%", minWidth: 0, padding: "7px 11px", borderRadius: isUser ? "13px 13px 4px 13px" : "13px 13px 13px 4px",
                    background: isUser ? `linear-gradient(135deg, ${ACCENT}28, ${ACCENT}18)` : "rgba(255,255,255,0.05)", border: isUser ? `1px solid ${ACCENT}30` : "1px solid rgba(255,255,255,0.07)",
                    color: "#eee", fontSize: "0.8rem", lineHeight: 1.55, wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: isUser ? "pre-wrap" : undefined }}>
                    {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <AnimatePresence>
          {sending && (
            <motion.div key="typing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{agentEmoji}</div>
              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "13px 13px 13px 4px" }}><TypingDots /></div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ padding: "5px 1rem", display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.07)", borderTop: "1px solid rgba(239,68,68,0.15)", flexShrink: 0 }}>
            <AlertCircle size={11} color="#ef4444" />
            <p style={{ color: "#ef4444", fontSize: "11px", margin: 0, flex: 1 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={11} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ padding: "0.75rem 1rem", borderTop: `1px solid ${ACCENT}15`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: `1px solid ${ACCENT}20`, borderRadius: 10, padding: "6px 6px 6px 10px" }}>
          <textarea ref={textareaRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Ask ${agentName} about ${SECTION_NAME}…`} disabled={sending} rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: "0.8rem", resize: "none", lineHeight: 1.5, maxHeight: 100, minHeight: 20, fontFamily: "inherit", padding: 0 }} />
          <button onClick={handleSend} disabled={!input.trim() || sending} aria-label="Send"
            style={{ width: 28, height: 28, borderRadius: 7, border: "none", flexShrink: 0, transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !sending ? "pointer" : "default",
              background: input.trim() && !sending ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)` : "rgba(255,255,255,0.06)", color: input.trim() && !sending ? "#fff" : "#444" }}>
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [statusFilter, setStatusFilter] = useState("new");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string; emoji?: string; color?: string } | null>(null);

  const fetchInsights = useCallback(async () => {
    try { const res = await fetch(`${BOT_URL}/admin/insights?section=${SECTION_ID}&limit=50`); if (res.ok) setInsights(await res.json()); } catch { /* silent */ }
  }, []);
  const fetchMetrics = useCallback(async () => {
    try { const res = await fetch(`${BOT_URL}/admin/section-metrics?section=${SECTION_ID}`); if (res.ok) setMetrics(await res.json()); } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchInsights(); fetchMetrics(); }, [fetchInsights, fetchMetrics]);
  const handleAnalysisDone = () => { setRefreshTrigger(t => t + 1); fetchInsights(); fetchMetrics(); };
  const handleFeedback = async (id: string, action: "accepted" | "rejected" | "completed" | "dismissed", note?: string) => {
    try { await fetch(`${BOT_URL}/admin/insights/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) }); await fetchInsights(); } catch { /* silent */ }
  };

  const filtered = insights.filter(i => i.status === statusFilter);
  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => { acc[s] = insights.filter(i => i.status === s).length; return acc; }, {});

  return (
    <div style={{ padding: "1.25rem 1.5rem", height: "calc(100vh - 60px)", display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <div className="is-flex is-justify-content-space-between is-align-items-center mb-4" style={{ flexShrink: 0 }}>
        <div className="is-flex is-align-items-center" style={{ gap: "0.65rem" }}>
          <LifeBuoy size={20} color={ACCENT} />
          <div>
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.25rem", lineHeight: 1 }}>{SECTION_NAME}</h1>
            <p className="has-text-grey-light" style={{ fontSize: "0.75rem" }}>Commerce · Customer Service · Issue Resolution</p>
          </div>
        </div>
        <button onClick={() => { fetchInsights(); fetchMetrics(); setRefreshTrigger(t => t + 1); }} className="button is-small is-ghost" style={{ color: "#64748b" }}><RefreshCw size={13} /></button>
      </div>
      <div style={{ flexShrink: 0, marginBottom: "1rem" }}>
        <SectionAgentPanel sectionId={SECTION_ID} sectionName={SECTION_NAME} onAgentAssigned={a => setAssignedAgent(a)} onAnalysisDone={handleAnalysisDone} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.25rem", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          <div style={{ flexShrink: 0, marginBottom: "1rem" }}>
            <SectionMetricsPanel sectionId={SECTION_ID} agentName={assignedAgent?.name} refreshTrigger={refreshTrigger} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minWidth: 0 }} className="custom-scrollbar">
            <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
              <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Insights & Recommendations</p>
              <a href={`/intelligence?section=${SECTION_ID}`} style={{ fontSize: "10px", color: "#334155" }}>View all →</a>
            </div>
            <div className="is-flex mb-3" style={{ gap: "0.35rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem" }}>
              {STATUS_FILTERS.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className="button is-small" style={{ background: statusFilter === s ? "rgba(255,255,255,0.08)" : "transparent", color: statusFilter === s ? "#e2e8f0" : "#475569", border: statusFilter === s ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent", fontWeight: statusFilter === s ? 700 : 400, fontSize: "10px", textTransform: "capitalize" }}>
                  {s.replace("_", " ")}{counts[s] > 0 && <span className="ml-1" style={{ fontSize: "9px", color: s === "new" && counts[s] > 0 ? "#f59e0b" : "#475569" }}>{counts[s]}</span>}
                </button>
              ))}
            </div>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0
                ? <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: "0.82rem", color: "#334155", textAlign: "center", padding: "2rem 0" }}>No {statusFilter.replace("_", " ")} insights.{statusFilter === "new" ? " Run an analysis to generate findings." : ""}</motion.p>
                : filtered.map(insight => <InsightCard key={insight.id} insight={insight} onFeedback={handleFeedback} />)
              }
            </AnimatePresence>
          </div>
        </div>
        <div style={{ minWidth: 0, minHeight: 0 }}>
          {assignedAgent ? (
            <EmbeddedChat agentId={assignedAgent.id} agentName={assignedAgent.name} agentEmoji={(assignedAgent as any).emoji} metrics={metrics} insights={insights} />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: "12px", color: "#475569", textAlign: "center" }}>Assign a lead agent<br />to enable the chat panel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
