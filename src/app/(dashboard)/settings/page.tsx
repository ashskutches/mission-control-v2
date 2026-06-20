"use client";
import React, { useState, useEffect } from "react";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import IntegrationsPanel from "@/components/IntegrationsPanel";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

function GlobalDriveSettings() {
  const [status, setStatus] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BOT_URL}/admin/settings/drive`);
      const data = await res.json();
      setStatus(data?.email ? data : null);
    } catch { setStatus(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive_connected") === "__global__") { fetchStatus(); window.history.replaceState({}, "", window.location.pathname); }
    if (params.get("drive_error")) { setError(decodeURIComponent(params.get("drive_error") ?? "")); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🗂️</span>
        <div>
          <p className="has-text-white has-text-weight-bold" style={{ fontSize: 14 }}>Google Drive</p>
          <p className="has-text-grey" style={{ fontSize: 11, marginTop: 1 }}>One shared account for all agents — used for Living Documents and file exports</p>
        </div>
      </div>
      {loading ? <p className="has-text-grey is-size-7">Checking connection…</p>
        : status ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 10 }}>
              <span style={{ color: "#22c55e", fontSize: 12 }}>●</span>
              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>Connected</span>
              <span className="has-text-grey" style={{ fontSize: 11, marginLeft: 4 }}>{status.email}</span>
            </div>
            <button onClick={async () => { if (!confirm("Disconnect Google Drive?")) return; setRemoving(true); await fetch(`${BOT_URL}/admin/settings/drive`, { method: "DELETE" }); setStatus(null); setRemoving(false); }} disabled={removing} className="button is-small is-dark" style={{ fontSize: 11, border: "1px solid rgba(255,255,255,0.1)" }}>
              {removing ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
              <span style={{ color: "#555", fontSize: 12 }}>○</span>
              <span className="has-text-grey" style={{ fontSize: 12 }}>Not connected</span>
            </div>
            <button onClick={() => { window.location.href = `${BOT_URL}/auth/drive?agent_id=__global__`; }} className="button is-small" style={{ background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.3)", color: "#ff8c00", fontWeight: 700, fontSize: 11 }}>
              Connect Google Drive
            </button>
          </div>
        )}
      {error && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 8 }}>⚠️ {error}</p>}
    </div>
  );
}

function GlobalCalendarSettings() {
  const [status, setStatus] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BOT_URL}/admin/settings/calendar`);
      const data = await res.json();
      setStatus(data?.email ? data : null);
    } catch { setStatus(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "__global__") {
      fetchStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("calendar_error")) {
      setError(decodeURIComponent(params.get("calendar_error") ?? ""));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>📅</span>
        <div>
          <p className="has-text-white has-text-weight-bold" style={{ fontSize: 14 }}>Google Calendar</p>
          <p className="has-text-grey" style={{ fontSize: 11, marginTop: 1 }}>
            Company calendar — agents use this for event planning, scheduling, and coordination tasks
          </p>
        </div>
      </div>

      {loading ? (
        <p className="has-text-grey is-size-7">Checking connection…</p>
      ) : status ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 10 }}>
            <span style={{ color: "#22c55e", fontSize: 12 }}>●</span>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>Connected</span>
            <span className="has-text-grey" style={{ fontSize: 11, marginLeft: 4 }}>{status.email}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                if (!confirm("Reconnect Google Calendar? This will overwrite the existing connection.")) return;
                window.location.href = `${BOT_URL}/auth/calendar?agent_id=__global__`;
              }}
              className="button is-small"
              style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", fontWeight: 700, fontSize: 11 }}
            >
              Reconnect
            </button>
            <button
              onClick={async () => {
                if (!confirm("Disconnect Google Calendar?")) return;
                setRemoving(true);
                await fetch(`${BOT_URL}/admin/settings/calendar`, { method: "DELETE" });
                setStatus(null);
                setRemoving(false);
              }}
              disabled={removing}
              className="button is-small is-dark"
              style={{ fontSize: 11, border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {removing ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
            <span style={{ color: "#555", fontSize: 12 }}>○</span>
            <span className="has-text-grey" style={{ fontSize: 12 }}>Not connected</span>
          </div>
          <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
              ⚠️ <strong>Before connecting:</strong> add{" "}
              <code style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>
                https://gravity-claw-production-fb9e.up.railway.app/auth/calendar/callback
              </code>{" "}
              to your Google Cloud Console → OAuth Credentials → Authorized redirect URIs.
            </p>
          </div>
          <button
            id="connect-google-calendar-btn"
            onClick={() => { window.location.href = `${BOT_URL}/auth/calendar?agent_id=__global__`; }}
            className="button is-small"
            style={{ background: "rgba(52,168,83,0.12)", border: "1px solid rgba(52,168,83,0.3)", color: "#34a853", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📅</span> Connect Google Calendar
          </button>
        </div>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 8 }}>⚠️ {error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="px-4 pb-6 pt-4">
      <div className="columns is-centered">
        <div className="column is-8">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Google Drive</p>
              <GlobalDriveSettings />
            </div>
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Google Calendar</p>
              <GlobalCalendarSettings />
            </div>
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>API Integrations</p>
              <IntegrationsPanel />
            </div>
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Orchestration Logic</p>
              <div className="box p-6">
                <ProviderMatrix stats={[
                  { name: "Anthropic Claude 3.7", share: 85, health: "online", color: "var(--accent-orange)" },
                  { name: "OpenAI GPT-4o", share: 10, health: "online", color: "var(--accent-blue)" },
                  { name: "Local Llama 3 (Fallback)", share: 5, health: "slow", color: "var(--accent-purple)" },
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
