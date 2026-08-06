"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Sparkles, Mic, Send, Check, CheckCheck, X, ArrowRight, Loader,
  Lightbulb, Bug, Copy, MessageSquare, ChevronDown, ChevronUp, Clock,
  Users, PackageCheck, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

/**
 * Feature Requests — the human intake for the Blockages board.
 *
 * Someone describes what they want in their own words; a short guided
 * conversation turns it into something buildable; only what survives triage AND
 * a human decision becomes a blockage row. When the work is done the requester
 * is told what changed, in their own vocabulary.
 *
 * Styling deliberately follows the slate palette of the Blockages page this
 * renders inside, not the warmer tokens in globals.css. Local consistency wins
 * — the two sit side by side under one tab bar.
 */

// ── Types ────────────────────────────────────────────────────────────────────
type Status =
  | "drafting" | "answered" | "bug_filed" | "duplicate"
  | "submitted" | "accepted" | "declined"
  | "shipped" | "verified" | "reopened";

interface PlannedQuestion {
  slot: string;
  question: string;
  why: string;
  chips: string[];
  index?: number;
  of?: number;
}

interface ConversationView {
  id: string;
  status: Status;
  slots: Record<string, string>;
  transcript: Array<{ q: string; a: string; skipped?: boolean }>;
  filled: number;
  total: number;
  question: PlannedQuestion | null;
  spec: { title: string; problem: string; suggestedApproach: string } | null;
}

interface Verdict {
  kind: "exists" | "bug" | "duplicate";
  head: string;
  body: string;
  refLabel: string;
  refHint: string;
  duplicateOf: { id: string; title: string; requester: string; ageDays: number; plusOnes: number } | null;
}

interface FeatureRequest {
  id: string;
  requester_name: string;
  opening_text: string;
  status: Status;
  slots: Record<string, string>;
  transcript: Array<{ q: string; a: string; skipped?: boolean }>;
  title: string | null;
  problem: string | null;
  suggested_approach: string | null;
  plus_one_names: string[];
  blockage_id: string | null;
  decision_reason: string | null;
  decided_by: string | null;
  resolution_note: string | null;
  shipped_message: string | null;
  notified_at: string | null;
  verify_feedback: string | null;
  created_at: string;
  updated_at: string;
  view?: ConversationView;
  verdict?: Verdict | null;
}

// ── Config ───────────────────────────────────────────────────────────────────
const SLOT_LABEL: Record<string, string> = {
  workaround: "What happens today",
  trigger:    "When it comes up",
  cost:       "What it costs",
  done:       "Done looks like",
  where:      "Which screen",
};
const SLOT_ORDER = ["workaround", "trigger", "cost", "done", "where"];

const STATUS_META: Record<Status, { label: string; color: string }> = {
  drafting:  { label: "Draft",                 color: "#475569" },
  answered:  { label: "Answered",              color: "#22c55e" },
  bug_filed: { label: "Filed as a bug",        color: "#f43f5e" },
  duplicate: { label: "Merged",                color: "#38bdf8" },
  submitted: { label: "Waiting on a decision", color: "#f59e0b" },
  accepted:  { label: "In the queue",          color: "#a78bfa" },
  declined:  { label: "Not doing it",          color: "#f43f5e" },
  shipped:   { label: "Done",                  color: "#00c9d7" },
  verified:  { label: "Confirmed",             color: "#22c55e" },
  reopened:  { label: "Reopened",              color: "#f59e0b" },
};

const VERDICT_STYLE: Record<string, { color: string; Icon: React.FC<any> }> = {
  exists:    { color: "#22c55e", Icon: Lightbulb },
  bug:       { color: "#f43f5e", Icon: Bug },
  duplicate: { color: "#38bdf8", Icon: Copy },
};

// ── API ──────────────────────────────────────────────────────────────────────
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BOT_URL}/admin/feature-requests${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(body?.error ?? text ?? res.statusText);
  return body as T;
}

function ageLabel(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Small shared atoms ───────────────────────────────────────────────────────
function Eyebrow({ children, color = "#475569" }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{
      fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.12em",
      textTransform: "uppercase", color, margin: 0,
    }}>
      {children}
    </p>
  );
}

function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: m.color, background: `${m.color}14`, border: `1px solid ${m.color}30`,
      borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {m.label}
    </span>
  );
}

const btn = (accent?: string, solid?: boolean): React.CSSProperties => ({
  padding: "6px 13px", borderRadius: 7, fontSize: "12px", fontWeight: 700,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
  background: solid ? accent : accent ? `${accent}14` : "rgba(255,255,255,0.04)",
  border: `1px solid ${accent ? `${accent}38` : "rgba(255,255,255,0.1)"}`,
  color: solid ? "#0f172a" : accent ?? "#94a3b8",
  transition: "all 0.14s",
});

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  color: "#e2e8f0", fontSize: "13px", padding: "9px 12px",
  fontFamily: "inherit", outline: "none",
};

