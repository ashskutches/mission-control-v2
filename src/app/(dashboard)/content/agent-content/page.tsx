"use client";
/**
 * Content → Agent Content
 *
 * Everything the agents generate, and one keystroke to approve or reject it.
 *
 * ── Why this page exists ───────────────────────────────────────────────────────
 * Until 2026-09-21 the only verdict this system had on its own output was an
 * automatic accuracy score, and that score passed 0 of 177 images during a week
 * when the operator was scoring the same work 4.4–4.5 out of 5. It also scored an
 * anatomical infographic 0 because it "is not a product photo", when a product
 * photo had never been asked for.
 *
 * The routines obeyed it. On 2026-09-21 the trends routine generated 13 images,
 * scored them 0–32 against a threshold of 70, discarded all 13, wrote nothing to
 * its spreadsheet and filed a bug report against itself — four runs in a row.
 *
 * So the gate is a person now, and the score is a hint shown beside the picture.
 *
 * The verdict lands on the row that already holds the reference images, the
 * compiled prompt and the spec version, which is what makes it worth more than the
 * day it was given: when a spec edit starts producing rejections, the wording that
 * caused them is one query away. The fifteen-round regression that prompted all of
 * this went unseen precisely because each round was judged in a chat window that no
 * longer exists.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp, ThumbsDown, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, ImageOff, MessageSquare, Bot, History, ExternalLink, X,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  created_at: string;
  agent_name: string | null;
  surface: string | null;
  prompt: string | null;
  image_url: string;
  source_url: string | null;
  file_name: string | null;
  size: string | null;
  engine: string | null;
  product_id: string | null;
  reference_urls: string[] | null;
  accuracy_score: number | null;
  accuracy_verdict: string | null;
  accuracy_issues: string[] | null;
  verdict: "approved" | "rejected" | null;
  verdict_by: string | null;
  verdict_at: string | null;
  verdict_note: string | null;
  spec_version_id: string | null;
  routine_id: string | null;
}

type Status = "pending" | "approved" | "rejected" | "reviewed" | "all";

/** What /admin/agent-content/stats returns. Only the fields this page reads. */
interface Stats {
  total: number;
  reviewed: number;
  approved: number;
  scorerAgreement: { n: number; agreed: number; meanScoreApproved: number | null; meanScoreRejected: number | null } | null;
}

const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "pending",  label: "Needs review", color: "#f59e0b" },
  { id: "approved", label: "Approved",     color: "#10b981" },
  { id: "rejected", label: "Rejected",     color: "#ef4444" },
  { id: "all",      label: "Everything",   color: "#64748b" },
];

/**
 * A surface is where the image was made. Worth showing rather than hiding: for
 * months the agent path could not reach the engine the studio used and never
 * stored what it made durably, and nothing in the dashboard said so.
 */
const SURFACE_COLOR: Record<string, string> = {
  studio: "#a78bfa", agent: "#38bdf8", blog: "#10b981",
  promo: "#f59e0b", lifestyle: "#ec4899", insight: "#64748b",
};

