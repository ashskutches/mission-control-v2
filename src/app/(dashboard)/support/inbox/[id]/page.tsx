"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Send, XCircle, RefreshCw, Bot, User, FileText,
  ShoppingBag, Sparkles, AlertTriangle, Info, CheckCircle2, Pencil, History,
  Wrench, CheckSquare, ArrowUpRight, MailWarning, ListChecks, Clock,
} from "lucide-react";
import {
  Panel, Pill, Btn, Confidence, Empty, ago, Loading, ErrorBox, OpsMark,
  STATUS_COLOR, STATUS_LABEL, SUPPORT_ACCENT,
} from "../../ui";
import {
  getTicket, approveTicket, rejectTicket, generateDraft, getVocabulary,
  resolveTicket, handledElsewhere, logActions, completeAction, resendReply,
  escalateTicket,
  REASON_LABELS, REASON_CODES, OUTCOME_LABELS, OUTCOME_COLOR, ActionTypeDef,
} from "../../api";
import {
  ResolutionFields, ResolutionState, emptyResolution, toPayload, resolutionProblems,
  hasResolutionContent, ActionLog, Timeline, AddFollowupRow, newActionDraft,
} from "../../resolution";

/** The panel currently in charge of the middle column. */
type Mode = "review" | "reject" | "closeout" | "elsewhere" | "escalate";

