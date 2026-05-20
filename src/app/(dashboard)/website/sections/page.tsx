"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, Edit2, Check, X, ChevronDown, ChevronUp,
  GitBranch, Trash2, Zap, Pause, Play, Scissors, ArrowUpDown,
} from "lucide-react";

type SortKey = "name" | "impressions" | "atc" | "assisted_atc" | "ctr";
type SortDir = "desc" | "asc";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionVariation {
  id: string;
  section_id: string;
  name: string;
  shopify_section_id: string;
  description: string | null;
  active: boolean;
  impressions: number;
  add_to_carts: number;
}

interface PSection {
  id: string; name: string; description: string | null;
  shopify_section_id: string; targeting_rules: Record<string, unknown>;
  active: boolean; hard_gate: boolean;
  date_gate_enabled: boolean; date_gate_start: string | null; date_gate_end: string | null;
  stats: { impressions: number; add_to_cart: number; clicks: number; avg_dwell_ms: number } | null;
  variations: SectionVariation[];
  created_at: string; updated_at: string;
}

interface SectionFormData {
  name: string; description: string; shopify_section_id: string;
  targeting_rules_raw: string; hard_gate: string;
  date_gate_enabled: boolean; date_gate_start: string; date_gate_end: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12, padding: "1.25rem",
} as const;

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e2e8f0",
} as const;

// Selects need a solid opaque dark background so native OS option list is readable.
// WebkitAppearance: none gives us full CSS control, bypassing Bulma overrides.
const SELECT_STYLE: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#e2e8f0",
  WebkitAppearance: "none",
  appearance: "none",
  padding: "5px 10px",
  borderRadius: 6,
  width: "100%",
  fontSize: 13,
  cursor: "pointer",
};

