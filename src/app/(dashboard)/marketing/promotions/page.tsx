"use client";
/**
 * Marketing → Promotions (Promo Studio)
 *
 * Queue a brief, watch it run, pull the finished package.
 *
 * WHY IT IS A QUEUE AND NOT A BUTTON
 * ----------------------------------
 * A run takes 50-220s: three image engines and three text providers, with a Kie
 * 4K plate as the long pole. The synchronous version made that a dead wait in the
 * tab, and closing the tab lost both the work and the money. Jobs are rows now,
 * so several briefs can be lined up, and finished ones stay browsable.
 *
 * WHY THE PREVIEW IS THE CENTRE OF THE SCREEN
 * -------------------------------------------
 * The live hero lays a dark scrim over the whole image and centres white type on
 * it. A plate judged as a bare thumbnail looks great and then turns out to have
 * the headline sitting on someone's face. The preview rebuilds the scrim, the
 * type, the button and the banner strip, so what is approved is what ships.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, Package, RefreshCw, AlertTriangle, Check, X, Clock,
  Monitor, Smartphone, Eye, ChevronLeft, ChevronRight, Loader2, ChevronDown, CalendarDays,
  MessageSquare, Copy, ExternalLink,
} from "lucide-react";
import { BOT_URL, CARD, LABEL, Panel, EmptyState } from "@/components/MarketingShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Slot {
  key: string; label: string; kind: "image" | "text" | "html";
  metaobjectField: string | null; publishable: boolean;
  width?: number; height?: number; maxChars?: number; brief: string;
}
interface Style {
  key: string; label: string; blurb: string; productVisible: boolean;
  engines: string[]; typeTreatment: string; useWhen: string;
}
interface EngineInfo { id: string; label: string; strength: string; configured: boolean; envKey: string }
interface ScreenVerdict {
  screened: boolean; usable: boolean; typeLegibility: number;
  subjectCentred: boolean; hasBakedText: boolean; note: string; sourceWidth?: number;
}
interface Plate {
  engine: string; label: string; ok: boolean; url?: string; storedUrl?: string | null;
  model?: string; nativeWidth?: number; upscaled?: boolean; error?: string;
  mirrorError?: string | null; latencyMs: number; screen?: ScreenVerdict;
}
interface CopyResult {
  provider: string; label: string; ok: boolean;
  copy?: Record<string, string>; overLimit?: string[]; error?: string; latencyMs: number;
}
type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
interface Job {
  id: string; status: JobStatus;
  brief: { name: string; offer: string; style: string; promoCode?: string };
  slot: string; error: string | null;
  cancel_requested: boolean; cancelled_while_running: boolean;
  created_at: string; started_at: string | null; finished_at: string | null;
  result?: {
    plates: Plate[]; copy: CopyResult[];
    summary: { platesOk: number; platesTotal: number; copyOk: number; copyTotal: number; mirrored?: number };
  } | null;
}

const ACCENT = "#e98d20";
const PAGE   = 8;

const STATUS_COLOR: Record<JobStatus, string> = {
  queued: "#64748b", running: ACCENT, done: "#4ade80", failed: "#f43f5e", cancelled: "#94a3b8",
};

// ── Chrome ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.45rem 0.65rem", color: "#e2e8f0", fontSize: 12.5, outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.7rem" }}>
      <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 10, color: "#475569", marginTop: "0.25rem", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function ScreenBadge({ v }: { v?: ScreenVerdict }) {
  if (!v) return null;
  if (!v.screened) {
    return <span style={{ fontSize: 10, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Eye size={10} /> not screened
    </span>;
  }
  const bad = !v.usable;
  const color = bad ? "#f43f5e" : v.typeLegibility >= 70 ? "#4ade80" : "#eab308";
  return (
    <span title={v.note} style={{
      fontSize: 10, color, display: "inline-flex", alignItems: "center", gap: 4,
      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {bad ? <X size={10} /> : <Check size={10} />}type {v.typeLegibility}
      {v.hasBakedText && " · baked text"}{!v.subjectCentred && " · off-centre"}
    </span>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

/** One row in the queue or the history list. */
function JobRow({ job, selected, onSelect, onCancel }: {
  job: Job; selected: boolean; onSelect: () => void; onCancel?: () => void;
}) {
  const active = job.status === "queued" || job.status === "running";
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
        background: selected ? `${ACCENT}14` : "rgba(255,255,255,0.02)",
        border: selected ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.05)",
        borderRadius: 8, padding: "0.45rem 0.6rem", marginBottom: "0.3rem",
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: 3, flexShrink: 0,
        background: STATUS_COLOR[job.status],
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700, color: selected ? ACCENT : "#cbd5e1",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{job.brief?.name ?? "Untitled"}</div>
        <div style={{ fontSize: 9.5, color: "#475569", marginTop: 1 }}>
          {job.status === "running" ? "running…" : job.status}
          {" · "}{job.brief?.style}
          {" · "}{when(job.created_at)}
        </div>
      </div>
      {job.status === "running" && <Loader2 size={11} color={ACCENT} className="spin" />}
      {active && onCancel && (
        <button
          onClick={e => { e.stopPropagation(); onCancel(); }}
          title="Cancel"
          style={{
            cursor: "pointer", background: "transparent", border: "none",
            color: "#64748b", padding: 2, display: "flex", flexShrink: 0,
          }}
        ><X size={13} /></button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const [slots,   setSlots]   = useState<Slot[]>([]);
  const [styles,  setStyles]  = useState<Style[]>([]);
  const [engines, setEngines] = useState<EngineInfo[]>([]);

  const [brief, setBrief] = useState({
    name: "", offer: "", promoCode: "", startDate: "", endDate: "",
    angle: "", season: "", style: "lifestyle",
  });

  const [active,  setActive]  = useState<Job[]>([]);
  const [history, setHistory] = useState<Job[]>([]);
  const [page,    setPage]    = useState(0);
  const [total,   setTotal]   = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job,        setJob]        = useState<Job | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [queueing,   setQueueing]   = useState(false);
  const [helpOpen,   setHelpOpen]   = useState(true);
  const [packaging,  setPackaging]  = useState(false);

  // ── Prefill from the sales calendar ─────────────────────────────────────────
  // Arriving as ?planId=… means "this brief is for that planned sale". The brief
  // is a DRAFT: it fills the form and stops. Nothing generates until the button
  // is pressed, because every run spends money across three image engines.
  //
  // Read on mount from window.location, deliberately NOT useSearchParams — that
  // hook opts a statically-prerendered route into client-only rendering, which is
  // the measured reason the Command Center avoids it too. The calendar links here
  // with a plain anchor so this page gets a real load and the read is reliable.
  const [planId,       setPlanId]       = useState<string | null>(null);
  const [planTitle,    setPlanTitle]    = useState<string | null>(null);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);

  useEffect(() => {
    setPlanId(new URLSearchParams(window.location.search).get("planId"));
  }, []);

  const [pickedPlate, setPickedPlate] = useState<string | null>(null);
  const [pickedCopy,  setPickedCopy]  = useState(0);
  const [viewport,    setViewport]    = useState<"desktop" | "mobile">("desktop");
  const [previewSrc,  setPreviewSrc]  = useState<string | null>(null);
  const [previewing,  setPreviewing]  = useState(false);

  // The hand-off prompt. Editable, because the point of it is that a human is
  // about to take this somewhere else and will want to push on the wording.
  const [promptOpen,    setPromptOpen]    = useState(false);
  const [promptText,    setPromptText]    = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [copied,        setCopied]        = useState(false);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/marketing-calendar/plan/${planId}/brief`);
        const d = await r.json();
        if (cancelled || d.error) return;
        setBrief({
          name:      d.brief.name      ?? "",
          offer:     d.brief.offer     ?? "",
          promoCode: d.brief.promoCode ?? "",
          startDate: d.brief.startDate ?? "",
          endDate:   d.brief.endDate   ?? "",
          angle:     d.brief.angle     ?? "",
          season:    d.brief.season    ?? "",
          style:     d.brief.style     ?? "lifestyle",
        });
        setPlanTitle(d.brief.name ?? null);
        setPlanWarnings(d.warnings ?? []);
      } catch { /* the form still works unfilled */ }
    })();
    return () => { cancelled = true; };
  }, [planId]);

  // ── Reference data ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BOT_URL}/admin/promotions/slots`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setStyles(d.styles ?? []); setEngines(d.engines ?? []); })
      .catch(() => setError("Could not reach the promotions API."));
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const d = await (await fetch(`${BOT_URL}/admin/promotions/jobs?view=active&limit=25`)).json();
      setActive(d.jobs ?? []);
      return (d.jobs ?? []) as Job[];
    } catch { return []; }
  }, []);

  const loadHistory = useCallback(async (p: number) => {
    try {
      const d = await (await fetch(`${BOT_URL}/admin/promotions/jobs?view=history&limit=${PAGE}&offset=${p * PAGE}`)).json();
      setHistory(d.jobs ?? []); setTotal(d.total ?? 0);
    } catch { /* leave the list as it was */ }
  }, []);

  useEffect(() => { void loadActive(); }, [loadActive]);
  useEffect(() => { void loadHistory(page); }, [page, loadHistory]);

  const refreshSelected = useCallback(async (id: string) => {
    try {
      const d = await (await fetch(`${BOT_URL}/admin/promotions/jobs/${id}`)).json();
      if (!d.job) return;
      setJob(d.job);
      const plates: Plate[] = d.job.result?.plates ?? [];
      const best = plates.find(p => p.ok && p.screen?.usable !== false) ?? plates.find(p => p.ok);
      setPickedPlate(best?.storedUrl ?? best?.url ?? null);
      setPickedCopy(0);
    } catch { /* ignore */ }
  }, []);

  // Poll only while something is actually in flight. A queue at rest does not
  // need a heartbeat, and this page is often left open.
  const prevActive = useRef(0);
  useEffect(() => {
    if (!active.length) return;
    const t = setInterval(async () => {
      const now = await loadActive();
      // Something finished — refresh history and pull the finished job into view.
      if (now.length < prevActive.current) {
        void loadHistory(page);
        if (selectedId) void refreshSelected(selectedId);
      }
      prevActive.current = now.length;
    }, 3000);
    prevActive.current = active.length;
    return () => clearInterval(t);
  }, [active.length, page, selectedId, loadActive, loadHistory, refreshSelected]);

  const select = useCallback((id: string) => {
    setSelectedId(id); setJob(null); setPreviewSrc(null);
    setPromptOpen(false); setPromptText(""); setCopied(false);
    void refreshSelected(id);
  }, [refreshSelected]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const queue = useCallback(async () => {
    setQueueing(true); setError(null); setNotice(null);
    try {
      // With a linked sale the run goes through the calendar, which records the
      // job id against the plan row and advances it out of `planned`. Without one
      // it is an ad-hoc brief and goes straight to the studio queue.
      const r = planId
        ? await fetch(`${BOT_URL}/admin/marketing-calendar/plan/${planId}/generate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brief, slot: "hero_plate" }),
          })
        : await fetch(`${BOT_URL}/admin/promotions/jobs`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...brief, slot: "hero_plate" }),
          });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not queue");
      setNotice(`Queued "${d.job.brief.name}".`);
      await loadActive();
      select(d.job.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setQueueing(false); }
  }, [brief, loadActive, select, planId]);

  /**
   * Cancel. The server's note is shown verbatim rather than a flat "cancelled",
   * because the two cases genuinely differ: a queued job stops clean, a running
   * one has already committed spend upstream that nobody can recall.
   */
  const cancel = useCallback(async (id: string) => {
    try {
      const d = await (await fetch(`${BOT_URL}/admin/promotions/jobs/${id}/cancel`, { method: "POST" })).json();
      setNotice(d.note ?? "Cancel requested.");
      await loadActive(); await loadHistory(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadActive, loadHistory, page]);

  const downloadPackage = useCallback(async () => {
    if (!job) return;
    setPackaging(true); setError(null);
    try {
      const plates: Plate[] = job.result?.plates ?? [];
      const chosen = plates.find(p => (p.storedUrl ?? p.url) === pickedPlate);
      const okCopies = (job.result?.copy ?? []).filter(c => c.ok);

      const r = await fetch(`${BOT_URL}/admin/promotions/jobs/${job.id}/package`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: chosen?.engine,
          copyProvider: okCopies[pickedCopy]?.provider,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Packaging failed");

      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const name = r.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1];
      a.href = url; a.download = name ?? "promo-package.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setPackaging(false); }
  }, [job, pickedPlate, pickedCopy]);

  /**
   * The prompt for taking this plate somewhere else.
   *
   * Fetched rather than assembled here: the style recipes, the safe-area
   * percentages and the product description all live in `promo-studio/spec.ts`,
   * and a second copy of them in the dashboard would be wrong within a month.
   */
  const togglePrompt = useCallback(async () => {
    if (!job) return;
    if (promptOpen) { setPromptOpen(false); return; }
    setPromptLoading(true); setError(null); setCopied(false);
    try {
      const d = await (await fetch(`${BOT_URL}/admin/promotions/jobs/${job.id}/image-prompt`)).json();
      if (d.error) throw new Error(d.error);
      setPromptText(d.prompt ?? "");
      setPromptOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setPromptLoading(false); }
  }, [job, promptOpen]);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright. The text is already in a
      // textarea, so say so rather than failing silently.
      setNotice("Could not reach the clipboard — select the text and copy it by hand.");
    }
  }, [promptText]);

  /**
   * ChatGPT takes a prefilled prompt in `?q=`. It is copied to the clipboard on
   * the way out regardless, because a long prompt can be dropped by the URL and
   * a paste always works.
   */
  const openInChatGPT = useCallback(() => {
    void navigator.clipboard.writeText(promptText).catch(() => {});
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(promptText)}`, "_blank", "noopener,noreferrer");
  }, [promptText]);

  // ── Preview ─────────────────────────────────────────────────────────────────
  const chosenCopy = useMemo(() => {
    const ok = job?.result?.copy.filter(c => c.ok) ?? [];
    return ok[pickedCopy]?.copy ?? {};
  }, [job, pickedCopy]);

  useEffect(() => {
    if (!pickedPlate) { setPreviewSrc(null); return; }
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewing(true);

    fetch(`${BOT_URL}/admin/promotions/preview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: pickedPlate, copy: chosenCopy, viewport }),
    })
      .then(r => { if (!r.ok) throw new Error("preview failed"); return r.blob(); })
      .then(b => { if (cancelled) return; objectUrl = URL.createObjectURL(b); setPreviewSrc(objectUrl); })
      .catch(() => { if (!cancelled) setPreviewSrc(null); })
      .finally(() => { if (!cancelled) setPreviewing(false); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);   // or it leaks on every change
    };
  }, [pickedPlate, chosenCopy, viewport]);

  const activeStyle = useMemo(() => styles.find(s => s.key === brief.style), [styles, brief.style]);
  const okCopy      = job?.result?.copy.filter(c => c.ok) ?? [];
  const blocked     = slots.filter(s => !s.publishable);
  const pages       = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      {/* How this works. Three steps, collapsible — it is orientation for a
          first-timer, not something a regular should have to scroll past. */}
      <div style={{
        marginBottom: "1.25rem", background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
        padding: helpOpen ? "0.9rem 1rem" : "0.6rem 1rem",
      }}>
        <button
          onClick={() => setHelpOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: "0.45rem", width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "#cbd5e1", fontSize: 12, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}
        >
          <ChevronDown size={13} style={{
            transform: helpOpen ? "none" : "rotate(-90deg)", transition: "transform .15s",
          }} />
          How this works
        </button>

        {helpOpen && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "1rem", marginTop: "0.85rem",
          }}>
            {[
              ["1", "Describe the sale",
               "Fill in the offer on the left, pick a look, and add it to the queue. It runs in the background — usually a minute or two. You can close the tab."],
              ["2", "Pick what you like",
               "Each image engine gets one attempt, so you get a few different takes, plus three versions of the wording. Judge them in the preview — that is the real homepage, scrim and all."],
              ["3", "Download and follow the steps",
               "The zip has the images, the wording, and a START-HERE file with numbered instructions and direct links into Shopify. No guesswork needed."],
            ].map(([n, title, body]) => (
              <div key={n} style={{ display: "flex", gap: "0.6rem" }}>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: 10,
                  background: `${ACCENT}20`, color: ACCENT, fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{n}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 2 }}>{title}</div>
                  <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {helpOpen && blocked.length > 0 && (
          <div style={{
            display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "0.9rem",
            paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            <AlertTriangle size={13} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
              Everything is uploaded to Shopify by hand for now — this tool makes the files and the
              text, it does not publish them. {blocked.map(s => s.label).join(" and ")}{" "}
              {blocked.length === 1 ? "has" : "have"} no field on the marketing event yet, so{" "}
              {blocked.length === 1 ? "it is" : "they are"} noted in the zip rather than entered.
            </p>
          </div>
        )}
      </div>

      {notice && (
        <div style={{
          marginBottom: "1rem", background: "rgba(74,222,128,0.06)",
          border: "1px solid rgba(74,222,128,0.18)", borderRadius: 10, padding: "0.7rem 0.85rem",
          display: "flex", justifyContent: "space-between", gap: "1rem",
        }}>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{notice}</p>
          <button onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
            <X size={13} />
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* ── Left rail: brief, queue, history ─────────────────────────────── */}
        <div>
          {planTitle && (
            <div style={{
              ...CARD, marginBottom: "0.75rem", padding: "0.75rem",
              borderColor: `${ACCENT}35`, background: "rgba(233,141,32,0.05)",
            }}>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <CalendarDays size={12} /> From the sales calendar
              </p>
              <p style={{ fontSize: 11.5, color: "#cbd5e1", marginTop: "0.25rem", lineHeight: 1.5 }}>
                Prefilled for <strong>{planTitle}</strong>. Edit anything below — this run
                will be recorded against that sale.
              </p>
              {planWarnings.map((w, i) => (
                <p key={i} style={{ fontSize: 10.5, color: "#eab308", marginTop: "0.35rem", lineHeight: 1.5 }}>
                  <AlertTriangle size={10} style={{ display: "inline", marginRight: 3 }} />{w}
                </p>
              ))}
              <a href="/marketing/calendar" style={{ fontSize: 10.5, color: "#64748b", marginTop: "0.4rem", display: "inline-block" }}>
                ← back to the calendar
              </a>
            </div>
          )}

          <Panel title={planTitle ? "Brief" : "New promotion"}>
            <Field label="Event name">
              <input style={inputStyle} value={brief.name} placeholder="Black Friday 2026"
                onChange={e => setBrief({ ...brief, name: e.target.value })} />
            </Field>
            <Field label="Offer">
              <input style={inputStyle} value={brief.offer} placeholder="20% off sitewide"
                onChange={e => setBrief({ ...brief, offer: e.target.value })} />
            </Field>
            <Field label="Promo code" hint="Blank if it applies automatically.">
              <input style={inputStyle} value={brief.promoCode} placeholder="BF2026"
                onChange={e => setBrief({ ...brief, promoCode: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field label="Starts">
                <input type="date" style={inputStyle} value={brief.startDate}
                  onChange={e => setBrief({ ...brief, startDate: e.target.value })} />
              </Field>
              <Field label="Ends">
                <input type="date" style={inputStyle} value={brief.endDate}
                  onChange={e => setBrief({ ...brief, endDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Angle" hint="Optional. One sentence — what this sale is really about.">
              <textarea style={{ ...inputStyle, minHeight: 52, resize: "vertical" }} value={brief.angle}
                onChange={e => setBrief({ ...brief, angle: e.target.value })} />
            </Field>

            <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem" }}>Style</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.5rem" }}>
              {styles.map(s => {
                const on = s.key === brief.style;
                return (
                  <button key={s.key} onClick={() => setBrief({ ...brief, style: s.key })}
                    style={{
                      textAlign: "left", cursor: "pointer",
                      background: on ? `${ACCENT}18` : "rgba(255,255,255,0.03)",
                      border: on ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 7, padding: "0.4rem 0.6rem",
                    }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: on ? ACCENT : "#cbd5e1" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 1, lineHeight: 1.35 }}>{s.blurb}</div>
                  </button>
                );
              })}
            </div>

            {brief.style === "seasonal" && (
              <Field label="Season" hint="'Black Friday', 'Memorial Day', 'midwinter'.">
                <input style={inputStyle} value={brief.season}
                  onChange={e => setBrief({ ...brief, season: e.target.value })} />
              </Field>
            )}

            <button onClick={queue} disabled={queueing || !brief.name.trim() || !brief.offer.trim()}
              style={{
                width: "100%", cursor: queueing ? "wait" : "pointer", marginTop: "0.5rem",
                background: ACCENT, color: "#1a1a1a", border: "none", borderRadius: 9,
                padding: "0.65rem", fontSize: 12.5, fontWeight: 800,
                textTransform: "uppercase", letterSpacing: "0.06em",
                opacity: (!brief.name.trim() || !brief.offer.trim()) ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem",
              }}>
              {queueing ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
              {queueing ? "Queueing…" : "Add to queue"}
            </button>

            {activeStyle && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.5rem", lineHeight: 1.45 }}>
                {activeStyle.engines.map(e => engines.find(x => x.id === e)?.label ?? e).join(" + ")} + 3 copy
                providers. Typically 50–220s — it runs in the background, you can close this.
              </p>
            )}
          </Panel>

          <Panel title={`Queue${active.length ? ` — ${active.length}` : ""}`}
                 note={active.length ? "Runs one at a time, oldest first." : undefined}>
            {active.length === 0
              ? <p style={{ fontSize: 11.5, color: "#475569" }}>Nothing running.</p>
              : active.map(j => (
                  <JobRow key={j.id} job={j} selected={j.id === selectedId}
                    onSelect={() => select(j.id)} onCancel={() => cancel(j.id)} />
                ))}
          </Panel>

          <Panel
            title="Completed"
            right={total > PAGE ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ background: "none", border: "none", cursor: page === 0 ? "default" : "pointer",
                           color: page === 0 ? "#334155" : "#94a3b8", padding: 0, display: "flex" }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 10, color: "#64748b" }}>{page + 1}/{pages}</span>
                <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                  style={{ background: "none", border: "none", cursor: page >= pages - 1 ? "default" : "pointer",
                           color: page >= pages - 1 ? "#334155" : "#94a3b8", padding: 0, display: "flex" }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : undefined}
          >
            {history.length === 0
              ? <p style={{ fontSize: 11.5, color: "#475569" }}>No finished runs yet.</p>
              : history.map(j => (
                  <JobRow key={j.id} job={j} selected={j.id === selectedId} onSelect={() => select(j.id)} />
                ))}
            {total > 0 && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.5rem" }}>{total} total</p>
            )}
          </Panel>
        </div>

        {/* ── Right: the selected job ──────────────────────────────────────── */}
        <div>
          {error && <div style={{ marginBottom: "1.25rem" }}><EmptyState reason={error} /></div>}

          {!job && (
            <Panel title="Preview" note="The plate shown inside the real homepage hero.">
              <EmptyState reason={
                selectedId ? "Loading…"
                : "Fill in the offer and add it to the queue. Finished runs stay in Completed on the left."
              } />
            </Panel>
          )}

          {job && job.status !== "done" && (
            <Panel title={job.brief?.name ?? "Job"}>
              {job.status === "running" || job.status === "queued" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0" }}>
                  {job.status === "running"
                    ? <Loader2 size={15} color={ACCENT} className="spin" />
                    : <Clock size={15} color="#64748b" />}
                  <p style={{ fontSize: 12.5, color: "#94a3b8" }}>
                    {job.status === "running"
                      ? "Generating — plates and copy are running in parallel. Usually 50–220s."
                      : "Queued. It starts when the job ahead of it finishes."}
                    {job.cancel_requested && " Cancellation requested; stopping at the next checkpoint."}
                  </p>
                </div>
              ) : (
                <EmptyState reason={
                  job.status === "cancelled"
                    ? (job.cancelled_while_running
                        ? "Cancelled after it had started. The image tasks already sent upstream still completed and still billed — we stopped waiting and discarded the result."
                        : "Cancelled before it started. Nothing was spent.")
                    : job.error ?? "This run failed."
                } />
              )}
            </Panel>
          )}

          {job?.status === "done" && job.result && (
            <>
              <Panel
                title="Preview"
                note="Real hero geometry: 35% scrim, centred white type, BUY NOW, banner strip over the bottom."
                right={
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {(["desktop", "mobile"] as const).map(v => (
                      <button key={v} onClick={() => setViewport(v)}
                        style={{
                          cursor: "pointer", background: viewport === v ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                          border: viewport === v ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.06)",
                          color: viewport === v ? ACCENT : "#64748b",
                          borderRadius: 6, padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", gap: 4,
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        }}>
                        {v === "desktop" ? <Monitor size={11} /> : <Smartphone size={11} />}{v}
                      </button>
                    ))}
                  </div>
                }
              >
                <div style={{
                  position: "relative", background: "#111", borderRadius: 8, overflow: "hidden",
                  minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {previewing && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                                  justifyContent: "center", background: "rgba(0,0,0,0.5)", zIndex: 2 }}>
                      <RefreshCw size={18} color={ACCENT} className="spin" />
                    </div>
                  )}
                  {previewSrc
                    ? <img src={previewSrc} alt="Hero preview" style={{ width: viewport === "mobile" ? 390 : "100%", display: "block" }} />
                    : <p style={{ fontSize: 12, color: "#475569", padding: "2rem" }}>Pick a plate below.</p>}
                </div>

                {pickedPlate && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.85rem" }}>
                    <button onClick={downloadPackage} disabled={packaging}
                      style={{
                        cursor: packaging ? "wait" : "pointer",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#cbd5e1", borderRadius: 8, padding: "0.55rem 0.95rem",
                        fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.45rem",
                      }}>
                      {packaging ? <RefreshCw size={12} className="spin" /> : <Package size={12} />}
                      {packaging ? "Building package…" : "Download package (.zip)"}
                    </button>

                    {/* The escape hatch for when all three engines miss. */}
                    <button onClick={togglePrompt} disabled={promptLoading}
                      style={{
                        cursor: promptLoading ? "wait" : "pointer",
                        background: promptOpen ? `${ACCENT}18` : "rgba(255,255,255,0.05)",
                        border: promptOpen ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.1)",
                        color: promptOpen ? ACCENT : "#cbd5e1", borderRadius: 8, padding: "0.55rem 0.95rem",
                        fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.45rem",
                      }}>
                      {promptLoading ? <RefreshCw size={12} className="spin" /> : <MessageSquare size={12} />}
                      Prompt an LLM for the image
                    </button>
                  </div>
                )}

                {promptOpen && (
                  <div style={{
                    marginTop: "0.75rem", background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.7rem",
                  }}>
                    <p style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: "0.5rem", lineHeight: 1.5 }}>
                      The same brief the engines got, written for a chat model — including the framing rule
                      the plates keep breaking. Edit it if you want, then paste it into ChatGPT, Gemini or
                      anything else that makes images. Bring the file back and upload it to Shopify in place
                      of <code style={{ color: "#cbd5e1" }}>hero_3840.webp</code>.
                    </p>
                    <textarea
                      value={promptText}
                      onChange={e => setPromptText(e.target.value)}
                      spellCheck={false}
                      style={{
                        ...inputStyle, minHeight: 190, resize: "vertical", lineHeight: 1.5,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11,
                      }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      <button onClick={copyPrompt}
                        style={{
                          cursor: "pointer", background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)", color: copied ? "#4ade80" : "#cbd5e1",
                          borderRadius: 8, padding: "0.45rem 0.8rem", fontSize: 11, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        }}>
                        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}
                      </button>
                      <button onClick={openInChatGPT}
                        style={{
                          cursor: "pointer", background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`,
                          color: ACCENT, borderRadius: 8, padding: "0.45rem 0.8rem", fontSize: 11, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        }}>
                        <ExternalLink size={12} />Open in ChatGPT
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 10, color: "#475569", marginTop: "0.45rem", lineHeight: 1.45 }}>
                  Contains the four image sizes Shopify needs, both previews, every event field with the
                  exact text to paste, and numbered setup steps with direct links into the admin.
                </p>
              </Panel>

              <Panel title="Plates" note={
                `${job.result.summary.platesOk} of ${job.result.summary.platesTotal} engines returned. ` +
                `Each engine gets one swing — different models fail in different ways, which is the point.`
              }>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "0.75rem" }}>
                  {job.result.plates.map(p => {
                    const src    = p.storedUrl ?? p.url;
                    const picked = src === pickedPlate;
                    return (
                      <motion.div key={p.engine} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => p.ok && src && setPickedPlate(src)}
                        style={{ ...CARD, padding: "0.55rem", cursor: p.ok ? "pointer" : "default",
                                 border: picked ? `1px solid ${ACCENT}` : CARD.border }}>
                        <div style={{ aspectRatio: "4/1", background: "#0b0b0b", borderRadius: 6,
                                      overflow: "hidden", marginBottom: "0.45rem",
                                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {p.ok && src
                            ? <img src={src} alt={p.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <X size={16} color="#f43f5e" />}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: picked ? ACCENT : "#cbd5e1" }}>{p.label}</span>
                          <ScreenBadge v={p.screen} />
                        </div>
                        {!p.ok && <p style={{ fontSize: 10, color: "#f43f5e", marginTop: "0.3rem", lineHeight: 1.4 }}>{p.error}</p>}
                        {p.ok && (
                          <p style={{ fontSize: 10, color: "#475569", marginTop: "0.3rem" }}>
                            {p.nativeWidth}px native{p.upscaled && " · upscaled"} · {(p.latencyMs / 1000).toFixed(0)}s
                            {p.storedUrl === null && " · not archived, link expires"}
                          </p>
                        )}
                        {p.ok && p.storedUrl === null && p.mirrorError && (
                          <p style={{ fontSize: 10, color: "#b45309", marginTop: "0.25rem", lineHeight: 1.4 }}>
                            Archiving failed: {p.mirrorError}
                          </p>
                        )}
                        {p.screen?.screened && p.screen.note && (
                          <p style={{ fontSize: 10, color: "#64748b", marginTop: "0.25rem", lineHeight: 1.4 }}>{p.screen.note}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Copy" note={
                `${job.result.summary.copyOk} of ${job.result.summary.copyTotal} providers returned. ` +
                `Voices differ — Claude restrained, GPT punchier, Gemini blunter.`
              }>
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
                  {okCopy.map((c, i) => (
                    <button key={c.provider} onClick={() => setPickedCopy(i)}
                      style={{
                        cursor: "pointer",
                        background: pickedCopy === i ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                        border: pickedCopy === i ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.06)",
                        color: pickedCopy === i ? ACCENT : "#64748b",
                        borderRadius: 6, padding: "0.3rem 0.7rem", fontSize: 11, fontWeight: 700,
                      }}>
                      {c.label}{c.overLimit?.length ? " ⚠" : ""}
                    </button>
                  ))}
                </div>

                {okCopy[pickedCopy]?.overLimit?.length ? (
                  <div style={{ marginBottom: "0.85rem" }}>
                    <EmptyState reason={`Over the character limit: ${okCopy[pickedCopy]!.overLimit!.join(", ")}. Not truncated — a clipped headline is your call, and cutting it silently would hide that the model ignored the cap.`} />
                  </div>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {slots.filter(s => s.kind !== "image").map(s => {
                    const v = chosenCopy[s.key] ?? "";
                    const len = v.replace(/<[^>]+>/g, "").length;
                    const over = s.maxChars ? len > s.maxChars : false;
                    return (
                      <div key={s.key} style={{
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 8, padding: "0.55rem 0.7rem",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                          <span style={{ ...LABEL, fontSize: 10 }}>
                            {s.label}
                            {s.metaobjectField
                              ? <span style={{ color: "#4ade80", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>→ {s.metaobjectField}</span>
                              : <span style={{ color: "#b45309", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>no field yet</span>}
                          </span>
                          <span style={{ fontSize: 10, color: over ? "#f43f5e" : "#475569" }}>{len}/{s.maxChars}</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.45,
                                    fontFamily: s.kind === "html" ? "ui-monospace, monospace" : undefined }}>
                          {v || <span style={{ color: "#475569" }}>—</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .spin { animation: pstudio-spin 1s linear infinite; }
        @keyframes pstudio-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
