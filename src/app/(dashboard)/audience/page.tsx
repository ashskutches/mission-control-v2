"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Users, Target, TrendingUp, Activity, Brain, Layers,
  RefreshCw, ChevronDown, ChevronUp, Zap, Eye, Mail,
  ShoppingBag, Plus, Edit2, Trash2, Check, X, BarChart3,
  Rocket, AlertTriangle, CloudUpload, GripVertical, Lock,
  Unlock, Radio, Clock, Link2, Code, Copy, CheckCheck,
  Globe, Tag, Settings, Wifi,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Analytics {
  profiles: { total: number; identified: number; identity_rate: string };
  events_last_7d: Record<string, number>;
  top_sections: {
    name: string; shopify_section_id: string;
    impressions: number; clicks: number; add_to_cart: number; avg_dwell_ms: number; ctr: string;
  }[];
}

interface PSection {
  id: string; name: string; description: string | null;
  shopify_section_id: string; targeting_rules: Record<string, unknown>;
  priority: number; active: boolean; hard_gate: boolean;
  stats: { impressions: number; clicks: number; avg_dwell_ms: number; add_to_cart: number };
  created_at: string; updated_at: string;
}

interface SignalDef {
  id: string; key: string; label: string; description: string | null;
  icon: string; color: string;
  trigger_type: "utm" | "page_view" | "time_based" | "manual" | "webhook";
  trigger_config: Record<string, unknown>;
  expires_after_ms: number | null;
  active: boolean; created_at: string;
}

interface Embed {
  id: string; name: string; description: string | null;
  url_patterns: string[]; active: boolean;
  sections: (PSection & { embed_priority: number })[];
  created_at: string; updated_at: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
} as const;

const PILL = (active: boolean, color: string) => ({
  background: active ? `${color}18` : "rgba(255,255,255,0.04)",
  color: active ? color : "#64748b",
  border: active ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8, padding: "0.3rem 0.85rem",
  fontSize: 11, fontWeight: 700, cursor: "pointer",
  textTransform: "uppercase" as const, letterSpacing: "0.06em",
  transition: "all 0.15s",
});

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e2e8f0",
} as const;

