"use client";

/**
 * Research — a library, not a queue.
 *
 * Research and one-off tasks were previously mixed together on /work, sorted by
 * run state. But the two have different questions attached to them: a task asks
 * "is it done?", research asks "what did we learn, and where can I read it?".
 *
 * So this page leads with the finding and the deliverable, and treats run status
 * as secondary metadata. The task queue stays at /work.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FlaskConical, Search, FileText, ExternalLink, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Clock, Bot, Link2,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface Deliverable {
  id: string;
  title: string | null;
  url: string | null;
  doc_type: string | null;
  created_at: string;
  last_updated_at: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  description: string | null;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  priority: number | null;
  insight_id: string | null;
  milestones: { label: string; done?: boolean }[] | null;
  current_milestone: number | null;
  run_count: number | null;
  max_runs: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  summary: string | null;
  deliverables: Deliverable[];
}

interface ResearchResponse {
  items: ResearchItem[];
  total: number;
  counts: { active: number; blocked: number; done: number; withDeliverable: number };
  unattachedDocuments: (Deliverable & { agent_id: string | null; routine_id: string | null })[];
}

const STATUS_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  done:      { color: "#22c55e", icon: CheckCircle2,  label: "Complete" },
  running:   { color: "#38bdf8", icon: Loader2,       label: "Running" },
  pending:   { color: "#f59e0b", icon: Clock,         label: "Queued" },
  blocked:   { color: "#f43f5e", icon: AlertTriangle, label: "Blocked" },
  cancelled: { color: "#6b7280", icon: Clock,         label: "Cancelled" },
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, padding: "14px 18px", flex: 1, minWidth: 120 }}>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "4px 0 0" }}>
        {label}
      </p>
    </div>
  );
}

function ResearchCard({ item }: { item: ResearchItem }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status] ?? STATUS_META.pending!;
  const StatusIcon = meta.icon;
  const hasDoc = item.deliverables.length > 0;

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: `${meta.color}14`,
          border: `1px solid ${meta.color}33`, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, marginTop: 1,
        }}>
          <StatusIcon size={13} color={meta.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0, lineHeight: 1.4 }}>
            {item.title}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {meta.label}
            </span>
            {item.agent_name && (
              <span style={{ fontSize: 10, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Bot size={10} /> {item.agent_name}
              </span>
            )}
            <span style={{ fontSize: 10, color: "#475569" }}>
              {new Date(item.created_at).toLocaleDateString()}
            </span>
            {(item.run_count ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: "#475569" }}>
                {item.run_count} run{item.run_count === 1 ? "" : "s"}
              </span>
            )}
            {item.insight_id && (
              <a
                href={`/pipeline/${item.insight_id}`}
                style={{ fontSize: 10, color: "#a78bfa", display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}
              >
                <Link2 size={10} /> from insight
              </a>
            )}
          </div>

          {/* The finding — the reason this page exists. */}
          {item.summary && (
            <p style={{
              fontSize: 11.5, color: "#94a3b8", margin: "10px 0 0", lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: open ? 99 : 3, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {item.summary}
            </p>
          )}

          {/* Deliverables — the thing you actually want to open. */}
          {hasDoc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 11 }}>
              {item.deliverables.map(d => (
                <a
                  key={d.id}
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11,
                    fontWeight: 600, color: "#a78bfa", textDecoration: "none",
                    background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.22)",
                    borderRadius: 8, padding: "7px 10px", width: "fit-content", maxWidth: "100%",
                  }}
                >
                  <FileText size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.title ?? "Untitled document"}
                  </span>
                  <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                </a>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 10.5, color: "#475569", fontStyle: "italic", margin: "10px 0 0" }}>
              {item.status === "done"
                ? "Completed without a linked deliverable."
                : "No deliverable yet."}
            </p>
          )}

          {/* Milestones, collapsed by default — this is process, not findings. */}
          {Array.isArray(item.milestones) && item.milestones.length > 0 && (
            <>
              <button
                onClick={() => setOpen(o => !o)}
                style={{
                  marginTop: 10, fontSize: 10, color: "#64748b", background: "none",
                  border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
                }}
              >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {open ? "Hide" : "Show"} plan ({item.milestones.length} steps)
              </button>
              {open && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {item.milestones.map((m, i) => {
                    const done = m.done || i < (item.current_milestone ?? 0);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: done ? "#22c55e" : "#334155", flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 10.5, color: done ? "#64748b" : "#94a3b8", textDecoration: done ? "line-through" : "none" }}>
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/research?limit=200`);
      if (!res.ok) throw new Error(`Research fetch failed: ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const agents = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of data?.items ?? []) if (i.agent_id) m.set(i.agent_id, i.agent_name ?? i.agent_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  // Filtering runs client-side so typing stays instant on a library this size.
  const visible = useMemo(() => {
    let items = data?.items ?? [];
    if (statusFilter) items = items.filter(i => i.status === statusFilter);
    if (agentFilter) items = items.filter(i => i.agent_id === agentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        [i.title, i.summary, i.description, i.agent_name, ...i.deliverables.map(d => d.title)]
          .filter(Boolean).some(f => String(f).toLowerCase().includes(q)),
      );
    }
    return items;
  }, [data, search, statusFilter, agentFilter]);

  return (
    <div style={{ padding: "22px 26px", maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FlaskConical size={15} color="#a78bfa" />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>Research</h1>
        <button
          onClick={() => fetchData()}
          aria-label="Refresh research library"
          style={{
            marginLeft: "auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#94a3b8",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 18px" }}>
        Investigations and the reports they produced. One-off actions live under{" "}
        <a href="/work" style={{ color: "#4a9eff", textDecoration: "none" }}>Tasks</a>.
      </p>

      {/* Counts */}
      {data && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <StatCard label="Total" value={data.total} color="#e2e8f0" />
          <StatCard label="With report" value={data.counts.withDeliverable} color="#a78bfa" />
          <StatCard label="Active" value={data.counts.active} color="#38bdf8" />
          <StatCard label="Blocked" value={data.counts.blocked} color="#f43f5e" />
          <StatCard label="Complete" value={data.counts.done} color="#22c55e" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search findings and reports…"
            style={{
              paddingLeft: 28, paddingRight: 10, height: 34, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
              color: "#e2e8f0", fontSize: 12, outline: "none", width: 240,
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            height: 34, paddingLeft: 10, paddingRight: 10, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
            color: statusFilter ? "#e2e8f0" : "#64748b", fontSize: 12, outline: "none",
          }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {agents.length > 0 && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={{
              height: 34, paddingLeft: 10, paddingRight: 10, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
              color: agentFilter ? "#e2e8f0" : "#64748b", fontSize: 12, outline: "none",
            }}
          >
            <option value="">All agents</option>
            {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}

        {(search || statusFilter || agentFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setAgentFilter(""); }}
            style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
          >
            Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>
          {visible.length} of {data?.total ?? 0}
        </span>
      </div>

      {/* Body */}
      {error && (
        <div style={{ ...card, padding: 16, borderColor: "rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.06)" }}>
          <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{error}</p>
        </div>
      )}

      {!error && loading && !data && (
        <p style={{ fontSize: 12, color: "#64748b" }}>Loading research…</p>
      )}

      {!error && data && visible.length === 0 && (
        <div style={{ ...card, padding: "28px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            {data.total === 0
              ? "No research yet. Research appears here when an agent runs an investigation."
              : "No research matches these filters."}
          </p>
        </div>
      )}

      {visible.map(item => <ResearchCard key={item.id} item={item} />)}

      {/* Reports with no tracked research item — usually produced directly by a
          routine. Shown so the library is complete rather than quietly partial. */}
      {data && data.unattachedDocuments.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
            Other reports
          </p>
          <p style={{ fontSize: 10.5, color: "#475569", margin: "0 0 10px" }}>
            Documents agents produced outside a tracked research run.
          </p>
          <div style={{ ...card, padding: "6px 14px" }}>
            {data.unattachedDocuments.map(d => (
              <a
                key={d.id}
                href={d.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "9px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)", textDecoration: "none",
                }}
              >
                <FileText size={12} color="#64748b" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.title ?? "Untitled document"}
                </span>
                <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
                <ExternalLink size={10} color="#475569" style={{ flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
