"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Mail, HardDrive, CheckCircle2, Loader2, AlertCircle, ExternalLink } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "";

interface AccountStatus {
    email: string;
    created_at: string;
    updated_at: string;
}

// ── Shared connection card ────────────────────────────────────────────────────

interface GoogleAccountCardProps {
    label: string;
    icon: React.ReactNode;
    accentColor: string;
    status: AccountStatus | null;
    loading: boolean;
    removing: boolean;
    error: string | null;
    toolsNote: React.ReactNode;
    onConnect: () => void;
    onDisconnect: () => void;
    connectLabel: string;
    /** Optional notice shown below a connected account (e.g. fallback hint) */
    connectedNote?: React.ReactNode;
}

function GoogleAccountCard({
    label, icon, accentColor, status, loading, removing, error,
    toolsNote, onConnect, onDisconnect, connectLabel, connectedNote,
}: GoogleAccountCardProps) {
    const borderAlpha = "33"; // ~20% alpha
    const bg = `${accentColor}0f`;
    const border = `1px solid ${accentColor}${borderAlpha}`;

    return (
        <div style={{ padding: "1rem 0" }}>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                {icon}
                <span className="is-size-6 has-text-weight-bold has-text-white">{label}</span>
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
                /* Connected */
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <CheckCircle2 size={14} color="#22c55e" />
                        <span className="is-size-7 has-text-weight-bold" style={{ color: "#22c55e" }}>Connected</span>
                    </div>
                    <p className="is-size-7 has-text-white" style={{ marginBottom: 4 }}>
                        <strong>Account:</strong> {status.email}
                    </p>
                    <p className="is-size-7 has-text-grey" style={{ marginBottom: connectedNote ? 8 : 12 }}>
                        Connected {new Date(status.created_at).toLocaleDateString()}
                    </p>
                    {connectedNote && (
                        <p className="is-size-7" style={{ color: "#aaa", marginBottom: 12 }}>{connectedNote}</p>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="button is-small is-dark" onClick={onConnect} title={`Switch to a different ${label} account`}>
                            Switch Account
                        </button>
                        <button
                            className={`button is-small is-danger is-light ${removing ? "is-loading" : ""}`}
                            onClick={onDisconnect}
                            disabled={removing}
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            ) : (
                /* Not connected */
                <div style={{ padding: "16px", borderRadius: 10, background: bg, border, textAlign: "center" }}>
                    <div style={{ marginBottom: 8, opacity: 0.7 }}>{icon}</div>
                    <p className="is-size-7 has-text-grey-light" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                        No {label} account connected.
                    </p>
                    <button
                        className="button is-small is-link"
                        onClick={onConnect}
                        style={{ background: accentColor, borderColor: accentColor }}
                    >
                        <span className="icon is-small"><ExternalLink size={12} /></span>
                        <span>{connectLabel}</span>
                    </button>
                    <p className="is-size-7 has-text-grey mt-3" style={{ opacity: 0.6 }}>
                        You'll be redirected to Google to authorize access.
                    </p>
                </div>
            )}

            {/* Tools */}
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="is-size-7 has-text-grey" style={{ lineHeight: 1.6 }}>
                    <strong className="has-text-grey-light">Available tools:</strong><br />
                    {toolsNote}
                </p>
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentEmail({ agentId, agentName }: { agentId: string; agentName: string }) {
    const [gmailStatus, setGmailStatus]   = useState<AccountStatus | null>(null);
    const [driveStatus, setDriveStatus]   = useState<AccountStatus | null>(null);
    const [gmailLoading, setGmailLoading] = useState(true);
    const [driveLoading, setDriveLoading] = useState(true);
    const [gmailRemoving, setGmailRemoving] = useState(false);
    const [driveRemoving, setDriveRemoving] = useState(false);
    const [gmailError, setGmailError]     = useState<string | null>(null);
    const [driveError, setDriveError]     = useState<string | null>(null);

    const fetchGmail = useCallback(async () => {
        try {
            setGmailLoading(true);
            const res = await fetch(`${BOT_URL}/admin/agents/${agentId}/email`);
            setGmailStatus(await res.json());
        } catch { setGmailStatus(null); }
        finally { setGmailLoading(false); }
    }, [agentId]);

    const fetchDrive = useCallback(async () => {
        try {
            setDriveLoading(true);
            const res = await fetch(`${BOT_URL}/admin/agents/${agentId}/drive`);
            setDriveStatus(await res.json());
        } catch { setDriveStatus(null); }
        finally { setDriveLoading(false); }
    }, [agentId]);

    useEffect(() => {
        fetchGmail();
        fetchDrive();

        const params = new URLSearchParams(window.location.search);
        if (params.get("gmail_connected") === agentId) { fetchGmail(); window.history.replaceState({}, "", window.location.pathname); }
        if (params.get("gmail_error"))  { setGmailError(decodeURIComponent(params.get("gmail_error") ?? "")); window.history.replaceState({}, "", window.location.pathname); }
        if (params.get("drive_connected") === agentId) { fetchDrive(); window.history.replaceState({}, "", window.location.pathname); }
        if (params.get("drive_error"))  { setDriveError(decodeURIComponent(params.get("drive_error") ?? "")); window.history.replaceState({}, "", window.location.pathname); }
    }, [agentId, fetchGmail, fetchDrive]);

    const handleGmailConnect    = () => { window.location.href = `${BOT_URL}/auth/gmail?agent_id=${encodeURIComponent(agentId)}`; };
    const handleDriveConnect    = () => { window.location.href = `${BOT_URL}/auth/drive?agent_id=${encodeURIComponent(agentId)}`; };

    const handleGmailDisconnect = async () => {
        if (!confirm(`Disconnect Gmail from ${agentName}? The agent will lose email access.`)) return;
        setGmailRemoving(true);
        try { await fetch(`${BOT_URL}/admin/agents/${agentId}/email`, { method: "DELETE" }); setGmailStatus(null); }
        catch (e: any) { setGmailError(e?.message ?? "Failed to disconnect"); }
        finally { setGmailRemoving(false); }
    };

    const handleDriveDisconnect = async () => {
        if (!confirm(`Disconnect Google Drive from ${agentName}? Drive tools will fall back to the Gmail account if one is connected.`)) return;
        setDriveRemoving(true);
        try { await fetch(`${BOT_URL}/admin/agents/${agentId}/drive`, { method: "DELETE" }); setDriveStatus(null); }
        catch (e: any) { setDriveError(e?.message ?? "Failed to disconnect"); }
        finally { setDriveRemoving(false); }
    };

    return (
        <div>
            {/* Divider between the two cards */}
            <GoogleAccountCard
                label="Gmail"
                icon={<Mail size={16} color="#ea4335" />}
                accentColor="#ea4335"
                status={gmailStatus}
                loading={gmailLoading}
                removing={gmailRemoving}
                error={gmailError}
                onConnect={handleGmailConnect}
                onDisconnect={handleGmailDisconnect}
                connectLabel="Connect Gmail"
                toolsNote={
                    <>
                        <code style={{ fontSize: 10 }}>gmail_read</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gmail_search</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gmail_get</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gmail_send</code>
                    </>
                }
            />

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "4px 0" }} />

            <GoogleAccountCard
                label="Google Drive"
                icon={<HardDrive size={16} color="#4285f4" />}
                accentColor="#4285f4"
                status={driveStatus}
                loading={driveLoading}
                removing={driveRemoving}
                error={driveError}
                onConnect={handleDriveConnect}
                onDisconnect={handleDriveDisconnect}
                connectLabel="Connect Drive"
                connectedNote={
                    driveStatus ? undefined : undefined
                }
                toolsNote={
                    <>
                        <code style={{ fontSize: 10 }}>gdrive_create_sheet</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gdrive_create_doc</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gdrive_append_sheet</code> ·{" "}
                        <code style={{ fontSize: 10 }}>gdrive_update_doc</code>
                        {!driveStatus && gmailStatus && (
                            <><br /><span style={{ opacity: 0.6 }}>⚠️ Not connected — Drive tools will use the Gmail account ({gmailStatus.email}) as fallback.</span></>
                        )}
                        {!driveStatus && !gmailStatus && (
                            <><br /><span style={{ opacity: 0.6 }}>Connect Gmail or Drive to enable these tools.</span></>
                        )}
                    </>
                }
            />
        </div>
    );
}
