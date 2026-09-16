"use client";
/**
 * Marketing → Promotions (Promo Studio)
 *
 * Brief in, promotional material out. A team member types the offer, picks a
 * visual style, and gets background plates from several image engines plus copy
 * sets from several text providers — then judges them in a faithful mock of the
 * real homepage hero rather than in isolation.
 *
 * WHY THE PREVIEW IS THE CENTRE OF THE SCREEN
 * -------------------------------------------
 * The live hero lays a dark scrim over the whole image and centres white type on
 * top. A plate judged as a bare thumbnail looks great and then turns out to have
 * the headline sitting on someone's face. The preview rebuilds the scrim, the
 * type, the BUY NOW button and the banner strip, so what you approve is what ships.
 *
 * WHY NOTHING PUBLISHES YET
 * -------------------------
 * Three of the five slots have no field on the `marketing_event` metaobject —
 * the backend reports which, and the UI says so plainly rather than offering a
 * button that cannot work. Download and paste until the fields exist.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, Download, RefreshCw, AlertTriangle, Check, X,
  Monitor, Smartphone, Eye,
} from "lucide-react";
import { BOT_URL, CARD, LABEL, Panel, EmptyState } from "@/components/MarketingShared";

// ── Types mirroring /admin/promotions ─────────────────────────────────────────

interface Slot {
  key: string; label: string; kind: "image" | "text" | "html";
  metaobjectField: string | null; publishable: boolean; blockedReason: string | null;
  width?: number; height?: number; maxChars?: number; brief: string;
}
interface Style {
  key: string; label: string; blurb: string; productVisible: boolean;
  engines: string[]; typeTreatment: string; useWhen: string;
}
interface EngineInfo { id: string; label: string; strength: string; configured: boolean; envKey: string }
interface ScreenVerdict {
  screened: boolean; usable: boolean; typeLegibility: number;
  subjectCentred: boolean; hasBakedText: boolean; note: string;
}
interface Plate {
  engine: string; label: string; ok: boolean; url?: string; model?: string;
  nativeWidth?: number; upscaled?: boolean; error?: string; latencyMs: number;
  screen?: ScreenVerdict;
}
interface CopyResult {
  provider: string; label: string; ok: boolean;
  copy?: Record<string, string>; overLimit?: string[]; error?: string; latencyMs: number;
}
interface GenerateResponse {
  brief: Record<string, unknown>; slot: string;
  plates: Plate[]; copy: CopyResult[];
  summary: { platesOk: number; platesTotal: number; copyOk: number; copyTotal: number };
}
interface CalendarEvent { id: string; name: string; startDate: string | null; endDate: string | null; promoCode: string | null }
interface CalendarResponse {
  available: boolean; events: CalendarEvent[];
  overlaps: { a: string; b: string; note: string }[]; error?: string;
}

const ACCENT = "#e98d20";

// ── Small chrome ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
  padding: "0.5rem 0.7rem", color: "#e2e8f0", fontSize: 13, outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <label style={{ ...LABEL, display: "block", marginBottom: "0.35rem" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 10.5, color: "#475569", marginTop: "0.3rem", lineHeight: 1.45 }}>{hint}</p>}
    </div>
  );
}

/** A screener verdict, rendered so a human can disagree with it at a glance. */
function ScreenBadge({ v }: { v?: ScreenVerdict }) {
  if (!v) return null;
  if (!v.screened) {
    return (
      <span style={{ fontSize: 10, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Eye size={10} /> not screened
      </span>
    );
  }
  const bad = !v.usable;
  const color = bad ? "#f43f5e" : v.typeLegibility >= 70 ? "#4ade80" : "#eab308";
  return (
    <span
      title={v.note}
      style={{
        fontSize: 10, color, display: "inline-flex", alignItems: "center", gap: 4,
        fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      }}
    >
      {bad ? <X size={10} /> : <Check size={10} />}
      type {v.typeLegibility}
      {v.hasBakedText && " · baked text"}
      {!v.subjectCentred && " · off-centre"}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const [slots,   setSlots]   = useState<Slot[]>([]);
  const [styles,  setStyles]  = useState<Style[]>([]);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);

  const [brief, setBrief] = useState({
    name: "", offer: "", promoCode: "", startDate: "", endDate: "",
    angle: "", season: "", style: "lifestyle",
  });

  const [result,   setResult]   = useState<GenerateResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const [pickedPlate, setPickedPlate] = useState<string | null>(null);
  const [pickedCopy,  setPickedCopy]  = useState<number>(0);
  const [viewport,    setViewport]    = useState<"desktop" | "mobile">("desktop");
  const [previewSrc,  setPreviewSrc]  = useState<string | null>(null);
  const [previewing,  setPreviewing]  = useState(false);

  // ── Load reference data ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BOT_URL}/admin/promotions/slots`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setStyles(d.styles ?? []); setEngines(d.engines ?? []); })
      .catch(() => setError("Could not reach the promotions API."));

    fetch(`${BOT_URL}/admin/promotions/calendar`)
      .then(r => r.json()).then(setCalendar).catch(() => {});
  }, []);

  const activeStyle = useMemo(() => styles.find(s => s.key === brief.style), [styles, brief.style]);

  const chosenCopy = useMemo(() => {
    const ok = result?.copy.filter(c => c.ok) ?? [];
    return ok[pickedCopy]?.copy ?? {};
  }, [result, pickedCopy]);

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    setPickedPlate(null); setPickedCopy(0); setPreviewSrc(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/promotions/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brief, slot: "hero_plate" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Generation failed");
      setResult(d);
      const firstGood = d.plates.find((p: Plate) => p.ok && p.url && p.screen?.usable !== false)
        ?? d.plates.find((p: Plate) => p.ok && p.url);
      if (firstGood?.url) setPickedPlate(firstGood.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [brief]);

  // ── Preview — re-renders whenever the plate, the copy or the viewport moves ──
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
      .then(b => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setPreviewSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setPreviewSrc(null); })
      .finally(() => { if (!cancelled) setPreviewing(false); });

    return () => {
      cancelled = true;
      // Revoke on replacement, or the blob leaks on every keystroke-driven re-render.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pickedPlate, chosenCopy, viewport]);

  const download = useCallback(async () => {
    if (!pickedPlate) return;
    const r = await fetch(`${BOT_URL}/admin/promotions/render`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: pickedPlate, slot: "hero_plate" }),
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hero_plate-3840x960.webp";
    a.click();
    URL.revokeObjectURL(url);
  }, [pickedPlate]);

  const okCopy = result?.copy.filter(c => c.ok) ?? [];
  const blockedSlots = slots.filter(s => !s.publishable);

  return (
    <div>
      {/* ── The standing caveat. Not an error — a fact about the backend. ── */}
      {blockedSlots.length > 0 && (
        <div style={{
          display: "flex", gap: "0.6rem", alignItems: "flex-start", marginBottom: "1.25rem",
          background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.18)",
          borderRadius: 10, padding: "0.85rem",
        }}>
          <AlertTriangle size={14} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
            <strong style={{ color: "#cbd5e1" }}>Download and paste for now.</strong>{" "}
            {blockedSlots.map(s => s.label).join(", ")} {blockedSlots.length === 1 ? "has" : "have"} no
            field on the <code style={{ color: ACCENT }}>marketing_event</code> metaobject yet, so nothing
            can be pushed to Shopify automatically. The banner and top-bar text do have fields — those
            can be pasted straight into the event entry.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* ── Brief ───────────────────────────────────────────────────────── */}
        <div>
          <Panel title="The offer" note="Everything else is derived from this.">
            <Field label="Event name">
              <input style={inputStyle} value={brief.name} placeholder="Black Friday 2026"
                onChange={e => setBrief({ ...brief, name: e.target.value })} />
            </Field>
            <Field label="Offer">
              <input style={inputStyle} value={brief.offer} placeholder="20% off sitewide"
                onChange={e => setBrief({ ...brief, offer: e.target.value })} />
            </Field>
            <Field label="Promo code" hint="Leave blank if the discount applies automatically.">
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
            <Field label="Angle" hint="Optional. One sentence of intent — what this sale is really about.">
              <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={brief.angle}
                onChange={e => setBrief({ ...brief, angle: e.target.value })} />
            </Field>
          </Panel>

          <Panel title="Style" note={activeStyle?.useWhen}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {styles.map(s => {
                const active = s.key === brief.style;
                return (
                  <button key={s.key} onClick={() => setBrief({ ...brief, style: s.key })}
                    style={{
                      textAlign: "left", cursor: "pointer",
                      background: active ? `${ACCENT}18` : "rgba(255,255,255,0.03)",
                      border: active ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "0.5rem 0.7rem",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? ACCENT : "#cbd5e1" }}>{s.label}</div>
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{s.blurb}</div>
                  </button>
                );
              })}
            </div>
            {brief.style === "seasonal" && (
              <div style={{ marginTop: "0.75rem" }}>
                <Field label="Season" hint="Fills the colour story — 'Black Friday', 'Memorial Day', 'midwinter'.">
                  <input style={inputStyle} value={brief.season}
                    onChange={e => setBrief({ ...brief, season: e.target.value })} />
                </Field>
              </div>
            )}
          </Panel>

          <button
            onClick={generate}
            disabled={loading || !brief.name.trim() || !brief.offer.trim()}
            style={{
              width: "100%", cursor: loading ? "wait" : "pointer",
              background: ACCENT, color: "#1a1a1a", border: "none", borderRadius: 10,
              padding: "0.75rem", fontSize: 13, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.06em",
              opacity: (!brief.name.trim() || !brief.offer.trim()) ? 0.4 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            }}>
            {loading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
            {loading ? "Generating…" : "Generate"}
          </button>

          {activeStyle && (
            <p style={{ fontSize: 10.5, color: "#475569", marginTop: "0.6rem", lineHeight: 1.5 }}>
              Fans out across {activeStyle.engines.map(e => engines.find(x => x.id === e)?.label ?? e).join(" + ")}
              {" "}and three copy providers. {activeStyle.productVisible
                ? "The product is visible in this style, so reference-conditioned engines lead."
                : "No product in frame, so photorealism leads."}
            </p>
          )}
        </div>

        {/* ── Output ──────────────────────────────────────────────────────── */}
        <div>
          {error && <div style={{ marginBottom: "1.25rem" }}><EmptyState reason={error} /></div>}

          {!result && !loading && (
            <Panel title="Preview" note="The plate shown inside the real homepage hero — scrim, headline, button and banner strip.">
              <EmptyState reason="Fill in the offer and hit Generate. Plates and copy are produced in parallel, so this takes one wait, not three." />
            </Panel>
          )}

          {result && (
            <>
              {/* Preview — the thing being judged */}
              <Panel
                title="Preview"
                note="This is the real hero geometry: 35% scrim, centred white type, BUY NOW, and the banner strip over the bottom. Judge the plate here, not as a thumbnail."
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
                  minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center",
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
                  <button onClick={download}
                    style={{
                      marginTop: "0.85rem", cursor: "pointer", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", borderRadius: 8,
                      padding: "0.5rem 0.9rem", fontSize: 11.5, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", gap: "0.45rem",
                    }}>
                    <Download size={12} /> Download plate — 3840×960 webp
                  </button>
                )}
              </Panel>

              {/* Plates */}
              <Panel
                title="Plates"
                note={`${result.summary.platesOk} of ${result.summary.platesTotal} engines returned. Each engine gets one swing — different models fail in different ways, which is the point.`}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
                  {result.plates.map(p => {
                    const picked = p.url === pickedPlate;
                    return (
                      <motion.div key={p.engine} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => p.ok && p.url && setPickedPlate(p.url)}
                        style={{
                          ...CARD, padding: "0.6rem", cursor: p.ok ? "pointer" : "default",
                          border: picked ? `1px solid ${ACCENT}` : CARD.border,
                        }}>
                        <div style={{
                          aspectRatio: "4/1", background: "#0b0b0b", borderRadius: 6,
                          overflow: "hidden", marginBottom: "0.5rem",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {p.ok && p.url
                            ? <img src={p.url} alt={p.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <X size={16} color="#f43f5e" />}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: picked ? ACCENT : "#cbd5e1" }}>{p.label}</span>
                          <ScreenBadge v={p.screen} />
                        </div>
                        {/* Failures say why. An engine that is merely unconfigured is not a failure. */}
                        {!p.ok && (
                          <p style={{ fontSize: 10, color: "#f43f5e", marginTop: "0.35rem", lineHeight: 1.45 }}>{p.error}</p>
                        )}
                        {p.ok && (
                          <p style={{ fontSize: 10, color: "#475569", marginTop: "0.35rem" }}>
                            {p.nativeWidth}px native{p.upscaled && " · upscaled to fit"} · {(p.latencyMs / 1000).toFixed(1)}s
                          </p>
                        )}
                        {p.screen?.screened && p.screen.note && (
                          <p style={{ fontSize: 10, color: "#64748b", marginTop: "0.3rem", lineHeight: 1.45 }}>{p.screen.note}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </Panel>

              {/* Copy */}
              <Panel
                title="Copy"
                note={`${result.summary.copyOk} of ${result.summary.copyTotal} providers returned. Voices differ — Claude runs restrained, GPT punchier, Gemini blunter.`}
              >
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

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {slots.filter(s => s.kind !== "image").map(s => {
                    const v = chosenCopy[s.key] ?? "";
                    const len = v.replace(/<[^>]+>/g, "").length;
                    const over = s.maxChars ? len > s.maxChars : false;
                    return (
                      <div key={s.key} style={{
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 8, padding: "0.6rem 0.75rem",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                          <span style={{ ...LABEL, fontSize: 10 }}>
                            {s.label}
                            {s.metaobjectField
                              ? <span style={{ color: "#4ade80", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>→ {s.metaobjectField}</span>
                              : <span style={{ color: "#b45309", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>no field yet</span>}
                          </span>
                          <span style={{ fontSize: 10, color: over ? "#f43f5e" : "#475569" }}>{len}/{s.maxChars}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.45, fontFamily: s.kind === "html" ? "ui-monospace, monospace" : undefined }}>
                          {v || <span style={{ color: "#475569" }}>—</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </>
          )}

          {/* Calendar clashes — read-only, and non-fatal when Shopify is unreachable */}
          {calendar?.available && calendar.overlaps.length > 0 && (
            <Panel title="Calendar clash">
              <EmptyState reason={calendar.overlaps.map(o => o.note).join(" ")} />
            </Panel>
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
