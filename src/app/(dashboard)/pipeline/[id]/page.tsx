"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, User, AlertTriangle, CheckCircle2, Clock,
  Zap, Tag, DollarSign, BarChart2, RefreshCw, SendHorizonal,
  AlertCircle, ExternalLink, GitMerge, Activity, Shield,
  ChevronRight, MessageSquare, CircleCheck, Info, RotateCcw,
  Bell, BellOff, X, Play, CheckCheck, XCircle, Wrench,
  ThumbsUp, ThumbsDown, TrendingUp, ChevronDown, ChevronUp,
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
  id: string; title: string; status: string;
  milestones?: { label: string; done: boolean }[] | null;
  current_milestone?: number | null;
  last_progress?: string | null; completion_report?: string | null;
  agent_name?: string | null; run_count?: number | null;
  created_at?: string; updated_at?: string;
}
interface HumanTask {
  id: string; title: string; status: string;
  assigned_to?: string | null; instructions?: string | null;
  completion_notes?: string | null; created_at?: string; updated_at?: string;
}
interface AgentInfo { id: string; name: string; description?: string | null; active?: boolean; }
interface FeedbackEntry { action: string; note?: string | null; created_at?: string; }
interface ChatMessage { role: "user" | "assistant"; content: string; ts: number; }
interface InsightEvent {
  id: string;
  insight_id: string;
  work_id?: string | null;
  task_id?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  human_actor?: string | null;
  event_type: string;
  title?: string | null;
  detail?: string | null;
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  tool_output?: string | null;
  metadata?: Record<string, unknown> | null;
  run_number?: number | null;
  trace_id?: string | null;
  created_at: string;
}
interface DetailData {
  insight: Insight; work: WorkItem | null;
  human_task: HumanTask | null; agent: AgentInfo | null; feedback: FeedbackEntry[];
}
interface Agent { id: string; name: string; }
interface TeamMember { discord_id: string; username: string; display_name?: string | null; }

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
const RISK_COLOR: Record<string, string> = { critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e" };
const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  new:          { label: "New",          color: "#e98d20", icon: AlertCircle },
  acknowledged: { label: "Acknowledged", color: "#38bdf8", icon: Info },
  in_progress:  { label: "In Progress",  color: "#22c55e", icon: Zap },
  resolved:     { label: "Resolved",     color: "#4ade80", icon: CheckCircle2 },
  dismissed:    { label: "Dismissed",    color: "#475569", icon: CircleCheck },
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

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#64748b", icon: Info };
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 8, background: `${meta.color}18`, border: `1px solid ${meta.color}40`, color: meta.color, fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

// ── Re-assign Modal ───────────────────────────────────────────────────────────
function ReassignModal({ insightId, insightTitle, currentAgentId, currentAgentName, currentHuman, agents, teamMembers, onClose, onDone }: {
  insightId: string;
  insightTitle: string;
  currentAgentId?: string | null;
  currentAgentName?: string | null;
  currentHuman?: string | null;
  agents: Agent[];
  teamMembers: TeamMember[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"agent" | "human">(currentHuman && !currentAgentId ? "human" : "agent");
  const [selected, setSelected] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      let body: Record<string, any>;
      if (selected === "__auto__") {
        if (tab === "agent") {
          const res = await fetch(`${BOT_URL}/admin/insights/${insightId}/assign`, { method: "POST" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
          body = { item_type: "insight", agent_id: json.assigned_agent_id ?? json.agent_id, agent_name: json.assigned_agent_name ?? json.agent_name, notify: false };
        } else {
          const first = teamMembers[0];
          if (!first) throw new Error("No team members available");
          body = { item_type: "insight", human_username: first.username, notify };
        }
      } else if (tab === "agent") {
        body = { item_type: "insight", agent_id: selected, agent_name: agents.find(a => a.id === selected)?.name ?? null, notify: false };
      } else {
        body = { item_type: "insight", human_username: selected, notify };
      }

      if (selected !== "__auto__" || tab === "human") {
        const res = await fetch(`${BOT_URL}/admin/pipeline/${insightId}/reassign`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `HTTP ${res.status}`); }
      }
      onDone();
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: "12px", textTransform: "uppercase",
    background: active ? "rgba(233,141,32,0.15)" : "transparent",
    color: active ? "#e98d20" : "#64748b", transition: "all 0.15s",
  });
  const itemStyle = (sel: boolean, isCurrent = false): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
    borderRadius: 8, cursor: "pointer",
    background: sel ? "rgba(233,141,32,0.1)" : isCurrent ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${sel ? "rgba(233,141,32,0.4)" : isCurrent ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.06)"}`,
    marginBottom: 6, transition: "all 0.1s",
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        style={{ width: "100%", maxWidth: 480, background: "rgba(13,17,27,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Re-assign Insight</p>
            <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#e2e8f0", maxWidth: 360 }}>{insightTitle}</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10 }}>
          <button style={tabBtn(tab === "agent")} onClick={() => { setTab("agent"); setSelected(null); }}>
            <Bot size={12} style={{ display: "inline", marginRight: 4 }} />Agent
          </button>
          <button style={tabBtn(tab === "human")} onClick={() => { setTab("human"); setSelected(null); }}>
            <User size={12} style={{ display: "inline", marginRight: 4 }} />Human
          </button>
        </div>

        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {tab === "agent" ? (
            <>
              {currentAgentId && (
                <>
                  <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 4px 6px" }}>Current</p>
                  <div style={itemStyle(selected === currentAgentId, true)} onClick={() => setSelected(currentAgentId)}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot size={14} color="#38bdf8" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#38bdf8" }}>{currentAgentName ?? currentAgentId}</span>
                      <p style={{ fontSize: "10px", color: "#475569", margin: "1px 0 0" }}>Currently assigned</p>
                    </div>
                    {selected === currentAgentId && <CheckCircle2 size={14} color="#38bdf8" />}
                  </div>
                  <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "10px 4px 6px" }}>Change to</p>
                </>
              )}

              <div style={itemStyle(selected === "__auto__")} onClick={() => setSelected("__auto__")}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={14} color="#a78bfa" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: "#a78bfa" }}>Choose Automatically</span>
                  <p style={{ fontSize: "10px", color: "#64748b", margin: "1px 0 0" }}>Picks the best agent for this section</p>
                </div>
                {selected === "__auto__" && <CheckCircle2 size={14} color="#a78bfa" />}
              </div>

              {agents.length > 0 && (
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "10px 4px 6px" }}>Agents</p>
              )}
              {agents.map(a => (
                <div key={a.id} style={itemStyle(selected === a.id)} onClick={() => setSelected(a.id)}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={14} color="#a78bfa" />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0", flex: 1 }}>{a.name}</span>
                  {selected === a.id && <CheckCircle2 size={14} color="#e98d20" />}
                </div>
              ))}
              {agents.length === 0 && !currentAgentId && <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: "12px 24px" }}>No agents found</p>}
            </>
          ) : (
            <>
              {currentHuman && (
                <>
                  <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 4px 6px" }}>Current</p>
                  <div style={itemStyle(selected === currentHuman, true)} onClick={() => setSelected(currentHuman)}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <User size={14} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#22c55e" }}>{currentHuman}</span>
                      <p style={{ fontSize: "10px", color: "#475569", margin: "1px 0 0" }}>Currently assigned</p>
                    </div>
                    {selected === currentHuman && <CheckCircle2 size={14} color="#22c55e" />}
                  </div>
                  <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "10px 4px 6px" }}>Change to</p>
                </>
              )}

              <div style={itemStyle(selected === "__auto__")} onClick={() => setSelected("__auto__")}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={14} color="#a78bfa" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: "#a78bfa" }}>Choose Automatically</span>
                  <p style={{ fontSize: "10px", color: "#64748b", margin: "1px 0 0" }}>Assigns to the first available team member</p>
                </div>
                {selected === "__auto__" && <CheckCircle2 size={14} color="#a78bfa" />}
              </div>

              {teamMembers.length > 0 && (
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", margin: "10px 4px 6px" }}>Team</p>
              )}
              {teamMembers.map(m => (
                <div key={m.discord_id} style={itemStyle(selected === m.username)} onClick={() => setSelected(m.username)}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={14} color="#22c55e" />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0", flex: 1 }}>{m.display_name ?? m.username}</span>
                  {selected === m.username && <CheckCircle2 size={14} color="#e98d20" />}
                </div>
              ))}
              {teamMembers.length === 0 && !currentHuman && <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: "12px 24px" }}>No team members found</p>}
            </>
          )}
        </div>

        {tab === "human" && selected && selected !== "__auto__" && (
          <button onClick={() => setNotify(n => !n)}
            style={{ width: "100%", marginTop: 12, padding: "9px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: notify ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${notify ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.15s" }}>
            <div style={{ width: 34, height: 18, borderRadius: 9, flexShrink: 0, background: notify ? "#22c55e" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", left: notify ? 18 : 2 }} />
            </div>
            {notify ? <Bell size={13} color="#22c55e" /> : <BellOff size={13} color="#475569" />}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: notify ? "#22c55e" : "#64748b" }}>{notify ? "Notify via Discord" : "No notification"}</p>
              <p style={{ fontSize: "10px", color: "#475569", marginTop: 1 }}>{notify ? "Assignee gets a DM with a direct link" : "Silent assignment — no DM sent"}</p>
            </div>
          </button>
        )}

        {err && <p style={{ color: "#f43f5e", fontSize: "12px", marginTop: 8 }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Cancel</button>
          <button onClick={handleSave} disabled={!selected || saving}
            style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: selected ? "pointer" : "not-allowed", background: selected ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: selected ? "#fff" : "#475569", fontWeight: 700, fontSize: "13px" }}>
            {saving ? "Saving…" : "Confirm Re-assign"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Activity Timeline ─────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; color: string; bg: string; Icon: React.FC<any> }> = {
  insight_created:    { label: "Created",            color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  Icon: AlertCircle },
  insight_approved:   { label: "Approved",           color: "#22c55e", bg: "rgba(34,197,94,0.12)",   Icon: ThumbsUp },
  insight_rejected:   { label: "Rejected",           color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   Icon: ThumbsDown },
  insight_dismissed:  { label: "Dismissed",          color: "#475569", bg: "rgba(71,85,105,0.12)",   Icon: XCircle },
  work_started:       { label: "Work Started",       color: "#a78bfa", bg: "rgba(167,139,250,0.12)", Icon: Play },
  run_started:        { label: "Run Started",        color: "#6366f1", bg: "rgba(99,102,241,0.12)",  Icon: RefreshCw },
  tool_called:        { label: "Tool Called",        color: "#e98d20", bg: "rgba(233,141,32,0.12)",  Icon: Wrench },
  progress_updated:   { label: "Progress",           color: "#38bdf8", bg: "rgba(56,189,248,0.10)",  Icon: TrendingUp },
  milestone_reached:  { label: "Milestone",          color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  Icon: CheckCheck },
  work_completed:     { label: "Completed",          color: "#4ade80", bg: "rgba(74,222,128,0.12)",  Icon: CheckCircle2 },
  work_blocked:       { label: "Blocked",            color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   Icon: AlertTriangle },
  approval_requested: { label: "Approval Requested", color: "#fb923c", bg: "rgba(251,146,60,0.12)",  Icon: Shield },
  approval_granted:   { label: "Approved",           color: "#22c55e", bg: "rgba(34,197,94,0.12)",   Icon: ThumbsUp },
  approval_rejected:  { label: "Rejected",           color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   Icon: ThumbsDown },
  tool_executed:      { label: "Tool Executed",      color: "#e98d20", bg: "rgba(233,141,32,0.12)",  Icon: Wrench },
  human_task_created: { label: "Human Task",         color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  Icon: User },
  human_task_completed: { label: "Task Done",        color: "#4ade80", bg: "rgba(74,222,128,0.12)",  Icon: CheckCircle2 },
};

