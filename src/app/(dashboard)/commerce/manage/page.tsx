"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp,
  Loader, AlertCircle, ExternalLink, GripVertical, ToggleLeft, ToggleRight,
  LayoutGrid, TrendingUp, Megaphone, Users, Share2, SearchCheck, FlaskConical,
  Tag, Zap, LifeBuoy, Truck, MessageCircle, Mail, LineChart, Eye,
  ShoppingBag, BarChart3, Globe, Star, Rocket, Target, PieChart,
  Activity, Monitor, Smartphone, MousePointer, Package, Wallet, HeartHandshake,
  Percent, Layers, Lightbulb, BellRing, ArrowRight, FileText, Brain, Link,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Icon registry ──────────────────────────────────────────────────────────────

interface IconEntry { name: string; el: React.ElementType }

const ICON_LIST: IconEntry[] = [
  { name: "LayoutGrid",    el: LayoutGrid },
  { name: "TrendingUp",    el: TrendingUp },
  { name: "Megaphone",     el: Megaphone },
  { name: "Users",         el: Users },
  { name: "Share2",        el: Share2 },
  { name: "SearchCheck",   el: SearchCheck },
  { name: "FlaskConical",  el: FlaskConical },
  { name: "Tag",           el: Tag },
  { name: "Zap",           el: Zap },
  { name: "LifeBuoy",      el: LifeBuoy },
  { name: "Truck",         el: Truck },
  { name: "MessageCircle", el: MessageCircle },
  { name: "Mail",          el: Mail },
  { name: "LineChart",     el: LineChart },
  { name: "Eye",           el: Eye },
  { name: "ShoppingBag",   el: ShoppingBag },
  { name: "BarChart3",     el: BarChart3 },
  { name: "Globe",         el: Globe },
  { name: "Star",          el: Star },
  { name: "Rocket",        el: Rocket },
  { name: "Target",        el: Target },
  { name: "PieChart",      el: PieChart },
  { name: "Activity",      el: Activity },
  { name: "Monitor",       el: Monitor },
  { name: "Smartphone",    el: Smartphone },
  { name: "MousePointer",  el: MousePointer },
  { name: "Package",       el: Package },
  { name: "Wallet",        el: Wallet },
  { name: "HeartHandshake",el: HeartHandshake },
  { name: "Percent",       el: Percent },
  { name: "Layers",        el: Layers },
  { name: "Lightbulb",     el: Lightbulb },
  { name: "BellRing",      el: BellRing },
  { name: "FileText",      el: FileText },
  { name: "Brain",         el: Brain },
  { name: "Link",          el: Link },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_LIST.map(e => [e.name, e.el])
);

function getIconEl(name: string | null | undefined): React.ElementType {
  return ICON_MAP[name ?? ""] ?? LayoutGrid;
}

// Auto-assign icon based on label keywords
function autoIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("media") || l.includes("ad") || l.includes("paid")) return "Megaphone";
  if (l.includes("creator") || l.includes("influenc")) return "Users";
  if (l.includes("social")) return "Share2";
  if (l.includes("seo") || l.includes("search")) return "SearchCheck";
  if (l.includes("test") || l.includes("experiment") || l.includes("cro")) return "FlaskConical";
  if (l.includes("pric") || l.includes("compet")) return "Tag";
  if (l.includes("catalog") || l.includes("product")) return "LayoutGrid";
  if (l.includes("revenue") || l.includes("upsell")) return "Zap";
  if (l.includes("support") || l.includes("resolut")) return "LifeBuoy";
  if (l.includes("ship") || l.includes("logist") || l.includes("fulfil")) return "Truck";
  if (l.includes("community") || l.includes("review")) return "MessageCircle";
  if (l.includes("email") || l.includes("crm") || l.includes("flow")) return "Mail";
  if (l.includes("profit") || l.includes("margin") || l.includes("financ")) return "LineChart";
  if (l.includes("brand") || l.includes("sentiment")) return "Eye";
  if (l.includes("amazon")) return "ShoppingBag";
  if (l.includes("website") || l.includes("perf") || l.includes("core web")) return "Activity";
  if (l.includes("content")) return "FileText";
  if (l.includes("retention") || l.includes("loyal")) return "HeartHandshake";
  if (l.includes("discount") || l.includes("percent")) return "Percent";
  if (l.includes("strateg") || l.includes("intel")) return "Brain";
  return "LayoutGrid";
}