export default function AgentContentPage() {
  const [items, setItems]     = useState<Asset[]>([]);
  const [total, setTotal]     = useState(0);
  const [status, setStatus]   = useState<Status>("pending");
  const [surface, setSurface] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState<Record<string, boolean>>({});
  const [noteFor, setNoteFor] = useState<Asset | null>(null);
  const [noteText, setNoteText] = useState("");
  const [stats, setStats]     = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ status, limit: "60" });
      if (surface) qs.set("surface", surface);
      const [r, s] = await Promise.all([
        fetch(`${BOT_URL}/admin/agent-content?${qs}`),
        fetch(`${BOT_URL}/admin/agent-content/stats`),
      ]);
      if (!r.ok) throw new Error(`queue: HTTP ${r.status}`);
      const data = await r.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      if (s.ok) setStats(await s.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load the review queue");
    } finally {
      setLoading(false);
    }
  }, [status, surface]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Optimistic, and it removes the card from the pending list immediately.
   *
   * Reviewing a grid is a rhythm; waiting for a round trip between two images
   * breaks it, and this queue is meant to be worked through in one sitting.
   */
  const vote = useCallback(async (asset: Asset, verdict: "approved" | "rejected", note?: string) => {
    setBusy(b => ({ ...b, [asset.id]: true }));
    const previous = items;
    if (status === "pending") setItems(list => list.filter(i => i.id !== asset.id));
    else setItems(list => list.map(i => i.id === asset.id ? { ...i, verdict, verdict_note: note ?? null } : i));

    try {
      const res = await fetch(`${BOT_URL}/admin/agent-content/${asset.id}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, note: note ?? null, by: "mission-control" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTotal(t => (status === "pending" ? Math.max(0, t - 1) : t));
    } catch (e: unknown) {
      setItems(previous);              // put it back — a lost verdict is worse than a stutter
      setError(`Could not save that verdict: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(b => ({ ...b, [asset.id]: false }));
    }
  }, [items, status]);

  const submitNote = useCallback(async () => {
    if (!noteFor) return;
    const asset = noteFor, text = noteText.trim();
    setNoteFor(null);
    setNoteText("");
    await vote(asset, "rejected", text || undefined);
  }, [noteFor, noteText, vote]);

  const pendingCount = stats ? (stats.total ?? 0) - (stats.reviewed ?? 0) : null;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Bot size={18} color="#38bdf8" /> Agent Content
          </h2>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
            Everything the agents generate. 👍 keeps it and lets agents reuse it; 👎 records why, against the spec version that produced it.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading}
          style={btn("#64748b")}>
          {loading ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Refresh
        </button>
      </div>

      {/* ── Scoreboard ─────────────────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <Stat label="Awaiting review" value={pendingCount ?? 0} color="#f59e0b" icon={<Clock size={12} />} />
          <Stat label="Approved"        value={stats.approved ?? 0} color="#10b981" icon={<CheckCircle2 size={12} />} />
          <Stat label="Reviewed"        value={stats.reviewed ?? 0} color="#64748b" icon={<History size={12} />} />
          {/* The number that decides whether the automatic scorer is worth keeping.
              Nobody had ever computed it, and it had been gating the routines. */}
          {stats.scorerAgreement && (
            <Stat
              label={`Auto-score agrees (n=${stats.scorerAgreement.n})`}
              value={`${Math.round((stats.scorerAgreement.agreed / stats.scorerAgreement.n) * 100)}%`}
              color={stats.scorerAgreement.agreed / stats.scorerAgreement.n < 0.6 ? "#ef4444" : "#10b981"}
              icon={<AlertTriangle size={12} />}
            />
          )}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
        {STATUSES.map(s => (
          <button key={s.id} onClick={() => setStatus(s.id)} style={chip(s.color, status === s.id)}>
            {s.label}{s.id === status ? ` · ${total}` : ""}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)", margin: "0 0.35rem" }} />
        <select value={surface} onChange={e => setSurface(e.target.value)}
          style={{ ...chip("#64748b", !!surface), cursor: "pointer", appearance: "none" }}>
          <option value="">Every surface</option>
          {Object.keys(SURFACE_COLOR).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "0.65rem 0.9rem", marginBottom: "1rem", color: "#fca5a5", fontSize: 12, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}><X size={13} /></button>
        </div>
      )}

      {/* ── The grid ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", fontSize: 13, padding: "2rem 0" }}>
          <Loader2 size={15} className="spin" /> Loading the queue…
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
          <CheckCircle2 size={30} color="#10b981" style={{ marginBottom: "0.6rem" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
            {status === "pending" ? "Nothing waiting for review." : "Nothing here."}
          </p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            {status === "pending" ? "Every generated image has a verdict." : "Try another filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          <AnimatePresence mode="popLayout">
            {items.map(a => (
              <motion.div key={a.id} layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column",
                }}>
                <ImageCell asset={a} />

                <div style={{ padding: "0.7rem 0.8rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Tag color={SURFACE_COLOR[a.surface ?? ""] ?? "#64748b"}>{a.surface ?? "unknown"}</Tag>
                    {a.agent_name && <Tag color="#64748b">{a.agent_name.replace("mission-control/", "")}</Tag>}
                    {/* Shown, never enforced. A picture with no durable copy is a
                        link that will stop resolving, and that used to be silent. */}
                    {!a.source_url && a.image_url.includes("tempfile") && (
                      <Tag color="#ef4444">temporary URL</Tag>
                    )}
                  </div>

                  <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, flex: 1 }}>
                    {(a.prompt ?? "").slice(0, 150)}{(a.prompt ?? "").length > 150 ? "…" : ""}
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 10, color: "#475569" }}>
                    <span>{new Date(a.created_at).toLocaleDateString()}</span>
                    {a.engine && <span>· {a.engine.replace("kie/", "").replace("-image-to-image", "")}</span>}
                    {typeof a.accuracy_score === "number" && (
                      <span title="Automatic check — advisory only, and it is known to be harsh."
                        style={{ marginLeft: "auto", color: a.accuracy_score >= 70 ? "#10b981" : "#64748b" }}>
                        auto {a.accuracy_score}
                      </span>
                    )}
                  </div>

                  {a.verdict ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, fontWeight: 700,
                      color: a.verdict === "approved" ? "#10b981" : "#ef4444",
                    }}>
                      {a.verdict === "approved" ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                      {a.verdict}
                      {a.verdict_note && (
                        <span style={{ color: "#64748b", fontWeight: 500, fontStyle: "italic" }}>
                          — {a.verdict_note.slice(0, 40)}
                        </span>
                      )}
                      <button onClick={() => void vote(a, a.verdict === "approved" ? "rejected" : "approved")}
                        style={{ marginLeft: "auto", ...linkBtn }}>change</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button onClick={() => void vote(a, "approved")} disabled={busy[a.id]}
                        style={{ ...voteBtn("#10b981"), flex: 1 }}>
                        <ThumbsUp size={13} /> Approve
                      </button>
                      <button onClick={() => { setNoteFor(a); setNoteText(""); }} disabled={busy[a.id]}
                        style={{ ...voteBtn("#ef4444"), flex: 1 }}>
                        <ThumbsDown size={13} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Rejection note ─────────────────────────────────────────────────── */}
      {/*
        A rejection asks for a reason, and approval does not. Deliberate: "wrong"
        is only useful if it says what is wrong, and that sentence is the evidence
        the next spec edit gets argued from. It is optional — a note nobody has
        time to write must never stop a verdict being recorded.
      */}
      <AnimatePresence>
        {noteFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNoteFor(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(2,6,23,0.75)", backdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem",
            }}>
            <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "#0b1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                padding: "1.1rem", width: "min(460px, 100%)",
              }}>
              <h3 style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14, marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <MessageSquare size={14} color="#ef4444" /> What is wrong with it?
              </h3>
              <p style={{ color: "#64748b", fontSize: 11, marginBottom: "0.75rem" }}>
                Optional, and the most useful thing on this page. Be specific and checkable —
                “rear legs too short”, not “looks off”. Adjectives get read more literally
                than they are meant, and twice they caused the regression they were written to fix.
              </p>
              <textarea
                autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitNote(); }}
                placeholder="e.g. only five legs visible; colour ring floating inside the mat"
                rows={3}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.6rem",
                  fontSize: 12, resize: "vertical", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", justifyContent: "flex-end" }}>
                <button onClick={() => setNoteFor(null)} style={btn("#64748b")}>Cancel</button>
                <button onClick={() => void submitNote()} style={{ ...btn("#ef4444"), fontWeight: 700 }}>
                  <ThumbsDown size={12} /> Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Small pieces ───────────────────────────────────────────────────────────────

