"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Users, Target, TrendingUp, Activity, Brain, Layers,
  RefreshCw, ChevronDown, ChevronUp, Zap, Eye, Mail,
  ShoppingBag, Plus, Edit2, Trash2, Check, X, BarChart3,
  Rocket, AlertTriangle, CloudUpload, GripVertical,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

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
  priority: number; active: boolean;
  stats: { impressions: number; clicks: number; avg_dwell_ms: number; add_to_cart: number };
  created_at: string; updated_at: string;
}

// ── Shared styles ────────────────────────────────────────────────────────────

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

// ── Stat Card ────────────────────────────────────────────────────────────────

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

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ analytics, loading }: { analytics: Analytics | null; loading: boolean }) {
  if (loading) return <p style={{ color: "#475569", padding: "2rem", textAlign: "center" }}>Loading analytics...</p>;
  if (!analytics) return null;

  const channelColors: Record<string, string> = {
    page: "#38bdf8", email: "#34d399", ad: "#f59e0b", purchase: "#a78bfa", quiz: "#f472b6",
  };

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <StatCard label="Total Profiles" value={analytics.profiles.total.toLocaleString()} icon={Users} color="#38bdf8" />
        <StatCard label="Identified" value={analytics.profiles.identified.toLocaleString()} icon={Target} color="#34d399" />
        <StatCard label="Identity Rate" value={analytics.profiles.identity_rate} icon={TrendingUp} color="#a78bfa" />
      </div>

      {/* Events by channel */}
      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
          Events Last 7 Days — by Channel
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {Object.entries(analytics.events_last_7d).length === 0
            ? <p style={{ color: "#475569", fontSize: 13 }}>No events yet — the snippet hasn't fired.</p>
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

      {/* Top sections */}
      <div style={CARD}>
        <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
          Top Performing Sections
        </p>
        {analytics.top_sections.length === 0 ? (
          <p style={{ color: "#475569", fontSize: 13 }}>No section data yet — sections will appear once the Shopify snippet is live.</p>
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

// ── Section Library Tab ───────────────────────────────────────────────────────

function SectionCard({ section, onToggle, onEdit, dragControls }: {
  section: PSection;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (section: PSection) => void;
  dragControls?: ReturnType<typeof useDragControls>;
}) {
  const [expanded, setExpanded] = useState(false);
  const rules = section.targeting_rules;

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{
      ...CARD,
      borderLeft: `3px solid ${section.active ? "#38bdf8" : "#334155"}`,
      opacity: section.active ? 1 : 0.5,
      marginBottom: "0.75rem",
      display: "flex",
      gap: "0.5rem",
      alignItems: "flex-start",
    }}>
      {/* Drag handle */}
      {dragControls && (
        <div
          onPointerDown={e => dragControls.start(e)}
          style={{ cursor: "grab", color: "#334155", paddingTop: 2, flexShrink: 0 }}
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>
      )}
      <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 14 }}>{section.name}</span>
            <code style={{ fontSize: 10, color: "#475569", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>
              {section.shopify_section_id}
            </code>
            <span style={{ fontSize: 9, fontWeight: 700, color: section.active ? "#34d399" : "#64748b",
              background: section.active ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)",
              padding: "1px 6px", borderRadius: 10, textTransform: "uppercase" }}>
              {section.active ? "Active" : "Inactive"}
            </span>
          </div>
          {section.description && (
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: "0.5rem" }}>{section.description}</p>
          )}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {[
              { label: "Impr.", value: section.stats?.impressions ?? 0, color: "#38bdf8" },
              { label: "Clicks", value: section.stats?.clicks ?? 0, color: "#34d399" },
              { label: "ATC", value: section.stats?.add_to_cart ?? 0, color: "#a78bfa" },
              { label: "Dwell", value: section.stats?.avg_dwell_ms ? `${(section.stats.avg_dwell_ms / 1000).toFixed(1)}s` : "—", color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label} </span>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} className="button is-ghost is-small"
            style={{ color: "#475569", padding: "0.25rem" }} aria-label="Expand targeting rules">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onEdit(section)} className="button is-ghost is-small"
            style={{ color: "#38bdf8", padding: "0.25rem" }} aria-label="Edit section">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onToggle(section.id, !section.active)} className="button is-ghost is-small"
            style={{ color: section.active ? "#f43f5e" : "#34d399", padding: "0.25rem" }}
            aria-label={section.active ? "Deactivate" : "Activate"}>
            {section.active ? <X size={13} /> : <Check size={13} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>
                Targeting Rules
              </p>
              {Object.keys(rules).length === 0 ? (
                <p style={{ fontSize: 12, color: "#475569" }}>No targeting rules — shown to everyone.</p>
              ) : (
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {Object.entries(rules).map(([k, v]) => (
                    <span key={k} style={{
                      fontSize: 10, background: "rgba(56,189,248,0.08)", color: "#38bdf8",
                      padding: "2px 8px", borderRadius: 6, fontWeight: 600, border: "1px solid rgba(56,189,248,0.15)",
                    }}>
                      {k}: {Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 9, color: "#334155", marginTop: "0.5rem" }}>
                Priority: {section.priority} · Updated {new Date(section.updated_at).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Extracted so useDragControls is called at the top level of a component, not inside a .map()
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


interface SectionFormData {
  name: string; description: string; shopify_section_id: string;
  targeting_rules_raw: string; priority: string;
}

const KNOWN_SNIPPETS = [
  // ── Universal ──────────────────────────────────────────────────────────────
  {
    id: "lrb-customer-reviews",
    name: "Customer Reviews — Full Section",
    description: "Dark green rating hero (4.9★, bars, featured quote) + 3-column review grid using real LRB quotes + CTA footer. Universal — shows to all visitors.",
    targeting: "{}",
    priority: "3",
  },
  {
    id: "lrb-free-workouts",
    name: "Free Workouts — World Class Trainers",
    description: "Full-width dark-green section showcasing the free workout library — Boosts Immunity, Lymphatic Drainage, Burn Calories, etc. Shows to all visitors.",
    targeting: "{}",
    priority: "3",
  },
  // ── Trust / Conversion ─────────────────────────────────────────────────────
  {
    id: "lrb-lifetime-warranty",
    name: "Lifetime Warranty",
    description: "Shield icon, 4 guarantee pillars, trust bar — shows to everyone on product pages",
    targeting: "{}",
    priority: "4",
  },
  // ── Hero sections ──────────────────────────────────────────────────────────

  {
    id: "lrb-hero-pain-point",
    name: "Hero — Knee Pain / Joint Relief",
    description: "Primary hero for joint/knee pain visitors",
    targeting: JSON.stringify({ pain: ["knee", "joint", "back"] }, null, 2),
    priority: "5",
  },
  {
    id: "lrb-hero-athletic",
    name: "Hero — Athletic Performance",
    description: "Hero for fitness/athletic audience (18–40)",
    targeting: JSON.stringify({ motivation: ["performance", "fitness"], life_stage: ["athlete"] }, null, 2),
    priority: "7",
  },
  {
    id: "lrb-hero-senior",
    name: "Hero — Senior Fitness (50+)",
    description: "Hero for active adults 50+ prioritising longevity and mobility",
    targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["joint", "balance"] }, null, 2),
    priority: "7",
  },
  // ── Product showcases ──────────────────────────────────────────────────────
  {
    id: "lrb-product-showcase-performance",
    name: "Product Showcase — Performance",
    description: "Dark/amber product cards for athletes — features, specs, accessories",
    targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2),
    priority: "6",
  },
  {
    id: "lrb-product-showcase-wellness",
    name: "Product Showcase — Health & Wellness",
    description: "Warm product layout for 40+ — safety, stability bar, beginner guides",
    targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2),
    priority: "6",
  },
  // ── Benefits / Education ───────────────────────────────────────────────────
  {
    id: "lrb-benefits-features",
    name: "Benefits — A Bounce That Feels Better",
    description: "Antigravity benefits with 3 image rows — general audience",
    targeting: "{}",
    priority: "3",
  },
  {
    id: "lrb-benefit-callouts",
    name: "Benefit Callouts Grid",
    description: "Four key product benefits — shows to everyone as fallback",
    targeting: "{}",
    priority: "3",
  },
  {
    id: "lrb-education-performance",
    name: "Education — Performance Training",
    description: "HIIT protocols, science, and recovery content for athletes",
    targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2),
    priority: "4",
  },
  {
    id: "lrb-education-health",
    name: "Education — Health & Research",
    description: "NASA research citations + gentle 4-week progression plan for health-focused users",
    targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2),
    priority: "4",
  },
  // ── Social proof ───────────────────────────────────────────────────────────
  {
    id: "lrb-social-proof-performance",
    name: "Social Proof — Athletic",
    description: "Stats bar and 3 athlete testimonials — dark/amber theme",
    targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2),
    priority: "5",
  },
  {
    id: "lrb-social-proof-wellness",
    name: "Social Proof — Health & Wellness",
    description: "Featured testimonial + doctor endorsement — for health-focused visitors",
    targeting: JSON.stringify({ life_stage: ["senior", "post_injury"], pain: ["knee", "joint"] }, null, 2),
    priority: "5",
  },
  // ── Support ────────────────────────────────────────────────────────────────
  {
    id: "lrb-support-tech",
    name: "Support — Tech / Digital Features",
    description: "App integrations, video streaming, social challenges, tracking — for younger visitors",
    targeting: JSON.stringify({ motivation: ["performance", "fitness"] }, null, 2),
    priority: "2",
  },
  {
    id: "lrb-support-traditional",
    name: "Support — Traditional / Phone-First",
    description: "Phone CTA, DVD program, free consultation — for senior/traditional visitors",
    targeting: JSON.stringify({ life_stage: ["senior"] }, null, 2),
    priority: "2",
  },
  // ── Behavioral CTAs ────────────────────────────────────────────────────────
  {
    id: "lrb-cta-first-visit",
    name: "CTA — First-Time Visitor",
    description: "Rebounding explainer + email capture for education series",
    targeting: JSON.stringify({ tags: ["first_visit"] }, null, 2),
    priority: "8",
  },
  {
    id: "lrb-cta-return-visitor",
    name: "CTA — Return Visitor (Research Phase)",
    description: "LRB vs spring vs basic comparison table + consultation CTA",
    targeting: JSON.stringify({ tags: ["returning"] }, null, 2),
    priority: "8",
  },
  {
    id: "lrb-cta-cart-abandon",
    name: "CTA — Cart Abandonment",
    description: "4 objection-busters + call/chat/checkout buttons for high-intent visitors",
    targeting: JSON.stringify({ tags: ["cart_abandoner"] }, null, 2),
    priority: "10",
  },
  {
    id: "lrb-cta-post-purchase",
    name: "CTA — Post-Purchase Onboarding",
    description: "Setup guide, 4-week program, community join + app download",
    targeting: JSON.stringify({ identified: true, tags: ["purchased"] }, null, 2),
    priority: "9",
  },
];



