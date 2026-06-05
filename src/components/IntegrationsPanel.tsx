"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Loader, Key, X, Eye, EyeOff, ShieldCheck, Zap, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  display_name: string;
  category: string;
  status: "active" | "broken" | "requested" | "disabled" | "in_progress";
  credentials_ok: boolean;
  description: string | null;
  agent_tools: string[];
  env_vars: string[];
  docs_url: string | null;
  notes: string | null;
  last_verified_at: string | null;
  secret_set_at: string | null;
  secret_set_by: string | null;
  updated_at: string;
}

interface CheckResult {
  // live-check fields
  ok: boolean;
  check_type: "live" | "env_only";
  label: string;
  detail: string | null;
  latency_ms: number | null;
  status: string;
  blockage_created: boolean;
  // legacy /check fields (still returned by old endpoint)
  credentials_ok?: boolean;
  missing?: string[];
  present?: string[];
  message?: string;
}

interface SetSecretResult {
  ok: boolean;
  railway_updated: boolean;
  in_memory_set: boolean;
  redeploy_note?: string;
  persistence_warning?: string;
  status: string;
  credentials_ok: boolean;
  missing: string[];
  present: string[];
  message: string;
  error?: string;
  hint?: string;
}


interface SetKeyModalState {
  integrationId: string;
  integrationName: string;
  varName: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:      { label: "Active",      color: "#22c55e", bg: "rgba(34,197,94,0.1)",   Icon: CheckCircle },
  broken:      { label: "Broken",      color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   Icon: XCircle },
  requested:   { label: "Requested",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  Icon: Clock },
  in_progress: { label: "In Progress", color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  Icon: RefreshCw },
  disabled:    { label: "Disabled",    color: "#64748b", bg: "rgba(100,116,139,0.1)", Icon: AlertTriangle },
};

const CATEGORY_ORDER = ["ecommerce", "analytics", "email", "ads", "comms", "storage", "ai", "other"];

