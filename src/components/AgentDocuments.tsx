"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Trash2, Loader2, Plus, ExternalLink, Clock,
  RefreshCw, ChevronDown, ChevronUp, Link2, Upload, Search,
  File, FileJson, FileSpreadsheet, AlertCircle, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentDoc {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  doc_type: "doc" | "sheet" | "link" | string;
  routine_id: string | null;
  last_updated_at: string | null;
  created_at: string;
}

type AddMode = "upload" | "link" | "create" | null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DocTypeIcon({ doc }: { doc: AgentDoc }) {
  const ext = doc.url?.includes("sheets.google.com") ? "sheet"
    : doc.doc_type === "link" ? "link"
    : doc.title.match(/\.(csv|xlsx?)$/i) ? "sheet"
    : doc.title.match(/\.json$/i) ? "json"
    : "doc";

  if (ext === "link")  return <Link2 size={13} color="#38bdf8" />;
  if (ext === "sheet") return <FileSpreadsheet size={13} color="#22c55e" />;
  if (ext === "json")  return <FileJson size={13} color="#f59e0b" />;
  return <FileText size={13} color="#a855f7" />;
}

// ── Add Document Modal ───────────────────────────────────────────────────────

function AddDocModal({ agentId, onDone, onClose }: { agentId: string; onDone: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<"upload" | "link" | "create">("upload");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Link state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkDesc, setLinkDesc] = useState("");

  // Create state
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDriveDoc, setCreateDriveDoc] = useState(true);

  const reset = () => {
    setError(null);
    setProgress(null);
    setFile(null);
    setLinkUrl("");
    setLinkTitle("");
    setLinkDesc("");
    setCreateTitle("");
    setCreateDesc("");
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      if (mode === "upload") {
        if (!file) return setError("Please select a file.");
        setProgress("Extracting text…");
        const form = new FormData();
        form.append("file", file);
        form.append("title", file.name.replace(/\.[^.]+$/, ""));
        const r = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents/upload`, { method: "POST", body: form });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Upload failed");
      } else if (mode === "link") {
        if (!linkUrl.trim()) return setError("Please paste a URL.");
        if (!linkTitle.trim()) return setError("Please enter a title.");
        const r = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim(), description: linkDesc.trim() || undefined }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to add link");
      } else {
        if (!createTitle.trim()) return setError("Title is required.");
        const r = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: createTitle.trim(), description: createDesc.trim() || undefined, createGoogleDoc: createDriveDoc }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to create doc");
      }

      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const TABS: { id: typeof mode; label: string; icon: React.ReactNode }[] = [
    { id: "upload", label: "Upload File",   icon: <Upload size={12} /> },
    { id: "link",   label: "Link URL",      icon: <Link2 size={12} /> },
    { id: "create", label: "Create Blank",  icon: <Plus size={12} /> },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.07em", color: "#555", marginBottom: 4,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.93, y: 8, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(500px, 95vw)", background: "rgba(10,10,14,0.98)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 15, margin: 0 }}>Add to Library</p>
            <p style={{ color: "#555", fontSize: 12, margin: "2px 0 0" }}>Upload a file, paste a link, or create a blank doc</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", cursor: "pointer", padding: "5px 7px", display: "flex" }}>
            <X size={15} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: "flex", gap: 6, padding: "1rem 1.5rem 0" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setMode(tab.id); reset(); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, border: "1px solid",
                background: mode === tab.id ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.03)",
                borderColor: mode === tab.id ? "rgba(255,140,0,0.35)" : "rgba(255,255,255,0.07)",
                color: mode === tab.id ? "#ff8c00" : "#666",
                transition: "all 0.15s",
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "1rem 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Upload ── */}
          {mode === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#ff8c00" : file ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 12, padding: "1.75rem 1rem", textAlign: "center", cursor: "pointer",
                  background: dragging ? "rgba(255,140,0,0.04)" : "rgba(255,255,255,0.02)", transition: "all 0.2s",
                }}
              >
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.json,.yaml,.yml,.xml" style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <>
                    <File size={24} color="#22c55e" style={{ marginBottom: 6, display: "block", margin: "0 auto 8px" }} />
                    <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 13, margin: 0 }}>{file.name}</p>
                    <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB — click to change</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} style={{ color: "#555", marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                    <p style={{ color: "#aaa", fontWeight: 700, fontSize: 13, margin: 0 }}>Drop a file or click to browse</p>
                    <p style={{ color: "#444", fontSize: 11, marginTop: 4 }}>PDF · TXT · MD · CSV · JSON (max 10 MB)</p>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Link ── */}
          {mode === "link" && (
            <>
              <div>
                <label style={labelStyle}>URL *</label>
                <input autoFocus value={linkUrl} onChange={(e) => {
                  setLinkUrl(e.target.value);
                  // Auto-fill title from Google Doc URL pattern
                  if (e.target.value.includes("docs.google.com") && !linkTitle) setLinkTitle("Google Doc");
                  if (e.target.value.includes("notion.so") && !linkTitle) setLinkTitle("Notion Page");
                }}
                  placeholder="https://docs.google.com/… or any URL"
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="e.g. Brand Guidelines, Q1 Report…" style={inputStyle}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="What is this document?" style={inputStyle} />
              </div>
            </>
          )}

          {/* ── Create ── */}
          {mode === "create" && (
            <>
              <div>
                <label style={labelStyle}>Title *</label>
                <input autoFocus value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Reddit Strategy, Weekly Market Brief"
                  style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="What will this document track?" style={inputStyle} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={createDriveDoc} onChange={(e) => setCreateDriveDoc(e.target.checked)}
                  style={{ accentColor: "#ff8c00", width: 14, height: 14 }} />
                <span style={{ fontSize: 12, color: "#aaa" }}>Create matching Google Doc in <code style={{ color: "#f59e0b" }}>ai-agent-files/</code></span>
              </label>
            </>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                <AlertCircle size={13} color="#ef4444" />
                <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#888", cursor: "pointer", padding: "7px 16px", fontSize: 13 }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{
                background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.35)", borderRadius: 8,
                color: "#ff8c00", fontWeight: 800, cursor: saving ? "default" : "pointer",
                padding: "7px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1,
              }}>
              {saving ? (
                <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />{progress ?? "Saving…"}</>
              ) : (
                mode === "upload" ? "Upload" : mode === "link" ? "Add Link" : "Create Doc"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Full Screen Document Viewer Modal ────────────────────────────────────────

function DocViewerModal({ doc, onClose }: { doc: AgentDoc; onClose: () => void }) {
  const wordCount = doc.content ? doc.content.trim().split(/\s+/).length : 0;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1.5rem" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "min(780px, 96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#0e0e14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.9)" }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <DocTypeIcon doc={doc} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 16, margin: "0 0 2px", lineHeight: 1.3 }}>{doc.title}</p>
            {doc.description && <p style={{ color: "#666", fontSize: 12, margin: 0 }}>{doc.description}</p>}
            <p style={{ color: "#444", fontSize: 11, margin: "4px 0 0" }}>
              {fmtDate(doc.last_updated_at ?? doc.created_at)}
              {wordCount > 0 && ` · ${wordCount.toLocaleString()} words`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {doc.url && (
              <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Open in Google Docs"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 8, color: "#38bdf8", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                <ExternalLink size={11} /> Open
              </a>
            )}
            <button onClick={onClose}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", cursor: "pointer", padding: "5px 7px", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {doc.content ? (
            <p style={{ color: "#c5c5d2", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "Georgia, serif" }}>
              {doc.content}
            </p>
          ) : doc.url ? (
            <div style={{ textAlign: "center", padding: "3rem 0", opacity: 0.5 }}>
              <ExternalLink size={32} color="#38bdf8" style={{ marginBottom: 12 }} />
              <p style={{ color: "#aaa", fontWeight: 700, margin: "0 0 6px" }}>External document</p>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontSize: 13 }}>Open in browser →</a>
            </div>
          ) : (
            <p style={{ color: "#555", textAlign: "center", margin: "3rem 0" }}>No content stored for this document.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Document Card ────────────────────────────────────────────────────────────

function DocCard({ doc, agentId, onDeleted }: { doc: AgentDoc; agentId: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const hasContent = !!doc.content?.trim();
  const isLink = !!doc.url;
  const accentColor = doc.doc_type === "link" ? "#38bdf8" : hasContent ? "#a855f7" : "#555";

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm(`Remove "${doc.title}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`${BOT_URL}/admin/agents/${agentId}/documents/${doc.id}`, { method: "DELETE" });
      onDeleted();
    } finally { setDeleting(false); }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't open viewer if clicking the delete button
    if ((e.target as HTMLElement).closest("button[data-role='delete']")) return;
    if (isLink && doc.url) { window.open(doc.url, "_blank"); return; }
    if (hasContent) setViewerOpen(true);
  };

  const isClickable = isLink || hasContent;

  return (
    <>
      <div
        onClick={isClickable ? handleClick : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
          borderLeft: `3px solid ${accentColor}55`, borderRadius: 10, overflow: "hidden",
          transition: "background 0.15s",
          cursor: isClickable ? "pointer" : "default",
        }}
        onMouseEnter={isClickable ? e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)") : undefined}
        onMouseLeave={isClickable ? e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)") : undefined}
      >
        <DocTypeIcon doc={doc} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#e5e5e5", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{doc.title}</p>
          {doc.description && (
            <p style={{ color: "#555", fontSize: 10, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{doc.description}</p>
          )}
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#444", flexShrink: 0 }}>
          {fmtDate(doc.last_updated_at ?? doc.created_at)}
        </span>
        {isLink && <ExternalLink size={10} color="#38bdf8" style={{ flexShrink: 0 }} />}
        {!isLink && hasContent && <ChevronDown size={10} color="#a855f7" style={{ flexShrink: 0 }} />}
        <button data-role="delete" onClick={handleDelete} disabled={deleting}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: "#555", padding: "2px 4px", flexShrink: 0 }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "#555")}
          title="Remove" aria-label="Remove document">
          {deleting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
        </button>
      </div>

      <AnimatePresence>
        {viewerOpen && <DocViewerModal doc={doc} onClose={() => setViewerOpen(false)} />}
      </AnimatePresence>
    </>
  );
}