function SectionLibraryTab({ sections, loading, onRefresh }: {
  sections: PSection[]; loading: boolean; onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [orderedSections, setOrderedSections] = useState<PSection[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Sync orderedSections when sections prop changes
  useEffect(() => {
    setOrderedSections([...sections].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));
  }, [sections]);

  const saveOrder = async (reordered: PSection[]) => {
    setSavingOrder(true);
    try {
      // Top item = highest priority; assign descending multiples of 10
      const total = reordered.length;
      await Promise.all(reordered.map((s, i) => {
        const priority = (total - i) * 10;
        return fetch(`${BOT_URL}/admin/intelligence/sections/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority }),
        });
      }));
      onRefresh();
    } finally {
      setSavingOrder(false);
    }
  };

  const empty: SectionFormData = { name: "", description: "", shopify_section_id: "", targeting_rules_raw: "{}", priority: "0" };
  const [form, setForm] = useState<SectionFormData>(empty);

  const openCreate = () => { setEditTarget(null); setForm(empty); setFormError(""); setShowForm(true); };
  const openEdit = (s: PSection) => {
    setEditTarget(s);
    setForm({ name: s.name, description: s.description ?? "", shopify_section_id: s.shopify_section_id, targeting_rules_raw: JSON.stringify(s.targeting_rules, null, 2), priority: String(s.priority) });
    setFormError(""); setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setFormError("");
    try {
      let targeting_rules: Record<string, unknown> = {};
      try { targeting_rules = JSON.parse(form.targeting_rules_raw); } catch { throw new Error("Invalid JSON in targeting rules"); }
      const payload = { name: form.name.trim(), description: form.description.trim() || null, shopify_section_id: form.shopify_section_id.trim(), targeting_rules, priority: parseInt(form.priority, 10) || 0 };
      if (!payload.name || !payload.shopify_section_id) throw new Error("Name and Shopify Section ID are required");

      const url = editTarget ? `${BOT_URL}/admin/intelligence/sections/${editTarget.id}` : `${BOT_URL}/admin/intelligence/sections`;
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setShowForm(false); onRefresh();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch(`${BOT_URL}/admin/intelligence/sections/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p style={{ fontSize: 12, color: "#64748b" }}>
          {sections.length} section{sections.length !== 1 ? "s" : ""} registered
        </p>
        <button onClick={openCreate} className="button is-small"
          style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", gap: "0.4rem", display: "flex", alignItems: "center" }}>
          <Plus size={13} /> Register Section
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ ...CARD, marginBottom: "1rem", border: "1px solid rgba(56,189,248,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {editTarget ? "Edit Section" : "Register New Section"}
            </p>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>
                Pick a Snippet
              </label>
              <select
                className="input is-small"
                value={form.shopify_section_id}
                onChange={e => {
                  const picked = KNOWN_SNIPPETS.find(s => s.id === e.target.value);
                  if (picked) {
                    setForm(f => ({
                      ...f,
                      shopify_section_id: picked.id,
                      name: f.name || picked.name,
                      description: f.description || picked.description,
                      targeting_rules_raw: picked.targeting,
                      priority: picked.priority,
                    }));
                  } else {
                    setForm(f => ({ ...f, shopify_section_id: e.target.value }));
                  }
                }}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(56,189,248,0.25)", color: "#e2e8f0" }}
              >
                <option value="">— select a snippet —</option>
                {KNOWN_SNIPPETS.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
                <option value="__custom__">Other (custom ID)</option>
              </select>
              {form.shopify_section_id === "__custom__" && (
                <input className="input is-small" placeholder="my-custom-snippet-id"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", marginTop: "0.5rem" }}
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
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>
                Targeting Rules (JSON)
              </label>

              {/* Reference panel */}
              <div style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem", fontSize: 11 }}>
                <p style={{ color: "#94a3b8", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Available Keys</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { key: "pain", type: "string[]", desc: "Pain points to match", eg: '"pain": ["knee", "back"]' },
                      { key: "motivation", type: "string[]", desc: "Visitor motivation type", eg: '"motivation": ["pain_relief", "weight_loss"]' },
                      { key: "life_stage", type: "string[]", desc: "Life stage / persona", eg: '"life_stage": ["senior", "post_injury"]' },
                      { key: "decision_style", type: "string[]", desc: "How they make decisions", eg: '"decision_style": ["social_proof", "deal_seeker"]' },
                      { key: "tags", type: "string[]", desc: "Custom segment tags", eg: '"tags": ["returning", "cart_abandoner"]' },
                      { key: "identified", type: "bool", desc: "Known customer (has email/Shopify ID)", eg: '"identified": true' },
                      { key: "min_confidence", type: "0–1", desc: "Minimum profile confidence score", eg: '"min_confidence": 0.6' },
                      { key: "ad_signals.utm_campaign", type: "string", desc: "Match a specific UTM campaign", eg: '"ad_signals": {"utm_campaign": "knee_pain"}' },
                      { key: "ad_signals.utm_source", type: "string", desc: "Match a UTM source", eg: '"ad_signals": {"utm_source": "facebook"}' },
                    ].map(row => (
                      <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.3rem 0.5rem 0.3rem 0", color: "#38bdf8", fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.key}</td>
                        <td style={{ padding: "0.3rem 0.5rem", color: "#64748b", whiteSpace: "nowrap" }}>{row.type}</td>
                        <td style={{ padding: "0.3rem 0", color: "#94a3b8" }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color: "#64748b", fontWeight: 700, margin: "0.6rem 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Examples</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {[
                    { label: "Knee pain", json: '{\n  "pain": ["knee", "joint"]\n}' },
                    { label: "Athletic UTM", json: '{\n  "ad_signals": { "utm_campaign": "athletic_performance" }\n}' },
                    { label: "Senior UTM", json: '{\n  "ad_signals": { "utm_campaign": "senior_fitness" }\n}' },
                    { label: "Identified customer", json: '{\n  "identified": true,\n  "min_confidence": 0.5\n}' },
                    { label: "Everyone (fallback)", json: '{}' },
                  ].map(ex => (
                    <button key={ex.label}
                      onClick={() => setForm(f => ({ ...f, targeting_rules_raw: ex.json }))}
                      style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#38bdf8", borderRadius: 4, padding: "0.2rem 0.5rem", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea className="textarea is-small" rows={4}
                value={form.targeting_rules_raw}
                onChange={e => setForm(f => ({ ...f, targeting_rules_raw: e.target.value }))}
                placeholder={'{}'}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontFamily: "monospace", fontSize: 12 }} />
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
          <p style={{ color: "#475569" }}>No sections registered yet. Click "Register Section" to add your first.</p>
        </div>
      ) : (
        <>
          {savingOrder && (
            <p style={{ fontSize: 11, color: "#38bdf8", marginBottom: "0.5rem" }}>Saving order...</p>
          )}
          <p style={{ fontSize: 11, color: "#475569", marginBottom: "0.75rem" }}>
            <GripVertical size={11} style={{ display: "inline", marginRight: 4 }} />
            Drag to reorder — top = highest priority
          </p>
          <Reorder.Group
            axis="y"
            values={orderedSections}
            onReorder={(reordered) => {
              setOrderedSections(reordered);
              saveOrder(reordered);
            }}
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {orderedSections.map((s, i) => (
              <ReorderableSection key={s.id} section={s} rank={i + 1} onToggle={toggle} onEdit={openEdit} />
            ))}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}

// ── Theme Deploy Tab ──────────────────────────────────────────────────────

interface ShopifyTheme {
  id: number; name: string; role: "main" | "unpublished" | "demo";
  created_at: string; updated_at: string;
}

interface DeployResult {
  theme_id: number; deployed: string[]; failed: { key: string; error: string }[];
  ok: boolean;
}

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
      // Auto-select the sandbox theme if found, otherwise the first non-live theme
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      {/* Deploy card */}
      <div style={{ ...CARD, marginBottom: "1.5rem", border: "1px solid rgba(167,139,250,0.2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Rocket size={16} color="#a78bfa" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, color: "#e2e8f0", marginBottom: "0.25rem" }}>Deploy Assets to Theme</p>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              Pushes <code style={{ color: "#a78bfa" }}>lrb-personalization.js</code> and all Liquid section templates to the selected theme.
              To publish to live, do that from <strong style={{ color: "#e2e8f0" }}>Shopify Admin → Themes</strong>.
            </p>
          </div>
        </div>

        {/* Theme selector */}
        {themes.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
              Target Theme
            </label>
            <select
              value={selectedThemeId ?? ""}
              onChange={e => setSelectedThemeId(Number(e.target.value))}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0", borderRadius: 8, padding: "0.5rem 0.75rem",
                fontSize: 13, width: "100%", cursor: "pointer",
              }}
            >
              {themes.map(t => (
                <option key={t.id} value={t.id} style={{ background: "#0f172a" }}>
                  {t.name} {t.role === "main" ? "🟢 LIVE" : ""}
                </option>
              ))}
            </select>
            {selectedTheme && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.3rem" }}>
                ID: {selectedTheme.id} · {selectedTheme.role === "main"
                  ? <span style={{ color: "#f43f5e" }}>⚠ This is your live theme — deploying will affect customers</span>
                  : <span style={{ color: "#34d399" }}>Safe sandbox theme</span>
                }
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

      {/* Error */}
      {error && (
        <div style={{ ...CARD, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.05)", marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
        </div>
      )}

      {/* Deploy result */}
      {deployResult && (
        <div style={{ ...CARD, border: `1px solid ${deployResult.ok ? "rgba(52,211,153,0.3)" : "rgba(244,63,94,0.3)"}`, marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, color: deployResult.ok ? "#34d399" : "#f43f5e", marginBottom: "0.5rem" }}>
            {deployResult.ok ? "✓ Deploy successful" : "⚠ Partial deploy"} — {deployResult.deployed.length} file{deployResult.deployed.length !== 1 ? "s" : ""}
          </p>
          {deployResult.deployed.map(k => (
            <div key={k} style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace", marginBottom: 2 }}>+ {k}</div>
          ))}
          {deployResult.failed.map(f => (
            <div key={f.key} style={{ fontSize: 11, color: "#f43f5e", fontFamily: "monospace", marginBottom: 2 }}>✗ {f.key}: {f.error}</div>
          ))}
        </div>
      )}

      {/* Theme list */}
      {themes.length > 0 && (
        <div style={CARD}>
          <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>
            Installed Themes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {themes.map(t => (
              <div key={t.id} onClick={() => setSelectedThemeId(t.id)} style={{
                display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
                padding: "0.75rem", background: selectedThemeId === t.id ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
                borderRadius: 8, cursor: "pointer",
                border: selectedThemeId === t.id ? "1px solid rgba(167,139,250,0.3)" : t.role === "main" ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.04)",
                transition: "all 0.15s",
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2 }}>{t.name}</p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: t.role === "main" ? "#34d399" : "#64748b",
                      background: t.role === "main" ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)",
                      padding: "1px 7px", borderRadius: 10, textTransform: "uppercase",
                    }}>
                      {t.role === "main" ? "Live" : "Unpublished"}
                    </span>
                    <span style={{ fontSize: 10, color: "#334155" }}>ID: {t.id}</span>
                  </div>
                </div>
                {selectedThemeId === t.id && (
                  <Check size={14} color="#a78bfa" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {themes.length === 0 && !loadingThemes && (
        <div style={{ ...CARD, textAlign: "center", padding: "2.5rem" }}>
          <Rocket size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>Click "List Themes" to see your Shopify themes.</p>
          <p style={{ color: "#334155", fontSize: 11, marginTop: "0.4rem" }}>Requires <code>read_themes</code> scope on the Gravity Claw app.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

type Tab = "overview" | "sections" | "deploy";

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "overview",  label: "Overview",        icon: BarChart3,     color: "#38bdf8" },
  { id: "sections",  label: "Section Library", icon: Layers,        color: "#a78bfa" },
  { id: "deploy",    label: "Deploy",           icon: Rocket,        color: "#34d399" },
];

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  page: Eye, email: Mail, ad: Target, purchase: ShoppingBag, quiz: Brain,
};

export default function AudiencePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sections, setSections] = useState<PSection[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);

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

  useEffect(() => {
    fetchAnalytics();
    fetchSections();
  }, [fetchAnalytics, fetchSections]);

  const refresh = () => { fetchAnalytics(); fetchSections(); };

  return (
    <div className="px-5 py-5" style={{ maxWidth: 980, margin: "0 auto" }}>
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
            Customer intelligence layer — psychological profiles powering page, email, and ad personalization.
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
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...PILL(tab === t.id, t.color), display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {tab === "overview"  && <OverviewTab analytics={analytics} loading={loadingAnalytics} />}
          {tab === "sections"  && <SectionLibraryTab sections={sections} loading={loadingSections} onRefresh={fetchSections} />}
          {tab === "deploy"    && <ThemeDeployTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