/** An image whose URL has expired is the normal failure here, so it says so. */
function ImageCell({ asset }: { asset: Asset }) {
  const [broken, setBroken] = useState(false);
  return (
    <div style={{ position: "relative", aspectRatio: "1/1", background: "rgba(0,0,0,0.3)" }}>
      {broken ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#475569", gap: "0.4rem" }}>
          <ImageOff size={22} />
          <span style={{ fontSize: 10, textAlign: "center", padding: "0 1rem" }}>
            This URL no longer resolves — it was never mirrored.
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.image_url} alt={asset.prompt ?? ""} onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
      <a href={asset.image_url} target="_blank" rel="noreferrer"
        style={{
          position: "absolute", top: 6, right: 6, background: "rgba(2,6,23,0.7)", borderRadius: 6,
          padding: "0.25rem", color: "#94a3b8", display: "flex",
        }}>
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: React.ReactNode; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 10,
      padding: "0.5rem 0.8rem", display: "flex", alignItems: "center", gap: "0.5rem",
    }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>{value}</div>
        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      </div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 5,
      padding: "0.1rem 0.4rem", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>{children}</span>
  );
}

const btn = (color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "0.35rem",
  background: `${color}15`, color, border: `1px solid ${color}30`,
  borderRadius: 8, padding: "0.35rem 0.75rem", fontSize: 11, fontWeight: 600, cursor: "pointer",
});

const voteBtn = (color: string): React.CSSProperties => ({
  ...btn(color), justifyContent: "center", padding: "0.45rem", fontSize: 12, fontWeight: 700,
});

const chip = (color: string, active: boolean): React.CSSProperties => ({
  background: active ? `${color}18` : "rgba(255,255,255,0.04)",
  color: active ? color : "#64748b",
  border: active ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8, padding: "0.3rem 0.8rem", fontSize: 11, fontWeight: 700,
  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
});

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "#64748b", fontSize: 10,
  cursor: "pointer", textDecoration: "underline",
};
