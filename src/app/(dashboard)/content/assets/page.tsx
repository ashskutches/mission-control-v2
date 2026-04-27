"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, FolderOpen, Search, Filter, RefreshCw, CheckSquare,
  Image as ImageIcon, Film, FileText, Package, X, Plus,
  Save, ArrowLeft, ChevronDown,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#38bdf8";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  tags?: string[];
  category?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MIME_ICON: Record<string, React.ElementType> = {};
function fileIcon(mimeType: string): React.ElementType {
  if (mimeType.startsWith("video/") || mimeType.includes("mp4")) return Film;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("text/") || mimeType.includes("document")) return FileText;
  return Package;
}
function fileColor(mimeType: string): string {
  if (mimeType.startsWith("video/") || mimeType.includes("mp4")) return "#f59e0b";
  if (mimeType.startsWith("image/")) return "#38bdf8";
  if (mimeType.startsWith("text/") || mimeType.includes("document")) return "#10b981";
  return "#94a3b8";
}

const PRESET_TAGS = [
  "product", "lifestyle", "workout", "testimonial", "unboxing",
  "rebounder", "customer", "ad-creative", "organic", "email",
  "hero", "upsell", "seasonal", "transformation",
];

const CATEGORIES = [
  { id: "video", label: "Videos", icon: Film, color: "#f59e0b" },
  { id: "image", label: "Images", icon: ImageIcon, color: "#38bdf8" },
  { id: "document", label: "Documents", icon: FileText, color: "#10b981" },
  { id: "other", label: "Other", icon: Package, color: "#94a3b8" },
];

// ── Tag Badge ─────────────────────────────────────────────────────────────────

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, color: ACCENT,
      background: `${ACCENT}12`, border: `1px solid ${ACCENT}25`,
      borderRadius: 10, padding: "2px 7px",
    }}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ACCENT, lineHeight: 1, display: "flex" }}>
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ── File Card ─────────────────────────────────────────────────────────────────

