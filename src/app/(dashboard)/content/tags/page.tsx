"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Plus, Play, X, Loader2, RefreshCw } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
  padding: "1.25rem 1.5rem",
};

interface TagDef {
  tag: string;
  label?: string;
  file_count: number;
  is_active: boolean;
}

// ── Tag Chip ───────────────────────────────────────────────────────────────────

function TagChip({ displayName, count, onDelete, onApply, applying }: {
  displayName: string; count: number;
  onDelete: () => void; onApply: () => void; applying: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        background: hovered ? `${ACCENT}15` : `${ACCENT}08`,
        border: `1px solid ${hovered ? ACCENT + "35" : ACCENT + "18"}`,
        borderRadius: 99, padding: "0.35rem 0.7rem 0.35rem 0.85rem",
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{displayName}</span>
      {count > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: `${ACCENT}18`, borderRadius: 99, padding: "1px 7px" }}>
          {count.toLocaleString()}
        </span>
      )}
      <div style={{ display: "flex", gap: "0.15rem", marginLeft: "0.1rem" }}>
        <button
          onClick={onApply}
          disabled={applying}
          title="Retroactively apply this tag to all files whose name contains it"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px 3px", cursor: applying ? "wait" : "pointer", color: hovered ? ACCENT : "#475569", transition: "color 0.12s" }}
        >
          {applying ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={10} />}
        </button>
        <button
          onClick={onDelete}
          title="Remove tag"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: "2px 3px", cursor: "pointer", color: hovered ? "#f43f5e" : "#475569", transition: "color 0.12s" }}
        >
          <X size={10} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function TagLibraryPage() {
  const [tags,     setTags]     = useState<TagDef[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [applying, setApplying] = useState<Set<string>>(new Set());
  const [addInput, setAddInput] = useState("");
  const [adding,   setAdding]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`${BOT_URL}/admin/tags`);
      if (res.ok) {
        const d = await res.json();
        setTags((d.tags ?? []).filter((t: TagDef) => t.is_active));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    const raw = addInput.trim();
    if (!raw) return;
    const slug = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (tags.some(t => t.tag === slug)) { setAddInput(""); return; }
    setAdding(true);
    try {
      const res = await window.fetch(`${BOT_URL}/admin/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: slug, label: raw }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setAddInput("");
      await fetch();
      inputRef.current?.focus();
    } catch (err: any) {
      alert(`Failed to add tag: ${err.message}`);
    } finally { setAdding(false); }
  };

  const handleDelete = async (tag: string) => {
    if (!confirm(`Remove tag "${tag}"?`)) return;
    await window.fetch(`${BOT_URL}/admin/tags/${tag}`, { method: "DELETE" });
    setTags(prev => prev.filter(t => t.tag !== tag));
  };

  const handleApply = async (tag: string) => {
    setApplying(s => new Set([...s, tag]));
    try {
      await window.fetch(`${BOT_URL}/admin/tags/${tag}/retroactive`, { method: "POST" });
      setTimeout(async () => {
        await fetch();
        setApplying(s => { const n = new Set(s); n.delete(tag); return n; });
      }, 4000);
    } catch (err: any) {
      alert(`Apply failed: ${err.message}`);
      setApplying(s => { const n = new Set(s); n.delete(tag); return n; });
    }
  };

  const sorted = [...tags].sort((a, b) => b.file_count - a.file_count);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.15rem", margin: 0 }}>Tag Library</h2>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            {sorted.length} tags — used by agents and humans to find content
          </p>
        </div>
        <button onClick={fetch}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.45rem 0.75rem", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      <div style={CARD}>
        {/* Add tag input */}
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Tag size={12} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              ref={inputRef}
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              placeholder='Add tag — e.g. "Green", "Stability Bar", "Outside", "HIIT"'
              style={{
                width: "100%", paddingLeft: 32, paddingRight: 12,
                paddingTop: "0.6rem", paddingBottom: "0.6rem",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${addInput ? ACCENT + "40" : "rgba(255,255,255,0.09)"}`,
                borderRadius: 10, color: "#e2e8f0", fontSize: 13, outline: "none",
                boxSizing: "border-box", transition: "border-color 0.15s",
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!addInput.trim() || adding}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: addInput.trim() ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${addInput.trim() ? ACCENT + "30" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, padding: "0 1.25rem",
              color: addInput.trim() ? ACCENT : "#475569",
              fontSize: 12, fontWeight: 700,
              cursor: addInput.trim() ? "pointer" : "default",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {adding ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={12} />}
            Add Tag
          </button>
        </div>

        {/* Chips */}
        {loading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[...Array(14)].map((_, i) => (
              <div key={i} style={{ height: 34, width: 70 + (i % 4) * 28, background: "rgba(255,255,255,0.04)", borderRadius: 99, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0", opacity: 0.5 }}>
            <Tag size={28} color="#475569" style={{ display: "block", margin: "0 auto 0.75rem" }} />
            <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>No tags yet. Type a tag above and press Enter to add one.</p>
          </div>
        ) : (
          <>
            <motion.div layout style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
              <AnimatePresence>
                {sorted.map(t => (
                  <TagChip
                    key={t.tag}
                    displayName={t.label ?? t.tag}
                    count={t.file_count}
                    onDelete={() => handleDelete(t.tag)}
                    onApply={() => handleApply(t.tag)}
                    applying={applying.has(t.tag)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
            <p style={{ fontSize: 10, color: "#334155", marginTop: "1.25rem", marginBottom: 0 }}>
              ▷ applies this tag retroactively to all Drive files whose filename contains the tag · ✕ removes from library
            </p>
          </>
        )}
      </div>
    </div>
  );
}
