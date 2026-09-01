"use client";
/**
 * InsightsBoard — the one insight list, rendered either for the whole business
 * or for a single space.
 *
 * This is the board that used to live entirely inside (dashboard)/pipeline/page.tsx.
 * It was lifted out unchanged when every space got its own Insights tab, because the
 * alternative — a second, simpler per-section list — is how two views of the same
 * table drift apart. There is one renderer, one set of actions, one definition of
 * what a dollar figure means. `/pipeline` is this component with no `section`.
 *
 * ## The `section` prop is a space id, not a section value
 *
 * Pass `"marketing"`, not `"email"`. The server expands a space into its retired
 * section values via sectionIdsFor() — see gravity-claw's utils/spaces.ts — so
 * Marketing's tab shows the 173 insights filed as `email`/`ads` before spaces
 * existed. Filtering client-side on `item.section === section` would drop every one
 * of them; do not "simplify" it that way.
 *
 * On the money column, see GET /admin/insights/board: a figure is only shown with a
 * stated basis, it is labelled measured or claimed, and the two are never added.
 */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, X, ChevronDown, ChevronRight, Bot, User, Sparkles, CheckCircle2,
  Search, AlertTriangle, ArrowUpRight, Clock, Ban, Info, Lightbulb,
  HelpCircle, MessageSquare, CalendarClock, Plus, Copy, Check, Play, Loader2,
} from "lucide-react";
import Link from "next/link";
import { getSpace } from "@/app/lib/spaces";
import { useRole } from "@/app/lib/useRole";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
/**
 * Creating an insight is the one call here that must NOT use BOT_URL.
 *
 * Who recorded it is stamped server-side by the /api/bot proxy from the signed
 * session cookie (see IDENTITY_STAMPED there); NEXT_PUBLIC_BOT_URL reaches the
 * bot directly and would let the browser name anyone as the recorder. Same rule
 * as posting into an insight's conversation.
 */
const PROXY_URL = "/api/bot";
const REFRESH_MS = 30_000;
/** How often the page asks whether a running analysis has finished. */
const RUN_POLL_MS = 5_000;
const DEFAULT_ACCENT = "#e98d20";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoardValue { amount: number; source: "measured" | "claimed"; basis: string }
/** Server-computed lateness. `none` means nobody set a date — never a guess. */
export interface BoardDue {
  state: "overdue" | "due_soon" | "on_track" | "none";
  due_date: string | null;
  days_remaining: number | null;
  percent_elapsed: number | null;
}
/** Who put this on the board. A person recording a colleague's idea is two names. */
export interface BoardAuthored {
  kind: "agent" | "human";
  suggested_by: string | null;
  recorded_by: string | null;
}
export interface BoardWork {
  id: string; status: string;
  milestone_label: string | null; milestone_index: number; milestone_total: number;
  percent: number; last_progress: string | null; next_run_at: string | null; runs: string;
}
export interface BoardItem {
  id: string; title: string; body: string | null;
  section: string; lane: string; type: string; status: string;
  priority: number; occurrences: number;
  risk_score: number; risk_tier: string | null;
  metrics: Record<string, unknown>;
  filed_by: string | null;
  authored: BoardAuthored;
  due: BoardDue;
  value: BoardValue | null;
  effort: { tier: "low" | "medium" | "high" | null; rank: number };
  assignee: { kind: "agent" | "human"; id: string; name: string } | null;
  work: BoardWork | null;
  human_task: { id: string; status: string } | null;
  /**
   * Set when an agent has asked a person something on this insight and is still
   * waiting. Present only while genuinely blocked — see the waitingOn block in
   * GET /admin/insights/board, which settles a question on a threaded answer OR
   * on any later human message.
   */
  waiting_on_human: { question: string; asked_at: string; agent_name: string } | null;
  created_at: string; updated_at: string; age_days: number;
}
export interface BoardResponse {
  sort: string; lane: string; count: number;
  value_summary: { measured_monthly: number; claimed_monthly: number; unpriced_count: number };
  due_summary: { overdue: number; due_soon: number; undated: number };
  items: BoardItem[];
}
/** A manual analysis run launched from this board. */
interface RunJob {
  id: string; status: string; agent_name: string | null; error: string | null;
  created_at: string; completed_at: string | null;
}
interface Agent { id: string; name: string }
interface TeamMember { discord_id: string; username: string; display_name?: string | null }

type SortKey = "risk" | "value" | "effort" | "newest" | "section" | "due";
/** Lateness filter. `dated` is what you want when planning; `undated` is the backlog of undecided deadlines. */
type DueFilter = "all" | "late" | "overdue" | "soon" | "undated";

// ── Display helpers ───────────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#e98d20", low: "#22c55e",
};
/**
 * Labels for the raw `section` value on a row. Includes the retired values
 * (email, ads, influencing…) because they are still stamped on live rows and the
 * chip shows what was actually filed, not the space it rolls up to.
 */
const SECTION_LABEL: Record<string, string> = {
  seo: "SEO", email: "Email", content: "Content", ads: "Ads", product: "Product",
  general: "General", influencing: "Influencing", support: "Support",
  logistics: "Logistics", media: "Media", pricing: "Pricing", catalog: "Catalog",
  revenue: "Revenue", brand: "Brand", profitability: "Profit", community: "Community",
  marketing: "Marketing", social: "Social", audience: "Website", orders: "Orders",
  team: "Team", cro: "CRO",
};
const EFFORT_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22c55e" },
  medium: { label: "Medium", color: "#e98d20" },
  high: { label: "High", color: "#f43f5e" },
};

export function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}
/**
 * The two colours the request actually asked for: red once overdue, orange
 * through the last fifth of the allotted time. `on_track` is deliberately grey
 * rather than green — a board where most rows glow green trains you to stop
 * looking at colour, which is the one thing this column has to survive.
 */
const DUE_STYLE: Record<BoardDue["state"], { color: string; bg: string; border: string } | null> = {
  overdue: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.35)" },
  due_soon: { color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.32)" },
  on_track: { color: "#64748b", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)" },
  none: null,
};