function EventCard({ event, isLast }: { event: InsightEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[event.event_type] ?? { label: event.event_type, color: "#64748b", bg: "rgba(100,116,139,0.1)", Icon: Info };
  const { Icon } = meta;
  const hasExpandable = !!(event.tool_input || event.tool_output || (event.detail && event.detail.length > 120));
  const isError = event.event_type === "work_blocked" ||
    (event.tool_output && event.tool_output.startsWith("Error:")) ||
    (event.metadata as any)?.is_error;

  return (
    <div style={{ display: "flex", gap: 12, paddingBottom: isLast ? 0 : 20, position: "relative" }}>
      {!isLast && (
        <div style={{
          position: "absolute", left: 15, top: 30, bottom: 0, width: 1,
          background: "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)",
        }} />
      )}
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0, zIndex: 1,
        background: meta.bg, border: `1px solid ${meta.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: meta.color }}>{meta.label}</span>
          {event.run_number != null && event.run_number > 0 && (
            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 700 }}>RUN {event.run_number}</span>
          )}
          {event.tool_name && (
            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: 4, background: "rgba(233,141,32,0.12)", color: "#e98d20", fontWeight: 600, fontFamily: "monospace" }}>{event.tool_name}</span>
          )}
          {isError && (
            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: 4, background: "rgba(244,63,94,0.12)", color: "#f43f5e", fontWeight: 700 }}>ERROR</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#334155", flexShrink: 0 }}>{timeAgo(event.created_at)}</span>
        </div>
        {event.title && <p style={{ fontSize: "12px", color: "#cbd5e1", marginTop: 2, fontWeight: 500 }}>{event.title}</p>}
        {(event.agent_name || event.human_actor) && (
          <p style={{ fontSize: "10px", color: "#475569", marginTop: 1 }}>
            {event.agent_name
              ? <><Bot size={9} style={{ display: "inline", marginRight: 3 }} />{event.agent_name}</>
              : <><User size={9} style={{ display: "inline", marginRight: 3 }} />{event.human_actor}</>}
          </p>
        )}
        {event.detail && !expanded && event.detail.length <= 120 && (
          <p style={{ fontSize: "11px", color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{event.detail}</p>
        )}
        {hasExpandable && (
          <button onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", color: "#64748b", fontSize: "10px", fontWeight: 600, padding: 0 }}>
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 8, overflow: "hidden" }}>
            {event.detail && event.detail.length > 120 && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8, maxHeight: 300, overflowY: "auto" }}>
                {event.detail}
              </div>
            )}
            {event.tool_input && Object.keys(event.tool_input).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>INPUT</p>
                <pre style={{ fontSize: "10px", color: "#94a3b8", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "8px 10px", overflowX: "auto", maxHeight: 200, margin: 0 }}>{JSON.stringify(event.tool_input, null, 2)}</pre>
              </div>
            )}
            {event.tool_output && (
              <div>
                <p style={{ fontSize: "9px", fontWeight: 800, color: isError ? "#f43f5e" : "#334155", textTransform: "uppercase", marginBottom: 4 }}>OUTPUT</p>
                <pre style={{ fontSize: "10px", color: isError ? "#fca5a5" : "#94a3b8", background: isError ? "rgba(244,63,94,0.06)" : "rgba(0,0,0,0.3)", border: `1px solid ${isError ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 6, padding: "8px 10px", overflowX: "auto", maxHeight: 300, margin: 0, whiteSpace: "pre-wrap" }}>{event.tool_output}</pre>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ActivityTimeline({ events, loading }: { events: InsightEvent[]; loading: boolean }) {
  const [filter, setFilter] = useState<"all" | "runs" | "tools" | "approvals" | "lifecycle">("all");
  const FILTER_GROUPS: Record<string, string[]> = {
    all: [],
    runs: ["run_started", "progress_updated", "milestone_reached", "work_completed", "work_blocked"],
    tools: ["tool_called", "tool_executed", "approval_requested"],
    approvals: ["approval_requested", "approval_granted", "approval_rejected"],
    lifecycle: ["insight_created", "insight_approved", "insight_rejected", "insight_dismissed", "work_started"],
  };
  const filtered = filter === "all" ? events : events.filter(e => FILTER_GROUPS[filter].includes(e.event_type));
  const filterBtn = (id: typeof filter, label: string) => (
    <button key={id} onClick={() => setFilter(id)}
      style={{ padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", background: filter === id ? "rgba(233,141,32,0.15)" : "rgba(255,255,255,0.04)", color: filter === id ? "#e98d20" : "#64748b", transition: "all 0.15s" }}>
      {label}
    </button>
  );
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Activity size={14} color="#e98d20" />
        <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Activity Timeline</span>
        {events.length > 0 && (
          <span style={{ marginLeft: 2, fontSize: "10px", padding: "1px 7px", borderRadius: 10, background: "rgba(233,141,32,0.12)", color: "#e98d20", fontWeight: 700 }}>{events.length}</span>
        )}
        {loading && <RefreshCw size={11} color="#64748b" style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} />}
      </div>
      {events.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          {filterBtn("all", "All")}
          {filterBtn("lifecycle", "Lifecycle")}
          {filterBtn("runs", "Runs")}
          {filterBtn("tools", "Tools")}
          {filterBtn("approvals", "Approvals")}
        </div>
      )}
      {loading && events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#334155" }}>
          <RefreshCw size={18} style={{ marginBottom: 6, animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "12px" }}>Loading activity…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#334155" }}>
          <Activity size={20} style={{ marginBottom: 6, opacity: 0.3 }} />
          <p style={{ fontSize: "12px" }}>{events.length === 0 ? "No activity recorded yet" : "No events match this filter"}</p>
        </div>
      ) : (
        <div style={{ paddingTop: 4 }}>
          {filtered.map((event, i) => (
            <EventCard key={event.id} event={event} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Agent Chat ────────────────────────────────────────────────────────────────
function InsightChat({ insight, agent }: { insight: Insight; agent: AgentInfo | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const initConv = useCallback(async () => {
    try {
      const agentId = insight.assigned_agent_id ?? insight.agent_id ?? agent?.id;
      if (!agentId) return;
      const systemContext =
        `You are discussing insight: "${insight.title}"\n\n` +
        `Section: ${insight.section ?? "unknown"} | Type: ${insight.type ?? "unknown"} | Priority: ${insight.priority ?? "?"}/10\n` +
        `Risk: ${insight.risk_tier ?? "unknown"} | Status: ${insight.status}\n\n` +
        `Insight details:\n${insight.body ?? "(no description provided)"}\n\n` +
        `Your job: help the user understand this insight, explain why it was flagged, what the impact is, and what they should do next. Be concise and direct.`;
      const res = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, system_note: systemContext }),
      });
      if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
      const data = await res.json();
      setConvId(data.id ?? data.conversation_id ?? null);
    } catch (e: any) { setError(e.message); }
  }, [insight, agent]);

  useEffect(() => { initConv(); }, [initConv]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || sending || !convId) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setSending(true); setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/chat/conversations/${convId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? data.text ?? data.message ?? "(no response)", ts: Date.now() }]);
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };

  const hasAgent = !!(insight.assigned_agent_id ?? insight.agent_id ?? agent?.id);
  const agentName = insight.assigned_agent_name ?? insight.agent_name ?? agent?.name ?? "Agent";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 420, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={15} color="#a78bfa" />
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>{agentName}</p>
          <p style={{ fontSize: "10px", color: "#475569" }}>Context: this insight is pre-loaded</p>
        </div>
        {!hasAgent && <span style={{ marginLeft: "auto", fontSize: "10px", color: "#f43f5e" }}>No agent assigned</span>}
        {!convId && hasAgent && <span style={{ marginLeft: "auto", fontSize: "10px", color: "#64748b" }}>Starting…</span>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!hasAgent && (
          <div style={{ textAlign: "center", padding: 24, color: "#475569" }}>
            <Bot size={24} style={{ marginBottom: 6, opacity: 0.3 }} />
            <p style={{ fontSize: "12px" }}>Assign an agent to start a chat</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 10, background: msg.role === "user" ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: msg.role === "user" ? "#fff" : "#cbd5e1", fontSize: "13px", lineHeight: 1.5, borderBottomRightRadius: msg.role === "user" ? 2 : 10, borderBottomLeftRadius: msg.role === "user" ? 10 : 2 }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 10, borderBottomLeftRadius: 2 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#64748b", animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        {error && <p style={{ fontSize: "11px", color: "#f43f5e", textAlign: "center" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={hasAgent ? `Ask ${agentName} about this insight…` : "Assign an agent first"}
          disabled={!hasAgent || !convId}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: "13px", outline: "none" }} />
        <button onClick={send} disabled={!input.trim() || sending || !convId || !hasAgent} aria-label="Send message"
          style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && convId && hasAgent ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: input.trim() ? "#fff" : "#475569" }}>
          <SendHorizonal size={14} />
        </button>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
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
  const [showReassign, setShowReassign] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<InsightEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/pipeline/${params.id}/events`);
      if (res.ok) setEvents(await res.json());
    } catch { /* silent — timeline just stays empty */ }
    finally { setEventsLoading(false); }
  }, [params.id]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [plRes, agRes, tmRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/pipeline/${params.id}`),
        fetch(`${BOT_URL}/admin/agents`),
        fetch(`${BOT_URL}/admin/team`),
      ]);
      if (!plRes.ok) throw new Error(`HTTP ${plRes.status}`);
      setData(await plRes.json());
      if (agRes.ok) {
        const raw = await agRes.json();
        const arr = Array.isArray(raw) ? raw : (raw.agents ?? raw.data ?? []);
        setAgents(arr.filter((a: any) => a.active !== false).map((a: any) => ({ id: a.id, name: a.name ?? a.id })));
      }
      if (tmRes.ok) {
        const raw = await tmRes.json();
        setTeamMembers(Array.isArray(raw) ? raw : (raw.members ?? raw.data ?? []));
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); loadEvents(); }, [load, loadEvents]);

  // Poll events every 20s while work is active
  useEffect(() => {
    const shouldPoll = data?.insight?.status === "in_progress"
      || data?.work?.status === "running"
      || data?.work?.status === "in_progress"
      || data?.work?.status === "pending";
    if (!shouldPoll) return;
    const interval = setInterval(() => { loadEvents(); }, 20_000);
    return () => clearInterval(interval);
  }, [data?.insight?.status, data?.work?.status, loadEvents]);

  const markDone = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/pipeline/${params.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: doneNote, completed_by: "ash" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompleted(true);
    } catch (e: any) { setError(e.message); }
    finally { setCompleting(false); }
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

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px", ...style }}>{children}</div>
  );
  const lbl = (text: string) => (
    <p style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 4 }}>{text}</p>
  );
  const val = (text: string | number | null | undefined, fallback = "—") => (
    <p style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>{text ?? fallback}</p>
  );

  const assignedAgent = insight.assigned_agent_name ?? insight.assigned_agent_id;
  const assignedHuman = human_task?.assigned_to;
  const hasAssignee = !!(assignedAgent || assignedHuman);

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button onClick={() => router.push("/pipeline")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px", fontWeight: 600, marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={14} /> Back to Pipeline
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: "11px", color: "#475569" }}>
              <GitMerge size={11} /><span>Pipeline</span><ChevronRight size={11} />
              {insight.section && <><span>{insight.section}</span><ChevronRight size={11} /></>}
              <span style={{ color: "#94a3b8" }}>Insight</span>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#e2e8f0", marginBottom: 10, lineHeight: 1.2 }}>{insight.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={insight.status} />
              {insight.risk_tier && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 8, background: `${RISK_COLOR[insight.risk_tier] ?? "#64748b"}18`, border: `1px solid ${RISK_COLOR[insight.risk_tier] ?? "#64748b"}40`, color: RISK_COLOR[insight.risk_tier] ?? "#64748b", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                  <Shield size={10} /> {insight.risk_tier}
                </span>
              )}
              {insight.type && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 8, background: "rgba(100,116,139,0.12)", border: "1px solid rgba(100,116,139,0.2)", color: "#94a3b8", fontSize: "11px", fontWeight: 700 }}>
                  <Tag size={10} /> {insight.type}
                </span>
              )}
              <span style={{ fontSize: "11px", color: "#475569" }}>{timeAgo(insight.created_at)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            {insight.status !== "resolved" && insight.status !== "dismissed" && (
              <button onClick={() => setShowReassign(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(233,141,32,0.3)", background: "rgba(233,141,32,0.07)", color: "#e98d20", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                <RotateCcw size={13} /> Re-assign
              </button>
            )}
            {completed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontSize: "12px", fontWeight: 700 }}>
                <CheckCircle2 size={13} /> Marked Complete
              </div>
            ) : (
              <div>
                {showDoneBox && (
                  <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
                    <input value={doneNote} onChange={e => setDoneNote(e.target.value)} placeholder="Optional completion note…"
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: "12px", outline: "none" }} />
                    <button onClick={markDone} disabled={completing}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                      {completing ? "…" : "Confirm"}
                    </button>
                  </div>
                )}
                <button onClick={() => setShowDoneBox(b => !b)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.07)", color: "#22c55e", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  <CheckCircle2 size={13} /> Mark Complete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* What & Why */}
          {card(<>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Info size={14} color="#64748b" />
              <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>What & Why</span>
            </div>
            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{insight.body ?? "No description provided."}</p>
            {insight.agent_name && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={12} color="#a78bfa" />
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Flagged by <strong style={{ color: "#a78bfa" }}>{insight.agent_name}</strong></span>
              </div>
            )}
          </>)}

          {/* Work Progress */}
          {work && card(<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} color="#64748b" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Work Progress</span>
              </div>
              <StatusBadge status={work.status} />
            </div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginBottom: 10 }}>{work.title}</p>
            {work.milestones && work.milestones.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Milestone progress</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: pct >= 100 ? "#4ade80" : "#e98d20" }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#4ade80" : "linear-gradient(90deg,#e98d20,#c97818)", borderRadius: 2, transition: "width 0.6s" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {work.milestones.map((ms, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: ms.done ? "#4ade80" : i === (work.current_milestone ?? 0) ? "#e98d20" : "rgba(255,255,255,0.12)", border: ms.done ? "none" : i === (work.current_milestone ?? 0) ? "2px solid #e98d20" : "1px solid rgba(255,255,255,0.12)" }} />
                      <span style={{ fontSize: "12px", color: ms.done ? "#4ade80" : i === (work.current_milestone ?? 0) ? "#e2e8f0" : "#475569", textDecoration: ms.done ? "line-through" : "none" }}>{ms.label}</span>
                      {ms.done && <CheckCircle2 size={10} color="#4ade80" />}
                    </div>
                  ))}
                </div>
              </>
            )}
            {work.last_progress && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>Latest Update</p>
                <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{work.last_progress}</p>
              </div>
            )}
            {work.completion_report && (
              <div style={{ padding: "10px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#4ade80", textTransform: "uppercase", marginBottom: 4 }}>Completion Report</p>
                <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{work.completion_report}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "11px", color: "#475569" }}>
              {work.agent_name && <span><Bot size={10} style={{ display: "inline", marginRight: 3 }} />{work.agent_name}</span>}
              {work.run_count != null && <span>Run {work.run_count} of 10</span>}
              <span>Updated {timeAgo(work.updated_at)}</span>
            </div>
          </>)}

          {/* Human Task */}
          {human_task && card(<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <User size={14} color="#64748b" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Human Task</span>
              </div>
              <StatusBadge status={human_task.status} />
            </div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}>{human_task.title}</p>
            {human_task.assigned_to && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <User size={11} color="#22c55e" />
                <span style={{ fontSize: "11px", color: "#22c55e" }}>Assigned to {human_task.assigned_to}</span>
              </div>
            )}
            {human_task.instructions && (
              <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>{human_task.instructions}</p>
            )}
            {human_task.completion_notes && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "#4ade80", textTransform: "uppercase", marginBottom: 4 }}>Notes</p>
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>{human_task.completion_notes}</p>
              </div>
            )}
          </>)}

          {/* Activity Timeline */}
          <ActivityTimeline events={events} loading={eventsLoading} />

          {/* Chat */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MessageSquare size={14} color="#a78bfa" />
              <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>Chat with Agent</span>
              <span style={{ fontSize: "10px", color: "#475569", background: "rgba(167,139,250,0.08)", padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(167,139,250,0.15)" }}>Insight context pre-loaded</span>
            </div>
            <InsightChat insight={insight} agent={agent} />
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Assignment */}
          {card(<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Assignment</p>
              {insight.status !== "resolved" && insight.status !== "dismissed" && (
                <button onClick={() => setShowReassign(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(233,141,32,0.3)", background: "rgba(233,141,32,0.07)", color: "#e98d20", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                  <RotateCcw size={11} /> Re-assign
                </button>
              )}
            </div>
            {assignedAgent && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bot size={15} color="#a78bfa" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "13px", color: "#a78bfa" }}>{assignedAgent}</p>
                  <p style={{ fontSize: "10px", color: "#475569" }}>Agent</p>
                </div>
              </div>
            )}
            {assignedHuman && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={15} color="#22c55e" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "13px", color: "#22c55e" }}>{assignedHuman}</p>
                  <p style={{ fontSize: "10px", color: "#475569" }}>Human · {human_task?.status ?? "assigned"}</p>
                </div>
              </div>
            )}
            {!hasAssignee && (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ fontSize: "12px", color: "#475569", marginBottom: 8 }}>Not assigned yet</p>
                <button onClick={() => setShowReassign(true)}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(233,141,32,0.3)", background: "rgba(233,141,32,0.07)", color: "#e98d20", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  Assign Now
                </button>
              </div>
            )}
            {insight.agent_name && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
                <Bot size={10} color="#475569" />
                <span style={{ fontSize: "10px", color: "#475569" }}>Created by <span style={{ color: "#64748b" }}>{insight.agent_name}</span></span>
              </div>
            )}
          </>)}

          {/* Insight Metrics */}
          {card(<>
            <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Insight Metrics</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                {lbl("Priority")}
                <p style={{ fontSize: "14px", fontWeight: 700, color: priorityColor(insight.priority) }}>{insight.priority ?? "—"}<span style={{ fontSize: "11px", color: "#475569" }}>/10</span></p>
              </div>
              {insight.estimated_monthly_value != null && (
                <div>
                  {lbl("Est. Monthly Value")}
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#4ade80" }}>
                    <DollarSign size={12} style={{ display: "inline" }} />{insight.estimated_monthly_value.toLocaleString()}
                  </p>
                </div>
              )}
              {insight.risk_score != null && (
                <div>
                  {lbl("Risk Score")}
                  <p style={{ fontSize: "14px", fontWeight: 700, color: RISK_COLOR[insight.risk_tier ?? ""] ?? "#64748b" }}>{insight.risk_score}<span style={{ fontSize: "11px", color: "#475569" }}>/10</span></p>
                </div>
              )}
              {insight.occurrences != null && (
                <div>
                  {lbl("Occurrences")}
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>×{insight.occurrences}</p>
                </div>
              )}
            </div>
          </>)}

          {/* Details */}
          {card(<>
            <p style={{ fontWeight: 800, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insight.section && <div>{lbl("Section")}{val(insight.section)}</div>}
              {insight.type && <div>{lbl("Type")}{val(insight.type)}</div>}
              {insight.effort && <div>{lbl("Effort")}{val(insight.effort)}</div>}
              {insight.difficulty != null && <div>{lbl("Difficulty")}{val(`${insight.difficulty}/10`)}</div>}
              <div>{lbl("Created")}<p style={{ fontSize: "13px", color: "#64748b" }}>{fmt(insight.created_at)}</p></div>
              <div>{lbl("Last Updated")}<p style={{ fontSize: "13px", color: "#64748b" }}>{fmt(insight.updated_at)}</p></div>
            </div>
          </>)}

          {/* View in Work Queue */}
          {work && (
            <a href="/work" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(56,189,248,0.2)", background: "rgba(56,189,248,0.05)", color: "#38bdf8", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
              <ExternalLink size={13} /> View in Work Queue
            </a>
          )}
        </div>
      </div>

      {/* Re-assign Modal */}
      <AnimatePresence>
        {showReassign && (
          <ReassignModal
            insightId={params.id}
            insightTitle={insight.title}
            currentAgentId={insight.assigned_agent_id}
            currentAgentName={insight.assigned_agent_name}
            currentHuman={human_task?.assigned_to}
            agents={agents}
            teamMembers={teamMembers}
            onClose={() => setShowReassign(false)}
            onDone={load}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
