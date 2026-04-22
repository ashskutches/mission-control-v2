"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, Plus, Edit2, Trash2, ChevronDown, ChevronUp,
  Code, Copy, CheckCheck, Globe, X,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmbedSectionShape {
  id: string; name: string; description: string | null;
  shopify_section_id: string; targeting_rules: Record<string, unknown>;
  active: boolean; hard_gate: boolean; is_required: boolean;
  embed_impressions: number; embed_add_to_carts: number;
  winning_variation?: { name: string; shopify_section_id: string; impressions: number; add_to_carts: number } | null;
}

interface Embed {
  id: string; name: string; description: string | null;
  url_patterns: string[]; active: boolean; max_sections: number | null; is_live: boolean;
  sections: EmbedSectionShape[];
  created_at: string; updated_at: string;
}

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1.25rem" } as const;
const INPUT_STYLE = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" } as const;

// ── Embed Code Block ──────────────────────────────────────────────────────────

function EmbedCodeBlock({ embed }: { embed: Embed }) {
  const [copied, setCopied] = useState(false);
  const code = `<script>
  window.LRB_INTELLIGENCE_CONFIG = {
    botUrl: '${BOT_URL.replace("localhost:3001", "gravity-claw-production-fb9e.up.railway.app")}',
    embedId: '${embed.id}'
  };
</script>
{{ 'lrb-personalization.js' | asset_url | script_tag }}

<div id="lrb-intelligence-inject"></div>`;

  const copy = () => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          <Code size={10} style={{ display: "inline", marginRight: 4 }} />Embed Code — paste into Shopify theme
        </p>
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: 10, fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: 6, cursor: "pointer", background: copied ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)", color: copied ? "#34d399" : "#64748b", border: copied ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(255,255,255,0.08)", transition: "all 0.15s" }}>
          {copied ? <CheckCheck size={11} /> : <Copy size={11} />}{copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem 1rem", fontSize: 11, color: "#94a3b8", fontFamily: "monospace", overflowX: "auto", lineHeight: 1.6, margin: 0 }}>{code}</pre>
    </div>
  );
}

// ── Embed Card ────────────────────────────────────────────────────────────────

interface EmbedSection {
  id: string; name: string; description: string | null;
  shopify_section_id: string; targeting_rules: Record<string, unknown>;
  active: boolean; hard_gate: boolean; is_required: boolean;
  embed_impressions: number; embed_add_to_carts: number;
  winning_variation?: { name: string; shopify_section_id: string; impressions: number; add_to_carts: number } | null;
}

function ucb1Score(sectionImpressions: number, totalImpressions: number): number {
  const C = 1.0;
  return C * Math.sqrt((2 * Math.log(totalImpressions + 1)) / (sectionImpressions + 1));
}

