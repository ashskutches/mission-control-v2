"use client";
/**
 * OutreachPanel — an agent talking to somebody outside the company, on the
 * insight where it was decided.
 *
 * ## Why this is on the insight page and not a surface of its own
 *
 * The question a reviewer is actually answering is not "is this a good email".
 * It is "is this a good email *for this*" — and the finding, the goal, the money
 * and the conversation so far are all already here. A standalone outbox would
 * hand somebody a paragraph of copy with no idea what we were trying to get, and
 * Approve is a very easy button to press when you cannot see what you are
 * approving against. So the mandate renders directly above the draft, every time.
 *
 * ## Two things a person does here, and they are different jobs
 *
 * AUTHORISE (admin). Who may be contacted, what may be offered, what may never
 * be said, and how many rounds. Set once, before anything is drafted. This is
 * the leash, and it is the owner's call because it is a statement about what the
 * business is willing to give away.
 *
 * REVIEW (teammate and above). Read the draft against that mandate; send it,
 * rewrite it and send your version, or say why not. Delegable precisely because
 * the standard has already been set by somebody else.
 *
 * Reversing that split — anyone may authorise, only the owner may approve —
 * makes the owner a copy editor while the actual decision goes unowned.
 *
 * ## The edit is not a nicety
 *
 * Approve/Reject alone forces "yes, but not that second paragraph" to come out as
 * a rejection and another wait, or as an approval of copy nobody quite meant. The
 * textarea holds the agent's draft; the moment it differs, the button says so and
 * what goes out is attributed to the person who wrote it. The approval gate binds
 * to a hash of the payload, so an edit genuinely does invalidate the agent's
 * version and mint a new approval for the reviewer's — which is the mechanism
 * working, not a workaround.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Mail, Send, ShieldCheck, AlertTriangle, Loader2, Pencil, X,
  Building2, Target, Ban, Hash, Lock, CheckCircle2, Inbox,
} from "lucide-react";
import { useRole } from "@/app/lib/useRole";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";
/**
 * Every WRITE here goes through the proxy, never BOT_URL.
 *
 * It is what stamps who approved, who authorised and who closed, from the signed
 * session — the browser must not be able to say. This is the same rule as posting
 * into an insight's conversation, and it is more load-bearing here: "a human
 * approved this email" is the entire safety claim of the feature, and an approval
 * with no name on it does not support it. `/admin/tasks/:id/approve` was being
 * called at BOT_URL from the work drawer and recorded no approver at all.
 */
const PROXY_URL = "/api/bot";
const ACCENT = "#e98d20";

interface OutreachMessage {
  id: string;
  direction: "outbound" | "inbound";
  author: "agent" | "human" | "counterparty";
  subject: string | null;
  body: string;
  agent_draft: string | null;
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
}
interface Thread {
  id: string;
  counterparty_email: string;
  counterparty_name: string | null;
  organization: string | null;
  subject: string;
  status: "draft" | "active" | "closed";
  goal: string;
  mandate_offer: string | null;
  mandate_never: string | null;
  max_rounds: number;
  rounds_used: number;
  mandate_set_by: string | null;
  close_note: string | null;
  messages: OutreachMessage[];
}
interface Draft {
  id: string;
  agent_name: string | null;
  title: string;
  tool_input: { body?: string; subject?: string | null; to?: string };
  created_at: string;
}
interface AgentReadiness { ready: boolean; agent_name: string | null; reason: string | null }
interface Payload {
  threads: Thread[];
  pending_drafts: Draft[];
  mail: { sendEnabled: boolean; blockers: string[]; signature: string };
  agent: AgentReadiness;
}

const box: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: "0.85rem 0.95rem",
  marginBottom: "0.7rem",
};
const label: React.CSSProperties = {
  fontSize: "9.5px", fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px",
  display: "flex", alignItems: "center", gap: 5,
};
const field: React.CSSProperties = {
  width: "100%", background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8,
  color: "#e2e8f0", fontSize: "12.5px", padding: "8px 10px",
  fontFamily: "inherit", lineHeight: 1.6,
};

