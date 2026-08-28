"use client";

/**
 * /roundtable — the cross-department strategy experiment.
 *
 * Pick agents, ask one question, watch them answer it blind, argue, and get
 * reported on by a facilitator who took no part.
 *
 * ## Why this page exists separately from everything else
 *
 * It is an observation instrument, not a feature. Its job is to answer whether
 * these agents produce anything worth reading when they can see each other —
 * and the honest answer might be no. That is why it writes nothing: no insight,
 * no blockage, no task. A transcript and a report, and that is all.
 *
 * ⚠️ **This is not a space.** `app/lib/spaces.tsx` and `gravity-claw/src/utils/
 * spaces.ts` are the hard-coded authority on the areas of the business, and they
 * are hard-coded because runtime-creatable areas once put 19 of them across 8
 * squads into production with no page behind them. A lab surface is not an area
 * of the business. It gets a page and stays out of SPACES.
 *
 * The transcript is polled rather than streamed. One person watches one run;
 * a 2s poll against a Postgres read is the right amount of machinery, and an SSE
 * channel through Railway's proxy is not.
 */

import React from "react";
import {
  Users, Play, Loader, Square, AlertTriangle, Wrench, Eye, EyeOff,
  ChevronDown, ChevronRight, Trash2, DollarSign,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

const MAX_PARTICIPANTS = 6;

interface AgentDef {
  id: string; name: string; emoji?: string;
  specialization?: string; section?: string; category?: string;
}

interface Msg {
  id: string; seq: number;
  phase: "opening" | "floor" | "synthesis" | "error";
  round: number;
  agent_id: string; agent_name: string; agent_emoji?: string | null;
  content: string; tools_used: string[]; provider?: string | null;
  created_at: string;
}

interface Session {
  id: string; question: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  agent_ids: string[]; floor_rounds: number; allow_money: boolean;
  phase?: string | null; report?: string | null; error?: string | null;
  created_at: string; started_at?: string | null; finished_at?: string | null;
}

interface MeasuredFact {
  key: string; label: string; value: number | null;
  unit: string; basis: string; available: boolean;
}

const C = {
  text: "#f0ede8", dim: "#b8b4ae", muted: "rgba(184,180,174,0.65)",
  border: "rgba(233,141,32,0.12)", card: "rgba(30,30,32,0.8)",
  orange: "#e98d20", blue: "#4a9eff", purple: "#a78bfa",
  green: "#22c55e", rose: "#f43f5e", cyan: "#00c9d7",
};

const PHASE_STYLE: Record<Msg["phase"], { label: string; color: string }> = {
  opening:   { label: "Opening — written blind", color: C.blue },
  floor:     { label: "Open floor",              color: C.purple },
  synthesis: { label: "Facilitator's report",    color: C.orange },
  error:     { label: "Failure",                 color: C.rose },
};

const isLive = (s: Session | null) => !!s && (s.status === "running" || s.status === "pending");

export default function RoundtablePage() {
  const [agents, setAgents] = React.useState<AgentDef[]>([]);
  const [facts, setFacts] = React.useState<MeasuredFact[] | null>(null);
  const [showFacts, setShowFacts] = React.useState(false);

  const [question, setQuestion] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [rounds, setRounds] = React.useState(1);
  const [allowMoney, setAllowMoney] = React.useState(false);

  const [session, setSession] = React.useState<Session | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [history, setHistory] = React.useState<Session[]>([]);
  const [launching, setLaunching] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // ── Loads ───────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`)
      .then(r => (r.ok ? r.json() : []))
      .then(a => setAgents(Array.isArray(a) ? a : []))
      .catch(() => {});
    fetch(`${BOT_URL}/admin/roundtable/facts`)
      .then(r => (r.ok ? r.json() : null))
      .then(f => setFacts(f?.facts ?? null))
      .catch(() => {});
    refreshHistory();
  }, []);

  const refreshHistory = React.useCallback(() => {
    fetch(`${BOT_URL}/admin/roundtable?limit=15`)
      .then(r => (r.ok ? r.json() : { sessions: [] }))
      .then(d => setHistory(d.sessions ?? []))
      .catch(() => {});
  }, []);

  // ── Polling ─────────────────────────────────────────────────────────────────
  // Only while the session is live. A finished transcript never changes, so
  // polling one is pure noise against the bot's Supabase quota.
  React.useEffect(() => {
    if (!session || !isLive(session)) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/roundtable/${session.id}`);
        if (!r.ok) return;
        const d = await r.json();
        setSession(d.session);
        setMessages(d.messages ?? []);
        if (!isLive(d.session)) refreshHistory();
      } catch { /* transient — the next tick retries */ }
    }, 2000);
    return () => clearInterval(id);
  }, [session, refreshHistory]);

  const open = React.useCallback(async (id: string) => {
    setErr(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/roundtable/${id}`);
      if (!r.ok) throw new Error("Could not load that session.");
      const d = await r.json();
      setSession(d.session);
      setMessages(d.messages ?? []);
    } catch (e: any) { setErr(String(e.message ?? e)); }
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const launch = async () => {
    setErr(null); setLaunching(true);
    try {
      const r = await fetch(`${BOT_URL}/admin/roundtable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          agent_ids: picked,
          floor_rounds: rounds,
          allow_money: allowMoney,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Launch failed.");
      setSession(d.session);
      setMessages([]);
      refreshHistory();
    } catch (e: any) { setErr(String(e.message ?? e)); }
    finally { setLaunching(false); }
  };

  const cancel = async () => {
    if (!session) return;
    await fetch(`${BOT_URL}/admin/roundtable/${session.id}/cancel`, { method: "POST" }).catch(() => {});
  };

  const remove = async (id: string) => {
    await fetch(`${BOT_URL}/admin/roundtable/${id}`, { method: "DELETE" }).catch(() => {});
    if (session?.id === id) { setSession(null); setMessages([]); }
    refreshHistory();
  };

  const toggle = (id: string) => setPicked(p =>
    p.includes(id) ? p.filter(x => x !== id) : p.length >= MAX_PARTICIPANTS ? p : [...p, id]
  );

  const canLaunch = question.trim().length >= 15 && picked.length >= 2 && !launching && !isLive(session);

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1180 }}>
      <Header />

      {err && (
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px",
          borderRadius: 8, background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.25)", marginBottom: 14,
        }}>
          <AlertTriangle size={14} color={C.rose} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#fda4af" }}>{err}</span>
        </div>
      )}

      <Launcher
        {...{ question, setQuestion, agents, picked, toggle, rounds, setRounds,
              allowMoney, setAllowMoney, canLaunch, launch, launching,
              facts, showFacts, setShowFacts }}
      />

      {session && (
        <Transcript session={session} messages={messages} onCancel={cancel} />
      )}

      <History sessions={history} onOpen={open} onDelete={remove} activeId={session?.id} />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Users size={15} color={C.purple} />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>Roundtable</h1>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
          color: C.purple, background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.25)", borderRadius: 5, padding: "2px 6px",
        }}>Experiment</span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 4px", lineHeight: 1.6, maxWidth: 760 }}>
        Several agents, one question. Each answers <strong style={{ color: C.dim }}>blind</strong> with
        access to its own data, then they all read each other and argue, then a facilitator who took no
        part reports what happened.
      </p>
      <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 18px", lineHeight: 1.6, maxWidth: 760 }}>
        <strong style={{ color: C.green }}>Nothing here is executed.</strong> A roundtable writes no
        insight, no task and no email — every write tool is blocked for the duration of the run. It
        produces a transcript and a report, and that is all.
      </p>
    </>
  );
}

// ── Launcher ──────────────────────────────────────────────────────────────────

function Launcher(p: any) {
  const {
    question, setQuestion, agents, picked, toggle, rounds, setRounds,
    allowMoney, setAllowMoney, canLaunch, launch, launching,
    facts, showFacts, setShowFacts,
  } = p;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 16, marginBottom: 18,
    }}>
      <Label>The question</Label>
      <textarea
        value={question}
        onChange={(e: any) => setQuestion(e.target.value)}
        placeholder="e.g. Our product page gets the most traffic in the business and converts worst. What is actually in the way, and whose problem is it?"
        rows={3}
        style={{
          width: "100%", background: "rgba(0,0,0,0.25)", color: C.text,
          border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px",
          fontSize: 12.5, lineHeight: 1.6, resize: "vertical", fontFamily: "inherit",
          outline: "none", marginBottom: 14,
        }}
      />

      <Label>
        Who is in the room
        <span style={{ color: C.muted, fontWeight: 500, marginLeft: 6 }}>
          {picked.length}/{MAX_PARTICIPANTS} — pick at least 2
        </span>
      </Label>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))",
        gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto",
      }} className="custom-scrollbar">
        {agents.map((a: AgentDef) => {
          const on = picked.includes(a.id);
          const full = !on && picked.length >= MAX_PARTICIPANTS;
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              disabled={full}
              title={a.specialization}
              style={{
                display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                padding: "7px 9px", borderRadius: 7, cursor: full ? "not-allowed" : "pointer",
                background: on ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.06)"}`,
                opacity: full ? 0.35 : 1, transition: "all .12s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{a.emoji ?? "🤖"}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: "block", fontSize: 11.5, fontWeight: 600,
                  color: on ? C.text : C.dim, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>{a.name}</span>
                {a.specialization && (
                  <span style={{
                    display: "block", fontSize: 9.5, color: C.muted, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>{a.specialization}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <Label>Floor rounds</Label>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                style={{
                  width: 34, height: 30, borderRadius: 7, cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  color: rounds === n ? C.text : C.muted,
                  background: rounds === n ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${rounds === n ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
              >{n}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Dollar figures</Label>
          <button
            onClick={() => setAllowMoney(!allowMoney)}
            title={allowMoney
              ? "Agents may state dollar figures, but only built from the measured economics below."
              : "Agents may not state any dollar figure. Impact is high / medium / low."}
            style={{
              display: "flex", alignItems: "center", gap: 7, height: 30,
              padding: "0 11px", borderRadius: 7, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              color: allowMoney ? "#fcd34d" : C.green,
              background: allowMoney ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.08)",
              border: `1px solid ${allowMoney ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.25)"}`,
            }}
          >
            <DollarSign size={12} />
            {allowMoney ? "Allowed — must show arithmetic" : "Blocked"}
          </button>
        </div>

        <button
          onClick={launch}
          disabled={!canLaunch}
          style={{
            display: "flex", alignItems: "center", gap: 7, height: 30,
            padding: "0 15px", borderRadius: 7, fontSize: 12, fontWeight: 700,
            cursor: canLaunch ? "pointer" : "not-allowed",
            color: canLaunch ? "#1a1a1c" : C.muted,
            background: canLaunch ? C.purple : "rgba(255,255,255,0.05)",
            border: "none", marginLeft: "auto",
          }}
        >
          {launching ? <Loader size={13} className="spin" /> : <Play size={13} />}
          {launching ? "Starting…" : "Begin roundtable"}
        </button>
      </div>

      {/* The measured economics, shown because an injected fact nobody can see is
          indistinguishable from one the model invented. */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 11 }}>
        <button
          onClick={() => setShowFacts(!showFacts)}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0,
            fontSize: 11, fontWeight: 600, color: C.muted,
          }}
        >
          {showFacts ? <EyeOff size={12} /> : <Eye size={12} />}
          What the agents will be told about the business
        </button>
        {showFacts && (
          <div style={{ marginTop: 9 }}>
            <p style={{ fontSize: 10.5, color: C.muted, margin: "0 0 8px", lineHeight: 1.6 }}>
              Read from our own systems and injected into every participant. These are the only
              figures of this kind they may use — they are instructed not to recall, estimate or
              benchmark any of them.
            </p>
            {facts === null
              ? <span style={{ fontSize: 11, color: C.muted }}>Loading…</span>
              : facts.map((f: MeasuredFact) => (
                <div key={f.key} style={{
                  display: "flex", gap: 10, padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.dim, width: 190, flexShrink: 0 }}>
                    {f.label}
                  </span>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, width: 100, flexShrink: 0,
                    color: f.available ? C.cyan : C.rose,
                  }} className="mono">
                    {f.available && f.value != null ? fmt(f.value, f.unit) : "UNAVAILABLE"}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, minWidth: 0 }}>
                    {f.basis}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transcript ────────────────────────────────────────────────────────────────

function Transcript({ session, messages, onCancel }: {
  session: Session; messages: Msg[]; onCancel: () => void;
}) {
  const live = isLive(session);
  const statusColor =
    session.status === "done" ? C.green :
    session.status === "failed" ? C.rose :
    session.status === "cancelled" ? C.muted : C.blue;

  // Group consecutive messages by phase+round so the transcript reads as rounds
  // rather than as a flat list of turns.
  const groups: { key: string; phase: Msg["phase"]; round: number; msgs: Msg[] }[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    if (last && last.phase === m.phase && last.round === m.round) last.msgs.push(m);
    else groups.push({ key: `${m.phase}-${m.round}-${m.seq}`, phase: m.phase, round: m.round, msgs: [m] });
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 16, marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text, margin: "0 0 5px", lineHeight: 1.5 }}>
            {session.question}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: statusColor }}>
              {live && <Loader size={11} className="spin" />}
              {session.status.toUpperCase()}
              {live && session.phase && <span style={{ color: C.muted, fontWeight: 500 }}>· {phaseLabel(session.phase)}</span>}
            </span>
            <span style={{ fontSize: 10.5, color: C.muted }}>
              {session.agent_ids.length} agents · {session.floor_rounds} floor round{session.floor_rounds > 1 ? "s" : ""}
            </span>
            {!session.allow_money && (
              <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>no dollar figures</span>
            )}
          </div>
        </div>
        {live && (
          <button
            onClick={onCancel}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 11px",
              borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600,
              color: "#fda4af", background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.25)", flexShrink: 0,
            }}
          >
            <Square size={11} /> Stop
          </button>
        )}
      </div>

      {session.error && (
        <div style={{
          padding: "8px 11px", borderRadius: 7, marginBottom: 12,
          background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)",
          fontSize: 11, color: "#fda4af",
        }}>{session.error}</div>
      )}

      {messages.length === 0 && live && (
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, padding: "18px 0", textAlign: "center" }}>
          The opening statements are being written at the same time, each agent blind to the others.
          They will appear together.
        </p>
      )}

      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 9,
            paddingBottom: 5, borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
              color: PHASE_STYLE[g.phase].color,
            }}>
              {PHASE_STYLE[g.phase].label}{g.round > 0 ? ` · round ${g.round}` : ""}
            </span>
          </div>
          {g.msgs.map(m => <Turn key={m.id} m={m} />)}
        </div>
      ))}
    </div>
  );
}

