"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Upload, X, ImageIcon, Sparkles, RefreshCw,
  ChevronDown, ExternalLink, Copy, Check, AlertCircle,
  Loader2, BookOpen, ZoomIn, Package, Search, ChevronRight,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const PURPLE  = "#a78bfa";
const ACCENT  = "#38bdf8";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface GeneratedImage {
  id: string;
  agent_name: string | null;
  prompt: string;
  enhanced_prompt: string;
  image_url: string;
  size: string;
  quality: string;
  created_at: string;
}

interface ProductRef {
  id: string;
  product_id: string;
  product_title: string;
  image_url: string;
  image_source: string;
  display_order: number;
}

interface RefProduct {
  product_id: string;
  product_title: string;
  refs: ProductRef[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const dt = new Date(d);
  const diff = Date.now() - dt.getTime();
  if (diff < 60_000)         return "just now";
  if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Image Thumbnail ────────────────────────────────────────────────────────────

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "rgba(0,0,0,0.4)" }}>
      {!loaded && !failed && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
          backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
        }} />
      )}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
            opacity: loaded ? 1 : 0, transition: "opacity 0.25s", filter: "brightness(0.92)" }} />
      )}
      {failed && (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ImageIcon size={24} color="#334155" />
        </div>
      )}
    </div>
  );
}

// ── Best Practices Guide — clickable prompt starters ──────────────────────────

const TIPS: { title: string; body: string; starter: string }[] = [
  {
    title: "Lightbox packshot",
    body: "Classic studio product photo on pure white — great for Amazon & PDP.",
    starter: "Ultra-realistic studio packshot of mini trampoline rebounder. Three-point lighting: key light 45° front-left (100%, 5600K, diffused softbox), fill light 45° front-right (45%, 5600K), rim light behind product (35%, 6500K). Pure white seamless background #FFFFFF. 50mm equivalent lens, f/8, ISO 100. Product fills 70% of frame. Shadows have visible detail — not pure black. 4K resolution, ultra-sharp, commercial e-commerce photography. No plastic sheen. No blown-out highlights. No fisheye distortion.",
  },
  {
    title: "Lifestyle — home gym",
    body: "Person using the product in a bright, modern home gym setting.",
    starter: "Late-30s athletic woman mid-bounce on a mini trampoline rebounder in a bright home gym. Large windows with natural daylight, light grey walls, clean hardwood floor, energetic and healthy mood. Canon EOS R5, 85mm prime lens, f/2.8, shallow depth of field. Product fills 65% of frame. Camera 15–20° above horizontal. Photorealistic lifestyle photography, 4K ultra-detailed. No plastic sheen, no pure black shadows, no fisheye distortion.",
  },
  {
    title: "Lifestyle — rustic kitchen",
    body: "Candid morning scene in a warm farmhouse kitchen.",
    starter: "Mid-40s woman sitting on a mini trampoline rebounder in a rustic farmhouse kitchen. Morning sunlight through large wooden window, warm coffee mug beside her, exposed brick wall, hardwood floor. Candid and natural mood. Canon EOS R5, 85mm prime lens, f/2.8. Product fills 65% of frame. Photorealistic lifestyle photography, 4K ultra-detailed. No plastic sheen, no pure black shadows.",
  },
  {
    title: "Dramatic hero shot",
    body: "Dark gradient background with hard key light — premium presentation.",
    starter: "Dramatic studio product shot of mini trampoline rebounder. Rich dark gradient background (#0a0f1a to #1e1b4b). Primary key light at 45° front-left (hard edge, high contrast, 5600K), strong rim light behind product defining spring edges and frame silhouette (6500K). Deep shadows with visible detail — NOT pure black. Spring coils individually visible with brushed metallic reflections. Mat weave texture defined. 50mm equivalent lens, f/8. 4K resolution, ultra-sharp, premium commercial photography. No plastic sheen. No mirror-chrome springs.",
  },
  {
    title: "Material detail close-up",
    body: "Macro crop emphasising spring coils, mat weave, and frame joints.",
    starter: "Macro-detail product shot of mini trampoline rebounder. Extreme close crop on bungee cords and jump ring. Spring coils individually distinguishable with fine coil winding, brushed galvanized steel finish — NOT mirror-chrome, NOT plastic. Mat woven polypropylene mesh with subtle grid weave texture clearly defined. Frame weld seams subtly present. Fill light increased so shadows show detail — NOT pure black. 50mm equivalent, f/4. 4K ultra-sharp. No blurred surface textures, no plastic sheen.",
  },
  {
    title: "Outdoor lifestyle",
    body: "Sunny backyard or patio scene for summer campaigns.",
    starter: "Early-50s woman standing beside a mini trampoline rebounder on a sunny backyard deck. Holding a coffee mug, relaxed morning mood. Green trees in background, soft natural light, golden hour warmth. Canon EOS R5, 85mm prime, f/2.8. Wide shot showing full body and product. 4K ultra-detailed, photorealistic lifestyle photography. No plastic sheen, no pure black shadows, no fisheye distortion.",
  },
  {
    title: "Three-point lighting guide",
    body: "Copy this lighting block into any packshot prompt.",
    starter: "Three-point lighting: key light at 45° front-left (5600K daylight, large diffused softbox, 100% intensity), fill light at 45° front-right (5600K, 45% intensity, broad soft fill — reveals detail under springs and mat), rim light directly behind product (6500K slightly cooler, 35% intensity, harder source — separates product from background and defines edges). Shadows have visible detail — NOT pure black. No blown-out highlights.",
  },
  {
    title: "Negative prompting block",
    body: "Add this to any prompt to prevent common AI failures.",
    starter: "No plastic sheen, no toy-like appearance, no mirror-chrome finish, no pure black shadows, no blown-out highlights, no fisheye distortion, no barrel distortion, no product cropping, no blurred surface textures, no oversaturation, no CGI look, no giant full-size trampoline (mini rebounder ~40 inches diameter only).",
  },
];

