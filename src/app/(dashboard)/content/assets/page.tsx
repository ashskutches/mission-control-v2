"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, FolderOpen, Search, RefreshCw, CheckSquare,
  Image as ImageIcon, Film, FileText, Package, X, Plus,
  ChevronDown, ChevronLeft, ChevronRight, Database,
  AlertCircle, Loader2, BookmarkPlus, Check, UploadCloud,
  Bot, ExternalLink, Link2, HardDrive, Sparkles, Wand2, Eye, Copy,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#38bdf8";
const PER_PAGE = 40; // Reduced from 100 — fewer thumbnail requests on initial load

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

// ── Image Thumbnail — lazy-loaded with shimmer skeleton ───────────────────────

function ImageThumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: "rgba(0,0,0,0.3)" }}>
      {/* Shimmer skeleton shown until image loads */}
      {!loaded && !failed && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
      )}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
            transition: "opacity 0.2s, transform 0.25s",
            opacity: loaded ? 1 : 0,
            filter: "brightness(0.92)",
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        />
      )}
    </div>
  );
}

// ── Video Thumbnail ───────────────────────────────────────────────────────────
// Loads the Drive thumbnail through the auth proxy. Shows a play-button overlay
// so it’s still visually identifiable as video. Falls back to amber placeholder.

function VideoThumb({ fileId, botUrl }: { fileId: string; botUrl: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, rgba(245,158,11,0.07), rgba(0,0,0,0.55))" }}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${botUrl}/admin/drive/thumbnail/${fileId}`}
          alt="video thumbnail"
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
            filter: "brightness(0.82)" }}
          onError={() => setFailed(true)}
        />
      ) : (
        /* Fallback: no thumbnail available on Drive */
        <div style={{ width: "100%", height: "100%",
          background: "linear-gradient(135deg, rgba(245,158,11,0.07), rgba(0,0,0,0.55))" }} />
      )}
      {/* Play-button overlay — always visible */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6, pointerEvents: "none" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          border: "1.5px solid rgba(245,158,11,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.45)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <polygon points="4,2 14,8 4,14" fill="#f59e0b" />
          </svg>
        </div>
        {failed && (
          <span style={{ fontSize: 9, color: "#78716c", textTransform: "uppercase",
            letterSpacing: "0.08em" }}>No Preview</span>
        )}
      </div>
    </div>
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
            <ImageThumb src={`${BOT_URL}/admin/drive/thumbnail/${file.id}`} alt={file.name} />
          ) : (
            <VideoThumb fileId={file.id} botUrl={BOT_URL} />
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

// ── DropZone ──────────────────────────────────────────────────────────────────

interface UploadItem { name: string; status: "uploading" | "done" | "error"; error?: string; }

function DropZone({ botUrl, onUploaded }: { botUrl: string; onUploaded: () => void }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploads(prev => [
      ...prev,
      ...list.map(f => ({ name: f.name, status: "uploading" as const })),
    ]);

    const startIdx = uploads.length;
    const results = await Promise.allSettled(
      list.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${botUrl}/admin/drive/upload`, { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return file.name;
      })
    );

    setUploads(prev => {
      const updated = [...prev];
      results.forEach((r, i) => {
        const idx = startIdx + i;
        if (idx >= updated.length) return;
        if (r.status === "fulfilled") {
          updated[idx] = { name: list[i].name, status: "done" };
        } else {
          updated[idx] = { name: list[i].name, status: "error", error: (r.reason as Error).message };
        }
      });
      return updated;
    });

    const anyOk = results.some(r => r.status === "fulfilled");
    if (anyOk) onUploaded();
    setTimeout(() => setUploads(prev => prev.filter(u => u.status !== "done")), 4000);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
  };

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <motion.div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: isDragOver ? `${ACCENT}80` : "rgba(255,255,255,0.09)",
          background: isDragOver ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
        }}
        transition={{ duration: 0.15 }}
        style={{
          border: "2px dashed rgba(255,255,255,0.09)",
          borderRadius: 14,
          padding: "1.5rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <motion.div
          animate={{ scale: isDragOver ? 1.12 : 1, color: isDragOver ? ACCENT : "#475569" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <UploadCloud size={28} />
        </motion.div>
        <p style={{ fontSize: 13, fontWeight: 700, color: isDragOver ? ACCENT : "#94a3b8", margin: 0, transition: "color 0.15s" }}>
          {isDragOver ? "Drop to upload to Drive" : "Drag & drop files here"}
        </p>
        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>or click to browse — images, videos, docs up to 500 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={onInputChange}
          aria-label="Upload files to Drive"
        />
      </motion.div>

      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.35rem", overflow: "hidden" }}
          >
            {uploads.map((u, i) => (
              <motion.div
                key={`${u.name}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  background: u.status === "error" ? "rgba(244,63,94,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${u.status === "error" ? "rgba(244,63,94,0.2)" : u.status === "done" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 8, padding: "0.4rem 0.75rem",
                }}
              >
                {u.status === "uploading" && <Loader2 size={11} color={ACCENT} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />}
                {u.status === "done"      && <Check size={11} color="#10b981" style={{ flexShrink: 0 }} />}
                {u.status === "error"     && <AlertCircle size={11} color="#f43f5e" style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: 11, color: u.status === "error" ? "#f43f5e" : "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.name}
                  {u.status === "error" && ` — ${u.error}`}
                  {u.status === "done"  && " — uploaded"}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setUploads(prev => prev.filter((_, j) => j !== i)); }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#475569", display: "flex" }}
                  aria-label="Dismiss upload notification"
                >
                  <X size={10} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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

// ── Documents Panel ───────────────────────────────────────────────────────────

interface AgentDoc {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  doc_type: string;
  routine_id: string | null;
  is_public: boolean;
  last_updated_at: string | null;
  created_at: string;
}

interface DocsResponse {
  documents: AgentDoc[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function DocTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
    doc:         { label: "Doc",   color: "#10b981", Icon: FileText },
    link:        { label: "Link",  color: "#818cf8", Icon: Link2 },
    spreadsheet: { label: "Sheet", color: "#f59e0b", Icon: Database },
  };
  const { label, color, Icon } = cfg[type] ?? { label: type, color: "#64748b", Icon: Package };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, fontWeight: 800, color,
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 8, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      <Icon size={9} />{label}
    </span>
  );
}