const TRIGGER_COLORS: Record<string, string> = {
  utm: "#f59e0b", page_view: "#38bdf8", time_based: "#a78bfa",
  manual: "#64748b", webhook: "#34d399",
};
const TRIGGER_LABELS: Record<string, string> = {
  utm: "UTM", page_view: "Page View", time_based: "Time-Based",
  manual: "Manual", webhook: "Webhook",
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div style={{ ...CARD, flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ analytics, loading }: { analytics: Analytics | null; loading: boolean }) {
  if (loading) return <p style={{ color: "#475569", padding: "2rem", textAlign: "center" }}>Loading analytics...</p>;
  if (!analytics) return null;

  const channelColors: Record<string, string> = {
    page: "#38bdf8", email: "#34d399", ad: "#f59e0b", purchase: "#a78bfa", quiz: "#f472b6",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <StatCard label="Total Profiles" value={analytics.profiles.total.toLocaleString()} icon={Users} color="#38bdf8" />
        <StatCard label="Identified" value={analytics.profiles.identified.toLocaleString()} icon={Target} color="#34d399" />
        <StatCard label="Identity Rate" value={analytics.profiles.identity_rate} icon={TrendingUp} color="#a78bfa" />
      </div>

      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
          Events Last 7 Days — by Channel
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {Object.entries(analytics.events_last_7d).length === 0
            ? <p style={{ color: "#475569", fontSize: 13 }}>No events yet — the snippet hasn&apos;t fired.</p>
            : Object.entries(analytics.events_last_7d).map(([ch, count]) => (
              <div key={ch} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: channelColors[ch] ?? "#64748b" }} />
                <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>{ch}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: channelColors[ch] ?? "#94a3b8" }}>{count.toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </div>

      <div style={CARD}>
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
          Top Performing Sections
        </p>
        {analytics.top_sections.length === 0 ? (
          <p style={{ color: "#475569", fontSize: 13 }}>No section data yet — sections appear once the Shopify snippet is live.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {analytics.top_sections.map(s => (
              <div key={s.shopify_section_id} style={{
                display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
                padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2 }}>{s.name}</p>
                  <code style={{ fontSize: 10, color: "#475569" }}>{s.shopify_section_id}</code>
                </div>
                {[
                  { label: "Impressions", value: s.impressions, color: "#38bdf8" },
                  { label: "Clicks", value: s.clicks, color: "#34d399" },
                  { label: "Add to Cart", value: s.add_to_cart, color: "#a78bfa" },
                  { label: "CTR", value: s.ctr, color: "#f59e0b" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", minWidth: 70 }}>
                    <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color }}>{value}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
      borderRadius: 10,
      padding: "0.45rem 0.75rem",
      opacity: section.active ? 1 : 0.55,
      marginBottom: "0.3rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
        {dragControls && (
          <div onPointerDown={e => dragControls.start(e)}
            style={{ cursor: "grab", color: "#334155", flexShrink: 0 }} title="Drag to reorder">
            <GripVertical size={13} />
          </div>
        )}

        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: section.active ? "#34d399" : "#334155",
          boxShadow: section.active ? "0 0 5px #34d39977" : "none",
        }} />

        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12.5, flexShrink: 0, whiteSpace: "nowrap" }}>
          {section.name}
        </span>

        <code style={{
          fontSize: 9, color: "#334155", background: "rgba(255,255,255,0.04)",
          padding: "1px 5px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {section.shopify_section_id}
        </code>

        {/* Signal pills */}
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
          {isUniversal ? (
            <span style={{
              fontSize: 9, color: "#64748b", background: "rgba(100,116,139,0.1)",
              padding: "1px 6px", borderRadius: 4, fontWeight: 700,
              border: "1px solid rgba(100,116,139,0.15)", flexShrink: 0,
            }}>Everyone</span>
          ) : (
            <>
              {visibleRules.map(([k, v]) => (
                <span key={k} style={{
                  fontSize: 9, background: "rgba(56,189,248,0.08)", color: "#7dd3fc",
                  padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                  border: "1px solid rgba(56,189,248,0.15)", flexShrink: 0, whiteSpace: "nowrap",
                }}>
                  <span style={{ color: "#475569" }}>{k}:</span>{" "}
                  {Array.isArray(v) ? (v as string[]).slice(0, 2).join(", ") + ((v as string[]).length > 2 ? "…" : "") : String(v)}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span style={{ fontSize: 9, color: "#475569", flexShrink: 0 }}>+{hiddenCount}</span>
              )}
            </>
          )}
        </div>


        {/* Compact stats */}
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

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.1rem", flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)}
            style={{ color: "#475569", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => onEdit(section)}
            style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            aria-label="Edit section">
            <Edit2 size={12} />
          </button>
          <button onClick={() => onToggle(section.id, !section.active)}
            style={{ color: section.active ? "#f43f5e" : "#34d399", padding: "0.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            aria-label={section.active ? "Deactivate" : "Activate"}>
            {section.active ? <X size={12} /> : <Check size={12} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.55rem", paddingTop: "0.55rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {section.description && (
                <p style={{ fontSize: 11, color: "#64748b", marginBottom: "0.4rem", lineHeight: 1.5 }}>{section.description}</p>
              )}
              <p style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.35rem" }}>
                All Signals
              </p>
              {isUniversal ? (
                <p style={{ fontSize: 11, color: "#475569" }}>No signals — shown to everyone.</p>
              ) : (
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {ruleEntries.map(([k, v]) => (
                    <span key={k} style={{
                      fontSize: 10, background: "rgba(56,189,248,0.08)", color: "#7dd3fc",
                      padding: "2px 8px", borderRadius: 6, fontWeight: 600, border: "1px solid rgba(56,189,248,0.15)",
                    }}>
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
        <div style={{ flex: 1 }}>
          <SectionCard section={section} onToggle={onToggle} onEdit={onEdit} dragControls={controls} />
        </div>
      </div>
    </Reorder.Item>
  );
}

// ── Section Library Tab ───────────────────────────────────────────────────────

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

interface SectionFormData {
  name: string; description: string; shopify_section_id: string;
  targeting_rules_raw: string; priority: string; hard_gate: string;
}

function SectionLibraryTab({ sections, loading, onRefresh }: {
  sections: PSection[]; loading: boolean; onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [orderedSections, setOrderedSections] = useState<PSection[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const empty: SectionFormData = { name: "", description: "", shopify_section_id: "", targeting_rules_raw: "{}", priority: "0", hard_gate: "false" };
  const [form, setForm] = useState<SectionFormData>(empty);

  useEffect(() => {
    setOrderedSections([...sections].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));
  }, [sections]);

  const saveOrder = async (reordered: PSection[]) => {
    setSavingOrder(true);
    try {
      const total = reordered.length;
      await Promise.all(reordered.map((s, i) => {
        const priority = (total - i) * 10;
        return fetch(`${BOT_URL}/admin/intelligence/sections/${s.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority }),
        });
      }));
      onRefresh();
    } finally { setSavingOrder(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch(`${BOT_URL}/admin/intelligence/sections/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    onRefresh();
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
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); onRefresh();
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
                  if (picked) {
                    setForm(f => ({ ...f, shopify_section_id: picked.id, name: f.name || picked.name, description: f.description || picked.description, targeting_rules_raw: picked.targeting, priority: picked.priority }));
                  } else {
                    setForm(f => ({ ...f, shopify_section_id: e.target.value }));
                  }
                }}
                style={{ ...INPUT_STYLE, border: "1px solid rgba(56,189,248,0.25)" }}>
                <option value="">— select a snippet —</option>
                {KNOWN_SNIPPETS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                <option value="__custom__">Other (custom ID)</option>
              </select>
              {form.shopify_section_id === "__custom__" && (
                <input className="input is-small" placeholder="my-custom-snippet-id"
                  style={{ ...INPUT_STYLE, marginTop: "0.5rem" }}
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
                  <input className="input is-small" placeholder={placeholder}
                    value={form[key as keyof SectionFormData]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={INPUT_STYLE} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Matching Mode</label>
                <select className="input is-small" value={form.hard_gate}
                  onChange={e => setForm(f => ({ ...f, hard_gate: e.target.value }))}
                  style={INPUT_STYLE}>
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

// ── Signals Tab ───────────────────────────────────────────────────────────────

function SignalTriggerFields({ form, setForm }: { form: any; setForm: any }) {
  const type = form.trigger_type;
  return (
    <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {type === "utm" && (
        <>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>UTM Param</label>
            <input className="input is-small" placeholder="utm_campaign" style={INPUT_STYLE}
              value={form.trigger_config?.param ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, trigger_config: { ...f.trigger_config, param: e.target.value } }))} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>UTM Value (contains)</label>
            <input className="input is-small" placeholder="knee_pain" style={INPUT_STYLE}
              value={form.trigger_config?.value ?? ""}
              onChange={e => setForm((f: any) => ({ ...f, trigger_config: { ...f.trigger_config, value: e.target.value } }))} />
          </div>
        </>
      )}
      {type === "page_view" && (
        <div>
          <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>URL Contains</label>
          <input className="input is-small" placeholder="/blogs/joint-health" style={INPUT_STYLE}
            value={form.trigger_config?.url_contains ?? ""}
            onChange={e => setForm((f: any) => ({ ...f, trigger_config: { url_contains: e.target.value } }))} />
        </div>
      )}
      {type === "time_based" && (
        <div>
          <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Expires After (ms, leave blank = never)</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[
              { label: "1 hour", ms: 3600000 },
              { label: "24 hours", ms: 86400000 },
              { label: "7 days", ms: 604800000 },
              { label: "Never", ms: null },
            ].map(opt => (
              <button key={opt.label}
                onClick={() => setForm((f: any) => ({ ...f, expires_after_ms: opt.ms, trigger_config: opt.ms ? { expires_after_ms: opt.ms } : {} }))}
                style={{
                  fontSize: 10, padding: "0.2rem 0.6rem", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                  background: form.expires_after_ms === opt.ms ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                  color: form.expires_after_ms === opt.ms ? "#a78bfa" : "#64748b",
                  border: form.expires_after_ms === opt.ms ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalsTab({ signals, loading, onRefresh }: { signals: SignalDef[]; loading: boolean; onRefresh: () => void }) {
  const emptyForm = { key: "", label: "", description: "", icon: "🎯", color: "#38bdf8", trigger_type: "manual", trigger_config: {}, expires_after_ms: null as number | null };
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SignalDef | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setFormError(""); setShowForm(true); };
  const openEdit = (s: SignalDef) => {
    setEditTarget(s);
    setForm({ key: s.key, label: s.label, description: s.description ?? "", icon: s.icon, color: s.color, trigger_type: s.trigger_type, trigger_config: s.trigger_config, expires_after_ms: s.expires_after_ms });
    setFormError(""); setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      if (!form.key || !form.label) throw new Error("Key and label are required");
      const url = editTarget ? `${BOT_URL}/admin/intelligence/signals/${editTarget.id}` : `${BOT_URL}/admin/intelligence/signals`;
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); onRefresh();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this signal? It will no longer auto-apply to visitors.")) return;
    await fetch(`${BOT_URL}/admin/intelligence/signals/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const toggleActive = async (s: SignalDef) => {
    await fetch(`${BOT_URL}/admin/intelligence/signals/${s.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }),
    });
    onRefresh();
  };

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.25rem", border: "1px solid rgba(56,189,248,0.12)" }}>
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#e2e8f0" }}>Signals</strong> are behavioral tags assigned to visitor profiles. The snippet auto-applies UTM, page-view, and time-based signals on page load. Signals marked <strong style={{ color: "#f59e0b" }}>UTM</strong> fire when a URL param matches. <strong style={{ color: "#38bdf8" }}>Page View</strong> signals fire when the visitor browses matching URLs. <strong style={{ color: "#a78bfa" }}>Time-Based</strong> signals like <code>first_time_user</code> expire after a set duration.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>{signals.length} signal{signals.length !== 1 ? "s" : ""} defined</p>
        <button onClick={openCreate} className="button is-small"
          style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
          <Plus size={13} /> New Signal
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(56,189,248,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {editTarget ? "Edit Signal" : "New Signal"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { key: "key", label: "Key (slug)", placeholder: "knee_pain" },
                { key: "label", label: "Label", placeholder: "Knee Pain Signal" },
                { key: "icon", label: "Icon (emoji)", placeholder: "🦵" },
                { key: "color", label: "Color (hex)", placeholder: "#f59e0b" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
                  <input className="input is-small" placeholder={placeholder} value={form[key] ?? ""}
                    onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} style={INPUT_STYLE} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Description (optional)</label>
              <input className="input is-small" placeholder="Set when visitor arrives from a knee pain ad..." value={form.description ?? ""}
                onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.5rem" }}>Trigger Type</label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {(["utm", "page_view", "time_based", "manual", "webhook"] as const).map(t => (
                  <button key={t} onClick={() => setForm((f: any) => ({ ...f, trigger_type: t, trigger_config: {}, expires_after_ms: null }))}
                    style={{
                      fontSize: 10, padding: "0.25rem 0.7rem", borderRadius: 6, cursor: "pointer", fontWeight: 700,
                      background: form.trigger_type === t ? `${TRIGGER_COLORS[t]}15` : "rgba(255,255,255,0.04)",
                      color: form.trigger_type === t ? TRIGGER_COLORS[t] : "#64748b",
                      border: form.trigger_type === t ? `1px solid ${TRIGGER_COLORS[t]}40` : "1px solid rgba(255,255,255,0.06)",
                    }}>
                    {TRIGGER_LABELS[t]}
                  </button>
                ))}
              </div>
              <SignalTriggerFields form={form} setForm={setForm} />
            </div>
            {formError && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: "0.5rem" }}>⚠ {formError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button onClick={save} disabled={saving} className="button is-small"
                style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontWeight: 700 }}>
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Signal"}
              </button>
              <button onClick={() => setShowForm(false)} className="button is-small is-ghost" style={{ color: "#475569" }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>Loading signals...</p>
      ) : signals.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem" }}>
          <Radio size={32} color="#334155" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#475569" }}>No signals defined yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {signals.map(s => (
            <motion.div key={s.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              style={{
                ...CARD, padding: "0.6rem 0.85rem",
                borderLeft: `3px solid ${s.active ? s.color : "#334155"}`,
                opacity: s.active ? 1 : 0.5,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{s.label}</span>
                    <code style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>{s.key}</code>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                      background: `${TRIGGER_COLORS[s.trigger_type]}15`,
                      color: TRIGGER_COLORS[s.trigger_type],
                      border: `1px solid ${TRIGGER_COLORS[s.trigger_type]}30`,
                    }}>
                      {TRIGGER_LABELS[s.trigger_type]}
                    </span>
                    {s.expires_after_ms && (
                      <span style={{ fontSize: 9, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={9} /> expires {s.expires_after_ms >= 86400000 ? `${s.expires_after_ms / 86400000}d` : `${s.expires_after_ms / 3600000}h`}
                      </span>
                    )}
                  </div>
                  {s.description && <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.description}</p>}
                </div>
                <div style={{ display: "flex", gap: "0.2rem", flexShrink: 0 }}>
                  <button onClick={() => toggleActive(s)} title={s.active ? "Deactivate" : "Activate"}
                    style={{ color: s.active ? "#f43f5e" : "#34d399", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>
                    {s.active ? <X size={12} /> : <Check size={12} />}
                  </button>
                  <button onClick={() => openEdit(s)} title="Edit"
                    style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => del(s.id)} title="Delete"
                    style={{ color: "#f43f5e", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Embeds Tab ─────────────────────────────────────────────────────────────────

function EmbedCodeBlock({ embed }: { embed: Embed }) {
  const [copied, setCopied] = useState(false);
  const code = `<script>
  window.LRB_INTELLIGENCE_CONFIG = {
    botUrl: '${BOT_URL.replace("localhost:3001", "gravity-claw-production-fb9e.up.railway.app")}',
    embedId: '${embed.id}'
  };
</script>
{{ 'lrb-personalization.js' | asset_url | script_tag }}`;

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          <Code size={10} style={{ display: "inline", marginRight: 4 }} />Embed Code — paste into Shopify theme
        </p>
        <button onClick={copy}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: 10, fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: 6, cursor: "pointer", background: copied ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)", color: copied ? "#34d399" : "#64748b", border: copied ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(255,255,255,0.08)", transition: "all 0.15s" }}>
          {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
        padding: "0.75rem 1rem", fontSize: 11, color: "#94a3b8", fontFamily: "monospace",
        overflowX: "auto", lineHeight: 1.6, margin: 0,
      }}>{code}</pre>
    </div>
  );
}

function EmbedCard({ embed, sections, onRefresh }: { embed: Embed; sections: PSection[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const attachedIds = new Set(embed.sections.map(s => s.id));
  const available = sections.filter(s => !attachedIds.has(s.id));

  const addSection = async () => {
    if (!selectedSectionId) return;
    setAddingSection(true);
    try {
      const sel = sections.find(s => s.id === selectedSectionId)!;
      await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/sections`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_id: selectedSectionId, priority: sel.priority }),
      });
      setSelectedSectionId(""); onRefresh();
    } finally { setAddingSection(false); }
  };

  const removeSection = async (sectionId: string) => {
    await fetch(`${BOT_URL}/admin/intelligence/embeds/${embed.id}/sections/${sectionId}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      style={{
        ...CARD, marginBottom: "0.75rem",
        borderLeft: `3px solid ${embed.active ? "#34d399" : "#334155"}`,
        opacity: embed.active ? 1 : 0.6,
      }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 14 }}>{embed.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
              background: embed.active ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)",
              color: embed.active ? "#34d399" : "#64748b",
              border: embed.active ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(100,116,139,0.15)",
            }}>{embed.active ? "Active" : "Inactive"}</span>
            <span style={{ fontSize: 10, color: "#475569" }}>{embed.sections.length} section{embed.sections.length !== 1 ? "s" : ""}</span>
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
        </div>
        <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
          <button onClick={() => setShowCode(!showCode)} title="Show embed code"
            style={{ color: showCode ? "#a78bfa" : "#475569", padding: "0.25rem", background: showCode ? "rgba(167,139,250,0.08)" : "none", border: showCode ? "1px solid rgba(167,139,250,0.2)" : "none", borderRadius: 6, cursor: "pointer" }}>
            <Code size={13} />
          </button>
          <button onClick={() => setExpanded(!expanded)} title="Expand sections"
            style={{ color: "#475569", padding: "0.25rem", background: "none", border: "none", cursor: "pointer" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Embed code */}
      <AnimatePresence>
        {showCode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <EmbedCodeBlock embed={embed} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections list */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: "0.5rem" }}>Sections in this Embed</p>
              {embed.sections.length === 0 ? (
                <p style={{ fontSize: 12, color: "#334155", marginBottom: "0.75rem" }}>No sections assigned yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
                  {[...embed.sections].sort((a, b) => (b.embed_priority ?? 0) - (a.embed_priority ?? 0)).map(s => (
                    <div key={s.id} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.02)", borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.active ? "#34d399" : "#334155", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{s.name}</span>
                      <code style={{ fontSize: 9, color: "#475569" }}>{s.shopify_section_id}</code>
                      {s.hard_gate && <span title="Hard gate"><Lock size={9} color="#fb923c" /></span>}
                      <button onClick={() => removeSection(s.id)}
                        style={{ color: "#f43f5e", background: "none", border: "none", cursor: "pointer", padding: "0.1rem" }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {available.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select className="input is-small" value={selectedSectionId}
                    onChange={e => setSelectedSectionId(e.target.value)}
                    style={{ ...INPUT_STYLE, flex: 1 }}>
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

function EmbedsTab({ sections, onRefresh }: { sections: PSection[]; onRefresh: () => void }) {
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editTarget, setEditTarget] = useState<Embed | null>(null);
  const [urlPatternInput, setUrlPatternInput] = useState("");
  const [form, setForm] = useState({ name: "", description: "", url_patterns: [] as string[] });

  const fetchEmbeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/embeds`);
      if (res.ok) { const data = await res.json(); setEmbeds(data.embeds ?? []); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmbeds(); }, [fetchEmbeds]);

  const refresh = () => { fetchEmbeds(); onRefresh(); };

  const addPattern = () => {
    if (!urlPatternInput.trim()) return;
    setForm(f => ({ ...f, url_patterns: [...f.url_patterns, urlPatternInput.trim()] }));
    setUrlPatternInput("");
  };
  const removePattern = (p: string) => setForm(f => ({ ...f, url_patterns: f.url_patterns.filter(x => x !== p) }));

  const openCreate = () => { setEditTarget(null); setForm({ name: "", description: "", url_patterns: [] }); setUrlPatternInput(""); setFormError(""); setShowForm(true); };
  const openEdit = (e: Embed) => { setEditTarget(e); setForm({ name: e.name, description: e.description ?? "", url_patterns: e.url_patterns }); setUrlPatternInput(""); setFormError(""); setShowForm(true); };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      if (!form.name.trim()) throw new Error("Name is required");
      const url = editTarget ? `${BOT_URL}/admin/intelligence/embeds/${editTarget.id}` : `${BOT_URL}/admin/intelligence/embeds`;
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); refresh();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this embed? The embed code will stop working once removed.")) return;
    await fetch(`${BOT_URL}/admin/intelligence/embeds/${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.25rem", border: "1px solid rgba(52,211,153,0.12)" }}>
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#e2e8f0" }}>Embeds</strong> are deployment targets — each embed has its own section list and generates a unique <code style={{ color: "#a78bfa" }}>&lt;script&gt;</code> tag to paste into your Shopify theme. One embed per placement (homepage, product page, blog, etc.). Each embed only delivers its own sections.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>{embeds.length} embed{embeds.length !== 1 ? "s" : ""}</p>
        <button onClick={openCreate} className="button is-small"
          style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
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
                <input className="input is-small" placeholder="Homepage Hero" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Description (optional)</label>
                <input className="input is-small" placeholder="Above the fold on homepage" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={INPUT_STYLE} />
              </div>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>URL Patterns (for reference — informational only)</label>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input className="input is-small" placeholder="/  or  /products/*" value={urlPatternInput}
                  onChange={e => setUrlPatternInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addPattern()}
                  style={{ ...INPUT_STYLE, flex: 1 }} />
                <button onClick={addPattern} className="button is-small"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)", flexShrink: 0 }}>
                  <Plus size={12} />
                </button>
              </div>
              {form.url_patterns.length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                  {form.url_patterns.map(p => (
                    <span key={p} style={{ fontSize: 10, color: "#38bdf8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", padding: "2px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      {p}
                      <button onClick={() => removePattern(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {formError && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: "0.5rem" }}>⚠ {formError}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={save} disabled={saving} className="button is-small"
                style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", fontWeight: 700 }}>
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
              <button onClick={() => openEdit(e)} title="Edit embed"
                style={{ color: "#38bdf8", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>
                <Edit2 size={11} />
              </button>
              <button onClick={() => del(e.id)} title="Delete embed"
                style={{ color: "#f43f5e", padding: "0.2rem", background: "none", border: "none", cursor: "pointer" }}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Theme Deploy Tab ──────────────────────────────────────────────────────────

interface ShopifyTheme { id: number; name: string; role: "main" | "unpublished" | "demo"; created_at: string; updated_at: string; }
interface DeployResult { theme_id: number; deployed: string[]; failed: { key: string; error: string }[]; ok: boolean; }

function ThemeDeployTab() {
  const [themes, setThemes] = useState<ShopifyTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState("");

  const loadThemes = async () => {
    setLoadingThemes(true); setError(""); setDeployResult(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/list`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to list themes");
      const data = await res.json();
      const list: ShopifyTheme[] = data.themes ?? [];
      setThemes(list);
      const sandbox = list.find(t => t.name.toLowerCase().includes("dynamic sections") || t.name.toLowerCase().includes("intelligence"));
      const fallback = list.find(t => t.role !== "main") ?? list[0];
      setSelectedThemeId((sandbox ?? fallback)?.id ?? null);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingThemes(false); }
  };

  const deployAll = async () => {
    if (!selectedThemeId) return;
    setDeploying(true); setDeployResult(null); setError("");
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/deploy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: selectedThemeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deploy failed");
      setDeployResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setDeploying(false); }
  };

  const selectedTheme = themes.find(t => t.id === selectedThemeId);

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.5rem", border: "1px solid rgba(167,139,250,0.2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Rocket size={16} color="#a78bfa" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, color: "#e2e8f0", marginBottom: "0.25rem" }}>Deploy Assets to Theme</p>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Pushes <code style={{ color: "#a78bfa" }}>lrb-personalization.js</code>, all snippets, and two auto-generated sections to your theme.
            </p>
          </div>
        </div>

        {/* Architecture steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          {[
            {
              step: "1",
              label: "Deploy All Assets",
              detail: "Pushes the JS, all snippets, and generates snippets/lrb-template-pool.liquid + sections/lrb-embed.liquid",
              color: "#a78bfa",
            },
            {
              step: "2",
              label: "Add pool to theme.liquid (once)",
              detail: "In Shopify → Edit Code → layout/theme.liquid, paste {%- render 'lrb-template-pool' -%} just before </body>. Do this once — it makes all sections globally available.",
              color: "#38bdf8",
              code: "{%- render 'lrb-template-pool' -%}",
            },
            {
              step: "3",
              label: "Add lrb-embed section per page",
              detail: "In Shopify's page editor, add the \"LRB Intelligence Embed\" section wherever you want sections to appear. Set its Embed ID field to the UUID from Audience → Embeds.",
              color: "#34d399",
            },
          ].map(({ step, label, detail, color, code }) => (
            <div key={step} style={{
              display: "flex", gap: "0.75rem", alignItems: "flex-start",
              padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", background: `${color}18`,
                border: `1px solid ${color}30`, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0, marginTop: 1,
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color }}>{step}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: "0.2rem" }}>{label}</p>
                <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{detail}</p>
                {code && (
                  <code style={{
                    display: "inline-block", marginTop: "0.35rem", fontSize: 11,
                    color: "#38bdf8", background: "rgba(56,189,248,0.07)",
                    border: "1px solid rgba(56,189,248,0.15)", borderRadius: 5,
                    padding: "2px 8px", fontFamily: "monospace",
                  }}>{code}</code>
                )}
              </div>
            </div>
          ))}
        </div>


        {themes.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>Target Theme</label>
            <select value={selectedThemeId ?? ""} onChange={e => setSelectedThemeId(Number(e.target.value))}
              style={{ ...INPUT_STYLE, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: 13, width: "100%", cursor: "pointer" }}>
              {themes.map(t => <option key={t.id} value={t.id} style={{ background: "#0f172a" }}>{t.name} {t.role === "main" ? "🟢 LIVE" : ""}</option>)}
            </select>
            {selectedTheme && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.3rem" }}>
                ID: {selectedTheme.id} ·{" "}
                {selectedTheme.role === "main"
                  ? <span style={{ color: "#f43f5e" }}>⚠ This is your live theme — deploying will affect customers</span>
                  : <span style={{ color: "#34d399" }}>Safe sandbox theme</span>}
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={loadThemes} disabled={loadingThemes} className="button is-small"
            style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <RefreshCw size={12} className={loadingThemes ? "spin" : ""} />
            {themes.length ? "Refresh Themes" : "List Themes"}
          </button>
          <button onClick={deployAll} disabled={deploying || !selectedThemeId} className="button is-small"
            style={{ background: deploying ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CloudUpload size={13} /> {deploying ? "Deploying..." : "Deploy All Assets"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...CARD, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.05)", marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
        </div>
      )}

      {deployResult && (
        <div style={{ ...CARD, border: `1px solid ${deployResult.ok ? "rgba(52,211,153,0.3)" : "rgba(244,63,94,0.3)"}`, marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, color: deployResult.ok ? "#34d399" : "#f43f5e", marginBottom: "0.5rem" }}>
            {deployResult.ok ? "✓ Deploy successful" : "⚠ Partial deploy"} — {deployResult.deployed.length} file{deployResult.deployed.length !== 1 ? "s" : ""}
          </p>
          {deployResult.deployed.map(k => <div key={k} style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace", marginBottom: 2 }}>+ {k}</div>)}
          {deployResult.failed.map(f => <div key={f.key} style={{ fontSize: 11, color: "#f43f5e", fontFamily: "monospace", marginBottom: 2 }}>✗ {f.key}: {f.error}</div>)}
        </div>
      )}

      {themes.length > 0 && (
        <div style={CARD}>
          <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>Installed Themes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {themes.map(t => (
              <div key={t.id} onClick={() => setSelectedThemeId(t.id)} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem", borderRadius: 8, cursor: "pointer",
                background: selectedThemeId === t.id ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
                border: selectedThemeId === t.id ? "1px solid rgba(167,139,250,0.3)" : t.role === "main" ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.04)",
                transition: "all 0.15s",
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2 }}>{t.name}</p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: t.role === "main" ? "#34d399" : "#64748b", background: t.role === "main" ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)", padding: "1px 7px", borderRadius: 10, textTransform: "uppercase" }}>
                      {t.role === "main" ? "Live" : "Unpublished"}
                    </span>
                    <span style={{ fontSize: 10, color: "#334155" }}>ID: {t.id}</span>
                  </div>
                </div>
                {selectedThemeId === t.id && <Check size={14} color="#a78bfa" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {themes.length === 0 && !loadingThemes && (
        <div style={{ ...CARD, textAlign: "center", padding: "2.5rem" }}>
          <Rocket size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>Click &quot;List Themes&quot; to see your Shopify themes.</p>
          <p style={{ color: "#334155", fontSize: 11, marginTop: "0.4rem" }}>Requires <code>read_themes</code> scope on the Gravity Claw app.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "sections" | "signals" | "embeds" | "deploy";

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "overview",  label: "Dashboard",       icon: BarChart3,  color: "#38bdf8" },
  { id: "sections",  label: "Sections",        icon: Layers,     color: "#a78bfa" },
  { id: "signals",   label: "Signals",         icon: Radio,      color: "#f59e0b" },
  { id: "embeds",    label: "Embeds",          icon: Link2,      color: "#34d399" },
  { id: "deploy",    label: "Deploy",          icon: Rocket,     color: "#64748b" },
];

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  page: Eye, email: Mail, ad: Target, purchase: ShoppingBag, quiz: Brain,
};

export default function AudiencePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sections, setSections] = useState<PSection[]>([]);
  const [signals, setSignals] = useState<SignalDef[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingSignals, setLoadingSignals] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/analytics`);
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silent */ }
    finally { setLoadingAnalytics(false); }
  }, []);

  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/sections`);
      if (res.ok) { const data = await res.json(); setSections(data.sections ?? []); }
    } catch { /* silent */ }
    finally { setLoadingSections(false); }
  }, []);

  const fetchSignals = useCallback(async () => {
    setLoadingSignals(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/signals`);
      if (res.ok) { const data = await res.json(); setSignals(data.signals ?? []); }
    } catch { /* silent */ }
    finally { setLoadingSignals(false); }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchSections();
    fetchSignals();
  }, [fetchAnalytics, fetchSections, fetchSignals]);

  const refresh = () => { fetchAnalytics(); fetchSections(); fetchSignals(); };

  return (
    <div className="px-5 py-5" style={{ maxWidth: 1020, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(167,139,250,0.2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(56,189,248,0.2)",
            }}>
              <Activity size={18} color="#38bdf8" />
            </div>
            <h1 className="has-text-white" style={{ fontWeight: 800, fontSize: "1.5rem" }}>Audience</h1>
          </div>
          <p style={{ color: "#64748b", fontSize: 13 }}>
            Customer intelligence — psychological profiles powering page, email, and ad personalization.
          </p>
        </div>
        <button onClick={refresh} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh">
          <RefreshCw size={14} className={loadingAnalytics ? "spin" : ""} />
        </button>
      </div>

      {/* Channel signal badges */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {[
          { ch: "page", label: "Page Signals", color: "#38bdf8" },
          { ch: "email", label: "Email Signals", color: "#34d399" },
          { ch: "ad", label: "Ad Signals", color: "#f59e0b" },
          { ch: "purchase", label: "Purchase Signals", color: "#a78bfa" },
          { ch: "quiz", label: "Quiz / Survey", color: "#f472b6" },
        ].map(({ ch, label, color }) => {
          const Icon = CHANNEL_ICONS[ch] ?? Zap;
          const count = analytics?.events_last_7d?.[ch] ?? 0;
          return (
            <div key={ch} style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: `${color}0d`, border: `1px solid ${color}22`,
              borderRadius: 20, padding: "0.2rem 0.7rem",
            }}>
              <Icon size={11} color={color} />
              <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              {count > 0 && <span style={{ fontSize: 10, color, fontWeight: 800 }}>· {count}</span>}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem", flexWrap: "wrap" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} id={`audience-tab-${t.id}`} onClick={() => setTab(t.id)}
              style={{ ...PILL(tab === t.id, t.color), display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {tab === "overview" && <OverviewTab analytics={analytics} loading={loadingAnalytics} />}
          {tab === "sections" && <SectionLibraryTab sections={sections} loading={loadingSections} onRefresh={fetchSections} />}
          {tab === "signals"  && <SignalsTab signals={signals} loading={loadingSignals} onRefresh={fetchSignals} />}
          {tab === "embeds"   && <EmbedsTab sections={sections} onRefresh={fetchSections} />}
          {tab === "deploy"   && <ThemeDeployTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