/**
 * ── The colour of a row ──────────────────────────────────────────────────────
 *
 * Ash's ask, in full: *"there should be some colors to one that is assigned, due
 * this week, overdue — so at a glance we can see where insights are instead of
 * having to read the status."* A board you have to read cell by cell is a board
 * you skim and then stop opening.
 *
 * **One colour per row, most urgent wins.** The states are deliberately ordered
 * and deliberately few — four, plus the absence of one. Every extra band costs
 * the reader a lookup, and the whole point is that the scan needs no lookup.
 *
 *   red    overdue                — past a date somebody committed to
 *   amber  an agent is waiting    — the only row asking the reader for something
 *   orange due inside a week      — or inside the last fifth of its window
 *   blue   somebody is on it      — assigned or executing, nothing imminent
 *   —      nobody has it          — no stripe at all
 *
 * **Nothing is coloured green, and nothing on track glows.** Same rule as the
 * Due chip: a board where most rows are lit is a board you stop reading colour
 * on, so "fine" is the absence of a signal rather than a reassuring one. And
 * unassigned draws nothing, which is what makes 52 unclaimed rows visibly bare
 * beside 25 that somebody owns.
 *
 * **The colour is never the only carrier of the fact.** The Due chip, the
 * `needs you` chip and the Assignee column all still say it in words — colour
 * that cannot be read by everyone must be redundant, not load-bearing.
 *
 * ⚠️ `due_this_week` is the ONE calendar-based threshold in this file, and it
 * does not replace `due_soon`. `due_soon` is the last 20% of the allotted window
 * (utils/insight-due.ts, and the reasoning there for why a fixed number of days
 * is wrong at both ends); this is "it lands within seven days", which is the
 * horizon a person actually plans a week against. A row satisfying either one is
 * orange, so a long-running item still warns before its window closes and a
 * short one is not silent just because its window is barely used.
 */
const ROW_STATE = {
  overdue:   { color: "#f43f5e", label: "Overdue" },
  needs_you: { color: "#e98d20", label: "Waiting on a person" },
  due_week:  { color: "#fb923c", label: "Due this week" },
  assigned:  { color: "#38bdf8", label: "Someone's on it" },
  idle:      { color: null,      label: "Nobody has it" },
} as const;

type RowStateKey = keyof typeof ROW_STATE;

/** Days inside which a due date counts as "this week". */
const THIS_WEEK_DAYS = 7;

function rowState(item: BoardItem): RowStateKey {
  if (item.due.state === "overdue") return "overdue";
  if (item.waiting_on_human) return "needs_you";
  if (
    item.due.state === "due_soon" ||
    (item.due.days_remaining != null && item.due.days_remaining <= THIS_WEEK_DAYS)
  ) return "due_week";
  if (item.assignee || item.work) return "assigned";
  return "idle";
}

function dueLabel(due: BoardDue): string {
  const d = due.days_remaining;
  if (d == null) return "—";
  if (due.state === "overdue") {
    const late = Math.abs(d);
    return late === 1 ? "1d late" : `${late}d late`;
  }
  return d === 1 ? "1d left" : `${d}d left`;
}

/** The date itself, for the tooltip — the chip shows the distance, not the day. */
function dueDateLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** `<input type="date">` wants a local yyyy-mm-dd, and toISOString would shift it a day in half the world. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ageLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

