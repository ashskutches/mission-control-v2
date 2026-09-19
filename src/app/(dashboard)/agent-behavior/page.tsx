"use client";
/**
 * Agent Behaviour — where the agents get stuck, and how much of it they say
 * themselves.
 *
 * ## Why this is not a tab on /agents
 *
 * `/agents` is the roster: who exists, what their prompt says, which routines
 * they run. `AgentMetrics` on it already reports runs, success rate, duration
 * and cost — and those are throughput numbers, which are the wrong instrument
 * for the question Ash asked. A "98% success rate" means the runs did not throw.
 * An agent that politely reported it could not proceed scores as a success by
 * that measure, and an agent that quietly approximated an answer it could not
 * get scores higher than one that admitted the gap.
 *
 * This page measures the opposite thing: the walls. Three reads, in the order
 * you want them —
 *
 *   1. **Stuck now** — work that has stopped, oldest first, each with a stated
 *      reason or a visible admission that there is not one
 *   2. **What keeps happening** — every wall hit, grouped by shape
 *   3. **Per agent** — what it finished, what it abandoned, and how much of its
 *      own stopping it explained
 *
 * ## The one number
 *
 * `self_reported_pct` — of the times an agent stopped short, how often did it
 * say why (a `log_limitation` call) versus how often did the runner have to
 * infer it from an exhausted run counter?
 *
 * That ratio is the argument for widening an agent's leash, and it is the only
 * one here that is not a vibe. An agent that reliably names its own limits can
 * be given more rope, because you will hear about it when the rope is wrong. An
 * agent whose stalls are all discovered after the fact cannot, however good the
 * output looks when it works. Everything else on this page is context for
 * reading that column.
 *
 * ## Nothing is inferred to fill a hole
 *
 * Same rule as the insights board. An agent that has never stopped shows "—",
 * not 100% — "never stopped" and "always explains itself" are different facts,
 * and a page that conflates them hands a perfect score to an agent nobody has
 * given any work. A stall with no recorded reason renders as **no reason
 * recorded**, in red, rather than borrowing the last thing the agent happened to
 * write down and presenting it as an explanation.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, Bot, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, Info, Loader2, MessageSquareWarning, Wrench,
  ShieldQuestion, X, ArrowUpRight, Megaphone, EyeOff,
} from "lucide-react";
import { useRole } from "@/app/lib/useRole";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
/** Resolving a limitation attaches a person's name to a decision. Same rule as
 *  closing an insight — the proxy stamps who, the browser does not get to say. */
const PROXY_URL = "/api/bot";
const ACCENT = "#e98d20";
const REFRESH_MS = 60_000;

// ── Types (mirror GET /admin/agent-behavior) ─────────────────────────────────
interface StallReason {
  kind: string; label: string; title: string;
  needed: string | null; attempted: string | null;
}
interface Stall {
  work_id: string; insight_id: string | null;
  agent_id: string; agent_name: string | null;
  title: string; status: string;
  runs: string; runs_exhausted: boolean;
  milestone: string | null; milestone_index: number; milestone_total: number;
  stalled_days: number;
  reason: StallReason | null;
  /** agent = it told us · system = the runner inferred it · progress = only a
   *  progress note · none = nothing at all. */
  reason_source: "agent" | "system" | "progress" | "none";
  last_progress: string | null;
  updated_at: string;
}
interface KindRow {
  kind: string; label: string; count: number;
  blocking: number; open: number; self_reported: number; agents: string[];
}
interface AgentRow {
  agent_id: string; agent_name: string;
  runs: number;
  work: { done: number; stalled: number; live: number; cancelled: number; total: number };
  avg_runs_to_done: number | null;
  limitations: {
    total: number; blocking: number; worked_around: number;
    open: number; self_reported: number; system_caught: number;
  };
  self_reported_pct: number | null;
  top_kind: { kind: string; label: string; count: number } | null;
}
interface Limitation {
  id: string;
  agent_id: string; agent_name: string | null;
  insight_id: string | null; work_id: string | null;
  section: string | null; run_number: number | null;
  kind: string; title: string; detail: string | null;
  attempted: string | null; needed: string | null;
  blocks: boolean; severity: number;
  blockage_id: string | null;
  source: "agent" | "system";
  resolved_at: string | null; resolved_by: string | null; resolution: string | null;
  created_at: string;
}
interface Behavior {
  window_days: number;
  agent_id: string | null;
  /** Tables the deploy has not migrated yet. Named, never silently empty. */
  unavailable: string[];
  totals: {
    runs: number; completed: number;
    stalls: number; stalls_unexplained: number;
    limitations: number; limitations_open: number; limitations_blocking: number;
    self_reported: number; system_caught: number;
  };
  agents: AgentRow[];
  by_kind: KindRow[];
  stalls: Stall[];
  limitations: Limitation[];
}

