"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Inbox, Users, Zap, AlertTriangle, Bot, User,
  LayoutGrid, LayoutList, RefreshCw, Search, X, ChevronDown,
  ChevronUp, Filter, SortAsc, SortDesc, CheckSquare, Square,
  Trash2, RotateCcw, CheckCheck, DollarSign, TrendingUp,
  AlertCircle, ExternalLink, Clock, Tag, Layers, CheckCircle2,
  XCircle, Sparkles, Bell, BellOff, ArrowUpDown,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────
type ItemKind = "insight" | "work" | "human_task" | "agent_task";
type StageName = "inbox" | "assigned" | "in_progress" | "blocked";
type ViewMode = "grid" | "table";
type SortField = "priority" | "created_at" | "updated_at" | "estimated_monthly_value" | "risk_score" | "title";
type GroupBy = "none" | "section" | "agent" | "kind" | "risk_tier";

interface PipelineItem {
  id: string; _kind: ItemKind; title: string;
  priority?: number; status?: string; section?: string; type?: string;
  agent_id?: string | null; agent_name?: string | null;
  assigned_agent_id?: string | null; assigned_agent_name?: string | null;
  assigned_to?: string | null; assigned_username?: string | null;
  body?: string | null; risk_tier?: string | null; risk_score?: number | null;
  estimated_monthly_value?: number | null; occurrences?: number | null;
  assigned_work_id?: string | null; insight_id?: string | null;
  milestones?: { label: string; done: boolean }[] | null;
  current_milestone?: number | null; last_progress?: string | null;
  effort_tier?: string | null; run_count?: number | null;
  tool_name?: string | null; tool_input?: any; human_note?: string | null;
  instructions?: string | null; due_date?: string | null;
  created_at?: string; updated_at?: string;
}
interface PipelineData {
  inbox: PipelineItem[]; assigned: PipelineItem[];
  in_progress: PipelineItem[]; blocked: PipelineItem[];
}
interface Agent { id: string; name: string; }
interface TeamMember { discord_id: string; username: string; display_name?: string | null; }

// ── Stage meta ────────────────────────────────────────────────────────────────
const STAGE_META: Record<StageName, { label: string; icon: React.FC<any>; color: string; gradFrom: string; gradTo: string; desc: string }> = {
  inbox:       { label: "Inbox",       icon: Inbox,         color: "#e98d20", gradFrom: "#e98d20", gradTo: "#c97818", desc: "New insights and pending agent approvals waiting for triage" },
  assigned:    { label: "Assigned",    icon: Users,         color: "#38bdf8", gradFrom: "#38bdf8", gradTo: "#0ea5e9", desc: "Items queued for execution — assigned to an agent or team member" },
  in_progress: { label: "In Progress", icon: Zap,           color: "#22c55e", gradFrom: "#22c55e", gradTo: "#16a34a", desc: "Actively being worked on right now" },
  blocked:     { label: "Blocked",     icon: AlertTriangle, color: "#f43f5e", gradFrom: "#f43f5e", gradTo: "#e11d48", desc: "Needs attention — waiting on a dependency or decision" },
};

