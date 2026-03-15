"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileText, Trash2, Loader2, Plus, ExternalLink, Clock, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "";

interface AgentDoc {
    id: string;
    title: string;
    description: string | null;
    content: string | null;
    url: string | null;
    doc_type: "doc" | "sheet";
    routine_id: string | null;
    last_updated_at: string | null;
    created_at: string;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Create Document Modal ─────────────────────────────────────────────────────

function CreateDocModal({ agentId, onCreated, onClose }: { agentId: string; onCreated: () => void; onClose: () => void }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createDriveDoc, setCreateDriveDoc] = useState(true);

    const handleCreate = async () => {
        if (!title.trim()) return;
        setSaving(true); setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, createGoogleDoc: createDriveDoc }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create document");
            onCreated();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={onClose}>
            <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "1.5rem", width: "min(440px, 95vw)", display: "flex", flexDirection: "column", gap: "0.875rem" }}
                onClick={e => e.stopPropagation()}>
                <p className="has-text-white has-text-weight-bold" style={{ fontSize: 15 }}>📄 New Living Document</p>
                <p className="has-text-grey" style={{ fontSize: 12 }}>
                    Research routines can write to this document. Task routines can read from it as context — no re-researching.
                </p>

                <div>
                    <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", display: "block", marginBottom: 4 }}>Title *</label>
                    <input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Reddit Strategy, Competitor Analysis, Weekly Market Brief"
                        className="input is-small"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
                        onKeyDown={e => e.key === "Enter" && handleCreate()}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", display: "block", marginBottom: 4 }}>Description</label>
                    <input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="What does this document track?"
                        className="input is-small"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
                    />
                </div>

                {/* Google Drive toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={createDriveDoc} onChange={e => setCreateDriveDoc(e.target.checked)}
                        style={{ accentColor: "#ff8c00", width: 14, height: 14 }} />
                    <span style={{ fontSize: 12, color: "#aaa" }}>Create matching Google Doc in <code style={{ color: "#f59e0b" }}>ai-agent-files/</code></span>
                </label>

                {error && <p style={{ color: "#ef4444", fontSize: 12 }}>⚠️ {error}</p>}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={onClose} className="button is-dark is-small">Cancel</button>
                    <button onClick={handleCreate} disabled={saving || !title.trim()} className="button is-small"
                        style={{ background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.35)", color: "#ff8c00", fontWeight: 800 }}>
                        {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Creating…</> : "Create Document"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocCard({ doc, agentId, onDeleted }: { doc: AgentDoc; agentId: string; onDeleted: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isLiving = !!doc.last_updated_at;
    const preview = doc.content?.trim().slice(0, 280) ?? null;

    const handleDelete = async () => {
        if (!window.confirm(`Remove "${doc.title}"? The Google Doc will not be deleted.`)) return;
        setDeleting(true);
        try {
            await fetch(`${BOT_URL}/admin/agents/${agentId}/documents/${doc.id}`, { method: "DELETE" });
            onDeleted();
        } finally { setDeleting(false); }
    };

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, overflow: "hidden",
            borderLeft: isLiving ? "3px solid #f59e0b" : "3px solid rgba(255,255,255,0.08)",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                <FileText size={13} color={isLiving ? "#f59e0b" : "#555"} style={{ flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="has-text-white" style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                    </p>
                    {doc.description && (
                        <p className="has-text-grey" style={{ fontSize: 10, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.description}</p>
                    )}
                </div>

                {/* Last updated */}
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: isLiving ? "#f59e0b" : "#444", flexShrink: 0 }}>
                    {isLiving && <Clock size={9} />}
                    {fmtDate(doc.last_updated_at ?? doc.created_at)}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "flex", alignItems: "center", color: "#555", padding: "2px 4px" }}
                            title="Open in Google Docs"
                            onMouseEnter={e => (e.currentTarget.style.color = "#38bdf8")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
                            <ExternalLink size={11} />
                        </a>
                    )}
                    {preview && (
                        <button onClick={() => setExpanded(x => !x)}
                            style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: "#555", padding: "2px 4px" }}
                            title={expanded ? "Collapse" : "Preview content"}>
                            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}
                    <button onClick={handleDelete} disabled={deleting}
                        style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", color: "#555", padding: "2px 4px" }}
                        title="Remove document"
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "#555")}>
                        {deleting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                    </button>
                </div>
            </div>

            {/* Content preview */}
            {expanded && preview && (
                <div style={{
                    padding: "8px 12px 10px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(0,0,0,0.2)",
                }}>
                    <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {preview}{doc.content!.length > 280 ? "…" : ""}
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AgentDocuments({ agentId }: { agentId: string }) {
    const [docs, setDocs]           = useState<AgentDoc[]>([]);
    const [loading, setLoading]     = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const fetchDocs = useCallback(async () => {
        try {
            setLoading(true);
            const res  = await fetch(`${BOT_URL}/admin/agents/${agentId}/documents`);
            const data = await res.json();
            setDocs(Array.isArray(data) ? data : []);
        } catch { setDocs([]); }
        finally { setLoading(false); }
    }, [agentId]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    return (
        <div style={{ padding: "0.5rem 0" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13 }}>📄</span>
                <span className="is-size-7 has-text-weight-bold has-text-white">Living Documents</span>
                {docs.length > 0 && (
                    <span className="tag is-small" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", fontSize: 10 }}>
                        {docs.length}
                    </span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={fetchDocs} style={{ all: "unset", cursor: "pointer", color: "#444" }}
                    title="Refresh" onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#888")}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "#444")}>
                    <RefreshCw size={11} />
                </button>
                <button onClick={() => setShowCreate(true)}
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#ff8c00", padding: "3px 8px", borderRadius: 6, background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.25)" }}>
                    <Plus size={11} /> New
                </button>
            </div>

            {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    <span className="is-size-7">Loading documents…</span>
                </div>
            ) : docs.length === 0 ? (
                <div style={{ padding: "12px 0", textAlign: "center" }}>
                    <p className="is-size-7 has-text-grey" style={{ opacity: 0.5, fontStyle: "italic" }}>No documents yet.</p>
                    <p className="is-size-7 has-text-grey" style={{ opacity: 0.4, fontSize: 11, marginTop: 4 }}>
                        Create one to start the research → task workflow.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {docs.map(doc => (
                        <DocCard key={doc.id} doc={doc} agentId={agentId} onDeleted={fetchDocs} />
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateDocModal agentId={agentId} onCreated={fetchDocs} onClose={() => setShowCreate(false)} />
            )}
        </div>
    );
}
