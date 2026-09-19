"use client";
/**
 * Content → Training Data
 *
 * What the image generator is actually conditioning on, product by product.
 *
 * The Products page is for curating ONE product's reference set. This page
 * answers the question that page cannot: across everything we sell, which
 * identity groups can the generator render faithfully, and which will it have to
 * guess at? A group with a hero shot, a top-down and a close-up produces a
 * correct product. A group with one cropped photo does not, and until this page
 * existed there was nowhere that difference was visible.
 *
 * Coverage is shown per (product → line → colour), because those three together
 * are what the selector treats as one identity. Two rebounder lines under a
 * single Shopify listing look like one product everywhere else in the dashboard
 * and are two entirely different objects here.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Wand2, Loader2, AlertTriangle, CheckCircle2, Eye, EyeOff,
  Star, ChevronRight, ChevronDown, FileText, RefreshCw, Layers,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Ref {
  id: string;
  product_id: string;
  product_title: string;
  image_url: string;
  display_order: number;
  view: string | null;
  color: string | null;
  product_line: string | null;
  size_label: string | null;
  subject_count: number | null;
  is_primary: boolean;
  usable_for_identity: boolean;
  label_source: "unlabeled" | "auto" | "human";
  label_notes: string | null;
}

interface Spec {
  id: string;
  label: string;
  aliases: string[];
  construction: string;
  forbidden: string[];
  failure_modes: string[];
  product_line: string | null;
  default_color: string | null;
  active: boolean;
}

/**
 * The angles that decide whether a group is renderable.
 *
 * Not the full taxonomy — these five are the ones the selector reaches for, in
 * the order it reaches for them. A group missing `hero_three_quarter` has no
 * photograph of the whole object, which is the single worst gap to have.
 */
const COVERAGE_VIEWS = [
  { id: "hero_three_quarter", short: "3/4",    critical: true },
  { id: "front",              short: "front",  critical: true },
  { id: "top",                short: "top",    critical: false },
  { id: "bungee_closeup",     short: "bungee", critical: false },
  { id: "side",               short: "side",   critical: false },
] as const;

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
};

const ACCENT = "#f59e0b";

// ── Grouping ───────────────────────────────────────────────────────────────────

interface Group {
  key: string;
  productId: string;
  productTitle: string;
  line: string | null;
  color: string;
  refs: Ref[];
}

function groupRefs(refs: Ref[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of refs) {
    if (!r.usable_for_identity) continue;
    const color = r.color ?? "unlabeled";
    const key = `${r.product_id}::${r.product_line ?? "-"}::${color}`;
    const g = map.get(key);
    if (g) g.refs.push(r);
    else map.set(key, {
      key, productId: r.product_id, productTitle: r.product_title,
      line: r.product_line, color, refs: [r],
    });
  }
  return [...map.values()].sort((a, b) =>
    a.productTitle.localeCompare(b.productTitle) ||
    String(a.line).localeCompare(String(b.line)) ||
    a.color.localeCompare(b.color)
  );
}

/**
 * How well a group can be rendered, 0–100.
 *
 * Weighted, not a straight count: a complete-unit shot is worth more than a
 * fourth close-up, and a group with five close-ups and no hero would otherwise
 * score as "well covered" while producing an invented product.
 */
function coverageOf(g: Group): { pct: number; have: Set<string>; missingCritical: string[] } {
  const have = new Set(g.refs.map(r => r.view ?? "").filter(Boolean));
  let score = 0, total = 0;
  for (const v of COVERAGE_VIEWS) {
    const weight = v.critical ? 3 : 1;
    total += weight;
    if (have.has(v.id)) score += weight;
  }
  // A whole-unit photograph of any kind rescues a group with no formal hero.
  if (!have.has("hero_three_quarter") && (have.has("in_use") || have.has("front"))) score += 1.5;
  const missingCritical = COVERAGE_VIEWS.filter(v => v.critical && !have.has(v.id)).map(v => v.short);
  return { pct: Math.min(100, Math.round((score / total) * 100)), have, missingCritical };
}

