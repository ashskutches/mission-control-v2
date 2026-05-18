"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, FolderOpen, Search, RefreshCw, CheckSquare,
  Image as ImageIcon, Film, FileText, Package, X, Plus,
  ChevronDown, ChevronLeft, ChevronRight, Database,
  AlertCircle, Loader2, BookmarkPlus, Check,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#38bdf8";
const PER_PAGE = 100; // files per page — sweet spot for rendering performance

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  tags?: string[];
}

interface PageResponse {
  files: DriveFile[];
  page: number;
  perPage: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  indexStatus: "idle" | "indexing" | "ready" | "error";
  indexTotal: number;
  foldersScanned: number;
  indexedAt: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileIcon(mimeType: string): React.ElementType {
  if (mimeType.startsWith("video/") || mimeType.includes("mp4")) return Film;
  if (mimeType.startsWith("image/") || mimeType.includes("photoshop") || mimeType === "application/psd") return ImageIcon;
  if (mimeType.startsWith("text/") || mimeType.includes("document") || mimeType.includes("pdf")) return FileText;
  return Package;
}
function fileColor(mimeType: string): string {
  if (mimeType.startsWith("video/") || mimeType.includes("mp4")) return "#f59e0b";
  if (mimeType.startsWith("image/") || mimeType.includes("photoshop") || mimeType === "application/psd") return "#38bdf8";
  if (mimeType.startsWith("text/") || mimeType.includes("document") || mimeType.includes("pdf")) return "#10b981";
  return "#94a3b8";
}

const PRESET_TAGS = [
  "product", "lifestyle", "workout", "testimonial", "unboxing",
  "rebounder", "customer", "ad-creative", "organic", "email",
  "hero", "upsell", "seasonal", "transformation",
];

const MIME_FILTERS = [
  { id: "",         label: "All",       icon: FolderOpen, color: "#64748b" },
  { id: "video",    label: "Videos",    icon: Film,       color: "#f59e0b" },
  { id: "image",    label: "Images",    icon: ImageIcon,  color: "#38bdf8" }, // includes PSDs
  { id: "document", label: "Documents", icon: FileText,   color: "#10b981" },
];

// ── Tag Badge ──────────────────────────────────────────────────────────────────

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}25`, borderRadius: 10, padding: "2px 7px" }}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ACCENT, lineHeight: 1, display: "flex" }} aria-label={`Remove tag ${tag}`}>
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ── File Card ──────────────────────────────────────────────────────────────────

function FileCard({ file, selected, onToggle, onTagAdd, onTagRemove, saving }: {
  file: DriveFile; selected: boolean; onToggle: () => void;
  onTagAdd: (tag: string) => void; onTagRemove: (tag: string) => void; saving?: boolean;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const Icon = fileIcon(file.mimeType);
  const color = fileColor(file.mimeType);
  const tags = file.tags ?? [];

  // ── Add to Library ──
  const [showLibForm, setShowLibForm] = useState(false);
  const [libName, setLibName] = useState("");
  const [libTags, setLibTags] = useState("");
  const [libSaving, setLibSaving] = useState(false);
  const [libDone, setLibDone] = useState(false);

  const handleAddTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) onTagAdd(t);
    setTagInput(""); setShowTagInput(false);
  };

  const isImage = file.mimeType.startsWith("image/") || file.mimeType.includes("photoshop") || file.mimeType === "application/psd";
  const isVideo = file.mimeType.startsWith("video/") || file.mimeType.includes("mp4") || file.mimeType.includes("video");

  const addToLibrary = async () => {
    setLibSaving(true);
    try {
      const assetType = isVideo ? "video" : "image";
      const name = libName.trim() || file.name.replace(/\.[^.]+$/, "");
      const tagList = libTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch(`${BOT_URL}/admin/landing-pages/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: assetType,
          name,
          tags: tagList,
          url: `${BOT_URL}/admin/drive/thumbnail/${file.id}`,
          source: "drive",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLibDone(true);
      setShowLibForm(false);
      setTimeout(() => setLibDone(false), 3000);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setLibSaving(false);
    }
  };

  return (
    <div style={{ ...CARD, padding: 0, border: selected ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.07)", background: selected ? `${ACCENT}06` : "rgba(255,255,255,0.03)", transition: "all 0.12s", overflow: "hidden" }}>

      {/* ── Media Preview ── */}
      {(isImage || isVideo) && (
        <a href={file.webViewLink ?? "#"} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", position: "relative", width: "100%", height: 160, overflow: "hidden",
            background: "rgba(0,0,0,0.5)", textDecoration: "none" }}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${BOT_URL}/admin/drive/thumbnail/${file.id}`}
              alt={file.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                transition: "transform 0.25s", filter: "brightness(0.92)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(135deg, rgba(245,158,11,0.07), rgba(0,0,0,0.55))" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(245,158,11,0.15)",
                border: "1.5px solid rgba(245,158,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <polygon points="4,2 14,8 4,14" fill="#f59e0b" />
                </svg>
              </div>
              <span style={{ fontSize: 9, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.08em" }}>Video</span>
            </div>
          )}
          {/* File type badge */}
          <span style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)", borderRadius: 5, padding: "2px 6px", border: `1px solid ${color}30`,
            fontSize: 9, color, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {(() => {
              const raw = file.mimeType.split("/").pop() ?? "";
              if (raw.includes("photoshop") || raw.includes("psd")) return "PSD";
              return raw.slice(0, 6).toUpperCase();
            })()}
          </span>
          {file.size && (
            <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)", borderRadius: 5, padding: "2px 6px", fontSize: 9, color: "#64748b" }}>
              {(Number(file.size) / 1_000_000).toFixed(1)} MB
            </span>
          )}
        </a>
      )}

      {/* ── Card body ── */}
      <div style={{ padding: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <button onClick={onToggle} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected ? ACCENT : "rgba(255,255,255,0.15)"}`, background: selected ? ACCENT : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }} aria-label={selected ? "Deselect file" : "Select file"}>
          {selected && <CheckSquare size={10} color="#0f172a" />}
        </button>
        {!isImage && !isVideo && (
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={14} color={color} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={file.webViewLink ?? "#"} target="_blank" rel="noopener noreferrer"
            title={file.name}
            style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}
          </a>
          {!isImage && !isVideo && (
          <p style={{ fontSize: 9, color: "#475569", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {file.mimeType.split("/").pop()?.toUpperCase().slice(0, 12)}
            {file.size && ` · ${(Number(file.size) / 1_000_000).toFixed(1)} MB`}
          </p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", minHeight: 20, alignItems: "center" }}>
        {tags.map(tag => <TagBadge key={tag} tag={tag} onRemove={() => onTagRemove(tag)} />)}
        {showTagInput ? (
          <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddTag(tagInput); if (e.key === "Escape") setShowTagInput(false); }}
            onBlur={() => { if (tagInput) handleAddTag(tagInput); else setShowTagInput(false); }}
            placeholder="tag…"
            style={{ fontSize: 10, color: ACCENT, background: `${ACCENT}08`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "1px 6px", outline: "none", width: 70 }} />
        ) : (
          <button onClick={() => setShowTagInput(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "1px 6px", cursor: "pointer" }}>
            <Plus size={9} /> tag
          </button>
        )}
        {saving && (
          <span title="Saving…" style={{ display: "inline-flex", alignItems: "center", color: ACCENT, opacity: 0.7 }}>
            <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} />
          </span>
        )}
      </div>

      {/* Preset tag suggestions (only if untagged) */}
      {tags.length === 0 && (
        <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {PRESET_TAGS.slice(0, 4).map(tag => (
            <button key={tag} onClick={() => onTagAdd(tag)}
              style={{ fontSize: 9, color: "#64748b", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 5px", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget.style.color = ACCENT); (e.currentTarget.style.borderColor = `${ACCENT}30`); }}
              onMouseLeave={e => { (e.currentTarget.style.color = "#64748b"); (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"); }}>
              +{tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Add to Library button ── */}
      {(isImage || isVideo) && (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.6rem" }}>
          {!showLibForm ? (
            <button
              onClick={() => { setShowLibForm(true); setLibName(file.name.replace(/\.[^.]+$/, "")); setLibTags(tags.join(", ")); }}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700,
                color: libDone ? "#34d399" : "#818cf8",
                background: libDone ? "rgba(52,211,153,0.08)" : "rgba(129,140,248,0.08)",
                border: `1px solid ${libDone ? "rgba(52,211,153,0.2)" : "rgba(129,140,248,0.2)"}`,
                borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s" }}>
              {libDone ? <Check size={11} /> : <BookmarkPlus size={11} />}
              {libDone ? "Added to Library ✓" : "+ Content Library"}
            </button>
          ) : (
            <div style={{ background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.15)",
              borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: "#818cf8", margin: 0, textTransform: "uppercase",
                letterSpacing: "0.08em" }}>Add to Content Library</p>
              <div>
                <label style={{ fontSize: 9, color: "#475569", display: "block", marginBottom: 2 }}>Name</label>
                <input value={libName} onChange={e => setLibName(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 6, color: "#e2e8f0", padding: "4px 7px", fontSize: 11, fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: "#475569", display: "block", marginBottom: 2 }}>Tags (comma-separated)</label>
                <input value={libTags} onChange={e => setLibTags(e.target.value)}
                  placeholder="hero, lifestyle, product"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 6, color: "#e2e8f0", padding: "4px 7px", fontSize: 11, fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={addToLibrary} disabled={libSaving}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700,
                    color: "#818cf8", background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.3)",
                    borderRadius: 6, padding: "4px 12px", cursor: libSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {libSaving ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <BookmarkPlus size={10} />}
                  {libSaving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setShowLibForm(false)}
                  style={{ fontSize: 10, color: "#475569", background: "none", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// ── Batch Toolbar ──────────────────────────────────────────────────────────────

function BatchToolbar({ selectedCount, onBatchTag, onClearSelection }: {
  selectedCount: number; onBatchTag: (tag: string) => void; onClearSelection: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (selectedCount === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)", border: `1px solid ${ACCENT}30`, borderRadius: 14, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{selectedCount} selected</span>
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen(!open)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "0.4rem 0.75rem", color: ACCENT, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          <Tag size={12} /> Batch Tag <ChevronDown size={10} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              style={{ position: "absolute", bottom: "calc(100% + 0.5rem)", left: 0, background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.3rem", width: 240 }}>
              {PRESET_TAGS.map(tag => (
                <button key={tag} onClick={() => { onBatchTag(tag); setOpen(false); }}
                  style={{ fontSize: 10, color: ACCENT, background: `${ACCENT}0d`, border: `1px solid ${ACCENT}22`, borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}>
                  {tag}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button onClick={onClearSelection}
        style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
        <X size={11} /> Clear
      </button>
    </motion.div>
  );
}

// ── Index Status Banner ────────────────────────────────────────────────────────

function IndexBanner({ status, total, foldersScanned, onReindex }: {
  status: string; total: number; foldersScanned: number; onReindex: () => void;
}) {
  if (status === "ready" || status === "idle") return null;
  if (status === "indexing") return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
      <Loader2 size={14} color={ACCENT} style={{ animation: "spin 1.2s linear infinite", flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT, margin: 0 }}>Scanning Drive…</p>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
          Found {total.toLocaleString()} files across {foldersScanned.toLocaleString()} folders so far. Showing results as they come in.
        </p>
      </div>
    </div>
  );
  if (status === "error") return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
      <AlertCircle size={14} color="#f43f5e" />
      <p style={{ fontSize: 12, color: "#f43f5e", margin: 0, flex: 1 }}>Drive index failed.</p>
      <button onClick={onReindex} style={{ fontSize: 11, color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "0.3rem 0.7rem", cursor: "pointer", fontWeight: 700 }}>Retry</button>
    </div>
  );
  return null;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AssetTaggerPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState("");
  const [sort, setSort] = useState("name");

  const [pageData, setPageData] = useState<PageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Tag mutations — optimistic local state, auto-saved immediately
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Polling interval when indexing is in progress
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch page from server ──
  const fetchPage = useCallback(async (p: number, q: string, mime: string, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        perPage: String(PER_PAGE),
        ...(q ? { q } : {}),
        ...(mime ? { mimeType: mime } : {}),
        sort: s,
      });
      const res = await fetch(`${BOT_URL}/admin/drive/files?${params}`);
      if (res.ok) {
        const d: PageResponse = await res.json();
        setPageData(d);
        // Auto-poll while indexing
        if (d.indexStatus === "indexing") {
          if (!pollRef.current) {
            pollRef.current = setInterval(() => fetchPage(p, q, mime, s), 5000);
          }
        } else {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }
    } catch (err: any) {
      console.error("Asset Tagger fetch:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, debouncedSearch, mimeFilter, sort);
  }, [page, debouncedSearch, mimeFilter, sort, fetchPage]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Trigger reindex ──
  const triggerReindex = async () => {
    await fetch(`${BOT_URL}/admin/drive/index?force=true`, { method: "POST" });
    setTimeout(() => fetchPage(1, debouncedSearch, mimeFilter, sort), 500);
    setPage(1);
  };

  // ── Enrich files with local tag mutations ──
  const files: DriveFile[] = (pageData?.files ?? []).map(f => ({
    ...f, tags: tagMap[f.id] ?? f.tags ?? [],
  }));

  const addTag = async (fileId: string, tag: string) => {
    const file = pageData?.files.find(f => f.id === fileId);
    const current = tagMap[fileId] ?? file?.tags ?? [];
    if (current.includes(tag)) return;
    const newTags = [...current, tag];
    setTagMap(prev => ({ ...prev, [fileId]: newTags }));
    setSavingIds(prev => new Set([...prev, fileId]));
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/tags/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName: file?.name ?? fileId, tags: newTags }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setPageData(prev => prev ? { ...prev, files: prev.files.map(f => f.id === fileId ? { ...f, tags: newTags } : f) } : prev);
      setTagMap(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    } catch (err: any) {
      console.error("[asset-tagger] addTag failed:", err.message);
      setTagMap(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(fileId); return s; });
    }
  };

  const removeTag = async (fileId: string, tag: string) => {
    const file = pageData?.files.find(f => f.id === fileId);
    const current = tagMap[fileId] ?? file?.tags ?? [];
    const newTags = current.filter(t => t !== tag);
    setTagMap(prev => ({ ...prev, [fileId]: newTags }));
    setSavingIds(prev => new Set([...prev, fileId]));
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/tags/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName: file?.name ?? fileId, tags: newTags }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setPageData(prev => prev ? { ...prev, files: prev.files.map(f => f.id === fileId ? { ...f, tags: newTags } : f) } : prev);
      setTagMap(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    } catch (err: any) {
      console.error("[asset-tagger] removeTag failed:", err.message);
      setTagMap(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(fileId); return s; });
    }
  };

  const batchTag = async (tag: string) => {
    const updates: Record<string, string[]> = {};
    selectedIds.forEach(id => {
      const current = tagMap[id] ?? pageData?.files.find(f => f.id === id)?.tags ?? [];
      if (!current.includes(tag)) updates[id] = [...current, tag];
    });
    if (Object.keys(updates).length === 0) return;
    setTagMap(prev => ({ ...prev, ...updates }));
    const filesToSave = Object.entries(updates).map(([id, tags]) => ({
      id, name: pageData?.files.find(f => f.id === id)?.name ?? id, tags,
    }));
    try {
      const res = await fetch(`${BOT_URL}/admin/drive/tags/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesToSave }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Batch save failed");
      setPageData(prev => prev ? { ...prev, files: prev.files.map(f => updates[f.id] ? { ...f, tags: updates[f.id] } : f) } : prev);
      setTagMap(prev => { const n = { ...prev }; Object.keys(updates).forEach(id => delete n[id]); return n; });
    } catch (err: any) {
      console.error("[asset-tagger] batchTag failed:", err.message);
      setTagMap(prev => { const n = { ...prev }; Object.keys(updates).forEach(id => delete n[id]); return n; });
      alert(`Batch tag failed: ${err.message}`);
    }
  };
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });




  const untaggedOnPage = files.filter(f => (f.tags ?? []).length === 0).length;
  const indexStatus = pageData?.indexStatus ?? "idle";
  const indexTotal  = pageData?.indexTotal ?? 0;

  return (
    <div>
      {/* Index status banner */}
      <IndexBanner
        status={indexStatus} total={indexTotal}
        foldersScanned={pageData?.foldersScanned ?? 0}
        onReindex={triggerReindex}
      />

      {/* Stats strip */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", flex: 1 }}>
          {[
            { label: "Total in Drive", value: indexStatus === "indexing" && indexTotal === 0 ? "Scanning…" : indexTotal.toLocaleString(), color: ACCENT },
            { label: "This view", value: (pageData?.totalFiltered ?? 0).toLocaleString(), color: "#64748b" },
            { label: "Untagged on page", value: untaggedOnPage.toLocaleString(), color: untaggedOnPage > 0 ? "#f43f5e" : "#10b981" },
            { label: "Selected", value: selectedIds.size.toLocaleString(), color: "#a78bfa" },
            { label: "Folders scanned", value: (pageData?.foldersScanned ?? 0).toLocaleString(), color: "#64748b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${color}0d`, border: `1px solid ${color}20`, borderRadius: 20, padding: "0.2rem 0.65rem" }}>
              <span style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>

          <button onClick={triggerReindex} title="Re-scan Drive"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
            <Database size={12} /> Re-scan
          </button>
        </div>
      </div>

      {/* Controls: search + filter + sort */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={13} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or tag — use commas for multiple (e.g. woman, outside, 2025)"
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: "0.5rem", paddingBottom: "0.5rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${search ? ACCENT + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }} />
          {search && <p style={{ margin: "0.25rem 0 0", fontSize: 9, color: "#475569" }}>Tip: separate multiple tags with commas — e.g. <em style={{ color: ACCENT }}>woman, outside, 2025</em></p>}
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {MIME_FILTERS.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => { setMimeFilter(id); setPage(1); }}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: mimeFilter === id ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${mimeFilter === id ? color + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.4rem 0.65rem", color: mimeFilter === id ? color : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#94a3b8", fontSize: 11, cursor: "pointer", outline: "none" }}>
          <option value="name">Sort: Name</option>
          <option value="date">Sort: Date</option>
        </select>
        <button onClick={() => fetchPage(page, debouncedSearch, mimeFilter, sort)}
          style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", cursor: "pointer" }}
          aria-label="Refresh">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* Pagination header */}
      {pageData && pageData.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0.5rem 0" }}>
          <span style={{ fontSize: 11, color: "#475569" }}>
            Page {pageData.page} of {pageData.totalPages.toLocaleString()}
            {" · "}{pageData.totalFiltered.toLocaleString()} {debouncedSearch ? "results" : "files"} total
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!pageData.hasPrevPage || loading}
              style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: pageData.hasPrevPage ? "rgba(255,255,255,0.05)" : "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.35rem 0.7rem", color: pageData.hasPrevPage ? "#94a3b8" : "#334155", fontSize: 11, cursor: pageData.hasPrevPage ? "pointer" : "default" }}>
              <ChevronLeft size={12} /> Prev
            </button>

            {/* Page number buttons — show up to 7 around current */}
            {Array.from({ length: Math.min(pageData.totalPages, 7) }, (_, i) => {
              const half = 3;
              let start = Math.max(1, pageData.page - half);
              const end = Math.min(pageData.totalPages, start + 6);
              start = Math.max(1, end - 6);
              return start + i;
            }).map(pNum => (
              <button key={pNum} onClick={() => setPage(pNum)}
                style={{ minWidth: 32, background: pNum === page ? `${ACCENT}18` : "rgba(255,255,255,0.04)", border: `1px solid ${pNum === page ? ACCENT + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.35rem 0.5rem", color: pNum === page ? ACCENT : "#64748b", fontSize: 11, cursor: "pointer", fontWeight: pNum === page ? 800 : 400 }}>
                {pNum}
              </button>
            ))}

            <button onClick={() => setPage(p => Math.min(pageData.totalPages, p + 1))} disabled={!pageData.hasNextPage || loading}
              style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: pageData.hasNextPage ? "rgba(255,255,255,0.05)" : "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.35rem 0.7rem", color: pageData.hasNextPage ? "#94a3b8" : "#334155", fontSize: 11, cursor: pageData.hasNextPage ? "pointer" : "default" }}>
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* File grid */}
      {loading && files.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {[...Array(12)].map((_, i) => <div key={i} style={{ height: 110, background: "rgba(255,255,255,0.03)", borderRadius: 12, animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : files.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
          <FolderOpen size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>
            {indexStatus === "idle"
              ? "Drive not yet scanned — click Re-scan to start."
              : debouncedSearch
              ? (() => { const terms = debouncedSearch.split(/[\s,]+/).filter(Boolean); return terms.length > 1 ? `No files match all of: ${terms.map(t => `"${t}"`).join(" + ")}.` : `No files match "${debouncedSearch}".`; })()
              : "No files found in this view."}
          </p>
        </div>
      ) : (
        <motion.div
          key={`${page}-${debouncedSearch}-${mimeFilter}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {files.map(file => (
            <FileCard key={file.id} file={file} selected={selectedIds.has(file.id)}
              onToggle={() => toggleSelect(file.id)}
              onTagAdd={tag => addTag(file.id, tag)}
              onTagRemove={tag => removeTag(file.id, tag)}
              saving={savingIds.has(file.id)} />
          ))}
        </motion.div>
      )}

      {/* Bottom pagination */}
      {pageData && pageData.totalPages > 1 && !loading && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }} disabled={!pageData.hasPrevPage}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: pageData.hasPrevPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: pageData.hasPrevPage ? "pointer" : "default" }}>
            <ChevronLeft size={13} /> Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#475569" }}>
            {pageData.page} / {pageData.totalPages.toLocaleString()}
          </span>
          <button onClick={() => { setPage(p => Math.min(pageData.totalPages, p + 1)); window.scrollTo(0, 0); }} disabled={!pageData.hasNextPage}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: pageData.hasNextPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: pageData.hasNextPage ? "pointer" : "default" }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BatchToolbar selectedCount={selectedIds.size} onBatchTag={batchTag} onClearSelection={() => setSelectedIds(new Set())} />
        )}
      </AnimatePresence>
    </div>
  );
}
