"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Layers, Plus, Edit2, Check, X, ChevronDown, ChevronUp, GripVertical,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PSection {
  id: string; name: string; description: string | null;
  shopify_section_id: string; targeting_rules: Record<string, unknown>;
  priority: number; active: boolean; hard_gate: boolean;
  stats: { impressions: number; clicks: number; avg_dwell_ms: number; add_to_cart: number };
  created_at: string; updated_at: string;
}

interface SectionFormData {
  name: string; description: string; shopify_section_id: string;
  targeting_rules_raw: string; priority: string; hard_gate: string;
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

// ── Known snippets ─────────────────────────────────────────────────────────────

const KNOWN_SNIPPETS = [
  { id: "lrb-customer-reviews", name: "Customer Reviews — Full Section", description: "Dark green rating hero + 3-column review grid. Universal.", targeting: "{}", priority: "3" },
  { id: "lrb-free-workouts", name: "Free Workouts — World Class Trainers", description: "Full-width workout library section. Shows to all visitors.", targeting: "{}", priority: "3" },
  { id: "lrb-compare-models", name: "Compare Our Models", description: "Side-by-side product comparison table. Universal.", targeting: "{}", priority: "3" },
  { id: "lrb-product-faq", name: "Product FAQ", description: "Accordion FAQ — Universal on product pages.", targeting: "{}", priority: "4" },
  { id: "lrb-lifetime-warranty", name: "Lifetime Warranty", description: "Shield icon, 4 guarantee pillars — everyone.", targeting: "{}", priority: "4" },
  { id: "lrb-hero-pain-point", name: "Hero — Knee Pain / Joint Relief", targeting: JSON.stringify({ pain: ["knee", "joint"] }, null, 2), priority: "5", description: "Primary hero for joint/knee pain visitors" },
  { id: "lrb-hero-athletic", name: "Hero — Athletic Performance", targeting: JSON.stringify({ motivation: ["performance", "fitness"], life_stage: ["athlete"] }, null, 2), priority: "7", description: "Hero for fitness/athletic audience (18–40)" },
  { id: "lrb-hero-senior", name: "Hero — Senior Fitness (50+)", targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["joint", "balance"] }, null, 2), priority: "7", description: "Hero for active adults 50+" },
  { id: "lrb-product-showcase-performance", name: "Product Showcase — Performance", targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2), priority: "6", description: "Dark/amber product cards for athletes" },
  { id: "lrb-product-showcase-wellness", name: "Product Showcase — Wellness", targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2), priority: "6", description: "Warm layout for 40+" },
  { id: "lrb-benefits-features", name: "Benefits — A Bounce That Feels Better", targeting: "{}", priority: "3", description: "Antigravity benefits — general audience" },
  { id: "lrb-benefit-callouts", name: "Benefit Callouts Grid", targeting: "{}", priority: "3", description: "Four key product benefits — universal fallback" },
  { id: "lrb-education-performance", name: "Education — Performance Training", targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2), priority: "4", description: "HIIT protocols for athletes" },
  { id: "lrb-education-health", name: "Education — Health & Research", targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2), priority: "4", description: "NASA research citations + gentle progression plan" },
  { id: "lrb-social-proof-performance", name: "Social Proof — Athletic", targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2), priority: "5", description: "Stats bar + 3 athlete testimonials" },
  { id: "lrb-social-proof-wellness", name: "Social Proof — Health & Wellness", targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2), priority: "5", description: "Featured testimonial + doctor endorsement" },
  { id: "lrb-support-tech", name: "Support — Tech / Digital Features", targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2), priority: "2", description: "App integrations for younger visitors" },
  { id: "lrb-support-traditional", name: "Support — Traditional / Phone-First", targeting: JSON.stringify({ life_stage: ["senior"] }, null, 2), priority: "2", description: "Phone CTA + DVD program for seniors" },
  { id: "lrb-cta-first-visit", name: "CTA — First-Time Visitor", targeting: JSON.stringify({ tags: ["first_time_user"] }, null, 2), priority: "8", description: "Rebounding explainer + email capture" },
  { id: "lrb-cta-return-visitor", name: "CTA — Return Visitor", targeting: JSON.stringify({ tags: ["returning"] }, null, 2), priority: "8", description: "LRB vs spring vs basic comparison + consultation CTA" },
  { id: "lrb-cta-cart-abandon", name: "CTA — Cart Abandonment", targeting: JSON.stringify({ tags: ["cart_abandoner"] }, null, 2), priority: "10", description: "4 objection-busters + checkout buttons" },
  { id: "lrb-cta-post-purchase", name: "CTA — Post-Purchase Onboarding", targeting: JSON.stringify({ identified: true, tags: ["purchased"] }, null, 2), priority: "9", description: "Setup guide, 4-week program, community" },
];

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ section, onToggle, onEdit, dragControls }: {
  section: PSection;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (section: PSection) => void;
  dragControls?: ReturnType<typeof useDragControls>;
}) {
  const [expanded, setExpanded] = useState(false);
  const rules = section.targeting_rules;
  const ruleEntries = Object.entries(rules);
  const isUniversal = ruleEntries.length === 0;
  const visibleRules = ruleEntries.slice(0, 3);
  const hiddenCount = ruleEntries.length - visibleRules.length;

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeft: `3px solid ${section.active ? "#38bdf8" : "#334155"}`,
      borderRadius: 10, padding: "0.45rem 0.75rem",
      opacity: section.active ? 1 : 0.55, marginBottom: "0.3rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
        {dragControls && (
          <div onPointerDown={e => dragControls.start(e)}
            style={{ cursor: "grab", color: "#334155", flexShrink: 0 }}>
            <GripVertical size={13} />
          </div>
        )}
        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: section.active ? "#34d399" : "#334155", boxShadow: section.active ? "0 0 5px #34d39977" : "none" }} />
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12.5, flexShrink: 0, whiteSpace: "nowrap" }}>{section.name}</span>
        <code style={{ fontSize: 9, color: "#334155", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap" }}>{section.shopify_section_id}</code>
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
        <div style={{ display: "flex", gap: "0.55rem", flexShrink: 0, alignItems: "center" }}>
          {[
            { label: "P", value: section.priority, color: "#f59e0b", title: "Priority" },
            { label: "👁", value: section.stats?.impressions ?? 0, color: "#38bdf8", title: "Impressions" },
            { label: "↗", value: section.stats?.clicks ?? 0, color: "#34d399", title: "Clicks" },
          ].map(({ label, value, color, title: ttip }) => (
            <div key={label} title={ttip} style={{ lineHeight: 1 }}>
              <span style={{ fontSize: 9, color: "#334155" }}>{label} </span>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.1rem", flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} style={{ color: "#475569", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }} aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => onEdit(section)} style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }} aria-label="Edit section"><Edit2 size={12} /></button>
          <button onClick={() => onToggle(section.id, !section.active)} style={{ color: section.active ? "#f43f5e" : "#34d399", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }} aria-label={section.active ? "Deactivate" : "Activate"}>
            {section.active ? <X size={12} /> : <Check size={12} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.55rem", paddingTop: "0.55rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {section.description && <p style={{ fontSize: 11, color: "#64748b", marginBottom: "0.4rem", lineHeight: 1.5 }}>{section.description}</p>}
              <p style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.35rem" }}>All Signals</p>
              {isUniversal ? <p style={{ fontSize: 11, color: "#475569" }}>No signals — shown to everyone.</p> : (
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {ruleEntries.map(([k, v]) => (
                    <span key={k} style={{ fontSize: 10, background: "rgba(56,189,248,0.08)", color: "#7dd3fc", padding: "2px 8px", borderRadius: 6, fontWeight: 600, border: "1px solid rgba(56,189,248,0.15)" }}>
                      <span style={{ color: "#64748b" }}>{k}:</span>{" "}
                      {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 9, color: "#334155", marginTop: "0.4rem" }}>
                Priority: {section.priority} · ATC: {section.stats?.add_to_cart ?? 0} · Dwell: {section.stats?.avg_dwell_ms ? `${(section.stats.avg_dwell_ms / 1000).toFixed(1)}s` : "—"} · Mode: {section.hard_gate ? "🔒 Required" : "⚖️ Weighted"} · Updated {new Date(section.updated_at).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReorderableSection({ section, rank, onToggle, onEdit }: {
  section: PSection; rank: number;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (section: PSection) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={section} dragControls={controls} dragListener={false} style={{ listStyle: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: 10, color: "#334155", fontWeight: 700, minWidth: 16, textAlign: "right" }}>#{rank}</span>
        <div style={{ flex: 1 }}><SectionCard section={section} onToggle={onToggle} onEdit={onEdit} dragControls={controls} /></div>
      </div>
    </Reorder.Item>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SectionsPage() {
  const [sections, setSections] = useState<PSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [orderedSections, setOrderedSections] = useState<PSection[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const empty: SectionFormData = { name: "", description: "", shopify_section_id: "", targeting_rules_raw: "{}", priority: "0", hard_gate: "false" };
  const [form, setForm] = useState<SectionFormData>(empty);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections`);
      if (res.ok) { const data = await res.json(); setSections(data.sections ?? []); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);
  useEffect(() => { setOrderedSections([...sections].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))); }, [sections]);

  const saveOrder = async (reordered: PSection[]) => {
    setSavingOrder(true);
    try {
      const total = reordered.length;
      await Promise.all(reordered.map((s, i) =>
        fetch(`${BOT_URL}/admin/intelligence/sections/${s.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: (total - i) * 10 }),
        })
      ));
      fetchSections();
    } finally { setSavingOrder(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch(`${BOT_URL}/admin/intelligence/sections/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    });
    fetchSections();
  };

  const openCreate = () => { setEditTarget(null); setForm(empty); setFormError(""); setShowForm(true); };
  const openEdit = (s: PSection) => {
    setEditTarget(s);
    setForm({ name: s.name, description: s.description ?? "", shopify_section_id: s.shopify_section_id, targeting_rules_raw: JSON.stringify(s.targeting_rules, null, 2), priority: String(s.priority), hard_gate: s.hard_gate ? "true" : "false" });
    setFormError(""); setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      let targeting_rules: Record<string, unknown> = {};
      try { targeting_rules = JSON.parse(form.targeting_rules_raw); } catch { throw new Error("Invalid JSON in signals"); }
      const payload = { name: form.name.trim(), description: form.description.trim() || null, shopify_section_id: form.shopify_section_id.trim(), targeting_rules, priority: parseInt(form.priority, 10) || 0, hard_gate: form.hard_gate === "true" };
      if (!payload.name || !payload.shopify_section_id) throw new Error("Name and Shopify Section ID are required");
      const url = editTarget ? `${BOT_URL}/admin/intelligence/sections/${editTarget.id}` : `${BOT_URL}/admin/intelligence/sections`;
      const res = await fetch(url, { method: editTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); fetchSections();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>{sections.length} section{sections.length !== 1 ? "s" : ""} registered</p>
        <button onClick={openCreate} className="button is-small"
          style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
          <Plus size={13} /> Register Section
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(56,189,248,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {editTarget ? "Edit Section" : "Register New Section"}
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Pick a Snippet</label>
              <select className="input is-small" value={form.shopify_section_id}
                onChange={e => {
                  const picked = KNOWN_SNIPPETS.find(s => s.id === e.target.value);
                  if (picked) setForm(f => ({ ...f, shopify_section_id: picked.id, name: f.name || picked.name, description: f.description || (picked.description ?? ""), targeting_rules_raw: picked.targeting, priority: picked.priority }));
                  else setForm(f => ({ ...f, shopify_section_id: e.target.value }));
                }}
                style={{ ...INPUT_STYLE, border: "1px solid rgba(56,189,248,0.25)" }}>
                <option value="">— select a snippet —</option>
                {KNOWN_SNIPPETS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                <option value="__custom__">Other (custom ID)</option>
              </select>
              {form.shopify_section_id === "__custom__" && (
                <input className="input is-small" placeholder="my-custom-snippet-id" style={{ ...INPUT_STYLE, marginTop: "0.5rem" }}
                  onChange={e => setForm(f => ({ ...f, shopify_section_id: e.target.value }))} />
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { key: "name", label: "Display Name", placeholder: "Knee Pain Hero" },
                { key: "description", label: "Description (optional)", placeholder: "Hero for knee pain visitors" },
                { key: "priority", label: "Priority (0–10)", placeholder: "5" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
                  <input className="input is-small" placeholder={placeholder} value={form[key as keyof SectionFormData]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={INPUT_STYLE} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Matching Mode</label>
                <select className="input is-small" value={form.hard_gate}
                  onChange={e => setForm(f => ({ ...f, hard_gate: e.target.value }))} style={INPUT_STYLE}>
                  <option value="false">⚖️ Weighted — signals add priority, section always eligible</option>
                  <option value="true">🔒 Required — only shows when signals match</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
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
        <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>Loading sections...</p>
      ) : orderedSections.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem" }}>
          <Layers size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#475569" }}>No sections registered yet. Click &quot;Register Section&quot; to add your first.</p>
        </div>
      ) : (
        <>
          {savingOrder && <p style={{ fontSize: 11, color: "#38bdf8", marginBottom: "0.5rem" }}>Saving order...</p>}
          <p style={{ fontSize: 11, color: "#475569", marginBottom: "0.75rem" }}>
            <GripVertical size={11} style={{ display: "inline", marginRight: 4 }} />
            Drag to reorder — top = highest priority
          </p>
          <Reorder.Group axis="y" values={orderedSections}
            onReorder={reordered => { setOrderedSections(reordered); saveOrder(reordered); }}
            style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {orderedSections.map((s, i) => (
              <ReorderableSection key={s.id} section={s} rank={i + 1} onToggle={toggle} onEdit={openEdit} />
            ))}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}