function Turn({ m }: { m: Msg }) {
  const [open, setOpen] = React.useState(true);
  const isError = m.phase === "error";
  const isReport = m.phase === "synthesis";
  const noTools = m.phase === "opening" && (!m.tools_used || m.tools_used.length === 0);

  return (
    <div style={{
      marginBottom: 10, borderRadius: 9, overflow: "hidden",
      background: isReport ? "rgba(233,141,32,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isReport ? "rgba(233,141,32,0.2)" : isError ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.05)"}`,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "8px 11px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
        <span style={{ fontSize: 14 }}>{m.agent_emoji ?? (isError ? "⚠️" : "🤖")}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: isError ? "#fda4af" : C.text }}>
          {m.agent_name}
        </span>

        {/* Tool provenance. An opening with no tool calls is an agent reasoning from
            its system prompt, and saying so is the whole point of showing this. */}
        {m.phase === "opening" && (
          noTools ? (
            <span title="This agent called no tools — its opening is reasoning from its system prompt, not from a read."
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700,
                color: "#fcd34d", background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.25)", borderRadius: 4, padding: "1px 5px",
              }}>
              <AlertTriangle size={9} /> no reads
            </span>
          ) : (
            <span title={m.tools_used.join(", ")}
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700,
                color: C.cyan, background: "rgba(0,201,215,0.08)",
                border: "1px solid rgba(0,201,215,0.2)", borderRadius: 4, padding: "1px 5px",
              }}>
              <Wrench size={9} /> {m.tools_used.length} read{m.tools_used.length > 1 ? "s" : ""}
            </span>
          )
        )}
      </button>
      {open && (
        <div style={{ padding: "0 13px 12px 32px", fontSize: 12.3, color: C.dim, lineHeight: 1.65 }}>
          <MarkdownMessage content={m.content} />
          {m.phase === "opening" && m.tools_used.length > 0 && (
            <div style={{ marginTop: 9, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {m.tools_used.map((t, i) => (
                <span key={`${t}-${i}`} className="mono" style={{
                  fontSize: 9, color: C.muted, background: "rgba(255,255,255,0.04)",
                  borderRadius: 3, padding: "1px 5px",
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────

function History({ sessions, onOpen, onDelete, activeId }: {
  sessions: Session[]; onOpen: (id: string) => void;
  onDelete: (id: string) => void; activeId?: string;
}) {
  if (!sessions.length) return null;
  return (
    <div>
      <Label>Past roundtables</Label>
      {sessions.map(s => (
        <div key={s.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 11px",
          borderRadius: 8, marginBottom: 4, cursor: "pointer",
          background: s.id === activeId ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${s.id === activeId ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.05)"}`,
        }} onClick={() => onOpen(s.id)}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 0.4, width: 62, flexShrink: 0,
            color: s.status === "done" ? C.green : s.status === "failed" ? C.rose
                 : s.status === "cancelled" ? C.muted : C.blue,
          }}>{s.status.toUpperCase()}</span>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 11.5, color: C.dim,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{s.question}</span>
          <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
            {s.agent_ids?.length ?? 0} agents
          </span>
          <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, width: 74, textAlign: "right" }}>
            {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
            title="Delete this roundtable and its transcript"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
          >
            <Trash2 size={12} color={C.muted} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
      color: C.muted, marginBottom: 7,
    }}>{children}</div>
  );
}

function fmt(v: number, unit: string): string {
  if (unit === "usd" || unit === "usd_per_month") {
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 1000 ? 2 : 0 })}`;
  }
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "ratio") return v.toFixed(2);
  return Math.round(v).toLocaleString();
}

function phaseLabel(phase: string): string {
  if (phase === "opening") return "openings, written blind";
  if (phase.startsWith("floor:")) return `open floor, round ${phase.split(":")[1]}`;
  if (phase === "synthesis") return "facilitator writing the report";
  return phase;
}
