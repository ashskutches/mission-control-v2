"use client";
/**
 * InsightThread — the conversation on one insight.
 *
 * ## Why this page exists at all
 *
 * An agent working an insight regularly needs something only a person has: a
 * cost nothing records, a supplier fact, a judgement that is not its to make.
 * It could always *ask* — `discord_dm` has been in every agent's core tier
 * forever — but there was nowhere for an answer to go. A reply in a DM matched
 * no agent (getAgentByChannel keys on a guild channel id), so it was handled by
 * the default bot and the agent that asked never heard it. Contact was
 * write-only, and an agent with no way to be answered re-asks on every run.
 *
 * The fix was a venue rather than a better guess. A message posted against an
 * insight is about that insight by construction — no rolling window, no
 * most-recent-unanswered heuristic that can staple one person's answer onto
 * another agent's question.
 *
 * ## Two rows, one story
 *
 * `insight_events` is what the system DID — runs, tool calls, blockages.
 * `insight_messages` is what people and agents SAID. Neither is a substitute for
 * the other, so the server merges them and this renders them at different
 * weights: speech is the content, events are the spine it hangs on. Read top to
 * bottom it says "agent ran → asked Ryan what a mat costs → Ryan said $14 landed
 * → recalculated → completed", which is the thing nobody could see before.
 *
 * ## The composer does not guess what you meant
 *
 * `kind` is picked, never inferred. A redirect — "you're working on the wrong
 * thing" — is a different speech act from a note, and a model reading an
 * unlabelled correction can take it as agreement. The agent decides how to react
 * to a redirect (deliberately — no machinery forces a course change), so the
 * label is the only thing making sure it knows one happened.
 */
import { MarkdownMessage } from "@/components/MarkdownMessage";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare, Send, Bot, User, CornerDownRight, AlertTriangle,
  Loader2, HelpCircle, Lightbulb, Flag, Activity, RefreshCw,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

/**
 * Posting a message is the one call here that must NOT use BOT_URL.
 *
 * Who is speaking is stamped server-side by the /api/bot proxy from the signed
 * session (IDENTITY_STAMPED in api/bot/[...path]/route.ts) — the browser never
 * sends an author, or anyone could post as anyone. NEXT_PUBLIC_BOT_URL points
 * straight at the bot today, so a post sent through it bypasses the proxy,
 * arrives with no author and is refused with "author_name is required".
 * Hard-coding the proxy path keeps attribution independent of that env var.
 */
const PROXY_URL = "/api/bot";
const ACCENT = "#e98d20";

/** How often to re-read. The work runner polls every 15 minutes, so this is
 *  about catching a teammate's reply, not an agent's. */
const POLL_MS = 20_000;

// ── Types ─────────────────────────────────────────────────────────────────────
type Kind = "question" | "answer" | "finding" | "progress" | "decision" | "note" | "redirect";

interface Message {
  _row: "message";
  id: string;
  author_type: "agent" | "human" | "system";
  author_id: string;
  author_name: string;
  kind: Kind;
  body: string;
  delivered_via: string | null;
  replies_to: string | null;
  created_at: string;
}
interface Event {
  _row: "event";
  id: string;
  event_type: string;
  title: string | null;
  detail: string | null;
  agent_name: string | null;
  human_actor: string | null;
  tool_name: string | null;
  run_number: number | null;
  created_at: string;
}
type Row = Message | Event;

interface Timeline {
  count: number;
  message_count: number;
  event_count: number;
  timeline: Row[];
}

/** What a person can post, and what each one means. Mirrors the server's
 *  ALLOWED list in routes/insights.ts — keep them in step. */
const HUMAN_KINDS: { id: Kind; label: string; hint: string; icon: React.ElementType; color: string }[] = [
  { id: "answer",   label: "Answer",   hint: "Answering a question the agent asked", icon: CornerDownRight, color: "#22c55e" },
  { id: "note",     label: "Note",     hint: "Context, an aside, anything else",     icon: MessageSquare,   color: "#94a3b8" },
  { id: "decision", label: "Decision", hint: "A call you are making, and why",       icon: Flag,            color: "#38bdf8" },
  { id: "redirect", label: "Redirect", hint: "It is working on the wrong thing",     icon: AlertTriangle,   color: "#f43f5e" },
];

