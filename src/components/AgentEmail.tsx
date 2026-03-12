"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Mail, CheckCircle2, Loader2, AlertCircle, ExternalLink } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "";

interface EmailStatus {
    email: string;
    created_at: string;
    updated_at: string;
}

export function AgentEmail({ agentId, agentName }: { agentId: string; agentName: string }) {
    const [status, setStatus]   = useState<EmailStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [removing, setRemoving] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${BOT_URL}/admin/agents/${agentId}/email`);
            const data = await res.json();
            setStatus(data);
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }, [agentId]);

    useEffect(() => {
        fetchStatus();

        // If redirected back from Google OAuth, refresh status and clear query params
        const params = new URLSearchParams(window.location.search);
        if (params.get("gmail_connected") === agentId) {
            fetchStatus();
            window.history.replaceState({}, "", window.location.pathname);
        }
        if (params.get("gmail_error")) {
            setError(decodeURIComponent(params.get("gmail_error") ?? "Unknown error"));
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [agentId, fetchStatus]);

    const handleConnect = () => {
        window.location.href = `${BOT_URL}/auth/gmail?agent_id=${encodeURIComponent(agentId)}`;
    };

    const handleDisconnect = async () => {
        if (!confirm(`Disconnect Gmail from ${agentName}? The agent will lose email access.`)) return;
        setRemoving(true);
        try {
            await fetch(`${BOT_URL}/admin/agents/${agentId}/email`, { method: "DELETE" });
            setStatus(null);
        } catch (e: any) {
            setError(e?.message ?? "Failed to disconnect");
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div style={{ padding: "1rem 0" }}>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <Mail size={16} color="#7289da" />
                <span className="is-size-6 has-text-weight-bold has-text-white">Gmail Integration</span>
            </div>

            {error && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <AlertCircle size={14} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />
                    <p className="is-size-7" style={{ color: "#ef4444", margin: 0 }}>{error}</p>
                </div>
            )}

            {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555" }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="is-size-7">Checking connection…</span>
                </div>
            ) : status ? (
                /* ── Connected ── */
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <CheckCircle2 size={14} color="#22c55e" />
                        <span className="is-size-7 has-text-weight-bold" style={{ color: "#22c55e" }}>Connected</span>
                    </div>
                    <p className="is-size-7 has-text-white" style={{ marginBottom: 4 }}>
                        <strong>Account:</strong> {status.email}
                    </p>
                    <p className="is-size-7 has-text-grey" style={{ marginBottom: 12 }}>
                        Connected {new Date(status.created_at).toLocaleDateString()}
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="button is-small is-dark"
                            onClick={handleConnect}
                            title="Switch to a different Gmail account"
                        >
                            Switch Account
                        </button>
                        <button
                            className={`button is-small is-danger is-light ${removing ? "is-loading" : ""}`}
                            onClick={handleDisconnect}
                            disabled={removing}
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            ) : (
                /* ── Not connected ── */
                <div style={{ padding: "16px", borderRadius: 10, background: "rgba(114,137,218,0.06)", border: "1px solid rgba(114,137,218,0.2)", textAlign: "center" }}>
                    <Mail size={28} color="#7289da" style={{ marginBottom: 8, opacity: 0.7 }} />
                    <p className="is-size-7 has-text-grey-light" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                        No Gmail account connected.<br />
                        Connect one so <strong className="has-text-white">{agentName}</strong> can read, search, and send emails.
                    </p>
                    <button
                        className="button is-small is-link"
                        onClick={handleConnect}
                        style={{ background: "#7289da", borderColor: "#7289da" }}
                    >
                        <span className="icon is-small"><ExternalLink size={12} /></span>
                        <span>Connect Gmail</span>
                    </button>
                    <p className="is-size-7 has-text-grey mt-3" style={{ opacity: 0.6 }}>
                        You'll be redirected to Google to authorize access.
                    </p>
                </div>
            )}

            {/* Info note */}
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="is-size-7 has-text-grey" style={{ lineHeight: 1.6 }}>
                    <strong className="has-text-grey-light">Available tools after connecting:</strong><br />
                    <code style={{ fontSize: 10 }}>gmail_read</code> · <code style={{ fontSize: 10 }}>gmail_search</code> · <code style={{ fontSize: 10 }}>gmail_get</code> · <code style={{ fontSize: 10 }}>gmail_send</code>
                </p>
            </div>
        </div>
    );
}
