"use client";
/**
 * InsightDetail — the header above an insight's conversation.
 *
 * Deliberately thin. Reading the board around an insight, sorting it, filtering
 * it, running an analysis — all of that already works on `/pipeline`, and
 * duplicating it here is how the last detail page reached a thousand lines and
 * then got deleted. This answers three questions and then gets out of the way:
 * what is this, who is on it, and where has the work got to.
 *
 * What it does now also carry is the *ask*, and the means to discharge it —
 * `InsightActions`, and the question pinned above the fold. That is not a
 * softening of the rule above: three DMs send a person to this address and two of
 * them say "mark complete", so a page that could not was making a liar of every
 * one of them, and the follow-up sweep kept re-sending the reminder because
 * nothing here could close the task. See the docblock on InsightActions for what
 * is deliberately still only on the board.
 *
 * The money is rendered through the server's `value` object, never the raw
 * `estimated_monthly_value` column. A `claimed` figure and a `measured` one are
 * different kinds of thing and are never added together, and a figure with no
 * stated basis is not shown at all — the board learned that after rendering a
 * +$40,000/mo badge built on an empty value_basis.
 */
import { MarkdownMessage } from "@/components/MarkdownMessage";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bot, User, AlertTriangle, Loader2, CheckCircle2,
  Clock, Target, Building2, HelpCircle, ClipboardList, ArrowDown, FlaskConical,
} from "lucide-react";
import InsightThread, { COMPOSER_ID } from "@/components/InsightThread";
import InsightActions from "@/components/InsightActions";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
/** Posting into the thread must go through the proxy — it is what stamps who is
 *  speaking. Same rule, and the same reason, as InsightThread and InsightActions. */
const PROXY_URL = "/api/bot";
const ACCENT = "#e98d20";

interface Milestone { label: string; done?: boolean }
interface Work {
  id: string; agent_id: string; agent_name: string | null; status: string;
  milestones: Milestone[]; current_milestone: number;
  last_progress: string | null; completion_report: string | null;
  run_count: number; max_runs: number; next_run_at: string | null;
}
interface HumanTask {
  id: string; title: string; assigned_username: string | null; assigned_to: string | null;
  status: string; completion_notes: string | null; followup_count: number | null;
  /** What the assignment DM said to do. It existed nowhere on this page before. */
  instructions: string | null;
}
/** An agent stopped, waiting on a person. Same rule as the board's chip — the
 *  server shares latestOpenQuestion() between the two so they cannot disagree. */
interface WaitingOnHuman { id: string; question: string; asked_at: string; agent_name: string }
/** Mirrors buildValue() in gravity-claw's utils/insight-board.ts. */
interface Value { amount: number | null; source: "measured" | "claimed" | null; basis: string | null }
interface Insight {
  id: string; title: string; body: string | null; section: string; lane: string | null;
  type: string; status: string; priority: number | null;
  risk_tier: string | null; risk_score: number | null;
  agent_name: string | null; assigned_agent_name: string | null;
  occurrences: number | null; created_at: string;
  /** Raw columns. The board gets a computed `due` object; this page has the row itself. */
  due_date: string | null;
  due_set_at: string | null;
  value: Value; work: Work | null; human_task: HumanTask | null;
  waiting_on_human: WaitingOnHuman | null;
}

/**
 * The same two thresholds the board colours by — red past due, orange through
 * the last fifth of the allotted time. Duplicated here rather than plumbed
 * through because this page reads the raw row (GET /admin/insights/:id) while
 * the board reads the computed one; the rule itself lives in gravity-claw's
 * utils/insight-due.ts and that is the copy to change first.
 *
 * The window is anchored on `due_set_at`, not `created_at`: allotted time is
 * time somebody allotted, and dating an old insight would otherwise be almost
 * entirely elapsed the moment it was saved.
 */
function dueChip(windowStart: string, dueDate: string | null): { label: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(due)) return null;
  const created = new Date(windowStart).getTime();
  const now = Date.now();
  const remaining = due - now;
  const days = remaining >= 0 ? Math.ceil(remaining / 86_400_000) : Math.floor(remaining / 86_400_000);
  if (remaining < 0) return { label: `${Math.abs(days)}d overdue`, color: "#f43f5e" };
  const allotted = due - created;
  const elapsed = allotted > 0 ? (now - created) / allotted : 1;
  return { label: `due in ${days}d`, color: elapsed >= 0.8 ? "#fb923c" : "#64748b" };
}