// ── Bits ───────────────────────────────────────────────────────────────────────

function Bar({ pct }: { pct: number }) {
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? ACCENT : "#ef4444";
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", flex: 1, minWidth: 60 }}>
      <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}
        style={{ height: "100%", borderRadius: 99, background: color }} />
    </div>
  );
}

function Chip({ children, color = "#64748b", title }: { children: React.ReactNode; color?: string; title?: string }) {
  return (
    <span title={title} style={{
      fontSize: 9.5, fontWeight: 700, color,
      background: `${color}14`, border: `1px solid ${color}30`,
      borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function GroupRow({ g }: { g: Group }) {
  const [open, setOpen] = useState(false);
  const { pct, have, missingCritical } = coverageOf(g);

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem", width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "0.6rem 0.9rem", textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={12} color="#475569" /> : <ChevronRight size={12} color="#475569" />}
        {g.line && <Chip color={g.line === "pro" ? "#a78bfa" : "#38bdf8"}>{g.line}</Chip>}
        <Chip color="#94a3b8">{g.color}</Chip>
        <span style={{ fontSize: 10.5, color: "#64748b" }}>
          {g.refs.length} image{g.refs.length === 1 ? "" : "s"}
        </span>

        <div style={{ display: "flex", gap: 3, marginLeft: "auto", alignItems: "center" }}>
          {COVERAGE_VIEWS.map(v => (
            <span key={v.id} title={`${v.id}${have.has(v.id) ? "" : " — missing"}`}
              style={{
                fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 4,
                color: have.has(v.id) ? "#10b981" : "#334155",
                background: have.has(v.id) ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${have.has(v.id) ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)"}`,
              }}>
              {v.short}
            </span>
          ))}
        </div>
        <div style={{ width: 90, display: "flex", alignItems: "center", gap: 6 }}>
          <Bar pct={pct} />
          <span style={{ fontSize: 9.5, fontWeight: 800, color: pct >= 70 ? "#10b981" : pct >= 40 ? ACCENT : "#ef4444", width: 26 }}>
            {pct}%
          </span>
        </div>
      </button>

      {missingCritical.length > 0 && !open && (
        <p style={{ fontSize: 9.5, color: "#ef4444", margin: "0 0 0.5rem 2.2rem" }}>
          no {missingCritical.join(" or ")} shot — the generator has no photograph of the whole unit in this colour
        </p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 0.9rem 0.8rem 2.2rem" }}>
              {g.refs.map(r => (
                <div key={r.id} style={{ width: 82 }}>
                  <img src={r.image_url} alt={r.view ?? ""} title={r.label_notes ?? r.view ?? ""}
                    style={{
                      width: 82, height: 82, objectFit: "cover", borderRadius: 7,
                      border: r.is_primary ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.08)",
                    }} />
                  <p style={{ fontSize: 8.5, color: "#64748b", margin: "3px 0 0", lineHeight: 1.3 }}>
                    {r.is_primary && <Star size={7} color="#10b981" style={{ display: "inline", marginRight: 2 }} />}
                    {(r.view ?? "unlabeled").replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TrainingDataPage() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [labeling, setLabeling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openSpec, setOpenSpec] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${BOT_URL}/admin/products/refs`),
        fetch(`${BOT_URL}/admin/products/specs`),
      ]);
      if (r1.ok) {
        const { refs: grouped } = await r1.json() as { refs: Record<string, Ref[]> };
        setRefs(Object.values(grouped ?? {}).flat());
      }
      if (r2.ok) setSpecs((await r2.json()).specs ?? []);
    } catch (e: any) {
      setNote(`Could not load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const labelAll = useCallback(async (force: boolean) => {
    setLabeling(true);
    setNote(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/products/label-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      setNote(`Labelled ${out.labeled} image${out.labeled === 1 ? "" : "s"}${out.failed ? `, ${out.failed} failed` : ""}.`);
      load();
    } catch (e: any) {
      setNote(`Labelling failed: ${e.message}`);
    } finally {
      setLabeling(false);
    }
  }, [load]);

  const groups = useMemo(() => groupRefs(refs), [refs]);
  const byProduct = useMemo(() => {
    const m = new Map<string, Group[]>();
    for (const g of groups) {
      const b = m.get(g.productTitle);
      if (b) b.push(g); else m.set(g.productTitle, [g]);
    }
    return [...m.entries()];
  }, [groups]);

  const unlabeled = refs.filter(r => r.label_source === "unlabeled" || !r.view).length;
  const excluded = refs.filter(r => !r.usable_for_identity).length;
  const usable = refs.length - excluded;
  const weakGroups = groups.filter(g => coverageOf(g).missingCritical.length > 0).length;

  const stat = (label: string, value: React.ReactNode, color: string, hint?: string) => (
    <div style={{ ...CARD, padding: "0.75rem 0.9rem", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "0.15rem 0 0" }}>{value}</p>
      {hint && <p style={{ fontSize: 9.5, color: "#475569", margin: "0.15rem 0 0", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Database size={15} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#e2e8f0" }}>Training Data</p>
          <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.5, maxWidth: 680 }}>
            The reference photographs the image generator conditions on, and how completely each product
            variant is covered. Pin and correct individual images under <strong style={{ color: "#64748b" }}>Products</strong>;
            this page is for seeing the gaps.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button onClick={load} disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.7rem",
              cursor: loading ? "default" : "pointer", color: "#94a3b8", fontSize: 11, fontWeight: 700,
            }}>
            <RefreshCw size={11} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            Refresh
          </button>
          <button onClick={() => labelAll(false)} disabled={labeling}
            title="Run the vision pass over every unlabeled reference image"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: unlabeled > 0 ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${unlabeled > 0 ? `${ACCENT}35` : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8, padding: "0.4rem 0.7rem", cursor: labeling ? "default" : "pointer",
              color: unlabeled > 0 ? ACCENT : "#94a3b8", fontSize: 11, fontWeight: 700,
            }}>
            {labeling ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={11} />}
            {labeling ? "Labeling…" : unlabeled > 0 ? `Label ${unlabeled}` : "Re-label all"}
          </button>
        </div>
      </div>

      {note && (
        <div style={{
          ...CARD, padding: "0.6rem 0.9rem", marginBottom: "1rem",
          background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.2)",
        }}>
          <p style={{ fontSize: 11.5, color: "#38bdf8", margin: 0 }}>{note}</p>
        </div>
      )}

      {/* Headline numbers */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {stat("Usable references", usable, "#10b981", "can define a product identity")}
        {stat("Excluded", excluded, excluded > 0 ? ACCENT : "#475569", "lineups, composites, multi-unit frames")}
        {stat("Unlabeled", unlabeled, unlabeled > 0 ? "#ef4444" : "#475569", unlabeled > 0 ? "invisible to the selector" : "all labeled")}
        {stat("Identity groups", groups.length, "#38bdf8", "product × line × color")}
        {stat("Missing a whole-unit shot", weakGroups, weakGroups > 0 ? "#ef4444" : "#10b981", "the worst gap to have")}
      </div>

      {/* Coverage */}
      {loading && refs.length === 0 ? (
        <div style={{ ...CARD, padding: "3rem", textAlign: "center" }}>
          <Loader2 size={20} color="#475569" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        byProduct.map(([title, gs]) => (
          <div key={title} style={{ ...CARD, marginBottom: "1rem", overflow: "hidden" }}>
            <div style={{ padding: "0.7rem 0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Layers size={13} color={ACCENT} />
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>{title}</p>
              <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>
                {gs.length} identity group{gs.length === 1 ? "" : "s"}
              </span>
            </div>
            {gs.map(g => <GroupRow key={g.key} g={g} />)}
          </div>
        ))
      )}

      {/* Specs — the other half of the training data */}
      <div style={{ ...CARD, overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "0.8rem 0.9rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={13} color="#a78bfa" />
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>Product specs</p>
          </div>
          <p style={{ fontSize: 10.5, color: "#475569", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
            What the generator is told the product <em>is</em>, and what counts as getting it wrong. This text is
            appended to every prompt for the matching product — the reference images define the shape, and this
            defines the rules. The <strong style={{ color: "#64748b" }}>aliases</strong> are what make references
            attach from prompt text alone.
          </p>
        </div>
        {specs.length === 0 ? (
          <p style={{ padding: "1rem", fontSize: 11, color: "#475569", margin: 0 }}>No specs defined.</p>
        ) : specs.map(sp => (
          <div key={sp.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => setOpenSpec(o => o === sp.id ? null : sp.id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.55rem", width: "100%",
                background: "none", border: "none", cursor: "pointer", padding: "0.6rem 0.9rem", textAlign: "left",
              }}>
              {openSpec === sp.id ? <ChevronDown size={12} color="#475569" /> : <ChevronRight size={12} color="#475569" />}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1" }}>{sp.label}</span>
              {sp.product_line && <Chip color={sp.product_line === "pro" ? "#a78bfa" : "#38bdf8"}>{sp.product_line}</Chip>}
              {!sp.active && <Chip color="#64748b">inactive</Chip>}
              <span style={{ fontSize: 9.5, color: "#475569", marginLeft: "auto" }}>
                {sp.aliases.length} alias{sp.aliases.length === 1 ? "" : "es"} · {sp.failure_modes.length} failure modes
              </span>
            </button>
            <AnimatePresence>
              {openSpec === sp.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ padding: "0 0.9rem 0.9rem 2.1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.25rem" }}>Triggers on</p>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {sp.aliases.map(a => <Chip key={a} color="#38bdf8">{a}</Chip>)}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.25rem" }}>Construction</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>{sp.construction}</p>
                    </div>
                    {sp.forbidden.length > 0 && (
                      <div>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.25rem" }}>Never</p>
                        {sp.forbidden.map((f, i) => (
                          <p key={i} style={{ fontSize: 10.5, color: "#94a3b8", margin: "0 0 2px", lineHeight: 1.5 }}>· {f}</p>
                        ))}
                      </div>
                    )}
                    {sp.failure_modes.length > 0 && (
                      <div>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.25rem" }}>
                          Scored against
                        </p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {sp.failure_modes.map((f, i) => <Chip key={i} color="#ef4444">{f}</Chip>)}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Excluded — shown, not hidden. An image dropped without explanation reads as a bug. */}
      {excluded > 0 && (
        <div style={{ ...CARD, marginTop: "1.5rem", padding: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <EyeOff size={13} color={ACCENT} />
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>
              Excluded from reference sets ({excluded})
            </p>
          </div>
          <p style={{ fontSize: 10.5, color: "#475569", margin: "0 0 0.7rem", lineHeight: 1.5 }}>
            Still pinned, still good catalogue images — but they cannot define a single product. A frame holding
            six rebounders, or four panels tiled into one picture, teaches the generator to draw six rebounders
            or a four-panel grid.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {refs.filter(r => !r.usable_for_identity).map(r => (
              <div key={r.id} style={{ width: 92 }}>
                <img src={r.image_url} alt="" title={r.label_notes ?? ""}
                  style={{ width: 92, height: 68, objectFit: "cover", borderRadius: 7, opacity: 0.5, border: "1px solid rgba(255,255,255,0.08)" }} />
                <p style={{ fontSize: 8.5, color: "#64748b", margin: "3px 0 0", lineHeight: 1.35 }}>
                  {r.label_notes ?? (r.view ?? "").replace(/_/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