// ── Doc Viewer Modal ──────────────────────────────────────────────────────────

function DocViewerModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<AgentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${BOT_URL}/admin/agents/documents/${docId}`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(new Error(e.error ?? `HTTP ${r.status}`))))
      .then(data => { setDoc(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [docId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = () => {
    if (!doc?.content) return;
    navigator.clipboard.writeText(doc.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        }}
      />
      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: "5vh", left: "50%", transform: "translateX(-50%)",
          width: "min(860px, 94vw)", maxHeight: "88vh",
          background: "rgba(10,14,26,0.98)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(56,189,248,0.18)",
          borderRadius: 18,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06)",
          display: "flex", flexDirection: "column",
          zIndex: 201, overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={doc?.title ?? "Document viewer"}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "0.85rem",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bot size={17} color={ACCENT} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ height: 20, width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
            ) : (
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3 }}>
                {doc?.title ?? "Untitled Document"}
              </h2>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
              {doc && <DocTypeBadge type={doc.doc_type} />}
              {doc?.agent_id && (
                <span style={{ fontSize: 10, color: "#475569" }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>agent:</span> {doc.agent_id}
                </span>
              )}
              {doc?.last_updated_at && (
                <span style={{ fontSize: 10, color: "#475569" }}>Updated {fmtDate(doc.last_updated_at)}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
            {doc?.content && (
              <button
                onClick={handleCopy}
                title="Copy content"
                aria-label="Copy document content"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 700,
                  color: copied ? "#10b981" : "#64748b",
                  background: copied ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 8, padding: "5px 10px", cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
            {doc?.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Drive (if available)"
                aria-label="Open in Google Drive"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 700, color: "#64748b",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 8, padding: "5px 10px",
                  textDecoration: "none", transition: "all 0.15s",
                }}
              >
                <ExternalLink size={12} /> Drive
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close document viewer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, cursor: "pointer", color: "#64748b",
                transition: "all 0.15s",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 16, width: `${85 - i * 8}%`, background: "rgba(255,255,255,0.05)", borderRadius: 5, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "1rem" }}>
              <AlertCircle size={15} color="#f43f5e" />
              <span style={{ fontSize: 13, color: "#f43f5e" }}>Failed to load: {error}</span>
            </div>
          )}
          {!loading && !error && doc && (
            doc.content ? (
              <pre style={{
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "'Geist Mono', 'Menlo', 'Monaco', monospace",
                fontSize: 13, lineHeight: 1.75, color: "#cbd5e1",
              }}>
                {doc.content}
              </pre>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", opacity: 0.45 }}>
                <FileText size={36} color="#475569" style={{ marginBottom: "0.75rem" }} />
                <p style={{ fontSize: 13, color: "#475569" }}>
                  This document has no stored content.
                  {doc.url && " Try opening it in Drive using the button above."}
                </p>
              </div>
            )
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DocumentsPanel() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [docType, setDocType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDocs = useCallback(async (p: number, q: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: "40" });
      if (q)    params.set("q", q);
      if (type) params.set("doc_type", type);
      const res = await fetch(`${BOT_URL}/admin/agents/documents?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(page, debouncedSearch, docType); }, [page, debouncedSearch, docType, fetchDocs]);

  const DOC_TYPE_FILTERS = [
    { id: "",            label: "All",    Icon: FolderOpen },
    { id: "doc",         label: "Docs",   Icon: FileText },
    { id: "link",        label: "Links",  Icon: Link2 },
    { id: "spreadsheet", label: "Sheets", Icon: Database },
  ];

  function fmtDate(d: string | null) {
    if (!d) return "—";
    const dt = new Date(d);
    const diff = Date.now() - dt.getTime();
    if (diff < 60_000)        return "just now";
    if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const docs = data?.documents ?? [];

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={13} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents by title or description…"
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 12,
              paddingTop: "0.5rem", paddingBottom: "0.5rem",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${search ? ACCENT + "40" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, color: "#e2e8f0", fontSize: 12, outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex", padding: 0 }}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {/* Type filter */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {DOC_TYPE_FILTERS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setDocType(id); setPage(1); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                background: docType === id ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                border: `1px solid ${docType === id ? ACCENT + "40" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8, padding: "0.4rem 0.65rem",
                color: docType === id ? ACCENT : "#64748b",
                fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
              }}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
        {/* Refresh */}
        <button
          onClick={() => fetchDocs(page, debouncedSearch, docType)}
          style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", cursor: "pointer" }}
          aria-label="Refresh documents">
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Stats strip */}
      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Total", value: data.total.toLocaleString(), color: ACCENT },
            { label: "This page", value: docs.length.toLocaleString(), color: "#64748b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${color}0d`, border: `1px solid ${color}20`, borderRadius: 20, padding: "0.2rem 0.65rem" }}>
              <span style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <AlertCircle size={14} color="#f43f5e" />
          <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && docs.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ height: 68, background: "rgba(255,255,255,0.03)", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && docs.length === 0 && !error && (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
          <Bot size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>
            {debouncedSearch ? `No documents match "${debouncedSearch}".` : "No agent documents found."}
          </p>
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <motion.div
          key={`${page}-${debouncedSearch}-${docType}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
          style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
        >
          {docs.map(doc => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                ...CARD,
                display: "flex", alignItems: "flex-start", gap: "0.85rem",
                transition: "border-color 0.12s, background 0.12s",
                cursor: "pointer",
              }}
              onClick={() => setViewingDocId(doc.id)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}25`;
                (e.currentTarget as HTMLElement).style.background = `${ACCENT}05`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }}
            >
              {/* Icon */}
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <Bot size={16} color={ACCENT} />
              </div>

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "40ch" }}>
                    {doc.title}
                  </span>
                  <DocTypeBadge type={doc.doc_type} />
                  {doc.is_public && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "2px 7px" }}>PUBLIC</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    <span style={{ color: "#64748b", fontWeight: 600 }}>agent:</span> {doc.agent_id}
                  </span>
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    {fmtDate(doc.last_updated_at ?? doc.created_at)}
                  </span>
                  {doc.routine_id && (
                    <span style={{ fontSize: 10, color: "#475569" }}>
                      <span style={{ color: "#64748b", fontWeight: 600 }}>routine:</span> {doc.routine_id}
                    </span>
                  )}
                </div>
                {doc.description && (
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0.35rem 0 0", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {doc.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={e => { e.stopPropagation(); setViewingDocId(doc.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 10, fontWeight: 700, color: ACCENT,
                  background: `${ACCENT}10`, border: `1px solid ${ACCENT}25`,
                  borderRadius: 8, padding: "5px 10px",
                  cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                  transition: "background 0.12s", fontFamily: "inherit",
                }}
                aria-label={`View ${doc.title}`}
              >
                <Eye size={11} /> View
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); }}
            disabled={!data.hasPrevPage || loading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: data.hasPrevPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: data.hasPrevPage ? "pointer" : "default" }}>
            <ChevronLeft size={13} /> Previous
          </button>
          <span style={{ fontSize: 11, color: "#475569" }}>{data.page} / {data.totalPages}</span>
          <button
            onClick={() => { setPage(p => Math.min(data.totalPages, p + 1)); }}
            disabled={!data.hasNextPage || loading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: data.hasNextPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: data.hasNextPage ? "pointer" : "default" }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Inline Document Viewer Modal */}
      {viewingDocId && (
        <DocViewerModal docId={viewingDocId} onClose={() => setViewingDocId(null)} />
      )}
    </div>
  );
}