// ── The live request sheet ───────────────────────────────────────────────────
function RequestSheet({ view, sent }: { view: ConversationView | null; sent: boolean }) {
  const filled = view?.filled ?? 0;
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 11, padding: "15px 16px", position: "sticky", top: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Your request</p>
        <span style={{ fontSize: "10px", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
          {filled}/{SLOT_ORDER.length}
        </span>
      </div>
      <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 13px", lineHeight: 1.5 }}>
        Fills in as you answer. Every line stays in your words.
      </p>

      <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 15 }}>
        <motion.div
          animate={{ width: `${(filled / SLOT_ORDER.length) * 100}%` }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", background: "#38bdf8" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SLOT_ORDER.map(k => {
          const v = view?.slots?.[k];
          return (
            <div key={k} style={{
              paddingLeft: 10,
              borderLeft: `2px solid ${v ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
              transition: "border-color 0.3s",
            }}>
              <Eyebrow>{SLOT_LABEL[k]}</Eyebrow>
              <p style={{
                fontSize: "12.5px", margin: "3px 0 0", lineHeight: 1.5,
                color: v ? "#e2e8f0" : "#334155",
              }}>
                {v || "—"}
              </p>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 15, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: sent ? "#22c55e" : filled ? "#f59e0b" : "#334155",
          boxShadow: sent ? "0 0 0 3px rgba(34,197,94,0.14)" : filled ? "0 0 0 3px rgba(245,158,11,0.14)" : "none",
        }} />
        <Eyebrow>{sent ? "Sent for a decision" : filled ? "Draft — not sent" : "Nothing filed yet"}</Eyebrow>
      </div>
    </div>
  );
}

// ── Conversation turns ───────────────────────────────────────────────────────
function Turn({ who, children }: { who: "you" | "ai"; children: React.ReactNode }) {
  const you = who === "you";
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      style={{ display: "flex", gap: 11, marginBottom: 13 }}
    >
      <div style={{
        width: 25, height: 25, borderRadius: 7, flexShrink: 0, marginTop: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.02em",
        background: you ? "rgba(255,255,255,0.06)" : "rgba(56,189,248,0.13)",
        border: you ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(56,189,248,0.3)",
        color: you ? "#94a3b8" : "#38bdf8",
      }}>
        {you ? "YOU" : "AI"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </motion.div>
  );
}

function YouSaid({ text }: { text: string }) {
  return (
    <Turn who="you">
      <div style={{
        background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10, padding: "10px 13px", fontSize: "13px", color: "#e2e8f0", lineHeight: 1.6,
      }}>
        {text}
      </div>
    </Turn>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <Turn who="ai">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: "12.5px", paddingTop: 3 }}>
        <Loader size={12} className="spin" color="#38bdf8" />
        {label}
      </div>
    </Turn>
  );
}

// ── The requester flow ───────────────────────────────────────────────────────
function AskFlow({ requester, onSent }: { requester: string; onSent: () => void }) {
  const [opening, setOpening]   = useState("");
  const [busy, setBusy]         = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);
  const [req, setReq]           = useState<FeatureRequest | null>(null);
  const [verdict, setVerdict]   = useState<Verdict | null>(null);
  const [said, setSaid]         = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [dictating, setDictating] = useState(false);
  const recogRef = useRef<any>(null);

  // editable spec
  const [specTitle, setSpecTitle] = useState("");
  const [specProblem, setSpecProblem] = useState("");
  const [specApproach, setSpecApproach] = useState("");

  const view = req?.view ?? null;
  const done = req && ["submitted", "answered", "bug_filed", "duplicate"].includes(req.status);

  const reset = () => {
    setOpening(""); setReq(null); setVerdict(null); setSaid([]);
    setFreeText(""); setErr(null);
  };

  // ── dictation. Real Web Speech API where the browser has it; the button
  //    simply doesn't render where it doesn't, rather than pretending.
  const speechSupported = typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleDictation = () => {
    if (dictating) { recogRef.current?.stop(); setDictating(false); return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e: any) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) add += e.results[i][0].transcript;
      setOpening(prev => (prev ? prev + " " : "") + add.trim());
    };
    r.onend = () => setDictating(false);
    r.onerror = () => setDictating(false);
    recogRef.current = r;
    r.start();
    setDictating(true);
  };

  const start = async () => {
    const text = opening.trim();
    if (!text) return;
    setBusy("Checking whether this already exists…"); setErr(null);
    try {
      const r = await api<FeatureRequest>("", {
        method: "POST",
        body: JSON.stringify({ opening: text, requester }),
      });
      setSaid([text]);
      setReq(r);
      setVerdict(r.verdict ?? null);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const resolveVerdict = async (accept: boolean) => {
    if (!req) return;
    setBusy(accept ? "Closing this out…" : "Right — let's work out what you need."); setErr(null);
    try {
      const r = await api<FeatureRequest>(`/${req.id}/verdict`, {
        method: "POST", body: JSON.stringify({ accept }),
      });
      setVerdict(null);
      setReq(r);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const answer = async (text: string | null) => {
    if (!req) return;
    const q = view?.question;
    if (text) setSaid(s => [...s, text]);
    setFreeText("");
    setBusy(q && (q.index ?? 0) + 1 >= (q.of ?? 5) ? "Writing it up…" : null);
    setErr(null);
    try {
      const r = await api<FeatureRequest>(`/${req.id}/reply`, {
        method: "POST",
        body: JSON.stringify(text ? { answer: text } : { skip: true }),
      });
      setReq(r);
      if (r.view?.spec) {
        setSpecTitle(r.view.spec.title ?? "");
        setSpecProblem(r.view.spec.problem ?? "");
        setSpecApproach(r.view.spec.suggestedApproach ?? "");
      }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const submit = async () => {
    if (!req) return;
    setBusy("Sending…"); setErr(null);
    try {
      const r = await api<FeatureRequest>(`/${req.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          title: specTitle, problem: specProblem, suggested_approach: specApproach,
        }),
      });
      setReq(r);
      onSent();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20, alignItems: "start" }}>
      <div>
        {/* conversation so far */}
        {said.map((s, i) => <YouSaid key={i} text={s} />)}

        {/* verdict */}
        <AnimatePresence>
          {verdict && !busy && (() => {
            const vs = VERDICT_STYLE[verdict.kind];
            const Icon = vs.Icon;
            return (
              <Turn who="ai">
                <div style={{
                  borderRadius: 10, padding: "14px 15px",
                  background: `${vs.color}0d`, border: `1px solid ${vs.color}38`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <Icon size={13} color={vs.color} />
                    <p style={{ fontSize: "13.5px", fontWeight: 700, color: vs.color, margin: 0 }}>
                      {verdict.head}
                    </p>
                  </div>
                  <p style={{ fontSize: "12.8px", color: "#94a3b8", lineHeight: 1.6, margin: "0 0 11px" }}>
                    {verdict.body}
                  </p>

                  {(verdict.refLabel || verdict.duplicateOf) && (
                    <div style={{
                      background: "rgba(0,0,0,0.28)", borderRadius: 7, padding: "9px 11px",
                      marginBottom: 11, borderLeft: "2px solid rgba(255,255,255,0.1)",
                    }}>
                      {verdict.duplicateOf ? (
                        <>
                          <p style={{ fontSize: "12.5px", color: "#e2e8f0", fontWeight: 600, margin: 0 }}>
                            {verdict.duplicateOf.title}
                          </p>
                          <p style={{ fontSize: "10px", color: "#64748b", margin: "3px 0 0" }}>
                            asked by {verdict.duplicateOf.requester} · {verdict.duplicateOf.ageDays}d ago
                            {verdict.duplicateOf.plusOnes > 0 && ` · ${verdict.duplicateOf.plusOnes} others waiting`}
                          </p>
                        </>
                      ) : (
                        <>
                          {verdict.kind === "exists" ? (
                            <a href={verdict.refLabel} style={{
                              fontSize: "12.5px", color: "#38bdf8", fontWeight: 600,
                              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
                            }}>
                              {verdict.refLabel} <ArrowRight size={11} />
                            </a>
                          ) : (
                            <p style={{ fontSize: "12.5px", color: "#e2e8f0", fontWeight: 600, margin: 0 }}>
                              {verdict.refLabel}
                            </p>
                          )}
                          {verdict.refHint && (
                            <p style={{ fontSize: "10px", color: "#64748b", margin: "3px 0 0" }}>{verdict.refHint}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <button onClick={() => resolveVerdict(true)} style={btn(vs.color)}>
                      <Check size={11} />
                      {verdict.kind === "exists" ? "That's it, thanks"
                        : verdict.kind === "bug" ? "Yes, report it as broken"
                        : "Same thing — add me"}
                    </button>
                    <button onClick={() => resolveVerdict(false)} style={btn()}>
                      {verdict.kind === "duplicate" ? "Mine's different" : "That's not what I meant"}
                    </button>
                  </div>
                </div>
              </Turn>
            );
          })()}
        </AnimatePresence>

        {/* question */}
        {!busy && !verdict && view?.question && (
          <Turn who="ai">
            <div>
              <Eyebrow>Question {(view.question.index ?? 0) + 1} of {view.question.of ?? 5}</Eyebrow>
              <h3 style={{
                fontSize: "15px", fontWeight: 650, color: "#e2e8f0",
                margin: "5px 0 3px", letterSpacing: "-0.01em",
              }}>
                {view.question.question}
              </h3>
              {view.question.why && (
                <p style={{ fontSize: "11.5px", color: "#64748b", margin: "0 0 11px" }}>{view.question.why}</p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 10px" }}>
                {view.question.chips.map((c, i) => (
                  <motion.button
                    key={i} onClick={() => answer(c)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.035)",
                      color: "#cbd5e1", borderRadius: 999, padding: "7px 14px",
                      fontSize: "12.5px", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 7 }}>
                <input
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && freeText.trim()) answer(freeText.trim()); }}
                  placeholder="…or say it your own way"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => answer(null)} style={btn()}>Skip</button>
              </div>
            </div>
          </Turn>
        )}

        {/* spec review */}
        {!busy && !verdict && view && !view.question && view.spec && req?.status === "drafting" && (
          <Turn who="ai">
            <div style={{
              border: "1px solid rgba(56,189,248,0.32)", background: "rgba(56,189,248,0.045)",
              borderRadius: 11, padding: "15px 16px",
            }}>
              <Eyebrow color="#38bdf8">Ready to send — check it reads right</Eyebrow>
              <input
                value={specTitle}
                onChange={e => setSpecTitle(e.target.value)}
                style={{
                  ...inputStyle, fontSize: "15px", fontWeight: 650,
                  margin: "9px 0 13px", background: "transparent",
                  border: "1px dashed rgba(255,255,255,0.12)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 13 }}>
                <div>
                  <Eyebrow>The problem</Eyebrow>
                  <textarea
                    value={specProblem}
                    onChange={e => setSpecProblem(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, marginTop: 4, resize: "vertical", lineHeight: 1.55 }}
                  />
                </div>
                {SLOT_ORDER.map(k => view.slots?.[k] ? (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", gap: 10 }}>
                    <div style={{ paddingTop: 2 }}><Eyebrow>{SLOT_LABEL[k]}</Eyebrow></div>
                    <p style={{ fontSize: "12.8px", color: "#e2e8f0", margin: 0, lineHeight: 1.55 }}>
                      {view.slots[k]}
                    </p>
                  </div>
                ) : null)}
                <div>
                  <Eyebrow>Your idea</Eyebrow>
                  <textarea
                    value={specApproach}
                    onChange={e => setSpecApproach(e.target.value)}
                    rows={2}
                    placeholder="Nothing suggested"
                    style={{ ...inputStyle, marginTop: 4, resize: "vertical", lineHeight: 1.55 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: "11.5px", color: "#64748b", margin: "0 0 12px" }}>
                Change any wording you like. Nothing goes anywhere until you press send.
              </p>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={submit} style={btn("#38bdf8", true)}>
                  <Send size={11} /> Send it
                </button>
                <button onClick={reset} style={{ ...btn(), border: "1px solid transparent", background: "transparent" }}>
                  Throw it away
                </button>
              </div>
            </div>
          </Turn>
        )}

        {/* closed out */}
        {!busy && done && (
          <Turn who="ai">
            <div>
              <div style={{
                width: 32, height: 32, borderRadius: 9, marginBottom: 10,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check size={16} color="#22c55e" />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 650, color: "#e2e8f0", margin: "0 0 6px" }}>
                {req!.status === "submitted" ? "Sent"
                  : req!.status === "answered" ? "Sorted — nothing filed"
                  : req!.status === "bug_filed" ? "Filed as a fix"
                  : "Added to the existing request"}
              </h3>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 14px", maxWidth: "52ch", lineHeight: 1.6 }}>
                {req!.status === "submitted"
                  ? "It's waiting on a decision, and it's in your list below. You'll get an answer either way — including if it's a no."
                  : req!.status === "answered"
                  ? "You didn't need to file anything, so nothing was filed."
                  : req!.status === "bug_filed"
                  ? "This went straight to the queue as something broken, skipping the decision step."
                  : "Your name is on the request that was already open, which makes it more likely to get picked up."}
              </p>
              <button onClick={reset} style={btn()}>Ask for something else</button>
            </div>
          </Turn>
        )}

        {busy && <Thinking label={busy} />}

        {err && (
          <div style={{
            background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.25)",
            borderRadius: 8, padding: "10px 12px", marginBottom: 12,
            fontSize: "12.5px", color: "#fda4af", lineHeight: 1.55,
          }}>
            {err}
          </div>
        )}

        {/* composer */}
        {!req && !busy && (
          <div style={{
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 11, padding: 16,
          }}>
            <textarea
              value={opening}
              onChange={e => setOpening(e.target.value)}
              placeholder="What do you wish this app could do?"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", fontSize: "14px", lineHeight: 1.6, padding: "11px 13px" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, flexWrap: "wrap" }}>
              {speechSupported && (
                <button
                  onClick={toggleDictation}
                  title={dictating ? "Stop" : "Say it out loud instead"}
                  style={{
                    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: dictating ? "rgba(244,63,94,0.13)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${dictating ? "rgba(244,63,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: dictating ? "#f43f5e" : "#64748b",
                  }}
                >
                  <Mic size={13} />
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button
                onClick={start}
                disabled={!opening.trim()}
                style={{ ...btn("#38bdf8", true), opacity: opening.trim() ? 1 : 0.35, cursor: opening.trim() ? "pointer" : "not-allowed" }}
              >
                <Send size={11} /> Send
              </button>
            </div>
            <p style={{ fontSize: "11.5px", color: "#475569", margin: "11px 0 0", lineHeight: 1.55 }}>
              Describe it however it comes out. You'll get a few short questions, then you approve
              exactly what gets sent.
            </p>
          </div>
        )}
      </div>

      <RequestSheet view={view} sent={!!done} />
    </div>
  );
}

// ── Message block (shared by requester list + owner draft) ───────────────────
function ShippedMessage({ text }: { text: string }) {
  const parts = text.split("\n\n").filter(Boolean);
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 9, padding: "13px 15px",
    }}>
      {parts.map((p, i) => (
        <p key={i} style={{
          margin: i === 0 ? "0 0 8px" : "0 0 8px",
          fontSize: i === 0 ? "13.5px" : "12.8px",
          fontWeight: i === 0 ? 650 : 400,
          color: i === 0 ? "#e2e8f0" : "#94a3b8",
          lineHeight: 1.65,
          ...(i === 1 ? { borderLeft: "2px solid #00c9d7", paddingLeft: 11, color: "#cbd5e1" } : {}),
        }}>
          {p}
        </p>
      ))}
    </div>
  );
}

// ── The requester's own list ─────────────────────────────────────────────────
function MyRequests({ rows, onChanged }: { rows: FeatureRequest[]; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const verify = async (r: FeatureRequest, solved: boolean) => {
    setBusyId(r.id); setErr(null);
    try {
      await api(`/${r.id}/verify`, {
        method: "POST",
        body: JSON.stringify({ solved, feedback: solved ? undefined : feedback.trim() }),
      });
      setFeedback("");
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!rows.length) {
    return (
      <p style={{ fontSize: "12.5px", color: "#475569", padding: "18px 0", margin: 0 }}>
        Nothing yet. Anything you ask for shows up here with its status.
      </p>
    );
  }

  return (
    <div>
      {err && (
        <div style={{
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.25)",
          borderRadius: 8, padding: "9px 12px", marginBottom: 10, fontSize: "12px", color: "#fda4af",
        }}>
          {err}
        </div>
      )}
      {rows.map(r => {
        const open = openId === r.id;
        const m = STATUS_META[r.status];
        return (
          <div key={r.id} style={{
            background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: `3px solid ${m.color}`, borderRadius: 10, marginBottom: 9, overflow: "hidden",
          }}>
            <div
              onClick={() => setOpenId(open ? null : r.id)}
              style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              <StatusChip status={r.status} />
              <span style={{
                flex: 1, fontSize: "13px", fontWeight: 620, color: "#e2e8f0",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {r.title ?? r.opening_text}
              </span>
              <span style={{ fontSize: "10px", color: "#475569", whiteSpace: "nowrap" }}>
                {ageLabel(r.created_at)}
              </span>
              {open ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
            </div>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "12px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {r.status === "shipped" || r.status === "verified" ? (
                      r.shipped_message ? <ShippedMessage text={r.shipped_message} /> : null
                    ) : r.status === "declined" || r.status === "answered" ? (
                      <div style={{
                        background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.2)",
                        borderRadius: 8, padding: "11px 13px", fontSize: "12.8px", color: "#94a3b8", lineHeight: 1.6,
                      }}>
                        <strong style={{ color: "#e2e8f0" }}>
                          {r.status === "declined" ? "Declined — here's why. " : "Answered. "}
                        </strong>
                        {r.decision_reason ?? "No reason recorded."}
                        {r.decided_by && (
                          <p style={{ fontSize: "10px", color: "#475569", margin: "7px 0 0", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 700 }}>
                            by {r.decided_by}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: "12.8px", color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                        {r.status === "submitted"
                          ? "Nobody has looked at it yet. You'll hear either way — there's no version of this where it just goes quiet."
                          : r.status === "accepted"
                          ? "Accepted and in the work queue. You'll get a message here when it's done — no need to check back."
                          : r.status === "reopened"
                          ? "Back with whoever built it, along with what you said was missing."
                          : r.problem ?? r.opening_text}
                      </p>
                    )}

                    {r.status === "shipped" && (
                      <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: "0 0 9px" }}>
                          Did that actually solve it?
                        </p>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                          <button
                            onClick={() => verify(r, true)} disabled={busyId === r.id}
                            style={btn("#22c55e")}
                          >
                            <CheckCheck size={11} /> Yes, that's it
                          </button>
                          <button
                            onClick={() => feedback.trim() ? verify(r, false) : setFeedback(" ")}
                            disabled={busyId === r.id}
                            style={btn()}
                          >
                            Not quite
                          </button>
                        </div>
                        {feedback !== "" && (
                          <>
                            <p style={{ fontSize: "11.5px", color: "#64748b", margin: "0 0 6px" }}>
                              What's still missing? This goes back to whoever built it — it doesn't start over.
                            </p>
                            <textarea
                              value={feedback.trim() === "" ? "" : feedback}
                              onChange={e => setFeedback(e.target.value)}
                              rows={2}
                              autoFocus
                              placeholder="e.g. It shows the pairs, but not how much each one is worth"
                              style={{ ...inputStyle, resize: "vertical", marginBottom: 7 }}
                            />
                            <button
                              onClick={() => verify(r, false)}
                              disabled={!feedback.trim() || busyId === r.id}
                              style={{ ...btn("#f59e0b"), opacity: feedback.trim() ? 1 : 0.4 }}
                            >
                              <RotateCcw size={11} /> Send it back
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Owner triage ─────────────────────────────────────────────────────────────
function TriageList({ rows, onChanged, decider }: {
  rows: FeatureRequest[]; onChanged: () => void; decider: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"decline" | "answer" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (r: FeatureRequest, decision: string, why?: string) => {
    setBusyId(r.id); setErr(null);
    try {
      await api(`/${r.id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, reason: why, decided_by: decider }),
      });
      setReason(""); setMode(null);
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!rows.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <PackageCheck size={26} color="#22c55e" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: "14px", fontWeight: 650, color: "#e2e8f0", margin: "0 0 4px" }}>
          Nothing waiting on you
        </p>
        <p style={{ fontSize: "12.5px", color: "#475569", margin: 0 }}>
          Requests that already exist, are broken, or repeat an open ask never reach this list.
        </p>
      </div>
    );
  }

  return (
    <div>
      {err && (
        <div style={{
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.25)",
          borderRadius: 8, padding: "9px 12px", marginBottom: 10, fontSize: "12px", color: "#fda4af",
        }}>
          {err}
        </div>
      )}
      {rows.map(r => {
        const open = openId === r.id;
        const waiting = (r.plus_one_names ?? []).length;
        return (
          <div key={r.id} style={{
            background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: "3px solid #f59e0b", borderRadius: 10, marginBottom: 10, overflow: "hidden",
          }}>
            <div
              onClick={() => { setOpenId(open ? null : r.id); setMode(null); setReason(""); }}
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              <span style={{
                fontSize: "9px", fontWeight: 800, letterSpacing: "0.06em",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#64748b", borderRadius: 8, padding: "2px 7px", whiteSpace: "nowrap",
              }}>
                {r.requester_name}
              </span>
              <span style={{
                flex: 1, fontSize: "13.5px", fontWeight: 650, color: "#e2e8f0",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {r.title ?? r.opening_text}
              </span>
              {waiting > 0 && (
                <span style={{
                  fontSize: "9px", fontWeight: 800, color: "#a78bfa",
                  background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.28)",
                  borderRadius: 8, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                  <Users size={9} /> +{waiting}
                </span>
              )}
              <span style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={9} /> {ageLabel(r.created_at)}
              </span>
              {open ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
            </div>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "12px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {/* the signals that decide priority */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 13 }}>
                      {SLOT_ORDER.filter(k => r.slots?.[k]).map(k => (
                        <div key={k}>
                          <Eyebrow>{SLOT_LABEL[k]}</Eyebrow>
                          <p style={{ fontSize: "12.3px", color: "#e2e8f0", fontWeight: 600, margin: "2px 0 0" }}>
                            {r.slots[k]}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: "12.8px", color: "#94a3b8", lineHeight: 1.6, margin: "0 0 10px" }}>
                      {r.problem ?? r.opening_text}
                    </p>

                    {r.suggested_approach && (
                      <p style={{ fontSize: "12.3px", color: "#64748b", lineHeight: 1.6, margin: "0 0 10px" }}>
                        <span style={{ color: "#475569", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px", letterSpacing: "0.1em" }}>
                          Approach&nbsp;
                        </span>
                        {r.suggested_approach}
                      </p>
                    )}

                    <details style={{ marginBottom: 13 }}>
                      <summary style={{
                        cursor: "pointer", fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "#475569",
                      }}>
                        How they described it
                      </summary>
                      <div style={{
                        marginTop: 9, paddingLeft: 11, borderLeft: "1px solid rgba(255,255,255,0.08)",
                        display: "flex", flexDirection: "column", gap: 7,
                      }}>
                        <p style={{ fontSize: "12.3px", color: "#cbd5e1", margin: 0, fontStyle: "italic", lineHeight: 1.55 }}>
                          “{r.opening_text}”
                        </p>
                        {(r.transcript ?? []).map((t, i) => (
                          <div key={i} style={{ fontSize: "12.2px", lineHeight: 1.5 }}>
                            <span style={{ color: "#64748b" }}>{t.q}</span><br />
                            <span style={{ color: t.skipped ? "#475569" : "#e2e8f0" }}>
                              {t.skipped ? "(skipped)" : t.a}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* actions */}
                    {mode === null ? (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <button onClick={() => decide(r, "accept")} disabled={busyId === r.id} style={btn("#22c55e")}>
                          {busyId === r.id ? <Loader size={11} className="spin" /> : <ArrowRight size={11} />} Accept → queue
                        </button>
                        <button onClick={() => setMode("answer")} style={btn("#38bdf8")}>
                          <MessageSquare size={11} /> Answer it
                        </button>
                        <button onClick={() => setMode("decline")} style={btn("#f43f5e")}>
                          <X size={11} /> Decline
                        </button>
                      </div>
                    ) : (
                      <div style={{ paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: "0 0 4px" }}>
                          {mode === "decline" ? "Why not?" : "What's the answer?"}
                        </p>
                        <p style={{ fontSize: "11.5px", color: "#64748b", margin: "0 0 8px" }}>
                          {r.requester_name} reads this — a reason keeps people filing good requests.
                        </p>
                        <textarea
                          value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
                          placeholder={mode === "decline"
                            ? "e.g. Worth doing, but not before the Q4 close."
                            : "e.g. This already exists under Profit → Costs."}
                          style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                        />
                        <div style={{ display: "flex", gap: 7 }}>
                          <button
                            onClick={() => decide(r, mode, reason.trim())}
                            disabled={!reason.trim() || busyId === r.id}
                            style={{ ...btn(mode === "decline" ? "#f43f5e" : "#38bdf8"), opacity: reason.trim() ? 1 : 0.4 }}
                          >
                            Send to {r.requester_name}
                          </button>
                          <button onClick={() => { setMode(null); setReason(""); }} style={btn()}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Ready to send: shipped but not yet notified ──────────────────────────────
function ToNotify({ rows, onChanged }: { rows: FeatureRequest[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  if (!rows.length) return null;

  const send = async (r: FeatureRequest) => {
    setBusyId(r.id); setErr(null);
    try {
      await api(`/${r.id}/notify`, {
        method: "POST",
        body: JSON.stringify({ message: drafts[r.id] ?? r.shipped_message }),
      });
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Sparkles size={13} color="#00c9d7" />
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          Built — waiting to be sent
        </p>
      </div>
      <p style={{ fontSize: "12.3px", color: "#64748b", margin: "0 0 13px", maxWidth: "62ch", lineHeight: 1.55 }}>
        The resolution note has been rewritten for the person who asked. Read it, change anything
        that isn't right, then send.
      </p>

      {err && (
        <div style={{
          background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.25)",
          borderRadius: 8, padding: "9px 12px", marginBottom: 10, fontSize: "12px", color: "#fda4af",
        }}>
          {err}
        </div>
      )}

      {rows.map(r => (
        <div key={r.id} style={{
          background: "rgba(0,201,215,0.04)", border: "1px solid rgba(0,201,215,0.24)",
          borderRadius: 10, padding: "14px 15px", marginBottom: 10,
        }}>
          <Eyebrow color="#00c9d7">Tell {r.requester_name} what changed</Eyebrow>

          {r.resolution_note && (
            <div style={{
              background: "rgba(0,0,0,0.3)", borderRadius: 7, padding: "9px 11px",
              margin: "9px 0 10px", fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px", color: "#64748b", lineHeight: 1.6,
              overflowX: "auto", whiteSpace: "pre-wrap",
            }}>
              <span style={{ display: "block", color: "#374151", letterSpacing: "0.1em", marginBottom: 3 }}>
                RESOLUTION NOTE AS WRITTEN
              </span>
              {r.resolution_note}
            </div>
          )}

          <p style={{
            textAlign: "center", fontSize: "10px", color: "#374151",
            letterSpacing: "0.1em", margin: "0 0 10px",
          }}>
            ↓ REWRITTEN FOR THE PERSON WHO ASKED ↓
          </p>

          <textarea
            value={drafts[r.id] ?? r.shipped_message ?? ""}
            onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
            rows={7}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65, marginBottom: 10 }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <button onClick={() => send(r)} disabled={busyId === r.id} style={btn("#00c9d7", true)}>
              {busyId === r.id ? <Loader size={11} className="spin" /> : <Send size={11} />}
              Send to {r.requester_name}
            </button>
            <span style={{ fontSize: "9.5px", color: "#475569", letterSpacing: "0.07em", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px" }}>
              DISCORD DM
            </span>
            <span style={{ fontSize: "9.5px", color: "#475569", letterSpacing: "0.07em", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px" }}>
              IN-APP
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function FeatureRequests() {
  const [tab, setTab]         = useState<"ask" | "triage">("ask");
  const [requester, setReq]   = useState("");
  const [people, setPeople]   = useState<Array<{ name: string; username: string | null }>>([]);
  const [mine, setMine]       = useState<FeatureRequest[]>([]);
  const [pending, setPending] = useState<FeatureRequest[]>([]);
  const [toNotify, setNotify] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // No per-user identity exists — Mission Control is behind one shared password
  // gate — so the requester self-identifies and we remember the choice locally.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("mc.requester") : null;
    if (saved) setReq(saved);
  }, []);

  useEffect(() => {
    if (requester && typeof window !== "undefined") {
      window.localStorage.setItem("mc.requester", requester);
    }
  }, [requester]);

  const load = useCallback(async () => {
    try {
      const [meta, submitted, shipped] = await Promise.all([
        api<{ requesters: Array<{ name: string; username: string | null }> }>("/meta"),
        api<FeatureRequest[]>("?status=submitted"),
        api<FeatureRequest[]>("?status=shipped"),
      ]);
      setPeople(meta.requesters ?? []);
      setPending(submitted ?? []);
      setNotify((shipped ?? []).filter(r => !r.notified_at));
      setReq(prev => prev || meta.requesters?.[0]?.name || "");
    } catch { /* leave lists as they are */ }
    finally { setLoading(false); }
  }, []);

  const loadMine = useCallback(async () => {
    if (!requester) return;
    try {
      setMine(await api<FeatureRequest[]>(`?requester=${encodeURIComponent(requester)}`));
    } catch { /* leave as-is */ }
  }, [requester]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMine(); }, [loadMine]);

  const refreshAll = useCallback(() => { load(); loadMine(); }, [load, loadMine]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", padding: "2.5rem 0" }}>
        <Loader size={14} className="spin" color="#475569" />
        <span style={{ fontSize: "0.85rem" }}>Loading requests…</span>
      </div>
    );
  }

  return (
    <div>
      {/* who + which side */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}>
          {(["ask", "triage"] as const).map(t => (
            <button
              key={t} onClick={() => setTab(t)}
              style={{
                border: 0, borderRadius: 6, padding: "5px 13px", cursor: "pointer",
                fontSize: "11.5px", fontWeight: 700,
                background: tab === t ? "rgba(56,189,248,0.14)" : "transparent",
                color: tab === t ? "#38bdf8" : "#64748b",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t === "ask" ? "Ask for something" : "Waiting on you"}
              {t === "triage" && pending.length > 0 && (
                <span style={{
                  fontSize: "9.5px", fontWeight: 800, background: "rgba(245,158,11,0.16)",
                  color: "#f59e0b", borderRadius: 20, padding: "1px 6px",
                }}>
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: "10px", color: "#374151", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          You are
        </span>
        <select
          value={requester}
          onChange={e => setReq(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#94a3b8", fontSize: "11.5px", padding: "5px 10px",
            outline: "none", cursor: "pointer",
          }}
        >
          {!people.some(p => p.name === requester) && requester && (
            <option value={requester}>{requester}</option>
          )}
          {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          {people.length === 0 && <option value="">No team members synced</option>}
        </select>
      </div>

      {tab === "ask" ? (
        <>
          {requester
            ? <AskFlow requester={requester} onSent={refreshAll} />
            : (
              <p style={{ fontSize: "13px", color: "#64748b", padding: "20px 0" }}>
                Pick who you are first — that's how you get told when it's done.
              </p>
            )}

          <div style={{ marginTop: 32 }}>
            <p style={{ fontSize: "15px", fontWeight: 650, color: "#e2e8f0", margin: "0 0 3px" }}>
              What you've asked for
            </p>
            <p style={{ fontSize: "12.3px", color: "#64748b", margin: "0 0 14px" }}>
              Every request ends with an answer — including the ones that don't get built.
            </p>
            <MyRequests rows={mine} onChanged={refreshAll} />
          </div>
        </>
      ) : (
        <>
          <ToNotify rows={toNotify} onChanged={refreshAll} />

          <p style={{ fontSize: "15px", fontWeight: 650, color: "#e2e8f0", margin: "0 0 3px" }}>
            Requests waiting on a decision
          </p>
          <p style={{ fontSize: "12.3px", color: "#64748b", margin: "0 0 14px", maxWidth: "64ch", lineHeight: 1.55 }}>
            Accepting one writes a blockage row. Everything else closes out with a reason the
            requester reads.
          </p>
          <TriageList rows={pending} onChanged={refreshAll} decider={requester} />
        </>
      )}
    </div>
  );
}