// ── CustomSelect — fully CSS-controlled dropdown (native <select> ignores dark-mode CSS on macOS)
interface SelectOption { value: string; label: string; dimmed?: boolean; }
function CustomSelect({ value, onChange, options, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const label = selected ? selected.label : (placeholder ?? "— select —");
  return (
    <div style={{ position: "relative", ...style }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }} tabIndex={-1}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
          width: "100%", background: "#0f172a", border: "1px solid rgba(255,255,255,0.18)",
          color: selected ? "#e2e8f0" : "#64748b", borderRadius: 6, padding: "5px 10px",
          fontSize: 12, cursor: "pointer", textAlign: "left" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "#0f172a", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)", maxHeight: 240, overflowY: "auto" }}>
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                background: o.value === value ? "rgba(56,189,248,0.12)" : "transparent",
                color: o.dimmed ? "#64748b" : "#e2e8f0", fontSize: 12, cursor: "pointer",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Live snippet list hook ────────────────────────────────────────────────────
// Fetches the real file list from /admin/snippets so the dropdowns always
// reflect whatever .liquid files are actually in the repo — no manual updates needed.

interface LiveSnippet { id: string; filename: string; description: string | null; }

function useSnippetList(): { snippets: LiveSnippet[]; loading: boolean } {
  const [snippets, setSnippets] = useState<LiveSnippet[]>([]);
  const [loading, setLoading]   = useState(true);
  useEffect(() => {
    fetch(`${BOT_URL}/admin/snippets`)
      .then(r => r.json())
      .then(d => {
        const raw: Array<{ id: string; filename: string; description: string | null }> =
          d.snippets ?? [];
        // Strip the .liquid extension for display; sort alphabetically
        setSnippets(
          raw
            .map(s => ({ id: s.filename.replace(/\.liquid$/, ""), filename: s.filename, description: s.description }))
            .sort((a, b) => a.id.localeCompare(b.id))
        );
      })
      .catch(() => { /* silently fall back to empty — UI shows "Custom ID" fallback */ })
      .finally(() => setLoading(false));
  }, []);
  return { snippets, loading };
}

// ── Variation Row ──────────────────────────────────────────────────────────────

function VariationRow({
  variation, sectionId, canDelete, onDelete, onToggleActive, onRefresh,
}: {
  variation: SectionVariation; sectionId: string; canDelete: boolean;
  onDelete: () => void;
  onToggleActive: (varId: string, newActive: boolean) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(variation.name);
  const [editSnippetId, setEditSnippetId] = useState(variation.shopify_section_id);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const atcRate = variation.impressions > 0
    ? ((variation.add_to_carts / variation.impressions) * 100).toFixed(1)
    : "—";

  const save = async () => {
    setSaving(true);
    await fetch(`${BOT_URL}/admin/intelligence/sections/${sectionId}/variations/${variation.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), shopify_section_id: editSnippetId.trim() }),
    });
    setSaving(false); setEditing(false); onRefresh();
  };

  const toggleActive = async () => {
    if (toggling) return;
    const newActive = !variation.active;
    setToggling(true);
    // Optimistic update — reflect new state immediately, no page reload
    onToggleActive(variation.id, newActive);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections/${sectionId}/variations/${variation.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) {
        // Revert on failure
        onToggleActive(variation.id, !newActive);
      }
    } catch {
      onToggleActive(variation.id, !newActive);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.4rem 0.6rem",
      background: variation.active ? "rgba(255,255,255,0.02)" : "rgba(251,191,36,0.03)",
      border: `1px solid ${variation.active ? "rgba(255,255,255,0.05)" : "rgba(251,191,36,0.15)"}`,
      borderRadius: 7, marginBottom: "0.25rem",
      opacity: variation.active ? 1 : 0.7,
    }}>
      {/* Status dot */}
      <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
        background: variation.active ? "#34d399" : "#f59e0b",
        boxShadow: variation.active ? "0 0 4px #34d39966" : "none" }} />

      {editing ? (
        <>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            style={{ ...INPUT_STYLE, fontSize: 11, padding: "2px 6px", borderRadius: 5, width: 120, flex: "0 0 auto" }} />
          <input value={editSnippetId} onChange={e => setEditSnippetId(e.target.value)}
            style={{ ...INPUT_STYLE, fontSize: 10, padding: "2px 6px", borderRadius: 5, fontFamily: "monospace", flex: 1, minWidth: 0 }}
            placeholder="lrb-snippet-id" />
          <button onClick={save} disabled={saving} style={{ color: "#34d399", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }} aria-label="Save">
            <Check size={11} />
          </button>
          <button onClick={() => setEditing(false)} style={{ color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }} aria-label="Cancel">
            <X size={11} />
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 12, fontWeight: 600, color: variation.active ? "#cbd5e1" : "#94a3b8", flexShrink: 0 }}>{variation.name}</span>
          <code style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
            {variation.shopify_section_id}
          </code>

          {/* Paused badge — only shown when inactive */}
          {!variation.active && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#f59e0b",
              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)",
              padding: "1px 7px", borderRadius: 4, flexShrink: 0, letterSpacing: "0.05em",
            }}>PAUSED</span>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
            {variation.impressions} imp
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            color: variation.impressions > 0 ? "#34d399" : "#334155",
          }}>
            {atcRate}{variation.impressions > 0 ? "%" : ""} Assisted ATC
          </span>

          {/* Edit */}
          <button onClick={() => setEditing(true)}
            style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
            aria-label="Edit variation">
            <Edit2 size={10} />
          </button>

          {/* Pause / Resume — clearly labelled, never confused with delete */}
          <button
            onClick={toggleActive}
            disabled={toggling}
            title={variation.active ? "Pause this variation (keeps it saved, removes from rotation)" : "Resume this variation (adds back to UCB1 rotation)"}
            aria-label={variation.active ? "Pause variation" : "Resume variation"}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700,
              color: toggling ? "#475569" : variation.active ? "#94a3b8" : "#34d399",
              background: toggling ? "rgba(71,85,105,0.08)" : variation.active ? "rgba(148,163,184,0.08)" : "rgba(52,211,153,0.1)",
              border: `1px solid ${toggling ? "rgba(71,85,105,0.15)" : variation.active ? "rgba(148,163,184,0.15)" : "rgba(52,211,153,0.2)"}`,
              borderRadius: 5, padding: "2px 7px", cursor: toggling ? "default" : "pointer",
              opacity: toggling ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}>
            {toggling
              ? <span style={{ fontFamily: "monospace", fontSize: 9 }}>…</span>
              : variation.active
                ? <><Pause size={9} /> Pause</>
                : <><Play  size={9} /> Resume</>}
          </button>

          {/* Delete */}
          {canDelete && (
            <button onClick={onDelete}
              style={{ color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
              aria-label="Delete variation">
              <Trash2 size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Add Variation Form ─────────────────────────────────────────────────────────

function AddVariationRow({ sectionId, onAdded }: { sectionId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [snippetId, setSnippetId] = useState("");
  const [customId, setCustomId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const { snippets: liveSnippets, loading: snippetsLoading } = useSnippetList();

  const resolvedSnippetId = snippetId === "__custom__" ? customId : snippetId;

  const save = async () => {
    if (!name.trim() || !resolvedSnippetId.trim()) { setErr("Enter a variation name and select a snippet."); return; }
    setSaving(true); setErr("");
    const res = await fetch(`${BOT_URL}/admin/intelligence/sections/${sectionId}/variations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), shopify_section_id: resolvedSnippetId.trim() }),
    });
    setSaving(false);
    if (res.ok) { setOpen(false); setName(""); setSnippetId(""); setCustomId(""); onAdded(); }
    else { const d = await res.json(); setErr(d.error ?? "Failed"); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: 10, color: "#38bdf8",
        background: "rgba(56,189,248,0.06)", border: "1px dashed rgba(56,189,248,0.2)",
        borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer", fontWeight: 600, marginTop: "0.25rem" }}>
      <Plus size={10} /> Add Variation
    </button>
  );

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem", flexWrap: "wrap" }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. With Video"
        style={{ ...INPUT_STYLE, fontSize: 11, padding: "3px 8px", borderRadius: 6, width: 130 }} />
      <CustomSelect
        value={snippetId}
        onChange={setSnippetId}
        placeholder={snippetsLoading ? "Loading snippets…" : "— pick snippet —"}
        style={{ flex: 1, minWidth: 160 }}
        options={[
          ...liveSnippets.map(s => ({ value: s.id, label: s.id + (s.description ? ` — ${s.description.slice(0, 48)}` : "") })),
          { value: "__custom__", label: "Custom ID…", dimmed: true },
        ]}
      />
      {snippetId === "__custom__" && (
        <input placeholder="lrb-custom-snippet" value={customId} onChange={e => setCustomId(e.target.value)}
          style={{ ...INPUT_STYLE, fontSize: 10, padding: "3px 8px", borderRadius: 6, width: 160 }} />
      )}
      {err && <span style={{ fontSize: 10, color: "#f43f5e" }}>{err}</span>}
      <button onClick={save} disabled={saving}
        style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)",
          borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
        {saving ? "…" : "Add"}
      </button>
      <button onClick={() => { setOpen(false); setErr(""); }}
        style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ section, onToggle, onEdit, onDelete, onRefresh, onVariationToggle }: {
  section: PSection;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (section: PSection) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onVariationToggle: (sectionId: string, varId: string, newActive: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rules = section.targeting_rules;
  const ruleEntries = Object.entries(rules);
  const isUniversal = ruleEntries.length === 0;
  const visibleRules = ruleEntries.slice(0, 3);
  const hiddenCount = ruleEntries.length - visibleRules.length;
  const variations = section.variations ?? [];
  const totalImpressions = variations.reduce((s, v) => s + v.impressions, 0);
  // ATC is written to personalization_sections.stats.add_to_cart (JSONB) by the event routes.
  // section_variations.add_to_carts is the UCB1 embed-level counter which is only updated
  // via /embeds/:id/stats — it is NOT updated by page/event or page/events/batch.
  const totalATC = section.stats?.add_to_cart ?? 0;
  const atcRate = totalImpressions > 0 ? ((totalATC / totalImpressions) * 100).toFixed(1) : "—";

  const deleteVariation = async (varId: string) => {
    if (!confirm("Delete this variation?")) return;
    await fetch(`${BOT_URL}/admin/intelligence/sections/${section.id}/variations/${varId}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${expanded ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.07)"}`,
      borderLeft: `3px solid ${section.active ? "#38bdf8" : "#334155"}`,
      borderRadius: 10,
      opacity: section.active ? 1 : 0.55, marginBottom: "0.4rem",
      overflow: "hidden",
    }}>
      {/* ── Clickable header row ─────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0,
          cursor: "pointer",
          padding: "0.55rem 0.75rem",
          background: expanded ? "rgba(56,189,248,0.04)" : "transparent",
          transition: "background 0.15s ease",
          userSelect: "none",
        }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        {/* Chevron first — makes expand intent obvious */}
        <span style={{ color: expanded ? "#38bdf8" : "#475569", flexShrink: 0, display: "flex", transition: "color 0.15s" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>

        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: section.active ? "#34d399" : "#334155",
          boxShadow: section.active ? "0 0 5px #34d39977" : "none" }} />
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12.5, flexShrink: 0 }}>{section.name}</span>

        {/* Variations count badge */}
        {variations.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#a78bfa",
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)",
            padding: "1px 6px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
            <GitBranch size={8} /> {variations.length} var{variations.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Date gate badge */}
        {section.date_gate_enabled && (() => {
          const now = new Date();
          const start = section.date_gate_start ? new Date(section.date_gate_start) : null;
          const end = section.date_gate_end ? new Date(section.date_gate_end + "T23:59:59Z") : null;
          const inWindow = (!start || now >= start) && (!end || now <= end);
          return (
            <span title={`Date gate: ${section.date_gate_start ?? "any"} → ${section.date_gate_end ?? "any"}`} style={{
              fontSize: 9, fontWeight: 700,
              color: inWindow ? "#34d399" : "#f59e0b",
              background: inWindow ? "rgba(52,211,153,0.08)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${inWindow ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`,
              padding: "1px 6px", borderRadius: 4, flexShrink: 0,
            }}>
              🗓 {inWindow ? "Live" : "Gated"}
            </span>
          );
        })()}

        {/* Targeting pills */}
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
          {isUniversal ? (
            <span style={{ fontSize: 9, color: "#64748b", background: "rgba(100,116,139,0.1)", padding: "1px 6px", borderRadius: 4, fontWeight: 700, border: "1px solid rgba(100,116,139,0.15)", flexShrink: 0 }}>Everyone</span>
          ) : (
            <>
              {visibleRules.map(([k, v]) => (
                <span key={k} style={{ fontSize: 9, background: "rgba(56,189,248,0.08)", color: "#7dd3fc", padding: "1px 6px", borderRadius: 4, fontWeight: 600, border: "1px solid rgba(56,189,248,0.15)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ color: "#475569" }}>{k}:</span>{" "}
                  {Array.isArray(v) ? (v as string[]).slice(0, 2).join(", ") + ((v as string[]).length > 2 ? "…" : "") : String(v)}
                </span>
              ))}
              {hiddenCount > 0 && <span style={{ fontSize: 9, color: "#475569", flexShrink: 0 }}>+{hiddenCount}</span>}
            </>
          )}
        </div>

        {/* Aggregate stats — 4 metrics */}
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
          <span title="Total impressions" style={{
            fontSize: 10, fontWeight: 700,
            color: totalImpressions > 0 ? "#38bdf8" : "#334155",
            background: totalImpressions > 0 ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(56,189,248,0.12)", borderRadius: 5, padding: "1px 7px",
          }}>
            {totalImpressions.toLocaleString()} <span style={{ color: "#475569", fontWeight: 400 }}>imp</span>
          </span>
          <span title="Total Add-to-Carts" style={{
            fontSize: 10, fontWeight: 700,
            color: totalATC > 0 ? "#a78bfa" : "#334155",
            background: totalATC > 0 ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(167,139,250,0.12)", borderRadius: 5, padding: "1px 7px",
          }}>
            {totalATC} <span style={{ color: "#475569", fontWeight: 400 }}>ATC</span>
          </span>
          <span title="Assisted ATC% — any session that saw this section and added to cart" style={{
            fontSize: 10, fontWeight: 700,
            color: totalImpressions > 0 ? "#34d399" : "#334155",
            background: totalImpressions > 0 ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(52,211,153,0.12)", borderRadius: 5, padding: "1px 7px",
          }}>
            {atcRate}{totalImpressions > 0 ? "%" : ""} <span style={{ color: "#475569", fontWeight: 400 }}>AATC%</span>
          </span>
          <span title="CTR — add_to_carts ÷ impressions" style={{
            fontSize: 10, fontWeight: 700,
            color: totalImpressions > 0 ? "#e98d20" : "#334155",
            background: totalImpressions > 0 ? "rgba(233,141,32,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(233,141,32,0.12)", borderRadius: 5, padding: "1px 7px",
          }}>
            {totalImpressions > 0 ? ((totalATC / totalImpressions) * 100).toFixed(2) : "—"}{totalImpressions > 0 ? "%" : ""} <span style={{ color: "#475569", fontWeight: 400 }}>CTR</span>
          </span>
        </div>

        {/* Edit / toggle / delete — stop propagation so they don't trigger expand */}
        <div style={{ display: "flex", gap: "0.1rem", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(section)} style={{ color: "#38bdf8", padding: "0.3rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }} aria-label="Edit section"><Edit2 size={12} /></button>
          <button onClick={() => onToggle(section.id, !section.active)}
            title={section.active ? "Pause this section (keeps it in DB, removes from rotation)" : "Resume this section"}
            style={{ color: section.active ? "#94a3b8" : "#34d399", padding: "0.3rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            aria-label={section.active ? "Pause" : "Resume"}>
            {section.active ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={() => onDelete(section.id)}
            title="Permanently delete this section and all its variations"
            style={{ color: "#f43f5e", padding: "0.3rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            aria-label="Delete section">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Expanded body ─────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 0.75rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.6rem" }}>
              {section.description && (
                <p style={{ fontSize: 11, color: "#64748b", marginBottom: "0.5rem", lineHeight: 1.5 }}>{section.description}</p>
              )}

              {/* Variations */}
              <p style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: 4 }}>
                <GitBranch size={9} /> Variations — UCB1 picks the best performer
              </p>
              {variations.length === 0 ? (
                <p style={{ fontSize: 11, color: "#334155" }}>No variations yet.</p>
              ) : (
                variations.map(v => (
                  <VariationRow
                    key={v.id} variation={v} sectionId={section.id}
                    canDelete={variations.length > 1}
                    onDelete={() => deleteVariation(v.id)}
                    onToggleActive={(varId, newActive) => onVariationToggle(section.id, varId, newActive)}
                    onRefresh={onRefresh}
                  />
                ))
              )}
              <AddVariationRow sectionId={section.id} onAdded={onRefresh} />

              {/* Signals summary */}
              {!isUniversal && (
                <>
                  <p style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0.6rem 0 0.3rem" }}>Targeting Signals</p>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {ruleEntries.map(([k, v]) => (
                      <span key={k} style={{ fontSize: 10, background: "rgba(56,189,248,0.06)", color: "#7dd3fc", padding: "2px 8px", borderRadius: 6, fontWeight: 600, border: "1px solid rgba(56,189,248,0.12)" }}>
                        <span style={{ color: "#64748b" }}>{k}:</span>{" "}
                        {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <p style={{ fontSize: 9, color: "#334155", marginTop: "0.4rem" }}>
                Mode: {section.hard_gate ? "🔒 Hard Gate" : "⚖️ Weighted"} · Updated {new Date(section.updated_at).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SectionsPage() {
  const [sections, setSections] = useState<PSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pruning, setPruning] = useState(false);
  const [pruneMsg, setPruneMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const empty: SectionFormData = { name: "", description: "", shopify_section_id: "", targeting_rules_raw: "{}", hard_gate: "false", date_gate_enabled: false, date_gate_start: "", date_gate_end: "" };
  const [form, setForm] = useState<SectionFormData>(empty);
  const { snippets: liveSnippets, loading: snippetsLoading } = useSnippetList();

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const fetchSections = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections`, { cache: "no-store" });
      if (res.ok) { const data = await res.json(); setSections(data.sections ?? []); }
    } catch { /* silent */ }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);

  // Expose a silent refresh (no spinner) for child callbacks
  const refreshSilent = useCallback(() => fetchSections(true), [fetchSections]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const toggle = async (id: string, active: boolean) => {
    // Optimistic update for section active toggle
    setSections(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        // Revert on failure
        setSections(prev => prev.map(s => s.id === id ? { ...s, active: !active } : s));
      }
    } catch {
      setSections(prev => prev.map(s => s.id === id ? { ...s, active: !active } : s));
    }
  };

  const handleVariationToggle = (sectionId: string, varId: string, newActive: boolean) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        variations: s.variations.map(v => v.id === varId ? { ...v, active: newActive } : v),
      };
    }));
  };

  const deleteSection = async (id: string) => {
    const section = sections.find(s => s.id === id);
    if (!confirm(`Permanently delete "${section?.name ?? id}" and all its variations?\n\nThis cannot be undone.`)) return;
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Delete failed (${res.status})`);
      }
      setSections(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      alert(`Could not delete section: ${e.message}`);
    }
  };

  const openCreate = () => { setEditTarget(null); setForm(empty); setFormError(""); setShowForm(true); };

  const pruneSnippets = async () => {
    if (pruning) return;
    setPruning(true); setPruneMsg(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/prune-snippets`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Prune failed");
      if (data.rogue_count === 0) {
        setPruneMsg({ text: "✓ No rogue snippets found", ok: true });
      } else {
        setPruneMsg({ text: `✓ Deleted ${data.deleted} rogue snippet${data.deleted !== 1 ? "s" : ""}${data.errors > 0 ? ` (${data.errors} errors)` : ""}`, ok: data.errors === 0 });
      }
    } catch (e: any) {
      setPruneMsg({ text: `✗ ${e.message}`, ok: false });
    } finally {
      setPruning(false);
      setTimeout(() => setPruneMsg(null), 5000);
    }
  };
  const openEdit = (s: PSection) => {
    setEditTarget(s);
    setForm({
      name: s.name, description: s.description ?? "", shopify_section_id: s.shopify_section_id,
      targeting_rules_raw: JSON.stringify(s.targeting_rules, null, 2), hard_gate: s.hard_gate ? "true" : "false",
      date_gate_enabled: s.date_gate_enabled ?? false,
      date_gate_start: s.date_gate_start ?? "",
      date_gate_end: s.date_gate_end ?? "",
    });
    setFormError(""); setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      let targeting_rules: Record<string, unknown> = {};
      try { targeting_rules = JSON.parse(form.targeting_rules_raw); } catch { throw new Error("Invalid JSON in signals"); }
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        shopify_section_id: form.shopify_section_id.trim(),
        targeting_rules,
        hard_gate: form.hard_gate === "true",
        date_gate_enabled: form.date_gate_enabled,
        date_gate_start: form.date_gate_enabled && form.date_gate_start ? form.date_gate_start : null,
        date_gate_end: form.date_gate_enabled && form.date_gate_end ? form.date_gate_end : null,
      };
      if (!payload.name || !payload.shopify_section_id) throw new Error("Name and Shopify Section ID are required");
      const url = editTarget ? `${BOT_URL}/admin/intelligence/sections/${editTarget.id}` : `${BOT_URL}/admin/intelligence/sections`;
      const res = await fetch(url, { method: editTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); fetchSections();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const totalVariations = sections.reduce((s, sec) => s + (sec.variations?.length ?? 0), 0);

  const sortedSections = useMemo(() => {
    const getVal = (s: PSection) => {
      const vars = s.variations ?? [];
      const imp = vars.reduce((a, v) => a + v.impressions, 0);
      const atc = s.stats?.add_to_cart ?? 0;
      switch (sortKey) {
        case "name":        return s.name.toLowerCase();
        case "impressions": return imp;
        case "atc":         return atc;
        case "assisted_atc": return imp > 0 ? atc / imp : 0;
        case "ctr":         return imp > 0 ? atc / imp : 0;
        default:            return imp;
      }
    };
    return [...sections].sort((a, b) => {
      const av = getVal(a); const bv = getVal(b);
      if (av < bv) return sortDir === "desc" ? 1 : -1;
      if (av > bv) return sortDir === "desc" ? -1 : 1;
      return 0;
    });
  }, [sections, sortKey, sortDir]);

  const SORT_BTNS: { key: SortKey; label: string }[] = [
    { key: "impressions", label: "Impressions" },
    { key: "atc",         label: "ATC" },
    { key: "assisted_atc",label: "Assisted ATC%" },
    { key: "ctr",         label: "CTR" },
    { key: "name",        label: "Name" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              {sections.length} section{sections.length !== 1 ? "s" : ""} · {totalVariations} variation{totalVariations !== 1 ? "s" : ""}
            </p>
            <p style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
              <Zap size={9} style={{ display: "inline", marginRight: 3 }} />
              UCB1 selects the best variation per section automatically
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            {pruneMsg && (
              <span style={{ fontSize: 10, fontWeight: 700, color: pruneMsg.ok ? "#34d399" : "#f43f5e" }}>{pruneMsg.text}</span>
            )}
            <button onClick={pruneSnippets} disabled={pruning} className="button is-small"
              title="Deletes lrb-* snippets on Shopify that have no registered section or variation"
              style={{ background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
              <Scissors size={12} /> {pruning ? "Pruning..." : "Delete Rogue Snippets"}
            </button>
            <button onClick={openCreate} className="button is-small"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
              <Plus size={13} /> Register Section
            </button>
          </div>
        </div>

        {/* Sort controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#334155", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>
            <ArrowUpDown size={10} /> Sort
          </div>
          {SORT_BTNS.map(({ key, label }) => {
            const active = sortKey === key;
            return (
              <button key={key} onClick={() => cycleSort(key)}
                style={{
                  fontSize: 10, fontWeight: active ? 800 : 600,
                  color: active ? "#e98d20" : "#475569",
                  background: active ? "rgba(233,141,32,0.1)" : "rgba(255,255,255,0.03)",
                  border: active ? "1px solid rgba(233,141,32,0.3)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 6, padding: "2px 10px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4, transition: "all 0.12s",
                }}>
                {label}
                {active && <span style={{ fontSize: 9 }}>{sortDir === "desc" ? "↓" : "↑"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(56,189,248,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {editTarget ? "Edit Section" : "Register New Section"}
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Primary Snippet (Default Variation)</label>
              <CustomSelect
                value={form.shopify_section_id}
                onChange={val => {
                  const picked = liveSnippets.find(s => s.id === val);
                  setForm(f => ({
                    ...f,
                    shopify_section_id: val,
                    name: f.name || (picked ? picked.id : f.name),
                    description: f.description || (picked?.description ?? ""),
                  }));
                }}
                placeholder={snippetsLoading ? "Loading snippets…" : "— select a snippet —"}
                options={[
                  ...liveSnippets.map(s => ({ value: s.id, label: s.id + (s.description ? ` — ${s.description.slice(0, 60)}` : "") })),
                  { value: "__custom__", label: "Other (custom ID…)", dimmed: true },
                ]}
              />
              {form.shopify_section_id === "__custom__" && (
                <input className="input is-small" placeholder="my-custom-snippet-id" style={{ ...INPUT_STYLE, marginTop: "0.5rem" }}
                  onChange={e => setForm(f => ({ ...f, shopify_section_id: e.target.value }))} />
              )}
              <p style={{ fontSize: 9, color: "#475569", marginTop: "0.3rem" }}>This becomes the "Default" variation. Add more variations after creating the section.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { key: "name", label: "Display Name", placeholder: "Hero — Knee Pain" },
                { key: "description", label: "Description (optional)", placeholder: "Hero for joint/knee pain visitors" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
                  <input className="input is-small" placeholder={placeholder} value={form[key as keyof SectionFormData] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={INPUT_STYLE} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Matching Mode</label>
                <select value={form.hard_gate}
                  onChange={e => setForm(f => ({ ...f, hard_gate: e.target.value }))} style={SELECT_STYLE}>
                  <option value="false" style={{ background: "#0f172a", color: "#e2e8f0" }}>⚖️ Weighted — signals add score, always eligible</option>
                  <option value="true" style={{ background: "#0f172a", color: "#e2e8f0" }}>🔒 Hard Gate — only shows when signals match</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              {/* Date gate */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={form.date_gate_enabled}
                    onChange={e => setForm(f => ({ ...f, date_gate_enabled: e.target.checked }))}
                    style={{ accentColor: "#f59e0b", width: 14, height: 14 }}
                  />
                  <span>🗓 Enable Date Gate — hide this section outside a set date range</span>
                </label>

                {form.date_gate_enabled && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.25rem" }}>Show from (UTC)</label>
                      <input
                        type="date"
                        value={form.date_gate_start}
                        onChange={e => setForm(f => ({ ...f, date_gate_start: e.target.value }))}
                        style={{ ...INPUT_STYLE, fontSize: 12, padding: "4px 8px", borderRadius: 6, width: "100%", colorScheme: "dark" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.25rem" }}>Hide after (UTC)</label>
                      <input
                        type="date"
                        value={form.date_gate_end}
                        onChange={e => setForm(f => ({ ...f, date_gate_end: e.target.value }))}
                        style={{ ...INPUT_STYLE, fontSize: 12, padding: "4px 8px", borderRadius: 6, width: "100%", colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 9, color: "#475569", marginTop: "0.3rem" }}>
                  When enabled, this section is invisible before the start date and after end-of-day on the end date (UTC). Dates are inclusive.
                </p>
              </div>

              {/* Signals */}
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Signals (JSON)</label>
              <div style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem", fontSize: 11 }}>
                <p style={{ color: "#94a3b8", fontWeight: 700, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Examples</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {[
                    { label: "Knee pain", json: '{\n  "pain": ["knee", "joint"]\n}' },
                    { label: "First-time user", json: '{\n  "tags": ["first_time_user"]\n}' },
                    { label: "Athlete UTM", json: '{\n  "tags": ["athlete"]\n}' },
                    { label: "Senior", json: '{\n  "life_stage": ["senior"]\n}' },
                    { label: "Facebook Ad", json: '{\n  "tags": ["facebook_ad"]\n}' },
                    { label: "Identified customer", json: '{\n  "identified": true\n}' },
                    { label: "Everyone (fallback)", json: '{}' },
                  ].map(ex => (
                    <button key={ex.label} onClick={() => setForm(f => ({ ...f, targeting_rules_raw: ex.json }))}
                      style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#38bdf8", borderRadius: 4, padding: "0.2rem 0.5rem", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea className="textarea is-small" rows={4}
                value={form.targeting_rules_raw}
                onChange={e => setForm(f => ({ ...f, targeting_rules_raw: e.target.value }))}
                style={{ ...INPUT_STYLE, fontFamily: "monospace", fontSize: 12 }} />
            </div>

            {formError && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: "0.5rem" }}>⚠ {formError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button onClick={save} disabled={saving} className="button is-small"
                style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}>
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Register"}
              </button>
              <button onClick={() => setShowForm(false)} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>Loading sections…</p>
      ) : sections.length === 0 && !refreshing ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem" }}>
          <Layers size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#475569" }}>No sections registered yet. Click &quot;Register Section&quot; to add your first.</p>
        </div>
      ) : (
        <div>
          {sortedSections.map(s => (
            <SectionCard key={s.id} section={s} onToggle={toggle} onEdit={openEdit} onDelete={deleteSection} onRefresh={refreshSilent} onVariationToggle={handleVariationToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
