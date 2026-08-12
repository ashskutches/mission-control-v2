"use client";
/**
 * Insights — one list, sorted however you need it.
 *
 * This replaced a four-column kanban (Inbox → Assigned → In Progress → Blocked)
 * spread over three pages plus a separate North Star briefing: ~3,900 lines to
 * render a board that holds ten items. The kanban's data source fanned four
 * tables into polymorphic cards so a finding and the work it spawned could sit
 * side by side, which duplicated /work and made "what should I do next?" a
 * question you answered by reading four columns.
 *
 * What replaced it:
 *  - **One row per insight.** Work items are not rows; an assigned insight
 *    carries its agent's progress inline, so acting on something never makes it
 *    disappear from the list you were reading.
 *  - **Sort by what you care about** — money, effort, risk, age, section.
 *  - **Assign to an agent or a person from the row**, which is the one part of
 *    the old pipeline that was pulling its weight.
 *  - **North Star's KPI strip on top**, because a ranked list of opportunities
 *    means nothing without the margin they are supposed to move.
 *
 * On the money column, see GET /admin/insights/board: a figure is only shown
 * with a stated basis, it is labelled measured or claimed, and the two are never
 * added together.
 */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, X, ChevronDown, ChevronRight, Bot, User, Sparkles, CheckCircle2,
  Search, AlertTriangle, TrendingUp, Target, Activity, DollarSign, Bell, BellOff,
  Lightbulb, ArrowUpRight, Clock, Ban, Info,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const REFRESH_MS = 30_000;
const ACCENT = "#e98d20";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BoardValue { amount: number; source: "measured" | "claimed"; basis: string }
interface BoardWork {
  id: string; status: string;
  milestone_label: string | null; milestone_index: number; milestone_total: number;
  percent: number; last_progress: string | null; next_run_at: string | null; runs: string;
}
interface BoardItem {
  id: string; title: string; body: string | null;
  section: string; lane: string; type: string; status: string;
  priority: number; occurrences: number;
  risk_score: number; risk_tier: string | null;
  metrics: Record<string, unknown>;
  filed_by: string | null;
  value: BoardValue | null;
  effort: { tier: "low" | "medium" | "high" | null; rank: number };
  assignee: { kind: "agent" | "human"; id: string; name: string } | null;
  work: BoardWork | null;
  human_task: { id: string; status: string } | null;
  created_at: string; updated_at: string; age_days: number;
}
interface BoardResponse {
  sort: string; lane: string; count: number;
  value_summary: { measured_monthly: number; claimed_monthly: number; unpriced_count: number };
  items: BoardItem[];
}
interface ProfitSummary {
  netRevenue: number; netMarginPct: number | null; netProfit: number | null;
  grossMarginPct: number | null; mer: number | null; cac: number | null;
  cogsCoverage: number; coverageSufficient: boolean; orders: number; aov: number;
}
interface ProfitPacing { target: number; projectedTotal: number; varianceToPace: number; pctOfTarget: number }
/** A figure the P&L is withholding, and the one thing that would unblock it. */
interface ProfitBlocker { severity: string; message: string; fix: string }
interface Profit { summary: ProfitSummary; pacing: ProfitPacing | null; blockers: ProfitBlocker[] }
interface Agent { id: string; name: string }
interface TeamMember { discord_id: string; username: string; display_name?: string | null }

type SortKey = "risk" | "value" | "effort" | "newest" | "section";

// ── Display helpers ───────────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e",
};
const SECTION_LABEL: Record<string, string> = {
  seo: "SEO", email: "Email", content: "Content", ads: "Ads", product: "Product",
  general: "General", influencing: "Influencing", support: "Support",
  logistics: "Logistics", media: "Media", pricing: "Pricing", catalog: "Catalog",
  revenue: "Revenue", brand: "Brand", profitability: "Profit", community: "Community",
};
const EFFORT_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22c55e" },
  medium: { label: "Medium", color: "#e98d20" },
  high: { label: "High", color: "#f43f5e" },
};

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}
function ageLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

