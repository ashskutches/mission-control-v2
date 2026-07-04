"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import IntegrationsPanel from "@/components/IntegrationsPanel";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Batch Tagger Toggle ───────────────────────────────────────────────────────
function BatchTaggerSettings() {
  const [enabled,     setEnabled]     = useState<boolean | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(false);
  const [lastRun,     setLastRun]     = useState<string | null>(null);
  const [lastRunNote, setLastRunNote] = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BOT_URL}/admin/settings/batch-tagger`);
      const data = await res.json();
      setEnabled(data.enabled ?? false);
      setLastRun(data.lastRun ?? null);
      setLastRunNote(data.lastRunNote ?? null);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const toggle = async () => {
    if (enabled === null || toggling) return;
    const next = !enabled;
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/settings/batch-tagger`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as any;
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setEnabled(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  };

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const isOn = enabled === true;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${isOn ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12,
      padding: "1.25rem",
      transition: "border-color 0.3s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 22, marginTop: 1 }}>🏷️</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <p className="has-text-white has-text-weight-bold" style={{ fontSize: 14, margin: 0 }}>
              Batch Image Tagger
            </p>
            {/* Status pill */}
            {loading ? (
              <span className="has-text-grey" style={{ fontSize: 11 }}>checking…</span>
            ) : (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: 20,
                background: isOn ? "rgba(251,191,36,0.12)" : "rgba(100,100,100,0.12)",
                color:      isOn ? "#fbbf24"               : "#666",
                border:     `1px solid ${isOn ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                textTransform: "uppercase",
              }}>
                {isOn ? "● ACTIVE" : "○ PAUSED"}
              </span>
            )}
          </div>
          <p className="has-text-grey" style={{ fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            Automatically tags images and videos in Google Drive using GPT-4o-mini vision.
            Runs 3 passes per day (nightly + every 4h + every 8h). <strong style={{ color: "#fbbf24" }}>High cost when active</strong> — enable only when building or refreshing your content library.
          </p>
        </div>

        {/* Toggle switch */}
        <button
          id="batch-tagger-toggle"
          onClick={toggle}
          disabled={loading || toggling || enabled === null}
          title={isOn ? "Click to pause batch tagger" : "Click to enable batch tagger"}
          style={{
            position:        "relative",
            width:           44,
            height:          24,
            borderRadius:    12,
            border:          "none",
            cursor:          loading || toggling ? "not-allowed" : "pointer",
            background:      isOn ? "rgba(251,191,36,0.85)" : "rgba(255,255,255,0.1)",
            transition:      "background 0.25s",
            flexShrink:      0,
            outline:         "none",
            boxShadow:       isOn ? "0 0 0 2px rgba(251,191,36,0.3)" : "none",
          }}
        >
          <span style={{
            position:   "absolute",
            top:        3,
            left:       isOn ? 23 : 3,
            width:      18,
            height:     18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            opacity:    toggling ? 0.5 : 1,
          }} />
        </button>
      </div>

      {/* Last run + schedule info */}
      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>Last Run</p>
          <p style={{ fontSize: 12, color: "#aaa" }}>
            {lastRun ? timeAgo(lastRun) : "Never"}
            {lastRunNote && <span style={{ color: "#666", marginLeft: 6, fontSize: 11 }}>— {lastRunNote.slice(0, 60)}</span>}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>Schedule (when active)</p>
          <p style={{ fontSize: 12, color: "#aaa" }}>Nightly 2 AM · Every 4h (75 imgs) · Every 8h (75 imgs)</p>
        </div>
      </div>

      {/* Paused notice */}
      {!loading && !isOn && (
        <div style={{
          marginTop: 10,
          padding: "7px 11px",
          borderRadius: 7,
          background: "rgba(100,100,100,0.06)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ fontSize: 11, color: "#777", margin: 0 }}>
            ⏸ Tagger is paused — all three crons will skip silently until re-enabled. Your Drive library won't be auto-tagged until you turn this on.
          </p>
        </div>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 8 }}>⚠️ {error}</p>}
    </div>
  );
}

// ── Global Drive ──────────────────────────────────────────────────────────────
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

            {/* ── Automation ──────────────────────────────────────────────── */}
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Automation</p>
              <BatchTaggerSettings />
            </div>

            {/* ── Google Drive ────────────────────────────────────────────── */}
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Google Drive</p>
              <GlobalDriveSettings />
            </div>

            {/* ── Google Calendar ─────────────────────────────────────────── */}
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>Google Calendar</p>
              <GlobalCalendarSettings />
            </div>

            {/* ── API Integrations ────────────────────────────────────────── */}
            <div>
              <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey mb-4" style={{ letterSpacing: "0.12em" }}>API Integrations</p>
              <IntegrationsPanel />
            </div>

            {/* ── Orchestration Logic ─────────────────────────────────────── */}
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