const API_BASE = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(items: Integration[]): Record<string, Integration[]> {
  const grouped: Record<string, Integration[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ── Set Key Modal ─────────────────────────────────────────────────────────────

function SetKeyModal({
  modal,
  onClose,
  onSuccess,
}: {
  modal: SetKeyModalState;
  onClose: () => void;
  onSuccess: (result: SetSecretResult) => void;
}) {
  const [value, setValue]       = useState("");
  const [setBy, setSetBy]       = useState("");
  const [showValue, setShowVal] = useState(false);
  const [submitting, setSub]    = useState(false);
  const [result, setResult]     = useState<SetSecretResult | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSub(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/${modal.integrationId}/set-secret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          var_name: modal.varName,
          value:    value.trim(),
          set_by:   setBy.trim() || "mission-control",
        }),
      });
      const json: SetSecretResult = await res.json();
      setResult(json);
      if (json.ok) {
        onSuccess(json);
        setValue("");
      }
    } catch (err: any) {
      setResult({ ok: false, error: err.message } as any);
    } finally {
      setSub(false);
    }
  }

  // Trap focus inside modal
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={`Set ${modal.varName}`}
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(15,25,50,0.98) 100%)",
          border: "1px solid rgba(56,189,248,0.2)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.08)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Key size={18} color="#38bdf8" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>
              Set API Key
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              {modal.integrationName}
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none", border: "none", padding: 4, cursor: "pointer",
              color: "#475569", display: "flex", alignItems: "center",
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Var name pill */}
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 18,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>
            VARIABLE NAME
          </div>
          <code style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", fontFamily: "monospace" }}>
            {modal.varName}
          </code>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Key value */}
          <div>
            <label
              htmlFor="secret-value-input"
              style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}
            >
              API KEY VALUE
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="secret-value-input"
                ref={inputRef}
                type={showValue ? "text" : "password"}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="Paste your API key here…"
                autoComplete="off"
                spellCheck={false}
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 40px 10px 12px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "#e2e8f0", fontSize: 13, fontFamily: "monospace",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(56,189,248,0.4)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                type="button"
                aria-label={showValue ? "Hide key" : "Reveal key"}
                onClick={() => setShowVal(v => !v)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", padding: 4, cursor: "pointer",
                  color: "#475569", display: "flex",
                }}
              >
                {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Set by */}
          <div>
            <label
              htmlFor="set-by-input"
              style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}
            >
              YOUR NAME <span style={{ fontWeight: 400, color: "#475569" }}>(for audit trail)</span>
            </label>
            <input
              id="set-by-input"
              type="text"
              value={setBy}
              onChange={e => setSetBy(e.target.value)}
              placeholder="e.g. Robert"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 12px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#e2e8f0", fontSize: 13,
                outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(56,189,248,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Security note */}
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <ShieldCheck size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11, color: "#4ade80", lineHeight: 1.5 }}>
              This key is sent over HTTPS directly to Railway. It is <strong>never stored</strong> in any database — only the timestamp and your name are recorded.
            </p>
          </div>

          {/* Result feedback */}
          {result && (
            <div style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 12,
              background: result.ok ? "rgba(34,197,94,0.08)" : "rgba(244,63,94,0.08)",
              border: `1px solid ${result.ok ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)"}`,
              color: result.ok ? "#4ade80" : "#fca5a5",
              lineHeight: 1.6,
            }}>
              {result.ok ? (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ {result.message}</div>
                  {result.missing?.length > 0 && (
                    <div style={{ color: "#fbbf24", fontSize: 11, marginBottom: 4 }}>
                      Still missing: {result.missing.join(", ")}
                    </div>
                  )}
                  {result.redeploy_note && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      ℹ️ {result.redeploy_note}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    ❌ {result.error ?? "Unknown error"}
                  </div>
                  {(result as any).hint && (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{(result as any).hint}</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !value.trim()}
            id={`set-key-submit-${modal.integrationId}`}
            style={{
              padding: "11px 20px", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer",
              background: submitting || !value.trim()
                ? "rgba(56,189,248,0.08)"
                : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
              border: submitting || !value.trim()
                ? "1px solid rgba(56,189,248,0.15)"
                : "1px solid rgba(56,189,248,0.3)",
              color: submitting || !value.trim() ? "#475569" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "all 0.2s",
              boxShadow: submitting || !value.trim() ? "none" : "0 4px 20px rgba(14,165,233,0.3)",
            }}
          >
            {submitting
              ? <><Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Sending to Railway…</>
              : result?.ok
                ? <><CheckCircle size={13} /> Done — Close</>
                : <><Key size={13} /> Submit to Railway</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [checkingId, setCheckingId]     = useState<string | null>(null);
  const [checkResult, setCheckResult]   = useState<Record<string, CheckResult>>({});
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [setKeyModal, setSetKeyModal]   = useState<SetKeyModalState | null>(null);
  const [recentlySet, setRecentlySet]   = useState<Record<string, string>>({});  // varName → message

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations`);
      if (!res.ok) throw new Error(`${res.status}`);
      setIntegrations(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function checkIntegration(id: string) {
    setCheckingId(id);
    try {
      // Call live-check — makes a real API call, creates blockage on fail
      const res = await fetch(`${API_BASE}/admin/integrations/${id}/live-check`, { method: "POST" });
      const result: CheckResult = await res.json();
      setCheckResult(prev => ({ ...prev, [id]: result }));
      await load(); // refresh status badges
    } finally {
      setCheckingId(null);
    }
  }

  async function deleteIntegration(id: string) {
    if (!confirm("Delete this integration entry? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/admin/integrations/${id}`, { method: "DELETE" });
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSetKeySuccess(result: SetSecretResult, varName: string) {
    const key = varName;
    setRecentlySet(prev => ({ ...prev, [key]: result.message }));
    // Refresh integration list after 800ms
    setTimeout(() => load(), 800);
  }

  const grouped = groupByCategory(integrations);
  const stats = {
    active:    integrations.filter(i => i.status === "active").length,
    broken:    integrations.filter(i => i.status === "broken").length,
    requested: integrations.filter(i => i.status === "requested" || i.status === "in_progress").length,
    missing:   integrations.filter(i => !i.credentials_ok && (i.env_vars?.length ?? 0) > 0).length,
    total:     integrations.length,
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 13 }}>
      Loading integrations…
    </div>
  );

  if (error) return (
    <div style={{ color: "#f43f5e", fontSize: 12, padding: "12px 16px", background: "rgba(244,63,94,0.08)", borderRadius: 8 }}>
      Failed to load integrations: {error}
    </div>
  );

  return (
    <>
      {/* Set Key Modal */}
      {setKeyModal && (
        <SetKeyModal
          modal={setKeyModal}
          onClose={() => setSetKeyModal(null)}
          onSuccess={result => {
            handleSetKeySuccess(result, setKeyModal.varName);
            if (result.ok) setSetKeyModal(null);
          }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Active",  value: stats.active,    color: "#22c55e" },
          { label: "Broken",  value: stats.broken,    color: "#f43f5e" },
          { label: "Pending", value: stats.requested, color: "#f59e0b" },
          { label: "No Keys", value: stats.missing,   color: "#f43f5e" },
          { label: "Total",   value: stats.total,     color: "#94a3b8" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "8px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", alignItems: "center", minWidth: 66,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: "#64748b", marginTop: 2, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        <button onClick={load} style={{
          marginLeft: "auto", padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
          color: "#94a3b8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
        }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Category groups */}
      {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(category => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
            {category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(grouped[category] ?? []).map(item => {
              const cfg       = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.disabled;
              const isExp     = expanded === item.id;
              const result    = checkResult[item.id];
              const hasMissing = !item.credentials_ok && (item.env_vars?.length ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  id={`integration-${item.name}`}
                  style={{
                    background: "rgba(255,255,255,0.02)", borderRadius: 10, overflow: "hidden",
                    border: hasMissing         ? "1px solid rgba(244,63,94,0.3)"
                          : item.status === "active"    ? "1px solid rgba(34,197,94,0.15)"
                          : item.status === "requested" ? "1px solid rgba(245,158,11,0.2)"
                          : "1px solid rgba(255,255,255,0.06)",
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  {/* Row */}
                  <div
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
                    onClick={() => setExpanded(isExp ? null : item.id)}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: cfg.color,
                      boxShadow: item.status === "active" ? `0 0 6px ${cfg.color}` : "none",
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flex: 1 }}>
                      {item.display_name}
                    </span>
                    {hasMissing && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                        background: "rgba(244,63,94,0.15)", color: "#f43f5e",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <Key size={9} /> NEEDS KEY
                      </span>
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                      background: cfg.bg, color: cfg.color, letterSpacing: "0.06em",
                    }}>
                      {cfg.label.toUpperCase()}
                    </span>
                    {isExp ? <ChevronUp size={13} style={{ color: "#64748b", flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: "#64748b", flexShrink: 0 }} />}
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 14px",
                      display: "flex", flexDirection: "column", gap: 12,
                      animation: "fadeIn 0.15s ease",
                    }}>
                      {item.description && (
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{item.description}</p>
                      )}

                      {/* Env vars with Set Key buttons */}
                      {(item.env_vars?.length ?? 0) > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 8 }}>
                            REQUIRED ENV VARS
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {item.env_vars.map(v => {
                              const isSet = item.credentials_ok || recentlySet[v];
                              return (
                                <div key={v} style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  padding: "7px 10px", borderRadius: 7,
                                  background: isSet
                                    ? "rgba(34,197,94,0.06)"
                                    : "rgba(244,63,94,0.05)",
                                  border: isSet
                                    ? "1px solid rgba(34,197,94,0.15)"
                                    : "1px solid rgba(244,63,94,0.12)",
                                }}>
                                  <div style={{
                                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                    background: isSet ? "#22c55e" : "#f43f5e",
                                    boxShadow: isSet ? "0 0 5px #22c55e" : "none",
                                  }} />
                                  <code style={{
                                    fontSize: 11, fontFamily: "monospace", flex: 1,
                                    color: isSet ? "#4ade80" : "#fca5a5", fontWeight: 600,
                                  }}>
                                    {v}
                                  </code>
                                  {recentlySet[v] ? (
                                    <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>✓ SET</span>
                                  ) : !item.credentials_ok ? (
                                    <button
                                      id={`set-key-btn-${item.id}-${v}`}
                                      aria-label={`Set ${v} for ${item.display_name}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSetKeyModal({
                                          integrationId: item.id,
                                          integrationName: item.display_name,
                                          varName: v,
                                        });
                                      }}
                                      style={{
                                        padding: "4px 11px", borderRadius: 5, fontSize: 10, fontWeight: 800,
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                                        background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                                        color: "#38bdf8",
                                        transition: "all 0.15s",
                                      }}
                                      onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.2)";
                                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(56,189,248,0.2)";
                                      }}
                                      onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.1)";
                                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                                      }}
                                    >
                                      <Key size={9} /> Set Key
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓ OK</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Agent tools */}
                      {(item.agent_tools?.length ?? 0) > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 4 }}>AGENT TOOLS</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {item.agent_tools.map(t => (
                              <span key={t} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                background: "rgba(56,189,248,0.08)", color: "#38bdf8",
                              }}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Audit trail */}
                      {item.secret_set_at && (
                        <div style={{
                          padding: "7px 10px", borderRadius: 7, fontSize: 11,
                          background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.1)",
                          display: "flex", alignItems: "center", gap: 6, color: "#4ade80",
                        }}>
                          <ShieldCheck size={12} />
                          Key set by <strong>{item.secret_set_by ?? "unknown"}</strong> on {fmtDate(item.secret_set_at)}
                        </div>
                      )}

                      {item.notes && (
                        <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontStyle: "italic" }}>{item.notes}</p>
                      )}
                      {item.last_verified_at && (
                        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>
                          Last checked: {new Date(item.last_verified_at).toLocaleString()}
                        </p>
                      )}

                      {/* Check result */}
                      {result && (
                        <div style={{
                          padding: "10px 12px", borderRadius: 8, fontSize: 11,
                          background: result.ok ? "rgba(34,197,94,0.07)" : "rgba(244,63,94,0.08)",
                          border: `1px solid ${result.ok ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.25)"}`,
                          display: "flex", flexDirection: "column", gap: 6,
                        }}>
                          {/* Top row: ok/fail + check type badge + latency */}
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            {result.ok
                              ? <CheckCircle size={12} color="#22c55e" />
                              : <AlertCircle size={12} color="#f43f5e" />}
                            <span style={{ fontWeight: 800, color: result.ok ? "#22c55e" : "#fca5a5", flex: 1 }}>
                              {result.label}
                            </span>
                            <span style={{
                              fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
                              background: result.check_type === "live" ? "rgba(56,189,248,0.12)" : "rgba(100,116,139,0.15)",
                              color: result.check_type === "live" ? "#38bdf8" : "#94a3b8",
                              display: "flex", alignItems: "center", gap: 3,
                            }}>
                              {result.check_type === "live"
                                ? <><Zap size={8} /> LIVE TEST</>
                                : <>ENV ONLY</>}
                            </span>
                            {result.latency_ms !== null && result.latency_ms !== undefined && (
                              <span style={{ fontSize: 9, color: "#64748b" }}>{result.latency_ms}ms</span>
                            )}
                          </div>
                          {/* Detail line */}
                          {result.detail && (
                            <div style={{ fontSize: 10, color: result.ok ? "#64748b" : "#fca5a5", lineHeight: 1.5 }}>
                              {result.detail}
                            </div>
                          )}
                          {/* Blockage notice */}
                          {result.blockage_created && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 5, fontSize: 10,
                              color: "#fbbf24", padding: "5px 8px", borderRadius: 6,
                              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                            }}>
                              <AlertTriangle size={10} /> A blockage was auto-created — check /pipeline for details.
                            </div>
                          )}
                          {/* Legacy missing vars */}
                          {result.missing && result.missing.length > 0 && (
                            <div style={{ fontSize: 10, color: "#fbbf24" }}>
                              Missing: {result.missing.join(", ")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          id={`check-btn-${item.id}`}
                          disabled={checkingId === item.id}
                          onClick={() => checkIntegration(item.id)}
                          style={{
                            padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            background: checkingId === item.id ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.12)",
                            border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8",
                            display: "flex", alignItems: "center", gap: 5,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => { if (checkingId !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.22)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(56,189,248,0.2)"; } }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.12)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                        >
                          {checkingId === item.id
                            ? <><Loader size={10} style={{ animation: "spin 0.8s linear infinite" }} /> Testing…</>
                            : <><Zap size={10} /> Run Live Test</>}
                        </button>

                        {item.docs_url && (
                          <a
                            href={item.docs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "#94a3b8", textDecoration: "none",
                            }}
                          >
                            Docs ↗
                          </a>
                        )}

                        <button
                          disabled={deletingId === item.id}
                          onClick={() => deleteIntegration(item.id)}
                          style={{
                            marginLeft: "auto", padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "#475569",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