function BestPracticesGuide({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [inserted, setInserted] = useState<string | null>(null);

  const handleClick = (starter: string, title: string) => {
    onInsert(starter);
    setInserted(title);
    setTimeout(() => setInserted(null), 1800);
  };

  return (
    <div style={{ ...CARD, marginBottom: "1.5rem", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.9rem 1.25rem", background: "none", border: "none", cursor: "pointer", color: "#e2e8f0",
        }}
        aria-expanded={open}
        id="guide-toggle"
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: 13 }}>
          <BookOpen size={14} color={PURPLE} /> Prompt Starters &amp; Best Practices
          <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>— click any card to load into prompt</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={15} color="#475569" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "0.65rem", padding: "0 1.25rem 1.25rem",
            }}>
              {TIPS.map(({ title, body, starter }) => {
                const isInserted = inserted === title;
                return (
                  <motion.button
                    key={title}
                    onClick={() => handleClick(starter, title)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      background: isInserted ? `${PURPLE}18` : `${PURPLE}08`,
                      border: `1px solid ${isInserted ? PURPLE + "50" : PURPLE + "18"}`,
                      borderRadius: 10, padding: "0.75rem 1rem",
                      cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: isInserted ? "#10b981" : PURPLE,
                        margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {isInserted ? "✓ Loaded" : title}
                      </p>
                      {!isInserted && <ChevronRight size={11} color={PURPLE} style={{ flexShrink: 0 }} />}
                    </div>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{body}</p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Product Ref Picker ─────────────────────────────────────────────────────────

function ProductRefPicker({ onSelect }: { onSelect: (urls: string[], title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<RefProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load pinned refs on first open
  useEffect(() => {
    if (!open || products.length > 0) return;
    setLoading(true);
    fetch(`${BOT_URL}/admin/products/refs`)
      .then(r => r.json())
      .then(({ refs }: { refs: Record<string, ProductRef[]> }) => {
        // Group into array, dedupe by product_id, sort by title
        const grouped = Object.entries(refs).map(([pid, rows]) => ({
          product_id: pid,
          product_title: rows[0]?.product_title ?? pid,
          refs: rows,
        })).sort((a, b) => a.product_title.localeCompare(b.product_title));
        setProducts(grouped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, products.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = products.filter(p =>
    !search || p.product_title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (p: RefProduct) => {
    const urls = p.refs.slice(0, 10).map(r => r.image_url);
    onSelect(urls, p.product_title);
    setSelected(p.product_title);
    setOpen(false);
    setTimeout(() => setSelected(null), 2500);
  };

  return (
    <div ref={dropRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        id="product-ref-picker-btn"
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          background: selected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${selected ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 8, padding: "0.4rem 0.8rem",
          color: selected ? "#10b981" : "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        <Package size={12} />
        {selected ? `✓ ${selected.slice(0, 22)}${selected.length > 22 ? "…" : ""}` : "Use Product Refs"}
        <ChevronDown size={11} style={{ opacity: 0.5 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
              background: "rgba(10,15,26,0.98)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
              width: 320, maxHeight: 380, overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Search */}
            <div style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position: "relative" }}>
                <Search size={11} color="#475569" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  style={{
                    width: "100%", boxSizing: "border-box", paddingLeft: 26, paddingRight: 10,
                    paddingTop: "0.4rem", paddingBottom: "0.4rem",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none",
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 0.75rem", color: "#475569", fontSize: 12 }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Loading product refs…
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: "1rem 0.75rem", color: "#475569", fontSize: 12, textAlign: "center" }}>
                  {search ? `No products match "${search}"` : "No pinned refs found. Add refs under Content → Products."}
                </div>
              )}
              {filtered.map(p => (
                <button
                  key={p.product_id}
                  onClick={() => handleSelect(p)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.65rem",
                    padding: "0.55rem 0.75rem", background: "none", border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {/* Thumbnail of first ref */}
                  <div style={{ width: 38, height: 38, borderRadius: 7, overflow: "hidden",
                    background: "rgba(0,0,0,0.3)", flexShrink: 0, border: "1px solid rgba(255,255,255,0.07)" }}>
                    {p.refs[0]?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.refs[0].image_url} alt={p.product_title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Package size={14} color="#334155" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#e2e8f0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.product_title}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>
                      {p.refs.length} pinned ref{p.refs.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight size={12} color="#334155" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Reference Image Zone (drop + product picker) ───────────────────────────────

function RefImageZone({
  images, onAdd, onRemove, onProductSelect,
}: {
  images: { url: string; name: string }[];
  onAdd: (imgs: { url: string; name: string }[]) => void;
  onRemove: (i: number) => void;
  onProductSelect: (urls: string[], title: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 3 - images.length);
    const converted = await Promise.all(valid.map(async f => ({ url: await fileToDataUrl(f), name: f.name })));
    if (converted.length) onAdd(converted);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: 0,
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Reference Images <span style={{ color: "#334155", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional, max 3)</span>
        </p>
        <ProductRefPicker onSelect={(urls, title) => {
          // Replace all current refs with product refs (up to 3)
          const next = urls.slice(0, 3).map((url, i) => ({ url, name: `${title} ref ${i + 1}` }));
          // Clear existing and set product refs
          onProductSelect(next);
        }} />
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: "relative", width: 80, height: 80, borderRadius: 10, overflow: "hidden",
            border: `1px solid ${PURPLE}30`, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button
              onClick={() => onRemove(i)}
              style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.7)", border: "none",
                borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "#fff" }}
              aria-label={`Remove ${img.name}`}
            >
              <X size={10} />
            </button>
            {/* Source badge */}
            <span style={{
              position: "absolute", bottom: 3, left: 3, fontSize: 8, fontWeight: 800,
              color: "#fff", background: "rgba(0,0,0,0.65)", borderRadius: 4, padding: "1px 4px",
              letterSpacing: "0.04em",
            }}>
              {img.name.includes("ref") ? "PROD" : "FILE"}
            </span>
          </div>
        ))}

        {images.length < 3 && (
          <div
            role="button" tabIndex={0}
            aria-label="Drop or click to add reference images"
            onClick={() => inputRef.current?.click()}
            onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
            style={{
              width: 80, height: 80, borderRadius: 10, flexShrink: 0,
              border: `2px dashed ${dragging ? PURPLE : "rgba(255,255,255,0.12)"}`,
              background: dragging ? `${PURPLE}08` : "rgba(255,255,255,0.02)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 5, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <Upload size={16} color={dragging ? PURPLE : "#475569"} />
            <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>
              DROP /<br />CLICK
            </span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={e => processFiles(e.target.files)} />
    </div>
  );
}

// ── Generated Image Card ───────────────────────────────────────────────────────

function ImageCard({ img, highlight = false }: { img: GeneratedImage; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(img.image_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isStudio = img.agent_name === "mission-control/studio";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        ...CARD, padding: 0, overflow: "hidden",
        border: highlight ? `1px solid ${PURPLE}50` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: highlight ? `0 0 0 1px ${PURPLE}25, 0 4px 24px ${PURPLE}12` : "none",
      }}
    >
      <a href={img.image_url} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", position: "relative", width: "100%", height: 180,
          overflow: "hidden", background: "#0a0f1a", textDecoration: "none" }}>
        <Thumb src={img.image_url} alt={img.prompt.slice(0, 60)} />
        <span style={{
          position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 800,
          color: isStudio ? PURPLE : ACCENT,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          border: `1px solid ${isStudio ? PURPLE : ACCENT}35`,
          borderRadius: 6, padding: "2px 7px", display: "flex", alignItems: "center", gap: 4,
        }}>
          <Wand2 size={9} />{isStudio ? "Studio" : (img.agent_name ?? "Agent")}
        </span>
        <span style={{
          position: "absolute", top: 6, right: 6, fontSize: 9, color: "#94a3b8",
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          borderRadius: 5, padding: "2px 6px", fontWeight: 700,
        }}>
          {img.size}
        </span>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", opacity: 0, transition: "opacity 0.15s", background: "rgba(0,0,0,0.3)",
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
          <ZoomIn size={20} color="#fff" />
        </div>
      </a>
      <div style={{ padding: "0.7rem 0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: 10, color: "#475569" }}>{fmtDate(img.created_at)}</span>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button onClick={copyUrl} title="Copy URL"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 3,
                color: copied ? "#10b981" : "#475569", display: "flex" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <a href={img.image_url} target="_blank" rel="noopener noreferrer"
              style={{ color: "#475569", display: "flex", padding: 3 }} title="Open full size">
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <p
          onClick={() => setExpanded(e => !e)}
          style={{
            fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: "vertical",
            cursor: img.prompt.length > 80 ? "pointer" : "default",
          }}
        >
          {img.prompt}
        </p>
        {img.prompt.length > 80 && (
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: "none", border: "none", padding: 0, marginTop: 3,
              fontSize: 10, color: PURPLE, fontWeight: 700, cursor: "pointer" }}>
            {expanded ? "Less" : "More"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Model / Size constants ─────────────────────────────────────────────────────

const MODELS = [
  { id: "auto",          label: "Auto (recommended)" },
  { id: "kie-lifestyle", label: "Kie Lifestyle — people + product" },
  { id: "nano-banana-2", label: "Nano Banana 2 — packshots with refs" },
  { id: "flux-pro",      label: "FLUX Pro — creative / no refs" },
  { id: "flux-schnell",  label: "FLUX Schnell — fast draft" },
  { id: "ideogram-3",    label: "Ideogram 3 — text-in-image" },
];

const SIZES = [
  { id: "1024x1024", label: "Square (1024×1024)" },
  { id: "1792x1024", label: "Landscape (1792×1024)" },
  { id: "1024x1792", label: "Portrait (1024×1792)" },
];

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ImageStudioPage() {
  const [prompt, setPrompt]   = useState("");
  const [model, setModel]     = useState("auto");
  const [size, setSize]       = useState("1024x1024");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [refImages, setRefImages] = useState<{ url: string; name: string }[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [newImages, setNewImages]   = useState<GeneratedImage[]>([]);

  const [history, setHistory]             = useState<GeneratedImage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/admin/generate/recent?limit=30`);
      if (res.ok) setHistory((await res.json()).images ?? []);
    } catch (_) {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/generate/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model, size, quality,
          reference_image_urls: refImages.map(r => r.url),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      const created: GeneratedImage = {
        id: Date.now().toString(),
        agent_name: "mission-control/studio",
        prompt: json.prompt,
        enhanced_prompt: json.prompt,
        image_url: json.url,
        size: json.size,
        quality: json.quality,
        created_at: new Date().toISOString(),
      };
      setNewImages(prev => [created, ...prev]);
      setTimeout(fetchHistory, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
  };

  const historyIds = new Set(newImages.map(i => i.image_url));
  const mergedHistory = history.filter(h => !historyIds.has(h.image_url));

  return (
    <div>
      <BestPracticesGuide onInsert={text => setPrompt(text)} />

      {/* ── Studio Panel ── */}
      <div style={{ ...CARD, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${PURPLE}18`,
            border: `1px solid ${PURPLE}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={15} color={PURPLE} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#e2e8f0" }}>Image Studio</p>
            <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>Prompt · reference images · model — ⌘+Enter to generate</p>
          </div>
        </div>

        {/* Prompt */}
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="img-prompt" style={{ display: "block", fontSize: 11, fontWeight: 700,
            color: "#64748b", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Prompt <span style={{ color: "#f43f5e" }}>*</span>
          </label>
          <textarea
            id="img-prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Try a prompt starter above, or write your own…"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${prompt ? PURPLE + "40" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, padding: "0.75rem 1rem",
              color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, outline: "none",
              transition: "border-color 0.15s", fontFamily: "inherit",
            }}
          />
        </div>

        {/* Reference images */}
        <div style={{ marginBottom: "1.25rem" }}>
          <RefImageZone
            images={refImages}
            onAdd={imgs => setRefImages(prev => [...prev, ...imgs].slice(0, 3))}
            onRemove={i => setRefImages(prev => prev.filter((_, j) => j !== i))}
            onProductSelect={next => setRefImages(next)}
          />
        </div>

        {/* Model / Size / Quality */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="img-model" style={{ display: "block", fontSize: 10, fontWeight: 700,
              color: "#475569", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Model
            </label>
            <select id="img-model" value={model} onChange={e => setModel(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "0.45rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none", cursor: "pointer" }}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="img-size" style={{ display: "block", fontSize: 10, fontWeight: 700,
              color: "#475569", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Size
            </label>
            <select id="img-size" value={size} onChange={e => setSize(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "0.45rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none", cursor: "pointer" }}>
              {SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: "0.3rem",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>Quality</p>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {(["standard", "hd"] as const).map(q => (
                <button key={q} id={`quality-${q}`} onClick={() => setQuality(q)}
                  style={{
                    padding: "0.45rem 0.9rem", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    borderRadius: 8, border: `1px solid ${quality === q ? PURPLE + "50" : "rgba(255,255,255,0.09)"}`,
                    background: quality === q ? `${PURPLE}18` : "rgba(255,255,255,0.04)",
                    color: quality === q ? PURPLE : "#64748b", transition: "all 0.12s",
                  }}>
                  {q === "hd" ? "HD" : "Standard"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem",
                background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)",
                borderRadius: 10, padding: "0.65rem 1rem", marginBottom: "1rem" }}>
              <AlertCircle size={14} color="#f43f5e" />
              <span style={{ fontSize: 12, color: "#f43f5e", flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: "none", border: "none",
                cursor: "pointer", color: "#f43f5e", display: "flex" }} aria-label="Dismiss error">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <button
          id="generate-image-btn"
          onClick={generate}
          disabled={!prompt.trim() || generating}
          style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            background: !prompt.trim() || generating ? "rgba(167,139,250,0.08)" : `linear-gradient(135deg, ${PURPLE}, #818cf8)`,
            border: `1px solid ${PURPLE}40`, borderRadius: 10, padding: "0.75rem 1.75rem",
            color: !prompt.trim() || generating ? "#475569" : "#fff",
            fontSize: 13, fontWeight: 800,
            cursor: !prompt.trim() || generating ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            boxShadow: !prompt.trim() || generating ? "none" : `0 4px 20px ${PURPLE}30`,
          }}
        >
          {generating
            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
            : <><Wand2 size={15} /> Generate Image</>}
        </button>
      </div>

      {/* ── Just Generated ── */}
      <AnimatePresence>
        {newImages.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: PURPLE }}>✨ Just Generated</span>
              <div style={{ flex: 1, height: 1, background: `${PURPLE}20` }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem", marginBottom: "2rem" }}>
              {newImages.map(img => <ImageCard key={img.id} img={img} highlight />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recent History ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recent Images
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <button onClick={fetchHistory}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex" }}
            aria-label="Refresh history">
            <RefreshCw size={13} style={{ animation: historyLoading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>

        {historyLoading && mergedHistory.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 240, background: "rgba(255,255,255,0.03)", borderRadius: 14, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : mergedHistory.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
            <ImageIcon size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
            <p style={{ color: "#475569", fontSize: 13 }}>No images yet. Generate your first one above.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}
          >
            {mergedHistory.map(img => <ImageCard key={img.id} img={img} />)}
          </motion.div>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        textarea:focus     { border-color: ${PURPLE}60 !important; box-shadow: 0 0 0 2px ${PURPLE}15; }
        select             { appearance: none; }
      `}</style>
    </div>
  );
}
