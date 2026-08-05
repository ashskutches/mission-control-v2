"use client";
import React, { useState } from "react";
import {
  HelpCircle, Lightbulb, FileDiff, Tag, Bot, User, Check, X, Brain,
  ChevronDown, ChevronRight, ArrowRight, Clock,
} from "lucide-react";
import {
  SampleBanner, Panel, Pill, Btn, Empty, fmtDate, SUPPORT_ACCENT,
} from "../ui";
import {
  OBSERVATIONS, CORRECTIONS, LAST_REFLECTION, UNREFLECTED_COUNT, categoryLabel,
} from "../fixtures";
import { REASON_LABELS } from "../types";
import type { Observation } from "../types";

const KIND_META: Record<string, { label: string; color: string; icon: any }> = {
  question:          { label: "Question",          color: "#a78bfa", icon: HelpCircle },
  observation:       { label: "Observation",       color: SUPPORT_ACCENT, icon: Lightbulb },
  doc_proposal:      { label: "Doc proposal",      color: "#f5a840", icon: FileDiff },
  category_proposal: { label: "Category proposal", color: "#f5a840", icon: Tag },
};

const SEVERITY_COLOR = ["#6b7280", "#6b7280", "#4a9eff", "#f5a840", "#f5a840", "#f43f5e"];