// ── KPI strip ─────────────────────────────────────────────────────────────────
// Carried over from North Star. A withheld figure renders as "—" with the reason
// underneath and is never filled with a placeholder — see /profitability.
function StatCard({ label, value, sub, icon: Icon, color = ACCENT, alert = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: alert ? "rgba(244,63,94,0.07)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${alert ? "rgba(244,63,94,0.25)" : `${color}20`}`,
      borderRadius: 14, padding: "0.85rem 1.1rem", display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${alert ? "#f43f5e" : color}18`, border: `1px solid ${alert ? "#f43f5e" : color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={alert ? "#f43f5e" : color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "9.5px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, fontWeight: 700 }}>{label}</p>
        <p style={{ fontSize: "1.25rem", fontWeight: 900, color: alert ? "#f43f5e" : "#e2e8f0", margin: "2px 0 0", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: "9.5px", color: "#64748b", margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

function KpiStrip({ profit }: { profit: Profit | null }) {
  const criticalBlockers = profit?.blockers?.filter(b => b.severity === "critical") ?? [];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "0.7rem", marginBottom: "0.6rem" }}>
        <StatCard
          label="Net Margin"
          value={profit?.summary.netMarginPct != null ? `${profit.summary.netMarginPct.toFixed(1)}%` : "—"}
          sub={profit?.summary.netProfit != null ? `$${Math.round(profit.summary.netProfit).toLocaleString()} QTD` : "needs unit costs + overhead"}
          icon={Target}
          color={profit?.summary.netMarginPct == null ? "#475569" : profit.summary.netMarginPct >= 0 ? "#22c55e" : "#f43f5e"}
          alert={profit?.summary.netMarginPct != null && profit.summary.netMarginPct < 0}
        />
        <StatCard
          label="Q Pace"
          value={profit?.pacing ? `$${Math.round(profit.pacing.projectedTotal / 1000)}K` : "—"}
          sub={profit?.pacing ? `of $${Math.round(profit.pacing.target / 1000)}K target` : "no target set"}
          icon={TrendingUp}
          color={!profit?.pacing ? "#475569" : profit.pacing.varianceToPace >= 0 ? "#22c55e" : "#f59e0b"}
          alert={!!profit?.pacing && profit.pacing.varianceToPace < 0}
        />
        <StatCard
          label="MER"
          value={profit?.summary.mer != null ? `${profit.summary.mer.toFixed(2)}×` : "—"}
          sub={profit?.summary.mer != null ? "revenue ÷ ad spend" : "no ad spend recorded"}
          icon={Activity}
          color={profit?.summary.mer == null ? "#475569" : profit.summary.mer >= 2.8 ? "#22c55e" : "#f43f5e"}
          alert={profit?.summary.mer != null && profit.summary.mer < 2.5}
        />
        <StatCard
          label="Gross Margin"
          value={profit?.summary.grossMarginPct != null ? `${profit.summary.grossMarginPct.toFixed(1)}%` : "—"}
          sub={profit?.summary.grossMarginPct != null ? "healthy ≥ 48%" : `only ${((profit?.summary.cogsCoverage ?? 0) * 100).toFixed(0)}% cost coverage`}
          icon={DollarSign}
          color={profit?.summary.grossMarginPct == null ? "#475569" : profit.summary.grossMarginPct >= 48 ? "#22c55e" : "#f59e0b"}
        />
      </div>
      {criticalBlockers.length > 0 && (
        <a href="/profitability?tab=costs" style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem", textDecoration: "none",
          background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "0.55rem 0.85rem",
        }}>
          <AlertTriangle size={13} color="#f43f5e" />
          <span style={{ fontSize: "11.5px", color: "#e2e8f0" }}>
            {criticalBlockers.length} blocker(s) are keeping the figures above from being real —{" "}
            <strong style={{ color: "#f43f5e" }}>{criticalBlockers[0]?.fix}</strong>
          </span>
          <ChevronRight size={12} color="#f43f5e" style={{ marginLeft: "auto", flexShrink: 0 }} />
        </a>
      )}
    </>
  );
}

// ── Value cell ────────────────────────────────────────────────────────────────
// The chip is the point. A basis string alone does not separate GA4's own
// per-page revenue from "30-40% CTR improvement … estimated", and the second one
// is worth $150,000/mo on this board.
function ValueCell({ value }: { value: BoardValue | null }) {
  if (!value) {
    return (
      <span title="Nothing can price this yet. It is not worth $0 — no measurement exists, and a site-average guess would be invented."
        style={{ color: "#334155", fontSize: "12px" }}>—</span>
    );
  }
  const isRisk = value.amount < 0;
  const measured = value.source === "measured";
  const color = isRisk ? "#f43f5e" : measured ? "#22c55e" : "#94a3b8";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
      <span style={{ color, fontWeight: 800, fontSize: "13px", whiteSpace: "nowrap" }}>
        {money(value.amount)}<span style={{ color: "#475569", fontWeight: 500 }}>/mo</span>
      </span>
      <span title={measured
        ? `Measured: ${value.basis}`
        : `Claimed by the filing agent — not measured: ${value.basis}`}
        style={{
          fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          padding: "1px 5px", borderRadius: 4, cursor: "help",
          color: measured ? "#22c55e" : "#64748b",
          background: measured ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${measured ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
        }}>
        {measured ? "measured" : "claimed"}{isRisk ? " · risk" : ""}
      </span>
    </div>
  );
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({
  item, agents, teamMembers, onClose, onAssign,
}: {
  item: BoardItem; agents: Agent[]; teamMembers: TeamMember[];
  onClose: () => void;
  onAssign: (agentId: string | null, agentName: string | null, humanUsername: string | null, notify: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"agent" | "human">("agent");
  const [selected, setSelected] = useState<string>("__auto__");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /**
   * Both agent paths go through POST /admin/insights/:id/assign, which is the
   * only one that creates the `agent_work` row — the agent's scheduled run,
   * milestones, run cap and all.
   *
   * Picking a specific agent used to go through /reassign instead, which sets a
   * name on the insight and creates nothing. It looked assigned and never ran;
   * only "Choose Automatically" actually dispatched anything. `force_agent_name`
   * rides along because the route would otherwise label the work with the name of
   * the agent that *filed* the insight.
   *
   * Humans still go through /reassign — that path creates the `human_tasks` row
   * and sends the Discord DM.
   */
  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      if (tab === "agent") {
        const forced = selected === "__auto__" ? null : selected;
        const res = await fetch(`${BOT_URL}/admin/insights/${item.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forced
            ? { force_agent_id: forced, force_agent_name: agents.find(a => a.id === forced)?.name ?? null }
            : {}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        await onAssign(json.agent_id ?? forced ?? "", json.agent_name ?? null, null, false);
      } else {
        const username = selected === "__auto__" ? teamMembers[0]?.username : selected;
        if (!username) throw new Error("No team members available to assign to");
        await onAssign(null, null, username, notify);
      }
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const optionStyle = (sel: boolean, tint = ACCENT): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
    borderRadius: 8, cursor: "pointer", marginBottom: 6, transition: "all 0.1s",
    background: sel ? `${tint}1a` : "rgba(255,255,255,0.03)",
    border: `1px solid ${sel ? `${tint}66` : "rgba(255,255,255,0.06)"}`,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        style={{ width: "100%", maxWidth: 480, background: "rgba(13,17,27,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.4rem", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Assign</p>
            <h2 style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e2e8f0", lineHeight: 1.35 }}>{item.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10 }}>
          {(["agent", "human"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelected("__auto__"); }}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: "12px", textTransform: "uppercase",
                background: tab === t ? "rgba(233,141,32,0.15)" : "transparent",
                color: tab === t ? ACCENT : "#64748b",
              }}>
              {t === "agent" ? <Bot size={12} style={{ display: "inline", marginRight: 4 }} /> : <User size={12} style={{ display: "inline", marginRight: 4 }} />}
              {t}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <div style={optionStyle(selected === "__auto__", "#a78bfa")} onClick={() => setSelected("__auto__")}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={14} color="#a78bfa" />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: "13px", color: "#a78bfa" }}>Choose Automatically</span>
              <p style={{ fontSize: "10px", color: "#64748b", margin: "1px 0 0" }}>
                {tab === "agent"
                  ? <>Section lead for <strong style={{ color: "#94a3b8" }}>{SECTION_LABEL[item.section] ?? item.section}</strong>, with milestones</>
                  : "First available team member"}
              </p>
            </div>
            {selected === "__auto__" && <CheckCircle2 size={14} color="#a78bfa" />}
          </div>

          {tab === "agent" ? agents.map(a => (
            <div key={a.id} style={optionStyle(selected === a.id)} onClick={() => setSelected(a.id)}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={14} color="#a78bfa" />
              </div>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0", flex: 1 }}>{a.name}</span>
              {selected === a.id && <CheckCircle2 size={14} color={ACCENT} />}
            </div>
          )) : teamMembers.map(m => (
            <div key={m.discord_id} style={optionStyle(selected === m.username)} onClick={() => setSelected(m.username)}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={14} color="#22c55e" />
              </div>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0", flex: 1 }}>{m.display_name ?? m.username}</span>
              {selected === m.username && <CheckCircle2 size={14} color={ACCENT} />}
            </div>
          ))}
          {tab === "agent" && agents.length === 0 && <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: 24 }}>No agents available</p>}
          {tab === "human" && teamMembers.length === 0 && <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: 24 }}>No team members</p>}
        </div>

        {tab === "human" && (
          <button onClick={() => setNotify(n => !n)}
            style={{
              width: "100%", marginTop: 12, padding: "9px 14px", borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10, textAlign: "left",
              background: notify ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${notify ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}>
            <div style={{ width: 34, height: 18, borderRadius: 9, flexShrink: 0, background: notify ? "#22c55e" : "rgba(255,255,255,0.15)", position: "relative" }}>
              <div style={{ position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", left: notify ? 18 : 2, transition: "left 0.2s" }} />
            </div>
            {notify ? <Bell size={13} color="#22c55e" /> : <BellOff size={13} color="#475569" />}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: notify ? "#22c55e" : "#64748b" }}>{notify ? "Notify via Discord" : "No notification"}</p>
              <p style={{ fontSize: "10px", color: "#475569", marginTop: 1 }}>{notify ? "Assignee gets a DM with a direct link" : "Silent assignment"}</p>
            </div>
          </button>
        )}

        {err && <p style={{ color: "#f43f5e", fontSize: "12px", marginTop: 8 }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: saving ? "not-allowed" : "pointer", background: saving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#e98d20,#c97818)", color: saving ? "#475569" : "#fff", fontWeight: 700, fontSize: "13px" }}>
            {saving ? "Assigning…" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Expanded detail ───────────────────────────────────────────────────────────
function RowDetail({ item, onAssign, onDismiss, onComplete, busy }: {
  item: BoardItem;
  onAssign: () => void; onDismiss: () => void; onComplete: () => void;
  busy: boolean;
}) {
  const metricEntries = Object.entries(item.metrics ?? {}).filter(([, v]) => v != null && v !== "");
  const btn = (bg: string, color: string): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 7, border: `1px solid ${color}33`, background: bg,
    color, fontSize: "11.5px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", gap: 5, opacity: busy ? 0.5 : 1,
  });

  return (
    <div style={{ padding: "0.9rem 1.1rem 1.1rem 2.6rem", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.18)" }}>
      {item.body && (
        <p style={{ color: "#94a3b8", fontSize: "12.5px", lineHeight: 1.6, margin: "0 0 0.8rem", whiteSpace: "pre-wrap" }}>{item.body}</p>
      )}

      {item.value && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "0.6rem 0.8rem", marginBottom: "0.8rem" }}>
          <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>
            {item.value.source === "measured" ? "How this was measured" : "How the agent calculated this"}
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{item.value.basis}</p>
        </div>
      )}

      {metricEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.8rem" }}>
          {metricEntries.map(([k, v]) => (
            <span key={k} style={{ fontSize: "10.5px", color: "#94a3b8", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "3px 8px" }}>
              <span style={{ color: "#475569" }}>{k.replace(/_/g, " ")}: </span>
              <strong style={{ color: "#cbd5e1" }}>{String(v)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Execution state — the reason assigning does not make the row vanish. */}
      {item.work && (
        <div style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 9, padding: "0.65rem 0.85rem", marginBottom: "0.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <Bot size={12} color="#38bdf8" />
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#38bdf8" }}>
              {item.assignee?.name ?? "Agent"} · {item.work.status}
            </span>
            {item.work.milestone_total > 0 && (
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                step {item.work.milestone_index + 1}/{item.work.milestone_total}
                {item.work.milestone_label ? ` — ${item.work.milestone_label}` : ""}
              </span>
            )}
            <span style={{ fontSize: "10px", color: "#475569", marginLeft: "auto" }}>{item.work.runs} runs</span>
          </div>
          {item.work.milestone_total > 0 && (
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${item.work.percent}%`, height: "100%", background: "#38bdf8", borderRadius: 2 }} />
            </div>
          )}
          {item.work.last_progress && (
            <p style={{ fontSize: "11.5px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{item.work.last_progress}</p>
          )}
          <a href={`/work`} style={{ fontSize: "10.5px", color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 6 }}>
            Open in Tasks <ArrowUpRight size={10} />
          </a>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={busy} onClick={onAssign} style={btn("rgba(233,141,32,0.1)", ACCENT)}>
          {item.assignee ? <><RefreshCw size={11} /> Reassign</> : <><Bot size={11} /> Assign</>}
        </button>
        <button disabled={busy} onClick={onComplete} style={btn("rgba(34,197,94,0.08)", "#22c55e")}>
          <CheckCircle2 size={11} /> Done
        </button>
        <button disabled={busy} onClick={onDismiss} style={btn("rgba(255,255,255,0.03)", "#64748b")}>
          <Ban size={11} /> Dismiss
        </button>
        <span style={{ fontSize: "10.5px", color: "#334155", marginLeft: "auto" }}>
          filed by {item.filed_by ?? "agent"} · {item.type.replace(/_/g, " ")} · {item.occurrences > 1 ? `reported ${item.occurrences}×` : "reported once"}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const SORT_TABS: { key: SortKey; label: string; hint: string }[] = [
  { key: "risk", label: "Priority", hint: "Assessed risk, reinforced by how often it was independently reported" },
  { key: "value", label: "Money", hint: "Measured figures first, then claims, by size. Unpriced last — never guessed" },
  { key: "effort", label: "Effort", hint: "Cheapest first. Insights with no recorded effort sort last" },
  { key: "newest", label: "Newest", hint: "Most recently filed" },
  { key: "section", label: "Section", hint: "Grouped by area of the business" },
];

export default function InsightsPage() {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortKey>("risk");
  // Deep links from /pipeline/<id> arrive as ?focus= and may point at any lane,
  // so start on `all` rather than silently filtering the target out.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lane, setLane] = useState<"business" | "ops" | "all">("business");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assignItem, setAssignItem] = useState<BoardItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Read from window.location rather than useSearchParams: the latter opts a
  // statically-prerendered route into client-only rendering, which replaced a
  // whole page with its Suspense fallback once already (see Command Center).
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) { setFocusId(focus); setExpanded(focus); setLane("all"); }
  }, []);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/board?sort=${sort}&lane=${lane}&limit=200`);
      if (!res.ok) throw new Error(`Board unavailable (HTTP ${res.status})`);
      setBoard(await res.json());
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [sort, lane]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => {
    const t = setInterval(fetchBoard, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchBoard]);

  useEffect(() => {
    (async () => {
      const [pRes, aRes, tRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/profitability?period=qtd`).catch(() => null),
        fetch(`${BOT_URL}/admin/agents`).catch(() => null),
        fetch(`${BOT_URL}/admin/team`).catch(() => null),
      ]);
      if (pRes?.ok) setProfit(await pRes.json());
      if (aRes?.ok) {
        const d = await aRes.json();
        const raw: Agent[] = Array.isArray(d) ? d : d.agents ?? [];
        setAgents(raw.map(a => ({ id: a.id, name: a.name })));
      }
      if (tRes?.ok) {
        const d = await tRes.json();
        setTeamMembers(d.members ?? []);
      }
    })();
  }, []);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return board?.items ?? [];
    return (board?.items ?? []).filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.body ?? "").toLowerCase().includes(q) ||
      i.section.toLowerCase().includes(q),
    );
  }, [board, search]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const assign = async (item: BoardItem, agentId: string | null, agentName: string | null, humanUsername: string | null, notify: boolean) => {
    setBusyId(item.id);
    try {
      await fetch(`${BOT_URL}/admin/pipeline/${item.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: "insight", agent_id: agentId, agent_name: agentName, human_username: humanUsername, notify }),
      });
      await fetchBoard();
    } finally { setBusyId(null); }
  };

  const setStatus = async (item: BoardItem, status: "dismissed" | "resolved") => {
    setBusyId(item.id);
    try {
      await fetch(`${BOT_URL}/admin/insights/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "dismissed"
          ? { status, dismissed_reason: "Dismissed from the Insights list." }
          : { status }),
      });
      await fetchBoard();
    } finally { setBusyId(null); }
  };

  const vs = board?.value_summary;

  // A link can outlive the thing it points at — the board only carries open
  // insights, so a DM about something since resolved would otherwise land on an
  // ordinary list with nothing highlighted and no explanation.
  const focusMissing = !!focusId && !loading && !!board && !board.items.some(i => i.id === focusId);

  // Scroll the linked row into view once it renders.
  useEffect(() => {
    if (!focusId || !board) return;
    document.getElementById(`insight-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, board]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const th: React.CSSProperties = {
    fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase",
    letterSpacing: "0.07em", padding: "0.5rem 0.75rem", textAlign: "left", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { padding: "0.6rem 0.75rem", verticalAlign: "middle" };

  return (
    <div style={{ padding: "1.25rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lightbulb size={20} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#e2e8f0", margin: 0, lineHeight: 1 }}>Insights</h1>
            <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0, marginTop: 3 }}>
              What the agents found · sort it, assign it, watch it run
            </p>
          </div>
        </div>
        <button onClick={() => { setLoading(true); fetchBoard(); }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          <span style={{ fontSize: "11px" }}>Refresh</span>
        </button>
      </div>

      <KpiStrip profit={profit} />

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
          {SORT_TABS.map(t => (
            <button key={t.key} onClick={() => setSort(t.key)} title={t.hint}
              style={{
                padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "11.5px",
                fontWeight: sort === t.key ? 800 : 500,
                background: sort === t.key ? "rgba(233,141,32,0.15)" : "transparent",
                color: sort === t.key ? ACCENT : "#64748b",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
          {(["business", "ops", "all"] as const).map(l => (
            <button key={l} onClick={() => setLane(l)}
              title={l === "business" ? "Findings that need a decision" : l === "ops" ? "System plumbing — see also /blockages" : "Everything"}
              style={{
                padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "11px",
                fontWeight: lane === l ? 800 : 500, textTransform: "capitalize",
                background: lane === l ? "rgba(255,255,255,0.07)" : "transparent",
                color: lane === l ? "#e2e8f0" : "#64748b",
              }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 280 }}>
          <Search size={12} color="#475569" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…"
            style={{ width: "100%", padding: "6px 10px 6px 28px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0", fontSize: "12px", outline: "none" }} />
        </div>
      </div>

      {/* Value summary — the two tiers, never added together */}
      {vs && (
        <div style={{ display: "flex", gap: "1.1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.7rem", padding: "0 0.15rem" }}>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>
            <strong style={{ color: "#e2e8f0" }}>{items.length}</strong> insight{items.length === 1 ? "" : "s"}
          </span>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>
            <strong style={{ color: vs.measured_monthly ? "#22c55e" : "#475569" }}>{money(vs.measured_monthly)}/mo</strong> measured
          </span>
          <span style={{ fontSize: "11.5px", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
            <strong style={{ color: "#94a3b8" }}>{money(vs.claimed_monthly)}/mo</strong> claimed
            <span title="Agent arithmetic, not measurement. Shown separately and never added to the measured figure — one netted headline is how the same outage once read +$33,500 and −$25,000 at the same time.">
              <Info size={10} color="#475569" />
            </span>
          </span>
          <span style={{ fontSize: "11.5px", color: "#475569" }}>{vs.unpriced_count} not priced</span>
        </div>
      )}

      {focusMissing && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={13} color="#64748b" />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            That insight is no longer open — it was resolved or dismissed. The rest of the board is below.
          </span>
          <button onClick={() => { setFocusId(null); setExpanded(null); }}
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#475569" }}>
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={13} color="#f43f5e" />
          <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{error}</span>
        </div>
      )}

      {/* The list */}
      <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={{ ...th, width: 28 }} />
                <th style={th}>Insight</th>
                <th style={{ ...th, textAlign: "right" }}>Value</th>
                <th style={th}>Effort</th>
                <th style={th}>Risk</th>
                <th style={th}>Assignee</th>
                <th style={{ ...th, textAlign: "right" }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ padding: "3rem 1rem", textAlign: "center", color: "#334155", fontSize: "13px" }}>
                  {search ? "Nothing matches that filter." : "Nothing open in this lane. Run an analysis to populate it."}
                </td></tr>
              )}
              {items.map(item => {
                const open = expanded === item.id;
                const riskColor = RISK_COLOR[item.risk_tier ?? ""] ?? "#64748b";
                const effort = item.effort.tier ? EFFORT_LABEL[item.effort.tier] : null;
                return (
                  <React.Fragment key={item.id}>
                    <tr id={`insight-${item.id}`} onClick={() => setExpanded(open ? null : item.id)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
                        background: item.id === focusId ? "rgba(233,141,32,0.06)" : open ? "rgba(255,255,255,0.02)" : "transparent",
                        boxShadow: item.id === focusId ? `inset 2px 0 0 ${ACCENT}` : undefined,
                      }}>
                      <td style={{ ...td, paddingRight: 0, color: "#475569" }}>
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
                      <td style={{ ...td, maxWidth: 460 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                            {SECTION_LABEL[item.section] ?? item.section}
                          </span>
                          {item.occurrences > 1 && (
                            <span title={`Independently reported ${item.occurrences} times`}
                              style={{ fontSize: "9px", fontWeight: 700, color: "#fb923c", background: "rgba(251,146,60,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                              {item.occurrences}×
                            </span>
                          )}
                          {item.work && (
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                              {item.work.status}
                            </span>
                          )}
                        </div>
                        <p style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "12.5px", margin: 0, lineHeight: 1.4 }}>{item.title}</p>
                        {item.work?.milestone_label && !open && (
                          <p style={{ color: "#475569", fontSize: "10.5px", margin: "3px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={9} /> {item.work.milestone_label}
                          </p>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}><ValueCell value={item.value} /></td>
                      <td style={td}>
                        {effort
                          ? <span style={{ fontSize: "11px", fontWeight: 700, color: effort.color }}>{effort.label}</span>
                          : <span title="Nobody recorded an effort estimate" style={{ color: "#334155", fontSize: "12px" }}>—</span>}
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: riskColor, background: `${riskColor}15`, padding: "2px 7px", borderRadius: 5, textTransform: "capitalize" }}>
                          {item.risk_tier ?? "—"}
                        </span>
                      </td>
                      <td style={td}>
                        {item.assignee ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11.5px", color: "#cbd5e1" }}>
                            {item.assignee.kind === "agent" ? <Bot size={11} color="#a78bfa" /> : <User size={11} color="#22c55e" />}
                            {item.assignee.name}
                          </span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setAssignItem(item); }}
                            style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, background: "rgba(233,141,32,0.08)", border: `1px solid ${ACCENT}33`, borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                            Assign
                          </button>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "#475569", fontSize: "11px", whiteSpace: "nowrap" }}>
                        {ageLabel(item.age_days)}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <RowDetail
                            item={item}
                            busy={busyId === item.id}
                            onAssign={() => setAssignItem(item)}
                            onDismiss={() => setStatus(item, "dismissed")}
                            onComplete={() => setStatus(item, "resolved")}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: "10.5px", color: "#334155", margin: "0.7rem 0.15rem 0" }}>
        Technical problems (broken integrations, missing credentials, tool failures) are filed to{" "}
        <a href="/blockages" style={{ color: "#64748b" }}>Blockages</a>, not here. Execution detail lives in{" "}
        <a href="/work" style={{ color: "#64748b" }}>Tasks</a>.
      </p>

      <AnimatePresence>
        {assignItem && (
          <AssignModal
            item={assignItem}
            agents={agents}
            teamMembers={teamMembers}
            onClose={() => setAssignItem(null)}
            onAssign={(agentId, agentName, humanUsername, notify) => assign(assignItem, agentId, agentName, humanUsername, notify)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
