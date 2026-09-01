"use client";
/**
 * InsightActions — what the person a DM sent here can actually do about it.
 *
 * ## Why this is on the detail page at all
 *
 * `InsightDetail` is deliberately thin, because the previous detail page reached
 * 1,016 lines by mirroring the board and was deleted for it. This does not undo
 * that. It is not the board's action set moved over: it is the four things
 * needed to *discharge an ask that was made of you*, because three separate DMs
 * send a person to `/pipeline/<id>` and two of them say the words "mark
 * complete" —
 *
 *   routes/pipeline.ts   "→ View full details & mark complete: …/pipeline/<id>"
 *   proactive/scheduler  "→ Review & mark complete: …/pipeline/<id>"   (repeating)
 *
 * — and there was nothing on the page that could. The follow-up sweep re-sends
 * that reminder until `human_tasks.status` leaves pending/in_progress, which the
 * recipient had no way to change from the address they were given. Ignoring the
 * DM was the only exit, and the sweep punishes exactly that.
 *
 * Bulk triage, sorting, lanes, filtering, running an analysis — all still only
 * on the board. If something here is not part of answering "so what happened to
 * this thing you asked me about", it does not belong.
 *
 * ## Everything goes through the proxy, never BOT_URL
 *
 * `NEXT_PUBLIC_BOT_URL` reaches the bot directly, and these calls all attach a
 * person's name to a decision. Who acted is stamped server-side from the signed
 * session (IDENTITY_STAMPED in api/bot/[...path]/route.ts); a browser-supplied
 * name is not evidence. The one exception is the due date, which records no
 * actor — see the note on `snooze()`.
 *
 * ## Closing goes through /feedback, and that choice is load-bearing
 *
 * Three routes can resolve an insight: `PATCH /admin/insights/:id`,
 * `POST /admin/insights/:id/feedback`, and `POST /admin/pipeline/:id/complete`.
 * Only /feedback writes an `insight_feedback` row carrying `section_id`, and
 * `get_section_feedback` — the tool an agent calls before analysing a section —
 * filters on `section_id`. An insight closed by either other path teaches the
 * agents nothing about what humans accept and reject. (The pipeline route's
 * insert omits the NOT NULL `agent_id`/`section_id` entirely, so it does not
 * even land.) The note is required for the same reason: a resolved row with no
 * account of what was done is a row nobody can explain a month later.
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2, Ban, CalendarClock, CornerUpLeft, Loader2, X, Bot, User, Inbox,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
const PROXY_URL = "/api/bot";
const ACCENT = "#e98d20";

type Panel = "done" | "handback" | "snooze" | "dismiss" | null;
type HandbackTarget = { kind: "nobody" } | { kind: "human"; username: string } | { kind: "agent"; id: string; name: string };

interface Agent { id: string; name: string }
interface TeamMember { discord_id: string; username: string; display_name?: string | null }

export interface InsightActionsProps {
  insightId: string;
  /** Current status. Terminal rows render nothing — there is nothing left to discharge. */
  status: string;
  /** Who holds it now, for the hand-back copy. Null when nobody does. */
  assigneeLabel: string | null;
  /** Existing due date, ISO, so the snooze field opens on what is already set. */
  dueDate: string | null;
  /** Re-read the insight and the thread after anything lands. */
  onChanged: () => void;
}

/** `2026-08-31T…` → `2026-08-31`, and null → "" for an empty date input. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

/** End of the given day, local — a deadline is a day, not a moment at midnight. */
function endOfDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

