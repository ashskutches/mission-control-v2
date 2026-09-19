"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  ShoppingBag, ImageIcon, Pin, Plus, Trash2, GripVertical,
  Search, ChevronRight, Link2, CheckCircle2, AlertCircle, X, RefreshCw,
  Loader2, Upload, Wand2, Star, EyeOff, Eye,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const MAX_REFS = 14;

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShopifyImage {
  id: string;
  src: string;
  variant_ids: string[];
  position: number;
}

interface ShopifyVariant {
  id: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  image_count: number;
  ref_count: number;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
}

interface PinnedRef {
  id: string;
  product_id: string;
  product_title: string;
  image_url: string;
  image_source: "shopify" | "url";
  display_order: number;
  // Labels. Written by the vision pass on the bot, corrected here.
  view: string | null;
  color: string | null;
  size_label: string | null;
  is_primary: boolean;
  usable_for_identity: boolean;
  label_source: "unlabeled" | "auto" | "human";
  label_confidence: number | null;
  label_notes: string | null;
}

interface SelectedRef {
  image_url: string;
  view: string | null;
  color: string | null;
  is_primary: boolean;
  label_source: string;
}

interface SelectionPreview {
  reason: string;
  warnings: string[];
  color: string | null;
  shot_type: string;
  prompt: string;
  selected: SelectedRef[];
}

/**
 * The views the generator understands. Kept in the same order the selector
 * prefers them, so the dropdown reads as "how useful is this angle".
 */
const VIEW_OPTIONS = [
  "hero_three_quarter", "front", "top", "bungee_closeup", "side",
  "leg_closeup", "mat_closeup", "underside", "detail_other",
  "in_use", "packaging", "lineup", "comparison", "unknown",
] as const;

const COLOR_OPTIONS = [
  "black", "white", "grey", "silver", "blue", "navy", "teal", "green",
  "orange", "red", "pink", "purple", "yellow", "gold", "multi", "unknown",
] as const;

/** Views that can never act as a single-product identity reference. */
const NON_IDENTITY = new Set(["lineup", "comparison", "packaging"]);

function viewLabel(v: string | null): string {
  return (v ?? "unlabeled").replace(/_/g, " ");
}

// ── Style tokens ──────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
};

const ACCENT = "#f59e0b";

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
        background: type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        borderRadius: 10, padding: "0.65rem 1rem",
        display: "flex", alignItems: "center", gap: "0.5rem",
        backdropFilter: "blur(12px)",
      }}
    >
      {type === "success"
        ? <CheckCircle2 size={14} color="#10b981" />
        : <AlertCircle size={14} color="#ef4444" />}
      <span style={{ color: type === "success" ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 600 }}>
        {message}
      </span>
    </motion.div>
  );
}

function RefBadge({ count }: { count: number }) {
  const pct = Math.round((count / MAX_REFS) * 100);
  const color = count === 0 ? "#475569" : count >= MAX_REFS ? "#10b981" : ACCENT;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      background: count === 0 ? "rgba(255,255,255,0.04)" : `${color}14`,
      border: `1px solid ${count === 0 ? "rgba(255,255,255,0.07)" : `${color}30`}`,
      borderRadius: 8, padding: "2px 7px",
    }}>
      <Pin size={9} color={color} />
      <span style={{ fontSize: 10, fontWeight: 800, color }}>{count}/{MAX_REFS}</span>
    </div>
  );
}

// ── Product List Panel ─────────────────────────────────────────────────────────