// ── Agent Images Panel ─────────────────────────────────────────────────────────

interface GeneratedAsset {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  prompt: string;
  enhanced_prompt: string;
  image_url: string;
  size: string;
  quality: string;
  created_at: string;
}

interface LibraryResponse {
  assets: GeneratedAsset[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function AgentImagesPanel() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Debounce agent name search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchImages = useCallback(async (p: number, agentName: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: "40" });
      if (agentName) params.set("agent_name", agentName);
      const res = await fetch(`${BOT_URL}/admin/business/library?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchImages(page, debouncedSearch); }, [page, debouncedSearch, fetchImages]);

  function fmtDate(d: string) {
    const dt = new Date(d);
    const diff = Date.now() - dt.getTime();
    if (diff < 60_000)         return "just now";
    if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const assets = data?.assets ?? [];
  const PURPLE = "#a78bfa";

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        {/* Agent name search */}
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={13} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by agent name…"
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 12,
              paddingTop: "0.5rem", paddingBottom: "0.5rem",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${search ? PURPLE + "50" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, color: "#e2e8f0", fontSize: 12, outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex", padding: 0 }}
              aria-label="Clear filter">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Refresh */}
        <button
          onClick={() => fetchImages(page, debouncedSearch)}
          style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", cursor: "pointer" }}
          aria-label="Refresh agent images">
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Stats strip */}
      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Total Generated", value: data.total.toLocaleString(), color: PURPLE },
            { label: "This page",        value: assets.length.toLocaleString(), color: "#64748b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${color}0d`, border: `1px solid ${color}20`, borderRadius: 20, padding: "0.2rem 0.65rem" }}>
              <span style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <AlertCircle size={14} color="#f43f5e" />
          <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && assets.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ height: 220, background: "rgba(255,255,255,0.03)", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && assets.length === 0 && !error && (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
          <Sparkles size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>
            {debouncedSearch ? `No images from agent "${debouncedSearch}".` : "No AI-generated images yet. Images generated by agents or tasks will appear here."}
          </p>
        </div>
      )}

      {/* Image grid */}
      {assets.length > 0 && (
        <motion.div
          key={`${page}-${debouncedSearch}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}
        >
          {assets.map(asset => {
            const isExpanded = expanded === asset.id;
            return (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  ...CARD, padding: 0, overflow: "hidden",
                  border: isExpanded ? `1px solid ${PURPLE}35` : "1px solid rgba(255,255,255,0.07)",
                  background: isExpanded ? `${PURPLE}05` : "rgba(255,255,255,0.03)",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Image preview */}
                <a href={asset.image_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", position: "relative", width: "100%", height: 180, overflow: "hidden", background: "rgba(0,0,0,0.4)", textDecoration: "none" }}>
                  <ImageThumb src={asset.image_url} alt={asset.prompt.slice(0, 60)} />
                  {/* AI badge */}
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
                    borderRadius: 6, padding: "2px 7px",
                    border: `1px solid ${PURPLE}40`,
                    fontSize: 9, color: PURPLE, fontWeight: 800, letterSpacing: "0.06em",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Wand2 size={9} />AI Generated
                  </span>
                  {/* Size badge */}
                  <span style={{
                    position: "absolute", top: 6, right: 6,
                    background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
                    borderRadius: 5, padding: "2px 6px",
                    fontSize: 9, color: "#94a3b8", fontWeight: 700,
                  }}>
                    {asset.size ?? "—"}
                  </span>
                  {/* Open link overlay on hover handled by browser */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s", background: "rgba(0,0,0,0.35)" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                    <ExternalLink size={18} color="#fff" />
                  </div>
                </a>

                {/* Card body */}
                <div style={{ padding: "0.75rem" }}>
                  {/* Agent name + timestamp */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: PURPLE, background: `${PURPLE}10`, border: `1px solid ${PURPLE}25`, borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>
                      <Bot size={9} />{asset.agent_name ?? "Unknown agent"}
                    </span>
                    <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{fmtDate(asset.created_at)}</span>
                  </div>

                  {/* Prompt — collapse/expand */}
                  <p
                    onClick={() => setExpanded(isExpanded ? null : asset.id)}
                    style={{
                      fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.5,
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: isExpanded ? undefined : 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {asset.prompt}
                  </p>
                  {asset.prompt.length > 100 && (
                    <button onClick={() => setExpanded(isExpanded ? null : asset.id)}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 4, cursor: "pointer", fontSize: 10, color: PURPLE, fontWeight: 700 }}>
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!data.hasPrevPage || loading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: data.hasPrevPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: data.hasPrevPage ? "pointer" : "default" }}>
            <ChevronLeft size={13} /> Previous
          </button>
          <span style={{ fontSize: 11, color: "#475569" }}>{data.page} / {data.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={!data.hasNextPage || loading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.5rem 1rem", color: data.hasNextPage ? "#94a3b8" : "#334155", fontSize: 12, cursor: data.hasNextPage ? "pointer" : "default" }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AssetTaggerPage() {
  const [activeTab, setActiveTab] = useState<"drive" | "documents" | "agent-images">("drive");

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
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.85rem" }}>
        {([
          { id: "drive",        label: "Drive Assets",    Icon: HardDrive },
          { id: "documents",    label: "Agent Documents", Icon: Bot },
          { id: "agent-images", label: "Agent Images",    Icon: Sparkles },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              fontSize: 12, fontWeight: 700,
              color: activeTab === id ? (id === "agent-images" ? "#a78bfa" : ACCENT) : "#64748b",
              background: activeTab === id ? `${id === "agent-images" ? "#a78bfa" : ACCENT}10` : "transparent",
              border: `1px solid ${activeTab === id ? (id === "agent-images" ? "#a78bfa" : ACCENT) + "30" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 9, padding: "0.45rem 0.9rem",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {activeTab === "documents"    && <DocumentsPanel />}
      {activeTab === "agent-images" && <AgentImagesPanel />}

      {activeTab === "drive" && <div>
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
          <option value="date-newest">Sort: Date Newest</option>
          <option value="date-oldest">Sort: Date Oldest</option>
        </select>
        <button onClick={() => fetchPage(page, debouncedSearch, mimeFilter, sort)}
          style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", cursor: "pointer" }}
          aria-label="Refresh">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* Drop zone */}
      <DropZone botUrl={BOT_URL} onUploaded={() => fetchPage(1, debouncedSearch, mimeFilter, sort)} />

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
      </div>}
    </div>
  );
}
