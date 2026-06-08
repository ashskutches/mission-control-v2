"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  ShoppingBag, ImageIcon, Pin, PinOff, Plus, Trash2, GripVertical,
  Search, ChevronRight, Link2, CheckCircle2, AlertCircle, X, RefreshCw,
  Loader2,
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

function ReferenceSet({
  product, refs, onRemove, onReorder, onAddUrl,
}: {
  product: ShopifyProduct;
  refs: PinnedRef[];
  onRemove: (refId: string) => void;
  onReorder: (newOrder: PinnedRef[]) => void;
  onAddUrl: (url: string) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const count = refs.length;
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

        {count >= MAX_REFS && (
          <p style={{ fontSize: 10, color: "#10b981", fontWeight: 700, margin: 0 }}>
            ✅ Max 14 refs set — ready for Kie.ai
          </p>
        )}
        {count === 0 && (
          <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
            Pin images from Shopify or paste a URL below
          </p>
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 10, color: "#94a3b8", margin: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {ref.image_source === "url" ? "🔗 Custom URL" : "📦 Shopify"}
                    </p>
                  </div>
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
    loadRefs(product.id);
  }, [loadRefs]);

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
              onAddUrl={(url) => handleAddImage(url, "url")}
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
