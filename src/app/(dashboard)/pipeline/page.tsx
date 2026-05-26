"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Users, Zap, AlertTriangle, CheckCircle2, RefreshCw,
  GitMerge, Filter, Search, X, ChevronDown, ChevronRight,
  Bot, User, ArrowRight, Clock, MoreHorizontal, Tag,
  ExternalLink, RotateCcw, AlertCircle, Bell, BellOff,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const REFRESH_MS = 20_000;

// ── Types ─────────────────────────────────────────────────────────────────────
type ItemKind = "insight" | "work" | "human_task" | "agent_task";

interface PipelineItem {
  id: string;
  _kind: ItemKind;
  title: string;
  priority?: number;
  status?: string;
  section?: string;
  type?: string;
  // Assignment
  agent_id?: string | null;
  agent_name?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  assigned_to?: string | null;
  assigned_username?: string | null;
  // Insight-specific
  body?: string | null;
  risk_tier?: string | null;
  risk_score?: number | null;
  estimated_monthly_value?: number | null;
  occurrences?: number | null;
  assigned_work_id?: string | null;
  // Work-specific
  milestones?: { label: string; done: boolean }[] | null;
  current_milestone?: number | null;
  last_progress?: string | null;
  effort_tier?: string | null;
  run_count?: number | null;
  // Agent task-specific
  tool_name?: string | null;
  tool_input?: any;
  human_note?: string | null;
  // Human task
  instructions?: string | null;
  due_date?: string | null;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

interface PipelineData {
  inbox: PipelineItem[];
  assigned: PipelineItem[];
  in_progress: PipelineItem[];
  blocked: PipelineItem[];
  summary: {
    inbox_count: number;
    assigned_count: number;
    in_progress_count: number;
    blocked_count: number;
    total_active: number;
  };
}

interface Agent { id: string; name: string; }
interface TeamMember { discord_id: string; username: string; display_name?: string | null; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function priorityColor(p?: number): string {
  if (!p) return "#475569";
  if (p >= 9) return "#f43f5e";
  if (p >= 7) return "#fb923c";
  if (p >= 5) return "#e98d20";
  return "#38bdf8";
}

const KIND_BADGE: Record<ItemKind, { label: string; color: string; bg: string }> = {
  insight:    { label: "Insight",    color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  work:       { label: "Work",       color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  human_task: { label: "Human Task", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  agent_task: { label: "Approval",   color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
};

const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e",
};

function milestonePercent(item: PipelineItem): number {
  const ms = item.milestones;
  if (!ms?.length) return 0;
  const done = ms.filter(m => m.done).length;
  return Math.round((done / ms.length) * 100);
}

function assigneeName(item: PipelineItem): string | null {
  return item.agent_name ?? item.assigned_agent_name ??
    item.assigned_to ?? item.assigned_username ?? null;
}

function isAgentAssigned(item: PipelineItem): boolean {
  return !!(item.agent_id ?? item.assigned_agent_id);
}

// ── Re-assign Modal ───────────────────────────────────────────────────────────
function ReassignModal({
  item, agents, teamMembers, onClose, onReassign,
}: {
  item: PipelineItem;
  agents: Agent[];
  teamMembers: TeamMember[];
  onClose: () => void;
  onReassign: (agentId: string | null, agentName: string | null, humanUsername: string | null, notify: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"agent" | "human">("agent");
  const [selected, setSelected] = useState<string | null>(null);
  const [notify, setNotify] = useState(true); // Inform Human via Discord — on by default
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      if (tab === "agent") {
        const ag = agents.find(a => a.id === selected);
        await onReassign(selected, ag?.name ?? null, null, false);
      } else {
        await onReassign(null, null, selected, notify);
      }
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  };
  const modalStyle: React.CSSProperties = {
    width: "100%", maxWidth: 480,
    background: "rgba(13,17,27,0.98)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16, padding: "1.5rem",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: "12px", textTransform: "uppercase",
    background: active ? "rgba(233,141,32,0.15)" : "transparent",
    color: active ? "#e98d20" : "#64748b",
    transition: "all 0.15s",
  });
  const itemStyle = (sel: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
    borderRadius: 8, cursor: "pointer",
    background: sel ? "rgba(233,141,32,0.1)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${sel ? "rgba(233,141,32,0.4)" : "rgba(255,255,255,0.06)"}`,
    marginBottom: 6, transition: "all 0.1s",
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }} style={modalStyle}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
              Re-assign
            </p>
            <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#e2e8f0" }}>{item.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569" }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10 }}>
          <button style={tabBtnStyle(tab === "agent")} onClick={() => setTab("agent")}>
            <Bot size={12} style={{ display: "inline", marginRight: 4 }} />Agent
          </button>
          <button style={tabBtnStyle(tab === "human")} onClick={() => setTab("human")}>
            <User size={12} style={{ display: "inline", marginRight: 4 }} />Human
          </button>
        </div>

        {/* List */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {tab === "agent" ? (
            agents.length > 0 ? agents.map(a => (
              <div key={a.id} style={itemStyle(selected === a.id)} onClick={() => setSelected(a.id)}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={14} color="#a78bfa" />
                </div>
                <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>{a.name}</span>
              </div>
            )) : <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: 24 }}>No agents available</p>
          ) : (
            teamMembers.length > 0 ? teamMembers.map(m => (
              <div key={m.discord_id} style={itemStyle(selected === m.username)} onClick={() => setSelected(m.username)}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={14} color="#22c55e" />
                </div>
                <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
                  {m.display_name ?? m.username}
                </span>
              </div>
            )) : <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: 24 }}>No team members</p>
          )}
        </div>