// ── Display ──────────────────────────────────────────────────────────────────
/**
 * Colour by what the reader can do about it, not by severity.
 *
 * `missing_decision` is amber and alone in that: it is the only kind where the
 * person reading this page is themselves the blocker. Everything else needs
 * building, granting or fixing by somebody; that one needs an answer.
 */
const KIND_TINT: Record<string, string> = {
  missing_tool:     "#a78bfa",
  missing_data:     "#38bdf8",
  missing_access:   "#f43f5e",
  missing_decision: "#e98d20",
  ambiguous_goal:   "#fb923c",
  tool_failed:      "#f43f5e",
  rate_limited:     "#64748b",
  cost_ceiling:     "#22c55e",
  out_of_runs:      "#fb7185",
  policy_refusal:   "#94a3b8",
  other:            "#475569",
};

/**
 * How the reason was come by. This is the distinction the page turns on, so it
 * is labelled in words on every row rather than encoded in a colour.
 *
 * `progress` is deliberately not called a reason: a last-progress note is the
 * last thing the agent happened to write, which may or may not be about why it
 * stopped. Presenting it as an explanation is how you end up confidently
 * misreading a stall.
 */
const SOURCE_BADGE: Record<Stall["reason_source"], { label: string; color: string; hint: string }> = {
  agent: {
    label: "agent said so",
    color: "#22c55e",
    hint: "The agent called log_limitation() and classified this itself. This is the behaviour to reward.",
  },
  system: {
    label: "we inferred it",
    color: "#fb923c",
    hint: "The runner worked this out — an exhausted run budget, or a throw. The agent did not report it.",
  },
  progress: {
    label: "guessing from its last note",
    color: "#f43f5e",
    hint: "No reason was recorded. All we have is the last progress note, which may not be about why it stopped.",
  },
  none: {
    label: "no reason recorded",
    color: "#f43f5e",
    hint: "It stopped and nothing anywhere says why. These are the rows to chase first.",
  },
};

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 30 ? `${days}d ago` : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const card: React.CSSProperties = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  overflow: "hidden",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 800, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.07em",
};
const th: React.CSSProperties = {
  fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase",
  letterSpacing: "0.07em", padding: "0.5rem 0.75rem", textAlign: "left", whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "0.6rem 0.75rem", verticalAlign: "middle" };