function EmbedCard({ embed, sections, onRefresh }: { embed: Embed; sections: any[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingLive, setTogglingLive] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");

  const attachedIds = new Set(embed.sections.map((s: any) => s.id));
  const available = sections.filter(s => !attachedIds.has(s.id));

  // Compute UCB1-based display score for sorting
  const totalImpressions = embed.sections.reduce((sum: number, s: any) => sum + (s.embed_impressions ?? 0), 0);

  const sortedSections = [...embed.sections].sort((a: any, b: any) => {
    // Required always first within their group
    if (a.is_required !== b.is_required) return (b.is_required ? 1 : 0) - (a.is_required ? 1 : 0);
    const scoreA = ucb1Score(a.embed_impressions ?? 0, totalImpressions);
    const scoreB = ucb1Score(b.embed_impressions ?? 0, totalImpressions);
    return scoreB - scoreA;
  });

  const addSection = async () => {
    if (!selectedSectionId) return;
    setAddingSection(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/sections`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_id: selectedSectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add section");
      setSelectedSectionId(""); onRefresh();
    } catch (e: any) {
      alert(`Could not add section: ${e.message}`);
    } finally { setAddingSection(false); }
  };

  const removeSection = async (sectionId: string) => {
    await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/sections/${sectionId}`, { method: "DELETE" });
    onRefresh();
  };

  const toggleRequired = async (sectionId: string, currentRequired: boolean) => {
    setTogglingId(sectionId);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/sections/${sectionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_required: !currentRequired }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Toggle failed");
      }
    } catch (e: any) {
      alert(`Could not toggle required: ${e.message}`);
    } finally {
      setTogglingId(null); onRefresh();
    }
  };

  const toggleLive = async () => {
    setTogglingLive(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_live: !embed.is_live }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Toggle failed");
      onRefresh();
    } catch (e: any) {
      alert(`Could not toggle live: ${e.message}`);
    } finally { setTogglingLive(false); }
  };

  const purgeStats = async () => {
    if (!confirm(`Purge ALL stats for "${embed.name}"?\n\nThis will reset impressions, add-to-carts, and UCB1 scores to zero.\nOnly do this to clear test data before going live.`)) return;
    setPurging(true); setPurgeMsg("");
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/purge-stats`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Purge failed");
      setPurgeMsg(`✓ Purged stats for ${d.sections_purged} section(s)`);
      setTimeout(() => setPurgeMsg(""), 4000);
      onRefresh();
    } catch (e: any) {
      alert(`Purge failed: ${e.message}`);
    } finally { setPurging(false); }
  };

  const requiredCount = embed.sections.filter((s: any) => s.is_required).length;
  const isLive = embed.is_live ?? false;

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      style={{ ...CARD, marginBottom: "0.75rem", borderLeft: `3px solid ${isLive ? "#f59e0b" : embed.active ? "#34d399" : "#334155"}`, opacity: embed.active ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 14 }}>{embed.name}</span>
            {/* Live / Test badge */}
            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
              background: isLive ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)",
              color: isLive ? "#f59e0b" : "#64748b",
              border: isLive ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(100,116,139,0.15)" }}>
              {isLive ? "🟡 LIVE" : "🔧 TEST"}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: embed.active ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)", color: embed.active ? "#34d399" : "#64748b", border: embed.active ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(100,116,139,0.15)" }}>{embed.active ? "Active" : "Inactive"}</span>
            <span style={{ fontSize: 10, color: "#475569" }}>{embed.sections.length} section{embed.sections.length !== 1 ? "s" : ""}</span>
            {requiredCount > 0 && <span style={{ fontSize: 9, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>★ {requiredCount} required</span>}
            {embed.max_sections && <span style={{ fontSize: 9, color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>max {embed.max_sections}</span>}
          </div>
          {embed.description && <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{embed.description}</p>}
          {embed.url_patterns.length > 0 && (
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {embed.url_patterns.map(p => (
                <span key={p} style={{ fontSize: 9, color: "#38bdf8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", padding: "1px 6px", borderRadius: 4 }}>
                  <Globe size={8} style={{ display: "inline", marginRight: 2 }} />{p}
                </span>
              ))}
            </div>
          )}
          {purgeMsg && <p style={{ fontSize: 10, color: "#34d399", marginTop: 4 }}>{purgeMsg}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, alignItems: "center" }}>
          {/* Live toggle */}
          <button
            id={`embed-live-toggle-${embed.id}`}
            onClick={toggleLive}
            disabled={togglingLive}
            title={isLive ? "Switch to TEST mode — stops counting real impressions" : "Go LIVE — start counting real impressions"}
            style={{
              padding: "0.2rem 0.55rem", borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 700,
              background: isLive ? "rgba(245,158,11,0.15)" : "rgba(52,211,153,0.08)",
              color: isLive ? "#f59e0b" : "#34d399",
              border: isLive ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(52,211,153,0.2)",
              transition: "all 0.15s",
            }}>
            {togglingLive ? "…" : isLive ? "🟡 Live" : "🔧 Test"}
          </button>
          {/* Purge stats */}
          <button
            id={`embed-purge-${embed.id}`}
            onClick={purgeStats}
            disabled={purging}
            title="Reset all impressions + ATC stats to zero (clears test data)"
            style={{ color: purging ? "#475569" : "#f43f5e", padding: "0.25rem", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 6, cursor: "pointer", fontSize: 9, fontWeight: 700 }}>
            {purging ? "…" : "Purge"}
          </button>
          <button onClick={() => setShowCode(!showCode)} title="Show embed code" style={{ color: showCode ? "#a78bfa" : "#475569", padding: "0.25rem", background: showCode ? "rgba(167,139,250,0.08)" : "none", border: showCode ? "1px solid rgba(167,139,250,0.2)" : "none", borderRadius: 6, cursor: "pointer" }}>
            <Code size={13} />
          </button>
          <button onClick={() => setExpanded(!expanded)} title="Expand sections" style={{ color: "#475569", padding: "0.25rem", background: "none", border: "none", cursor: "pointer" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <EmbedCodeBlock embed={embed} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Sections — sorted by performance
                </p>
                <span style={{ fontSize: 9, color: "#334155" }}>★ = always renders</span>
              </div>

              {sortedSections.length === 0 ? (
                <p style={{ fontSize: 12, color: "#334155", marginBottom: "0.75rem" }}>No sections assigned yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
                  {sortedSections.map((s: any, idx: number) => {
                    const score = ucb1Score(s.embed_impressions ?? 0, totalImpressions);
                    const atcRate = (s.embed_impressions ?? 0) > 0
                      ? ((s.embed_add_to_carts ?? 0) / s.embed_impressions * 100).toFixed(1)
                      : null;
                    const isRequired = s.is_required;

                    return (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.4rem 0.6rem",
                        background: isRequired ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                        borderRadius: 8,
                        border: isRequired ? "1px solid rgba(245,158,11,0.18)" : "1px solid rgba(255,255,255,0.05)",
                      }}>
                        {/* Rank / Required indicator */}
                        <span style={{ fontSize: 9, fontWeight: 800, color: isRequired ? "#f59e0b" : "#334155", flexShrink: 0, width: 14, textAlign: "center" }}>
                          {isRequired ? "★" : `#${idx + 1}`}
                        </span>

                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.active ? "#34d399" : "#334155", flexShrink: 0 }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{s.name}</span>
                            {isRequired && (
                              <span style={{ fontSize: 8, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "0px 4px", borderRadius: 3, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Required</span>
                            )}
                          </div>
                          {/* Winning variation sub-line */}
                          {s.winning_variation && (
                            <span style={{ fontSize: 9, color: "#475569" }}>
                              winning: <code style={{ fontSize: 9, color: "#7dd3fc" }}>{s.winning_variation.name}</code>
                              {" · "}{s.winning_variation.impressions ?? 0} imp
                            </span>
                          )}
                        </div>

                        {/* Stats */}
                        <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 600, flexShrink: 0 }}>{s.embed_impressions ?? 0} imp</span>
                        {atcRate && (
                          <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, flexShrink: 0 }}>{atcRate}% ATC</span>
                        )}

                        {/* UCB1 score bar */}
                        <div title={`UCB1 score: ${score.toFixed(2)}`} style={{ width: 36, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, flexShrink: 0, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, score * 40)}%`, background: isRequired ? "#f59e0b" : "#38bdf8", borderRadius: 2 }} />
                        </div>

                        {/* Required toggle */}
                        <button
                          onClick={() => toggleRequired(s.id, isRequired)}
                          disabled={togglingId === s.id}
                          title={isRequired ? "Remove required — allow UCB1 to exclude" : "Mark required — always renders"}
                          style={{
                            padding: "0.15rem 0.4rem", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 700, flexShrink: 0,
                            background: isRequired ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                            color: isRequired ? "#f59e0b" : "#475569",
                          }}>
                          {togglingId === s.id ? "…" : isRequired ? "★ req" : "☆"}
                        </button>

                        <button onClick={() => removeSection(s.id)} style={{ color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "0.1rem" }} aria-label="Remove section">
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {available.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select className="input is-small" value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)} style={{ ...INPUT_STYLE, flex: 1 }}>
                    <option value="">— add a section —</option>
                    {available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={addSection} disabled={!selectedSectionId || addingSection} className="button is-small"
                    style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", flexShrink: 0 }}>
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmbedsPage() {
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editTarget, setEditTarget] = useState<Embed | null>(null);
  const [urlPatternInput, setUrlPatternInput] = useState("");
  const [form, setForm] = useState({ name: "", description: "", url_patterns: [] as string[], max_sections: "" });

  const fetchEmbeds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds`);
      if (res.ok) { const data = await res.json(); setEmbeds(data.embeds ?? []); }
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections`);
      if (res.ok) { const data = await res.json(); setSections(data.sections ?? []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchEmbeds(); fetchSections(); }, [fetchEmbeds, fetchSections]);

  const refresh = () => { fetchEmbeds(true); };

  const addPattern = () => { if (!urlPatternInput.trim()) return; setForm(f => ({ ...f, url_patterns: [...f.url_patterns, urlPatternInput.trim()] })); setUrlPatternInput(""); };
  const removePattern = (p: string) => setForm(f => ({ ...f, url_patterns: f.url_patterns.filter(x => x !== p) }));

  const openCreate = () => { setEditTarget(null); setForm({ name: "", description: "", url_patterns: [], max_sections: "" }); setUrlPatternInput(""); setFormError(""); setShowForm(true); };
  const openEdit = (e: Embed) => { setEditTarget(e); setForm({ name: e.name, description: e.description ?? "", url_patterns: e.url_patterns, max_sections: e.max_sections ? String(e.max_sections) : "" }); setUrlPatternInput(""); setFormError(""); setShowForm(true); };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload: any = { name: form.name.trim(), description: form.description.trim() || null, url_patterns: form.url_patterns };
      if (form.max_sections) payload.max_sections = parseInt(form.max_sections, 10) || null;
      const url = editTarget ? `${BOT_URL}/admin/intelligence/embeds/${editTarget.id}` : `${BOT_URL}/admin/intelligence/embeds`;
      const res = await fetch(url, { method: editTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); refresh();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this embed?")) return;
    await fetch(`${BOT_URL}/admin/intelligence/embeds/${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.25rem", border: "1px solid rgba(52,211,153,0.12)" }}>
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#e2e8f0" }}>Embeds</strong> are deployment targets — each embed has its own section list ranked by UCB1 + profile scoring. Set <strong style={{ color: "#f59e0b" }}>max sections</strong> to cap how many render per page load.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>{embeds.length} embed{embeds.length !== 1 ? "s" : ""}</p>
        <button onClick={openCreate} className="button is-small" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
          <Plus size={13} /> New Embed
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(52,211,153,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {editTarget ? "Edit Embed" : "New Embed"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Name</label>
                <input className="input is-small" placeholder="Homepage Hero" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Description (optional)</label>
                <input className="input is-small" placeholder="Above the fold on homepage" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Max Sections (blank = no limit)</label>
                <input className="input is-small" type="number" min="1" placeholder="e.g. 2" value={form.max_sections}
                  onChange={e => setForm(f => ({ ...f, max_sections: e.target.value }))} style={INPUT_STYLE} />
                <p style={{ fontSize: 10, color: "#475569", marginTop: "0.25rem" }}>UCB1 + profile scoring selects which sections fill these slots.</p>
              </div>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>URL Patterns (informational)</label>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input className="input is-small" placeholder="/  or  /products/*" value={urlPatternInput} onChange={e => setUrlPatternInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addPattern()} style={{ ...INPUT_STYLE, flex: 1 }} />
                <button onClick={addPattern} className="button is-small" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", flexShrink: 0 }}>
                  <Plus size={12} />
                </button>
              </div>
              {form.url_patterns.length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                  {form.url_patterns.map(p => (
                    <span key={p} style={{ fontSize: 10, color: "#38bdf8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", padding: "2px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      {p}<button onClick={() => removePattern(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {formError && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: "0.5rem" }}>⚠ {formError}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={save} disabled={saving} className="button is-small" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", fontWeight: 700 }}>
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Embed"}
              </button>
              <button onClick={() => setShowForm(false)} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>Loading embeds...</p>
      ) : embeds.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem" }}>
          <Link2 size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#475569" }}>No embeds yet. Create your first to get a deploy code.</p>
        </div>
      ) : (
        embeds.map(e => (
          <div key={e.id} style={{ position: "relative" }}>
            <EmbedCard embed={e} sections={sections} onRefresh={refresh} />
            <div style={{ position: "absolute", top: "0.75rem", right: "3.5rem", display: "flex", gap: "0.2rem" }}>
              <button onClick={() => openEdit(e)} title="Edit embed" style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}><Edit2 size={11} /></button>
              <button onClick={() => del(e.id)} title="Delete embed" style={{ color: "#f43f5e", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