export default function InsightActions({
  insightId, status, assigneeLabel, dueDate, onChanged,
}: InsightActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<HandbackTarget>({ kind: "nobody" });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [date, setDate] = useState(toDateInput(dueDate));

  useEffect(() => { setDate(toDateInput(dueDate)); }, [dueDate]);

  // Only the hand-back panel needs these, and most visitors never open it.
  useEffect(() => {
    if (panel !== "handback" || agents.length || team.length) return;
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
      if (tRes?.ok) setTeam((await tRes.json()).members ?? []);
    })();
  }, [panel, agents.length, team.length]);

  const open = (p: Panel) => { setPanel(p === panel ? null : p); setNote(""); setError(null); };

  /** POST helper that surfaces the server's own message — these routes explain themselves. */
  const post = useCallback(async (url: string, body: unknown, method = "POST") => {
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? json.detail ?? `HTTP ${res.status}`);
    return json;
  }, []);

  /**
   * Speech first, decision second — the same order as ask_human.
   *
   * A `completion_notes` field on a closed task is not injected into the agent's
   * next run; the thread is. Posting the account of what happened as a message
   * is what makes "done, and here is what I did" reach the agent rather than
   * only the database. Post before the close so a failure at the second step
   * cannot lose the words.
   */
  const say = (kind: "decision" | "redirect" | "note", body: string) =>
    post(`${PROXY_URL}/admin/insights/${insightId}/messages`, { kind, body });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); setPanel(null); setNote(""); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const markDone = () => run(async () => {
    await say("decision", note.trim());
    await post(`${PROXY_URL}/admin/insights/${insightId}/feedback`, { action: "completed", note: note.trim() });
  });

  const dismiss = () => run(async () => {
    await say("decision", note.trim());
    await post(`${PROXY_URL}/admin/insights/${insightId}/feedback`, { action: "dismissed", note: note.trim() });
  });

  /**
   * Hand it back. A `redirect`, not a note — the person is saying this is not
   * theirs, which is a different speech act from a remark, and the agent reads
   * the label rather than inferring one from the prose.
   *
   * An agent target goes through /assign first because that is the only route
   * that creates the `agent_work` row; /reassign alone sets a name on the insight
   * and dispatches nothing, which looks assigned and never runs. Both paths then
   * hit /reassign, which is where the outgoing human task is cancelled so its
   * reminder DMs stop.
   */
  const handBack = () => run(async () => {
    await say("redirect", note.trim());
    if (target.kind === "agent") {
      await post(`${PROXY_URL}/admin/insights/${insightId}/assign`, {
        force_agent_id: target.id, force_agent_name: target.name,
      });
    }
    await post(`${PROXY_URL}/admin/pipeline/${insightId}/reassign`, {
      item_type: "insight",
      agent_id: target.kind === "agent" ? target.id : null,
      agent_name: target.kind === "agent" ? target.name : null,
      human_username: target.kind === "human" ? target.username : null,
      notify: target.kind === "human",
    });
  });

  /**
   * Move the deadline. Sent to the bot directly rather than the proxy: PATCH
   * carries no identity stamp, and a due date records no actor — the server
   * re-stamps `due_set_at` so the allotted-time window restarts now, which is
   * the honest reading of somebody saying "Friday" today.
   *
   * A note is optional here and only posted if written. The date is already the
   * statement; requiring a sentence to move one would just teach people to type
   * a full stop.
   */
  const snooze = () => run(async () => {
    const iso = date ? new Date(`${date}T23:59:59`).toISOString() : null;
    if (note.trim()) await say("note", note.trim());
    await post(`${BOT_URL}/admin/insights/${insightId}`, { due_date: iso }, "PATCH");
  });

  // Nothing to discharge on a closed insight. The board is where a decision gets
  // revisited; a Reopen button here would be the first step back to a page that
  // does everything.
  if (status === "resolved" || status === "dismissed") return null;

  const tab = (key: Panel, label: string, Icon: React.ElementType, color: string) => (
    <button
      key={label}
      onClick={() => open(key)}
      disabled={busy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 14px", minHeight: 38, borderRadius: 8,
        border: `1px solid ${color}${panel === key ? "88" : "33"}`,
        background: panel === key ? `${color}22` : `${color}12`,
        color, fontSize: "12px", fontWeight: 700,
        cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
      }}>
      <Icon size={12} /> {label}
    </button>
  );

  const field = (placeholder: string, rows = 3) => (
    <textarea
      value={note}
      onChange={e => setNote(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      autoFocus
      style={{
        width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "9px 11px", color: "#e2e8f0", fontSize: "13px",
        lineHeight: 1.55, fontFamily: "inherit", outline: "none", resize: "vertical",
      }} />
  );

  const confirm = (label: string, onClick: () => void, color: string, disabled = false) => (
    <button onClick={onClick} disabled={busy || disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 16px", minHeight: 38, borderRadius: 8, border: "none",
        background: busy || disabled ? "rgba(255,255,255,0.06)" : color,
        color: busy || disabled ? "#475569" : "#0b1220",
        fontSize: "12.5px", fontWeight: 800,
        cursor: busy || disabled ? "not-allowed" : "pointer",
      }}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : null} {label}
    </button>
  );

  const pick = (selected: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} disabled={busy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 11px", minHeight: 34, borderRadius: 7,
        border: `1px solid ${selected ? `${ACCENT}88` : "rgba(255,255,255,0.09)"}`,
        background: selected ? `${ACCENT}1a` : "rgba(255,255,255,0.02)",
        color: selected ? ACCENT : "#94a3b8", fontSize: "11.5px", fontWeight: 700,
        cursor: "pointer",
      }}>
      {children}
    </button>
  );

  return (
    <div style={{
      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "0.8rem 0.9rem", marginBottom: "1rem",
    }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tab("done", "Mark done", CheckCircle2, "#22c55e")}
        {tab("handback", "Hand back", CornerUpLeft, "#38bdf8")}
        {tab("snooze", dueDate ? "Change the date" : "Set a date", CalendarClock, "#94a3b8")}
        {tab("dismiss", "Dismiss", Ban, "#64748b")}
        {panel && (
          <button onClick={() => open(null)} disabled={busy}
            style={{
              marginLeft: "auto", background: "transparent", border: "none",
              color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              fontSize: "11px", fontWeight: 700,
            }}>
            <X size={11} /> Cancel
          </button>
        )}
      </div>

      {panel && (
        <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {panel === "done" && (
            <>
              <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 7px", lineHeight: 1.55 }}>
                What did you do? This goes onto the conversation, so the agent working
                this reads it on its next run — and into the section&apos;s feedback
                history, which is what stops it filing the same thing again.
              </p>
              {field("e.g. Called the supplier — mats are $14 landed, not $22. Updated the sheet.")}
              <div style={{ marginTop: 9 }}>
                {confirm("Mark it done", markDone, "#22c55e", !note.trim())}
              </div>
            </>
          )}

          {panel === "dismiss" && (
            <>
              <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 7px", lineHeight: 1.55 }}>
                Why is this not worth doing? The reason is stored on the insight, and
                the dedup gate reads it — an agent that files this again will be told
                somebody already decided.
              </p>
              {field("e.g. We tried this in March, it moved nothing.")}
              <div style={{ marginTop: 9 }}>
                {confirm("Dismiss it", dismiss, "#94a3b8", !note.trim())}
              </div>
            </>
          )}

          {panel === "handback" && (
            <>
              <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 7px", lineHeight: 1.55 }}>
                {assigneeLabel
                  ? <>This is on <strong style={{ color: "#94a3b8" }}>{assigneeLabel}</strong>. Where should it go?</>
                  : <>Nobody holds this. Where should it go?</>}
                {" "}The reminders stop either way.
              </p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                {pick(target.kind === "nobody", () => setTarget({ kind: "nobody" }),
                  <><Inbox size={11} /> Back to the board</>)}
                {team.map(m => pick(
                  target.kind === "human" && target.username === m.username,
                  () => setTarget({ kind: "human", username: m.username }),
                  <><User size={11} /> {m.display_name ?? m.username}</>,
                ))}
                {agents.map(a => pick(
                  target.kind === "agent" && target.id === a.id,
                  () => setTarget({ kind: "agent", id: a.id, name: a.name }),
                  <><Bot size={11} /> {a.name}</>,
                ))}
              </div>
              {field("Why is this not yours? e.g. Ryan owns supplier pricing, not me.", 2)}
              <div style={{ marginTop: 9 }}>
                {confirm(
                  target.kind === "nobody" ? "Put it back" : "Hand it over",
                  handBack, "#38bdf8", !note.trim(),
                )}
              </div>
            </>
          )}

          {panel === "snooze" && (
            <>
              <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 7px", lineHeight: 1.55 }}>
                When will this be done? The clock on &quot;time allotted&quot; restarts
                from now, so the board colours it against the date you are committing to
                today — not one somebody set months ago.
              </p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 9 }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={busy}
                  style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7, padding: "7px 10px", minHeight: 34, color: "#cbd5e1",
                    fontSize: "12px", outline: "none", colorScheme: "dark", fontFamily: "inherit",
                  }} />
                {pick(false, () => setDate(toDateInput(endOfDay(1))), <>Tomorrow</>)}
                {pick(false, () => setDate(toDateInput(endOfDay(7))), <>Next week</>)}
                {dueDate && pick(false, () => setDate(""), <>Clear it</>)}
              </div>
              {field("Anything the agent should know about the timing? Optional.", 2)}
              <div style={{ marginTop: 9 }}>
                {confirm(date ? "Set the date" : "Clear the date", snooze, "#cbd5e1")}
              </div>
            </>
          )}

          {error && (
            <p style={{ color: "#f43f5e", fontSize: "11.5px", margin: "9px 0 0", lineHeight: 1.5 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