// ── Main Component ───────────────────────────────────────────────────────────

export function AgentDocuments({ agentId }: { agentId: string }) {
  const [docs, setDocs] = useState<AgentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents`);
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const filtered = docs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>📚</span>
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ccc" }}>Library</span>
        {docs.length > 0 && (
          <span style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 7px" }}>
            {docs.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={fetchDocs} title="Refresh" style={{ all: "unset", cursor: "pointer", color: "#444" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#888")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#444")}>
          <RefreshCw size={11} />
        </button>
        <button onClick={() => setShowAdd(true)} id={`add-doc-${agentId}`}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#ff8c00", padding: "3px 8px", borderRadius: 6, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)" }}>
          <Plus size={11} /> Add
        </button>
      </div>

      {/* Search */}
      {docs.length > 3 && (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={10} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#555" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#ccc", fontSize: 12, padding: "5px 8px 5px 24px", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", padding: "8px 0" }}>
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 12 }}>Loading library…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "14px 0", textAlign: "center" }}>
          {docs.length === 0 ? (
            <>
              <p style={{ color: "#555", fontSize: 12, fontStyle: "italic", margin: 0 }}>No documents yet.</p>
              <p style={{ color: "#444", fontSize: 11, marginTop: 4 }}>Upload a file, paste a Google Doc link, or create a blank doc.</p>
              <button onClick={() => setShowAdd(true)}
                style={{ marginTop: 10, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)", borderRadius: 8, color: "#ff8c00", cursor: "pointer", padding: "5px 14px", fontSize: 12, fontWeight: 700 }}>
                + Add First Document
              </button>
            </>
          ) : (
            <p style={{ color: "#555", fontSize: 12, margin: 0 }}>No results for "{search}"</p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <AnimatePresence initial={false}>
            {filtered.map(doc => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <DocCard doc={doc} agentId={agentId} onDeleted={fetchDocs} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddDocModal agentId={agentId} onDone={fetchDocs} onClose={() => setShowAdd(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