export default function ApprovalInterface() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [t, setT] = useState<any>(null);
  const [vocab, setVocab] = useState<{ group: string; actions: ActionTypeDef[] }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [body, setBody]       = useState("");
  const [mode, setMode]       = useState<Mode>("review");
  const [reason, setReason]   = useState<string | null>(null);
  const [note, setNote]       = useState("");
  const [rewrite, setRewrite] = useState("");

  // One resolution state for the whole page. Whichever button the rep presses,
  // what they already ticked carries over — switching from Approve to Reject &
  // rewrite must not silently discard the refund they just recorded.
  const [res, setRes] = useState<ResolutionState>(emptyResolution());

  // Escalation is its own tiny form; it produces a tracked follow-up, not a note.
  const [escNote, setEscNote] = useState("");
  const [escOwner, setEscOwner] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const data = await getTicket(id);
      setT(data);
      setBody(data.draft?.body ?? "");
    } catch (e: any) { setErr(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Fetched once, not hardcoded — the server validates against the same list.
  useEffect(() => {
    getVocabulary().then(v => setVocab(v.actionGroups)).catch(() => setVocab([]));
  }, []);

  if (err && !t) return <ErrorBox error={err} onRetry={load} />;
  if (!t) return <Loading label="Loading ticket" />;

  const draft = t.draft && t.draft.status === "pending" ? t.draft : null;
  const edited = !!draft && body.trim() !== String(draft.body).trim();
  const canReject = !!reason && note.trim().length >= 15 && rewrite.trim().length >= 20;

  const closed = !!t.outcome && t.status === "resolved";
  const needsCloseOut = !!t.needsCloseOut;
  const undelivered = t.undelivered ?? [];
  const openFollowups = (t.actions ?? []).filter((a: any) => a.status === "planned");

  const run = async (key: string, fn: () => Promise<any>, after?: (r: any) => string) => {
    setBusy(key); setErr(null); setDone(null);
    try {
      const r = await fn();
      setDone(after ? after(r) : "Done.");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  /** Appended to any success message so a swallowed resolution error is visible. */
  const resNote = (r: any) => r?.resolutionError
    ? ` ⚠️ The email went out, but the resolution was not recorded: ${r.resolutionError}`
    : r?.resolution
      ? ` Recorded ${r.resolution.actions.length} action(s) and ${r.resolution.followups.length} follow-up(s)${r.resolution.closed ? ", and closed the ticket" : ""}.`
      : "";

  const onApprove = () => run("approve",
    () => approveTicket(t.id, { body, ...toPayload(res, { close: false }) }),
    r => {
      setRes(emptyResolution());
      return (r.edited
        ? "Sent with your edits. Correction pair recorded as edited_on_approve."
        : "Approved and sent. Counted as a clean approval.") + resNote(r);
    });

  const onReject = () => run("reject",
    () => rejectTicket(t.id, {
      reasonCode: reason!, reasonNote: note, humanBody: rewrite,
      severity: reason === "policy_violation" || reason === "wrong_facts" ? 4 : 3,
      ...toPayload(res, { close: false }),
    }),
    r => {
      setMode("review"); setReason(null); setNote(""); setRewrite(""); setRes(emptyResolution());
      return (r.sendError
        // No longer a dead end: the text is parked on the thread and retryable.
        ? `Training pair stored and your reply saved, but it could not be sent: ${r.sendError} ` +
          `The ticket is marked "Not delivered" — use Retry send once the mailbox is fixed.`
        : "Your reply was sent and the training pair was stored.") + resNote(r);
    });

  const onCloseOut = () => run("closeout",
    () => resolveTicket(t.id, toPayload(res, { close: true })),
    () => {
      setMode("review"); setRes(emptyResolution());
      return openFollowupsAfter()
        ? "Closed. It stays in the follow-up queue until the outstanding work is ticked off."
        : "Closed. Fully resolved and out of the active inbox.";
    });

  const onHandledElsewhere = () => run("elsewhere",
    () => handledElsewhere(t.id, {
      ...toPayload(res, { close: true }),
      resolutionSummary: res.summary.trim(),
    }),
    () => {
      setMode("review"); setRes(emptyResolution());
      return "Marked as handled elsewhere, with your account of how.";
    });

  const onLogOnly = () => run("log",
    () => logActions(t.id, toPayload(res, { close: false })),
    () => { setRes(emptyResolution()); return "Recorded. The conversation is untouched."; });

  const onEscalate = () => run("escalate",
    () => escalateTicket(t.id, { note: escNote, owner: escOwner.trim() || undefined }),
    r => {
      setMode("review"); setEscNote(""); setEscOwner("");
      return r.ownerMissing
        ? "Escalated. No owner given, so nothing is tracking it — add a follow-up if someone specific needs to act."
        : "Escalated and assigned as a tracked follow-up.";
    });

  /** Will anything still be outstanding after this close-out? */
  const openFollowupsAfter = () =>
    openFollowups.length > 0 || res.actions.some(a => a.followup);

  const closeProblems = resolutionProblems(res, { close: true });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem",
                    flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link href="/support/inbox" style={{ textDecoration: "none" }}>
          <Btn variant="ghost" size="sm"><ArrowLeft size={12} /> Queue</Btn>
        </Link>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)",
                       fontFamily: "'JetBrains Mono', monospace" }}>#{t.ref}</span>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>{t.subject}</h2>
        <Pill color={STATUS_COLOR[t.status] ?? "#6b7280"} solid>
          {STATUS_LABEL[t.status] ?? t.status}
        </Pill>
        {/* The other two axes, shown alongside rather than folded in. A single
            pill cannot say "answered, denied, still owes a warehouse call". */}
        {t.outcome && (
          <Pill color={OUTCOME_COLOR[t.outcome] ?? "#6b7280"} solid>
            {OUTCOME_LABELS[t.outcome] ?? t.outcome}
          </Pill>
        )}
        <OpsMark state={t.ops_state} open={t.openFollowups} />
        {t.status === "awaiting_approval" && (
          <Pill color={t.awaitingMinutes > 60 ? "#f43f5e" : "#6b7280"}>
            waiting {ago(t.awaitingMinutes)}
          </Pill>
        )}
      </div>

      {err && <ErrorBox error={err} />}

      {/* ── The two states that used to be invisible ─────────────────────── */}

      {undelivered.length > 0 && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start", marginBottom: "1rem",
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.3)",
          borderRadius: 10, padding: "0.75rem 1rem",
        }}>
          <MailWarning size={15} color="#f43f5e" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700, marginBottom: 3 }}>
              A reply was written but never delivered
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {undelivered[undelivered.length - 1].delivery_error} — the text is saved on the
              thread below, marked as not delivered. The customer has not seen it.
            </div>
          </div>
          <Btn size="sm" variant="outline" color="#f43f5e" disabled={!!busy}
               onClick={() => run("resend", () => resendReply(t.id), () => "Sent.")}>
            <Send size={11} /> {busy === "resend" ? "Sending…" : "Retry send"}
          </Btn>
        </div>
      )}

      {needsCloseOut && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start", marginBottom: "1rem",
          background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
          borderRadius: 10, padding: "0.75rem 1rem",
        }}>
          <ListChecks size={15} color="#f5a840" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#f5a840", fontWeight: 700, marginBottom: 3 }}>
              Replied, but never closed out
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              The customer has an answer. Nothing records what we decided or what was done —
              so this ticket teaches the agent only how the email was worded.
            </div>
          </div>
          <Btn size="sm" color="#f5a840" onClick={() => setMode("closeout")}>
            <CheckSquare size={11} /> Close it out
          </Btn>
        </div>
      )}
      {done && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem",
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 10, padding: "0.6rem 0.9rem",
        }}>
          <CheckCircle2 size={15} color="#22c55e" />
          <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{done}</span>
        </div>
      )}

      {/* Metrics strip — the index stays one line per ticket; everything
          quantitative lives here, on the drill-down. */}
      {t.draft && (
        <div style={{
          display: "grid", gap: "1px", marginBottom: "0.9rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(122px, 1fr))",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--glass-border)", borderRadius: 12, overflow: "hidden",
        }}>
          <Stat label="Draft confidence" value={`${Math.round(Number(t.draft.confidence ?? 0) * 100)}%`}
                color={Number(t.draft.confidence) >= 0.8 ? "#22c55e"
                     : Number(t.draft.confidence) >= 0.6 ? "#f5a840" : "#f43f5e"} />
          <Stat label="Category confidence"
                value={t.classifier_confidence == null ? "—" : `${Math.round(Number(t.classifier_confidence) * 100)}%`}
                hint="A confident reply on a miscategorised ticket reads fine and is wrong."
                color={Number(t.classifier_confidence ?? 1) >= 0.8 ? "var(--text-primary)" : "#f5a840"} />
          <Stat label="Drafted after"
                value={`${t.draft.context_snapshot?.draftedAfterMinutes ?? 0}m`} hint="From the email landing" />
          <Stat label="Waiting for you" value={ago(t.awaitingMinutes)}
                color={t.awaitingMinutes > 60 ? "#f43f5e" : "var(--text-primary)"} />
          <Stat label="Attempt" value={`#${t.draft.attempt ?? 1}`}
                hint={(t.draft.attempt ?? 1) > 1 ? "Someone regenerated this" : undefined}
                color={(t.draft.attempt ?? 1) > 1 ? "#f5a840" : "var(--text-primary)"} />
          <Stat label="Tokens" value={`${((t.draft.tokens_in ?? 0) / 1000).toFixed(1)}k in`}
                hint={`${t.draft.tokens_out ?? 0} out · ${((t.draft.latency_ms ?? 0) / 1000).toFixed(1)}s`} />
          <Stat label="Cost" value={`${Number(t.draft.cost_cents ?? 0).toFixed(2)}¢`} />
          <Stat label="Docs cited" value={String(t.citedDocs?.length ?? 0)} />
          <Stat label="Past lessons used" value={String(t.exemplars?.length ?? 0)}
                hint={t.exemplars?.length ? "Corrections fed in as exemplars" : "No corrections exist yet to learn from"}
                color={t.exemplars?.length ? "#a78bfa" : "var(--text-dim)"} />
          {t.history && (
            <Stat label="Prior tickets" value={String(t.history.priorTickets)}
                  hint={t.history.priorCorrections > 0
                    ? `${t.history.priorCorrections} drafts to them were corrected`
                    : "No corrections on this customer"}
                  color={t.history.priorCorrections > 0 ? "#f5a840" : "var(--text-primary)"} />
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 1.5fr) minmax(230px, 0.85fr)",
                    alignItems: "start" }}>

        {/* ── Pane 1: the conversation ─────────────────────────────────── */}
        <Panel title="Conversation" subtitle={`${t.customer_name || "Unknown"} · ${t.customer_email || "—"}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {(t.messages ?? []).map((msg: any) => {
              const inbound = msg.direction === "inbound";
              // Anything that did not reach the customer must not look like it
              // did. An undelivered reply rendered identically to a sent one is
              // how a rep concludes the customer has been answered.
              const landed = inbound || msg.delivery === "delivered" || msg.delivery == null;
              return (
                <div key={msg.id} style={{
                  background: !landed ? "rgba(244,63,94,0.05)"
                    : inbound ? "rgba(255,255,255,0.03)" : "rgba(0,201,215,0.06)",
                  border: `1px solid ${!landed ? "rgba(244,63,94,0.32)"
                    : inbound ? "rgba(255,255,255,0.06)" : "rgba(0,201,215,0.2)"}`,
                  borderRadius: 10, padding: "0.7rem 0.8rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                                flexWrap: "wrap" }}>
                    {inbound ? <User size={11} color="var(--text-muted)" />
                             : msg.author === "ai" ? <Bot size={11} color={SUPPORT_ACCENT} />
                             : <User size={11} color={SUPPORT_ACCENT} />}
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                   letterSpacing: "0.06em",
                                   color: inbound ? "var(--text-muted)"
                                     : !landed ? "#f43f5e" : SUPPORT_ACCENT }}>
                      {inbound ? (t.customer_name || "Customer")
                               : msg.author === "ai" ? "AI" : "Human"}
                    </span>
                    {!landed && (
                      <Pill color={msg.delivery === "not_sent" ? "#6b7280" : "#f43f5e"}>
                        {msg.delivery === "not_sent" ? "internal note" : "not delivered"}
                      </Pill>
                    )}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      {new Date(msg.sent_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                                color: "var(--text-secondary)" }}>
                    {msg.body_text}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── Pane 2: the draft and the decision ───────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {!draft ? (
            <Panel title={closed ? "Closed" : "No draft"}>
              <Empty icon={closed ? CheckCircle2 : Bot}
                     title={closed ? "This ticket is closed" : "Nothing is waiting for approval"}
                     body={closed
                       ? `Outcome: ${OUTCOME_LABELS[t.outcome] ?? t.outcome}. ${t.resolution_summary ?? ""}`
                       : t.status === "needs_human_only"
                       ? "The classifier routed this straight to a human — it needs authority the agent doesn't have."
                       : t.status === "failed"
                       ? "A reply was written but not delivered. Retry it above, or close the ticket out if it was handled another way."
                       : t.status === "sent" ? "A reply has already been sent."
                       : "No pending draft."} />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
                {!closed && (
                  <Btn variant="outline" color={SUPPORT_ACCENT} disabled={busy === "draft"}
                       onClick={() => run("draft", () => generateDraft(t.id), () => "Draft generated.")}>
                    <RefreshCw size={13} /> {busy === "draft" ? "Drafting…" : "Draft a reply"}
                  </Btn>
                )}
                {/* The terminal actions, previously unreachable from any page:
                    `setTicketStatus` and `escalateTicket` were exported in api.ts
                    and never called, so nothing could ever leave `sent`. */}
                {!closed && (
                  <>
                    <Btn color="#22c55e" onClick={() => setMode("closeout")}>
                      <CheckSquare size={13} /> Close out
                    </Btn>
                    <Btn variant="outline" color="#a78bfa" onClick={() => setMode("elsewhere")}>
                      <History size={13} /> Already handled
                    </Btn>
                    <Btn variant="ghost" onClick={() => setMode("escalate")}>
                      <ArrowUpRight size={13} /> Escalate
                    </Btn>
                  </>
                )}
              </div>
            </Panel>
          ) : (
            <>
              <Panel
                title="AI draft"
                subtitle={`${draft.model ?? "?"} · ${new Date(draft.generated_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                right={<Confidence value={Number(draft.confidence ?? 0)} />}
              >
                {draft.reasoning && (
                  <div style={{
                    background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)",
                    borderRadius: 9, padding: "0.6rem 0.75rem", marginBottom: "0.8rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Sparkles size={11} color="#a78bfa" />
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                     letterSpacing: "0.07em", color: "#a78bfa" }}>Agent's reasoning</span>
                    </div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                      {draft.reasoning}
                    </div>
                  </div>
                )}

                {draft.suggested_escalation && (
                  <div style={{
                    display: "flex", gap: 7, alignItems: "flex-start",
                    background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
                    borderRadius: 9, padding: "0.55rem 0.7rem", marginBottom: "0.8rem",
                  }}>
                    <AlertTriangle size={12} color="#f5a840" style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: "#f5a840", lineHeight: 1.5 }}>
                      <strong>The agent thinks you should write this one.</strong> It drafted
                      something, but the documents don't settle what the customer is asking.
                      Reject &amp; rewrite — your reply becomes a training pair.
                    </span>
                  </div>
                )}

                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={16}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${edited ? "rgba(245,168,64,0.4)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 10, padding: "0.8rem", fontSize: 12.5, lineHeight: 1.7,
                    color: "var(--text-primary)", fontFamily: "inherit", resize: "vertical",
                    outline: "none",
                  }}
                />

                {edited && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8,
                                fontSize: 11, color: "#f5a840" }}>
                    <Pencil size={12} />
                    You changed the draft. Sending records an <strong>edit pair</strong> —
                    the AI version and yours, both kept as training evidence.
                  </div>
                )}
              </Panel>
            </>
          )}

          {/* ── The decision panels ───────────────────────────────────────
              At column level, not nested inside the draft branch. Close-out,
              Already handled and Escalate all have to be reachable when there
              is NO pending draft — which is most of a ticket's life, and was
              exactly the state with no way out. */}
          {draft && mode === "review" ? (
                <Panel title="Decision"
                       subtitle="Sending is one click. Record what else happened only if something else happened.">
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Btn color={edited ? "#f5a840" : "#22c55e"} disabled={!!busy} onClick={onApprove}>
                      <Send size={13} />
                      {busy === "approve" ? "Sending…" : edited ? "Send with edits" : "Approve & send"}
                    </Btn>
                    <Btn variant="outline" color="#f43f5e" disabled={!!busy} onClick={() => setMode("reject")}>
                      <XCircle size={13} /> Reject & rewrite
                    </Btn>
                    <Btn variant="ghost" disabled={!!busy}
                         onClick={() => run("draft", () => generateDraft(t.id),
                           () => "Regenerated. No correction pair — a regenerate isn't a correction.")}>
                      <RefreshCw size={13} /> {busy === "draft" ? "Regenerating…" : "Regenerate"}
                    </Btn>
                    <span style={{ flex: 1 }} />
                    <Btn variant="ghost" disabled={!!busy} onClick={() => setMode("elsewhere")}
                         title="Resolved outside Mission Control before you got here">
                      <History size={13} /> Already handled
                    </Btn>
                    <Btn variant="ghost" disabled={!!busy} onClick={() => setMode("escalate")}>
                      <ArrowUpRight size={13} /> Escalate
                    </Btn>
                  </div>

                  {/* Collapsed by default. At 20–60 tickets a day a mandatory
                      form per ticket guarantees junk data, so the fast path
                      stays one click and this opens only when it applies. */}
                  <details style={{ marginTop: "0.9rem" }}>
                    <summary style={{
                      cursor: "pointer", fontSize: 11, fontWeight: 700,
                      color: hasResolutionContent(res) ? "#f5a840" : "var(--text-muted)",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <Wrench size={12} />
                      {hasResolutionContent(res)
                        ? `${res.actions.length} action(s) will be recorded with this send`
                        : "Did you also do something? Refund, return sheet, warehouse call…"}
                      {(t.suggestedActions ?? []).length > 0 && !hasResolutionContent(res) && (
                        <Pill color="#a78bfa">
                          <Sparkles size={9} /> {t.suggestedActions.length} suggested
                        </Pill>
                      )}
                    </summary>
                    <div style={{ marginTop: "0.9rem" }}>
                      {vocab === null ? <Loading label="Loading actions" /> : (
                        <>
                          <ResolutionFields
                            value={res} onChange={setRes} vocabulary={vocab}
                            suggested={t.suggestedActions ?? []}
                            showOutcome={false}
                          />
                          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.5rem",
                                        alignItems: "center", flexWrap: "wrap" }}>
                            <AddFollowupRow
                              onAdd={a => setRes(r => ({ ...r, actions: [...r.actions, a] }))} />
                            <span style={{ flex: 1 }} />
                            {hasResolutionContent(res) && (
                              <Btn size="sm" variant="ghost" disabled={!!busy} onClick={onLogOnly}>
                                {busy === "log" ? "Saving…" : "Record without sending"}
                              </Btn>
                            )}
                            <Btn size="sm" color="#22c55e" disabled={!!busy}
                                 onClick={() => setMode("closeout")}>
                              <CheckSquare size={11} /> Close out too
                            </Btn>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                </Panel>
              ) : mode === "closeout" ? (
                <Panel title="Close this ticket out"
                       subtitle="The outcome and the summary are what make this a record rather than a cleared row">
                  {vocab === null ? <Loading label="Loading actions" /> : (
                    <>
                      <ResolutionFields
                        value={res} onChange={setRes} vocabulary={vocab}
                        suggested={t.suggestedActions ?? []}
                        showOutcome outcomeRequired
                      />
                      <div style={{ marginTop: "0.8rem" }}>
                        <AddFollowupRow
                          onAdd={a => setRes(r => ({ ...r, actions: [...r.actions, a] }))} />
                      </div>

                      {openFollowupsAfter() && (
                        <div style={{
                          display: "flex", gap: 7, alignItems: "flex-start", marginTop: "0.9rem",
                          background: "rgba(245,168,64,0.07)", border: "1px solid rgba(245,168,64,0.28)",
                          borderRadius: 9, padding: "0.55rem 0.7rem",
                        }}>
                          <Wrench size={12} color="#f5a840" style={{ marginTop: 1, flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, color: "#f5a840", lineHeight: 1.5 }}>
                            Closing is fine with work still outstanding — the customer is done with,
                            the operation isn't. It stays in the <strong>Follow-up</strong> queue
                            until every task is ticked off.
                          </span>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center",
                                    flexWrap: "wrap", marginTop: "0.9rem" }}>
                        <Btn color="#22c55e" disabled={!!closeProblems.length || !!busy} onClick={onCloseOut}>
                          <CheckSquare size={13} /> {busy === "closeout" ? "Closing…" : "Close ticket"}
                        </Btn>
                        <Btn variant="ghost" onClick={() => setMode("review")}>Cancel</Btn>
                        {closeProblems.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {closeProblems[0]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </Panel>
              ) : mode === "elsewhere" ? (
                <Panel title="Already handled elsewhere"
                       subtitle="For issues resolved off-platform — by phone, by someone else, or before you opened this">
                  {vocab === null ? <Loading label="Loading actions" /> : (
                    <>
                      <div style={{ marginBottom: "0.9rem", fontSize: 11.5,
                                    color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        No email is sent and any pending draft is discarded. Say how it was handled and
                        by whom — “already handled” with no account of how is the same as closing it to
                        clear the queue, and it teaches the agent nothing.
                      </div>
                      <ResolutionFields
                        value={res} onChange={setRes} vocabulary={vocab}
                        suggested={t.suggestedActions ?? []}
                        showOutcome={false}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center",
                                    flexWrap: "wrap", marginTop: "0.9rem" }}>
                        <Btn color="#a78bfa" disabled={res.summary.trim().length < 20 || !!busy}
                             onClick={onHandledElsewhere}>
                          <History size={13} /> {busy === "elsewhere" ? "Saving…" : "Mark already handled"}
                        </Btn>
                        <Btn variant="ghost" onClick={() => setMode("review")}>Cancel</Btn>
                        {res.summary.trim().length < 20 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            The summary needs {20 - res.summary.trim().length} more character(s).
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </Panel>
              ) : mode === "escalate" ? (
                <Panel title="Escalate"
                       subtitle="Name an owner and this becomes a tracked follow-up, not a note nobody sees">
                  <label style={labelStyle}>Why? <span style={{ color: "#f43f5e" }}>*</span></label>
                  <textarea
                    value={escNote} onChange={e => setEscNote(e.target.value)} rows={3}
                    placeholder="What does the next person need to know to pick this up?"
                    style={fieldStyle}
                  />
                  <div style={{ marginTop: "0.7rem" }}>
                    <label style={labelStyle}>Who's picking it up?</label>
                    <input
                      value={escOwner} onChange={e => setEscOwner(e.target.value)}
                      placeholder="Name or team — leave blank and nothing will track it"
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center",
                                flexWrap: "wrap", marginTop: "0.9rem" }}>
                    <Btn color="#f43f5e" disabled={escNote.trim().length < 10 || !!busy} onClick={onEscalate}>
                      <ArrowUpRight size={13} /> {busy === "escalate" ? "Escalating…" : "Escalate"}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setMode("review")}>Cancel</Btn>
                    {escNote.trim().length < 10 && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Say why — at least 10 characters.
                      </span>
                    )}
                  </div>
                </Panel>
              ) : draft && mode === "reject" ? (
                <Panel title="Reject & rewrite"
                       subtitle="One form, one submit — a rejection without your replacement is a training pair with half of it missing">
                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={labelStyle}>What was wrong? <span style={{ color: "#f43f5e" }}>*</span></label>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {REASON_CODES.map(rc => (
                        <Pill key={rc} color="#f43f5e" active={reason === rc} onClick={() => setReason(rc)}>
                          {REASON_LABELS[rc]}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={labelStyle}>
                      What should it have done? <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <textarea
                      value={note} onChange={e => setNote(e.target.value)} rows={2}
                      placeholder="The reason code says which bucket. This says what the agent should have known — it's the actual training signal."
                      style={fieldStyle}
                    />
                    <div style={{ fontSize: 10, marginTop: 4,
                                  color: note.trim().length >= 15 ? "var(--text-dim)" : "#f5a840" }}>
                      {note.trim().length}/15 characters minimum
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={labelStyle}>
                      Your reply — this is what gets sent <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <textarea
                      value={rewrite} onChange={e => setRewrite(e.target.value)} rows={10}
                      placeholder="Write the email you'd actually send…"
                      style={fieldStyle}
                    />
                  </div>

                  {/* A rejection is very often a denial. Recording that here means
                      "we answered them and said no" is a stored outcome rather
                      than something only inferable from reading the email. */}
                  {vocab && (
                    <details style={{ marginBottom: "0.9rem" }}>
                      <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700,
                                        color: hasResolutionContent(res) ? "#f5a840" : "var(--text-muted)",
                                        display: "flex", alignItems: "center", gap: 6 }}>
                        <Wrench size={12} />
                        {hasResolutionContent(res)
                          ? `${res.actions.length} action(s) and the outcome will be recorded`
                          : "Record the outcome and anything you did (optional)"}
                      </summary>
                      <div style={{ marginTop: "0.8rem" }}>
                        <ResolutionFields
                          value={res} onChange={setRes} vocabulary={vocab}
                          suggested={t.suggestedActions ?? []}
                          showOutcome
                        />
                      </div>
                    </details>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <Btn color="#f43f5e" disabled={!canReject || !!busy} onClick={onReject}>
                      <Send size={13} /> {busy === "reject" ? "Sending…" : "Send mine & store the pair"}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setMode("review")}>Cancel</Btn>
                    {!canReject && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        All three fields are required.
                      </span>
                    )}
                  </div>
                </Panel>
              ) : null}

          {/* ── What was actually done ───────────────────────────────────── */}
          <Panel title="Actions & follow-ups" pad={false}
                 right={openFollowups.length > 0
                   ? <Pill color="#f5a840"><Wrench size={9} /> {openFollowups.length} open</Pill>
                   : undefined}>
            <ActionLog
              actions={t.actions ?? []}
              busy={busy}
              onComplete={aid => run(aid, () => completeAction(aid), () => "Marked done.")}
            />
          </Panel>
        </div>

        {/* ── Pane 3: context ──────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <Panel title="Customer">
            <Row k="Name"      v={t.customer_name || "—"} />
            <Row k="Email"     v={t.customer_email || "—"} />
            <Row k="Category"  v={t.category?.label ?? "Unclassified"} />
            <Row k="Sentiment" v={t.sentiment} />
            <Row k="Priority"  v={t.priority} />
            {(t.tags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                {t.tags.map((tag: string) => <Pill key={tag} color="#a78bfa">{tag}</Pill>)}
              </div>
            )}
          </Panel>

          {t.shopify_order_id && (
            <Panel title="Linked order" right={<ShoppingBag size={13} color="var(--text-muted)" />}>
              <Row k="Order" v={t.shopify_order_id} mono />
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                A snapshot of what the agent saw is stored with the draft — order data changes,
                and six weeks later you can't reconstruct why it said what it said.
              </div>
            </Panel>
          )}

          <Panel title="Docs the draft used" pad={false}>
            {!(t.citedDocs ?? []).length ? (
              <div style={{ padding: "1rem", fontSize: 11.5, color: "var(--text-muted)" }}>
                No documents cited. If the knowledge base is empty, that's why — and it's also why
                confidence will be low.
              </div>
            ) : t.citedDocs.map((d: any, i: number) => (
              <Link key={d.id} href="/support/docs" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ padding: "0.65rem 1rem",
                              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{d.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                    <Pill color={d.kind === "learned" ? "#a78bfa" : d.kind === "voice" ? "#f5a840" : "#4a9eff"}>
                      {d.kind}
                    </Pill>
                    <Pill>v{d.version}</Pill>
                  </div>
                </div>
              </Link>
            ))}
            <div style={{ padding: "0.7rem 1rem", borderTop: "1px solid rgba(255,255,255,0.04)",
                          display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={12} color="var(--text-dim)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                When a draft is wrong, this tells you whether it followed a bad doc or ignored
                a good one. Completely different fixes.
              </span>
            </div>
          </Panel>

          {(t.exemplars ?? []).length > 0 && (
            <Panel title="Past lessons in this draft" pad={false}>
              {t.exemplars.map((c: any, i: number) => (
                <Link key={c.id} href="/support/learning" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ padding: "0.65rem 1rem",
                                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <History size={11} color="#a78bfa" />
                      <Pill color="#a78bfa">{REASON_LABELS[c.reason_code] ?? c.reason_code}</Pill>
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text-muted)" }}>
                      {c.reason_note}
                    </div>
                  </div>
                </Link>
              ))}
              <div style={{ padding: "0.7rem 1rem", borderTop: "1px solid rgba(255,255,255,0.04)",
                            display: "flex", gap: 7, alignItems: "flex-start" }}>
                <Sparkles size={12} color="var(--text-dim)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  Corrections you made before, fed into this draft as exemplars. Check whether it
                  actually applied them — that's the loop working or not working.
                </span>
              </div>
            </Panel>
          )}

          {t.history && (
            <Panel title="Customer history">
              <Row k="Prior tickets"    v={String(t.history.priorTickets)} />
              <Row k="Drafts corrected" v={String(t.history.priorCorrections)} />
              <Row k="First seen"       v={new Date(t.history.firstSeen).toLocaleDateString("en-US",
                                            { month: "short", year: "numeric" })} />
            </Panel>
          )}

          {/* Append-only. Nothing here overwrites anything — a re-close records a
              second outcome_set rather than editing the first. */}
          <Panel title="Timeline" pad={false} right={<Clock size={13} color="var(--text-muted)" />}>
            <Timeline events={t.events ?? []} />
          </Panel>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--text-muted)", display: "block", marginBottom: 7,
};

const fieldStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
  padding: "0.6rem 0.7rem", fontSize: 12.5, lineHeight: 1.65,
  color: "var(--text-primary)", fontFamily: "inherit", resize: "vertical", outline: "none",
};

function Stat({ label, value, hint, color = "var(--text-primary)" }: {
  label: string; value: string; hint?: string; color?: string;
}) {
  return (
    <div title={hint} style={{ background: "var(--bg-darker)", padding: "0.6rem 0.75rem" }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "0.25rem 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: "right",
                     fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
                     textTransform: mono ? "none" : "capitalize" }}>{v}</span>
    </div>
  );
}
