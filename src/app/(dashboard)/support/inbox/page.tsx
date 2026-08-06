"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, Inbox as InboxIcon, AlertTriangle, Flame, ChevronRight, Bot, UserCheck, RefreshCw,
  Wrench, MailWarning,
} from "lucide-react";
import {
  Panel, Pill, Confidence, Empty, ago, Btn, Loading, ErrorBox, NotConnected, OpsMark,
  STATUS_COLOR, STATUS_LABEL, SUPPORT_ACCENT,
} from "../ui";
import { getTickets, getSummary, runIngest, OUTCOME_LABELS, OUTCOME_COLOR } from "../api";

/**
 * `followup` is a view, not a status.
 *
 * It is every ticket with outstanding operational work, whatever the
 * conversation is doing — and it cannot be expressed as a status filter, which
 * is precisely why work done outside the platform used to be invisible: a
 * ticket that had been answered but not refunded sat in `sent` looking finished.
 */
const FILTERS = [
  { key: "awaiting_approval", label: "Awaiting approval" },
  { key: "followup",          label: "Follow-up work",  color: "#f5a840" },
  { key: "failed",            label: "Not delivered",   color: "#f43f5e" },
  { key: "needs_human_only",  label: "Human only" },
  { key: "escalated",         label: "Escalated" },
  { key: "sent",              label: "Sent" },
  { key: "resolved",          label: "Resolved" },
  { key: "all",               label: "All" },
];

const SENTIMENT_COLOR: Record<string, string> = {
  angry: "#f43f5e", frustrated: "#f5a840", neutral: "#6b7280", positive: "#22c55e",
};