function Btn({
  onClick, disabled, children, tone = "quiet",
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
  tone?: "go" | "quiet" | "danger";
}) {
  const c = tone === "go"
    ? { bg: ACCENT, fg: "#0b1220", bd: "none" }
    : tone === "danger"
      ? { bg: "rgba(244,63,94,0.1)", fg: "#f43f5e", bd: "1px solid rgba(244,63,94,0.33)" }
      : { bg: "rgba(255,255,255,0.03)", fg: "#94a3b8", bd: "1px solid rgba(255,255,255,0.1)" };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 13px", minHeight: 34, borderRadius: 8,
      background: c.bg, color: c.fg, border: c.bd,
      fontSize: "12px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
    }}>{children}</button>
  );
}

function stamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "";
}

// ── The mandate, rendered above every draft ─────────────────────────────────
function Mandate({ t }: { t: Thread }) {
  const left = t.max_rounds - t.rounds_used;
  return (
    <div style={{ display: "grid", gap: 5, fontSize: "11.5px", color: "#cbd5e1" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Building2 size={11} color="#64748b" />
        <strong style={{ color: "#e2e8f0" }}>
          {t.counterparty_name ?? t.counterparty_email}
        </strong>
        {t.organization && <span style={{ color: "#64748b" }}>· {t.organization}</span>}
        <span style={{ color: "#475569", fontSize: "10.5px" }}>&lt;{t.counterparty_email}&gt;</span>
      </span>
      <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Target size={11} color="#64748b" style={{ marginTop: 3, flexShrink: 0 }} />
        <span><span style={{ color: "#64748b" }}>Goal: </span>{t.goal}</span>
      </span>
      <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <ShieldCheck size={11} color="#64748b" style={{ marginTop: 3, flexShrink: 0 }} />
        <span>
          <span style={{ color: "#64748b" }}>May offer: </span>
          {t.mandate_offer || <em style={{ color: "#64748b" }}>nothing authorised</em>}
        </span>
      </span>
      {t.mandate_never && (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <Ban size={11} color="#f43f5e" style={{ marginTop: 3, flexShrink: 0 }} />
          <span><span style={{ color: "#64748b" }}>Never: </span>{t.mandate_never}</span>
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Hash size={11} color="#64748b" />
        <span style={{ color: left <= 0 ? "#f43f5e" : left === 1 ? "#fb923c" : "#94a3b8" }}>
          {t.rounds_used} of {t.max_rounds} rounds used
          {left <= 0 ? " — none left, the agent cannot draft again" : ` · ${left} left`}
        </span>
        {t.mandate_set_by && (
          <span style={{ color: "#475569", fontSize: "10.5px" }}>
            authorised by {t.mandate_set_by}
          </span>
        )}
      </span>
    </div>
  );
}

export default function OutreachPanel({
  insightId, onChanged,
}: { insightId: string; onChanged?: () => void }) {
  const { role, loaded } = useRole();
  const isAdmin = loaded && role === "admin";

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /** Draft id → the reviewer's working copy of the body. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  /** Draft id → rejection reason, while the reject box is open. */
  const [rejecting, setRejecting] = useState<Record<string, string>>({});
  const [authoring, setAuthoring] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");

  const [form, setForm] = useState({
    counterparty_email: "", counterparty_name: "", organization: "",
    subject: "", goal: "", mandate_offer: "", mandate_never: "", max_rounds: 3,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/outreach/insight/${insightId}`);
      if (!res.ok) throw new Error(`Could not load outreach (${res.status})`);
      const json: Payload = await res.json();
      setData(json);
      // Seed each editor with the agent's draft, without clobbering anything
      // half-typed: a poll landing mid-edit must not take the words away.
      setEdits(prev => {
        const next = { ...prev };
        for (const d of json.pending_drafts) {
          if (next[d.id] === undefined) next[d.id] = d.tool_input?.body ?? "";
        }
        return next;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [insightId]);

  useEffect(() => { load(); }, [load]);

  const write = useCallback(async (path: string, body: unknown, method = "POST") => {
    const res = await fetch(`${PROXY_URL}${path}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // These routes explain themselves — a blocked delivery comes back as a list.
      const blockers = Array.isArray(json.blockers) ? ` ${json.blockers.join(" ")}` : "";
      throw new Error(`${json.error ?? json.detail ?? `HTTP ${res.status}`}${blockers}`);
    }
    return json;
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const authorise = () => run("authorise", async () => {
    await write(`/admin/outreach/insight/${insightId}/mandate`, form, "PUT");
    setAuthoring(false);
  });

  const approve = (d: Draft) => run(`approve:${d.id}`, async () => {
    const original = d.tool_input?.body ?? "";
    const mine = edits[d.id] ?? original;
    // Only send `edited_input` when it genuinely differs. An unchanged body sent
    // as an edit would record the reviewer as the author of the agent's words.
    await write(`/admin/tasks/${d.id}/approve`,
      mine.trim() !== original.trim() ? { edited_input: { body: mine } } : {});
  });

  const reject = (d: Draft) => run(`reject:${d.id}`, async () => {
    await write(`/admin/tasks/${d.id}/reject`, { note: rejecting[d.id] ?? "" });
    setRejecting(p => { const n = { ...p }; delete n[d.id]; return n; });
  });

  const close = (t: Thread) => run(`close:${t.id}`, async () => {
    await write(`/admin/outreach/threads/${t.id}/close`, { note: closeNote });
    setClosing(null); setCloseNote("");
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return null;

  const threads = data?.threads ?? [];
  const live = threads.filter(t => t.status !== "closed");
  const drafts = data?.pending_drafts ?? [];

  /**
   * Nothing authorised and nobody can authorise it: render nothing at all.
   *
   * A teammate does not need an empty panel explaining a control they do not
   * have, on an insight where outreach may never be the right move. An admin
   * gets the affordance, because they cannot ask for one that is not there.
   */
  if (!threads.length && !drafts.length && !isAdmin) return null;

  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <p style={{ ...label, marginBottom: 8 }}>
        <Mail size={11} /> Outreach
      </p>

      {error && (
        <div style={{ ...box, background: "rgba(244,63,94,0.06)", borderColor: "rgba(244,63,94,0.25)", display: "flex", gap: 8 }}>
          <AlertTriangle size={14} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{error}</span>
        </div>
      )}

      {/*
        Said before anything else, and bluntly. A reviewer who presses Approve and
        sees the draft disappear, while nothing left the building, is the worst
        outcome this panel has — so the sentence names the consequence, not the
        setting. Same wording discipline as support's mailStatus blockers.
      */}
      {(data?.mail.blockers.length ?? 0) > 0 && (
        <div style={{ ...box, background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.25)" }}>
          {data!.mail.blockers.map((b, i) => (
            <p key={i} style={{ fontSize: "12px", color: "#fdba74", margin: i ? "6px 0 0" : 0, lineHeight: 1.55 }}>{b}</p>
          ))}
        </div>
      )}

      {/*
        The agent cannot draft. Stated here rather than left to fail silently,
        because the silent version is the one this codebase has hit four times: the
        tool is filtered off the schema, the agent concludes a capability is
        missing, and files a blockage naming a credential it guessed at.
      */}
      {live.length > 0 && data?.agent && !data.agent.ready && (
        <div style={{ ...box, background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.25)", display: "flex", gap: 8 }}>
          <AlertTriangle size={14} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "12px", color: "#fdba74", lineHeight: 1.55 }}>{data.agent.reason}</span>
        </div>
      )}

      {/* ── A draft waiting on a person ── */}
      {drafts.map((d) => {
        const original = d.tool_input?.body ?? "";
        const mine = edits[d.id] ?? original;
        const changed = mine.trim() !== original.trim();
        const thread = live.find(t => t.counterparty_email === d.tool_input?.to) ?? live[0];
        const rejectOpen = rejecting[d.id] !== undefined;
        return (
          <div key={d.id} style={{ ...box, borderColor: `${ACCENT}44`, background: `${ACCENT}0a` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: ACCENT }}>
                {d.agent_name ?? "An agent"} wants to send this
              </span>
              <span style={{ fontSize: "10px", color: "#64748b" }}>drafted {stamp(d.created_at)}</span>
            </div>

            {thread && (
              <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <Mandate t={thread} />
              </div>
            )}

            <p style={{ fontSize: "11.5px", color: "#94a3b8", margin: "0 0 7px" }}>
              <span style={{ color: "#64748b" }}>Subject: </span>
              {d.tool_input?.subject || thread?.subject || "(none)"}
            </p>

            <textarea
              value={mine}
              onChange={(e) => setEdits(p => ({ ...p, [d.id]: e.target.value }))}
              rows={Math.min(20, Math.max(7, mine.split("\n").length + 1))}
              style={{ ...field, resize: "vertical" }}
            />

            {/* The signature is appended after sending, deterministically, and is
                not part of the editable body — so it is shown rather than implied. */}
            {data?.mail.signature && (
              <pre style={{
                margin: "7px 0 0", fontSize: "11px", color: "#64748b",
                fontFamily: "inherit", whiteSpace: "pre-wrap", lineHeight: 1.5,
              }}>{data.mail.signature}</pre>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11, alignItems: "center" }}>
              <Btn tone="go" onClick={() => approve(d)} disabled={busy !== null || !mine.trim()}>
                {busy === `approve:${d.id}`
                  ? <Loader2 size={12} className="animate-spin" />
                  : changed ? <Pencil size={12} /> : <Send size={12} />}
                {changed ? "Send my version" : "Send as written"}
              </Btn>
              {!rejectOpen && (
                <Btn tone="danger" onClick={() => setRejecting(p => ({ ...p, [d.id]: "" }))} disabled={busy !== null}>
                  <X size={12} /> Don&apos;t send
                </Btn>
              )}
              {changed && (
                <span style={{ fontSize: "10.5px", color: "#fdba74" }}>
                  Your wording goes out, recorded as yours — the agent&apos;s draft is kept beside it.
                </span>
              )}
            </div>

            {rejectOpen && (
              <div style={{ marginTop: 10 }}>
                <p style={{ ...label, marginBottom: 5 }}>Why not? The agent redrafts from this</p>
                <textarea
                  value={rejecting[d.id] ?? ""}
                  onChange={(e) => setRejecting(p => ({ ...p, [d.id]: e.target.value }))}
                  rows={3}
                  placeholder="Too much about us and not enough about their readers. Lead with the 40+ angle."
                  style={{ ...field, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn tone="danger" onClick={() => reject(d)}
                    disabled={busy !== null || (rejecting[d.id] ?? "").trim().length < 10}>
                    {busy === `reject:${d.id}` ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    Reject and tell them
                  </Btn>
                  <Btn onClick={() => setRejecting(p => { const n = { ...p }; delete n[d.id]; return n; })}>
                    Cancel
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── The authorised conversations ── */}
      {threads.map((t) => (
        <div key={t.id} style={{ ...box, opacity: t.status === "closed" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Mandate t={t} />
            {t.status !== "closed" && closing !== t.id && (
              <Btn onClick={() => { setClosing(t.id); setCloseNote(""); }} disabled={busy !== null}>
                Close it out
              </Btn>
            )}
          </div>

          {t.status === "closed" && t.close_note && (
            <p style={{ fontSize: "11.5px", color: "#94a3b8", margin: "9px 0 0", display: "flex", gap: 6 }}>
              <CheckCircle2 size={12} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{t.close_note}</span>
            </p>
          )}

          {closing === t.id && (
            <div style={{ marginTop: 10 }}>
              <p style={{ ...label, marginBottom: 5 }}>What happened? Required</p>
              <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} rows={2}
                placeholder="Editor replied — inclusion is affiliate-only, not editorial. Not worth pursuing."
                style={{ ...field, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn tone="go" onClick={() => close(t)} disabled={busy !== null || closeNote.trim().length < 10}>
                  {busy === `close:${t.id}` ? <Loader2 size={12} className="animate-spin" /> : null}
                  Close
                </Btn>
                <Btn onClick={() => setClosing(null)}>Cancel</Btn>
              </div>
              <p style={{ fontSize: "10.5px", color: "#64748b", margin: "7px 0 0" }}>
                Any draft still waiting is withdrawn — a conversation you have ended cannot be replied to.
              </p>
            </div>
          )}

          {/* The conversation itself. An outside party's words, so rendered plain
              rather than as markdown — theirs are not ours to reformat. */}
          {t.messages.length > 0 && (
            <div style={{ marginTop: 11, display: "grid", gap: 9 }}>
              {t.messages.map((m) => (
                <div key={m.id} style={{
                  borderLeft: `2px solid ${m.direction === "inbound" ? "#38bdf8" : ACCENT}`,
                  paddingLeft: 9,
                }}>
                  <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 3px", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    {m.direction === "inbound"
                      ? <><Inbox size={9} /> {t.counterparty_name ?? t.counterparty_email}</>
                      : <><Send size={9} /> us{m.author === "human" ? " (written by a person)" : ""}</>}
                    <span>· {stamp(m.sent_at ?? m.created_at)}</span>
                    {m.approved_by && <span>· approved by {m.approved_by}</span>}
                    {m.agent_draft && <span style={{ color: "#fdba74" }}>· edited before sending</span>}
                  </p>
                  <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Authorise ── */}
      {isAdmin && !authoring && (
        <Btn onClick={() => setAuthoring(true)} disabled={busy !== null}>
          <ShieldCheck size={12} /> {live.length ? "Authorise another conversation" : "Authorise outreach"}
        </Btn>
      )}

      {!isAdmin && loaded && live.length === 0 && (drafts.length > 0 || threads.length > 0) && (
        <p style={{ fontSize: "10.5px", color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
          <Lock size={10} /> Authorising outreach is the owner&apos;s call. You can review and send what is drafted under it.
        </p>
      )}

      {isAdmin && authoring && (
        <div style={{ ...box, borderColor: `${ACCENT}33` }}>
          <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "0 0 4px", fontWeight: 700 }}>
            Authorise this agent to write to somebody
          </p>
          <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 11px", lineHeight: 1.55 }}>
            Nothing is sent by this. It sets the boundaries the agent drafts inside, and every draft
            still comes to a person before it leaves. Say what may be offered — an agent with no
            authorised offer is told to offer nothing.
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input style={field} placeholder="Their email *"
                value={form.counterparty_email}
                onChange={(e) => setForm(f => ({ ...f, counterparty_email: e.target.value }))} />
              <input style={field} placeholder="Their name"
                value={form.counterparty_name}
                onChange={(e) => setForm(f => ({ ...f, counterparty_name: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
              <input style={field} placeholder="Organisation (Women's Health UK)"
                value={form.organization}
                onChange={(e) => setForm(f => ({ ...f, organization: e.target.value }))} />
              <input style={field} type="number" min={1} max={8} placeholder="Rounds"
                value={form.max_rounds}
                onChange={(e) => setForm(f => ({ ...f, max_rounds: Number(e.target.value) }))} />
            </div>
            <input style={field} placeholder="Subject line for the first email *"
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} />
            <textarea style={{ ...field, resize: "vertical" }} rows={2}
              placeholder="Goal — what are we trying to get? *"
              value={form.goal}
              onChange={(e) => setForm(f => ({ ...f, goal: e.target.value }))} />
            <textarea style={{ ...field, resize: "vertical" }} rows={2}
              placeholder="May offer — a review unit on loan, an expert quote, exclusive data…"
              value={form.mandate_offer}
              onChange={(e) => setForm(f => ({ ...f, mandate_offer: e.target.value }))} />
            <textarea style={{ ...field, resize: "vertical" }} rows={2}
              placeholder="May never say — pricing, discounts, health claims, anything about competitors…"
              value={form.mandate_never}
              onChange={(e) => setForm(f => ({ ...f, mandate_never: e.target.value }))} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
            <Btn tone="go" onClick={authorise}
              disabled={busy !== null || !form.counterparty_email.trim() || !form.subject.trim() || !form.goal.trim()}>
              {busy === "authorise" ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Authorise
            </Btn>
            <Btn onClick={() => setAuthoring(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