function FileCard({ file, selected, onToggle, onTagAdd, onTagRemove }: {
  file: DriveFile;
  selected: boolean;
  onToggle: () => void;
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const Icon = fileIcon(file.mimeType);
  const color = fileColor(file.mimeType);

  const handleAddTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !file.tags?.includes(t)) {
      onTagAdd(t);
    }
    setTagInput("");
    setShowTagInput(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        ...CARD,
        padding: "0.875rem",
        border: selected ? `1px solid ${ACCENT}40` : "1px solid rgba(255,255,255,0.07)",
        background: selected ? `${ACCENT}06` : "rgba(255,255,255,0.03)",
        transition: "all 0.12s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.6rem" }}>
        {/* Select checkbox */}
        <button
          onClick={onToggle}
          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected ? ACCENT : "rgba(255,255,255,0.15)"}`, background: selected ? ACCENT : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}
          aria-label={selected ? "Deselect file" : "Select file"}
        >
          {selected && <CheckSquare size={10} color="#0f172a" />}
        </button>

        {/* Icon */}
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={color} />
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={file.webViewLink ?? "#"}
            target="_blank" rel="noopener noreferrer"
            style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 12, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {file.name}
          </a>
          <p style={{ fontSize: 9, color: "#475569", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {file.mimeType.split("/").pop()?.toUpperCase()} {file.size && `· ${(Number(file.size) / 1_000_000).toFixed(1)} MB`}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", minHeight: 20 }}>
        {(file.tags ?? []).map(tag => (
          <TagBadge key={tag} tag={tag} onRemove={() => onTagRemove(tag)} />
        ))}

        {/* Add tag button */}
        {showTagInput ? (
          <input
            autoFocus
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleAddTag(tagInput);
              if (e.key === "Escape") setShowTagInput(false);
            }}
            onBlur={() => { if (tagInput) handleAddTag(tagInput); else setShowTagInput(false); }}
            placeholder="tag name…"
            style={{ fontSize: 10, color: ACCENT, background: `${ACCENT}08`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "1px 6px", outline: "none", width: 80 }}
          />
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "1px 6px", cursor: "pointer" }}
          >
            <Plus size={9} /> tag
          </button>
        )}
      </div>

      {/* Preset tag suggestions */}
      <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
        {PRESET_TAGS.filter(t => !(file.tags ?? []).includes(t)).slice(0, 5).map(tag => (
          <button key={tag} onClick={() => onTagAdd(tag)}
            style={{ fontSize: 9, color: "#64748b", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 5px", cursor: "pointer", transition: "all 0.1s" }}
            onMouseEnter={e => { (e.currentTarget.style.color = ACCENT); (e.currentTarget.style.borderColor = `${ACCENT}30`); }}
            onMouseLeave={e => { (e.currentTarget.style.color = "#64748b"); (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"); }}
          >
            +{tag}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Batch Toolbar ─────────────────────────────────────────────────────────────

function BatchToolbar({ selectedCount, onBatchTag, onClearSelection }: {
  selectedCount: number;
  onBatchTag: (tag: string) => void;
  onClearSelection: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      style={{
        position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)",
        background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)",
        border: `1px solid ${ACCENT}30`, borderRadius: 14, padding: "0.75rem 1.25rem",
        display: "flex", alignItems: "center", gap: "1rem",
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${ACCENT}10`,
        zIndex: 100,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{selectedCount} selected</span>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "0.4rem 0.75rem", color: ACCENT, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
        >
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

      <button
        onClick={onClearSelection}
        style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.4rem 0.65rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}
      >
        <X size={11} /> Clear
      </button>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetTaggerPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filtered, setFiltered] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // local tag store (in-memory for now, persisted to Drive metadata via backend in future)
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({});

  // Merge drive files with local tag state
  const enriched: DriveFile[] = files.map(f => ({ ...f, tags: tagMap[f.id] ?? f.tags ?? [] }));

  const applyFilters = useCallback(() => {
    let out = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(f => f.name.toLowerCase().includes(q) || (f.tags ?? []).some(t => t.includes(q)));
    }
    if (categoryFilter) {
      out = out.filter(f => {
        if (categoryFilter === "video") return f.mimeType.startsWith("video/") || f.mimeType.includes("mp4");
        if (categoryFilter === "image") return f.mimeType.startsWith("image/");
        if (categoryFilter === "document") return f.mimeType.startsWith("text/") || f.mimeType.includes("document");
        return true;
      });
    }
    setFiltered(out);
  }, [enriched, search, categoryFilter]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Use the existing Google Drive integration
      const res = await fetch(`${BOT_URL}/admin/library/files?limit=50`);
      if (res.ok) {
        const d = await res.json();
        const driveFiles: DriveFile[] = (d.files ?? d.data ?? []).map((f: any) => ({
          id: f.id, name: f.name, mimeType: f.mimeType ?? "application/octet-stream",
          modifiedTime: f.modifiedTime, size: f.size, webViewLink: f.webViewLink,
          thumbnailLink: f.thumbnailLink, tags: f.tags ?? [],
        }));
        setFiles(driveFiles);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFiles(); }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const addTag = (fileId: string, tag: string) => {
    setTagMap(prev => {
      const current = prev[fileId] ?? files.find(f => f.id === fileId)?.tags ?? [];
      if (current.includes(tag)) return prev;
      return { ...prev, [fileId]: [...current, tag] };
    });
  };

  const removeTag = (fileId: string, tag: string) => {
    setTagMap(prev => {
      const current = prev[fileId] ?? files.find(f => f.id === fileId)?.tags ?? [];
      return { ...prev, [fileId]: current.filter(t => t !== tag) };
    });
  };

  const batchTag = (tag: string) => {
    setTagMap(prev => {
      const next = { ...prev };
      selectedIds.forEach(id => {
        const current = prev[id] ?? files.find(f => f.id === id)?.tags ?? [];
        if (!current.includes(tag)) next[id] = [...current, tag];
      });
      return next;
    });
  };

  const saveTagsMock = async () => {
    setSaveState("saving");
    await new Promise(r => setTimeout(r, 800));
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  };

  const untaggedCount = enriched.filter(f => (f.tags ?? []).length === 0).length;
  const hasUnsavedTags = Object.keys(tagMap).length > 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <a href="/content" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#64748b", textDecoration: "none", fontWeight: 700 }}>
          <ArrowLeft size={11} /> Content Hub
        </a>
        <span style={{ fontSize: 11, color: "#334155" }}>/</span>
        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>Asset Tagger</span>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={18} color={ACCENT} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Asset Tagger</h1>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Tag and categorize files from Google Drive — makes them searchable by agents and humans</p>
          </div>
          {hasUnsavedTags && (
            <button onClick={saveTagsMock} disabled={saveState === "saving"}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: saveState === "saved" ? "#10b98118" : `${ACCENT}15`, border: `1px solid ${saveState === "saved" ? "#10b981" : ACCENT}30`, borderRadius: 10, padding: "0.5rem 1rem", color: saveState === "saved" ? "#10b981" : ACCENT, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {saveState === "saving" ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
              {saveState === "saved" ? "Saved!" : saveState === "saving" ? "Saving…" : "Save Tags"}
            </button>
          )}
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { label: "Total files", value: enriched.length, color: ACCENT },
            { label: "Untagged", value: untaggedCount, color: untaggedCount > 0 ? "#f43f5e" : "#10b981" },
            { label: "Selected", value: selectedIds.size, color: "#a78bfa" },
            { label: "Tags modified", value: Object.keys(tagMap).length, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: `${color}0d`, border: `1px solid ${color}20`, borderRadius: 20, padding: "0.25rem 0.7rem" }}>
              <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={13} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or tag…"
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: "0.5rem", paddingBottom: "0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {CATEGORIES.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => setCategoryFilter(categoryFilter === id ? null : id)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: categoryFilter === id ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${categoryFilter === id ? color + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.4rem 0.65rem", color: categoryFilter === id ? color : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <button onClick={fetchFiles} className="button is-ghost is-small" style={{ color: "#64748b" }} aria-label="Refresh files">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* File grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 120, background: "rgba(255,255,255,0.03)", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "3rem", opacity: 0.5 }}>
          <FolderOpen size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>
            {files.length === 0
              ? "No files loaded — make sure Google Drive is connected in Integrations."
              : "No files match your filters."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {filtered.map((file, i) => (
            <motion.div key={file.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <FileCard
                file={file}
                selected={selectedIds.has(file.id)}
                onToggle={() => toggleSelect(file.id)}
                onTagAdd={tag => addTag(file.id, tag)}
                onTagRemove={tag => removeTag(file.id, tag)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Batch toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BatchToolbar
            selectedCount={selectedIds.size}
            onBatchTag={batchTag}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