// ── Stat tile ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, icon: Icon, color = ACCENT, alert = false, hint }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string; alert?: boolean; hint?: string;
}) {
  return (
    <div title={hint} style={{
      background: alert ? "rgba(244,63,94,0.07)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${alert ? "rgba(244,63,94,0.25)" : `${color}20`}`,
      borderRadius: 14, padding: "0.85rem 1.1rem",
      display: "flex", alignItems: "flex-start", gap: 12,
      cursor: hint ? "help" : "default",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: `${alert ? "#f43f5e" : color}18`,
        border: `1px solid ${alert ? "#f43f5e" : color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
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

// ── One stall ────────────────────────────────────────────────────────────────
function StallRow({ s, expanded, onToggle }: { s: Stall; expanded: boolean; onToggle: () => void }) {
  const badge = SOURCE_BADGE[s.reason_source];
  const unexplained = s.reason_source === "none" || s.reason_source === "progress";
  return (
    <>
      <tr onClick={onToggle}
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
          background: unexplained ? "rgba(244,63,94,0.05)" : "transparent",
          boxShadow: `inset 3px 0 0 ${badge.color}`,
        }}>
        <td style={{ ...td, paddingRight: 0, color: "#475569", width: 28 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
        <td style={{ ...td, maxWidth: 420 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "1px 6px", borderRadius: 4 }}>
              {s.status}
            </span>
            {s.reason && (
              <span style={{
                fontSize: "9px", fontWeight: 700, borderRadius: 4, padding: "1px 6px",
                color: KIND_TINT[s.reason.kind] ?? "#94a3b8",
                background: `${KIND_TINT[s.reason.kind] ?? "#94a3b8"}1a`,
              }}>
                {s.reason.label}
              </span>
            )}
            <span title={badge.hint} style={{
              fontSize: "9px", fontWeight: 700, borderRadius: 4, padding: "1px 6px",
              color: badge.color, background: `${badge.color}14`, border: `1px solid ${badge.color}33`,
              display: "inline-flex", alignItems: "center", gap: 3, cursor: "help",
            }}>
              {s.reason_source === "agent" ? <Megaphone size={8} /> : <EyeOff size={8} />}
              {badge.label}
            </span>
          </div>
          <p style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "12.5px", margin: 0, lineHeight: 1.4 }}>{s.title}</p>
          {s.reason?.title && (
            <p style={{ color: "#94a3b8", fontSize: "10.5px", margin: "3px 0 0", lineHeight: 1.45 }}>{s.reason.title}</p>
          )}
        </td>
        <td style={td}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11.5px", color: "#cbd5e1" }}>
            <Bot size={11} color="#a78bfa" />{s.agent_name ?? s.agent_id}
          </span>
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <span title={s.runs_exhausted ? "Run budget spent — the runner will never pick this up again" : "Runs used of the budget"}
            style={{ fontSize: "11px", fontWeight: 700, color: s.runs_exhausted ? "#f43f5e" : "#64748b" }}>
            {s.runs}
          </span>
        </td>
        <td style={td}>
          {s.milestone_total > 0
            ? <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                {s.milestone_index}/{s.milestone_total}{s.milestone ? ` — ${s.milestone}` : ""}
              </span>
            : <span style={{ color: "#334155", fontSize: "12px" }}>—</span>}
        </td>
        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: s.stalled_days >= 7 ? "#f43f5e" : s.stalled_days >= 2 ? "#fb923c" : "#64748b" }}>
            {s.stalled_days === 0 ? "today" : `${s.stalled_days}d`}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <div style={{ padding: "0.9rem 1.1rem 1rem 2.6rem", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.18)" }}>
              {s.reason ? (
                <>
                  {s.reason.needed && (
                    <div style={{ marginBottom: "0.7rem" }}>
                      <p style={{ ...sectionTitle, fontSize: "9.5px", color: "#22c55e", margin: "0 0 3px" }}>What would unblock it</p>
                      <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>{s.reason.needed}</p>
                    </div>
                  )}
                  {s.reason.attempted && (
                    <div style={{ marginBottom: "0.7rem" }}>
                      <p style={{ ...sectionTitle, fontSize: "9.5px", margin: "0 0 3px" }}>What it tried</p>
                      <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{s.reason.attempted}</p>
                    </div>
                  )}
                </>
              ) : (
                /*
                  The honest empty state. A stall with no recorded reason is the
                  most important row on this page and it has to read that way —
                  the fix is not a nicer fallback, it is the agent calling
                  log_limitation before it gives up.
                */
                <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.22)", borderRadius: 9, padding: "0.65rem 0.85rem", marginBottom: "0.7rem" }}>
                  <p style={{ fontSize: "11.5px", color: "#fb7185", margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={12} /> Nothing recorded about why this stopped
                  </p>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "5px 0 0", lineHeight: 1.5 }}>
                    {s.agent_name ?? s.agent_id} stopped without calling <code style={{ color: "#cbd5e1" }}>log_limitation()</code>,{" "}
                    <code style={{ color: "#cbd5e1" }}>create_blockage()</code> or <code style={{ color: "#cbd5e1" }}>complete_work()</code>.
                    {s.last_progress ? " Its last progress note is below — it may or may not be about why." : " There is no progress note either."}
                  </p>
                </div>
              )}

              {s.last_progress && (
                <div style={{ marginBottom: "0.7rem" }}>
                  <p style={{ ...sectionTitle, fontSize: "9.5px", margin: "0 0 3px" }}>Last thing it said</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{s.last_progress}</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {s.insight_id && (
                  <Link href={`/pipeline/${s.insight_id}`} style={{ fontSize: "11px", color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Open the insight <ArrowUpRight size={10} />
                  </Link>
                )}
                <Link href="/work" style={{ fontSize: "11px", color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Open in Tasks <ArrowUpRight size={10} />
                </Link>
                <span style={{ fontSize: "10.5px", color: "#334155", marginLeft: "auto" }}>
                  last touched {when(s.updated_at)}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── One limitation, in the feed ──────────────────────────────────────────────
function LimitationRow({ l, onResolve, busy }: {
  l: Limitation;
  onResolve: (id: string, resolution: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const tint = KIND_TINT[l.kind] ?? "#475569";
  const resolved = !!l.resolved_at;

  return (
    <div style={{
      borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0.7rem 0.9rem",
      opacity: resolved ? 0.55 : 1,
      boxShadow: resolved ? undefined : `inset 3px 0 0 ${l.blocks ? "#f43f5e" : tint}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: "9px", fontWeight: 700, color: tint, background: `${tint}1a`, padding: "1px 6px", borderRadius: 4 }}>
          {l.kind.replace(/_/g, " ")}
        </span>
        {l.blocks
          ? <span title="This stopped the work" style={{ fontSize: "9px", fontWeight: 700, color: "#f43f5e", background: "rgba(244,63,94,0.12)", padding: "1px 6px", borderRadius: 4 }}>blocked</span>
          : <span title="The agent worked around this and carried on" style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>worked around</span>}
        <span title={l.source === "agent" ? "The agent reported this itself" : "The runner inferred it — the agent did not say"}
          style={{
            fontSize: "9px", fontWeight: 700, borderRadius: 4, padding: "1px 6px", cursor: "help",
            color: l.source === "agent" ? "#22c55e" : "#fb923c",
            background: l.source === "agent" ? "rgba(34,197,94,0.1)" : "rgba(251,146,60,0.1)",
          }}>
          {l.source === "agent" ? "self-reported" : "inferred"}
        </span>
        <span style={{ fontSize: "10.5px", color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Bot size={10} color="#a78bfa" />{l.agent_name ?? l.agent_id}
        </span>
        {resolved && (
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <CheckCircle2 size={8} /> resolved{l.resolved_by ? ` by ${l.resolved_by}` : ""}
          </span>
        )}
        <span style={{ fontSize: "9.5px", color: "#334155", marginLeft: "auto", whiteSpace: "nowrap" }}>{when(l.created_at)}</span>
      </div>

      <p style={{ fontSize: "12.5px", color: "#e2e8f0", fontWeight: 600, margin: 0, lineHeight: 1.45 }}>{l.title}</p>

      {l.needed && (
        <p style={{ fontSize: "11.5px", color: "#86efac", margin: "5px 0 0", lineHeight: 1.5 }}>
          <span style={{ color: "#475569", fontWeight: 700 }}>Needs: </span>{l.needed}
        </p>
      )}
      {l.attempted && (
        <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0", lineHeight: 1.5 }}>
          <span style={{ color: "#334155", fontWeight: 700 }}>Tried: </span>{l.attempted}
        </p>
      )}
      {l.resolution && (
        <p style={{ fontSize: "11px", color: "#94a3b8", margin: "5px 0 0", lineHeight: 1.5 }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>Resolved: </span>{l.resolution}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        {l.insight_id && (
          <Link href={`/pipeline/${l.insight_id}`} style={{ fontSize: "10.5px", color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
            insight <ArrowUpRight size={9} />
          </Link>
        )}
        {l.blockage_id && (
          <Link href="/blockages" style={{ fontSize: "10.5px", color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
            blockage <ArrowUpRight size={9} />
          </Link>
        )}
        {!resolved && (
          <button onClick={() => setOpen(o => !o)}
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: open ? "#22c55e" : "#475569", fontSize: "10.5px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={10} /> {open ? "Cancel" : "Mark it closed"}
          </button>
        )}
      </div>

      {open && !resolved && (
        <div style={{ marginTop: 8, padding: "9px 11px", borderRadius: 9, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/*
            The note is required, for the same reason it is required when closing
            an insight: this table's whole value is being readable in a month, and
            a row marked resolved with no account of what changed is a row nobody
            can explain then.
          */}
          <p style={{ fontSize: "10.5px", color: "#64748b", margin: "0 0 6px", lineHeight: 1.5 }}>
            What changed? The tool that got built, the access that got granted, or the decision that got made.
          </p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} disabled={busy}
            placeholder="e.g. Added a Shopify inventory tool — read_inventory_levels, live since Tuesday."
            style={{
              width: "100%", resize: "vertical", padding: "7px 9px", borderRadius: 7,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#cbd5e1", fontSize: "12px", fontFamily: "inherit", lineHeight: 1.5, outline: "none",
            }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 7 }}>
            <button disabled={busy || !note.trim()}
              onClick={() => { onResolve(l.id, note.trim()); setOpen(false); setNote(""); }}
              style={{
                padding: "5px 12px", borderRadius: 7, border: "none",
                cursor: busy || !note.trim() ? "not-allowed" : "pointer",
                background: !note.trim() ? "rgba(255,255,255,0.05)" : "#22c55e",
                color: !note.trim() ? "#475569" : "#0b1220", fontSize: "11px", fontWeight: 800,
              }}>
              Close it out
            </button>
            {!note.trim() && <span style={{ fontSize: "10.5px", color: "#334155" }}>A note is required.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AgentBehaviorPage() {
  const { role, loaded: roleLoaded } = useRole();
  /**
   * Closing a limitation out is an owner's call — it asserts that a capability
   * gap is gone, which nobody but the person who built or granted the thing can
   * know. Hidden rather than shown-and-refused; everything else here is read-only
   * and open to the team.
   */
  const canResolve = roleLoaded && role === "admin";

  const [data, setData] = useState<Behavior | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [expandedStall, setExpandedStall] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (agentFilter !== "all") qs.set("agent_id", agentFilter);
      const res = await fetch(`${BOT_URL}/admin/agent-behavior?${qs}`);
      if (!res.ok) throw new Error(`Unavailable (HTTP ${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days, agentFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const resolve = async (id: string, resolution: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${PROXY_URL}/admin/agent-behavior/limitations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`);
      }
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const limitations = useMemo(() => {
    let rows = data?.limitations ?? [];
    if (kindFilter !== "all") rows = rows.filter(l => l.kind === kindFilter);
    if (!showResolved) rows = rows.filter(l => !l.resolved_at);
    return rows;
  }, [data, kindFilter, showResolved]);

  const t = data?.totals;
  /**
   * The headline ratio, across every agent. Null rather than 0 when nothing has
   * stopped — see the docblock: an unused fleet has not earned a score.
   */
  const fleetSelfReported = useMemo(() => {
    if (!t) return null;
    const stops = t.self_reported + t.system_caught;
    return stops > 0 ? Math.round((t.self_reported / stops) * 100) : null;
  }, [t]);

  return (
    <div style={{ padding: "1.25rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.1rem", flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Activity size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#e2e8f0", margin: 0, lineHeight: 1 }}>Agent Behaviour</h1>
          <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0, marginTop: 3 }}>
            Where they get stuck · and how much of it they say themselves
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                title={`Count limitations over the last ${d} days. Stalls are never windowed — something stuck since June is the row that matters most.`}
                style={{
                  padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "11px",
                  fontWeight: days === d ? 800 : 500,
                  background: days === d ? `${ACCENT}26` : "transparent",
                  color: days === d ? ACCENT : "#64748b",
                }}>
                {d}d
              </button>
            ))}
          </div>

          {(data?.agents.length ?? 0) > 0 && (
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "6px 9px", color: agentFilter === "all" ? "#64748b" : "#e2e8f0",
                fontSize: "11.5px", outline: "none", cursor: "pointer", fontFamily: "inherit",
              }}>
              <option value="all">All agents</option>
              {data?.agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
              ))}
            </select>
          )}

          <button onClick={() => load()} title="Re-read"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            <span style={{ fontSize: "11px" }}>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={13} color="#f43f5e" />
          <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#475569" }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/*
        A table that has not been created yet is named rather than rendered as an
        empty page. "No limitations recorded" and "the migration has not run on
        this deploy" look identical from the outside and mean opposite things.
      */}
      {!!data?.unavailable?.length && (
        <div style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 10, padding: "0.7rem 0.9rem", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={13} color="#fb923c" />
          <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
            Waiting on a migration — <strong>{data.unavailable.join(", ")}</strong>{" "}
            {data.unavailable.length === 1 ? "does" : "do"} not exist on the bot yet, so those
            sections are empty rather than genuinely quiet. They fill in on the next gravity-claw boot.
          </span>
        </div>
      )}

      {/* The numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.7rem", marginBottom: "1rem" }}>
        <Stat
          label="Self-reported"
          value={fleetSelfReported != null ? `${fleetSelfReported}%` : "—"}
          sub={fleetSelfReported != null
            ? `${t?.self_reported ?? 0} said · ${t?.system_caught ?? 0} we caught`
            : "nothing has stopped yet"}
          icon={Megaphone}
          color={fleetSelfReported == null ? "#475569" : fleetSelfReported >= 70 ? "#22c55e" : fleetSelfReported >= 40 ? "#e98d20" : "#f43f5e"}
          hint="Of the times an agent stopped short, how often it said why rather than us finding out. This is the number to move before widening any agent's leash — and it is deliberately blank, not 100%, when nothing has stopped."
        />
        <Stat
          label="Stuck now"
          value={String(t?.stalls ?? 0)}
          sub={t?.stalls_unexplained ? `${t.stalls_unexplained} with no stated reason` : "all with a stated reason"}
          icon={AlertTriangle}
          color={t?.stalls ? "#fb923c" : "#22c55e"}
          alert={!!t?.stalls_unexplained}
          hint="Work sitting in blocked or needs_human. Never windowed — the oldest one is the most important."
        />
        <Stat
          label="Walls hit"
          value={String(t?.limitations ?? 0)}
          sub={`${t?.limitations_blocking ?? 0} stopped the work · ${(t?.limitations ?? 0) - (t?.limitations_blocking ?? 0)} worked around`}
          icon={Wrench}
          color="#a78bfa"
          hint="Every limitation recorded in the window. A high number here with a low 'stuck now' is a good sign, not a bad one: it means agents are hitting things and routing around them out loud."
        />
        <Stat
          label="Still open"
          value={String(t?.limitations_open ?? 0)}
          sub="gaps nobody has closed"
          icon={ShieldQuestion}
          color={t?.limitations_open ? "#e98d20" : "#22c55e"}
          hint="Unresolved limitations of any age, including ones older than the window."
        />
        <Stat
          label="Runs"
          value={String(t?.runs ?? 0)}
          sub={`${t?.completed ?? 0} finished a work item`}
          icon={Loader2}
          color="#38bdf8"
          hint="Agent runs started in the window, from the insight event log. Runs, not work items — nine runs on one item is a different thing from one run on nine."
        />
      </div>

      {/* ── Stuck now ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0.15rem 0.5rem" }}>
        <p style={sectionTitle}>Stuck right now</p>
        <span title="Oldest first, because the oldest stall is the one nobody is going to notice on their own. Rows tinted red have no recorded reason — those are the ones to chase, and the fix is the agent calling log_limitation before it gives up rather than a nicer message here."
          style={{ display: "inline-flex", cursor: "help" }}>
          <Info size={11} color="#334155" />
        </span>
      </div>
      <div style={{ ...card, marginBottom: "1.2rem" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={{ ...th, width: 28 }} />
                <th style={th}>What stopped</th>
                <th style={th}>Agent</th>
                <th style={th}>Runs</th>
                <th style={th}>Milestone</th>
                <th style={{ ...th, textAlign: "right" }}>Stalled</th>
              </tr>
            </thead>
            <tbody>
              {(data?.stalls.length ?? 0) === 0 && !loading && (
                <tr><td colSpan={6} style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#334155", fontSize: "13px" }}>
                  Nothing is stuck. Every work item is either running or finished.
                </td></tr>
              )}
              {data?.stalls.map(s => (
                <StallRow key={s.work_id} s={s}
                  expanded={expandedStall === s.work_id}
                  onToggle={() => setExpandedStall(expandedStall === s.work_id ? null : s.work_id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── What keeps happening ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0.15rem 0.5rem" }}>
        <p style={sectionTitle}>What keeps happening</p>
        <span title="Every kind is listed including the ones at zero. A never-used kind is a finding of its own — nobody filing a 'needs a human decision' does not mean the agents never need one."
          style={{ display: "inline-flex", cursor: "help" }}>
          <Info size={11} color="#334155" />
        </span>
        {kindFilter !== "all" && (
          <button onClick={() => setKindFilter("all")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", fontSize: "10.5px", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <X size={10} /> clear
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: "0.55rem", marginBottom: "1.2rem" }}>
        {(data?.by_kind ?? []).map(k => {
          const tint = KIND_TINT[k.kind] ?? "#475569";
          const on = kindFilter === k.kind;
          const empty = k.count === 0;
          return (
            <button key={k.kind}
              onClick={() => setKindFilter(on ? "all" : k.kind)}
              disabled={empty}
              title={empty
                ? `Nothing has been filed as "${k.label}" in this window.`
                : `${k.count} in the window · ${k.blocking} stopped the work · ${k.self_reported} self-reported${k.agents.length ? ` · ${k.agents.join(", ")}` : ""}`}
              style={{
                textAlign: "left", padding: "0.6rem 0.75rem", borderRadius: 11,
                cursor: empty ? "default" : "pointer", fontFamily: "inherit",
                background: on ? `${tint}18` : empty ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? `${tint}55` : "rgba(255,255,255,0.06)"}`,
                opacity: empty ? 0.45 : 1,
              }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: "1.15rem", fontWeight: 900, color: empty ? "#334155" : tint, lineHeight: 1 }}>{k.count}</span>
                <span style={{ fontSize: "11px", color: "#cbd5e1", fontWeight: 600 }}>{k.label}</span>
              </div>
              <p style={{ fontSize: "9.5px", color: "#475569", margin: "5px 0 0", lineHeight: 1.4 }}>
                {empty
                  ? "never filed"
                  : <>{k.blocking} blocked · {k.open} open · {k.self_reported} self-reported</>}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Per agent ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0.15rem 0.5rem" }}>
        <p style={sectionTitle}>Per agent</p>
        <span title="Sorted by how many items each agent has stuck. 'Says so' is the column to grow: an agent that names its own limits can be trusted with a longer leash, because you hear about it when the leash is wrong."
          style={{ display: "inline-flex", cursor: "help" }}>
          <Info size={11} color="#334155" />
        </span>
      </div>
      <div style={{ ...card, marginBottom: "1.2rem" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={th}>Agent</th>
                <th style={{ ...th, textAlign: "right" }}>Runs</th>
                <th style={{ ...th, textAlign: "right" }}>Done</th>
                <th style={{ ...th, textAlign: "right" }}>Stuck</th>
                <th style={{ ...th, textAlign: "right" }}>Runs to finish</th>
                <th style={{ ...th, textAlign: "right" }}>Walls</th>
                <th style={th}>Says so</th>
                <th style={th}>Most common wall</th>
              </tr>
            </thead>
            <tbody>
              {(data?.agents.length ?? 0) === 0 && !loading && (
                <tr><td colSpan={8} style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#334155", fontSize: "13px" }}>
                  No agent has run work or hit a wall in this window.
                </td></tr>
              )}
              {data?.agents.map(a => {
                const pct = a.self_reported_pct;
                const pctColor = pct == null ? "#475569" : pct >= 70 ? "#22c55e" : pct >= 40 ? "#e98d20" : "#f43f5e";
                return (
                  <tr key={a.agent_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={td}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#e2e8f0", fontWeight: 600 }}>
                        <Bot size={12} color="#a78bfa" />{a.agent_name}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontSize: "11.5px", color: "#94a3b8" }}>{a.runs}</td>
                    <td style={{ ...td, textAlign: "right", fontSize: "11.5px", color: a.work.done ? "#22c55e" : "#334155", fontWeight: 700 }}>{a.work.done}</td>
                    <td style={{ ...td, textAlign: "right", fontSize: "11.5px", color: a.work.stalled ? "#f43f5e" : "#334155", fontWeight: 700 }}>{a.work.stalled}</td>
                    <td style={{ ...td, textAlign: "right", fontSize: "11.5px", color: "#94a3b8" }}
                      title="Average runs used by the items this agent actually finished. Unfinished items are excluded — including them would measure how long we waited, not how much it took.">
                      {a.avg_runs_to_done ?? <span style={{ color: "#334155" }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontSize: "11.5px", color: "#94a3b8" }}
                      title={`${a.limitations.blocking} stopped the work, ${a.limitations.worked_around} were worked around`}>
                      {a.limitations.total}
                    </td>
                    <td style={td}>
                      {pct == null ? (
                        <span title="This agent has not stopped short in the window, so there is nothing to score. Deliberately not 100% — see the page notes."
                          style={{ fontSize: "11.5px", color: "#334155", cursor: "help" }}>—</span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}
                          title={`${a.limitations.self_reported} reported by the agent · ${a.limitations.system_caught} found by the runner`}>
                          <span style={{ width: 46, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden", flexShrink: 0 }}>
                            <span style={{ display: "block", width: `${pct}%`, height: "100%", background: pctColor, borderRadius: 2 }} />
                          </span>
                          <span style={{ fontSize: "11.5px", fontWeight: 800, color: pctColor }}>{pct}%</span>
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {a.top_kind ? (
                        <span style={{
                          fontSize: "9.5px", fontWeight: 700, borderRadius: 4, padding: "2px 7px",
                          color: KIND_TINT[a.top_kind.kind] ?? "#94a3b8",
                          background: `${KIND_TINT[a.top_kind.kind] ?? "#94a3b8"}1a`,
                        }}>
                          {a.top_kind.label} ×{a.top_kind.count}
                        </span>
                      ) : <span style={{ color: "#334155", fontSize: "12px" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── The feed ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0.15rem 0.5rem", flexWrap: "wrap" }}>
        <p style={sectionTitle}>Every wall, newest first</p>
        {kindFilter !== "all" && (
          <span style={{ fontSize: "10.5px", color: "#64748b" }}>
            filtered to <strong style={{ color: KIND_TINT[kindFilter] ?? "#94a3b8" }}>{kindFilter.replace(/_/g, " ")}</strong>
          </span>
        )}
        <button onClick={() => setShowResolved(v => !v)}
          style={{ marginLeft: "auto", background: showResolved ? "rgba(255,255,255,0.06)" : "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "3px 9px", fontSize: "10px", color: showResolved ? "#94a3b8" : "#475569", cursor: "pointer" }}>
          {showResolved ? "Hide" : "Show"} closed
        </button>
      </div>
      <div style={card}>
        {limitations.length === 0 && !loading && (
          <p style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#334155", fontSize: "13px", margin: 0 }}>
            {kindFilter !== "all" || !showResolved
              ? "Nothing matches those filters."
              : <>Nothing recorded in the last {days} days. Agents log these with <code style={{ color: "#475569" }}>log_limitation()</code>; the runner records the silent stalls itself.</>}
          </p>
        )}
        <AnimatePresence initial={false}>
          {limitations.map(l => (
            <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LimitationRow l={l} busy={busyId === l.id}
                onResolve={canResolve ? resolve : () => setError("Only an admin can close a limitation out.")} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <p style={{ fontSize: "10.5px", color: "#334155", margin: "0.8rem 0.15rem 0", lineHeight: 1.6 }}>
        <MessageSquareWarning size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
        A limitation is <em>what an agent ran into</em>. The ticket to go and fix it is a{" "}
        <Link href="/blockages" style={{ color: "#64748b" }}>Blockage</Link>, and one is filed alongside every
        limitation an agent reports — closing a row here says the gap is gone, which is not the same claim as
        the blockage being closed. Execution detail lives in{" "}
        <Link href="/work" style={{ color: "#64748b" }}>Tasks</Link>; the roster and prompts are on{" "}
        <Link href="/agents" style={{ color: "#64748b" }}>Agents</Link>.
        {!canResolve && roleLoaded && (
          <> Closing a limitation out is admin-only — it asserts a capability gap is gone.</>
        )}
      </p>

      {loading && !data && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "2rem", color: "#475569" }}>
          <Loader2 size={14} className="spin" />
          <span style={{ fontSize: "12px" }}>Reading the run log…</span>
        </div>
      )}
    </div>
  );
}
