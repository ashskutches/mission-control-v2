"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Send, XCircle, RefreshCw, ArrowUpRight, Bot, User, FileText,
  ShoppingBag, Sparkles, AlertTriangle, Info, CheckCircle2, Pencil,
} from "lucide-react";
import {
  SampleBanner, Panel, Pill, Btn, Confidence, Empty, fmtDate, ago,
  STATUS_COLOR, STATUS_LABEL, SUPPORT_ACCENT,
} from "../../ui";
import { TICKETS, DOCS, categoryLabel } from "../../fixtures";
import { REASON_LABELS } from "../../types";
import type { ReasonCode } from "../../types";

const REASON_CODES = Object.keys(REASON_LABELS) as ReasonCode[];

export default function ApprovalInterface() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const ticket = TICKETS.find(t => t.id === id);

  const [body, setBody]       = useState(ticket?.draft?.body ?? "");
  const [mode, setMode]       = useState<"review" | "reject">("review");
  const [reason, setReason]   = useState<ReasonCode | null>(null);
  const [note, setNote]       = useState("");
  const [rewrite, setRewrite] = useState("");
  const [done, setDone]       = useState<string | null>(null);

  const edited = !!ticket?.draft && body.trim() !== ticket.draft.body.trim();
  const canReject = !!reason && note.trim().length >= 15 && rewrite.trim().length >= 20;

  const citedDocs = useMemo(
    () => DOCS.filter(d => ticket?.draft?.citedDocIds.includes(d.id)),
    [ticket],
  );

  if (!ticket) {
    return <Empty icon={AlertTriangle} title="Ticket not found" body="This ticket doesn't exist in the sample set." />;
  }

  return (
    <>
      <SampleBanner />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem",
                    flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link href="/support/inbox" style={{ textDecoration: "none" }}>
          <Btn variant="ghost" size="sm"><ArrowLeft size={12} /> Queue</Btn>
        </Link>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)",
                       fontFamily: "'JetBrains Mono', monospace" }}>{ticket.ref}</span>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>{ticket.subject}</h2>
        <Pill color={STATUS_COLOR[ticket.status]} solid>{STATUS_LABEL[ticket.status]}</Pill>
        {ticket.status === "awaiting_approval" && (
          <Pill color={ticket.awaitingMinutes > 60 ? "#f43f5e" : "#6b7280"}>
            waiting {ago(ticket.awaitingMinutes)}
          </Pill>
        )}
      </div>

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

      <div style={{ display: "grid", gap: "0.9rem",
                    gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 1.5fr) minmax(230px, 0.85fr)",
                    alignItems: "start" }}>

        {/* ── Pane 1: the conversation ─────────────────────────────────── */}
        <Panel title="Conversation" subtitle={`${ticket.customerName} · ${ticket.customerEmail}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {ticket.messages.map(msg => {
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
                      {inbound ? ticket.customerName : msg.author === "ai" ? "AI (sent)" : "Human"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{fmtDate(msg.sentAt)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                                color: "var(--text-secondary)" }}>
                    {msg.body}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── Pane 2: the draft and the decision ───────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {!ticket.draft ? (
            <Panel title="No draft">
              <Empty icon={Bot} title="Nothing was drafted for this ticket"
                     body={ticket.status === "escalated"
                       ? "It was routed straight to a human. Wholesale enquiries have no reference doc behind them, so the agent escalated rather than guessing."
                       : "This ticket is closed."} />
            </Panel>
          ) : (
            <>
              <Panel
                title="AI draft"
                subtitle={`${ticket.draft.model} · ${fmtDate(ticket.draft.generatedAt)}`}
                right={<Confidence value={ticket.draft.confidence} />}
              >
                {/* Why it wrote this — visible by default, not behind a toggle.
                    A reviewer who can't see the reasoning can only check the prose. */}
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
                    {ticket.draft.reasoning}
                  </div>
                </div>

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

              {/* Decision */}
              {mode === "review" ? (
                <Panel title="Decision">
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Btn color={edited ? "#f5a840" : "#22c55e"}
                         onClick={() => setDone(edited
                           ? "Sent with edits. Correction pair recorded (kind: edited_on_approve)."
                           : "Approved and sent. Counted as a clean approval.")}>
                      <Send size={13} /> {edited ? "Send with edits" : "Approve & send"}
                    </Btn>
                    <Btn variant="outline" color="#f43f5e" onClick={() => setMode("reject")}>
                      <XCircle size={13} /> Reject & rewrite
                    </Btn>
                    <Btn variant="ghost" onClick={() => setDone("Regenerated. No correction pair — a regenerate isn't a correction.")}>
                      <RefreshCw size={13} /> Regenerate
                    </Btn>
                    <Btn variant="ghost" onClick={() => setDone("Escalated. No email sent.")}>
                      <ArrowUpRight size={13} /> Escalate
                    </Btn>
                  </div>
                </Panel>
              ) : (
                <Panel title="Reject & rewrite"
                       subtitle="One form, one submit — a rejection without your replacement is a training pair with half of it missing">
                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                    letterSpacing: "0.08em", color: "var(--text-muted)",
                                    display: "block", marginBottom: 7 }}>
                      What was wrong? <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {REASON_CODES.map(rc => (
                        <Pill key={rc} color="#f43f5e" active={reason === rc} onClick={() => setReason(rc)}>
                          {REASON_LABELS[rc]}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                    letterSpacing: "0.08em", color: "var(--text-muted)",
                                    display: "block", marginBottom: 7 }}>
                      What should it have done? <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <textarea
                      value={note} onChange={e => setNote(e.target.value)} rows={2}
                      placeholder="The reason code says which bucket. This says what the agent should have known — it's the actual training signal."
                      style={fieldStyle}
                    />
                    <div style={{ fontSize: 10, color: note.trim().length >= 15 ? "var(--text-dim)" : "#f5a840",
                                  marginTop: 4 }}>
                      {note.trim().length}/15 characters minimum
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.9rem" }}>
                    <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                    letterSpacing: "0.08em", color: "var(--text-muted)",
                                    display: "block", marginBottom: 7 }}>
                      Your reply — this is what gets sent <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <textarea
                      value={rewrite} onChange={e => setRewrite(e.target.value)} rows={10}
                      placeholder="Write the email you'd actually send…"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <Btn color="#f43f5e" disabled={!canReject}
                         onClick={() => { setDone("Rejected. Your reply was sent and the training pair was stored."); setMode("review"); }}>
                      <Send size={13} /> Send mine & store the pair
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
            <Row k="Name"      v={ticket.customerName} />
            <Row k="Email"     v={ticket.customerEmail} />
            <Row k="Category"  v={categoryLabel(ticket.category)} />
            <Row k="Sentiment" v={ticket.sentiment} />
            <Row k="Priority"  v={ticket.priority} />
            {ticket.tags.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                {ticket.tags.map(t => <Pill key={t} color="#a78bfa">{t}</Pill>)}
              </div>
            )}
          </Panel>

          {ticket.orderRef && (
            <Panel title="Linked order" right={<ShoppingBag size={13} color="var(--text-muted)" />}>
              <Row k="Order"   v={ticket.orderRef} mono />
              <Row k="Status"  v="Fulfilled" />
              <Row k="Placed"  v="Jul 28, 2026" />
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                A snapshot of what the agent saw is stored with the draft — order data changes,
                and six weeks later you can't reconstruct why it said what it said.
              </div>
            </Panel>
          )}

          <Panel title="Docs the draft used" pad={false}>
            {citedDocs.length === 0 ? (
              <div style={{ padding: "1rem", fontSize: 11.5, color: "var(--text-muted)" }}>
                No documents cited.
              </div>
            ) : citedDocs.map((d, i) => (
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
        </div>
      </div>
    </>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
  padding: "0.6rem 0.7rem", fontSize: 12.5, lineHeight: 1.65,
  color: "var(--text-primary)", fontFamily: "inherit", resize: "vertical", outline: "none",
};

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