const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e", high: "#fb923c", medium: "#eab308", low: "#22c55e",
};

function Chip({ children, color = "#94a3b8", title }: { children: React.ReactNode; color?: string; title?: string }) {
  return (
    <span title={title} style={{
      fontSize: "9.5px", fontWeight: 700, color, background: `${color}15`,
      padding: "2px 7px", borderRadius: 5, textTransform: "capitalize",
    }}>{children}</span>
  );
}

export default function InsightDetail({ insightId }: { insightId: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumped after an action so the thread re-reads the message it just posted. */
  const [reloadToken, setReloadToken] = useState(0);
  /** Held through the navigation to /research, so the button cannot be double-fired. */
  const [researching, setResearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/${insightId}`);
      if (res.status === 404) throw new Error("That insight does not exist, or was purged.");
      if (!res.ok) throw new Error(`Could not load the insight (${res.status})`);
      setInsight(await res.json());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [insightId]);

  useEffect(() => { load(); }, [load]);

  const onChanged = useCallback(() => { load(); setReloadToken(t => t + 1); }, [load]);

  /**
   * Hand this insight to the research pipeline.
   *
   * The question is written and then *not* launched. A finding is not a question
   * — handing one straight to the pipeline buys twenty tool calls of the agent
   * restating the problem — and the composer's "Improve" pass exists precisely to
   * catch that before the minutes are spent. The person who pressed the button is
   * also the one who knows which part of the finding is the real unknown, and
   * they cannot say so if the run has already started.
   *
   * A note goes into the conversation first, for the same reason InsightActions
   * posts before it closes: `POST /admin/research` writes an `agent_jobs` row,
   * and `agent_jobs` has no `insight_id` — only `agent_work` does. Without the
   * note the report finishes somewhere this insight could never point at. The
   * thread is where that story already lives, so this needs no schema change.
   */
  const researchSolution = useCallback(async () => {
    if (!insight || researching) return;
    setResearching(true);

    const body = (insight.body ?? "").trim();
    // Truncated because the whole thing rides in a URL, and because a 4,000-word
    // write-up pasted into the question box buries the question inside it.
    const context = body.length > 1500 ? `${body.slice(0, 1500)}\n…(truncated)` : body;
    const question = [
      "What is the best-evidenced way to act on this, and what should we expect it to be worth?",
      "",
      `Finding (${insight.section}, filed by ${insight.agent_name ?? "an agent"}): ${insight.title}`,
      context,
    ].filter(Boolean).join("\n");

    // Best-effort: failing to annotate must not strand somebody on this page.
    // Who is speaking is stamped by the proxy — see IDENTITY_STAMPED.
    await fetch(`${PROXY_URL}/admin/insights/${insight.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "note",
        body: "Taking this to Research — the report will land in the research library.",
        replies_to: null,
      }),
    }).catch(() => {});

    // A finding worth investigating is worth more than 3 tool calls and less than
    // the 40 a landscape survey costs. The composer can change it.
    const qs = new URLSearchParams({ q: question, insight: insight.id, depth: "standard" });
    window.location.href = `/research?${qs.toString()}`;
  }, [insight, researching]);

  /**
   * The banner's Answer button focuses the one composer rather than opening a
   * second reply box. Two places to type an answer is two places for it to be
   * half-written, and the composer already picks `answer` and threads onto the
   * open question by itself.
   */
  const goToComposer = () => {
    const el = document.getElementById(COMPOSER_ID);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLTextAreaElement).focus({ preventScroll: true });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "5rem", color: "#475569" }}>
        <Loader2 size={16} className="animate-spin" /> <span style={{ fontSize: "13px" }}>Loading insight…</span>
      </div>
    );
  }

  if (error || !insight) {
    return (
      <div style={{ padding: "2rem 1.2rem", maxWidth: 900, margin: "0 auto" }}>
        <Link href="/pipeline" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "12px", textDecoration: "none", marginBottom: "1rem" }}>
          <ArrowLeft size={13} /> All insights
        </Link>
        <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 12, padding: "1.1rem", display: "flex", gap: 9, alignItems: "center" }}>
          <AlertTriangle size={15} color="#f43f5e" />
          <span style={{ fontSize: "13px", color: "#e2e8f0" }}>{error}</span>
        </div>
      </div>
    );
  }

  const w = insight.work;
  const riskColor = RISK_COLOR[insight.risk_tier ?? ""] ?? "#64748b";
  const milestone = w?.milestones?.[w.current_milestone];
  /**
   * `assigned_username` is null on every human task, so it cannot be the last
   * word here. /admin/pipeline/:id/reassign inserts `assigned_to` and never
   * populates `assigned_username`, which meant this page said "Nobody assigned
   * yet" directly above a panel headed "What you were asked to do" and a
   * follow-up counter reading "Reminded 3×". The board already falls back the
   * same way; this page did not, and was the one a person is DM'd to.
   */
  const assignee = insight.assigned_agent_name
    ?? w?.agent_name
    ?? insight.human_task?.assigned_username
    ?? insight.human_task?.assigned_to
    ?? null;

  return (
    <div style={{ padding: "1.4rem 1.2rem 3rem", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/pipeline" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "12px", textDecoration: "none", marginBottom: "0.9rem" }}>
        <ArrowLeft size={13} /> All insights
      </Link>

      {/*
        ── The ask, above everything ──
        A person who followed a DM here was asked something, and the question was
        previously findable only by scrolling a merged timeline to the bottom.
        The question outranks the title: what this insight is matters less, to
        this reader, than what is being waited on.
      */}
      {insight.waiting_on_human && (
        <div style={{
          background: `${ACCENT}12`, border: `1px solid ${ACCENT}44`, borderRadius: 12,
          padding: "0.85rem 0.95rem", marginBottom: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
            <HelpCircle size={13} color={ACCENT} />
            <span style={{ fontSize: "12px", fontWeight: 800, color: ACCENT }}>
              {insight.waiting_on_human.agent_name} is waiting on you
            </span>
            <span style={{ fontSize: "10px", color: "#64748b" }}>
              asked {new Date(insight.waiting_on_human.asked_at).toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "#e2e8f0", margin: "0 0 9px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {insight.waiting_on_human.question}
          </p>
          <button onClick={goToComposer}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", minHeight: 36, borderRadius: 8, border: "none",
              background: ACCENT, color: "#0b1220", fontSize: "12px", fontWeight: 800, cursor: "pointer",
            }}>
            <ArrowDown size={12} /> Answer it
          </button>
          <span style={{ fontSize: "10.5px", color: "#64748b", marginLeft: 10 }}>
            or just reply to the Discord DM — both land in the same place
          </span>
        </div>
      )}

      {/* ── What is this ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <Chip color="#94a3b8"><Building2 size={9} style={{ marginRight: 3, verticalAlign: -1 }} />{insight.section}</Chip>
        <Chip color={riskColor} title={insight.risk_score ? `Assessed ${insight.risk_score}/10` : undefined}>
          {insight.risk_tier ?? "unscored"} risk
        </Chip>
        <Chip color="#38bdf8">{insight.status}</Chip>
        {(insight.occurrences ?? 0) > 1 && (
          <Chip color="#fb923c" title={`Independently reported ${insight.occurrences} times`}>{insight.occurrences}×</Chip>
        )}
        {(() => {
          // Anchored on due_set_at — the time somebody allotted, not the row's age.
          const d = dueChip(insight.due_set_at ?? insight.created_at, insight.due_date);
          return d ? (
            <Chip color={d.color} title={`Due ${new Date(insight.due_date!).toLocaleDateString()}`}>{d.label}</Chip>
          ) : null;
        })()}
      </div>

      <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 0.6rem", lineHeight: 1.3 }}>
        {insight.title}
      </h1>

      {/* Money, with its basis attached or not at all. */}
      {insight.value?.amount != null && insight.value.basis && (
        <div style={{
          display: "flex", gap: 9, alignItems: "flex-start", marginBottom: "0.9rem",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "0.6rem 0.8rem",
        }}>
          <Target size={13} color={insight.value.source === "measured" ? "#22c55e" : "#94a3b8"} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: insight.value.source === "measured" ? "#22c55e" : "#cbd5e1" }}>
              ${Math.abs(insight.value.amount).toLocaleString()}/mo
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", marginLeft: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {insight.value.source}
              </span>
            </p>
            <p style={{ margin: "3px 0 0", fontSize: "10.5px", color: "#64748b", lineHeight: 1.5 }}>{insight.value.basis}</p>
          </div>
        </div>
      )}

      {insight.body && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "1rem",
        }}>
          {/* Rendered, not raw — see the same call in InsightsBoard's row detail. */}
          <div style={{ fontSize: "12.5px", color: "#cbd5e1", lineHeight: 1.65 }}>
            <MarkdownMessage content={insight.body} />
          </div>
        </div>
      )}

      {/* ── Who is on it, and where it has got to ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, padding: "0.65rem 0.85rem", marginBottom: "1rem",
      }}>
        {assignee ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "11.5px", color: "#cbd5e1" }}>
            {insight.assigned_agent_name || w?.agent_name ? <Bot size={12} color={ACCENT} /> : <User size={12} color={ACCENT} />}
            <strong style={{ color: "#e2e8f0" }}>{assignee}</strong>
          </span>
        ) : (
          <span style={{ fontSize: "11.5px", color: "#475569" }}>Nobody assigned yet</span>
        )}

        {w && (
          <>
            <span style={{ color: "#1e293b" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "11.5px", color: "#94a3b8" }}>
              {w.status === "done" ? <CheckCircle2 size={11} color="#22c55e" /> : <Clock size={11} />}
              {milestone
                ? `${milestone.label} (${w.current_milestone + 1}/${w.milestones.length})`
                : w.status}
            </span>
            <span style={{ color: "#1e293b" }}>·</span>
            {/*
              Runs left is the honest read on whether this will finish on its own.
              At max_runs the runner will not pick it up again and it goes to
              needs_human, which is invisible unless it is stated somewhere.
            */}
            <span style={{ fontSize: "11px", color: w.run_count >= w.max_runs ? "#fb923c" : "#475569" }}>
              run {w.run_count}/{w.max_runs}
              {w.run_count >= w.max_runs && " — out of runs, needs a person"}
            </span>
          </>
        )}
      </div>

      {/*
        What the DM actually asked for. `human_tasks.instructions` is written when
        an insight is assigned to a person and was sent only in the DM — somebody
        who scrolled past that message arrived here with no copy of the ask, on
        the page the ask told them to open.
      */}
      {insight.human_task?.instructions && insight.human_task.status !== "done" && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "0.8rem 0.9rem", marginBottom: "1rem",
        }}>
          <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 5 }}>
            <ClipboardList size={10} /> What you were asked to do
          </p>
          <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {insight.human_task.instructions}
          </p>
          {(insight.human_task.followup_count ?? 0) > 0 && (
            <p style={{ fontSize: "10.5px", color: "#fb923c", margin: "7px 0 0" }}>
              Reminded {insight.human_task.followup_count}× — closing this, or handing it
              back, is what stops them.
            </p>
          )}
        </div>
      )}

      <InsightActions
        insightId={insight.id}
        status={insight.status}
        assigneeLabel={assignee}
        sectionLabel={insight.section}
        dueDate={insight.due_date}
        onChanged={onChanged}
      />

      {/*
        Deliberately outside InsightActions, and it is not a fifth tab there.
        Those four discharge an ask that was made of you; this one says the
        opposite — that nobody yet knows enough to act, and the next move is to
        go and find out. Mixing it in would blur the test that component's
        docblock sets for what belongs on this page.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0.75rem 0 1rem" }}>
        <button onClick={researchSolution} disabled={researching}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 13px", minHeight: 34, borderRadius: 8,
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.33)",
            color: "#a78bfa", fontSize: "12px", fontWeight: 700,
            cursor: researching ? "not-allowed" : "pointer", opacity: researching ? 0.6 : 1,
          }}>
          {researching ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
          Research a solution
        </button>
        <span style={{ fontSize: "10.5px", color: "#64748b" }}>
          Opens the composer with a question written from this finding — nothing runs until you send it.
        </span>
      </div>

      {insight.human_task?.completion_notes && (
        <div style={{
          background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 12, padding: "0.8rem 0.9rem", marginBottom: "1rem",
        }}>
          <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>
            Closed out by {insight.human_task.assigned_username ?? insight.human_task.assigned_to}
          </p>
          <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {insight.human_task.completion_notes}
          </p>
        </div>
      )}

      <InsightThread insightId={insight.id} reloadToken={reloadToken} />
    </div>
  );
}
