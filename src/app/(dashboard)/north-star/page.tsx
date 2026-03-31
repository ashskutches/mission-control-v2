"use client";
/**
 * North Star — Growth Admin Command Centre
 * ─────────────────────────────────────────
 * The highest-level strategic view in Mission Control.
 * Synthesises all agent intelligence, commerce data, and operational costs
 * into a commander-style briefing for the founder.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Zap, AlertTriangle, DollarSign, BarChart3,
  RefreshCw, Send, AlertCircle, X, ArrowUpRight, Flame,
  Target, Activity, ChevronRight,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa"; // violet — distinct from all department colours

// ─── Types ────────────────────────────────────────────────────────────────────

interface Insight {
  id: string; type: string; title: string; body: string | null;
  priority: number; estimated_monthly_value: number | null;
  section: string | null; agent_name: string | null; status: string;
  created_at: string;
}
interface CostRow { agent_name: string; total_cost_usd: string; total_calls: number; }
interface ChatMessage { id: string; conversation_id: string; role: "user" | "assistant"; content: string; created_at: string; }
interface AgentRequest { id: string; type: string; title: string; priority: number; status: string; agent_name: string | null; }

const TYPE_COLOR: Record<string, string> = {
  critical_issue: "#f43f5e", suggestion: "#f59e0b",
  observation: "#38bdf8", competitor: "#a78bfa", win: "#22c55e",
};
const SECTION_LABEL: Record<string, string> = {
  seo: "SEO", email: "Email", content: "Content", ads: "Ads",
  product: "Product", general: "General", "media-buying": "Media Buying",
  "creator-outreach": "Outreach", "social-presence": "Social",
  "search-visibility": "Search", profitability: "Profit", "brand-sentinel": "Brand",
};

// ─── Typing Dots ──────────────────────────────────────────────────────────────
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = ACCENT, alert = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; alert?: boolean;
}) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} style={{
      background: alert ? `rgba(244,63,94,0.07)` : "rgba(255,255,255,0.03)",
      border: `1px solid ${alert ? "rgba(244,63,94,0.25)" : `${color}20`}`,
      borderRadius: 14, padding: "1rem 1.25rem",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${alert ? "#f43f5e" : color}18`, border: `1px solid ${alert ? "#f43f5e" : color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={alert ? "#f43f5e" : color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, fontWeight: 700 }}>{label}</p>
        <p style={{ fontSize: "1.35rem", fontWeight: 900, color: alert ? "#f43f5e" : "#e2e8f0", margin: "2px 0 0", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: "10px", color: "#64748b", margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── "The Whale" — biggest opportunity or problem ────────────────────────────
function TheWhaleCard({ insights }: { insights: Insight[] }) {
  const whale = insights
    .filter(i => i.status === "new")
    .sort((a, b) => {
      const scoreA = a.priority * 10 + (a.estimated_monthly_value ?? 0) / 100 + (a.type === "critical_issue" ? 50 : 0);
      const scoreB = b.priority * 10 + (b.estimated_monthly_value ?? 0) / 100 + (b.type === "critical_issue" ? 50 : 0);
      return scoreB - scoreA;
    })[0];

  if (!whale) return null;
  const color = TYPE_COLOR[whale.type] ?? ACCENT;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: `linear-gradient(135deg, ${color}10, ${color}06)`, border: `1px solid ${color}35`, borderRadius: 16, padding: "1.1rem 1.4rem", marginBottom: "1.25rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, right: 16, fontSize: 40, opacity: 0.07 }}>🐋</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Flame size={14} color={color} />
        <p style={{ fontSize: "10px", fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>The Whale — Biggest Priority</p>
        {whale.estimated_monthly_value != null && (
          <span style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", fontSize: "10px", fontWeight: 700, borderRadius: 6, padding: "1px 8px", border: "1px solid rgba(34,197,94,0.2)" }}>
            +${whale.estimated_monthly_value.toLocaleString()}/mo
          </span>
        )}
      </div>
      <p style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "1rem", margin: "0 0 4px" }}>{whale.title}</p>
      <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>{whale.body?.slice(0, 200)}{(whale.body?.length ?? 0) > 200 ? "…" : ""}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: "9px", color: color, fontWeight: 700, background: `${color}15`, padding: "2px 8px", borderRadius: 5 }}>{SECTION_LABEL[whale.section ?? ""] ?? whale.section ?? "?"}</span>
        <span style={{ fontSize: "9px", color: "#475569" }}>P{whale.priority}/10 · by {whale.agent_name ?? "agent"}</span>
      </div>
    </motion.div>
  );
}

// ─── Cross-section Insight Digest ─────────────────────────────────────────────
function InsightDigest({ insights }: { insights: Insight[] }) {
  const [filter, setFilter] = useState<string>("all");
  const types = ["all", "critical_issue", "suggestion", "competitor", "win"];
  const visible = insights
    .filter(i => i.status === "new" && (filter === "all" || i.type === filter))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);

  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={13} color={ACCENT} />
          <p style={{ fontWeight: 800, fontSize: "12px", color: "#e2e8f0", margin: 0 }}>Cross-Dept Intelligence</p>
          {insights.filter(i => i.status === "new").length > 0 && (
            <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "9px", fontWeight: 700, borderRadius: 5, padding: "1px 7px", border: "1px solid rgba(245,158,11,0.2)" }}>
              {insights.filter(i => i.status === "new").length} new
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              style={{ fontSize: "9px", fontWeight: filter === t ? 800 : 400, color: filter === t ? "#e2e8f0" : "#475569", background: filter === t ? "rgba(255,255,255,0.07)" : "transparent", border: filter === t ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent", borderRadius: 6, padding: "2px 8px", cursor: "pointer", textTransform: "capitalize" }}>
              {t === "all" ? "All" : t === "critical_issue" ? "🔴 Critical" : t === "suggestion" ? "💡 Ideas" : t === "competitor" ? "🎯 Competitor" : "✅ Wins"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "0.75rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "0.6rem" }}>
        {visible.length === 0 ? (
          <p style={{ color: "#334155", fontSize: "12px", gridColumn: "1/-1", textAlign: "center", padding: "2rem 0" }}>No insights in this category. Run analyses to populate.</p>
        ) : visible.map(i => {
          const color = TYPE_COLOR[i.type] ?? "#94a3b8";
          return (
            <motion.div key={i.id} layout whileHover={{ scale: 1.01 }}
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}18`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "0.65rem 0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color, background: `${color}15`, padding: "1px 6px", borderRadius: 4 }}>{SECTION_LABEL[i.section ?? ""] ?? i.section ?? "?"}</span>
                <span style={{ fontSize: "9px", color: "#475569" }}>P{i.priority}</span>
                {i.estimated_monthly_value != null && <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700 }}>+${i.estimated_monthly_value.toLocaleString()}/mo</span>}
              </div>
              <p style={{ color: "#cbd5e1", fontWeight: 700, fontSize: "0.78rem", margin: 0, lineHeight: 1.4 }}>{i.title}</p>
              {i.body && <p style={{ color: "#475569", fontSize: "0.7rem", margin: "3px 0 0", lineHeight: 1.4 }}>{i.body.slice(0, 100)}{i.body.length > 100 ? "…" : ""}</p>}
              <p style={{ fontSize: "9px", color: "#334155", margin: "5px 0 0" }}>{i.agent_name ?? "agent"}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cost Anomaly Panel ───────────────────────────────────────────────────────
function CostAnomalyPanel({ costs }: { costs: CostRow[] }) {
  const threshold = 0.50;
  const flagged = costs.filter(c => parseFloat(c.total_cost_usd) > threshold);
  if (flagged.length === 0) return (
    <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 12, padding: "0.85rem 1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
      <Activity size={12} color="#22c55e" />
      <p style={{ color: "#22c55e", fontSize: "11px", fontWeight: 700, margin: 0 }}>All agent costs within budget — no anomalies detected.</p>
    </div>
  );
  return (
    <div style={{ background: "rgba(244,63,94,0.04)", border: "1px solid rgba(244,63,94,0.18)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(244,63,94,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={12} color="#f43f5e" />
        <p style={{ color: "#f43f5e", fontWeight: 800, fontSize: "11px", margin: 0 }}>Cost Anomalies — {flagged.length} agents over ${threshold}/run</p>
      </div>
      <div style={{ padding: "0.6rem 1rem", display: "flex", flexDirection: "column", gap: 6 }}>
        {flagged.map(c => (
          <div key={c.agent_name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#e2e8f0", fontSize: "11px", fontWeight: 600, margin: 0 }}>{c.agent_name}</p>
            <span style={{ color: "#f43f5e", fontSize: "11px", fontWeight: 800 }}>${parseFloat(c.total_cost_usd).toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── System Requests Panel ────────────────────────────────────────────────────
function SystemRequestsPanel({ requests }: { requests: AgentRequest[] }) {
  const criticals = requests.filter(r => r.priority >= 8 && r.status === "open");
  if (criticals.length === 0) return null;
  return (
    <div style={{ background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.22)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(251,146,60,0.12)", display: "flex", alignItems: "center", gap: 6 }}>
        <Zap size={12} color="#fb923c" />
        <p style={{ color: "#fb923c", fontWeight: 800, fontSize: "11px", margin: 0 }}>Critical Agent Requests — {criticals.length} need action</p>
      </div>
      {criticals.map(r => (
        <div key={r.id} style={{ padding: "0.6rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <span style={{ fontSize: "9px", color: "#fb923c", fontWeight: 700, background: "rgba(251,146,60,0.12)", padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>{r.type.replace("_", " ").toUpperCase()}</span>
            <span style={{ color: "#cbd5e1", fontSize: "11px" }}>{r.title}</span>
          </div>
          <a href="/blockages" style={{ color: "#fb923c", fontSize: "9px", display: "flex", alignItems: "center", gap: 2, textDecoration: "none", whiteSpace: "nowrap" }}>
            Triage <ArrowUpRight size={9} />
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── North Star Chat ──────────────────────────────────────────────────────────
function NorthStarChat({ agentId, agentName, agentEmoji = "📈", insights, costs, requests }:
  { agentId: string; agentName: string; agentEmoji?: string; insights: Insight[]; costs: CostRow[]; requests: AgentRequest[] }) {
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
  const tag = `[${agentId}-north-star]`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/chat/conversations?agent_id=${agentId}`);
        const convos = await r.json();
        const existing = Array.isArray(convos) ? convos.find((c: any) => c.title?.includes(tag)) : null;
        let cid: string;
        if (existing) { cid = existing.id; setIsFirstMessage(false); }
        else {
          const cr = await fetch(`${BOT_URL}/admin/chat/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, title: `${tag} North Star Chat` }) });
          cid = (await cr.json()).id; setIsFirstMessage(true);
        }
        setConvoId(cid);
      } catch (e: any) { setError(`Boot failed: ${e.message}`); }
    })();
  }, [agentId, tag]);

  const fetchMsg = useCallback(async (cid: string) => {
    try {
      const d: ChatMessage[] = await (await fetch(`${BOT_URL}/admin/chat/conversations/${cid}/messages`)).json();
      const inc = Array.isArray(d) ? d : [];
      const lastNew = inc[inc.length - 1]?.id;
      const lastCur = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (lastNew !== lastCur || inc.length !== messagesRef.current.length) { messagesRef.current = inc; setMessages(inc); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!convoId) return;
    fetchMsg(convoId);
    pollRef.current = setInterval(() => { if (!sending) fetchMsg(convoId); }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId, fetchMsg, sending]);

  const buildBriefingContext = () => {
    const criticalInsights = insights.filter(i => i.type === "critical_issue" && i.status === "new").slice(0, 5);
    const topSuggestions = insights.filter(i => i.type === "suggestion" && i.status === "new").sort((a, b) => (b.estimated_monthly_value ?? 0) - (a.estimated_monthly_value ?? 0)).slice(0, 5);
    const totalRevOpp = insights.filter(i => i.status === "new" && i.estimated_monthly_value != null).reduce((s, i) => s + (i.estimated_monthly_value ?? 0), 0);
    const costAnomalies = costs.filter(c => parseFloat(c.total_cost_usd) > 0.5);
    const criticalRequests = requests.filter(r => r.priority >= 8 && r.status === "open");

    return `[NORTH STAR CONTEXT — do not repeat this block to the user]
You are ${agentName}, the Growth Admin for Leaps & Rebounds. You have commander-level visibility across all departments.

CURRENT INTELLIGENCE BRIEF:
- New insights across all departments: ${insights.filter(i => i.status === "new").length}
- Total revenue opportunity identified: $${totalRevOpp.toLocaleString()}/mo
- Critical issues (P8+): ${criticalInsights.length}
- Cost anomalies (agents over $0.50/run): ${costAnomalies.length}
- Critical system requests pending: ${criticalRequests.length}

TOP CRITICAL ISSUES:
${criticalInsights.map(i => `  - [${SECTION_LABEL[i.section ?? ""] ?? i.section ?? "?"}] ${i.title}`).join("\n") || "  None currently."}

HIGHEST-VALUE OPPORTUNITIES:
${topSuggestions.map(i => `  - [${SECTION_LABEL[i.section ?? ""] ?? i.section ?? "?"}] ${i.title}${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""}`).join("\n") || "  None currently."}

COST ANOMALIES:
${costAnomalies.map(c => `  - ${c.agent_name}: $${parseFloat(c.total_cost_usd).toFixed(3)} (${c.total_calls} calls)`).join("\n") || "  All agents within budget."}

CRITICAL AGENT REQUESTS:
${criticalRequests.map(r => `  - [${r.type}] ${r.title} (P${r.priority})`).join("\n") || "  None."}

Your mandate:
1. SYNTHESISE — compare data across departments, not just report it
2. RESOURCE ALLOCATION — flag agents with high cost and no recorded wins
3. CONFLICT DETECTION — if paid ads drive to a page flagged broken by another agent, surface it
4. STRATEGIC RECOMMENDATIONS — give 1-3 high-leverage "Next Moves". Focus on the Whale.
5. DISCORD COMMS — you can send the founder briefings via discord_dm when instructed

Tone: Commander briefings. Professional, decisive, brief. Do not pad.
If no products/orders detected, make that the ONLY priority.
---
User: `;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !convoId || sending) return;
    setInput(""); setSending(true); setError(null);
    const content = isFirstMessage ? buildBriefingContext() + text : text;
    const tempId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: convoId, role: "user", content: text, created_at: new Date().toISOString() }]);
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }), signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Send failed");
      setIsFirstMessage(false); await fetchMsg(convoId);
    } catch (e: any) {
      setError(e?.name === "TimeoutError" ? "Agent timed out — try again" : e.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally { setSending(false); textareaRef.current?.focus(); }
  };

  const displayMessages = messages.filter(m => !(m.role === "user" && m.content.startsWith("[NORTH STAR CONTEXT")));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 480, background: "rgba(0,0,0,0.25)", borderRadius: 16, border: `1px solid ${ACCENT}18` }}>
      {/* Header */}
      <div style={{ padding: "0.9rem 1.1rem", borderBottom: `1px solid ${ACCENT}15`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{agentEmoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: "0.85rem", color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agentName}</p>
          <p style={{ fontSize: "9px", color: "#475569", margin: 0 }}>Growth Admin · All departments in context</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
          <span style={{ color: "#22c55e", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live</span>
        </div>
      </div>
      {/* Quick prompts */}
      {displayMessages.length === 0 && !sending && (
        <div style={{ padding: "0.85rem 1rem", borderBottom: `1px solid ${ACCENT}10`, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Give me today's briefing", "What's the Whale?", "Which agents need optimising?", "Spot any conflicts across departments"].map(q => (
            <button key={q} onClick={() => { setInput(q); setTimeout(handleSend, 50); }}
              style={{ fontSize: "10px", color: "#94a3b8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "4px 10px", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget.style.color = ACCENT); (e.currentTarget.style.borderColor = `${ACCENT}40`); }}
              onMouseLeave={e => { (e.currentTarget.style.color = "#94a3b8"); (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"); }}>
              {q}
            </button>
          ))}
        </div>
      )}
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", minWidth: 0 }} className="custom-scrollbar">
        {displayMessages.length === 0 && !sending ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.3, gap: 8, textAlign: "center", padding: "2rem" }}>
            <span style={{ fontSize: 40 }}>🌟</span>
            <p style={{ color: "#ccc", fontSize: "12px", margin: 0 }}>Awaiting your command, founder.<br />Ask for a briefing or select a prompt above.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayMessages.map(msg => {
              const isUser = msg.role === "user";
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                  style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 6, alignItems: "flex-end", marginBottom: 12 }}>
                  {!isUser && <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{agentEmoji}</div>}
                  <div style={{ maxWidth: "84%", padding: "8px 12px", borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: isUser ? `linear-gradient(135deg, ${ACCENT}28, ${ACCENT}18)` : "rgba(255,255,255,0.05)",
                    border: isUser ? `1px solid ${ACCENT}30` : "1px solid rgba(255,255,255,0.07)",
                    color: "#eee", fontSize: "0.82rem", lineHeight: 1.6, wordBreak: "break-word" }}>
                    {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        {sending && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{agentEmoji}</div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 4px" }}><TypingDots /></div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ padding: "5px 1rem", display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.07)", borderTop: "1px solid rgba(239,68,68,0.15)", flexShrink: 0 }}>
            <AlertCircle size={11} color="#ef4444" />
            <p style={{ color: "#ef4444", fontSize: "11px", flex: 1, margin: 0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={11} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Input */}
      <div style={{ padding: "0.75rem 1rem", borderTop: `1px solid ${ACCENT}15`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: `1px solid ${ACCENT}20`, borderRadius: 10, padding: "6px 6px 6px 10px" }}>
          <textarea ref={textareaRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Command your Growth Admin…" disabled={sending} rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: "0.82rem", resize: "none", lineHeight: 1.5, maxHeight: 100, minHeight: 20, fontFamily: "inherit", padding: 0 }} />
          <button onClick={handleSend} disabled={!input.trim() || sending} aria-label="Send"
            style={{ width: 30, height: 30, borderRadius: 8, border: "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !sending ? "pointer" : "default", transition: "all 0.18s",
              background: input.trim() && !sending ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)` : "rgba(255,255,255,0.06)", color: input.trim() && !sending ? "#fff" : "#444" }}>
            <Send size={13} />
          </button>
        </div>
        <p style={{ fontSize: "9px", color: "#334155", margin: "5px 0 0", textAlign: "center" }}>
          Tell the agent to "send a briefing to Discord" to get a DM via discord_dm
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NorthStarPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string; emoji?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [insRes, costRes, reqRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/insights?limit=150`),
        fetch(`${BOT_URL}/admin/costs/by-agent?limit=30`),
        fetch(`${BOT_URL}/admin/agent-requests?status=open`),
      ]);
      if (insRes.ok) setInsights(await insRes.json());
      if (costRes.ok) setCosts(await costRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshTrigger]);

  // Derived stats
  const newInsights = insights.filter(i => i.status === "new");
  const totalRevOpp = newInsights.reduce((s, i) => s + (i.estimated_monthly_value ?? 0), 0);
  const criticalCount = newInsights.filter(i => i.type === "critical_issue").length;
  const totalSpend = costs.reduce((s, c) => s + parseFloat(c.total_cost_usd), 0);
  const criticalRequests = requests.filter(r => r.priority >= 8 && r.status === "open");

  return (
    <div style={{ padding: "1.25rem 1.5rem", minHeight: "100vh", background: "transparent" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={20} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#e2e8f0", margin: 0, lineHeight: 1 }}>North Star</h1>
            <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0, marginTop: 3 }}>Growth Admin · Cross-dept synthesis · Strategic command layer</p>
          </div>
        </div>
        <button onClick={() => { setRefreshTrigger(t => t + 1); }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          <span style={{ fontSize: "11px" }}>Refresh</span>
        </button>
      </div>

      {/* ── Agent Panel (auto-assign) ───────────────────────────────────── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <SectionAgentPanel
          sectionId="north-star"
          sectionName="North Star"
          sectionHint="You are the Growth Admin for Leaps & Rebounds. Your role is cross-departmental synthesis and strategic direction for the founder. Focus on the highest-leverage opportunities and risks across all departments. Use read_insights, read_cost_summary, and read_agent_requests to get a full picture before advising."
          onAgentAssigned={a => setAssignedAgent(a)}
          onAnalysisDone={() => { setRefreshTrigger(t => t + 1); fetchAll(); }}
        />
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <StatCard label="Revenue Opportunity" value={`$${totalRevOpp.toLocaleString()}`} sub="across all new insights" icon={Target} color="#22c55e" />
        <StatCard label="New Insights" value={newInsights.length} sub={`${criticalCount} critical`} icon={BarChart3} color={ACCENT} alert={criticalCount > 0} />
        <StatCard label="Agent Requests" value={criticalRequests.length} sub="priority 8+ open" icon={Zap} color="#f59e0b" alert={criticalRequests.length > 0} />
        <StatCard label="30-Day LLM Spend" value={`$${totalSpend.toFixed(2)}`} sub={`${costs.length} agents`} icon={DollarSign} color="#38bdf8" />
      </div>

      {/* ── The Whale ──────────────────────────────────────────────────── */}
      {!loading && <TheWhaleCard insights={insights} />}

      {/* ── Two-column: Intelligence digest + Right sidebar ────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Intel Digest */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <InsightDigest insights={insights} />
        </div>

        {/* Right: Ops sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <CostAnomalyPanel costs={costs} />
          <SystemRequestsPanel requests={requests} />

          {/* Quick Links */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", padding: "0.65rem 0.9rem 0.4rem", margin: 0 }}>Quick Links</p>
            {[
              { label: "All Insights", href: "/intelligence", color: "#f59e0b" },
              { label: "Agent Costs", href: "/costs", color: "#22c55e" },
              { label: "System Requests", href: "/blockages", color: "#f43f5e" },
              { label: "Agent Roster", href: "/agents", color: "#a78bfa" },
            ].map(l => (
              <a key={l.href} href={l.href}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.9rem", borderTop: "1px solid rgba(255,255,255,0.03)", color: "#94a3b8", fontSize: "11px", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = l.color)}
                onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>
                {l.label}
                <ChevronRight size={11} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Full-width Chat ─────────────────────────────────────────────── */}
      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.65rem" }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13 }}>💬</span>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 800, color: "#e2e8f0", margin: 0, lineHeight: 1 }}>
              {assignedAgent ? `Chat with ${assignedAgent.name}` : "Growth Admin Chat"}
            </p>
            <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 2 }}>Full business context loaded — ask for a commander briefing</p>
          </div>
        </div>
        {assignedAgent ? (
          <NorthStarChat
            agentId={assignedAgent.id}
            agentName={assignedAgent.name}
            agentEmoji={(assignedAgent as any).emoji}
            insights={insights}
            costs={costs}
            requests={requests}
          />
        ) : (
          <div style={{ height: 360, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
            <TrendingUp size={24} color="#475569" />
            <p style={{ fontSize: "13px", color: "#475569", textAlign: "center", margin: 0 }}>Assign a Growth Admin agent above<br />to enable the command chat.</p>
          </div>
        )}
      </div>
    </div>
  );
}