function ProductList({
  products, loading, search, setSearch, selected, onSelect,
}: {
  products: ShopifyProduct[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  selected: ShopifyProduct | null;
  onSelect: (p: ShopifyProduct) => void;
}) {
  const filtered = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <ShoppingBag size={14} color={ACCENT} />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Shopify Products
          </span>
          {loading && <Loader2 size={12} color="#64748b" style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} />}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, padding: "0.4rem 0.65rem",
        }}>
          <Search size={11} color="#475569" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter products…"
            style={{
              background: "none", border: "none", outline: "none",
              color: "#f0f0f0", fontSize: 12, flex: 1, fontFamily: "inherit",
            }}
          />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#475569" }}><X size={10} /></button>}
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }} className="custom-scrollbar">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#475569", fontSize: 12 }}>Loading products…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#475569", fontSize: 12 }}>No products found</div>
        ) : (
          filtered.map(product => {
            const isActive = selected?.id === product.id;
            return (
              <motion.button
                key={product.id}
                onClick={() => onSelect(product)}
                whileHover={{ background: "rgba(255,255,255,0.04)" }}
                style={{
                  width: "100%", background: isActive ? `${ACCENT}08` : "transparent",
                  border: "none", borderLeft: isActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  gap: "0.65rem", padding: "0.65rem 0.875rem", textAlign: "left",
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {product.thumbnail
                    ? <img src={product.thumbnail} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <ImageIcon size={14} color="#475569" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: isActive ? ACCENT : "#e2e8f0", fontSize: 12, fontWeight: 700,
                    margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {product.title}
                  </p>
                  <p style={{ color: "#475569", fontSize: 10, margin: 0, fontWeight: 600 }}>
                    {product.image_count} image{product.image_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <RefBadge count={product.ref_count} />
                <ChevronRight size={12} color={isActive ? ACCENT : "#334155"} />
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Shopify Image Picker Panel ─────────────────────────────────────────────────

function ImagePicker({
  product, pinnedUrls, onAdd,
}: {
  product: ShopifyProduct;
  pinnedUrls: Set<string>;
  onAdd: (url: string, source: "shopify") => void;
}) {
  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Shopify Images — {product.title}
        </p>
        <p style={{ color: "#475569", fontSize: 10, margin: "0.25rem 0 0" }}>
          Click to add to reference set · {product.images.length} images available
        </p>
      </div>

      <div
        className="custom-scrollbar"
        style={{
          flex: 1, overflowY: "auto", padding: "0.875rem",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.6rem",
          alignContent: "start",
        }}
      >
        {product.images.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: "2rem", textAlign: "center", color: "#475569", fontSize: 12 }}>
            No images attached to this product in Shopify
          </div>
        )}
        {product.images.map(img => {
          const isPinned = pinnedUrls.has(img.src);
          return (
            <motion.button
              key={img.id}
              onClick={() => !isPinned && onAdd(img.src, "shopify")}
              whileHover={!isPinned ? { scale: 1.04 } : {}}
              style={{
                position: "relative", aspectRatio: "1", border: "none",
                borderRadius: 10, overflow: "hidden", cursor: isPinned ? "default" : "pointer",
                background: "rgba(255,255,255,0.04)",
                outline: isPinned ? `2px solid ${ACCENT}` : "2px solid transparent",
                outlineOffset: 2, padding: 0,
              }}
            >
              <img
                src={img.src.replace(/\?.*$/, "") + "?width=200"}
                alt="product"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <AnimatePresence>
                {isPinned && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: "absolute", inset: 0, background: `${ACCENT}22`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <div style={{
                      background: ACCENT, borderRadius: "50%", padding: 4,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <CheckCircle2 size={14} color="#000" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!isPinned && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Plus size={18} color="#fff" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Reference Set Panel ────────────────────────────────────────────────────────

/**
 * The labels on one reference, shown inline and editable.
 *
 * Editing is a correction, not data entry: the vision pass has already filled
 * these in, and every field here is one somebody only touches when the machine
 * got it wrong. That is why a change stamps the row as human-labelled on the
 * server and permanently exempts it from re-labelling.
 */
function LabelRow({ item: r, onLabel }: {
  item: PinnedRef;
  onLabel: (refId: string, patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const excluded = !r.usable_for_identity;
  const unlabeled = r.label_source === "unlabeled" || !r.view;

  const chip = (text: string, color: string, title?: string) => (
    <span title={title} style={{
      fontSize: 9, fontWeight: 700, color,
      background: `${color}14`, border: `1px solid ${color}30`,
      borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap",
    }}>{text}</span>
  );

  const selectStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6, color: "#cbd5e1", fontSize: 10, padding: "2px 4px", flex: 1, minWidth: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {unlabeled
          ? chip("unlabeled", "#64748b", "Run Auto-label so the generator can choose this intelligently")
          : chip(viewLabel(r.view), excluded ? "#64748b" : "#38bdf8")}
        {r.color && r.color !== "unknown" && chip(r.color, r.color === "multi" ? "#f59e0b" : "#a78bfa")}
        {r.is_primary && chip("★ primary", "#10b981", "The anchor reference — sent first")}
        {excluded && !unlabeled && chip("not identity", "#ef4444", "Excluded from reference sets: more than one unit, or an angle that cannot define the product")}
        {r.label_source === "human" && chip("yours", "#10b981", "Corrected by hand — the labeller will not overwrite it")}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto", fontSize: 9, color: "#475569" }}
        >
          {open ? "done" : "edit"}
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <select
            value={r.view ?? "unknown"}
            onChange={e => onLabel(r.id, { view: e.target.value, usable_for_identity: !NON_IDENTITY.has(e.target.value) })}
            style={selectStyle}
          >
            {VIEW_OPTIONS.map(v => <option key={v} value={v}>{viewLabel(v)}</option>)}
          </select>
          <select
            value={r.color ?? "unknown"}
            onChange={e => onLabel(r.id, { color: e.target.value })}
            style={selectStyle}
          >
            {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            title={r.usable_for_identity ? "Exclude from reference sets" : "Allow as an identity reference"}
            onClick={() => onLabel(r.id, { usable_for_identity: !r.usable_for_identity })}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
          >
            {r.usable_for_identity ? <Eye size={11} color="#10b981" /> : <EyeOff size={11} color="#64748b" />}
          </button>
          <button
            title="Make this the anchor reference"
            onClick={() => onLabel(r.id, { is_primary: true })}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
          >
            <Star size={11} color={r.is_primary ? "#10b981" : "#475569"} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReferenceSet({
  product, refs, onRemove, onReorder, onAddUrl, onUpload,
  onLabel, onAutoLabel, labeling, preview, onPreview, previewing,
}: {
  product: ShopifyProduct;
  refs: PinnedRef[];
  onRemove: (refId: string) => void;
  onReorder: (newOrder: PinnedRef[]) => void;
  onAddUrl: (url: string) => void;
  onUpload: (files: FileList) => void;
  onLabel: (refId: string, patch: Record<string, unknown>) => void;
  onAutoLabel: (force: boolean) => void;
  labeling: boolean;
  preview: SelectionPreview | null;
  onPreview: () => void;
  previewing: boolean;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const count = refs.length;
  const usableCount = refs.filter(r => r.usable_for_identity && r.label_source !== "unlabeled").length;
  const unlabeledCount = refs.filter(r => r.label_source === "unlabeled" || !r.view).length;
  const pct = Math.round((count / MAX_REFS) * 100);
  const barColor = count === 0 ? "#334155" : count >= MAX_REFS ? "#10b981" : ACCENT;

  function handleAddUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { setUrlError("Invalid URL"); return; }
    setUrlError("");
    onAddUrl(trimmed);
    setUrlInput("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files);
  }

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Reference Set
          </p>
          <RefBadge count={count} />
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: "0.5rem" }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${barColor}, ${barColor}bb)` }}
          />
        </div>

        {count === 0 ? (
          <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
            Pin images from Shopify or paste a URL below
          </p>
        ) : (
          <>
            {/*
              The count is no longer the headline. Fourteen unlabelled references
              spanning five colours generated worse images than four labelled ones
              of a single colour, so what matters is how many are labelled and how
              many can actually stand in for the product.
            */}
            <p style={{ fontSize: 10, color: "#64748b", margin: "0 0 0.5rem" }}>
              <span style={{ color: usableCount > 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>{usableCount}</span>
              {" of "}{count}{" usable as identity references"}
              {unlabeledCount > 0 && <span style={{ color: ACCENT }}>{" · "}{unlabeledCount} unlabeled</span>}
            </p>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                onClick={() => onAutoLabel(false)}
                disabled={labeling}
                title="Label the unlabelled references with a vision pass"
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: unlabeledCount > 0 ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${unlabeledCount > 0 ? `${ACCENT}35` : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8, padding: "0.35rem", cursor: labeling ? "default" : "pointer",
                  color: unlabeledCount > 0 ? ACCENT : "#94a3b8", fontSize: 10, fontWeight: 700,
                }}
              >
                {labeling
                  ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                  : <Wand2 size={11} />}
                {labeling ? "Labeling…" : unlabeledCount > 0 ? `Auto-label ${unlabeledCount}` : "Re-label all"}
              </button>
              <button
                onClick={onPreview}
                disabled={previewing}
                title="Show which references a generation would actually use"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "0.35rem 0.6rem", cursor: previewing ? "default" : "pointer",
                  color: "#94a3b8", fontSize: 10, fontWeight: 700,
                }}
              >
                {previewing
                  ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                  : <Eye size={11} />}
                Preview
              </button>
            </div>
          </>
        )}

        {/*
          What the generator would actually do with this set. The selector dropping
          most of a pinned set is correct and looks like a bug, so it is shown with
          its reasoning rather than left to be discovered in a log.
        */}
        {preview && (
          <div style={{
            marginTop: "0.6rem", padding: "0.5rem",
            background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 9,
          }}>
            <p style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, margin: "0 0 0.35rem" }}>
              Would send {preview.selected.length} reference{preview.selected.length === 1 ? "" : "s"}
            </p>
            <p style={{ fontSize: 9, color: "#94a3b8", margin: "0 0 0.4rem", lineHeight: 1.45 }}>{preview.reason}</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {preview.selected.map((sel, i) => (
                <img
                  key={sel.image_url + i}
                  src={sel.image_url}
                  alt={viewLabel(sel.view)}
                  title={`${i + 1}. ${viewLabel(sel.view)}${sel.color ? ` · ${sel.color}` : ""}`}
                  style={{
                    width: 34, height: 34, borderRadius: 6, objectFit: "cover",
                    border: sel.is_primary ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>
            {preview.warnings.map((w, i) => (
              <p key={i} style={{ fontSize: 9, color: "#f59e0b", margin: "0.35rem 0 0" }}>⚠️ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Reorderable list */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
        {refs.length === 0 ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", opacity: 0.35, gap: 8,
          }}>
            <Pin size={24} color="#475569" />
            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", margin: 0 }}>
              No refs pinned yet.<br />Click images on the left to add them.
            </p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={refs} onReorder={onReorder} style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {refs.map((ref, i) => (
              <Reorder.Item key={ref.id} value={ref} style={{ marginBottom: "0.5rem" }}>
                <motion.div
                  layout
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 9, padding: "0.4rem 0.5rem", cursor: "grab",
                  }}
                >
                  <GripVertical size={12} color="#334155" style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: 9, fontWeight: 900, color: ACCENT,
                    background: `${ACCENT}15`, border: `1px solid ${ACCENT}25`,
                    borderRadius: 5, padding: "1px 5px", flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <img
                    src={ref.image_url.replace(/\?.*$/, "") + "?width=80"}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = ref.image_url; }}
                  />
                  <LabelRow item={ref} onLabel={onLabel} />
                  <button
                    onClick={() => onRemove(ref.id)}
                    style={{
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                      borderRadius: 6, padding: "3px 6px", cursor: "pointer", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Trash2 size={10} color="#ef4444" />
                  </button>
                </motion.div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>

      {/* Upload drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => count < MAX_REFS && fileInputRef.current?.click()}
        style={{
          margin: "0 0.75rem 0.75rem",
          border: `2px dashed ${isDragging ? ACCENT : "rgba(255,255,255,0.1)"}`,
          borderRadius: 10,
          padding: "0.75rem",
          display: "flex", alignItems: "center", gap: "0.6rem",
          cursor: count < MAX_REFS ? "pointer" : "default",
          background: isDragging ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
          transition: "all 0.15s",
          opacity: count >= MAX_REFS ? 0.4 : 1,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `${ACCENT}14`, border: `1px solid ${ACCENT}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Upload size={13} color={ACCENT} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: 0 }}>
            {isDragging ? "Drop to upload" : "Upload from desktop"}
          </p>
          <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
            Drag & drop or click · JPG, PNG, WebP · max 20 MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={e => e.target.files && onUpload(e.target.files)}
        />
      </div>

      {/* URL input */}
      <div style={{ padding: "0.875rem", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Add from URL
        </p>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "0.4rem",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${urlError ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 8, padding: "0.35rem 0.65rem",
          }}>
            <Link2 size={10} color="#475569" />
            <input
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
              onKeyDown={e => e.key === "Enter" && handleAddUrl()}
              placeholder="Paste image URL…"
              style={{
                background: "none", border: "none", outline: "none",
                color: "#f0f0f0", fontSize: 11, flex: 1, fontFamily: "inherit",
              }}
            />
          </div>
          <button
            onClick={handleAddUrl}
            disabled={!urlInput.trim() || count >= MAX_REFS}
            style={{
              background: urlInput.trim() && count < MAX_REFS ? ACCENT : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 8, padding: "0.35rem 0.65rem",
              cursor: urlInput.trim() && count < MAX_REFS ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}
          >
            <Plus size={13} color={urlInput.trim() && count < MAX_REFS ? "#000" : "#334155"} />
          </button>
        </div>
        {urlError && <p style={{ fontSize: 10, color: "#ef4444", margin: "0.25rem 0 0" }}>{urlError}</p>}
        {count >= MAX_REFS && <p style={{ fontSize: 10, color: "#64748b", margin: "0.25rem 0 0" }}>Remove a ref to add more</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductRefsPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ShopifyProduct | null>(null);
  const [refs, setRefs] = useState<PinnedRef[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [labeling, setLabeling] = useState(false);
  const [preview, setPreview] = useState<SelectionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── Fetch products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const r = await fetch(`${BOT_URL}/admin/products?limit=100`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setProducts(data.products ?? []);
    } catch (e: any) {
      showToast(`Failed to load products: ${e.message}`, "error");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Fetch refs for selected product ────────────────────────────────────────
  const loadRefs = useCallback(async (productId: string) => {
    setLoadingRefs(true);
    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${productId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRefs(data.refs ?? []);
    } catch (e: any) {
      showToast(`Failed to load refs: ${e.message}`, "error");
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  const handleSelectProduct = useCallback((product: ShopifyProduct) => {
    setSelected(product);
    setRefs([]);
    setPreview(null);   // a preview belongs to one product; carrying it over would lie
    loadRefs(product.id);
  }, [loadRefs]);

  // ── Labels ─────────────────────────────────────────────────────────────────

  const handleLabel = useCallback(async (refId: string, patch: Record<string, unknown>) => {
    if (!selected) return;
    // Optimistic: a label edit is a correction of something already on screen, and
    // a select box that snaps back while a request is in flight reads as a bug.
    setRefs(prev => prev.map(r => r.id === refId ? { ...r, ...patch, label_source: "human" } as PinnedRef : r));
    setPreview(null);   // the selection this described is no longer the current one
    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/${refId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // A primary election on the server can change rows other than this one.
      loadRefs(selected.id);
    } catch (e: any) {
      showToast(`Label update failed: ${e.message}`, "error");
      loadRefs(selected.id);
    }
  }, [selected, loadRefs]);

  const handleAutoLabel = useCallback(async (force: boolean) => {
    if (!selected) return;
    setLabeling(true);
    setPreview(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const out = await r.json();
      showToast(
        out.labeled > 0
          ? `Labeled ${out.labeled} image${out.labeled === 1 ? "" : "s"}${out.failed ? `, ${out.failed} failed` : ""}`
          : "Nothing to label",
        out.labeled > 0 ? "success" : "error",
      );
      loadRefs(selected.id);
      loadProducts();
    } catch (e: any) {
      showToast(`Auto-label failed: ${e.message}`, "error");
    } finally {
      setLabeling(false);
    }
  }, [selected, loadRefs, loadProducts]);

  const handlePreview = useCallback(async () => {
    if (!selected) return;
    setPreviewing(true);
    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/preview`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPreview(await r.json());
    } catch (e: any) {
      showToast(`Preview failed: ${e.message}`, "error");
    } finally {
      setPreviewing(false);
    }
  }, [selected]);

  // ── Add image from Shopify picker ───────────────────────────────────────────
  const handleAddImage = useCallback(async (url: string, source: "shopify" | "url") => {
    if (!selected) return;
    if (refs.length >= MAX_REFS) { showToast("Max 14 reference images", "error"); return; }

    // Optimistic
    const tempRef: PinnedRef = {
      id: `tmp-${Date.now()}`,
      product_id: selected.id,
      product_title: selected.title,
      image_url: url,
      image_source: source,
      display_order: refs.length,
      // The server labels newly pinned refs in the background, so the optimistic
      // row starts unlabelled and the reload a moment later fills it in.
      view: null,
      color: null,
      size_label: null,
      is_primary: false,
      usable_for_identity: true,
      label_source: "unlabeled",
      label_confidence: null,
      label_notes: null,
    };
    setRefs(prev => [...prev, tempRef]);

    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_title: selected.title,
          product_handle: selected.handle,
          images: [{ url, source }],
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
      const data = await r.json();
      // Replace temp with real
      setRefs(prev => prev.map(ref => ref.id === tempRef.id ? (data.added?.[0] ?? ref) : ref));
      // Update ref_count badge on product list
      setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, ref_count: p.ref_count + 1 } : p));
    } catch (e: any) {
      setRefs(prev => prev.filter(r => r.id !== tempRef.id));
      showToast(`Failed to pin: ${e.message}`, "error");
    }
  }, [selected, refs.length]);

  // ── Remove a ref ───────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (refId: string) => {
    if (!selected) return;
    const removed = refs.find(r => r.id === refId);
    setRefs(prev => prev.filter(r => r.id !== refId));
    setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, ref_count: Math.max(0, p.ref_count - 1) } : p));

    try {
      const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/${refId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e: any) {
      // Rollback
      if (removed) setRefs(prev => [...prev, removed].sort((a, b) => a.display_order - b.display_order));
      setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, ref_count: p.ref_count + 1 } : p));
      showToast(`Failed to remove: ${e.message}`, "error");
    }
  }, [selected, refs]);

  // ── Reorder (debounced server sync) ────────────────────────────────────────
  const handleReorder = useCallback((newOrder: PinnedRef[]) => {
    setRefs(newOrder);
    if (!selected) return;

    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = setTimeout(async () => {
      try {
        await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newOrder.map(r => r.id) }),
        });
      } catch (e: any) {
        showToast(`Reorder sync failed: ${e.message}`, "error");
      }
    }, 800);
  }, [selected]);

  // ── Upload files from desktop ───────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList) => {
    if (!selected) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) { showToast("No valid image files selected", "error"); return; }

    const remaining = MAX_REFS - refs.length;
    const toUpload = arr.slice(0, remaining);
    if (toUpload.length === 0) { showToast("Max 14 refs already reached", "error"); return; }

    showToast(`Uploading ${toUpload.length} image${toUpload.length > 1 ? "s" : ""}…`);

    let successCount = 0;
    for (const file of toUpload) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("product_title", selected.title);
        fd.append("product_handle", selected.handle);

        const r = await fetch(`${BOT_URL}/admin/products/refs/${selected.id}/upload`, {
          method: "POST",
          body: fd,
          signal: AbortSignal.timeout(30_000),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
        const data = await r.json();
        if (data.ref) {
          setRefs(prev => [...prev, data.ref]);
          setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, ref_count: p.ref_count + 1 } : p));
          successCount++;
        }
      } catch (e: any) {
        showToast(`Upload failed for ${file.name}: ${e.message}`, "error");
      }
    }

    if (successCount > 0) {
      showToast(`✅ ${successCount} image${successCount > 1 ? "s" : ""} uploaded and pinned`);
    }
  }, [selected, refs.length]);

  const pinnedUrls = new Set(refs.map(r => r.image_url));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", gap: "0.75rem" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Pin size={15} color={ACCENT} />
        </div>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
            Product Reference Manager
          </h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            Pin up to 14 images per product — agents will use these for Kie.ai generation instead of random Shopify auto-fetch
          </p>
        </div>
        <button
          onClick={loadProducts}
          style={{
            marginLeft: "auto", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
            padding: "0.35rem 0.75rem", cursor: "pointer", display: "flex",
            alignItems: "center", gap: "0.35rem", color: "#64748b", fontSize: 11, fontWeight: 700,
          }}
        >
          <RefreshCw size={11} />
          Refresh
        </button>
      </div>

      {/* Three-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 300px", gap: "0.75rem", flex: 1, minHeight: 0 }}>

        {/* Panel 1: Product list */}
        <ProductList
          products={products}
          loading={loadingProducts}
          search={search}
          setSearch={setSearch}
          selected={selected}
          onSelect={handleSelectProduct}
        />

        {/* Panel 2: Shopify image picker */}
        {selected ? (
          <ImagePicker
            product={selected}
            pinnedUrls={pinnedUrls}
            onAdd={handleAddImage}
          />
        ) : (
          <div style={{
            ...CARD, display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: "0.75rem", opacity: 0.4,
          }}>
            <ShoppingBag size={28} color="#475569" />
            <p style={{ color: "#475569", fontSize: 13, textAlign: "center", margin: 0 }}>
              Select a product on the left<br />to see its Shopify images
            </p>
          </div>
        )}

        {/* Panel 3: Reference set */}
        {selected ? (
          loadingRefs ? (
            <div style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={18} color="#475569" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <ReferenceSet
              product={selected}
              refs={refs}
              onRemove={handleRemove}
              onReorder={handleReorder}
              onLabel={handleLabel}
              onAutoLabel={handleAutoLabel}
              labeling={labeling}
              preview={preview}
              onPreview={handlePreview}
              previewing={previewing}
              onAddUrl={(url) => handleAddImage(url, "url")}
              onUpload={handleUpload}
            />
          )
        ) : (
          <div style={{
            ...CARD, display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: "0.75rem", opacity: 0.4,
          }}>
            <Pin size={28} color="#475569" />
            <p style={{ color: "#475569", fontSize: 13, textAlign: "center", margin: 0 }}>
              Reference set appears here<br />after selecting a product
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
