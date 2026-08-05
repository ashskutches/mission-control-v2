"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  HelpCircle, Lightbulb, FileDiff, Tag, Bot, User, Check, X, Brain,
  ChevronDown, ChevronRight, ArrowRight, Clock,
} from "lucide-react";
import {
  Panel, Pill, Btn, Empty, SUPPORT_ACCENT, Loading, ErrorBox,
} from "../ui";
import {
  getObservations, getCorrections, getMetrics, runReflection,
  acceptObservation, dismissObservation, answerObservation, REASON_LABELS,
} from "../api";

const KIND_META: Record<string, { label: string; color: string; icon: any }> = {
  question:          { label: "Question",          color: "#a78bfa",      icon: HelpCircle },
  observation:       { label: "Observation",       color: SUPPORT_ACCENT, icon: Lightbulb },
  doc_proposal:      { label: "Doc proposal",      color: "#f5a840",      icon: FileDiff },
  category_proposal: { label: "Category proposal", color: "#f5a840",      icon: Tag },
};

const SEVERITY_COLOR = ["#6b7280", "#6b7280", "#4a9eff", "#f5a840", "#f5a840", "#f43f5e"];

export default function LearningPage() {
  const [tab, setTab] = useState<"observations" | "pairs">("observations");
  const [obs, setObs] = useState<any[] | null>(null);
  const [pairs, setPairs] = useState<any[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [o, c, m] = await Promise.all([getObservations(), getCorrections(), getMetrics(30)]);
      setObs(o); setPairs(c); setMeta(m);
    } catch (e: any) { setErr(e.message); setObs([]); setPairs([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reflect = async () => {
    setBusy(true); setNote(null); setErr(null);
    try {
      const r = await runReflection();
      setNote(r.skipped ? `Nothing to reflect on — ${r.skipped}.` : `Done: ${r.created} new items.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err && obs === null) return <ErrorBox error={err} onRetry={load} />;
  if (obs === null || pairs === null) return <Loading label="Loading" />;

  const questions = obs.filter(o => o.kind === "question" && o.status === "open");
  const rest      = obs.filter(o => !(o.kind === "question" && o.status === "open"));

  return (
    <>
      {err && <ErrorBox error={err} onRetry={load} />}
      {note && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 10, padding: "0.6rem 0.9rem", marginBottom: "1rem",
                      fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{note}</div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
        background: "var(--bg-darker)", border: "1px solid var(--glass-border)",
        borderRadius: 12, padding: "0.75rem 1.1rem", marginBottom: "1rem",
      }}>
        <Brain size={16} color={SUPPORT_ACCENT} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {meta?.lastReflection
              ? `Last reflection ${new Date(meta.lastReflection.started_at).toLocaleString("en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "Never reflected"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Runs on demand, or automatically once 8 corrections pile up
            {meta?.lastReflection
              ? ` · read ${meta.lastReflection.corrections_considered} corrections · cost $${(Number(meta.lastReflection.cost_cents ?? 0) / 100).toFixed(2)}`
              : ""}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {meta?.unreflectedCount > 0 && (
          <Pill color="#f5a840" solid><Clock size={9} /> {meta.unreflectedCount} pending</Pill>
        )}
        <Btn variant="outline" color={SUPPORT_ACCENT} size="sm" onClick={reflect}
             disabled={busy || !meta?.unreflectedCount}
             title={!meta?.unreflectedCount ? "Nothing new to reflect on" : ""}>
          <Brain size={12} /> {busy ? "Reflecting…" : "Reflect now"}
        </Btn>
      </div>

      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem" }}>
        <Pill color={SUPPORT_ACCENT} active={tab === "observations"} onClick={() => setTab("observations")}>
          What it learned ({obs.length})
        </Pill>
        <Pill color="#f5a840" active={tab === "pairs"} onClick={() => setTab("pairs")}>
          Training pairs ({pairs.length})
        </Pill>
      </div>

      {tab === "observations" ? (
        obs.length === 0 ? (
          <Panel>
            <Empty icon={Brain} title="Nothing learned yet"
                   body="The agent reflects on corrections you make when reviewing drafts. Reject or edit a draft, then run a reflection — an observation it can't tie to a real correction is refused, so there's nothing to show until then." />
          </Panel>
        ) : (
          <>
            {questions.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <SectionHead icon={HelpCircle} color="#a78bfa" title="It's confused — answer these"
                  sub="An honest question beats a confident wrong answer. Answering one folds it into a reference doc, so it reaches the next draft." />
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {questions.map(o => <ObservationCard key={o.id} o={o} onChange={load} />)}
                </div>
              </div>
            )}

            <SectionHead icon={Lightbulb} color={SUPPORT_ACCENT} title="Observations & proposals"
              sub="Every one cites the corrections it came from. An observation with no evidence is refused at write time." />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {rest.map(o => <ObservationCard key={o.id} o={o} onChange={load} />)}
            </div>
          </>
        )
      ) : (
        pairs.length === 0 ? (
          <Panel>
            <Empty icon={Bot} title="No training pairs yet"
                   body="A pair is created every time you reject a draft, and every time you edit one before sending. They're the corpus the agent reflects on and the exemplars fed into the next draft." />
          </Panel>
        ) : (
          <>
            <SectionHead icon={Bot} color="#f5a840" title="Training pairs"
              sub="What the AI wrote, what you sent, and why. This is the corpus the agent reflects on — and the exemplars that go into the next draft prompt." />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pairs.map(c => <PairCard key={c.id} c={c} />)}
            </div>
          </>
        )
      )}
    </>
  );
}

function SectionHead({ icon: Icon, color, title, sub }: any) {
  return (
    <div style={{ marginBottom: "0.7rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
                       textTransform: "uppercase", color }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4,
                            maxWidth: 720, lineHeight: 1.55 }}>{sub}</div>}
    </div>
  );
}

function ObservationCard({ o, onChange }: { o: any; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const meta = KIND_META[o.kind] ?? KIND_META.observation;
  const Icon = meta.icon;

  const act = async (fn: () => Promise<any>, pick: (r: any) => string) => {
    setBusy(true); setErr(null);
    try { setResult(pick(await fn())); onChange(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      background: "var(--bg-darker)",
      border: `1px solid ${o.kind === "question" && o.status === "open"
        ? "rgba(167,139,250,0.28)" : "var(--glass-border)"}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "0.9rem 1.1rem" }}>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
          <Icon size={15} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{o.title}</div>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: 7 }}>
              <Pill color={meta.color} solid>{meta.label}</Pill>
              <Pill color="#f5a840">{o.evidence_count} correction{o.evidence_count === 1 ? "" : "s"}</Pill>
              <Pill>{Math.round(Number(o.confidence) * 100)}% confident</Pill>
              <Pill>{String(o.topic).replace(/_/g, " ")}</Pill>
              {o.status === "accepted" && <Pill color="#22c55e" solid><Check size={9} /> Accepted</Pill>}
              {o.status === "answered" && <Pill color="#22c55e" solid><Check size={9} /> Answered</Pill>}
              {o.status === "dismissed" && <Pill>Dismissed</Pill>}
            </div>
          </div>
          <button onClick={() => setOpen(!open)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 2, flexShrink: 0,
          }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {open && (
          <div style={{ marginTop: "0.8rem", paddingLeft: "1.55rem" }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)",
                          whiteSpace: "pre-wrap" }}>{o.body}</div>

            {o.answer && (
              <div style={{ marginTop: "0.8rem", background: "rgba(34,197,94,0.05)",
                            border: "1px solid rgba(34,197,94,0.2)", borderRadius: 9,
                            padding: "0.6rem 0.75rem" }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "0.07em", color: "#22c55e", marginBottom: 4 }}>
                  Answered by {o.answered_by ?? "a human"}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>{o.answer}</div>
              </div>
            )}

            {o.proposed_doc_diff && (
              <div style={{ marginTop: "0.9rem" }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "0.08em", color: "#f5a840", marginBottom: 6 }}>
                  Proposed change to “{o.proposed_doc_title ?? "a document"}”
                </div>
                <pre style={{
                  background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 8, padding: "0.7rem 0.8rem", fontSize: 11.5, lineHeight: 1.65,
                  color: "#86efac", overflowX: "auto", whiteSpace: "pre-wrap",
                  fontFamily: "'JetBrains Mono', monospace", margin: 0,
                }}>{o.proposed_doc_diff}</pre>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
                  Proposals never auto-apply. The agent cannot edit a reference doc — only suggest.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.05)", padding: "0.7rem 1.1rem",
        background: "rgba(255,255,255,0.015)",
      }}>
        {err && <div style={{ fontSize: 11.5, color: "#f43f5e", marginBottom: 8 }}>{err}</div>}
        {result ? (
          <span style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600,
                         display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={13} /> {result}
          </span>
        ) : o.status !== "open" ? (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {o.status === "answered" ? "Answered" : o.status === "accepted" ? "Accepted" : "Dismissed"}
            {o.resulted_in_version ? ` · document now at v${o.resulted_in_version}` : ""}
          </span>
        ) : o.kind === "question" ? (
          <div>
            <textarea
              value={answer} onChange={e => setAnswer(e.target.value)} rows={2}
              placeholder="Answer it. Your answer gets folded into the reference doc, so the next draft actually sees it."
              style={{
                width: "100%", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
                padding: "0.55rem 0.7rem", fontSize: 12, lineHeight: 1.6,
                color: "var(--text-primary)", fontFamily: "inherit",
                resize: "vertical", outline: "none", marginBottom: "0.6rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
              <Btn size="sm" color="#a78bfa" disabled={answer.trim().length < 5 || busy}
                   onClick={() => act(() => answerObservation(o.id, answer), r => r.note)}>
                <ArrowRight size={12} /> {busy ? "Saving…" : "Answer & update doc"}
              </Btn>
              <Btn size="sm" variant="ghost" disabled={busy}
                   onClick={() => act(() => dismissObservation(o.id), () => "Dismissed.")}>
                <X size={12} /> Dismiss
              </Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <Btn size="sm" color="#22c55e" variant="outline" disabled={busy}
                 onClick={() => act(() => acceptObservation(o.id), r => r.note)}>
              <Check size={12} /> {busy ? "Applying…" : "Accept"}
            </Btn>
            <Btn size="sm" variant="ghost" disabled={busy}
                 onClick={() => act(() => dismissObservation(o.id), () => "Dismissed.")}>
              <X size={12} /> Dismiss
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function PairCard({ c }: { c: any }) {
  const [open, setOpen] = useState(false);
  const sev = Math.min(Math.max(Number(c.severity ?? 3), 1), 5);
  return (
    <div style={{
      background: "var(--bg-darker)", border: "1px solid var(--glass-border)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: "0.8rem 1.1rem", cursor: "pointer",
        display: "flex", alignItems: "center", gap: "0.7rem",
      }}>
        <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2,
                      background: SEVERITY_COLOR[sev], minHeight: 30 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
            {c.reason_note?.slice(0, 110) ?? "(no note)"}
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <Pill color={c.kind === "rejected" ? "#f43f5e" : "#f5a840"} solid>
              {c.kind === "rejected" ? "Rejected" : "Edited on approve"}
            </Pill>
            <Pill color={SEVERITY_COLOR[sev]}>severity {sev}</Pill>
            <Pill>{REASON_LABELS[c.reason_code] ?? c.reason_code}</Pill>
            {c.category_slug && <Pill>{c.category_slug}</Pill>}
            {!c.reflected_at && <Pill color="#f5a840"><Clock size={9} /> not yet reflected</Pill>}
          </div>
        </div>
        {open ? <ChevronDown size={16} color="var(--text-muted)" />
              : <ChevronRight size={16} color="var(--text-muted)" />}
      </div>

      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "1rem 1.1rem" }}>
          <div style={{
            background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.2)",
            borderRadius: 9, padding: "0.65rem 0.8rem", marginBottom: "0.9rem",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                          letterSpacing: "0.07em", color: "#f43f5e", marginBottom: 4 }}>
              Why — {c.created_by ?? "human"}
              {c.diff_summary ? ` · ${c.diff_summary}` : ""}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {c.reason_note}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.8rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <Side title="AI wrote"   icon={Bot}  color="#f43f5e" body={c.ai_body} />
            <Side title="Human sent" icon={User} color="#22c55e" body={c.human_body} />
          </div>
        </div>
      )}
    </div>
  );
}

function Side({ title, icon: Icon, color, body }: any) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                       letterSpacing: "0.07em", color }}>{title}</span>
      </div>
      <div style={{
        background: "rgba(255,255,255,0.025)", border: `1px solid ${color}22`,
        borderRadius: 9, padding: "0.7rem 0.8rem", fontSize: 12, lineHeight: 1.7,
        color: "var(--text-secondary)", whiteSpace: "pre-wrap",
      }}>{body}</div>
    </div>
  );
}