const KIND_BADGE: Record<ItemKind, { label: string; color: string; bg: string }> = {
  insight:    { label: "Insight",    color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  work:       { label: "Work",       color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  human_task: { label: "Human Task", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  agent_task: { label: "Approval",   color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
};

const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function fmtValue(v?: number | null): string {
  if (!v) return "";
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
}
function priorityColor(p?: number): string {
  if (!p) return "#475569";
  if (p >= 9) return "#f43f5e";
  if (p >= 7) return "#fb923c";
  if (p >= 5) return "#e98d20";
  return "#38bdf8";
}
function assigneeName(item: PipelineItem): string | null {
  return item.agent_name ?? item.assigned_agent_name ?? item.assigned_to ?? item.assigned_username ?? null;
}
function isAgentItem(item: PipelineItem): boolean {
  return !!(item.agent_id ?? item.assigned_agent_id);
}
function milestonePercent(item: PipelineItem): number {
  const ms = item.milestones;
  if (!ms?.length) return 0;
  return Math.round((ms.filter(m => m.done).length / ms.length) * 100);
}
function itemDetailHref(item: PipelineItem): string | null {
  if (item._kind === "insight") return `/pipeline/${item.id}`;
  if (item.insight_id) return `/pipeline/${item.insight_id}`;
  return null;
}

// ── Rich Grid Card ─────────────────────────────────────────────────────────────
function GridCard({
  item, selected, onSelect, onDismiss, onComplete, onReassign, stageColor,
}: {
  item: PipelineItem; selected: boolean; stageColor: string;
  onSelect: () => void; onDismiss: () => Promise<void>;
  onComplete: () => Promise<void>; onReassign: () => void;
}) {
  const [acting, setAct] = useState<string | null>(null);
  const badge = KIND_BADGE[item._kind];
  const assignee = assigneeName(item);
  const pct = milestonePercent(item);
  const href = itemDetailHref(item);

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setAct(key); try { await fn(); } finally { setAct(null); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: selected ? "rgba(233,141,32,0.06)" : "rgba(255,255,255,0.025)",
        border: selected ? `1px solid ${stageColor}55` : "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${priorityColor(item.priority)}`,
        borderRadius: 12, padding: "14px 16px",
        position: "relative", cursor: "default",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onSelect}
        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: selected ? stageColor : "#475569", padding: 0 }}
        aria-label={selected ? "Deselect" : "Select"}
      >
        {selected ? <CheckSquare size={14} /> : <Square size={14} />}
      </button>

      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: badge.color, background: badge.bg, borderRadius: 5, padding: "2px 7px" }}>
          {badge.label}
        </span>
        {item.section && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "2px 6px", textTransform: "uppercase" }}>
            {item.section}
          </span>
        )}
        {item.risk_tier && item.risk_tier !== "low" && (
          <span style={{ fontSize: 9, fontWeight: 800, color: RISK_COLOR[item.risk_tier] ?? "#e98d20" }}>
            ⚠ {item.risk_tier.toUpperCase()}
          </span>
        )}
        {item.priority && (
          <span style={{ fontSize: 9, fontWeight: 900, color: priorityColor(item.priority), marginLeft: "auto", background: `${priorityColor(item.priority)}18`, borderRadius: 5, padding: "2px 6px" }}>
            P{item.priority}
          </span>
        )}
      </div>

      {/* Title */}
      {href ? (
        <a href={href} style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 6, textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.color = stageColor)}
          onMouseLeave={e => (e.currentTarget.style.color = "#e2e8f0")}>
          {item.title}
        </a>
      ) : (
        <p style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 6 }}>{item.title}</p>
      )}

      {/* Full body / progress / instructions */}
      {(item.body ?? item.last_progress ?? item.instructions) && (
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginBottom: 8 }}>
          {item.last_progress ?? item.body ?? item.instructions}
        </p>
      )}

      {/* Milestone progress */}
      {item._kind === "work" && item.milestones && item.milestones.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#475569" }}>
              Step {(item.current_milestone ?? 0) + 1}/{item.milestones.length}: {item.milestones[item.current_milestone ?? 0]?.label}
            </span>
            <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 2, transition: "width 0.4s" }} />
          </div>
        </div>
      )}

      {/* Value + assignee + time row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {item.estimated_monthly_value && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, padding: "2px 7px", display: "flex", alignItems: "center", gap: 3 }}>
            <DollarSign size={9} />{fmtValue(item.estimated_monthly_value)}/mo
          </span>
        )}
        {item.occurrences && item.occurrences > 1 && (
          <span style={{ fontSize: 10, color: "#64748b" }}>×{item.occurrences}</span>
        )}
        {assignee && (
          <span style={{ fontSize: 10, color: isAgentItem(item) ? "#a78bfa" : "#22c55e", display: "flex", alignItems: "center", gap: 3 }}>
            {isAgentItem(item) ? <Bot size={9} /> : <User size={9} />}
            {assignee}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#334155", marginLeft: "auto" }}>{timeAgo(item.updated_at ?? item.created_at)}</span>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {href && (
          <a href={href} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${stageColor}30`, color: stageColor, fontSize: 10, fontWeight: 700, textDecoration: "none", background: `${stageColor}08` }}>
            <ExternalLink size={9} /> View
          </a>
        )}
        {(item._kind === "insight" || item._kind === "work" || item._kind === "human_task") && (
          <button
            onClick={() => wrap("done", onComplete)}
            disabled={!!acting}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "none", background: acting === "done" ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.12)", color: "#22c55e", fontSize: 10, fontWeight: 700, cursor: acting ? "wait" : "pointer" }}
          >
            {acting === "done" ? <RefreshCw size={9} className="animate-spin" /> : <CheckCheck size={9} />}
            {acting === "done" ? "…" : "Done"}
          </button>
        )}
        {item._kind === "insight" && (
          <button
            onClick={() => wrap("dismiss", onDismiss)}
            disabled={!!acting}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.06)", color: "#f43f5e", fontSize: 10, fontWeight: 700, cursor: acting ? "wait" : "pointer" }}
          >
            {acting === "dismiss" ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
            {acting === "dismiss" ? "…" : "Dismiss"}
          </button>
        )}
        {item._kind !== "agent_task" && (
          <button
            onClick={onReassign}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
          >
            <RotateCcw size={9} /> Reassign
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({
  item, selected, onSelect, onDismiss, onComplete, onReassign, stageColor, even,
}: {
  item: PipelineItem; selected: boolean; stageColor: string; even: boolean;
  onSelect: () => void; onDismiss: () => Promise<void>;
  onComplete: () => Promise<void>; onReassign: () => void;
}) {
  const [acting, setAct] = useState<string | null>(null);
  const badge = KIND_BADGE[item._kind];
  const assignee = assigneeName(item);
  const href = itemDetailHref(item);
  const wrap = async (key: string, fn: () => Promise<void>) => {
    setAct(key); try { await fn(); } finally { setAct(null); }
  };

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: selected ? "rgba(233,141,32,0.06)" : even ? "rgba(255,255,255,0.015)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        transition: "background 0.1s",
      }}
    >
      {/* Checkbox */}
      <td style={{ padding: "10px 12px", width: 32 }}>
        <button onClick={onSelect} style={{ background: "none", border: "none", cursor: "pointer", color: selected ? stageColor : "#475569", padding: 0, display: "flex" }} aria-label="Select">
          {selected ? <CheckSquare size={13} /> : <Square size={13} />}
        </button>
      </td>
      {/* Priority */}
      <td style={{ padding: "10px 8px", width: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 3, height: 24, borderRadius: 2, background: priorityColor(item.priority), flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 900, color: priorityColor(item.priority) }}>
            {item.priority ?? "—"}
          </span>
        </div>
      </td>
      {/* Title */}
      <td style={{ padding: "10px 8px", maxWidth: 320 }}>
        {href ? (
          <a href={href} style={{ fontWeight: 600, fontSize: 12, color: "#e2e8f0", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onMouseEnter={e => (e.currentTarget.style.color = stageColor)}
            onMouseLeave={e => (e.currentTarget.style.color = "#e2e8f0")}>
            {item.title}
          </a>
        ) : (
          <span style={{ fontWeight: 600, fontSize: 12, color: "#e2e8f0", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
        )}
        {item.body && <p style={{ fontSize: 10, color: "#475569", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.body}</p>}
      </td>
      {/* Kind */}
      <td style={{ padding: "10px 8px", width: 90 }}>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: badge.color, background: badge.bg, borderRadius: 5, padding: "2px 6px" }}>
          {badge.label}
        </span>
      </td>
      {/* Section */}
      <td style={{ padding: "10px 8px", fontSize: 11, color: "#64748b", width: 100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.section ?? "—"}
      </td>
      {/* Assignee */}
      <td style={{ padding: "10px 8px", width: 130 }}>
        {assignee ? (
          <span style={{ fontSize: 11, color: isAgentItem(item) ? "#a78bfa" : "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
            {isAgentItem(item) ? <Bot size={10} /> : <User size={10} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{assignee}</span>
          </span>
        ) : <span style={{ color: "#334155", fontSize: 11 }}>Unassigned</span>}
      </td>
      {/* Risk */}
      <td style={{ padding: "10px 8px", width: 80 }}>
        {item.risk_tier ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: RISK_COLOR[item.risk_tier] ?? "#e98d20", textTransform: "uppercase" }}>
            {item.risk_tier}
          </span>
        ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
      </td>
      {/* Value */}
      <td style={{ padding: "10px 8px", width: 80 }}>
        {item.estimated_monthly_value ? (
          <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>{fmtValue(item.estimated_monthly_value)}</span>
        ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
      </td>
      {/* Age */}
      <td style={{ padding: "10px 8px", fontSize: 10, color: "#475569", width: 80, whiteSpace: "nowrap" }}>
        {timeAgo(item.created_at)}
      </td>
      {/* Actions */}
      <td style={{ padding: "10px 8px", width: 130 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {href && (
            <a href={href} style={{ display: "flex", alignItems: "center", padding: "3px 7px", borderRadius: 5, border: `1px solid ${stageColor}30`, color: stageColor, fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
              <ExternalLink size={9} />
            </a>
          )}
          {(item._kind === "insight" || item._kind === "work" || item._kind === "human_task") && (
            <button disabled={!!acting} onClick={() => wrap("done", onComplete)}
              style={{ display: "flex", alignItems: "center", padding: "3px 7px", borderRadius: 5, border: "none", background: "rgba(34,197,94,0.12)", color: "#22c55e", fontSize: 10, fontWeight: 700, cursor: acting ? "wait" : "pointer" }}>
              {acting === "done" ? <RefreshCw size={9} className="animate-spin" /> : <CheckCheck size={9} />}
            </button>
          )}
          {item._kind === "insight" && (
            <button disabled={!!acting} onClick={() => wrap("dismiss", onDismiss)}
              style={{ display: "flex", alignItems: "center", padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.06)", color: "#f43f5e", fontSize: 10, fontWeight: 700, cursor: acting ? "wait" : "pointer" }}>
              {acting === "dismiss" ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
            </button>
          )}
          {item._kind !== "agent_task" && (
            <button onClick={onReassign}
              style={{ display: "flex", alignItems: "center", padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: 10, cursor: "pointer" }}>
              <RotateCcw size={9} />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

// ── Sort Header Cell ───────────────────────────────────────────────────────────
function SortTh({ label, field, sort, dir, onSort }: { label: string; field: SortField; sort: SortField; dir: "asc" | "desc"; onSort: (f: SortField) => void }) {
  const active = sort === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: active ? "#e2e8f0" : "#475569", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {active ? (dir === "asc" ? <SortAsc size={10} /> : <SortDesc size={10} />) : <ArrowUpDown size={9} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  );
}

// ── Reassign mini-modal ────────────────────────────────────────────────────────
function ReassignMini({ item, agents, teamMembers, onClose, onDone }: {
  item: PipelineItem; agents: Agent[]; teamMembers: TeamMember[];
  onClose: () => void; onDone: () => void;
}) {
  const [tab, setTab] = useState<"agent" | "human">("agent");
  const [selected, setSelected] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      const payload = tab === "agent"
        ? { item_type: item._kind, agent_id: selected, agent_name: agents.find(a => a.id === selected)?.name ?? null, human_username: null, notify: false }
        : { item_type: item._kind, agent_id: null, agent_name: null, human_username: selected, notify };
      const res = await fetch(`${BOT_URL}/admin/pipeline/${item.id}/reassign`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `HTTP ${res.status}`); }
      onDone();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const tabBtn = (t: "agent" | "human"): React.CSSProperties => ({
    flex: 1, padding: "6px 0", borderRadius: 7, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 11, transition: "all 0.15s",
    background: tab === t ? "rgba(233,141,32,0.12)" : "transparent",
    color: tab === t ? "#e98d20" : "#64748b",
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 20, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 12 }}>
          <button style={tabBtn("agent")} onClick={() => setTab("agent")}><Bot size={11} style={{ display: "inline", marginRight: 4 }} />Agent</button>
          <button style={tabBtn("human")} onClick={() => setTab("human")}><User size={11} style={{ display: "inline", marginRight: 4 }} />Human</button>
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {(tab === "agent" ? agents : teamMembers.map(m => ({ id: m.username, name: m.display_name ?? m.username }))).map(opt => (
            <button key={opt.id} onClick={() => setSelected(opt.id)} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 8, border: `1px solid ${selected === opt.id ? "rgba(233,141,32,0.4)" : "rgba(255,255,255,0.06)"}`, background: selected === opt.id ? "rgba(233,141,32,0.1)" : "rgba(255,255,255,0.03)", color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {tab === "agent" ? <Bot size={13} color="#a78bfa" /> : <User size={13} color="#22c55e" />}
              {opt.name}
              {selected === opt.id && <CheckCircle2 size={12} color="#e98d20" style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
        {tab === "human" && selected && (
          <button onClick={() => setNotify(n => !n)} style={{ width: "100%", marginBottom: 12, padding: "8px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: notify ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${notify ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
            {notify ? <Bell size={12} color="#22c55e" /> : <BellOff size={12} color="#475569" />}
            <span style={{ fontSize: 11, color: notify ? "#22c55e" : "#64748b", fontWeight: 600 }}>{notify ? "Notify via Discord" : "Silent assignment"}</span>
          </button>
        )}
        {err && <p style={{ color: "#f43f5e", fontSize: 11, marginBottom: 8 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!selected || saving} style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: selected && !saving ? "pointer" : "not-allowed", background: selected ? "linear-gradient(135deg,#e98d20,#c97818)" : "rgba(255,255,255,0.06)", color: selected ? "#fff" : "#475569", fontSize: 12, fontWeight: 800 }}>
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StagePage() {
  const params = useParams();
  const router = useRouter();
  const stage = (params?.stage as StageName) ?? "inbox";
  const meta = STAGE_META[stage] ?? STAGE_META.inbox;
  const StageIcon = meta.icon;

  const [items, setItems] = useState<PipelineItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View controls
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [humanFilter, setHumanFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<ItemKind | "">("");
  const [riskFilter, setRiskFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassignItem, setReassignItem] = useState<PipelineItem | null>(null);
  const [bulkActing, setBulkActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [plRes, agRes, tmRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/pipeline`),
        fetch(`${BOT_URL}/admin/agents`),
        fetch(`${BOT_URL}/admin/team`),
      ]);
      if (!plRes.ok) throw new Error(`Pipeline fetch failed: ${plRes.status}`);
      const pl: PipelineData = await plRes.json();
      const stageItems: Record<StageName, PipelineItem[]> = {
        inbox: pl.inbox, assigned: pl.assigned,
        in_progress: pl.in_progress, blocked: pl.blocked,
      };
      setItems(stageItems[stage] ?? []);
      if (agRes.ok) {
        const raw = await agRes.json();
        const arr = Array.isArray(raw) ? raw : (raw.agents ?? []);
        setAgents(arr.filter((a: any) => a.active !== false).map((a: any) => ({ id: a.id, name: a.name ?? a.id })));
      }
      if (tmRes.ok) {
        const raw = await tmRes.json();
        setTeamMembers(Array.isArray(raw) ? raw : (raw.members ?? []));
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [stage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let list = items.filter(i => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !(i.body ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (sectionFilter && i.section !== sectionFilter) return false;
      if (agentFilter && (i.agent_id ?? i.assigned_agent_id) !== agentFilter) return false;
      if (humanFilter && (i.assigned_to ?? i.assigned_username) !== humanFilter) return false;
      if (kindFilter && i._kind !== kindFilter) return false;
      if (riskFilter && i.risk_tier !== riskFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "priority") { av = a.priority ?? 0; bv = b.priority ?? 0; }
      else if (sortField === "estimated_monthly_value") { av = a.estimated_monthly_value ?? 0; bv = b.estimated_monthly_value ?? 0; }
      else if (sortField === "risk_score") { av = a.risk_score ?? 0; bv = b.risk_score ?? 0; }
      else if (sortField === "title") { av = a.title; bv = b.title; }
      else { av = a[sortField] ?? ""; bv = b[sortField] ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, search, sectionFilter, agentFilter, humanFilter, kindFilter, riskFilter, sortField, sortDir]);

  // Grouping
  const grouped = useMemo((): [string, PipelineItem[]][] => {
    if (groupBy === "none") return [["All", filtered]];
    const map = new Map<string, PipelineItem[]>();
    for (const item of filtered) {
      let key = "Other";
      if (groupBy === "section") key = item.section ?? "No Section";
      else if (groupBy === "agent") key = assigneeName(item) ?? "Unassigned";
      else if (groupBy === "kind") key = KIND_BADGE[item._kind]?.label ?? item._kind;
      else if (groupBy === "risk_tier") key = item.risk_tier ? item.risk_tier.charAt(0).toUpperCase() + item.risk_tier.slice(1) : "No Risk";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupBy]);

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    highPriority: filtered.filter(i => (i.priority ?? 0) >= 7).length,
    withValue: filtered.filter(i => i.estimated_monthly_value).length,
    totalValue: filtered.reduce((sum, i) => sum + (i.estimated_monthly_value ?? 0), 0),
    criticalRisk: filtered.filter(i => i.risk_tier === "critical" || i.risk_tier === "high").length,
    avgPriority: filtered.length ? Math.round(filtered.reduce((s, i) => s + (i.priority ?? 0), 0) / filtered.length * 10) / 10 : 0,
  }), [filtered]);

  // Bulk action helpers
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map(i => i.id)));
  const clearSelected = () => setSelected(new Set());
  const selectedItems = filtered.filter(i => selected.has(i.id));

  const bulkDismiss = async () => {
    setBulkActing("dismiss");
    const insights = selectedItems.filter(i => i._kind === "insight");
    await Promise.all(insights.map(i =>
      fetch(`${BOT_URL}/admin/insights/${i.id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismissed", note: "Bulk dismissed" }) })
    ));
    showToast("ok", `Dismissed ${insights.length} insight(s)`);
    clearSelected(); fetchData(true); setBulkActing(null);
  };

  const bulkComplete = async () => {
    setBulkActing("complete");
    const completable = selectedItems.filter(i => i._kind !== "agent_task");
    await Promise.all(completable.map(i =>
      fetch(`${BOT_URL}/admin/pipeline/${i.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_type: i._kind, completed_by: "user" }) })
    ));
    showToast("ok", `Completed ${completable.length} item(s)`);
    clearSelected(); fetchData(true); setBulkActing(null);
  };

  const handleDismiss = async (item: PipelineItem) => {
    const res = await fetch(`${BOT_URL}/admin/insights/${item.id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismissed", note: "Dismissed from stage view" }) });
    if (!res.ok) { showToast("err", "Failed to dismiss"); return; }
    showToast("ok", "Dismissed"); fetchData(true);
  };

  const handleComplete = async (item: PipelineItem) => {
    const res = await fetch(`${BOT_URL}/admin/pipeline/${item.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_type: item._kind, completed_by: "user" }) });
    if (!res.ok) { showToast("err", "Failed to complete"); return; }
    showToast("ok", "Marked complete ✓"); fetchData(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const activeFilters = [sectionFilter, agentFilter, humanFilter, kindFilter, riskFilter].filter(Boolean).length;

  // Unique values for dropdowns
  const allSections = Array.from(new Set(items.map(i => i.section).filter(Boolean))) as string[];
  const allAgents = Array.from(new Map(items.filter(i => i.agent_id ?? i.assigned_agent_id).map(i => [(i.agent_id ?? i.assigned_agent_id)!, (i.agent_name ?? i.assigned_agent_name ?? i.agent_id)!])));
  const allHumans = Array.from(new Set(items.map(i => i.assigned_to ?? i.assigned_username).filter(Boolean))) as string[];

  const selectStyle: React.CSSProperties = {
    height: 30, paddingLeft: 8, paddingRight: 8, borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
    color: "#64748b", fontSize: 11, outline: "none",
  };

  return (
    <div style={{ padding: "1.25rem", minHeight: "100%", maxWidth: "100%" }}>

      {/* Back nav */}
      <button
        onClick={() => router.push("/pipeline")}
        style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 12, fontWeight: 600, padding: 0 }}
      >
        <ArrowLeft size={14} /> Back to Pipeline
      </button>

      {/* Stage header */}
      <div style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem", borderRadius: 14, background: `linear-gradient(135deg, ${meta.gradFrom}12, ${meta.gradTo}06)`, border: `1px solid ${meta.color}25`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${meta.color}12, transparent 70%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg,${meta.gradFrom},${meta.gradTo})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 20px ${meta.color}40` }}>
            <StageIcon size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>{meta.label}</h1>
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{meta.desc}</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => fetchData()} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { label: "Total", value: stats.total, color: meta.color },
          { label: "High Priority", value: stats.highPriority, color: "#fb923c" },
          { label: "At Risk", value: stats.criticalRisk, color: "#f43f5e" },
          { label: "Est. Value", value: fmtValue(stats.totalValue) || "—", color: "#22c55e" },
          { label: "Avg Priority", value: stats.avgPriority || "—", color: "#a78bfa" },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 72 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 9, color: "#475569", marginTop: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ paddingLeft: 26, paddingRight: 8, height: 30, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 11, outline: "none", width: 160 }} />
        </div>

        {/* Filters */}
        {allSections.length > 0 && <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={selectStyle}><option value="">All sections</option>{allSections.map(s => <option key={s} value={s}>{s}</option>)}</select>}
        {allAgents.length > 0 && (
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            style={{ ...selectStyle, color: agentFilter ? "#a78bfa" : "#64748b", border: agentFilter ? "1px solid rgba(167,139,250,0.4)" : selectStyle.border }}>
            <option value="">All agents</option>
            {allAgents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        {allHumans.length > 0 && (
          <select value={humanFilter} onChange={e => setHumanFilter(e.target.value)}
            style={{ ...selectStyle, color: humanFilter ? "#22c55e" : "#64748b", border: humanFilter ? "1px solid rgba(34,197,94,0.4)" : selectStyle.border }}>
            <option value="">All people</option>
            {allHumans.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        )}
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value as any)} style={selectStyle}>
          <option value="">All types</option>
          <option value="insight">Insights</option>
          <option value="work">Work</option>
          <option value="human_task">Human Tasks</option>
          <option value="agent_task">Approvals</option>
        </select>
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={selectStyle}>
          <option value="">All risk</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button onClick={() => { setSectionFilter(""); setAgentFilter(""); setHumanFilter(""); setKindFilter(""); setRiskFilter(""); }}
            style={{ display: "flex", alignItems: "center", gap: 4, height: 30, padding: "0 10px", borderRadius: 7, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.07)", color: "#f43f5e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <X size={10} /> {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}

        {/* Group by */}
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} style={selectStyle}>
          <option value="none">No grouping</option>
          <option value="section">Group: Section</option>
          <option value="agent">Group: Agent</option>
          <option value="kind">Group: Type</option>
          <option value="risk_tier">Group: Risk</option>
        </select>

        {/* Sort (for grid view) */}
        {view === "grid" && (
          <select value={`${sortField}:${sortDir}`}
            onChange={e => { const [f, d] = e.target.value.split(":"); setSortField(f as SortField); setSortDir(d as "asc" | "desc"); }}
            style={selectStyle}>
            <option value="priority:desc">Priority ↓</option>
            <option value="priority:asc">Priority ↑</option>
            <option value="created_at:desc">Newest</option>
            <option value="created_at:asc">Oldest</option>
            <option value="estimated_monthly_value:desc">Value ↓</option>
            <option value="risk_score:desc">Risk ↓</option>
            <option value="title:asc">A → Z</option>
          </select>
        )}

        {/* View toggle */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, marginLeft: "auto" }}>
          {([["grid", LayoutGrid], ["table", LayoutList]] as [ViewMode, any][]).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} aria-label={v}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: view === v ? `${meta.color}22` : "transparent", color: view === v ? meta.color : "#475569", transition: "all 0.15s" }}>
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", marginBottom: 12, borderRadius: 10, background: `${meta.color}10`, border: `1px solid ${meta.color}30` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{selected.size} selected</span>
            <button onClick={selectAll} style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Select all {filtered.length}</button>
            <button onClick={clearSelected} style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button disabled={!!bulkActing} onClick={bulkComplete}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "none", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: bulkActing ? "wait" : "pointer" }}>
                {bulkActing === "complete" ? <RefreshCw size={10} className="animate-spin" /> : <CheckCheck size={10} />} Mark Done
              </button>
              <button disabled={!!bulkActing} onClick={bulkDismiss}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.08)", color: "#f43f5e", fontSize: 11, fontWeight: 700, cursor: bulkActing ? "wait" : "pointer" }}>
                {bulkActing === "dismiss" ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} Dismiss All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading && items.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "#475569", gap: 10 }}>
          <RefreshCw size={20} className="animate-spin" /> Loading {meta.label}…
        </div>
      ) : error ? (
        <div style={{ padding: "12px 16px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, color: "#f87171", fontSize: 12 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#334155" }}>
          <StageIcon size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>Nothing here{activeFilters > 0 || search ? " — try adjusting filters" : ""}</p>
        </div>
      ) : view === "grid" ? (
        /* Grid View */
        <div>
          {grouped.map(([groupLabel, groupItems]) => (
            <div key={groupLabel} style={{ marginBottom: groupBy !== "none" ? 28 : 0 }}>
              {groupBy !== "none" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{groupLabel}</span>
                  <span style={{ fontSize: 10, color: meta.color, fontWeight: 900, background: `${meta.color}18`, borderRadius: 6, padding: "1px 7px" }}>{groupItems.length}</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                <AnimatePresence>
                  {groupItems.map(item => (
                    <GridCard
                      key={item.id} item={item}
                      selected={selected.has(item.id)}
                      stageColor={meta.color}
                      onSelect={() => toggleSelect(item.id)}
                      onDismiss={() => handleDismiss(item)}
                      onComplete={() => handleComplete(item)}
                      onReassign={() => setReassignItem(item)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                <th style={{ padding: "10px 12px", width: 32 }}>
                  <button onClick={selected.size === filtered.length ? clearSelected : selectAll} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 0, display: "flex" }}>
                    {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={13} /> : <Square size={13} />}
                  </button>
                </th>
                <SortTh label="P" field="priority" sort={sortField} dir={sortDir} onSort={handleSort} />
                <SortTh label="Title" field="title" sort={sortField} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Type</th>
                <th style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Section</th>
                <th style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Assigned</th>
                <th style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Risk</th>
                <SortTh label="Value/mo" field="estimated_monthly_value" sort={sortField} dir={sortDir} onSort={handleSort} />
                <SortTh label="Age" field="created_at" sort={sortField} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: "10px 8px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([groupLabel, groupItems]) => (
                <React.Fragment key={groupLabel}>
                  {groupBy !== "none" && (
                    <tr>
                      <td colSpan={10} style={{ padding: "12px 14px 6px", fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {groupLabel} ({groupItems.length})
                      </td>
                    </tr>
                  )}
                  <AnimatePresence>
                    {groupItems.map((item, idx) => (
                      <TableRow
                        key={item.id} item={item} even={idx % 2 === 0}
                        selected={selected.has(item.id)}
                        stageColor={meta.color}
                        onSelect={() => toggleSelect(item.id)}
                        onDismiss={() => handleDismiss(item)}
                        onComplete={() => handleComplete(item)}
                        onReassign={() => setReassignItem(item)}
                      />
                    ))}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reassign modal */}
      <AnimatePresence>
        {reassignItem && (
          <ReassignMini
            item={reassignItem}
            agents={agents}
            teamMembers={teamMembers}
            onClose={() => setReassignItem(null)}
            onDone={() => { setReassignItem(null); fetchData(true); showToast("ok", "Reassigned ✓"); }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            style={{ position: "fixed", bottom: 20, right: 20, zIndex: 99999, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: toast.type === "ok" ? "rgba(34,197,94,0.15)" : "rgba(244,63,94,0.15)", border: `1px solid ${toast.type === "ok" ? "rgba(34,197,94,0.4)" : "rgba(244,63,94,0.4)"}`, backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "pointer" }}
            onClick={() => setToast(null)}
          >
            {toast.type === "ok" ? <CheckCheck size={13} color="#22c55e" /> : <XCircle size={13} color="#f43f5e" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: toast.type === "ok" ? "#22c55e" : "#f87171" }}>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        select option { background: #0e0e16; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