// ── Due cell ──────────────────────────────────────────────────────────────────
// Reads at a glance or it has failed: the request was "see which are red or
// orange without reading anything".
function DueCell({ due }: { due: BoardDue }) {
  const style = DUE_STYLE[due.state];
  if (!style) {
    return (
      <span title="No due date. Nothing infers one — a colour computed from age would be measuring our arithmetic, not anyone's commitment."
        style={{ color: "#334155", fontSize: "12px", cursor: "help" }}>—</span>
    );
  }
  return (
    <span title={`Due ${dueDateLabel(due.due_date)}${due.state === "due_soon" ? " — inside the last 20% of the time allotted" : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, cursor: "help",
        fontSize: "10.5px", fontWeight: 700, whiteSpace: "nowrap",
        color: style.color, background: style.bg,
        border: `1px solid ${style.border}`, borderRadius: 5, padding: "2px 7px",
      }}>
      <CalendarClock size={9} /> {dueLabel(due)}
    </span>
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

// ── Record-an-insight modal ───────────────────────────────────────────────────
/**
 * The manager's way in.
 *
 * Insights the team came up with were being passed on verbally and hoped to
 * stick. This is the same board, same gates, same table — the only new thing is
 * that a person can be the filer.
 *
 * Three things it deliberately does NOT do:
 *  - **It does not bypass triage.** A bug typed in here is routed to Blockages
 *    by the server exactly as an agent's would be, and the modal reports that
 *    rather than hiding it. A form that quietly files bugs onto the decisions
 *    board is how the board filled up the first time.
 *  - **It does not let you set a dollar figure.** Filing may propose a value
 *    only with a stated calculation, and a free-text money box on a quick-entry
 *    form is a $150,000/mo claim waiting to happen. Add it on the row afterwards
 *    if it can be substantiated.
 *  - **It does not ask who is recording it.** That is stamped from the signed-in
 *    session by the proxy. "Who suggested it" IS asked, because it is usually
 *    somebody else and it is the question the feature exists to answer.
 */
/**
 * The server's own vocabulary, not a friendlier parallel one.
 *
 * `POST /admin/insights` validates `type` against ALL_TYPES in
 * utils/insight-taxonomy.ts and 400s on anything else, so an invented value like
 * "opportunity" or "risk" reads perfectly here and fails at the only moment that
 * matters. Same rule as naming a tool in a skill: every value written here is a
 * real one.
 */
const RECORDABLE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "suggestion", label: "Suggestion", hint: "A specific change somebody is proposing" },
  { value: "observation", label: "Observation", hint: "Something noticed that may matter" },
  { value: "critical_issue", label: "Critical", hint: "Something about the business that needs deciding now" },
  { value: "competitor", label: "Competitor", hint: "Something a competitor is doing" },
  { value: "win", label: "Win", hint: "Something that worked, worth repeating" },
  { value: "feature_request", label: "Feature request", hint: "A thing the team wants built — files in the ops lane" },
  { value: "bug", label: "Bug", hint: "Something is broken — this will be filed to Blockages, not here" },
];

function RecordModal({
  section, accent, teamMembers, onClose, onFiled,
}: {
  section?: string; accent: string; teamMembers: TeamMember[];
  onClose: () => void; onFiled: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("opportunity");
  const [suggestedBy, setSuggestedBy] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [routed, setRouted] = useState<{ blockage_id: string; reasons: string[] } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const save = async () => {
    setSaving(true); setErr(null); setRouted(null); setNotes([]);
    try {
      const res = await fetch(`${PROXY_URL}/admin/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_kind: "human",
          suggested_by: suggestedBy.trim() || null,
          section: section ?? "general",
          type,
          title: title.trim(),
          body: body.trim() || null,
          // End of the chosen day, local — a deadline of "the 5th" means the 5th
          // is still on time, and midnight would make it late all day.
          due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${res.status}`);

      // The server's triage gate can decide this belongs in Blockages. Say so —
      // silently filing it somewhere else is how people stop trusting the form.
      if (json.routed_to === "blockage") {
        setRouted({ blockage_id: json.blockage_id, reasons: json.triage?.reasons ?? [] });
        await onFiled();
        return;
      }
      if (Array.isArray(json._notes) && json._notes.length) setNotes(json._notes);
      await onFiled();
      if (!Array.isArray(json._notes) || !json._notes.length) onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const field: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: "12.5px",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0", outline: "none", fontFamily: "inherit",
  };
  const label: React.CSSProperties = {
    fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase",
    letterSpacing: "0.07em", display: "block", margin: "0 0 4px",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "rgba(13,17,27,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.4rem", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Record an insight</p>
            <h2 style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e2e8f0", lineHeight: 1.35 }}>
              Something the team came up with
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0 }}><X size={18} /></button>
        </div>

        {routed ? (
          <div>
            <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 10, padding: "0.8rem 0.95rem", marginBottom: 12 }}>
              <p style={{ fontSize: "12.5px", color: "#e2e8f0", margin: "0 0 6px", fontWeight: 700 }}>
                Filed to Blockages, not to the board.
              </p>
              <p style={{ fontSize: "11.5px", color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                {routed.reasons[0] ?? "This describes something broken rather than something to decide."} The
                board is for decisions; broken things live in{" "}
                <Link href="/blockages" style={{ color: "#38bdf8" }}>Blockages</Link>, where they are tracked to a fix.
              </p>
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: "#fff", fontWeight: 700, fontSize: "13px" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 11 }}>
              <label style={label}>What is it</label>
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="One line — what somebody noticed or is proposing" style={field} />
            </div>

            <div style={{ marginBottom: 11 }}>
              <label style={label}>Detail</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
                placeholder="What is happening, why it matters, anything they said about it. Markdown is rendered."
                style={{ ...field, resize: "vertical", lineHeight: 1.55 }} />
            </div>

            <div style={{ marginBottom: 11 }}>
              <label style={label}>Type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {RECORDABLE_TYPES.map(t => (
                  <button key={t.value} onClick={() => setType(t.value)} title={t.hint}
                    style={{
                      padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: "11.5px",
                      fontWeight: type === t.value ? 800 : 500,
                      background: type === t.value ? `${accent}22` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${type === t.value ? `${accent}55` : "rgba(255,255,255,0.06)"}`,
                      color: type === t.value ? accent : "#94a3b8",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {type === "bug" && (
                <p style={{ fontSize: "10.5px", color: "#fb923c", margin: "6px 0 0", lineHeight: 1.5 }}>
                  A bug is not a decision — this will be filed to Blockages instead, and you will be told where it went.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={label}>Who suggested it</label>
                <input value={suggestedBy} onChange={e => setSuggestedBy(e.target.value)}
                  list="insight-suggesters" placeholder="Their name — leave blank if it was you" style={field} />
                <datalist id="insight-suggesters">
                  {teamMembers.map(m => <option key={m.discord_id} value={m.display_name ?? m.username} />)}
                </datalist>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={label}>Due (optional)</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={field} />
              </div>
            </div>

            <p style={{ fontSize: "10px", color: "#334155", margin: "0 0 12px", lineHeight: 1.55 }}>
              Recorded against your signed-in account. No dollar figure here on purpose — a value needs a
              calculation behind it, which you can add on the row once there is one.
            </p>

            {notes.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "0.6rem 0.8rem", marginBottom: 10 }}>
                {notes.map((n, i) => (
                  <p key={i} style={{ fontSize: "11px", color: "#94a3b8", margin: i ? "5px 0 0" : 0, lineHeight: 1.5 }}>{n}</p>
                ))}
              </div>
            )}
            {err && <p style={{ color: "#f43f5e", fontSize: "12px", marginBottom: 8 }}>{err}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                {notes.length ? "Close" : "Cancel"}
              </button>
              <button onClick={save} disabled={saving || !title.trim()}
                style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: saving || !title.trim() ? "not-allowed" : "pointer", background: saving || !title.trim() ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: saving || !title.trim() ? "#475569" : "#fff", fontWeight: 700, fontSize: "13px" }}>
                {saving ? "Recording…" : "Record it"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({
  item, agents, teamMembers, accent, onClose, onAssign,
}: {
  item: BoardItem; agents: Agent[]; teamMembers: TeamMember[]; accent: string;
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
        const res = await fetch(`${PROXY_URL}/admin/insights/${item.id}/assign`, {
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

  const optionStyle = (sel: boolean, tint = accent): React.CSSProperties => ({
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
                background: tab === t ? `${accent}26` : "transparent",
                color: tab === t ? accent : "#64748b",
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
              {selected === a.id && <CheckCircle2 size={14} color={accent} />}
            </div>
          )) : teamMembers.map(m => (
            <div key={m.discord_id} style={optionStyle(selected === m.username)} onClick={() => setSelected(m.username)}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={14} color="#22c55e" />
              </div>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0", flex: 1 }}>{m.display_name ?? m.username}</span>
              {selected === m.username && <CheckCircle2 size={14} color={accent} />}
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
            style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", cursor: saving ? "not-allowed" : "pointer", background: saving ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: saving ? "#475569" : "#fff", fontWeight: 700, fontSize: "13px" }}>
            {saving ? "Assigning…" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Expanded detail ───────────────────────────────────────────────────────────
function RowDetail({ item, accent, onAssign, onClose, onDue, busy }: {
  item: BoardItem; accent: string;
  onAssign: () => void;
  /** Close it out. The note is required — see the note on `closeOut` below. */
  onClose: (action: "completed" | "dismissed", note: string) => void;
  onDue: (iso: string | null) => void;
  busy: boolean;
}) {
  const metricEntries = Object.entries(item.metrics ?? {}).filter(([, v]) => v != null && v !== "");
  const [copied, setCopied] = useState(false);
  /**
   * Which close is being written, if either. Done and Dismiss stopped being
   * one-click on this board deliberately: a row closed with no account of why is
   * a row nobody can explain a month later, and — because the note is what
   * reaches `insight_feedback` — a decision the agents never learn from. The
   * detail page has asked for a note since InsightActions shipped; this is the
   * surface where most closing actually happens.
   */
  const [closing, setClosing] = useState<"completed" | "dismissed" | null>(null);
  const [note, setNote] = useState("");

  const copyBody = async () => {
    // The markdown, not the rendered text: what people paste this into is
    // another markdown box more often than not.
    const md = [`# ${item.title}`, "", item.body ?? ""].join("\n").trim();
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard denied — the text is on screen and selectable */ }
  };
  const btn = (bg: string, color: string): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 7, border: `1px solid ${color}33`, background: bg,
    color, fontSize: "11.5px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", gap: 5, opacity: busy ? 0.5 : 1,
  });

  return (
    <div style={{ padding: "0.9rem 1.1rem 1.1rem 2.6rem", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.18)" }}>
      {/*
        Rendered, not raw. Agents write markdown — headings, bullets, tables —
        and a pre-wrap block showed the asterisks and pipes, which is legible
        only if you are willing to parse it in your head. The copy button hands
        back the markdown rather than the rendered text, because the next place
        it goes is usually another markdown box.
      */}
      {item.body && (
        <div style={{ position: "relative", marginBottom: "0.8rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "12.5px" }}>
            <MarkdownMessage content={item.body} />
          </div>
          <button onClick={copyBody} title="Copy as markdown"
            style={{
              position: "absolute", top: -4, right: 0, display: "flex", alignItems: "center", gap: 4,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 6, padding: "3px 8px", cursor: "pointer",
              color: copied ? "#22c55e" : "#475569", fontSize: "10px", fontWeight: 700,
            }}>
            {copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
          </button>
        </div>
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
      {/*
        The question, in full, above everything else in the panel. The DM already
        went out; this is for the person who opened the board instead of their
        Discord, and it is the whole reason the row is highlighted.
      */}
      {item.waiting_on_human && (
        <Link href={`/pipeline/${item.id}`} style={{ textDecoration: "none", display: "block", marginBottom: "0.8rem" }}>
          <div style={{ background: `${accent}12`, border: `1px solid ${accent}44`, borderRadius: 9, padding: "0.7rem 0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <HelpCircle size={12} color={accent} />
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: accent }}>
                {item.waiting_on_human.agent_name} is waiting on an answer
              </span>
              <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3 }}>
                Answer <ArrowUpRight size={10} />
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
              {item.waiting_on_human.question}
            </p>
          </div>
        </Link>
      )}

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

      {/*
        Setting the date is where the colour comes from, so it lives beside the
        actions rather than behind another screen. Clearing it is a first-class
        action: an insight can lose a deadline as legitimately as it gains one,
        and the alternative is people setting a fake date to get rid of a chip.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CalendarClock size={10} /> Due
        </span>
        <input type="date" disabled={busy} value={toDateInput(item.due.due_date)}
          onChange={e => onDue(e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null)}
          style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7, padding: "4px 8px", color: "#cbd5e1", fontSize: "11.5px",
            outline: "none", colorScheme: "dark", fontFamily: "inherit",
          }} />
        {item.due.due_date
          ? <>
              <DueCell due={item.due} />
              <button disabled={busy} onClick={() => onDue(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", fontSize: "10.5px", textDecoration: "underline" }}>
                clear
              </button>
            </>
          : <span style={{ fontSize: "10.5px", color: "#334155" }}>none set — this row is never coloured</span>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={busy} onClick={onAssign} style={btn(`${accent}1a`, accent)}>
          {item.assignee ? <><RefreshCw size={11} /> Reassign</> : <><Bot size={11} /> Assign</>}
        </button>
        <button disabled={busy} onClick={() => { setClosing(c => c === "completed" ? null : "completed"); setNote(""); }}
          style={btn(closing === "completed" ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.08)", "#22c55e")}>
          <CheckCircle2 size={11} /> Done
        </button>
        <button disabled={busy} onClick={() => { setClosing(c => c === "dismissed" ? null : "dismissed"); setNote(""); }}
          style={btn(closing === "dismissed" ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.03)", "#64748b")}>
          <Ban size={11} /> Dismiss
        </button>
        {/*
          The way into the conversation. Assigning, closing and dismissing are
          list actions and stay here; talking to whoever is working it is not
          something a row can hold.
        */}
        <Link href={`/pipeline/${item.id}`} style={{ textDecoration: "none" }}>
          <span style={btn("rgba(255,255,255,0.03)", "#94a3b8")}>
            <MessageSquare size={11} /> Open conversation
          </span>
        </Link>
        <span style={{ fontSize: "10.5px", color: "#334155", marginLeft: "auto" }}>
          {item.authored.kind === "human"
            ? <>suggested by <strong style={{ color: "#64748b" }}>{item.filed_by ?? "someone"}</strong>
                {item.authored.recorded_by && item.authored.recorded_by !== item.authored.suggested_by
                  ? <>, recorded by {item.authored.recorded_by}</> : null}</>
            : <>filed by {item.filed_by ?? "agent"}</>}
          {" · "}{item.type.replace(/_/g, " ")} · {item.occurrences > 1 ? `reported ${item.occurrences}×` : "reported once"}
        </span>
      </div>

      {/*
        The account of the decision. It is posted to the insight's conversation
        and to /feedback in one go — see closeOut in the board below for why the
        second one is the whole point.
      */}
      {closing && (
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 9,
          background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <p style={{ fontSize: "10.5px", color: "#64748b", margin: "0 0 7px", lineHeight: 1.55 }}>
            {closing === "completed"
              ? "What was actually done? The agent that filed this reads it before it analyses the section again."
              : "Why is this not worth doing? This is the only way the agents stop filing more like it."}
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder={closing === "completed"
              ? "e.g. Built the flow in Klaviyo, live since Tuesday."
              : "e.g. We tried this in March — the lift did not survive a holdout."}
            style={{
              width: "100%", resize: "vertical", padding: "7px 9px", borderRadius: 7,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#cbd5e1", fontSize: "12px", fontFamily: "inherit", lineHeight: 1.5, outline: "none",
            }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button
              disabled={busy || !note.trim()}
              onClick={() => { onClose(closing, note.trim()); setClosing(null); setNote(""); }}
              style={{
                padding: "6px 13px", borderRadius: 7, border: "none",
                cursor: busy || !note.trim() ? "not-allowed" : "pointer",
                background: !note.trim() ? "rgba(255,255,255,0.05)" : closing === "completed" ? "#22c55e" : "#64748b",
                color: !note.trim() ? "#475569" : "#0b1220",
                fontSize: "11.5px", fontWeight: 800,
              }}>
              {closing === "completed" ? "Mark it done" : "Dismiss it"}
            </button>
            <button disabled={busy} onClick={() => { setClosing(null); setNote(""); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", fontSize: "11px" }}>
              Cancel
            </button>
            {!note.trim() && (
              <span style={{ fontSize: "10.5px", color: "#334155" }}>A reason is required.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── The board ─────────────────────────────────────────────────────────────────
const SORT_TABS: { key: SortKey; label: string; hint: string }[] = [
  { key: "risk", label: "Priority", hint: "Assessed risk, reinforced by how often it was independently reported" },
  { key: "value", label: "Money", hint: "Measured figures first, then claims, by size. Unpriced last — never guessed" },
  { key: "effort", label: "Effort", hint: "Cheapest first. Insights with no recorded effort sort last" },
  { key: "due", label: "Due", hint: "Soonest due first. Insights nobody set a date for sort last — a date is never inferred" },
  { key: "newest", label: "Newest", hint: "Most recently filed" },
  { key: "section", label: "Section", hint: "Grouped by area of the business" },
];

/** Lateness filter tabs. Counts come from the server's whole-board summary. */
const DUE_TABS: { key: DueFilter; label: string; hint: string }[] = [
  { key: "all", label: "Any", hint: "No date filter" },
  { key: "late", label: "At risk", hint: "Overdue or inside the last 20% of the time allotted" },
  { key: "overdue", label: "Overdue", hint: "Past the due date" },
  { key: "soon", label: "Due soon", hint: "Inside the last 20% of the time allotted" },
  { key: "undated", label: "No date", hint: "Nobody has committed to a date for these" },
];

export interface InsightsBoardProps {
  /**
   * A space id from lib/spaces.tsx — `"marketing"`, `"seo"`, `"audience"`. Omitted
   * on /pipeline, which shows every space at once. The server does the legacy
   * expansion; see the note at the top of this file.
   */
  section?: string;
  /** Overrides the space's own colour. Defaults to the space accent, then amber. */
  accent?: string;
  /** Rendered above the list when the board is empty and nothing is filtered out. */
  emptyHint?: React.ReactNode;
}

export default function InsightsBoard({ section, accent: accentProp, emptyHint }: InsightsBoardProps) {
  const space = section ? getSpace(section) : null;
  const accent = accentProp ?? space?.color ?? DEFAULT_ACCENT;

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortKey>("risk");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [assignee, setAssignee] = useState<string>("all");
  /** Who is looking. Only the identity is wanted here — the write controls are
   *  gated by the proxy, not by this. Null on a break-glass password session,
   *  which is why the Mine option is conditional rather than always rendered. */
  const { user } = useRole();
  const [recording, setRecording] = useState(false);
  // A manual analysis run, and whether one is in flight. Only offered inside a
  // space — "run every space at once" is a different and much more expensive
  // decision than the one that was asked for.
  const [run, setRun] = useState<RunJob | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Deep links from /pipeline/<id> arrive as ?focus= and may point at any lane,
  // so start on `all` rather than silently filtering the target out.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lane, setLane] = useState<"business" | "ops" | "all">("business");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assignItem, setAssignItem] = useState<BoardItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Sorting by section inside a single section groups everything into one group.
  const sortTabs = useMemo(
    () => (section ? SORT_TABS.filter(t => t.key !== "section") : SORT_TABS),
    [section],
  );

  // Read from window.location rather than useSearchParams: the latter opts a
  // statically-prerendered route into client-only rendering, which replaced a
  // whole page with its Suspense fallback once already (see Command Center).
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) { setFocusId(focus); setExpanded(focus); setLane("all"); }
  }, []);

  const fetchBoard = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ sort, lane, limit: "200" });
      if (section) qs.set("section", section);
      const res = await fetch(`${BOT_URL}/admin/insights/board?${qs}`);
      if (!res.ok) throw new Error(`Board unavailable (HTTP ${res.status})`);
      setBoard(await res.json());
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [sort, lane, section]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => {
    const t = setInterval(fetchBoard, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchBoard]);

  useEffect(() => {
    (async () => {
      const [aRes, tRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/agents`).catch(() => null),
        fetch(`${BOT_URL}/admin/team`).catch(() => null),
      ]);
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

  /**
   * My own handle in the team directory — NOT `session.user.username`.
   *
   * Those are two different strings and confusing them silently breaks this
   * filter. `human_tasks.assigned_to` holds `team_members.username`
   * ("ashdash0629"), because that is what the assign modal sends; the session
   * carries the Discord display name at sign-in ("Ash"). Comparing the two
   * matches nothing and the filter just looks empty.
   *
   * The Discord snowflake is the only key that is stable across both, so the
   * handle is resolved through it.
   */
  const myHandles = useMemo(() => {
    const row = teamMembers.find(m => m.discord_id === user?.id);
    return new Set(
      [row?.username, row?.display_name].filter(Boolean).map(v => String(v).toLowerCase()),
    );
  }, [teamMembers, user?.id]);

  /**
   * Is this row mine? `assignee.id` for a human is that same `assigned_to`, and
   * `name` falls back to it when `assigned_username` is null — which is always,
   * see the note in InsightDetail. Case-insensitive, because Discord handles are.
   */
  const isMine = useCallback((i: BoardItem) => {
    if (i.assignee?.kind !== "human" || myHandles.size === 0) return false;
    return myHandles.has((i.assignee.id ?? "").toLowerCase())
        || myHandles.has((i.assignee.name ?? "").toLowerCase());
  }, [myHandles]);

  /** How many rows are mine. Counted over the loaded board, so it is only shown
   *  when that board is every lane — see the option below. */
  const mineCount = useMemo(() => (board?.items ?? []).filter(isMine).length, [board, isMine]);

  /**
   * Search, lateness and assignee are all filtered here rather than on the
   * server, because the summary strip above the table reports the whole board
   * and a server-side filter would quietly change what those totals mean. The
   * board is capped at 200 rows and holds far fewer, so this costs nothing.
   */
  // ── The manual analysis run ────────────────────────────────────────────────
  /**
   * Ash's ask, in full: "I cannot manually run the insights on that page. There
   * is no button." The board's own Refresh re-reads rows an overnight routine
   * wrote; this sends the space's lead agent to go and look now.
   *
   * It is a real agent run, so it takes minutes, not the moment a click takes.
   * The button therefore has to stay honest about that — a spinner that resolves
   * in 300ms and changes nothing is worse than no button, because it teaches you
   * the data is fresh when it is not.
   */
  const pollRun = useCallback(async () => {
    if (!section) return;
    const res = await fetch(`${BOT_URL}/admin/insights/refresh?section=${section}`).catch(() => null);
    if (!res?.ok) return;
    const json = await res.json();
    setRun(json.job ?? null);
    return json.job as RunJob | null;
  }, [section]);

  useEffect(() => { void pollRun(); }, [pollRun]);

  // Only poll while something is actually in flight, and re-read the board once
  // it lands — the whole point is seeing what the run filed.
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    const t = setInterval(async () => {
      const latest = await pollRun();
      if (latest && !["queued", "running"].includes(latest.status)) await fetchBoard();
    }, RUN_POLL_MS);
    return () => clearInterval(t);
  }, [run, pollRun, fetchBoard]);

  const startRun = async () => {
    if (!section) return;
    setStarting(true); setRunError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const json = await res.json();
      // 409 is the unassigned-space case, and it names the decision that is
      // missing rather than reading as a failure.
      if (!res.ok) throw new Error(json.how_to_proceed ? `${json.error} ${json.how_to_proceed}` : (json.error ?? `HTTP ${res.status}`));
      setRun(json.job ?? null);
    } catch (e) { setRunError(e instanceof Error ? e.message : String(e)); }
    finally { setStarting(false); }
  };

  const running = !!run && ["queued", "running"].includes(run.status);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (board?.items ?? []).filter(i => {
      if (q && !(
        i.title.toLowerCase().includes(q) ||
        (i.body ?? "").toLowerCase().includes(q) ||
        i.section.toLowerCase().includes(q)
      )) return false;

      if (dueFilter === "late" && i.due.state !== "overdue" && i.due.state !== "due_soon") return false;
      if (dueFilter === "overdue" && i.due.state !== "overdue") return false;
      if (dueFilter === "soon" && i.due.state !== "due_soon") return false;
      if (dueFilter === "undated" && i.due.state !== "none") return false;

      if (assignee === "unassigned" && i.assignee) return false;
      if (assignee === "mine" && !isMine(i)) return false;
      if (assignee !== "all" && assignee !== "unassigned" && assignee !== "mine"
          && i.assignee?.id !== assignee) return false;

      return true;
    });
  }, [board, search, dueFilter, assignee, isMine]);

  /** Everyone and everything currently holding a row, for the assignee filter. */
  const assignees = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; kind: "agent" | "human" }>();
    for (const i of board?.items ?? []) {
      if (i.assignee && !seen.has(i.assignee.id)) seen.set(i.assignee.id, i.assignee);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [board]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const assign = async (item: BoardItem, agentId: string | null, agentName: string | null, humanUsername: string | null, notify: boolean) => {
    setBusyId(item.id);
    try {
      await fetch(`${PROXY_URL}/admin/pipeline/${item.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: "insight", agent_id: agentId, agent_name: agentName, human_username: humanUsername, notify }),
      });
      await fetchBoard();
    } finally { setBusyId(null); }
  };

  /**
   * Set or clear a due date. Null clears it; the server rejects anything unparseable.
   *
   * Left on BOT_URL rather than the proxy, matching `snooze()` in InsightActions:
   * PATCH carries no identity stamp and a due date records no actor, so routing
   * it through the proxy would buy nothing but a hop. Assign, reassign and the
   * two closes all attach a person's name to a decision, which is why those go
   * the other way.
   */
  const setDue = async (item: BoardItem, iso: string | null) => {
    setBusyId(item.id);
    try {
      await fetch(`${BOT_URL}/admin/insights/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: iso }),
      });
      await fetchBoard();
    } finally { setBusyId(null); }
  };

  /**
   * Close a row out, the same way InsightActions does it on the detail page.
   *
   * This used to be `PATCH /admin/insights/:id` with a canned
   * "Dismissed from the Insights list." Three routes can resolve an insight and
   * only `/feedback` writes an `insight_feedback` row carrying `section_id` —
   * which is what `get_section_feedback` filters on, the tool an agent calls
   * before analysing a section again. Closing any other way teaches the agents
   * nothing, and the table shows it: the newest row in `insight_feedback` was
   * written 2026-06-21, by the UI this board replaced. Ten weeks of decisions
   * went to a column nothing reads.
   *
   * Speech first, decision second, as on the detail page: `completion_notes` is
   * not injected into an agent's next run but the thread is, and posting before
   * the close means a failure at the second step cannot lose the words.
   */
  const closeOut = async (item: BoardItem, action: "completed" | "dismissed", note: string) => {
    setBusyId(item.id);
    try {
      const body = JSON.stringify({ kind: "decision", body: note });
      await fetch(`${PROXY_URL}/admin/insights/${item.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      await fetch(`${PROXY_URL}/admin/insights/${item.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
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
  const colCount = section ? 7 : 8;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
          {sortTabs.map(t => (
            <button key={t.key} onClick={() => setSort(t.key)} title={t.hint}
              style={{
                padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "11.5px",
                fontWeight: sort === t.key ? 800 : 500,
                background: sort === t.key ? `${accent}26` : "transparent",
                color: sort === t.key ? accent : "#64748b",
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

        <button onClick={() => { setLoading(true); fetchBoard(); }} title="Re-read the board. To go and look for new findings, use Run analysis."
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          <span style={{ fontSize: "11px" }}>Refresh</span>
        </button>

        <button onClick={() => setRecording(true)} title="Record something the team came up with"
          style={{ background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 8, padding: "6px 11px", cursor: "pointer", color: accent, display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
          <Plus size={13} />
          <span style={{ fontSize: "11px" }}>Record insight</span>
        </button>

        {/*
          Only inside a space. On /pipeline this would mean "run every space",
          which is a much bigger and more expensive thing than the one that was
          asked for, and nobody asked for it.
        */}
        {section && (
          <button onClick={startRun} disabled={running || starting}
            title={running ? "An analysis is already running for this space" : "Send this space's lead agent to look at the live data now"}
            style={{
              background: running ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${running ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8, padding: "6px 11px", cursor: running || starting ? "default" : "pointer",
              color: running ? "#38bdf8" : "#94a3b8", display: "flex", alignItems: "center", gap: 5, fontWeight: 700,
            }}>
            {running || starting
              ? <Loader2 size={13} className="spin" />
              : <Play size={13} />}
            <span style={{ fontSize: "11px" }}>{running ? "Analysing…" : starting ? "Starting…" : "Run analysis"}</span>
          </button>
        )}
      </div>

      {/* Lateness and assignee — the two filters asked for alongside the colours. */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
          {DUE_TABS.map(t => {
            const count = t.key === "all" ? null
              : t.key === "late" ? (board?.due_summary?.overdue ?? 0) + (board?.due_summary?.due_soon ?? 0)
              : t.key === "overdue" ? board?.due_summary?.overdue ?? 0
              : t.key === "soon" ? board?.due_summary?.due_soon ?? 0
              : board?.due_summary?.undated ?? 0;
            const tint = t.key === "overdue" ? "#f43f5e" : t.key === "soon" ? "#fb923c" : "#e2e8f0";
            return (
              <button key={t.key} onClick={() => setDueFilter(t.key)} title={t.hint}
                style={{
                  padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "11px",
                  fontWeight: dueFilter === t.key ? 800 : 500,
                  background: dueFilter === t.key ? "rgba(255,255,255,0.07)" : "transparent",
                  color: dueFilter === t.key ? tint : "#64748b",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                {t.label}
                {count != null && count > 0 && (
                  <span style={{ fontSize: "9px", fontWeight: 800, color: tint, background: `${tint}1a`, borderRadius: 4, padding: "0 4px" }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <select value={assignee}
          onChange={e => {
            const v = e.target.value;
            setAssignee(v);
            // "Mine" that hides half of mine is worse than no filter at all. The
            // board defaults to the business lane, so an insight handed to you in
            // ops — plumbing, a broken integration — would simply not be there.
            if (v === "mine") setLane("all");
          }}
          title="Filter by who is on it"
          style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8, padding: "6px 9px", color: assignee === "all" ? "#64748b" : "#e2e8f0",
            fontSize: "11.5px", outline: "none", cursor: "pointer", fontFamily: "inherit",
          }}>
          <option value="all">Anyone</option>
          {/* Only counted when the board holds every lane, or it under-reports. */}
          {myHandles.size > 0 && (
            <option value="mine">👤 Mine{lane === "all" && mineCount ? ` (${mineCount})` : ""}</option>
          )}
          <option value="unassigned">Nobody yet</option>
          {assignees.map(a => (
            <option key={a.id} value={a.id}>{a.kind === "agent" ? "🤖" : "👤"} {a.name}</option>
          ))}
        </select>

        {(dueFilter !== "all" || assignee !== "all") && (
          <button onClick={() => { setDueFilter("all"); setAssignee("all"); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", fontSize: "11px", display: "flex", alignItems: "center", gap: 3 }}>
            <X size={10} /> clear filters
          </button>
        )}
      </div>

      {/* What the run is doing, and what it did. Never a silent spinner. */}
      {section && (running || runError || (run && run.status === "failed")) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: "0.7rem",
          background: runError || run?.status === "failed" ? "rgba(244,63,94,0.06)" : "rgba(56,189,248,0.05)",
          border: `1px solid ${runError || run?.status === "failed" ? "rgba(244,63,94,0.25)" : "rgba(56,189,248,0.2)"}`,
          borderRadius: 10, padding: "0.6rem 0.85rem",
        }}>
          {running
            ? <Loader2 size={13} color="#38bdf8" className="spin" />
            : <AlertTriangle size={13} color="#f43f5e" />}
          <span style={{ fontSize: "11.5px", color: "#cbd5e1" }}>
            {runError
              ? runError
              : running
              ? <>{run?.agent_name ?? "The lead agent"} is reading the live data for this space. Anything it files appears here — this takes a few minutes.</>
              : <>The last analysis run failed{run?.error ? `: ${run.error}` : "."}</>}
          </span>
        </div>
      )}

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

      {/*
        The key to the stripes. Read-only on purpose: the lateness tabs above
        already filter on overdue / due soon / undated, and a second set of
        controls that filters on nearly-but-not-quite the same predicate is how
        two filters end up disagreeing in front of somebody.

        Counted from the rows actually on screen, so the numbers always describe
        the list underneath rather than the whole board — the opposite choice
        from the value summary above, which reports the board on purpose.
      */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.6rem", padding: "0 0.15rem" }}>
          {(Object.keys(ROW_STATE) as (keyof typeof ROW_STATE)[]).map(key => {
            const { color, label } = ROW_STATE[key];
            const count = items.filter(i => rowState(i) === key).length;
            if (!count) return null;
            return (
              <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "10.5px", color: "#64748b" }}>
                <span style={{
                  width: 3, height: 12, borderRadius: 2,
                  // No stripe is itself a state, and the key has to show that as
                  // an absence rather than invent a grey band for it.
                  background: color ?? "transparent",
                  border: color ? "none" : "1px dashed rgba(255,255,255,0.14)",
                }} />
                <strong style={{ color: color ?? "#475569", fontWeight: 800 }}>{count}</strong> {label.toLowerCase()}
              </span>
            );
          })}
          <span title="Overdue outranks everything, then a question waiting on a person, then a date inside seven days or the last fifth of its window, then simply having an owner. Nothing on track is coloured — a board where most rows glow is one you stop reading colour on."
            style={{ display: "inline-flex", alignItems: "center", cursor: "help" }}>
            <Info size={10} color="#334155" />
          </span>
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: section ? 660 : 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={{ ...th, width: 28 }} />
                <th style={th}>Insight</th>
                <th style={th}>Due</th>
                <th style={{ ...th, textAlign: "right" }}>Value</th>
                <th style={th}>Effort</th>
                <th style={th}>Risk</th>
                <th style={th}>Assignee</th>
                {!section && <th style={{ ...th, textAlign: "right" }}>Age</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={colCount} style={{ padding: "3rem 1rem", textAlign: "center", color: "#334155", fontSize: "13px" }}>
                  {search || dueFilter !== "all" || assignee !== "all"
                    ? <>Nothing matches those filters{(board?.items?.length ?? 0) > 0 ? <> — {board?.items.length} insight{board?.items.length === 1 ? " is" : "s are"} hidden by them</> : null}.</>
                    : emptyHint ?? (section
                      ? "Nothing open in this lane. Run analysis sends this space's lead agent to look."
                      : "Nothing open in this lane. Run an analysis to populate it.")}
                </td></tr>
              )}
              {items.map(item => {
                const open = expanded === item.id;
                const riskColor = RISK_COLOR[item.risk_tier ?? ""] ?? "#64748b";
                const effort = item.effort.tier ? EFFORT_LABEL[item.effort.tier] : null;
                /*
                  Where this row stands, as a colour. See ROW_STATE above for the
                  order and why there are only four. A deep-linked row keeps the
                  accent stripe instead: focus is transient and says "this is the
                  one you clicked", which for as long as it lasts outranks
                  anything the row is telling you about itself.
                */
                const state = ROW_STATE[rowState(item)];
                const stripe = item.id === focusId ? accent : state.color;
                return (
                  <React.Fragment key={item.id}>
                    <tr id={`insight-${item.id}`} onClick={() => setExpanded(open ? null : item.id)}
                      title={item.id === focusId ? undefined : state.label}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
                        // The tint is deliberately at the edge of visible — enough to
                        // group a band of rows when you unfocus your eyes, not enough
                        // to fight the text on top of it.
                        background: item.id === focusId
                          ? `${accent}0f`
                          : open
                          ? "rgba(255,255,255,0.02)"
                          : stripe
                          ? `${stripe}0a`
                          : "transparent",
                        boxShadow: stripe ? `inset 3px 0 0 ${stripe}` : undefined,
                      }}>
                      <td style={{ ...td, paddingRight: 0, color: "#475569" }}>
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
                      <td style={{ ...td, maxWidth: 460 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                          {/*
                            Inside a space the chip is only worth drawing when the row
                            carries a retired section value — "Email" on Marketing's tab
                            says something; "Marketing" on Marketing's tab does not.
                          */}
                          {(!section || item.section !== section) && (
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                              {SECTION_LABEL[item.section] ?? item.section}
                            </span>
                          )}
                          {item.occurrences > 1 && (
                            <span title={`Independently reported ${item.occurrences} times`}
                              style={{ fontSize: "9px", fontWeight: 700, color: "#fb923c", background: "rgba(251,146,60,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                              {item.occurrences}×
                            </span>
                          )}
                          {/*
                            An agent blocked on a person outranks its work status
                            on the row. The status says what the machine is doing;
                            this says the machine has stopped and is waiting for
                            YOU, which is the only thing on the board asking the
                            reader for anything.
                          */}
                          {item.waiting_on_human && (
                            <span title={`${item.waiting_on_human.agent_name} asked: ${item.waiting_on_human.question}`}
                              style={{ fontSize: "9px", fontWeight: 700, color: accent, background: `${accent}1a`, border: `1px solid ${accent}44`, padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <HelpCircle size={8} /> needs you
                            </span>
                          )}
                          {item.work && (
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                              {item.work.status}
                            </span>
                          )}
                          {section && (
                            <span style={{ fontSize: "9px", color: "#334155", marginLeft: "auto" }}>{ageLabel(item.age_days)}</span>
                          )}
                        </div>
                        <p style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "12.5px", margin: 0, lineHeight: 1.4 }}>{item.title}</p>
                        {item.work?.milestone_label && !open && (
                          <p style={{ color: "#475569", fontSize: "10.5px", margin: "3px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={9} /> {item.work.milestone_label}
                          </p>
                        )}
                      </td>
                      <td style={td}><DueCell due={item.due} /></td>
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
                            style={{ fontSize: "11px", fontWeight: 700, color: accent, background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                            Assign
                          </button>
                        )}
                      </td>
                      {!section && (
                        <td style={{ ...td, textAlign: "right", color: "#475569", fontSize: "11px", whiteSpace: "nowrap" }}>
                          {ageLabel(item.age_days)}
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={colCount} style={{ padding: 0 }}>
                          <RowDetail
                            item={item}
                            accent={accent}
                            busy={busyId === item.id}
                            onAssign={() => setAssignItem(item)}
                            onClose={(action, note) => closeOut(item, action, note)}
                            onDue={iso => setDue(item, iso)}
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
        <Link href="/blockages" style={{ color: "#64748b" }}>Blockages</Link>, not here. Execution detail lives in{" "}
        <Link href="/work" style={{ color: "#64748b" }}>Tasks</Link>.
        {section && <> Every space&rsquo;s board is on <Link href="/pipeline" style={{ color: "#64748b" }}>Insights</Link>.</>}
      </p>

      <AnimatePresence>
        {recording && (
          <RecordModal
            section={section}
            accent={accent}
            teamMembers={teamMembers}
            onClose={() => setRecording(false)}
            onFiled={fetchBoard}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignItem && (
          <AssignModal
            item={assignItem}
            agents={agents}
            teamMembers={teamMembers}
            accent={accent}
            onClose={() => setAssignItem(null)}
            onAssign={(agentId, agentName, humanUsername, notify) => assign(assignItem, agentId, agentName, humanUsername, notify)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Re-exported so a space page can render the same lightbulb in its own header. */
export { Lightbulb as InsightsIcon };
