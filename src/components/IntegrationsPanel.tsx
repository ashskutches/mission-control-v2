\"use client\";
import React, { useEffect, useState, useCallback } from \"react\";
import { Plug, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Loader } from \"lucide-react\";

interface Integration {
  id: string;
  name: string;
  display_name: string;
  category: string;
  status: \"active\" | \"broken\" | \"requested\" | \"disabled\" | \"in_progress\";
  credentials_ok: boolean;
  description: string | null;
  agent_tools: string[];
  env_vars: string[];
  docs_url: string | null;
  notes: string | null;
  last_verified_at: string | null;
  updated_at: string;
}

interface CheckResult {
  status: string;
  credentials_ok: boolean;
  missing: string[];
  present: string[];
  message: string;
}

const STATUS_CONFIG = {
  active:      { label: \"Active\",      color: \"#22c55e\", bg: \"rgba(34,197,94,0.1)\",   Icon: CheckCircle },
  broken:      { label: \"Broken\",      color: \"#f43f5e\", bg: \"rgba(244,63,94,0.1)\",   Icon: XCircle },
  requested:   { label: \"Requested\",   color: \"#f59e0b\", bg: \"rgba(245,158,11,0.1)\",  Icon: Clock },
  in_progress: { label: \"In Progress\", color: \"#38bdf8\", bg: \"rgba(56,189,248,0.1)\",  Icon: RefreshCw },
  disabled:    { label: \"Disabled\",    color: \"#64748b\", bg: \"rgba(100,116,139,0.1)\", Icon: AlertTriangle },
};

const CATEGORY_ORDER = [\"ecommerce\", \"analytics\", \"email\", \"ads\", \"comms\", \"storage\", \"ai\", \"other\"];

function groupByCategory(items: Integration[]): Record<string, Integration[]> {
  const grouped: Record<string, Integration[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

const API_BASE = process.env.NEXT_PUBLIC_BOT_URL ?? \"http://localhost:3001\";

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, CheckResult>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const res = await fetch(`${API_BASE}/admin/integrations/${id}/check`, { method: \"POST\" });
      const result: CheckResult = await res.json();
      setCheckResult(prev => ({ ...prev, [id]: result }));
      // Reload to reflect updated status
      await load();
    } finally {
      setCheckingId(null);
    }
  }

  async function deleteIntegration(id: string) {
    if (!confirm(\"Delete this integration entry? This cannot be undone.\")) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/admin/integrations/${id}`, { method: \"DELETE\" });
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = groupByCategory(integrations);

  const stats = {
    active:    integrations.filter(i => i.status === \"active\").length,
    broken:    integrations.filter(i => i.status === \"broken\").length,
    requested: integrations.filter(i => i.status === \"requested\" || i.status === \"in_progress\").length,
    total:     integrations.length,
  };

  if (loading) return (
    <div style={{ textAlign: \"center\", padding: \"32px 0\", color: \"#475569\", fontSize: 13 }}>
      Loading integrations…
    </div>
  );

  if (error) return (
    <div style={{ color: \"#f43f5e\", fontSize: 12, padding: \"12px 16px\", background: \"rgba(244,63,94,0.08)\", borderRadius: 8 }}>
      Failed to load integrations: {error}
    </div>
  );

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: \"flex\", gap: 12, marginBottom: 20, flexWrap: \"wrap\" }}>
        {[
          { label: \"Active\",    value: stats.active,    color: \"#22c55e\" },
          { label: \"Broken\",    value: stats.broken,    color: \"#f43f5e\" },
          { label: \"Pending\",   value: stats.requested, color: \"#f59e0b\" },
          { label: \"Total\",     value: stats.total,     color: \"#94a3b8\" },
        ].map(s => (
          <div key={s.label} style={{
            padding: \"8px 16px\", borderRadius: 8,
            background: \"rgba(255,255,255,0.03)\", border: \"1px solid rgba(255,255,255,0.06)\",
            display: \"flex\", flexDirection: \"column\", alignItems: \"center\", minWidth: 70,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: \"#64748b\", marginTop: 2, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: \"auto\", padding: \"6px 12px\", borderRadius: 7, fontSize: 11, fontWeight: 700,
            color: \"#94a3b8\", background: \"rgba(255,255,255,0.04)\", border: \"1px solid rgba(255,255,255,0.08)\",
            cursor: \"pointer\", display: \"flex\", alignItems: \"center\", gap: 5,
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Category groups */}
      {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(category => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: \"0.1em\",
            color: \"#475569\", textTransform: \"uppercase\", marginBottom: 8,
          }}>
            {category}
          </div>
          <div style={{ display: \"flex\", flexDirection: \"column\", gap: 6 }}>
            {(grouped[category] ?? []).map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.disabled;
              const isExpanded = expanded === item.id;
              const result = checkResult[item.id];

              return (
                <div key={item.id} style={{
                  background: \"rgba(255,255,255,0.02)\", border: \"1px solid rgba(255,255,255,0.06)\",
                  borderRadius: 10, overflow: \"hidden\",
                  ...(item.status === \"broken\" ? { borderColor: \"rgba(244,63,94,0.25)\" } : {}),
                  ...(item.status === \"requested\" || item.status === \"in_progress\" ? { borderColor: \"rgba(245,158,11,0.2)\" } : {}),
                  ...(item.status === \"active\" ? { borderColor: \"rgba(34,197,94,0.15)\" } : {}),
                }}>
                  {/* Row */}
                  <div
                    style={{ padding: \"10px 14px\", display: \"flex\", alignItems: \"center\", gap: 10, cursor: \"pointer\", userSelect: \"none\" }}
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: \"50%\", flexShrink: 0,
                      background: cfg.color,
                      boxShadow: item.status === \"active\" ? `0 0 6px ${cfg.color}` : \"none\",
                    }} />

                    {/* Name */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: \"#e2e8f0\", flex: 1 }}>
                      {item.display_name}
                    </span>

                    {/* Env var indicator */}
                    {!item.credentials_ok && item.env_vars?.length > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: \"2px 6px\", borderRadius: 4,
                        background: \"rgba(244,63,94,0.15)\", color: \"#f43f5e\", letterSpacing: \"0.05em\",
                      }}>
                        NO CREDS
                      </span>
                    )}

                    {/* Status badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: \"2px 8px\", borderRadius: 4,
                      background: cfg.bg, color: cfg.color, letterSpacing: \"0.06em\",
                    }}>
                      {cfg.label.toUpperCase()}
                    </span>

                    {/* Expand chevron */}
                    {isExpanded
                      ? <ChevronUp size={13} style={{ color: \"#64748b\", flexShrink: 0 }} />
                      : <ChevronDown size={13} style={{ color: \"#64748b\", flexShrink: 0 }} />}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      borderTop: \"1px solid rgba(255,255,255,0.05)\",
                      padding: \"12px 14px\", display: \"flex\", flexDirection: \"column\", gap: 10,
                    }}>
                      {item.description && (
                        <p style={{ fontSize: 12, color: \"#94a3b8\", margin: 0 }}>{item.description}</p>
                      )}

                      {/* Env vars */}
                      {item.env_vars?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: \"#475569\", fontWeight: 700, marginBottom: 4 }}>REQUIRED ENV VARS</div>
                          <div style={{ display: \"flex\", gap: 6, flexWrap: \"wrap\" }}>
                            {item.env_vars.map(v => (
                              <code key={v} style={{
                                fontSize: 10, padding: \"2px 6px\", borderRadius: 4,
                                background: \"rgba(255,255,255,0.05)\", color: \"#94a3b8\",
                              }}>{v}</code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tools */}
                      {item.agent_tools?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: \"#475569\", fontWeight: 700, marginBottom: 4 }}>AGENT TOOLS</div>
                          <div style={{ display: \"flex\", gap: 6, flexWrap: \"wrap\" }}>
                            {item.agent_tools.map(t => (
                              <span key={t} style={{
                                fontSize: 10, padding: \"2px 8px\", borderRadius: 4,
                                background: \"rgba(56,189,248,0.08)\", color: \"#38bdf8\",
                              }}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {item.notes && (
                        <p style={{ fontSize: 11, color: \"#64748b\", margin: 0, fontStyle: \"italic\" }}>
                          {item.notes}
                        </p>
                      )}

                      {/* Last verified */}
                      {item.last_verified_at && (
                        <p style={{ fontSize: 10, color: \"#475569\", margin: 0 }}>
                          Last checked: {new Date(item.last_verified_at).toLocaleString()}
                        </p>
                      )}

                      {/* Check result message */}
                      {result && (
                        <div style={{
                          padding: \"8px 10px\", borderRadius: 6, fontSize: 11,
                          background: result.credentials_ok ? \"rgba(34,197,94,0.08)\" : \"rgba(244,63,94,0.08)\",
                          border: `1px solid ${result.credentials_ok ? \"rgba(34,197,94,0.2)\" : \"rgba(244,63,94,0.2)\"}`,
                          color: result.credentials_ok ? \"#22c55e\" : \"#fca5a5\",
                        }}>
                          {result.message}
                        </div>
                      )}

                      {/* Actions — just Check + Docs + Delete */}
                      <div style={{ display: \"flex\", gap: 8, marginTop: 4, flexWrap: \"wrap\", alignItems: \"center\" }}>
                        <button
                          disabled={checkingId === item.id}
                          onClick={() => checkIntegration(item.id)}
                          style={{
                            padding: \"5px 14px\", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: \"pointer\",
                            background: \"rgba(56,189,248,0.12)\", border: \"1px solid rgba(56,189,248,0.25)\", color: \"#38bdf8\",
                            display: \"flex\", alignItems: \"center\", gap: 5,
                          }}
                        >
                          {checkingId === item.id
                            ? <><Loader size={10} style={{ animation: \"spin 0.8s linear infinite\" }} /> Checking…</>
                            : <>Check Integration</>}
                        </button>

                        {item.docs_url && (
                          <a
                            href={item.docs_url} target=\"_blank\" rel=\"noopener noreferrer\"
                            style={{
                              padding: \"5px 12px\", borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: \"rgba(255,255,255,0.04)\", border: \"1px solid rgba(255,255,255,0.08)\",
                              color: \"#94a3b8\", textDecoration: \"none\",
                            }}
                          >
                            Docs ↗
                          </a>
                        )}

                        <button
                          disabled={deletingId === item.id}
                          onClick={() => deleteIntegration(item.id)}
                          style={{
                            marginLeft: \"auto\", padding: \"5px 10px\", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: \"pointer\",
                            background: \"transparent\", border: \"1px solid rgba(255,255,255,0.06)\", color: \"#475569\",
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
    </div>
  );
}