export default function LearningPage() {
  const [tab, setTab] = useState<"observations" | "pairs">("observations");

  // Questions first. Answering one is the highest-value action in the whole app —
  // it's the only thing here that removes a blocker rather than describing one.
  const questions   = OBSERVATIONS.filter(o => o.kind === "question" && o.status === "open");
  const rest        = OBSERVATIONS.filter(o => !(o.kind === "question" && o.status === "open"));

  return (
    <>
      <SampleBanner />

      {/* Reflection status strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
        background: "var(--bg-darker)", border: "1px solid var(--glass-border)",
        borderRadius: 12, padding: "0.75rem 1.1rem", marginBottom: "1rem",
      }}>
        <Brain size={16} color={SUPPORT_ACCENT} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Last reflection {fmtDate(LAST_REFLECTION.finishedAt)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Nightly at 2am, or early when {8} corrections pile up · read{" "}
            {LAST_REFLECTION.correctionsConsidered} corrections · cost ${(LAST_REFLECTION.costCents / 100).toFixed(2)}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {UNREFLECTED_COUNT > 0 && (
          <Pill color="#f5a840" solid><Clock size={9} /> {UNREFLECTED_COUNT} pending</Pill>
        )}
        <Btn variant="outline" color={SUPPORT_ACCENT} size="sm"><Brain size={12} /> Reflect now</Btn>
      </div>

      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem" }}>
        <Pill color={SUPPORT_ACCENT} active={tab === "observations"} onClick={() => setTab("observations")}>
          What it learned ({OBSERVATIONS.length})
        </Pill>
        <Pill color="#f5a840" active={tab === "pairs"} onClick={() => setTab("pairs")}>
          Training pairs ({CORRECTIONS.length})
        </Pill>
      </div>

      {tab === "observations" ? (
        <>
          {questions.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <SectionHead
                icon={HelpCircle} color="#a78bfa" title="It's confused — answer these"
                sub="An honest question beats a confident wrong answer. Answering one writes into a reference doc, so it reaches the next draft." />
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {questions.map(o => <ObservationCard key={o.id} o={o} />)}
              </div>
            </div>
          )}

          <SectionHead icon={Lightbulb} color={SUPPORT_ACCENT} title="Observations & proposals"
                       sub="Every one cites the corrections it came from. An observation with no evidence is rejected at write time." />
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {rest.map(o => <ObservationCard key={o.id} o={o} />)}
          </div>
        </>
      ) : (
        <>
          <SectionHead icon={Bot} color="#f5a840" title="Training pairs"
                       sub="What the AI wrote, what the human sent, and why. This is the corpus the agent reflects on — and the exemplars that go into the next draft prompt." />
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {CORRECTIONS.map(c => <PairCard key={c.id} c={c} />)}
          </div>
        </>
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

function ObservationCard({ o }: { o: Observation }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const meta = KIND_META[o.kind];
  const Icon = meta.icon;

  return (
    <div style={{
      background: "var(--bg-darker)",
      border: `1px solid ${o.kind === "question" ? "rgba(167,139,250,0.28)" : "var(--glass-border)"}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "0.9rem 1.1rem" }}>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
          <Icon size={15} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{o.title}</div>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: 7 }}>
              <Pill color={meta.color} solid>{meta.label}</Pill>
              <Pill color="#f5a840">{o.evidenceCount} corrections</Pill>
              <Pill>{Math.round(o.confidence * 100)}% confident</Pill>
              <Pill>{o.topic.replace(/_/g, " ")}</Pill>
              {o.status === "accepted" && <Pill color="#22c55e" solid><Check size={9} /> Accepted</Pill>}
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

            {o.proposedDocDiff && (
              <div style={{ marginTop: "0.9rem" }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "0.08em", color: "#f5a840", marginBottom: 6 }}>
                  Proposed change to “{o.proposedDocTitle}”
                </div>
                <pre style={{
                  background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 8, padding: "0.7rem 0.8rem", fontSize: 11.5, lineHeight: 1.65,
                  color: "#86efac", overflowX: "auto", whiteSpace: "pre-wrap",
                  fontFamily: "'JetBrains Mono', monospace", margin: 0,
                }}>{o.proposedDocDiff}</pre>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
                  Proposals never auto-apply. The agent cannot edit a reference doc — only suggest.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.05)", padding: "0.7rem 1.1rem",
        background: "rgba(255,255,255,0.015)",
      }}>
        {resolved ? (
          <span style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600,
                         display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={13} /> {resolved}
          </span>
        ) : o.kind === "question" && o.status === "open" ? (
          <div>
            <textarea
              value={answer} onChange={e => setAnswer(e.target.value)} rows={2}
              placeholder="Answer it. Your answer gets written into the reference doc, so the next draft actually sees it."
              style={{
                width: "100%", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
                padding: "0.55rem 0.7rem", fontSize: 12, lineHeight: 1.6,
                color: "var(--text-primary)", fontFamily: "inherit",
                resize: "vertical", outline: "none", marginBottom: "0.6rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
              <Btn size="sm" color="#a78bfa" disabled={answer.trim().length < 5}
                   onClick={() => setResolved(`Answered — written into “${o.proposedDocTitle ?? "a new reference doc"}” as v+1.`)}>
                <ArrowRight size={12} /> Answer & update doc
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setResolved("Dismissed.")}>
                <X size={12} /> Dismiss
              </Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <Btn size="sm" color="#22c55e" variant="outline"
                 onClick={() => setResolved(o.proposedDocDiff
                   ? `Accepted — “${o.proposedDocTitle}” bumped to a new version.`
                   : o.kind === "category_proposal"
                     ? "Accepted — new category added to the taxonomy."
                     : "Accepted.")}>
              <Check size={12} /> Accept
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setResolved("Dismissed.")}>
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
                      background: SEVERITY_COLOR[c.severity], minHeight: 30 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
            <span style={{ color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace",
                           fontSize: 11, marginRight: 7 }}>{c.ticketRef}</span>
            {c.subject}
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <Pill color={c.kind === "rejected" ? "#f43f5e" : "#f5a840"} solid>
              {c.kind === "rejected" ? "Rejected" : "Edited on approve"}
            </Pill>
            <Pill color={SEVERITY_COLOR[c.severity]}>severity {c.severity}</Pill>
            <Pill>{REASON_LABELS[c.reasonCode]}</Pill>
            <Pill>{categoryLabel(c.category)}</Pill>
            {!c.reflectedAt && <Pill color="#f5a840"><Clock size={9} /> not yet reflected</Pill>}
          </div>
        </div>
        {open ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
      </div>

      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "1rem 1.1rem" }}>
          <div style={{
            background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.2)",
            borderRadius: 9, padding: "0.65rem 0.8rem", marginBottom: "0.9rem",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                          letterSpacing: "0.07em", color: "#f43f5e", marginBottom: 4 }}>
              Why — {c.createdBy}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {c.reasonNote}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.8rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <Side title="AI wrote" icon={Bot} color="#f43f5e" body={c.aiBody} />
            <Side title="Human sent" icon={User} color="#22c55e" body={c.humanBody} />
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