// Auto-assign color based on squad
function autoColor(squadColor: string | null | undefined): string {
  return squadColor ?? "#6366f1";
}

// Slugify
function slugify(text: string): string {
  return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Squad {
  id: string;
  name: string | null;
  label: string | null;
  description: string | null;
  color: string | null;
  icon_name: string | null;
  sort_order: number;
  active: boolean;
  area_count: number;
}

interface Area {
  id: string;
  squad_id: string;
  slug: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  subtitle: string | null;
  section_hint: string | null;
  sort_order: number;
  active: boolean;
}

// ── Color picker swatches ──────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  "#e98d20", "#f59e0b", "#f43f5e", "#ec4899", "#a78bfa",
  "#6366f1", "#4a9eff", "#38bdf8", "#22c55e", "#10b981",
  "#64748b", "#94a3b8",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {COLOR_SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: 6, background: c, border: "none",
            cursor: "pointer", flexShrink: 0,
            outline: value === c ? `2px solid ${c}` : "none",
            outlineOffset: 2,
            opacity: value === c ? 1 : 0.7,
            transform: value === c ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.1s, opacity 0.1s",
          }}
          title={c}
          aria-label={`Select color ${c}`}
        />
      ))}
      <input
        type="color"
        value={value || "#6366f1"}
        onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
        title="Custom color"
      />
    </div>
  );
}

// ── Icon picker ────────────────────────────────────────────────────────────────