        {/* Inform Human toggle — only shown on Human tab */}
        {tab === "human" && selected && (
          <button
            onClick={() => setNotify(n => !n)}
            style={{
              width: "100%", marginTop: 12, padding: "9px 14px",
              borderRadius: 8, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 10, textAlign: "left",
              background: notify ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${notify ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.15s",
            }}
          >
            {/* Toggle pill */}
            <div style={{
              width: 34, height: 18, borderRadius: 9, flexShrink: 0,
              background: notify ? "#22c55e" : "rgba(255,255,255,0.15)",
              position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
                left: notify ? 18 : 2,
              }} />
            </div>
            {notify ? <Bell size={13} color="#22c55e" /> : <BellOff size={13} color="#475569" />}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: notify ? "#22c55e" : "#64748b" }}>
                {notify ? "Notify via Discord" : "No notification"}
              </p>
              <p style={{ fontSize: "10px", color: "#475569", marginTop: 1 }}>
                {notify ? "Assignee will receive a DM with a direct link" : "Silent assignment — no DM sent"}
              </p>
            </div>
          </button>
        )}

        {err && <p style={{ color: "#f43f5e", fontSize: "12px", marginTop: 8 }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!selected || saving} style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: selected ? "pointer" : "not-allowed", background: selected ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: selected ? "#fff" : "#475569", fontWeight: 700, fontSize: "13px" }}>
            {saving ? "Saving…" : "Confirm Re-assign"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Pipeline Card ──────────────────────────────────────────────────────────────
function PipelineCard({
  item, onReassign, onAction, onApprove, onReject,
}: {
  item: PipelineItem;
  onReassign: (item: PipelineItem) => void;
  onAction: () => void;
  onApprove?: (item: PipelineItem) => void;
  onReject?: (item: PipelineItem) => void;
}) {
  const badge = KIND_BADGE[item._kind];
  const pct = milestonePercent(item);
  const assignee = assigneeName(item);
  const isAgent = isAgentAssigned(item);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "12px 14px",
        marginBottom: 8, cursor: "default",
        transition: "border-color 0.15s",
      }}
    >
      {/* Top row: type badge + priority dot + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: badge.color, background: badge.bg, borderRadius: 6, padding: "2px 7px" }}>
          {badge.label}
        </span>
        {item.section && (
          <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "#475569", background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "2px 6px" }}>
            {item.section}
          </span>
        )}
        {item.risk_tier && item.risk_tier !== "low" && (
          <span style={{ fontSize: "9px", fontWeight: 800, color: RISK_COLOR[item.risk_tier] ?? "#e98d20", marginLeft: "auto" }}>
            ⚠ {item.risk_tier.toUpperCase()}
          </span>
        )}
        <span style={{ fontSize: "9px", color: "#475569", marginLeft: item.risk_tier && item.risk_tier !== "low" ? 4 : "auto" }}>
          {timeAgo(item.updated_at ?? item.created_at)}
        </span>
      </div>

      {/* Priority bar + clickable title for insights */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 3, height: 28, borderRadius: 2, background: priorityColor(item.priority), flexShrink: 0 }} />
        {item._kind === "insight" ? (
          <a href={`/pipeline/${item.id}`} style={{ fontWeight: 700, fontSize: "13px", color: "#e2e8f0", lineHeight: 1.3, flex: 1, textDecoration: "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e98d20")}
            onMouseLeave={e => (e.currentTarget.style.color = "#e2e8f0")}>
            {item.title}
          </a>
        ) : (
          <p style={{ fontWeight: 700, fontSize: "13px", color: "#e2e8f0", lineHeight: 1.3, flex: 1 }}>{item.title}</p>
        )}
      </div>

      {/* Body / last progress */}
      {(item.body ?? item.last_progress ?? item.instructions) && (
        <p style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5, marginBottom: 8, marginLeft: 11 }}>
          {(item.last_progress ?? item.body ?? item.instructions ?? "").slice(0, 120)}
          {(item.last_progress ?? item.body ?? item.instructions ?? "").length > 120 ? "…" : ""}
        </p>
      )}

      {/* Milestone progress bar (work items) */}
      {item._kind === "work" && item.milestones && item.milestones.length > 0 && (
        <div style={{ marginBottom: 8, marginLeft: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: "9px", color: "#475569" }}>
              Step {(item.current_milestone ?? 0) + 1} of {item.milestones.length}: {item.milestones[item.current_milestone ?? 0]?.label ?? ""}
            </span>
            <span style={{ fontSize: "9px", color: "#38bdf8" }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#38bdf8,#818cf8)", borderRadius: 2, transition: "width 0.4s" }} />
          </div>
        </div>
      )}

      {/* Tool info (agent_task approvals) */}
      {item._kind === "agent_task" && item.tool_name && (
        <div style={{ marginBottom: 8, marginLeft: 11, padding: "6px 10px", background: "rgba(244,63,94,0.06)", borderRadius: 6, border: "1px solid rgba(244,63,94,0.15)" }}>
          <span style={{ fontSize: "10px", color: "#f43f5e", fontWeight: 700 }}>Tool: {item.tool_name}</span>
          {item.human_note && <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: 2 }}>{item.human_note}</p>}
        </div>
      )}

      {/* Bottom row: assignee + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        {/* Assignee chip */}
        {assignee ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: isAgent ? "rgba(167,139,250,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${isAgent ? "rgba(167,139,250,0.25)" : "rgba(34,197,94,0.25)"}` }}>
            {isAgent ? <Bot size={10} color="#a78bfa" /> : <User size={10} color="#22c55e" />}
            <span style={{ fontSize: "10px", fontWeight: 700, color: isAgent ? "#a78bfa" : "#22c55e" }}>{assignee}</span>
          </div>
        ) : (
          <span style={{ fontSize: "10px", color: "#475569", fontStyle: "italic" }}>Unassigned</span>
        )}

        {/* EMV */}
        {item.estimated_monthly_value && (
          <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700 }}>
            +${item.estimated_monthly_value.toFixed(0)}/mo
          </span>
        )}

        {/* Occurrences */}
        {(item.occurrences ?? 0) > 1 && (
          <span style={{ fontSize: "10px", color: "#fb923c", fontWeight: 700 }}>
            ×{item.occurrences}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {/* Approval buttons for agent_task */}
          {item._kind === "agent_task" && onApprove && onReject && (
            <>
              <button onClick={() => onReject(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.08)", color: "#f43f5e", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
                Reject
              </button>
              <button onClick={() => onApprove(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
                Approve
              </button>
            </>
          )}

          {/* Work link */}
          {item._kind === "insight" && item.assigned_work_id && (
            <a href="/work" style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "10px", fontWeight: 700, textDecoration: "none" }}>
              <ExternalLink size={9} /> Work
            </a>
          )}

          {/* Re-assign button */}
          {item._kind !== "agent_task" && (
            <button onClick={() => onReassign(item)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: "10px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
              <RotateCcw size={9} /> Re-assign
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Stage Column ──────────────────────────────────────────────────────────────
const STAGE_META = {
  inbox:       { label: "Inbox",       icon: Inbox,        color: "#e98d20", desc: "New insights & pending approvals" },
  assigned:    { label: "Assigned",    icon: Users,        color: "#38bdf8", desc: "Queued for execution" },
  in_progress: { label: "In Progress", icon: Zap,          color: "#22c55e", desc: "Actively being worked on" },
  blocked:     { label: "Blocked",     icon: AlertTriangle, color: "#f43f5e", desc: "Needs attention" },
} as const;

type Stage = keyof typeof STAGE_META;

function StageColumn({
  stage, items, onReassign, onApprove, onReject, onAction,
}: {
  stage: Stage;
  items: PipelineItem[];
  onReassign: (item: PipelineItem) => void;
  onApprove: (item: PipelineItem) => void;
  onReject: (item: PipelineItem) => void;
  onAction: () => void;
}) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;

  return (
    <div style={{ flex: "0 0 320px", minWidth: 280, maxWidth: 360 }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={meta.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>{meta.label}</span>
            <span style={{ fontSize: "10px", fontWeight: 900, color: meta.color, background: `${meta.color}18`, borderRadius: 8, padding: "1px 7px" }}>
              {items.length}
            </span>
          </div>
          <p style={{ fontSize: "9px", color: "#475569", marginTop: 1 }}>{meta.desc}</p>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto", paddingRight: 2 }}>
        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "32px 16px", color: "#334155" }}>
              <Icon size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: "12px", fontWeight: 600 }}>All clear</p>
            </motion.div>
          ) : (
            items.map(item => (
              <PipelineCard
                key={item.id}
                item={item}
                onReassign={onReassign}
                onAction={onAction}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [reassignItem, setReassignItem] = useState<PipelineItem | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [plRes, agRes, tmRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/pipeline${sectionFilter ? `?section=${sectionFilter}` : ""}`),
        fetch(`${BOT_URL}/admin/agents`),
        fetch(`${BOT_URL}/admin/team`),
      ]);

      if (!plRes.ok) throw new Error(`Pipeline fetch failed: ${plRes.status}`);
      const pl: PipelineData = await plRes.json();
      setData(pl);

      if (agRes.ok) {
        const raw = await agRes.json();
        const arr = Array.isArray(raw) ? raw : (raw.agents ?? raw.data ?? []);
        setAgents(arr.filter((a: any) => a.active !== false).map((a: any) => ({ id: a.id, name: a.name ?? a.id })));
      }
      if (tmRes.ok) {
        const raw = await tmRes.json();
        const arr = Array.isArray(raw) ? raw : (raw.members ?? raw.data ?? []);
        setTeamMembers(arr);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sectionFilter]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(true), REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const handleReassign = async (agentId: string | null, agentName: string | null, humanUsername: string | null, notify: boolean) => {
    if (!reassignItem) return;
    const res = await fetch(`${BOT_URL}/admin/pipeline/${reassignItem.id}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_type: reassignItem._kind, agent_id: agentId, agent_name: agentName, human_username: humanUsername, notify }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
    fetchData(true);
  };

  const handleApprove = async (item: PipelineItem) => {
    await fetch(`${BOT_URL}/admin/tasks/${item.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } });
    fetchData(true);
  };

  const handleReject = async (item: PipelineItem) => {
    await fetch(`${BOT_URL}/admin/tasks/${item.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" } });
    fetchData(true);
  };

  // Filter items by search/section
  const filterItems = (items: PipelineItem[]): PipelineItem[] => {
    if (!search && !sectionFilter) return items;
    return items.filter(i => {
      const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase());
      const matchSection = !sectionFilter || i.section === sectionFilter;
      return matchSearch && matchSection;
    });
  };

  // Collect unique sections for filter
  const allSections = Array.from(new Set([
    ...(data?.inbox ?? []),
    ...(data?.assigned ?? []),
    ...(data?.in_progress ?? []),
    ...(data?.blocked ?? []),
  ].map(i => i.section).filter(Boolean)));

  const filtered = data ? {
    inbox:       filterItems(data.inbox),
    assigned:    filterItems(data.assigned),
    in_progress: filterItems(data.in_progress),
    blocked:     filterItems(data.blocked),
  } : null;

  const pageStyle: React.CSSProperties = {
    padding: "1.5rem",
    minHeight: "100vh",
    background: "var(--bg-deep, #080c14)",
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#e98d20,#c97818)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(233,141,32,0.35)" }}>
              <GitMerge size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#e2e8f0", margin: 0 }}>Pipeline</h1>
              <p style={{ color: "#475569", fontSize: "12px", marginTop: 2 }}>
                {data ? `${data.summary.total_active} active items across all stages` : "Loading…"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                style={{ paddingLeft: 28, paddingRight: 10, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: "12px", outline: "none", width: 180 }}
              />
            </div>

            {/* Section filter */}
            {allSections.length > 0 && (
              <select
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
                style={{ height: 34, paddingLeft: 10, paddingRight: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: sectionFilter ? "#e2e8f0" : "#64748b", fontSize: "12px", outline: "none" }}
              >
                <option value="">All sections</option>
                {allSections.map(s => <option key={s} value={s!}>{s}</option>)}
              </select>
            )}

            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Refresh pipeline"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, color: "#f87171", fontSize: "12px" }}>
            <AlertCircle size={12} style={{ display: "inline", marginRight: 6 }} />{error}
          </div>
        )}
      </div>

      {/* Kanban board */}
      {loading && !data ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#475569" }}>
          <RefreshCw size={24} style={{ marginRight: 10, animation: "spin 1s linear infinite" }} />
          Loading pipeline…
        </div>
      ) : filtered ? (
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 24, alignItems: "flex-start" }}>
          {(["inbox", "assigned", "in_progress", "blocked"] as Stage[]).map(stage => (
            <StageColumn
              key={stage}
              stage={stage}
              items={filtered[stage]}
              onReassign={setReassignItem}
              onApprove={handleApprove}
              onReject={handleReject}
              onAction={() => fetchData(true)}
            />
          ))}
        </div>
      ) : null}

      {/* Re-assign modal */}
      <AnimatePresence>
        {reassignItem && (
          <ReassignModal
            item={reassignItem}
            agents={agents}
            teamMembers={teamMembers}
            onClose={() => setReassignItem(null)}
            onReassign={handleReassign}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
