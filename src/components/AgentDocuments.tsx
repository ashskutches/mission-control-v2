"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileText, Sheet, ExternalLink, Trash2, Loader2, FolderOpen } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "";

interface AgentDocument {
    id: string;
    title: string;
    url: string;
    doc_type: "doc" | "sheet";
    created_at: string;
}

export function AgentDocuments({ agentId }: { agentId: string }) {
    const [docs, setDocs]       = useState<AgentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

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

    const handleDelete = async (docId: string) => {
        setDeleting(docId);
        try {
            await fetch(`${BOT_URL}/admin/agents/${agentId}/documents/${docId}`, { method: "DELETE" });
            setDocs(d => d.filter(x => x.id !== docId));
        } finally { setDeleting(null); }
    };

    const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "#555" }}>
            <Loader2 size={13} className="animate-spin" />
            <span className="is-size-7">Loading documents…</span>
        </div>
    );

    return (
        <div style={{ padding: "0.5rem 0" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <FolderOpen size={15} color="#f59e0b" />
                <span className="is-size-7 has-text-weight-bold has-text-white">Documents</span>
                {docs.length > 0 && (
                    <span className="tag is-small" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", fontSize: 10 }}>
                        {docs.length}
                    </span>
                )}
            </div>

            {docs.length === 0 ? (
                <p className="is-size-7 has-text-grey" style={{ opacity: 0.5, fontStyle: "italic", padding: "4px 0" }}>
                    No documents yet. Ask the agent to create a Google Doc or Sheet.
                </p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {docs.map(doc => {
                        const Icon = doc.doc_type === "sheet" ? Sheet : FileText;
                        const color = doc.doc_type === "sheet" ? "#22c55e" : "#38bdf8";
                        return (
                            <div
                                key={doc.id}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "7px 10px", borderRadius: 8,
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <Icon size={13} color={color} style={{ flexShrink: 0 }} />
                                <span className="is-size-7 has-text-white" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {doc.title}
                                </span>
                                <span className="is-size-7 has-text-grey" style={{ flexShrink: 0, fontSize: 10 }}>
                                    {fmt(doc.created_at)}
                                </span>
                                <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color, flexShrink: 0, display: "flex", alignItems: "center" }}
                                    title="Open"
                                >
                                    <ExternalLink size={12} />
                                </a>
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    disabled={deleting === doc.id}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0, flexShrink: 0, display: "flex", alignItems: "center" }}
                                    title="Remove from list"
                                >
                                    {deleting === doc.id
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <Trash2 size={11} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