function IconPicker({ value, onChange, accent }: { value: string; onChange: (n: string) => void; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {ICON_LIST.map(({ name, el: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          title={name}
          aria-label={`Select icon ${name}`}
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: value === name ? `1.5px solid ${accent}` : "1px solid rgba(255,255,255,0.07)",
            background: value === name ? `${accent}18` : "rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            color: value === name ? accent : "#64748b",
            transition: "all 0.1s",
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

// ── Area form modal ────────────────────────────────────────────────────────────

function AreaModal({
  area,
  squad,
  allSquads,
  onClose,
  onSave,
}: {
  area: Area | null;
  squad: Squad;
  allSquads: Squad[];
  onClose: () => void;
  onSave: (data: Partial<Area>) => Promise<void>;
}) {
  const isEdit = !!area;
  const squadColor = squad.color ?? "#6366f1";

  const [form, setForm] = useState({
    label:        area?.label        ?? "",
    slug:         area?.slug         ?? "",
    squad_id:     area?.squad_id     ?? squad.id,
    description:  area?.description  ?? "",
    icon_name:    area?.icon_name    ?? autoIcon(area?.label ?? ""),
    accent_color: area?.accent_color ?? squadColor,
    subtitle:     area?.subtitle     ?? "",
    section_hint: area?.section_hint ?? "",
    sort_order:   area?.sort_order   ?? 0,
    active:       area?.active       ?? true,
  });
  const [slugManual, setSlugManual] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  // Auto-slug from label unless manually edited
  useEffect(() => {
    if (!slugManual) {
      setForm(f => ({
        ...f,
        slug: slugify(f.label),
        icon_name: autoIcon(f.label),
      }));
    }
  }, [form.label, slugManual]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        sort_order: Number(form.sort_order),
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#e2e8f0", fontSize: "0.875rem", outline: "none",
  };
  const label = (text: string) => (
    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", display: "block", marginBottom: 4 }}>
      {text}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        style={{
          width: "100%", maxWidth: 620,
          background: "rgba(10,14,24,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18, padding: "1.5rem",
          boxShadow: "0 32px 100px rgba(0,0,0,0.7)",
          maxHeight: "92vh", overflowY: "auto",
        }}
      >
        {/* Modal header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${squadColor}18`, border: `1px solid ${squadColor}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {React.createElement(getIconEl(form.icon_name), { size: 15, color: form.accent_color || squadColor })}
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#e2e8f0", margin: 0 }}>
              {isEdit ? `Edit "${area.label}"` : `New Area in ${squad.label ?? squad.id}`}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569" }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>

            {/* Label */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Label *")}
              <input id="area-label" style={inputStyle} value={form.label} onChange={set("label")} placeholder="Website Performance" required />
            </div>

            {/* Slug */}
            <div>
              {label("URL Slug *")}
              <input
                id="area-slug"
                style={inputStyle}
                value={form.slug}
                onChange={e => { setSlugManual(true); set("slug")(e); }}
                placeholder="website-performance"
                required
              />
              <p style={{ fontSize: "9px", color: "#334155", marginTop: 3 }}>
                URL: /commerce/{form.squad_id || squad.id}/{form.slug || "…"}
              </p>
            </div>

            {/* Squad */}
            <div>
              {label("Squad")}
              <select id="area-squad" style={inputStyle} value={form.squad_id} onChange={set("squad_id")}>
                {allSquads.map(sq => (
                  <option key={sq.id} value={sq.id}>{sq.label ?? sq.id}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Short Description")}
              <input id="area-desc" style={inputStyle} value={form.description} onChange={set("description")} placeholder="Core Web Vitals monitoring & page speed optimization" />
            </div>

            {/* Subtitle */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Subtitle (shown on page header)")}
              <input id="area-subtitle" style={inputStyle} value={form.subtitle} onChange={set("subtitle")} placeholder="Conversion · Web Performance · CWV Optimization" />
            </div>

            {/* Icon */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Icon")}
              <IconPicker value={form.icon_name} onChange={n => setForm(f => ({ ...f, icon_name: n }))} accent={form.accent_color || squadColor} />
            </div>

            {/* Color */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Accent Color")}
              <ColorPicker value={form.accent_color || squadColor} onChange={c => setForm(f => ({ ...f, accent_color: c }))} />
            </div>

            {/* Section hint */}
            <div style={{ gridColumn: "1/-1" }}>
              {label("Agent Context Hint (injected into AI chat)")}
              <textarea
                id="area-hint"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical", lineHeight: 1.6 }}
                value={form.section_hint}
                onChange={set("section_hint")}
                placeholder="Extra context for the AI agent. E.g. 'This section tracks LCP, CLS, INP, and page load time across the Shopify storefront. Key tools: Google PageSpeed Insights, Search Console.'"
              />
              <p style={{ fontSize: "9px", color: "#334155", marginTop: 3 }}>
                This text is injected at the top of every chat conversation on this section&apos;s page — great for giving the agent domain expertise.
              </p>
            </div>

            {/* Sort order + active */}
            <div>
              {label("Sort Order")}
              <input id="area-sort" type="number" style={inputStyle} value={form.sort_order} onChange={set("sort_order")} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: form.active ? "#22c55e" : "#475569" }}
                aria-label="Toggle active"
              >
                {form.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>{form.active ? "Active" : "Inactive"}</span>
              </button>
            </div>

          </div>

          {error && (
            <div style={{ marginTop: "0.75rem", padding: "8px 12px", borderRadius: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", gap: 8, alignItems: "center", color: "#f43f5e", fontSize: "0.85rem" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button type="button" onClick={onClose} className="button is-ghost" style={{ color: "#475569", fontSize: "0.875rem" }}>Cancel</button>
            <motion.button
              type="submit"
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}}
              whileTap={!saving ? { scale: 0.98 } : {}}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px",
                borderRadius: 8, fontWeight: 700, fontSize: "0.875rem",
                background: `linear-gradient(135deg, ${form.accent_color || squadColor}, ${form.accent_color || squadColor}aa)`,
                color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Area"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Squad form modal ───────────────────────────────────────────────────────────

function SquadModal({
  squad,
  onClose,
  onSave,
}: {
  squad: Squad | null;
  onClose: () => void;
  onSave: (data: Partial<Squad> & { label: string }) => Promise<void>;
}) {
  const isEdit = !!squad;
  const [form, setForm] = useState({
    label:       squad?.label       ?? "",
    description: squad?.description ?? "",
    color:       squad?.color       ?? "#6366f1",
    icon_name:   squad?.icon_name   ?? "LayoutGrid",
    sort_order:  squad?.sort_order  ?? 99,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, sort_order: Number(form.sort_order) } as any);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0", fontSize: "0.875rem", outline: "none" };
  const lbl = (text: string) => <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", display: "block", marginBottom: 4 }}>{text}</span>;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
        style={{ width: "100%", maxWidth: 540, background: "rgba(10,14,24,0.99)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "1.5rem", boxShadow: "0 32px 100px rgba(0,0,0,0.7)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#e2e8f0", margin: 0 }}>
            {isEdit ? `Edit Squad: ${squad.label ?? squad.id}` : "New Squad"}
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569" }} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              {lbl("Label *")}
              <input id="squad-label" style={inputStyle} value={form.label} onChange={set("label")} placeholder="Website Performance" required />
              {!isEdit && <p style={{ fontSize: "9px", color: "#334155", marginTop: 3 }}>ID will be: {slugify(form.label) || "…"}</p>}
            </div>
            <div>
              {lbl("Description")}
              <textarea id="squad-desc" style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={form.description} onChange={set("description")} placeholder="Tracks storefront performance metrics…" />
            </div>
            <div>
              {lbl("Icon")}
              <IconPicker value={form.icon_name} onChange={n => setForm(f => ({ ...f, icon_name: n }))} accent={form.color} />
            </div>
            <div>
              {lbl("Color")}
              <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
            </div>
            <div>
              {lbl("Sort Order")}
              <input id="squad-sort" type="number" style={inputStyle} value={form.sort_order} onChange={set("sort_order")} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: "0.75rem", padding: "8px 12px", borderRadius: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", gap: 8, alignItems: "center", color: "#f43f5e", fontSize: "0.85rem" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button type="button" onClick={onClose} className="button is-ghost" style={{ color: "#475569", fontSize: "0.875rem" }}>Cancel</button>
            <motion.button
              type="submit" disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}} whileTap={!saving ? { scale: 0.98 } : {}}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: "0.875rem", background: `linear-gradient(135deg, ${form.color}, ${form.color}90)`, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Squad"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Area row ───────────────────────────────────────────────────────────────────

function AreaRow({ area, squadColor, allSquads, onEdit, onDelete, onToggle }: {
  area: Area;
  squadColor: string;
  allSquads: Squad[];
  onEdit: (a: Area) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = getIconEl(area.icon_name);
  const accent = area.accent_color ?? squadColor;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.6rem 0.85rem",
        background: area.active ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10, opacity: area.active ? 1 : 0.55,
      }}
    >
      <GripVertical size={12} color="#2d3748" style={{ flexShrink: 0, cursor: "grab" }} />

      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}18`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={13} color={accent} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#e2e8f0" }}>{area.label}</span>
          <code style={{ fontSize: "9px", color: "#334155", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 4 }}>
            /{area.squad_id}/{area.slug}
          </code>
        </div>
        {area.description && <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 1 }}>{area.description}</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
        {/* Open page link */}
        <a
          href={`/commerce/${area.squad_id}/${area.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", textDecoration: "none" }}
          aria-label={`Open ${area.label}`}
        >
          <ExternalLink size={11} />
        </a>

        {/* Toggle active */}
        <button
          onClick={() => onToggle(area.id, !area.active)}
          aria-label={area.active ? "Deactivate" : "Activate"}
          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: area.active ? "#22c55e" : "#475569" }}
        >
          {area.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        </button>

        {/* Edit */}
        <motion.button
          onClick={() => onEdit(area)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          aria-label={`Edit ${area.label}`}
          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
        >
          <Pencil size={11} />
        </motion.button>

        {/* Delete */}
        <motion.button
          onClick={() => setConfirmDelete(!confirmDelete)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          aria-label={`Delete ${area.label}`}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${confirmDelete ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.07)"}`, background: confirmDelete ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: confirmDelete ? "#f43f5e" : "#475569" }}
        >
          {confirmDelete ? <Check size={11} /> : <Trash2 size={11} />}
        </motion.button>

        {/* Confirm delete */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.button
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
              onClick={() => onDelete(area.id)}
              style={{ overflow: "hidden", whiteSpace: "nowrap", padding: "0 8px", height: 28, borderRadius: 6, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.1)", color: "#f43f5e", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
            >
              Confirm
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Squad card ─────────────────────────────────────────────────────────────────

function SquadCard({
  squad,
  areas,
  allSquads,
  onEditSquad,
  onDeleteSquad,
  onAddArea,
  onEditArea,
  onDeleteArea,
  onToggleArea,
}: {
  squad: Squad;
  areas: Area[];
  allSquads: Squad[];
  onEditSquad: (s: Squad) => void;
  onDeleteSquad: (id: string) => void;
  onAddArea: (squad: Squad) => void;
  onEditArea: (a: Area) => void;
  onDeleteArea: (id: string) => void;
  onToggleArea: (id: string, active: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = getIconEl(squad.icon_name);
  const color = squad.color ?? "#6366f1";
  const squadLabel = squad.label ?? squad.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}
    >
      {/* Squad header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem",
        background: `${color}06`, borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
        cursor: "pointer",
      }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e2e8f0" }}>{squadLabel}</span>
            <span style={{ fontSize: "9px", background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 6, padding: "1px 7px", fontWeight: 700 }}>
              {areas.length} area{areas.length !== 1 ? "s" : ""}
            </span>
            {!squad.active && <span style={{ fontSize: "9px", color: "#475569", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "1px 6px" }}>inactive</span>}
          </div>
          {squad.description && <p style={{ fontSize: "10px", color: "#475569", margin: 0, marginTop: 1 }}>{squad.description}</p>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }} onClick={e => e.stopPropagation()}>
          <motion.button
            onClick={() => onAddArea(squad)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            aria-label={`Add area to ${squadLabel}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: `1px solid ${color}30`, background: `${color}10`, color, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
          >
            <Plus size={11} /> Add Area
          </motion.button>
          <button onClick={() => onEditSquad(squad)} aria-label={`Edit ${squadLabel}`} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
            <Pencil size={11} />
          </button>
          <button
            onClick={() => setConfirmDelete(!confirmDelete)}
            aria-label={`Delete ${squadLabel}`}
            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${confirmDelete ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.07)"}`, background: confirmDelete ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: confirmDelete ? "#f43f5e" : "#475569" }}
          >
            <Trash2 size={11} />
          </button>
        </div>

        <div style={{ color: "#334155" }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setExpanded(e => !e)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#334155", padding: 4 }} aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Confirm delete squad */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div style={{ padding: "0.6rem 1rem", background: "rgba(244,63,94,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", color: "#fca5a5" }}>
                {areas.length > 0 ? `${squadLabel} has ${areas.length} active area(s). Deactivate them first.` : `Remove ${squadLabel}?`}
              </span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={() => setConfirmDelete(false)} className="button is-small is-ghost" style={{ fontSize: "11px", color: "#64748b" }}>Cancel</button>
                {areas.length === 0 && (
                  <button onClick={() => { setConfirmDelete(false); onDeleteSquad(squad.id); }} style={{ padding: "3px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 700, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", color: "#f43f5e", cursor: "pointer" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Area list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {areas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1rem 0", color: "#334155", fontSize: "0.82rem" }}>
                  No areas yet —{" "}
                  <button onClick={() => onAddArea(squad)} style={{ background: "transparent", border: "none", color: color, cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
                    add the first one
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {areas.map(area => (
                    <AreaRow
                      key={area.id}
                      area={area}
                      squadColor={color}
                      allSquads={allSquads}
                      onEdit={onEditArea}
                      onDelete={onDeleteArea}
                      onToggle={onToggleArea}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CommerceSectionsManagePage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [squadModal, setSquadModal] = useState<{ open: boolean; squad: Squad | null }>({ open: false, squad: null });
  const [areaModal, setAreaModal] = useState<{ open: boolean; area: Area | null; squad: Squad | null }>({ open: false, area: null, squad: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sqRes, arRes] = await Promise.all([
        fetch(`${BOT_URL}/admin/sections`),
        fetch(`${BOT_URL}/admin/sections/areas`),
      ]);
      if (sqRes.ok) setSquads(await sqRes.json());
      if (arRes.ok) setAreas(await arRes.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Squad CRUD ──────────────────────────────────────────────────────────────

  const saveSquad = async (data: Partial<Squad> & { label: string }) => {
    if (squadModal.squad) {
      const res = await fetch(`${BOT_URL}/admin/sections/${squadModal.squad.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
    } else {
      const res = await fetch(`${BOT_URL}/admin/sections`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
    }
    await fetchData();
  };

  const deleteSquad = async (id: string) => {
    await fetch(`${BOT_URL}/admin/sections/${id}`, { method: "DELETE" });
    await fetchData();
  };

  // ── Area CRUD ───────────────────────────────────────────────────────────────

  const saveArea = async (data: Partial<Area>) => {
    if (areaModal.area) {
      const res = await fetch(`${BOT_URL}/admin/sections/areas/${areaModal.area.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
    } else {
      const res = await fetch(`${BOT_URL}/admin/sections/areas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
    }
    await fetchData();
  };

  const deleteArea = async (id: string) => {
    await fetch(`${BOT_URL}/admin/sections/areas/${id}`, { method: "DELETE" });
    setAreas(prev => prev.filter(a => a.id !== id));
  };

  const toggleArea = async (id: string, active: boolean) => {
    await fetch(`${BOT_URL}/admin/sections/areas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setAreas(prev => prev.map(a => a.id === id ? { ...a, active } : a));
  };

  // Group areas by squad
  const areasBySquad = (squadId: string) =>
    areas.filter(a => a.squad_id === squadId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <div className="px-5 py-5" style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, rgba(233,141,32,0.2), rgba(233,141,32,0.08))", border: "1px solid rgba(233,141,32,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Settings size={20} color="#e98d20" />
              </div>
              <h1 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#e2e8f0", margin: 0 }}>Manage Sections</h1>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Add, edit, or remove squads and their pages.{" "}
              <a href="/commerce" style={{ color: "#e98d20", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                ← Back to Commerce Hub <ArrowRight size={11} />
              </a>
            </p>
          </div>

          <motion.button
            onClick={() => setSquadModal({ open: true, squad: null })}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, fontWeight: 700, fontSize: "0.875rem", background: "linear-gradient(135deg, rgba(233,141,32,0.2), rgba(233,141,32,0.1))", border: "1px solid rgba(233,141,32,0.3)", color: "#e98d20", cursor: "pointer" }}
          >
            <Plus size={14} /> New Squad
          </motion.button>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", padding: "3rem 0" }}>
            <Loader size={18} className="spin" /><span>Loading sections…</span>
          </div>
        ) : squads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
            <Settings size={40} color="#334155" style={{ marginBottom: "1rem" }} />
            <p style={{ fontSize: "1rem", color: "#64748b", fontWeight: 600 }}>No squads yet</p>
            <p style={{ fontSize: "0.875rem", color: "#334155", marginTop: 4 }}>
              Create your first squad to start organizing commerce sections.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {squads
              .filter(sq => sq.active !== false)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(squad => (
                <SquadCard
                  key={squad.id}
                  squad={squad}
                  areas={areasBySquad(squad.id)}
                  allSquads={squads}
                  onEditSquad={sq => setSquadModal({ open: true, squad: sq })}
                  onDeleteSquad={deleteSquad}
                  onAddArea={sq => setAreaModal({ open: true, area: null, squad: sq })}
                  onEditArea={a => {
                    const sq = squads.find(s => s.id === a.squad_id) ?? squads[0];
                    setAreaModal({ open: true, area: a, squad: sq });
                  }}
                  onDeleteArea={deleteArea}
                  onToggleArea={toggleArea}
                />
              ))}
          </div>
        )}
      </div>

      {/* Squad modal */}
      <AnimatePresence>
        {squadModal.open && (
          <SquadModal
            squad={squadModal.squad}
            onClose={() => setSquadModal({ open: false, squad: null })}
            onSave={saveSquad}
          />
        )}
      </AnimatePresence>

      {/* Area modal */}
      <AnimatePresence>
        {areaModal.open && areaModal.squad && (
          <AreaModal
            area={areaModal.area}
            squad={areaModal.squad}
            allSquads={squads}
            onClose={() => setAreaModal({ open: false, area: null, squad: null })}
            onSave={saveArea}
          />
        )}
      </AnimatePresence>
    </>
  );
}