const KIND_STYLE: Record<Kind, { label: string; color: string; icon: React.ElementType }> = {
  question: { label: "question", color: ACCENT,    icon: HelpCircle },
  answer:   { label: "answer",   color: "#22c55e", icon: CornerDownRight },
  finding:  { label: "finding",  color: "#a78bfa", icon: Lightbulb },
  progress: { label: "progress", color: "#38bdf8", icon: Activity },
  decision: { label: "decision", color: "#38bdf8", icon: Flag },
  note:     { label: "note",     color: "#94a3b8", icon: MessageSquare },
  redirect: { label: "redirect", color: "#f43f5e", icon: AlertTriangle },
};

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── One spoken message ────────────────────────────────────────────────────────
function MessageRow({ m, answered }: { m: Message; answered: boolean }) {
  const style = KIND_STYLE[m.kind] ?? KIND_STYLE.note;
  const Icon = style.icon;
  const isAgent = m.author_type === "agent";

  // An unanswered question is the only thing on this page that is asking
  // something of the reader, so it is the only thing drawn as a call to action.
  const pending = m.kind === "question" && !answered;

  return (
    <div style={{
      display: "flex", gap: 10, padding: "0.8rem 0.9rem",
      background: pending ? `${ACCENT}0e` : "rgba(255,255,255,0.02)",
      border: `1px solid ${pending ? `${ACCENT}44` : "rgba(255,255,255,0.05)"}`,
      borderRadius: 12,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${style.color}18`, border: `1px solid ${style.color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isAgent ? <Bot size={13} color={style.color} /> : <User size={13} color={style.color} />}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0" }}>{m.author_name}</span>
          <span style={{
            fontSize: "9px", fontWeight: 700, color: style.color, background: `${style.color}15`,
            padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <Icon size={9} /> {style.label}
          </span>
          {m.delivered_via === "discord_dm" && (
            <span title="Sent or answered over Discord DM"
              style={{ fontSize: "9px", color: "#64748b", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>
              discord
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#475569", marginLeft: "auto" }}>{when(m.created_at)}</span>
        </div>

        {/*
          Agents write markdown; people type sentences. Rendering an agent's
          finding shows the table it built instead of the pipes it built it from,
          and leaving a human's reply as plain text means an asterisk somebody
          typed stays an asterisk rather than silently italicising half a
          sentence they wrote.
        */}
        {m.author_type === "human" ? (
          <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {m.body}
          </p>
        ) : (
          <div style={{ fontSize: "12.5px", color: "#cbd5e1", lineHeight: 1.55 }}>
            <MarkdownMessage content={m.body} />
          </div>
        )}

        {pending && (
          <p style={{ fontSize: "10.5px", color: ACCENT, margin: "7px 0 0", fontWeight: 600 }}>
            Waiting on an answer — reply below, or in the Discord DM. Either lands here.
          </p>
        )}
      </div>
    </div>
  );
}

// ── One machine event ─────────────────────────────────────────────────────────
// Drawn deliberately quiet. These are the spine; the speech is the content, and
// a run log rendered at the same weight buries the two sentences that matter.
function EventRow({ e }: { e: Event }) {
  const isBad = e.event_type === "work_blocked" || e.event_type.includes("error") || e.event_type.includes("reject");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.2rem 0.9rem 0.2rem 0.5rem" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: isBad ? "#f43f5e" : "#334155", flexShrink: 0, marginLeft: 12 }} />
      <span style={{ fontSize: "10.5px", color: isBad ? "#fb7185" : "#475569", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {e.title ?? e.event_type}
        {e.tool_name && <span style={{ color: "#334155" }}> · {e.tool_name}</span>}
        {e.run_number != null && <span style={{ color: "#334155" }}> · run {e.run_number}</span>}
      </span>
      <span style={{ fontSize: "9.5px", color: "#1e293b", marginLeft: "auto", flexShrink: 0 }}>{when(e.created_at)}</span>
    </div>
  );
}

// ── The thread ────────────────────────────────────────────────────────────────
export default function InsightThread({ insightId }: { insightId: string }) {
  const [data, setData] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(false);

  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("answer");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/insights/${insightId}/messages`);
      if (!res.ok) throw new Error(`Could not load the conversation (${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [insightId]);

  useEffect(() => { load(); }, [load]);

  // Poll quietly. A teammate answering in Discord expects to see it appear here.
  useEffect(() => {
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const messages = (data?.timeline ?? []).filter((r): r is Message => r._row === "message");

  // Which questions have been answered. Mirrors openQuestions() on the server:
  // a threaded answer settles it, and so does ANY later human message — someone
  // who replied has replied, even if their answer did not thread properly.
  const answeredIds = new Set(messages.filter(m => m.kind === "answer" && m.replies_to).map(m => m.replies_to!));
  const lastHumanAt = messages.filter(m => m.author_type === "human").at(-1)?.created_at ?? "";
  const isAnswered = (m: Message) =>
    answeredIds.has(m.id) || (!!lastHumanAt && lastHumanAt > m.created_at);

  const openQuestion = messages.filter(m => m.kind === "question" && !isAnswered(m)).at(-1) ?? null;

  // Default the composer to Answer when something is actually being asked, and
  // to Note when nothing is. Guessing wrong here is cheap; the person can change
  // it, and the label is theirs either way.
  useEffect(() => { setKind(openQuestion ? "answer" : "note"); }, [openQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [data?.count, loading]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      // author_id / author_name are stamped by the /api/bot proxy from the
      // signed session — deliberately not sent from here, or anyone could post
      // as anyone. See IDENTITY_STAMPED in api/bot/[...path]/route.ts.
      const res = await fetch(`${PROXY_URL}/admin/insights/${insightId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          kind,
          replies_to: kind === "answer" ? openQuestion?.id ?? null : null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? detail.error ?? `Could not post (${res.status})`);
      }
      setBody("");
      await load(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const rows = (data?.timeline ?? []).filter(r => showEvents || r._row === "message");
  const activeKind = HUMAN_KINDS.find(k => k.id === kind) ?? HUMAN_KINDS[1]!;

  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0.75rem 0.95rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <MessageSquare size={14} color={ACCENT} />
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#e2e8f0" }}>Conversation</span>
        <span style={{ fontSize: "10.5px", color: "#475569" }}>
          {data ? `${data.message_count} message${data.message_count === 1 ? "" : "s"}` : ""}
        </span>

        <button
          onClick={() => setShowEvents(v => !v)}
          title="Machine history: runs, tool calls, blockages. Shown quietly — the speech is the content."
          style={{
            marginLeft: "auto", background: showEvents ? "rgba(255,255,255,0.06)" : "transparent",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "3px 9px",
            fontSize: "10px", color: showEvents ? "#94a3b8" : "#475569", cursor: "pointer",
          }}>
          {showEvents ? "Hide" : "Show"} activity ({data?.event_count ?? 0})
        </button>
        <button onClick={() => load()} title="Refresh"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", display: "flex" }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(244,63,94,0.06)", borderBottom: "1px solid rgba(244,63,94,0.2)", padding: "0.6rem 0.95rem", display: "flex", alignItems: "center", gap: 7 }}>
          <AlertTriangle size={12} color="#f43f5e" />
          <span style={{ fontSize: "11.5px", color: "#e2e8f0" }}>{error}</span>
        </div>
      )}

      {/* Timeline */}
      <div style={{ maxHeight: 560, overflowY: "auto", padding: "0.85rem", display: "flex", flexDirection: "column", gap: 7 }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "2.5rem", color: "#475569" }}>
            <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: "12px" }}>Loading…</span>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
            <p style={{ fontSize: "12.5px", color: "#475569", margin: 0 }}>Nothing said yet.</p>
            <p style={{ fontSize: "11px", color: "#334155", margin: "5px 0 0", lineHeight: 1.6 }}>
              When an agent works this insight it posts what it finds here, and asks here
              when it needs something only a person has. You can start the conversation too.
            </p>
          </div>
        )}

        {!loading && rows.map(r =>
          r._row === "message"
            ? <MessageRow key={r.id} m={r} answered={isAnswered(r)} />
            : <EventRow key={r.id} e={r} />
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.75rem 0.85rem" }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "wrap" }}>
          {HUMAN_KINDS.map(k => {
            const on = k.id === kind;
            const Icon = k.icon;
            return (
              <button key={k.id} onClick={() => setKind(k.id)} title={k.hint}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: on ? `${k.color}18` : "transparent",
                  border: `1px solid ${on ? `${k.color}55` : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 7, padding: "3px 9px", cursor: "pointer",
                  fontSize: "10.5px", fontWeight: 700, color: on ? k.color : "#64748b",
                }}>
                <Icon size={10} /> {k.label}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: "10px", color: "#475569", margin: "0 0 6px" }}>{activeKind.hint}</p>

        <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder={openQuestion
              ? `Answer: ${openQuestion.body.slice(0, 70)}${openQuestion.body.length > 70 ? "…" : ""}`
              : "Say something on this insight. The agent reads it on its next run."}
            rows={2}
            style={{
              flex: 1, resize: "vertical", minHeight: 44,
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 9, padding: "0.5rem 0.65rem", color: "#e2e8f0",
              fontSize: "12.5px", fontFamily: "inherit", lineHeight: 1.5, outline: "none",
            }}
          />
          <button onClick={send} disabled={!body.trim() || sending}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: body.trim() ? `${activeKind.color}1c` : "transparent",
              border: `1px solid ${body.trim() ? `${activeKind.color}55` : "rgba(255,255,255,0.07)"}`,
              borderRadius: 9, padding: "0.55rem 0.9rem",
              color: body.trim() ? activeKind.color : "#334155",
              fontSize: "11.5px", fontWeight: 700,
              cursor: body.trim() && !sending ? "pointer" : "default",
            }}>
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {sending ? "Posting" : "Post"}
          </button>
        </div>

        <p style={{ fontSize: "9.5px", color: "#334155", margin: "6px 0 0" }}>
          ⌘/Ctrl + Enter to post. The agent sees this at the start of its next run — it does
          not read the page live.
        </p>
      </div>
    </div>
  );
}