export default function SupportInbox() {
  const [filter, setFilter] = useState("awaiting_approval");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [res, sum] = await Promise.all([
        getTickets({ status: filter, q: q.trim() || undefined, limit: 200 }),
        getSummary(),
      ]);
      setRows(res.tickets); setTotal(res.total); setSummary(sum);
    } catch (e: any) { setErr(e.message); setRows([]); }
  }, [filter, q]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const poll = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await runIngest();
      setNote(r.skipped
        ? `Nothing fetched — ${r.skipped}.`
        : `Fetched ${r.fetched}: ${r.created} new, ${r.reopened} reopened, ${r.duplicates} already seen, ${r.drafted} drafted.` +
          (r.errors?.length ? ` ${r.errors.length} error(s).` : ""));
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      {summary?.mail?.blockers?.length > 0 && <NotConnected blockers={summary.mail.blockers} />}
      {err && <ErrorBox error={err} onRetry={load} />}

      {/* Two piles of work nobody was looking at, because nothing counted them. */}
      {(summary?.openFollowups > 0 || summary?.undeliveredReplies > 0) && (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {summary.openFollowups > 0 && (
            <div onClick={() => setFilter("followup")}
                 style={{ ...bannerStyle("#f5a840"), cursor: "pointer" }}>
              <Wrench size={13} color="#f5a840" />
              <span>
                <strong>{summary.openFollowups}</strong> open follow-up
                {summary.openFollowups === 1 ? "" : "s"}
                {summary.overdueFollowups > 0 && (
                  <span style={{ color: "#f43f5e" }}> · {summary.overdueFollowups} overdue</span>
                )}
              </span>
            </div>
          )}
          {summary.undeliveredReplies > 0 && (
            <div onClick={() => setFilter("failed")}
                 style={{ ...bannerStyle("#f43f5e"), cursor: "pointer" }}>
              <MailWarning size={13} color="#f43f5e" />
              <span>
                <strong>{summary.undeliveredReplies}</strong> repl
                {summary.undeliveredReplies === 1 ? "y was" : "ies were"} written but never delivered
              </span>
            </div>
          )}
        </div>
      )}
      {note && (
        <div style={{ background: "rgba(0,201,215,0.08)", border: "1px solid rgba(0,201,215,0.28)",
                      borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem",
                      fontSize: 12, color: SUPPORT_ACCENT, fontWeight: 600 }}>{note}</div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap",
                    alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <Pill key={f.key}
                  color={f.color ?? (f.key === "all" ? SUPPORT_ACCENT : (STATUS_COLOR[f.key] ?? SUPPORT_ACCENT))}
                  active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key === "followup" && summary?.openFollowups > 0 && ` (${summary.openFollowups})`}
            </Pill>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%",
                                     transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search subject, customer…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
              padding: "0.42rem 0.7rem 0.42rem 1.9rem", fontSize: 12,
              color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <Btn size="sm" variant="ghost" onClick={poll} disabled={busy}>
          <RefreshCw size={12} /> {busy ? "Checking…" : "Check mail"}
        </Btn>
      </div>

      <Panel pad={false}>
        {/* Column header — the price of one-line rows is that they need labels. */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.4rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 9, fontWeight: 800, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "var(--text-dim)",
        }}>
          <span style={{ width: 3, flexShrink: 0 }} />
          <span style={{ width: 40, flexShrink: 0 }}>Ref</span>
          <span style={{ flex: 1, minWidth: 0 }}>Subject</span>
          <span style={{ width: 100, flexShrink: 0 }}>Customer</span>
          <span style={{ width: 100, flexShrink: 0 }}>Category</span>
          <span style={{ width: 74, flexShrink: 0, textAlign: "right" }}>Conf.</span>
          <span style={{ width: 124, flexShrink: 0, textAlign: "right" }}>Status</span>
          {/* Outcome and ops are separate columns on purpose — "we replied" and
              "we finished" are different facts and the status pill only holds one. */}
          <span style={{ width: 108, flexShrink: 0, textAlign: "right" }}>Outcome</span>
          <span style={{ width: 88, flexShrink: 0, textAlign: "right" }}>Ops</span>
          <span style={{ width: 52, flexShrink: 0, textAlign: "right" }}>Waiting</span>
          <span style={{ width: 14, flexShrink: 0 }} />
        </div>

        {rows === null ? <Loading label="Loading tickets" />
         : rows.length === 0 ? (
          <Empty icon={InboxIcon} title="Nothing here"
                 body={q ? "No tickets match that search."
                   : summary?.mail?.configured
                     ? "No tickets in this view. Hit “Check mail” to poll the mailbox."
                     : "No tickets yet — and no mailbox is connected, so none will arrive."} />
        ) : rows.map((t, i) => {
          const overdue = t.status === "awaiting_approval" && t.awaitingMinutes > 60;
          return (
            <Link key={t.id} href={`/support/inbox/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              {/* One line per ticket. At 20–60/day the whole queue fits on one
                  screen, which it doesn't if every row is a two-line card.
                  Everything else lives on the drill-down. */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.45rem 1.1rem", height: 38,
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  transition: "background .15s", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 3, height: 16, borderRadius: 2, flexShrink: 0,
                  background: SENTIMENT_COLOR[t.sentiment] ?? "transparent",
                  opacity: t.sentiment === "neutral" ? 0.18 : 0.9,
                }} />

                <span style={{ width: 40, flexShrink: 0, fontSize: 10.5, fontWeight: 800,
                               color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                  #{t.ref}
                </span>

                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0,
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                  {(t.priority === "high" || t.priority === "urgent") && (
                    <Flame size={10} color="#f43f5e" style={{ marginLeft: 6, verticalAlign: -1 }} />
                  )}
                </span>

                <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: "var(--text-muted)",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.customer_name || t.customer_email || "—"}
                </span>

                <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: "var(--text-dim)",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.category?.label ?? "—"}
                </span>

                <span style={{ width: 74, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  {t.draftConfidence != null
                    ? <Confidence value={t.draftConfidence} />
                    : <Pill color="#a78bfa"><UserCheck size={9} /> none</Pill>}
                </span>

                <span style={{ width: 124, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  <Pill color={STATUS_COLOR[t.status] ?? "#6b7280"} solid>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Pill>
                </span>

                <span style={{ width: 108, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  {t.outcome
                    ? <Pill color={OUTCOME_COLOR[t.outcome] ?? "#6b7280"}>
                        {OUTCOME_LABELS[t.outcome] ?? t.outcome}
                      </Pill>
                    // Answered but never closed out: the gap this feature exists
                    // to close, so it is called out rather than left blank.
                    : ["sent", "awaiting_customer", "failed"].includes(t.status)
                      ? <Pill color="#f5a840" title="Replied, but nothing records what we decided">
                          not closed
                        </Pill>
                      : <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>}
                </span>

                <span style={{ width: 88, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                  <OpsMark state={t.ops_state} open={t.openFollowups} />
                </span>

                <span style={{ width: 52, flexShrink: 0, textAlign: "right", fontSize: 11,
                               fontWeight: 700, color: overdue ? "#f43f5e" : "var(--text-muted)",
                               display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                  {overdue && <AlertTriangle size={10} />}
                  {t.status === "awaiting_approval" ? ago(t.awaitingMinutes) : "—"}
                </span>

                <ChevronRight size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
              </div>
            </Link>
          );
        })}
      </Panel>

      <div style={{ marginTop: "0.8rem", display: "flex", alignItems: "center", gap: 8,
                    fontSize: 11, color: "var(--text-muted)" }}>
        <Bot size={12} />
        {rows?.length ?? 0} of {total} shown.{" "}
        {filter === "followup"
          ? "Follow-up work is sorted by due date, soonest first."
          : "Awaiting-approval is sorted oldest-first so nothing starves."}
      </div>
    </>
  );
}

const bannerStyle = (color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  background: `${color}12`, border: `1px solid ${color}44`,
  borderRadius: 10, padding: "0.5rem 0.85rem",
  fontSize: 11.5, color: "var(--text-secondary)",
});
