"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Send, XCircle, RefreshCw, ArrowUpRight, Bot, User, FileText,
  ShoppingBag, Sparkles, AlertTriangle, Info, CheckCircle2, Pencil, History,
} from "lucide-react";
import {
  Panel, Pill, Btn, Confidence, Empty, ago, Loading, ErrorBox,
  STATUS_COLOR, STATUS_LABEL, SUPPORT_ACCENT,
} from "../../ui";
import {
  getTicket, approveTicket, rejectTicket, escalateTicket, generateDraft,
  REASON_LABELS, REASON_CODES,
} from "../../api";

export default function ApprovalInterface() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [body, setBody]       = useState("");
  const [mode, setMode]       = useState<"review" | "reject">("review");
  const [reason, setReason]   = useState<string | null>(null);
  const [note, setNote]       = useState("");
  const [rewrite, setRewrite] = useState("");

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

  if (err && !t) return <ErrorBox error={err} onRetry={load} />;
  if (!t) return <Loading label="Loading ticket" />;

  const draft = t.draft && t.draft.status === "pending" ? t.draft : null;
  const edited = !!draft && body.trim() !== String(draft.body).trim();
  const canReject = !!reason && note.trim().length >= 15 && rewrite.trim().length >= 20;

  const run = async (key: string, fn: () => Promise<any>, after?: (r: any) => string) => {
    setBusy(key); setErr(null); setDone(null);
    try {
      const r = await fn();
      setDone(after ? after(r) : "Done.");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const onApprove = () => run("approve",
    () => approveTicket(t.id, { body }),
    r => r.edited
      ? "Sent with your edits. Correction pair recorded as edited_on_approve."
      : "Approved and sent. Counted as a clean approval.");

  const onReject = () => run("reject",
    () => rejectTicket(t.id, {
      reasonCode: reason!, reasonNote: note, humanBody: rewrite,
      severity: reason === "policy_violation" || reason === "wrong_facts" ? 4 : 3,
    }),
    r => {
      setMode("review"); setReason(null); setNote(""); setRewrite("");
      return r.sendError
        ? `Training pair stored, but nothing was sent: ${r.sendError}`
        : "Your reply was sent and the training pair was stored.";
    });

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
        {t.status === "awaiting_approval" && (
          <Pill color={t.awaitingMinutes > 60 ? "#f43f5e" : "#6b7280"}>
            waiting {ago(t.awaitingMinutes)}
          </Pill>
        )}
      </div>

      {err && <ErrorBox error={err} />}
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
              return (
                <div key={msg.id} style={{
                  background: inbound ? "rgba(255,255,255,0.03)" : "rgba(0,201,215,0.06)",
                  border: `1px solid ${inbound ? "rgba(255,255,255,0.06)" : "rgba(0,201,215,0.2)"}`,
                  borderRadius: 10, padding: "0.7rem 0.8rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    {inbound ? <User size={11} color="var(--text-muted)" />
                             : msg.author === "ai" ? <Bot size={11} color={SUPPORT_ACCENT} />
                             : <User size={11} color={SUPPORT_ACCENT} />}
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                   letterSpacing: "0.06em",
                                   color: inbound ? "var(--text-muted)" : SUPPORT_ACCENT }}>
                      {inbound ? (t.customer_name || "Customer")
                               : msg.author === "ai" ? "AI (sent)" : "Human"}
                    </span>
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
            <Panel title="No draft">
              <Empty icon={Bot} title="Nothing is waiting for approval"
                     body={t.status === "needs_human_only"
                       ? "The classifier routed this straight to a human — it needs authority the agent doesn't have."
                       : t.status === "escalated" ? "This was escalated."
                       : t.status === "sent" ? "A reply has already been sent."
                       : "No pending draft."} />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
                <Btn variant="outline" color={SUPPORT_ACCENT} disabled={busy === "draft"}
                     onClick={() => run("draft", () => generateDraft(t.id), () => "Draft generated.")}>
                  <RefreshCw size={13} /> {busy === "draft" ? "Drafting…" : "Draft a reply"}
                </Btn>
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
                      The agent flagged this for escalation — it wrote a reply but doesn't think it
                      should be the one answering.
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

              {mode === "review" ? (
                <Panel title="Decision">
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
                    <Btn variant="ghost" disabled={!!busy}
                         onClick={() => run("escalate", () => escalateTicket(t.id),
                           () => "Escalated. No email sent.")}>
                      <ArrowUpRight size={13} /> Escalate
                    </Btn>
                  </div>
                </Panel>
              ) : (
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
              )}
            </>
          )}
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
