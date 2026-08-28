"use client";
/**
 * InsightDetail — the header above an insight's conversation.
 *
 * Deliberately thin. Everything that acts on an insight — assigning it, changing
 * its status, reading the board around it — already works on `/pipeline`, and
 * duplicating it here is how the last detail page reached a thousand lines and
 * then got deleted. This answers three questions and then gets out of the way:
 * what is this, who is on it, and where has the work got to. The conversation
 * below is the part that is new.
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
  Clock, Target, Building2,
} from "lucide-react";
import InsightThread from "@/components/InsightThread";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
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
}
/** Mirrors buildValue() in gravity-claw's utils/insight-board.ts. */
interface Value { amount: number | null; source: "measured" | "claimed" | null; basis: string | null }
interface Insight {
  id: string; title: string; body: string | null; section: string; lane: string | null;
  type: string; status: string; priority: number | null;
  risk_tier: string | null; risk_score: number | null;
  agent_name: string | null; assigned_agent_name: string | null;
  occurrences: number | null; created_at: string;
  /** Raw column. The board gets a computed `due` object; this page has the row itself. */
  due_date: string | null;
  value: Value; work: Work | null; human_task: HumanTask | null;
}

/**
 * The same two thresholds the board colours by — red past due, orange through
 * the last fifth of the allotted time. Duplicated here rather than plumbed
 * through because this page reads the raw row (GET /admin/insights/:id) while
 * the board reads the computed one; the rule itself lives in gravity-claw's
 * utils/insight-due.ts and that is the copy to change first.
 */
function dueChip(createdAt: string, dueDate: string | null): { label: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(due)) return null;
  const created = new Date(createdAt).getTime();
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
  const assignee = insight.assigned_agent_name ?? w?.agent_name ?? insight.human_task?.assigned_username ?? null;

  return (
    <div style={{ padding: "1.4rem 1.2rem 3rem", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/pipeline" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "12px", textDecoration: "none", marginBottom: "0.9rem" }}>
        <ArrowLeft size={13} /> All insights
      </Link>

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
          const d = dueChip(insight.created_at, insight.due_date);
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

      <InsightThread insightId={insight.id} />
    </div>
  );
}
